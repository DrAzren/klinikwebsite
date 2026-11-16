import { getDb } from "@/lib/db";
import { requireAction, UnauthenticatedError } from "@/lib/auth/dal";
import { ForbiddenError } from "@/lib/auth/rbac";
import { exportScreeningsCsv, type ScreeningFilters } from "@/lib/screening/admin";

export async function GET(req: Request) {
  try {
    const s = await requireAction("screening:export");
    const u = new URL(req.url);
    const g = (k: string) => u.searchParams.get(k) || undefined;
    const filters: ScreeningFilters = { q: g("q"), from: g("from"), to: g("to"), instrument: g("instrument") as ScreeningFilters["instrument"], severity: g("severity"), priority: g("priority"), status: g("status"), assigned: g("assigned") };
    const csv = await exportScreeningsCsv(await getDb(), s, filters, u.searchParams.get("identifiers") === "1");
    return new Response("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="saringan-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    if (e instanceof UnauthenticatedError) return new Response("Unauthorized", { status: 401 });
    if (e instanceof ForbiddenError) return new Response("Forbidden", { status: 403 });
    throw e;
  }
}
