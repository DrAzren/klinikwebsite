import { getDb } from "@/lib/db";
import { requireAction, UnauthenticatedError } from "@/lib/auth/dal";
import { ForbiddenError, type DocumentCategory } from "@/lib/auth/rbac";
import { UploadError, validateUpload } from "@/lib/files";
import { json, sameOrigin } from "@/lib/http";
import { DocumentError, uploadDocument } from "@/lib/staff/documents";
import { runJobs } from "@/lib/integrations/handlers";
import { after } from "next/server";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  try {
    const s = await requireAction("documents:upload");
    const db = await getDb();
    const fd = await req.formData();
    const s2 = (k: string) => String(fd.get(k) ?? "").trim();
    const file = await validateUpload(fd.get("file") as File | null, "document");
    const amount = s2("amount") ? Number(s2("amount")) : null;
    const id = await uploadDocument(db, s, {
      category: s2("category") as DocumentCategory, title: s2("title"), supplier: s2("supplier"), referenceNo: s2("referenceNo"),
      amount: amount !== null && Number.isFinite(amount) ? amount : null, docDate: s2("docDate") || null, notes: s2("notes"),
    }, file);
    after(() => runJobs(db, { dedupeKeys: [`document.drive:${id}`] }).catch((e) => console.error("[documents]", e)));
    return json({ id });
  } catch (e) {
    if (e instanceof UnauthenticatedError) return json({ error: "Session expired. Sign in again." }, 401);
    if (e instanceof ForbiddenError) return json({ error: "You do not have permission to upload documents." }, 403);
    if (e instanceof UploadError || e instanceof DocumentError) return json({ error: e.message }, 400);
    console.error("[documents upload]", e);
    return json({ error: "Upload failed." }, 500);
  }
}
