import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import { CONSENT_VERSION } from "@/lib/screening/instruments";
import {
  purgeExpiredScreenings,
  reconcileScreenings,
  screeningHandlers,
  submissionSchema,
  submitScreening,
  type SubmissionInput,
} from "@/lib/screening/service";
import { backoffMs, processDueJobs } from "@/lib/integrations/jobs";
import { freshDb } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await freshDb();
});

const base = (over: Partial<SubmissionInput> = {}): SubmissionInput =>
  submissionSchema.parse({
    idempotencyKey: randomUUID(),
    lang: "ms",
    consent: true,
    adultConfirmed: true,
    consentVersion: CONSENT_VERSION,
    instruments: ["phq9", "gad7"],
    answers: { phq9: [1, 1, 1, 1, 1, 1, 1, 1, 0], gad7: [2, 2, 2, 2, 2, 2, 2] },
    ...over,
  });

describe("submission validation", () => {
  it("requires consent, adult confirmation and the current consent version", () => {
    const good = { idempotencyKey: randomUUID(), lang: "en", consent: true, adultConfirmed: true, consentVersion: CONSENT_VERSION, instruments: ["gad7"], answers: { gad7: [0, 0, 0, 0, 0, 0, 0] } };
    expect(submissionSchema.safeParse(good).success).toBe(true);
    expect(submissionSchema.safeParse({ ...good, consent: false }).success).toBe(false);
    expect(submissionSchema.safeParse({ ...good, adultConfirmed: false }).success).toBe(false);
    expect(submissionSchema.safeParse({ ...good, consentVersion: "old" }).success).toBe(false);
  });
  it("rejects incomplete or mismatched answers", () => {
    const good = { idempotencyKey: randomUUID(), lang: "en", consent: true, adultConfirmed: true, consentVersion: CONSENT_VERSION, instruments: ["phq9"], answers: { phq9: [0, 0, 0, 0, 0, 0, 0, 0, 0] } };
    expect(submissionSchema.safeParse({ ...good, answers: { phq9: [0, 0, 0] } }).success).toBe(false);
    expect(submissionSchema.safeParse({ ...good, answers: { phq9: [0, 0, 0, 0, 0, 0, 0, 0, 4] } }).success).toBe(false);
    expect(submissionSchema.safeParse({ ...good, answers: {} }).success).toBe(false);
    expect(submissionSchema.safeParse({ ...good, answers: { ...good.answers, gad7: [0, 0, 0, 0, 0, 0, 0] } }).success).toBe(false);
  });
  it("rejects bots filling the honeypot and under-18 contacts", () => {
    const good = { idempotencyKey: randomUUID(), lang: "en", consent: true, adultConfirmed: true, consentVersion: CONSENT_VERSION, instruments: ["gad7"], answers: { gad7: [0, 0, 0, 0, 0, 0, 0] } };
    expect(submissionSchema.safeParse({ ...good, website: "spam" }).success).toBe(false);
    expect(
      submissionSchema.safeParse({ ...good, contact: { name: "Ali", phone: "0123456789", age: 16, preferred: "call", consentToContact: true } }).success,
    ).toBe(false);
  });
});

describe("submitScreening", () => {
  it("scores server-side, stores encrypted payload, and enqueues integrations", async () => {
    const input = base({
      contact: { name: "Pesakit Ujian", phone: "0123456789", email: "test@example.test", age: 30, preferred: "whatsapp", consentToContact: true },
    });
    const out = await submitScreening(db, input);
    expect(out.duplicate).toBe(false);
    expect(out.result.phq9?.score).toBe(8);
    expect(out.result.gad7?.score).toBe(14);
    expect(out.result.priority).toBe("review");

    const row = await db.one<{ payload_enc: string; phq9_score: number; consent_version: string; contact_requested: boolean }>(
      "select payload_enc, phq9_score, consent_version, contact_requested from screening_submissions where id = $1",
      [out.id],
    );
    expect(row!.phq9_score).toBe(8);
    expect(row!.consent_version).toBe(CONSENT_VERSION);
    expect(row!.contact_requested).toBe(true);
    expect(row!.payload_enc).not.toContain("Pesakit");
    expect(row!.payload_enc).not.toContain("0123456789");

    const jobs = await db.query<{ kind: string }>("select kind from integration_jobs where payload->>'submissionId' = $1 order by kind", [out.id]);
    expect(jobs.map((j) => j.kind)).toEqual(["screening.drive", "screening.notify", "screening.sheet"]);
  });

  it("is idempotent: double submission returns the same reference and creates nothing new", async () => {
    const input = base();
    const a = await submitScreening(db, input);
    const b = await submitScreening(db, input);
    expect(b.duplicate).toBe(true);
    expect(b.reference).toBe(a.reference);
    const n = await db.one<{ n: number }>("select count(*)::int as n from screening_submissions where idempotency_key = $1", [input.idempotencyKey]);
    expect(n!.n).toBe(1);
  });

  it("flags PHQ-9 item 9 for urgent clinical review", async () => {
    const out = await submitScreening(db, base({ instruments: ["phq9"], answers: { phq9: [0, 0, 0, 0, 0, 0, 0, 0, 1] } }));
    expect(out.result.priority).toBe("urgent");
    const row = await db.one<{ item9_positive: boolean; priority: string }>("select item9_positive, priority from screening_submissions where id = $1", [out.id]);
    expect(row).toEqual({ item9_positive: true, priority: "urgent" });
    const ev = await db.one("select 1 from screening_events where submission_id = $1 and event_type = 'safety_flag'", [out.id]);
    expect(ev).not.toBeNull();
  });

  it("ignores tampered client scores and records the mismatch", async () => {
    const out = await submitScreening(db, base({ clientScores: { phq9: 0, gad7: 0 } }));
    expect(out.result.phq9?.score).toBe(8);
    const ev = await db.one<{ details: { scoreMismatch: boolean } }>("select details from screening_events where submission_id = $1 and event_type = 'submitted'", [out.id]);
    expect(ev!.details.scoreMismatch).toBe(true);
  });
});

