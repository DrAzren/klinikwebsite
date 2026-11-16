/**
 * Duty roster with configurable shifts (A/B/C by default — times and minimum
 * staffing are set by the CEO, nothing historic is hard-coded), leave-aware
 * coverage warnings, rotation patterns, CSV export and an append-only change log.
 */
import type { Db } from "../db";
import { audit } from "../audit";
import { assertCan } from "../auth/rbac";
import type { SessionInfo } from "../auth/service";
import { approvedLeaveBetween, toISODate } from "./leave";

export class RosterError extends Error {}

export interface ShiftDef {
  code: string;
  label: string;
  start_time: string;
  end_time: string;
  min_staff: number;
  color: string;
  active: boolean;
  sort: number;
}

export interface Assignment {
  id: string;
  date: string;
  shift_code: string;
  user_id: string;
  full_name: string;
}

export interface CoverageWarning {
  date: string;
  shift: string;
  kind: "understaffed" | "on_leave" | "double_booked";
  detail: string;
}

export const monthRange = (year: number, month: number) => {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month, 0));
  return { from: toISODate(first), to: toISODate(last), days: last.getUTCDate() };
};

export async function shiftDefs(db: Db): Promise<ShiftDef[]> {
  return db.query<ShiftDef>("select code, label, to_char(start_time,'HH24:MI') as start_time, to_char(end_time,'HH24:MI') as end_time, min_staff, color, active, sort from shift_definitions order by sort");
}

export async function getMonth(db: Db, s: SessionInfo, year: number, month: number) {
  assertCan(s.user.role, "roster:view");
  const { from, to, days } = monthRange(year, month);
  const [shifts, assignments, leave] = await Promise.all([
    shiftDefs(db),
    db.query<Assignment>(
      `select a.id, to_char(a.date,'YYYY-MM-DD') as date, a.shift_code, a.user_id, u.full_name
         from roster_assignments a join staff_users u on u.id = a.user_id
        where a.date between $1::date and $2::date order by a.date, a.shift_code, u.full_name`,
      [from, to],
    ),
    approvedLeaveBetween(db, from, to),
  ]);
  return { from, to, days, shifts, assignments, leave, warnings: coverageWarnings(shifts, assignments, leave, from, to) };
}

export function coverageWarnings(
  shifts: ShiftDef[],
  assignments: Pick<Assignment, "date" | "shift_code" | "user_id" | "full_name">[],
  leave: { user_id: string; start_date: string; end_date: string }[],
  from: string,
  to: string,
): CoverageWarning[] {
  const out: CoverageWarning[] = [];
  const active = shifts.filter((x) => x.active);
  for (let d = new Date(`${from}T00:00:00Z`); toISODate(d) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const date = toISODate(d);
    const today = assignments.filter((a) => a.date === date);
    for (const sh of active) {
      const onShift = today.filter((a) => a.shift_code === sh.code);
      const available = onShift.filter((a) => !leave.some((l) => l.user_id === a.user_id && l.start_date <= date && l.end_date >= date));
      for (const a of onShift) {
        if (!available.includes(a)) out.push({ date, shift: sh.code, kind: "on_leave", detail: `${a.full_name} is on approved leave` });
      }
      if (available.length < sh.min_staff) {
        out.push({ date, shift: sh.code, kind: "understaffed", detail: `${available.length}/${sh.min_staff} staff` });
      }
    }
    const byUser = new Map<string, string[]>();
    for (const a of today) byUser.set(a.user_id, [...(byUser.get(a.user_id) ?? []), a.shift_code]);
    for (const [uid, codes] of byUser) {
      if (codes.length > 1) {
        const name = today.find((a) => a.user_id === uid)!.full_name;
        out.push({ date, shift: codes.join("+"), kind: "double_booked", detail: `${name} on ${codes.join(" & ")}` });
      }
    }
  }
  return out;
}

async function logChange(db: Db, s: SessionInfo, action: string, date: string, shift: string | null, userId: string | null, details: Record<string, unknown> = {}) {
  await db.query(
    "insert into roster_changes (actor_id, action, date, shift_code, user_id, details) values ($1,$2,$3,$4,$5,$6::jsonb)",
    [s.user.id, action, date, shift, userId, JSON.stringify(details)],
  );
}

export async function assign(db: Db, s: SessionInfo, date: string, shift: string, userId: string) {
  assertCan(s.user.role, "roster:edit");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RosterError("Invalid date");
  const def = await db.one("select 1 from shift_definitions where code = $1 and active", [shift]);
  if (!def) throw new RosterError("Unknown shift");
  const user = await db.one("select 1 from staff_users where id = $1 and is_active", [userId]);
  if (!user) throw new RosterError("Unknown or inactive staff member");
  await db.query(
    "insert into roster_assignments (date, shift_code, user_id, created_by) values ($1,$2,$3,$4) on conflict do nothing",
    [date, shift, userId, s.user.id],
  );
  await logChange(db, s, "assign", date, shift, userId);
}

