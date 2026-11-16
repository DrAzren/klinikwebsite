import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import { seedReference } from "@/lib/db/seed";
import { adjustBalance, applyLeave, balances, cancelLeave, countLeaveDays, LeaveError, reviewLeave } from "@/lib/staff/leave";
import { applyRotation, assign, coverageWarnings, getMonth, rosterCsv } from "@/lib/staff/roster";
import { cancelSwap, decideSwap, requestSwap, respondSwap, swapHistory } from "@/lib/staff/swaps";
import { ForbiddenError } from "@/lib/auth/rbac";
import { freshDb, makeUser, sessionOf } from "./helpers";

const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

describe("leave day calculation", () => {
  const opts = { workingDays: [1, 2, 3, 4, 5], holidays: new Set(["2026-12-25"]) };
  it("excludes rest days and public holidays", () => {
    // Mon 21 Dec 2026 → Sun 27 Dec 2026: Mon–Fri minus Christmas (Fri) = 4
    expect(countLeaveDays("2026-12-21", "2026-12-27", opts)).toBe(4);
  });
  it("supports half days on a single working date only", () => {
    expect(countLeaveDays("2026-12-21", "2026-12-21", { ...opts, halfDay: true })).toBe(0.5);
    expect(() => countLeaveDays("2026-12-21", "2026-12-22", { ...opts, halfDay: true })).toThrow(LeaveError);
  });
  it("rejects reversed ranges", () => {
    expect(() => countLeaveDays("2026-12-22", "2026-12-21", opts)).toThrow(LeaveError);
  });
});

describe("leave workflow", () => {
  let db: Db;
  let ceo: ReturnType<typeof sessionOf>;
  let doctor: ReturnType<typeof sessionOf>;
  let asst: ReturnType<typeof sessionOf>;
  beforeAll(async () => {
    db = await freshDb();
    await seedReference(db);
    await db.query(`update app_settings set value = '[0,1,2,3,4,5,6]'::jsonb where key = 'hr.working_days'`);
    ceo = sessionOf(await makeUser(db, "ceo", "super_admin"));
    doctor = sessionOf(await makeUser(db, "doc", "resident_doctor"));
    asst = sessionOf(await makeUser(db, "asst", "clinic_assistant"));
  });

  it("applies, tracks pending and enforces balance", async () => {
    const year = Number(iso(30).slice(0, 4));
    const r = await applyLeave(db, asst, { leaveType: "annual", startDate: iso(30), endDate: iso(31), halfDay: false, reason: "Family" });
    expect(r.days).toBe(2);
    const b = (await balances(db, asst.user.id, year)).find((x) => x.code === "annual")!;
    expect(b.pending).toBe(2);
    await expect(applyLeave(db, asst, { leaveType: "annual", startDate: iso(40), endDate: iso(49), halfDay: false, reason: "Long trip" })).rejects.toThrow(/Insufficient/);
  });

  it("rejects overlapping requests and MC without attachment", async () => {
    await expect(applyLeave(db, asst, { leaveType: "annual", startDate: iso(31), endDate: iso(31), halfDay: false, reason: "x" })).rejects.toThrow(/Overlaps/);
    await expect(applyLeave(db, asst, { leaveType: "medical", startDate: iso(60), endDate: iso(60), halfDay: false, reason: "sick" })).rejects.toThrow(/Supporting document/);
  });

  it("only reviewers approve; staff cannot approve their own", async () => {
    const r = await applyLeave(db, doctor, { leaveType: "annual", startDate: iso(70), endDate: iso(70), halfDay: false, reason: "x" });
    await expect(reviewLeave(db, asst, r.id, "approved", "")).rejects.toBeInstanceOf(ForbiddenError);
    await reviewLeave(db, ceo, r.id, "approved", "OK");
    const year = Number(iso(70).slice(0, 4));
    const b = (await balances(db, doctor.user.id, year)).find((x) => x.code === "annual")!;
    expect(b.taken).toBe(1);
    await expect(reviewLeave(db, ceo, r.id, "rejected", "")).rejects.toThrow(/not pending/);
  });

  it("balance adjustments are audited and immutable", async () => {
    const year = Number(iso(30).slice(0, 4));
    await expect(adjustBalance(db, asst, asst.user.id, year, "annual", 5, "self-grant")).rejects.toBeInstanceOf(ForbiddenError);
    await adjustBalance(db, ceo, asst.user.id, year, "annual", 3, "Carry forward from previous year");
    const b = (await balances(db, asst.user.id, year)).find((x) => x.code === "annual")!;
    expect(b.adjustments).toBe(3);
    await expect(db.query("update leave_adjustments set delta = 100")).rejects.toThrow(/append-only/);
  });

  it("staff can cancel only their own pending requests", async () => {
    const r = await applyLeave(db, asst, { leaveType: "unpaid", startDate: iso(90), endDate: iso(90), halfDay: false, reason: "x" });
    await expect(cancelLeave(db, doctor, r.id)).rejects.toThrow();
    await cancelLeave(db, asst, r.id);
  });
});

