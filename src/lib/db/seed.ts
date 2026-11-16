/**
 * Seeding.
 *  - seedReference(): leave types, default shifts, settings. Safe for production.
 *  - seedContent():   initial CMS content (only when the CMS is empty). Safe for production.
 *  - seedDemo():      DEMO staff accounts and sample operational data with
 *                     obviously fictional names. Refuses to run in production.
 */
import { randomUUID } from "node:crypto";
import type { Db } from "./index";
import { hashPassword } from "../auth/password";
import { SEED } from "../content/seed";
import type { CollectionName } from "../content/types";
import { CONSENT_VERSION } from "../screening/instruments";
import { submitScreening } from "../screening/service";

export const DEMO_PASSWORD = "Demo-Tenang-2026!";

export async function seedReference(db: Db) {
  // Defaults mirror Employment Act 1955 minimums for < 2 years' service.
  // The CEO MUST review these against the clinic's approved HR policy.
  const types: [string, string, string, boolean, boolean, boolean, number, number][] = [
    ["annual", "Cuti tahunan", "Annual leave", true, false, true, 8, 1],
    ["medical", "Cuti sakit (MC)", "Medical leave", true, true, true, 14, 2],
    ["hospitalisation", "Cuti hospital", "Hospitalisation leave", true, true, true, 60, 3],
    ["emergency", "Cuti kecemasan", "Emergency leave", true, false, true, 0, 4],
    ["unpaid", "Cuti tanpa gaji", "Unpaid leave", false, false, false, 0, 5],
  ];
  for (const [code, ms, en, deducts, attach, paid, days, sort] of types) {
    await db.query(
      `insert into leave_types (code, name_ms, name_en, deducts_balance, requires_attachment, paid, default_days, sort)
       values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (code) do nothing`,
      [code, ms, en, deducts, attach, paid, days, sort],
    );
  }
  // Placeholder shift times — configure in Staff Portal → Roster → Shift settings.
  const shifts: [string, string, string, string, number, string, number][] = [
    ["A", "Shift A (pagi)", "08:00", "14:00", 1, "#00B7B1", 1],
    ["B", "Shift B (petang)", "14:00", "20:00", 1, "#173B63", 2],
    ["C", "Shift C (malam)", "20:00", "23:59", 1, "#7C8DB5", 3],
  ];
  for (const [code, label, st, et, min, color, sort] of shifts) {
    await db.query(
      `insert into shift_definitions (code, label, start_time, end_time, min_staff, color, sort)
       values ($1,$2,$3,$4,$5,$6,$7) on conflict (code) do nothing`,
      [code, label, st, et, min, color, sort],
    );
  }
  await db.query(`insert into app_settings (key, value) values ('hr.working_days', '[1,2,3,4,5,6]'::jsonb) on conflict do nothing`);
  await db.query(`insert into app_settings (key, value) values ('screening.retention_days', '2555'::jsonb) on conflict do nothing`);
}

export async function seedContent(db: Db) {
  const n = await db.one<{ n: number }>("select count(*)::int as n from content_items");
  if ((n?.n ?? 0) > 0) return false;
  for (const [collection, items] of Object.entries(SEED) as [CollectionName, (typeof SEED)[CollectionName]][]) {
    for (const item of items) {
      await db.query(
        "insert into content_items (collection, slug, status, sort, data) values ($1,$2,$3,$4,$5::jsonb) on conflict do nothing",
        [collection, item.slug, item.status, item.sort, JSON.stringify(item.data)],
      );
    }
  }
  return true;
}