export async function unassign(db: Db, s: SessionInfo, assignmentId: string) {
  assertCan(s.user.role, "roster:edit");
  const row = await db.one<{ date: string; shift_code: string; user_id: string }>(
    "delete from roster_assignments where id = $1 returning to_char(date,'YYYY-MM-DD') as date, shift_code, user_id",
    [assignmentId],
  );
  if (row) await logChange(db, s, "unassign", row.date, row.shift_code, row.user_id);
}

/**
 * Apply a repeating pattern (e.g. ["A","A","B","B","OFF","OFF"]) to one staff
 * member across a date range. Existing assignments for that person in the
 * range are replaced.
 */
export async function applyRotation(db: Db, s: SessionInfo, userId: string, startDate: string, endDate: string, pattern: string[]) {
  assertCan(s.user.role, "roster:edit");
  if (pattern.length === 0 || pattern.length > 28) throw new RosterError("Pattern must have 1–28 steps");
  const codes = new Set((await shiftDefs(db)).filter((d) => d.active).map((d) => d.code));
  for (const p of pattern) if (p !== "OFF" && !codes.has(p)) throw new RosterError(`Unknown shift in pattern: ${p}`);
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (!(end >= start) || (end.getTime() - start.getTime()) / 86_400_000 > 92) throw new RosterError("Range must be 1–93 days");

  await db.tx(async (t) => {
    await t.query("delete from roster_assignments where user_id = $1 and date between $2::date and $3::date", [userId, startDate, endDate]);
    let i = 0;
    for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1), i++) {
      const code = pattern[i % pattern.length];
      if (code === "OFF") continue;
      await t.query("insert into roster_assignments (date, shift_code, user_id, created_by) values ($1,$2,$3,$4)", [toISODate(d), code, userId, s.user.id]);
    }
    await logChange(t, s, "rotation", startDate, null, userId, { endDate, pattern });
  });
  await audit(db, { id: s.user.id, label: s.user.username }, "roster.rotation_applied", { type: "staff_user", id: userId }, { startDate, endDate, pattern });
}

export async function saveShiftDef(db: Db, s: SessionInfo, def: Omit<ShiftDef, "sort"> & { sort?: number }) {
  assertCan(s.user.role, "roster:configure");
  if (!/^[A-Z0-9]{1,4}$/.test(def.code)) throw new RosterError("Shift code must be 1–4 uppercase letters/numbers");
  if (!/^\d{2}:\d{2}$/.test(def.start_time) || !/^\d{2}:\d{2}$/.test(def.end_time)) throw new RosterError("Times must be HH:MM");
  await db.query(
    `insert into shift_definitions (code, label, start_time, end_time, min_staff, color, active, sort)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (code) do update set label = excluded.label, start_time = excluded.start_time, end_time = excluded.end_time,
       min_staff = excluded.min_staff, color = excluded.color, active = excluded.active`,
    [def.code, def.label, def.start_time, def.end_time, Math.max(0, Math.min(20, def.min_staff)), def.color, def.active, def.sort ?? 99],
  );
  await audit(db, { id: s.user.id, label: s.user.username }, "roster.shift_configured", { type: "shift", id: def.code }, { ...def });
}

export async function rosterHistory(db: Db, s: SessionInfo, limit = 100) {
  assertCan(s.user.role, "roster:view");
  return db.query<{ id: number; at: Date; actor: string | null; action: string; date: string; shift_code: string | null; staff: string | null; details: unknown }>(
    `select c.id, c.at, a.full_name as actor, c.action, to_char(c.date,'YYYY-MM-DD') as date, c.shift_code, u.full_name as staff, c.details
       from roster_changes c left join staff_users a on a.id = c.actor_id left join staff_users u on u.id = c.user_id
      order by c.at desc limit $1`,
    [limit],
  );
}

export function rosterCsv(month: Awaited<ReturnType<typeof getMonth>>): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [["Date", "Day", ...month.shifts.filter((s) => s.active).map((s) => `${s.code} (${s.start_time}-${s.end_time})`)].map(esc).join(",")];
  for (let d = new Date(`${month.from}T00:00:00Z`); toISODate(d) <= month.to; d.setUTCDate(d.getUTCDate() + 1)) {
    const date = toISODate(d);
    const row = [date, d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })];
    for (const sh of month.shifts.filter((x) => x.active)) {
      row.push(month.assignments.filter((a) => a.date === date && a.shift_code === sh.code).map((a) => a.full_name).join(" / "));
    }
    lines.push(row.map(esc).join(","));
  }
  return lines.join("\n") + "\n";
}

export async function myUpcomingShifts(db: Db, userId: string, days = 14) {
  return db.query<{ id: string; date: string; shift_code: string; label: string; start_time: string; end_time: string }>(
    `select a.id, to_char(a.date,'YYYY-MM-DD') as date, a.shift_code, d.label, to_char(d.start_time,'HH24:MI') as start_time, to_char(d.end_time,'HH24:MI') as end_time
       from roster_assignments a join shift_definitions d on d.code = a.shift_code
      where a.user_id = $1 and a.date >= current_date and a.date < current_date + $2::int
      order by a.date, d.sort`,
    [userId, days],
  );
}
