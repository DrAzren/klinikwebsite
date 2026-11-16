import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { runMaintenance } from "@/lib/integrations/handlers";

/**
 * Scheduled maintenance (e.g. Vercel Cron every 10 minutes):
 * processes the integration queue (retries/backoff) and applies retention.
 * Requires `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  const secret = env().CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response("Unauthorized", { status: 401 });
  const result = await runMaintenance(await getDb());
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
