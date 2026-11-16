/**
 * Shift swap workflow: Staff A requests → Staff B accepts → manager approves.
 * The roster is changed ONLY in decideSwap() on approval, inside a
 * transaction that re-checks ownership. Every step is written to the
 * append-only shift_swap_events table.
 */
import type { Db } from "../db";
import { audit } from "../audit";
import { assertCan, can } from "../auth/rbac";
import type { SessionInfo } from "../auth/service";

export class SwapError extends Error {}

type SwapStatus = "pending_peer" | "peer_accepted" | "approved" | "rejected" | "declined" | "cancelled";

async function event(db: Db, swapId: string, actorId: string, action: string, note?: string) {
  await db.query("insert into shift_swap_events (swap_id, actor_id, action, note) values ($1,$2,$3,$4)", [swapId, actorId, action, note ?? null]);
}

export async function requestSwap(
  db: Db,
  s: SessionInfo,
  input: { myAssignmentId: string; targetUserId: string; targetAssignmentId?: string | null; reason?: string },
) {
  assertCan(s.user.role, "swap:request");
  if (input.targetUserId === s.user.id) throw new SwapError("Choose a different colleague");
  const mine = await db.one<{ user_id: string; future: boolean }>(
    "select user_id, date >= current_date as future from roster_assignments where id = $1",
    [input.myAssignmentId],
  );
  if (!mine || mine.user_id !== s.user.id) throw new SwapError("That shift is not assigned to you");
  if (!mine.future) throw new SwapError("Past shifts cannot be swapped");
  if (input.targetAssignmentId) {
    const theirs = await db.one<{ user_id: string }>("select user_id from roster_assignments where id = $1", [input.targetAssignmentId]);
    if (!theirs || theirs.user_id !== input.targetUserId) throw new SwapError("The selected shift does not belong to that colleague");
  }
  const target = await db.one("select 1 from staff_users where id = $1 and is_active", [input.targetUserId]);
  if (!target) throw new SwapError("Colleague not found");
  const open = await db.one(
    "select 1 from shift_swaps where requester_assignment_id = $1 and status in ('pending_peer','peer_accepted')",
    [input.myAssignmentId],
  );
  if (open) throw new SwapError("There is already an open swap request for this shift");

  const row = await db.one<{ id: string }>(
    `insert into shift_swaps (requester_id, requester_assignment_id, target_user_id, target_assignment_id, reason)
     values ($1,$2,$3,$4,$5) returning id`,
    [s.user.id, input.myAssignmentId, input.targetUserId, input.targetAssignmentId ?? null, input.reason?.slice(0, 500) ?? null],
  );
  await event(db, row!.id, s.user.id, "requested", input.reason);
  return row!.id;
}

async function load(db: Db, id: string) {
  const sw = await db.one<{ id: string; requester_id: string; target_user_id: string; status: SwapStatus; requester_assignment_id: string; target_assignment_id: string | null }>(
    "select id, requester_id, target_user_id, status, requester_assignment_id, target_assignment_id from shift_swaps where id = $1",
    [id],
  );
  if (!sw) throw new SwapError("Swap request not found");
  return sw;
}

export async function respondSwap(db: Db, s: SessionInfo, id: string, accept: boolean, note?: string) {
  const sw = await load(db, id);
  if (sw.target_user_id !== s.user.id) throw new SwapError("Only the invited colleague can respond");
  if (sw.status !== "pending_peer") throw new SwapError("This request is no longer awaiting your response");
  await db.query("update shift_swaps set status = $2 where id = $1", [id, accept ? "peer_accepted" : "declined"]);
  await event(db, id, s.user.id, accept ? "peer_accepted" : "declined", note);
}

export async function cancelSwap(db: Db, s: SessionInfo, id: string) {
  const sw = await load(db, id);
  if (sw.requester_id !== s.user.id) throw new SwapError("Only the requester can cancel");
  if (!["pending_peer", "peer_accepted"].includes(sw.status)) throw new SwapError("This request can no longer be cancelled");
  await db.query("update shift_swaps set status = 'cancelled' where id = $1", [id]);
  await event(db, id, s.user.id, "cancelled");
}

