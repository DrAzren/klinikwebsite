import { after } from "next/server";
import { getDb } from "@/lib/db";
import { clientIp, json, sameOrigin } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { submissionSchema, submitScreening } from "@/lib/screening/service";
import { runJobs } from "@/lib/integrations/handlers";

const MAX_BODY = 20_000;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const db = await getDb();
  const rl = await rateLimit(db, "screening", clientIp(req), 10, 3600);
  if (!rl.allowed) return json({ error: "rate_limited" }, 429);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: "too_large" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    // Do not echo submitted values back.
    return json({ error: "invalid", fields: parsed.error.issues.map((i) => i.path.join(".")) }, 400);
  }

  const out = await submitScreening(db, parsed.data);

  // Sync Drive / Sheets / email after the response is sent; the cron job retries failures.
  after(async () => {
    try {
      await runJobs(db, { dedupeKeys: ["screening.drive", "screening.sheet", "screening.notify"].map((k) => `${k}:${out.id}`) });
    } catch (e) {
      console.error("[screening] post-submit job run failed", e);
    }
  });

  return json({
    reference: out.reference,
    phq9: out.result.phq9 ? { score: out.result.phq9.score, severity: out.result.phq9.severity } : undefined,
    gad7: out.result.gad7 ? { score: out.result.gad7.score, severity: out.result.gad7.severity } : undefined,
    item9Positive: out.result.item9Positive,
  });
}