describe("roster & shift swaps", () => {
  let db: Db;
  let ceo: ReturnType<typeof sessionOf>;
  let a: ReturnType<typeof sessionOf>;
  let b: ReturnType<typeof sessionOf>;
  let c: ReturnType<typeof sessionOf>;
  beforeAll(async () => {
    db = await freshDb();
    await seedReference(db);
    ceo = sessionOf(await makeUser(db, "ceo", "super_admin"));
    a = sessionOf(await makeUser(db, "staffa", "clinic_assistant"));
    b = sessionOf(await makeUser(db, "staffb", "clinic_assistant"));
    c = sessionOf(await makeUser(db, "staffc", "clinic_assistant"));
  });

  it("only roster editors can assign", async () => {
    await expect(assign(db, a, iso(3), "A", a.user.id)).rejects.toBeInstanceOf(ForbiddenError);
    await assign(db, ceo, iso(3), "A", a.user.id);
    await assign(db, ceo, iso(4), "B", b.user.id);
  });

  it("applies rotation patterns with OFF days", async () => {
    await applyRotation(db, ceo, c.user.id, iso(10), iso(15), ["A", "B", "OFF"]);
    const rows = await db.query<{ shift_code: string }>("select shift_code from roster_assignments where user_id = $1 order by date", [c.user.id]);
    expect(rows.map((r) => r.shift_code)).toEqual(["A", "B", "A", "B"]);
    await expect(applyRotation(db, ceo, c.user.id, iso(10), iso(12), ["Z"])).rejects.toThrow(/Unknown shift/);
  });

  it("flags understaffing, staff on leave and double bookings", () => {
    const shifts = [{ code: "A", label: "A", start_time: "08:00", end_time: "14:00", min_staff: 2, color: "", active: true, sort: 1 }];
    const w = coverageWarnings(
      shifts,
      [
        { date: "2026-12-01", shift_code: "A", user_id: "u1", full_name: "One" },
        { date: "2026-12-01", shift_code: "A", user_id: "u2", full_name: "Two" },
      ],
      [{ user_id: "u2", start_date: "2026-12-01", end_date: "2026-12-01" }],
      "2026-12-01",
      "2026-12-01",
    );
    expect(w.map((x) => x.kind).sort()).toEqual(["on_leave", "understaffed"]);
  });

  it("exports the month as CSV", async () => {
    const d = new Date(`${iso(3)}T00:00:00Z`);
    const month = await getMonth(db, ceo, d.getUTCFullYear(), d.getUTCMonth() + 1);
    const csv = rosterCsv(month);
    expect(csv.split("\n")[0]).toMatch(/Date/);
    expect(csv).toContain("STAFFA");
  });

  it("swap: request → peer accept → manager approve updates roster only at approval", async () => {
    const aShift = await db.one<{ id: string }>("select id from roster_assignments where user_id = $1 and date = $2", [a.user.id, iso(3)]);
    const bShift = await db.one<{ id: string }>("select id from roster_assignments where user_id = $1 and date = $2", [b.user.id, iso(4)]);
    const id = await requestSwap(db, a, { myAssignmentId: aShift!.id, targetUserId: b.user.id, targetAssignmentId: bShift!.id, reason: "Appointment" });

    await expect(respondSwap(db, c, id, true)).rejects.toThrow(/invited colleague/);
    await expect(decideSwap(db, ceo, id, true)).rejects.toThrow(/accepted by the colleague/);
    await respondSwap(db, b, id, true);

    // Still unchanged before approval
    const before = await db.one<{ user_id: string }>("select user_id from roster_assignments where id = $1", [aShift!.id]);
    expect(before!.user_id).toBe(a.user.id);

    await expect(decideSwap(db, a, id, true)).rejects.toBeInstanceOf(ForbiddenError);
    await decideSwap(db, ceo, id, true, "Approved");

    const afterA = await db.one<{ user_id: string }>("select user_id from roster_assignments where id = $1", [aShift!.id]);
    const afterB = await db.one<{ user_id: string }>("select user_id from roster_assignments where id = $1", [bShift!.id]);
    expect(afterA!.user_id).toBe(b.user.id);
    expect(afterB!.user_id).toBe(a.user.id);

    const hist = await swapHistory(db, id);
    expect(hist.map((h) => h.action)).toEqual(["requested", "peer_accepted", "approved"]);
    await expect(db.query("update shift_swap_events set action = 'x'")).rejects.toThrow(/append-only/);
    await expect(db.query("delete from roster_changes")).rejects.toThrow(/append-only/);
  });

  it("cannot swap someone else's shift; requester can cancel", async () => {
    await assign(db, ceo, iso(20), "A", b.user.id);
    const bShift = await db.one<{ id: string }>("select id from roster_assignments where user_id = $1 and date = $2", [b.user.id, iso(20)]);
    await expect(requestSwap(db, a, { myAssignmentId: bShift!.id, targetUserId: c.user.id })).rejects.toThrow(/not assigned to you/);
    const id = await requestSwap(db, b, { myAssignmentId: bShift!.id, targetUserId: c.user.id });
    await expect(requestSwap(db, b, { myAssignmentId: bShift!.id, targetUserId: a.user.id })).rejects.toThrow(/already an open swap/);
    await cancelSwap(db, b, id);
    await expect(respondSwap(db, c, id, true)).rejects.toThrow(/no longer/);
  });
});