export async function decideSwap(db: Db, s: SessionInfo, id: string, approve: boolean, note?: string) {
  assertCan(s.user.role, "swap:approve");
  const sw = await load(db, id);
  if (sw.status !== "peer_accepted") throw new SwapError("Swap must be accepted by the colleague before approval");
  if (!approve) {
    await db.query("update shift_swaps set status = 'rejected' where id = $1", [id]);
    await event(db, id, s.user.id, "rejected", note);
    return;
  }
  await db.tx(async (t) => {
    const a = await t.one<{ user_id: string; date: string; shift_code: string }>(
      "select user_id, to_char(date,'YYYY-MM-DD') as date, shift_code from roster_assignments where id = $1",
      [sw.requester_assignment_id],
    );
    if (!a || a.user_id !== sw.requester_id) throw new SwapError("The requester's shift has changed since the request");
    let b: { user_id: string; date: string; shift_code: string } | null = null;
    if (sw.target_assignment_id) {
      b = await t.one("select user_id, to_char(date,'YYYY-MM-DD') as date, shift_code from roster_assignments where id = $1", [sw.target_assignment_id]);
      if (!b || b.user_id !== sw.target_user_id) throw new SwapError("The colleague's shift has changed since the request");
    }
    // Move A's shift to B (and B's shift to A for a two-way swap).
    await t.query("update roster_assignments set user_id = $2 where id = $1", [sw.requester_assignment_id, sw.target_user_id]);
    if (sw.target_assignment_id) await t.query("update roster_assignments set user_id = $2 where id = $1", [sw.target_assignment_id, sw.requester_id]);
    await t.query("update shift_swaps set status = 'approved' where id = $1", [id]);
    await t.query(
      "insert into roster_changes (actor_id, action, date, shift_code, user_id, details) values ($1,'swap',$2,$3,$4,$5::jsonb)",
      [s.user.id, a.date, a.shift_code, sw.target_user_id, JSON.stringify({ swapId: id, from: sw.requester_id, counterpart: b })],
    );
    await event(t, id, s.user.id, "approved", note);
  }).catch((err: unknown) => {
    if (err instanceof SwapError) throw err;
    throw new SwapError("Swap could not be applied — one of the staff may already be on that shift");
  });
  await audit(db, { id: s.user.id, label: s.user.username }, "roster.swap_approved", { type: "shift_swap", id });
}

export async function listSwaps(db: Db, s: SessionInfo) {
  const all = can(s.user.role, "swap:approve");
  return db.query<{
    id: string; status: SwapStatus; reason: string | null; created_at: Date;
    requester_id: string; requester: string; target_user_id: string; target: string;
    a_date: string; a_shift: string; b_date: string | null; b_shift: string | null;
  }>(
    `select sw.id, sw.status, sw.reason, sw.created_at, sw.requester_id, r.full_name as requester, sw.target_user_id, t.full_name as target,
            to_char(a.date,'YYYY-MM-DD') as a_date, a.shift_code as a_shift, to_char(b.date,'YYYY-MM-DD') as b_date, b.shift_code as b_shift
       from shift_swaps sw
       join staff_users r on r.id = sw.requester_id
       join staff_users t on t.id = sw.target_user_id
       left join roster_assignments a on a.id = sw.requester_assignment_id
       left join roster_assignments b on b.id = sw.target_assignment_id
      where $1::boolean or sw.requester_id = $2 or sw.target_user_id = $2
      order by sw.created_at desc limit 200`,
    [all, s.user.id],
  );
}

export async function swapHistory(db: Db, swapId: string) {
  return db.query<{ at: Date; actor: string | null; action: string; note: string | null }>(
    "select e.at, u.full_name as actor, e.action, e.note from shift_swap_events e left join staff_users u on u.id = e.actor_id where e.swap_id = $1 order by e.at",
    [swapId],
  );
}
