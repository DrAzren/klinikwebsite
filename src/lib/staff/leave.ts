/**
 * Leave management. Entitlements and leave types are configurable by the CEO
 * to match the clinic's approved HR policy (defaults mirror Employment Act
 * 1955 minimums for staff with < 2 years' service and MUST be reviewed).
 */
import type { Db } from "../db";
import { audit } from "../audit";
import { assertCan, can } from "../auth/rbac";
import type { SessionInfo } from "../auth/service";

export class LeaveError extends Error {}

export const toISODate = (d: Date) => d.toISOString().slice(0, 10);

/** Count chargeable leave days between two ISO dates inclusive. */
export function countLeaveDays(start: string, end: string, opts: { workingDays: number[]; holidays: Set<string>; halfDay?: boolean }): number {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) throw new LeaveError("Invalid date range");
  if (opts.halfDay) {
    if (start !== end) throw new LeaveError("Half-day leave must be a single date");
    return opts.workingDays.includes(s.getUTCDay()) && !opts.holidays.has(start) ? 0.5 : 0;
  }
  let n = 0;
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = toISODate(d);
    if (opts.workingDays.includes(d.getUTCDay()) && !opts.holidays.has(iso)) n++;
    if (n > 366) throw new LeaveError("Range too long");
  }
  return n;
}

export async function hrSettings(db: Db) {
  const row = await db.one<{ value: number[] }>("select value from app_settings where key = 'hr.working_days'");
  const workingDays = Array.isArray(row?.value) ? row!.value : [1, 2, 3, 4, 5, 6];
  const hol = await db.query<{ date: string }>("select to_char(date, 'YYYY-MM-DD') as date from public_holidays");
  return { workingDays, holidays: new Set(hol.map((h) => h.date)) };
}

export interface LeaveType {
  code: string;
  name_ms: string;
  name_en: string;
  deducts_balance: boolean;
  requires_attachment: boolean;
  paid: boolean;
  default_days: string | number;
}

export async function leaveTypes(db: Db): Promise<LeaveType[]> {
  return db.query<LeaveType>("select * from leave_types where active order by sort");
}

export interface Balance {
  code: string;
  name_ms: string;
  name_en: string;
  deducts: boolean;
  entitlement: number;
  adjustments: number;
  taken: number;
  pending: number;
  available: number;
}

export async function balances(db: Db, userId: string, year: number): Promise<Balance[]> {
  const rows = await db.query<{
    code: string; name_ms: string; name_en: string; deducts_balance: boolean;
    entitlement: string | null; adj: string | null; taken: string | null; pending: string | null; default_days: string;
  }>(
    `select t.code, t.name_ms, t.name_en, t.deducts_balance, t.default_days,
            e.days as entitlement,
            (select sum(delta) from leave_adjustments a where a.user_id = $1 and a.year = $2 and a.leave_type = t.code) as adj,
            (select sum(days) from leave_requests r where r.user_id = $1 and r.leave_type = t.code and r.status = 'approved' and extract(year from r.start_date) = $2) as taken,
            (select sum(days) from leave_requests r where r.user_id = $1 and r.leave_type = t.code and r.status = 'pending' and extract(year from r.start_date) = $2) as pending
       from leave_types t
       left join leave_entitlements e on e.leave_type = t.code and e.user_id = $1 and e.year = $2
      where t.active order by t.sort`,
    [userId, year],
  );
  return rows.map((r) => {
    const entitlement = Number(r.entitlement ?? r.default_days ?? 0);
    const adjustments = Number(r.adj ?? 0);
    const taken = Number(r.taken ?? 0);
    const pending = Number(r.pending ?? 0);
    return {
      code: r.code, name_ms: r.name_ms, name_en: r.name_en, deducts: r.deducts_balance,
      entitlement, adjustments, taken, pending,
      available: entitlement + adjustments - taken - pending,
    };
  });
}

export interface ApplyLeaveInput {
  leaveType: string;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  reason: string;
  attachmentFileId?: string | null;
}