describe("integration jobs", () => {
  it("processes Drive/Sheet/notify jobs via demo adapters, with minimal email content", async () => {
    process.env.SCREENING_NOTIFY_EMAILS = "clinic@example.test";
    const { env } = await import("@/lib/env");
    // env() is cached; patch the cached object for this test
    (env() as { SCREENING_NOTIFY_EMAILS: string[] }).SCREENING_NOTIFY_EMAILS = ["clinic@example.test"];

    const out = await submitScreening(db, base({
      contact: { name: "Nama Rahsia", phone: "0198765432", age: 40, preferred: "call", consentToContact: true },
      answers: { phq9: [0, 0, 0, 0, 0, 0, 0, 0, 2], gad7: [0, 0, 0, 0, 0, 0, 0] },
    }));
    const summary = await processDueJobs(db, screeningHandlers, { limit: 100 });
    expect(summary.failed + summary.dead).toBe(0);

    const statuses = await db.query<{ status: string }>("select status from integration_jobs where payload->>'submissionId' = $1", [out.id]);
    expect(statuses.every((s) => s.status === "succeeded")).toBe(true);

    const mail = await db.one<{ subject: string; body_text: string }>("select subject, body_text from email_outbox where subject like $1", [`%${out.reference}%`]);
    expect(mail!.subject).toMatch(/URGENT/);
    expect(mail!.body_text).not.toMatch(/Nama Rahsia|0198765432|PHQ-9:|score/i);
  });

  it("retries failures with backoff and marks dead after max attempts", async () => {
    await db.query("insert into integration_jobs (kind, dedupe_key, payload, max_attempts) values ('screening.drive', 'test:fail', '{}'::jsonb, 2)");
    const failing = { "screening.drive": async () => { throw new Error("boom"); } };
    const s1 = await processDueJobs(db, failing, { limit: 100, kinds: ["screening.drive"] });
    expect(s1.failed).toBeGreaterThanOrEqual(1);
    const j1 = await db.one<{ status: string; last_error: string }>("select status, last_error from integration_jobs where dedupe_key = 'test:fail'");
    expect(j1).toEqual({ status: "failed", last_error: "boom" });
    await db.query("update integration_jobs set next_run_at = now() where dedupe_key = 'test:fail'");
    await processDueJobs(db, failing, { limit: 100, kinds: ["screening.drive"] });
    const j2 = await db.one<{ status: string }>("select status from integration_jobs where dedupe_key = 'test:fail'");
    expect(j2!.status).toBe("dead");
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(20)).toBe(6 * 60 * 60 * 1000);
  });

  it("reconciliation re-enqueues missing jobs without duplicating", async () => {
    const out = await submitScreening(db, base());
    await db.query("delete from integration_jobs where payload->>'submissionId' = $1 and kind = 'screening.sheet'", [out.id]);
    await reconcileScreenings(db);
    await reconcileScreenings(db);
    const n = await db.one<{ n: number }>("select count(*)::int as n from integration_jobs where dedupe_key = $1", [`screening.sheet:${out.id}`]);
    expect(n!.n).toBe(1);
  });

  it("retention purge removes encrypted payloads past retention date", async () => {
    const out = await submitScreening(db, base());
    await db.query("update screening_submissions set retention_until = current_date - 1 where id = $1", [out.id]);
    expect(await purgeExpiredScreenings(db)).toBeGreaterThanOrEqual(1);
    const row = await db.one<{ payload_enc: string; deleted_at: Date | null }>("select payload_enc, deleted_at from screening_submissions where id = $1", [out.id]);
    expect(row!.payload_enc).toBe("");
    expect(row!.deleted_at).not.toBeNull();
  });
});
