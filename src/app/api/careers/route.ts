import { after } from "next/server";
import { getDb } from "@/lib/db";
import { applicationSchema, saveApplication } from "@/lib/careers";
import { storeFile, UploadError, validateUpload } from "@/lib/files";
import { clientIp, json, sameOrigin } from "@/lib/http";
import { runJobs } from "@/lib/integrations/handlers";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 6 * 1024 * 1024) return json({ error: "File too large (max 5 MB)" }, 413);
  const db = await getDb();
  const rl = await rateLimit(db, "careers", clientIp(req), 5, 3600);
  if (!rl.allowed) return json({ error: "Too many applications. Please try later." }, 429);

  const form = await req.formData();
  const parsed = applicationSchema.safeParse({
    position: form.get("position"), name: form.get("name"), email: form.get("email"), phone: form.get("phone"),
    message: form.get("message") ?? "", consent: form.get("consent"), website: form.get("website") ?? "",
  });
  if (!parsed.success) return json({ error: "invalid" }, 400);

  let cvFileId: string | null = null;
  const cv = form.get("cv");
  if (cv instanceof File && cv.size > 0) {
    try {
      cvFileId = await storeFile(db, await validateUpload(cv, "cv"), "cv", null);
    } catch (e) {
      return json({ error: e instanceof UploadError ? e.message : "Upload failed" }, 400);
    }
  }
  const id = await saveApplication(db, parsed.data, cvFileId);
  after(() => runJobs(db, { dedupeKeys: [`careers.forward:${id}`] }).catch((e) => console.error("[careers]", e)));
  return json({ ok: true });
}