export async function applyLeave(db: Db, s: SessionInfo, input: ApplyLeaveInput) {
  assertCan(s.user.role, "leave:apply");
  const type = await db.one<LeaveType & { active: boolean }>("select * from leave_types where code = $1 and active", [input.leaveType]);
  if (!type) throw new LeaveError("Unknown leave type");
  if (type.requires_attachment && !input.attachmentFileId) throw new LeaveError("Supporting document required (e.g. medical certificate)");
  const days = countLeaveDays(input.startDate, input.endDate, { ...(await hrSettings(db)), halfDay: input.halfDay });
  if (days <= 0) throw new LeaveError("Selected dates contain no working days");

  const overlap = await db.one(
    `select 1 from leave_requests where user_id = $1 and status in ('pending','approved')
      and start_date <= $3::date and end_date >= $2::date`,
    [s.user.id, input.startDate, input.endDate],
  );
  if (overlap) throw new LeaveError("Overlaps an existing leave request");

  if (type.deducts_balance) {
    const year = Number(input.startDate.slice(0, 4));
    const bal = (await balances(db, s.user.id, year)).find((b) => b.code === type.code);
    if (bal && bal.available < days) throw new LeaveError(`Insufficient balance (${bal.available} day(s) available)`);
  }

  const row = await db.one<{ id: string }>(
    `insert into leave_requests (user_id, leave_type, start_date, end_date, half_day, days, reason, attachment_file_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [s.user.id, type.code, input.startDate, input.endDate, input.halfDay, days, input.reason.slice(0, 1000), input.attachmentFileId ?? null],
  );
  await audit(db, { id: s.user.id, label: s.user.username }, "leave.applied", { type: "leave_request", id: row!.id }, { leaveType: type.code, days });
  return { id: row!.id, days };
}

export async function cancelLeave(db: Db, s: SessionInfo, id: string) {
  const r = await db.one<{ id: string }>(
    "update leave_requests set status = 'cancelled' where id = $1 and user_id = $2 and status = 'pending' returning id",
    [id, s.user.id],
  );
  if (!r) throw new LeaveError("Only your own pending requests can be cancelled");
  await audit(db, { id: s.user.id, label: s.user.username }, "leave.cancelled", { type: "leave_request", id });
}

export async function reviewLeave(db: Db, s: SessionInfo, id: string, decision: "approved" | "rejected", comment: string) {
  assertCan(s.user.role, "leave:review");
  const req = await db.one<{ user_id: string; status: string }>("select user_id, status from leave_requests where id = $1", [id]);
  if (!req || req.status !== "pending") throw new LeaveError("Request is not pending");
  if (req.user_id === s.user.id && s.user.role !== "super_admin") throw new LeaveError("You cannot review your own request");
  await db.query(
    "update leave_requests set status = $2, reviewer_id = $3, reviewed_at = now(), review_comment = $4 where id = $1",
    [id, decision, s.user.id, comment.slice(0, 1000) || null],
  );
  await audit(db, { id: s.user.id, label: s.user.username }, `leave.${decision}`, { type: "leave_request", id });
}

export async function listLeave(db: Db, s: SessionInfo, scope: "mine" | "all", status?: string) {
  if (scope === "all") assertCan(s.user.role, "leave:review");
  return db.query<{
    id: string; user_id: string; full_name: string; leave_type: string; name_ms: string; name_en: string;
    start_date: string; end_date: string; days: string; half_day: boolean; reason: string | null; status: string;
    review_comment: string | null; reviewer_name: string | null; created_at: Date; attachment_file_id: string | null;
  }>(
    `select r.id, r.user_id, u.full_name, r.leave_type, t.name_ms, t.name_en,
            to_char(r.start_date,'YYYY-MM-DD') as start_date, to_char(r.end_date,'YYYY-MM-DD') as end_date,
            r.days, r.half_day, r.reason, r.status, r.review_comment, rv.full_name as reviewer_name, r.created_at, r.attachment_file_id
       from leave_requests r
       join staff_users u on u.id = r.user_id
       join leave_types t on t.code = r.leave_type
       left join staff_users rv on rv.id = r.reviewer_id
      where ($1::uuid is null or r.user_id = $1::uuid) and ($2::text is null or r.status = $2::text)
      order by r.status = 'pending' desc, r.start_date desc limit 300`,
    [scope === "mine" ? s.user.id : null, status ?? null],
  );
}

export async function setEntitlement(db: Db, s: SessionInfo, userId: string, year: number, leaveType: string, days: number) {
  assertCan(s.user.role, "leave:configure");
  if (!(days >= 0 && days <= 365)) throw new LeaveError("Invalid number of days");
  await db.query(
    `insert into leave_entitlements (user_id, year, leave_type, days) values ($1,$2,$3,$4)
     on conflict (user_id, year, leave_type) do update set days = excluded.days`,
    [userId, year, leaveType, days],
  );
  await audit(db, { id: s.user.id, label: s.user.username }, "leave.entitlement_set", { type: "staff_user", id: userId }, { year, leaveType, days });
}

export async function adjustBalance(db: Db, s: SessionInfo, userId: string, year: number, leaveType: string, delta: number, reason: string) {
  assertCan(s.user.role, "leave:configure");
  if (!reason.trim()) throw new LeaveError("A reason is required for balance adjustments");
  await db.query(
    "insert into leave_adjustments (user_id, year, leave_type, delta, reason, actor_id) values ($1,$2,$3,$4,$5,$6)",
    [userId, year, leaveType, delta, reason.slice(0, 500), s.user.id],
  );
  await audit(db, { id: s.user.id, label: s.user.username }, "leave.balance_adjusted", { type: "staff_user", id: userId }, { year, leaveType, delta });
}

export async function adjustmentHistory(db: Db, s: SessionInfo, userId?: string) {
  if (!userId || userId !== s.user.id) assertCan(s.user.role, "leave:configure");
  return db.query<{ id: number; full_name: string; year: number; leave_type: string; delta: string; reason: string; actor: string; at: Date }>(
    `select a.id, u.full_name, a.year, a.leave_type, a.delta, a.reason, act.full_name as actor, a.at
       from leave_adjustments a join staff_users u on u.id = a.user_id left join staff_users act on act.id = a.actor_id
      where ($1::uuid is null or a.user_id = $1::uuid) order by a.at desc limit 200`,
    [userId ?? null],
  );
}

/** Approved leave per staff member within a date range (for roster coverage). */
export async function approvedLeaveBetween(db: Db, from: string, to: string) {
  return db.query<{ user_id: string; start_date: string; end_date: string; leave_type: string }>(
    `select user_id, to_char(start_date,'YYYY-MM-DD') as start_date, to_char(end_date,'YYYY-MM-DD') as end_date, leave_type
       from leave_requests where status = 'approved' and start_date <= $2::date and end_date >= $1::date`,
    [from, to],
  );
}

export const canReviewLeave = (s: SessionInfo) => can(s.user.role, "leave:review");