export async function seedDemo(db: Db, opts: { force?: boolean } = {}) {
  if (process.env.NODE_ENV === "production" && !opts.force) throw new Error("Refusing to seed demo data in production");
  const existing = await db.one<{ n: number }>("select count(*)::int as n from staff_users");
  if ((existing?.n ?? 0) > 0) return false;

  const hash = await hashPassword(DEMO_PASSWORD);
  const users: [string, string, string, string][] = [
    ["ceo.demo", "ceo.demo@example.test", "DEMO Ketua Pegawai Eksekutif", "super_admin"],
    ["doktor.demo", "doktor.demo@example.test", "DEMO Doktor Residen", "resident_doctor"],
    ["pembantu.demo", "pembantu.demo@example.test", "DEMO Pembantu Klinik 1", "clinic_assistant"],
    ["pembantu2.demo", "pembantu2.demo@example.test", "DEMO Pembantu Klinik 2", "clinic_assistant"],
    ["saringan.demo", "saringan.demo@example.test", "DEMO Pentadbir Saringan", "screening_admin"],
  ];
  const ids: Record<string, string> = {};
  for (const [username, email, name, role] of users) {
    const row = await db.one<{ id: string }>(
      `insert into staff_users (username, email, full_name, role, password_hash, must_change_password)
       values ($1,$2,$3,$4,$5,false) returning id`,
      [username, email, name, role, hash],
    );
    ids[username] = row!.id;
  }

  // Sample roster for the current month
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const staff = ["pembantu.demo", "pembantu2.demo", "doktor.demo"];
  for (let d = 1; d <= days; d++) {
    const date = new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
    const rot = d % 3;
    await db.query("insert into roster_assignments (date, shift_code, user_id) values ($1,'A',$2),($1,'B',$3)", [
      date, ids[staff[rot]], ids[staff[(rot + 1) % 3]],
    ]);
    if (d % 4 !== 0) await db.query("insert into roster_assignments (date, shift_code, user_id) values ($1,'C',$2)", [date, ids[staff[(rot + 2) % 3]]]);
  }

  const inFive = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  const inSix = new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10);
  await db.query(
    "insert into leave_requests (user_id, leave_type, start_date, end_date, days, reason, status) values ($1,'annual',$2,$3,2,'DEMO: urusan keluarga','pending')",
    [ids["pembantu.demo"], inFive, inSix],
  );
  await db.query(
    `insert into incidents (reference, category, occurred_at, description, severity, reporter_id, status)
     values ('INC-DEMO-0001','equipment', now() - interval '2 days', 'DEMO: Mesin tekanan darah di bilik 1 memberi bacaan tidak konsisten.', 'medium', $1, 'open')`,
    [ids["pembantu.demo"]],
  );
  const links: [string, string, string, string, string[]][] = [
    ["opening_closing", "DEMO — SOP buka & tutup klinik", "https://example.com/demo-sop", "Contoh pautan. Gantikan dengan dokumen SOP sebenar.", []],
    ["emergency", "Kecemasan — 999", "tel:999", "Polis / Ambulans / Bomba", []],
    ["emergency", "Talian HEAL 15555", "tel:15555", "Talian sokongan kesihatan mental KKM", []],
    ["hr", "DEMO — Polisi HR (terhad)", "https://example.com/demo-hr", "Hanya CEO & doktor", ["resident_doctor"]],
  ];
  for (const [cat, title, url, desc, roles] of links) {
    await db.query("insert into staff_links (category, title, url, description, allowed_roles) values ($1,$2,$3,$4,$5::jsonb)", [cat, title, url, desc, JSON.stringify(roles)]);
  }

  // Fictional screening submissions so the admin dashboard can be explored.
  const samples = [
    { phq9: [1, 1, 0, 1, 0, 0, 1, 0, 0], gad7: [1, 1, 1, 0, 0, 1, 0], contact: null },
    { phq9: [2, 2, 2, 2, 1, 2, 1, 1, 0], gad7: [2, 2, 2, 1, 1, 2, 2], contact: { name: "DEMO Pesakit Satu", phone: "0100000001", email: "demo1@example.test", age: 29, preferred: "whatsapp" as const, consentToContact: true as const } },
    { phq9: [2, 3, 2, 2, 2, 2, 2, 1, 1], gad7: [3, 2, 2, 2, 1, 2, 2], contact: { name: "DEMO Pesakit Dua", phone: "0100000002", email: "", age: 41, preferred: "call" as const, consentToContact: true as const } },
  ];
  for (const sm of samples) {
    await submitScreening(db, {
      idempotencyKey: randomUUID(), lang: "ms", consent: true, adultConfirmed: true, consentVersion: CONSENT_VERSION,
      instruments: ["phq9", "gad7"], answers: { phq9: sm.phq9, gad7: sm.gad7 }, contact: sm.contact,
    });
  }
  return true;
}

/** Used by the embedded dev database on first start. */
export async function seedIfEmpty(db: Db) {
  await seedReference(db);
  await seedContent(db);
  if (process.env.NODE_ENV !== "production") await seedDemo(db);
}
