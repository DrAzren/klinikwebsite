import { getDb } from "@/lib/db";
import { requireAction, UnauthenticatedError } from "@/lib/auth/dal";
import { ForbiddenError } from "@/lib/auth/rbac";
import { getMonth, rosterCsv } from "@/lib/staff/roster";

export async function GET(req: Request) {
  try {
    const s = await requireAction("roster:view");
    const m = new URL(req.url).searchParams.get("m") ?? "";
    if (!/^\d{4}-\d{2}$/.test(m)) return new Response("Bad month", { status: 400 });
    const [y, mm] = m.split("-").map(Number);
    const csv = rosterCsv(await getMonth(await getDb(), s, y, mm));
    return new Response("﻿" + csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="roster-${m}.csv"`, "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    if (e instanceof UnauthenticatedError) return new Response("Unauthorized", { status: 401 });
    if (e instanceof ForbiddenError) return new Response("Forbidden", { status: 403 });
    throw e;
  }
}
