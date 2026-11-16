"use server";

import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { accessReport, type ReportAccess } from "@/lib/screening/admin";

export async function openReport(token: string, reference: string): Promise<ReportAccess> {
  const db = await getDb();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await rateLimit(db, "report", ip, 20, 3600);
  if (!rl.allowed) return { ok: false, reason: "locked" };
  if (typeof token !== "string" || typeof reference !== "string" || token.length > 100 || reference.length > 30) return { ok: false, reason: "invalid" };
  return accessReport(db, token, reference);
}
