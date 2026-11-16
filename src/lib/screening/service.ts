/**
 * Public screening submission pipeline.
 *
 *  1. Validate input on the server (zod) incl. consent + consent version.
 *  2. Re-calculate scores server-side (client values are only cross-checked).
 *  3. Encrypt answers + optional contact details (AES-256-GCM) and store.
 *  4. Record timestamp, consent version and an audit/event trail.
 *  5–7. Enqueue Drive sync, Sheet row and minimal email notification jobs
 *       (idempotent, retried, reconciled).
 *  8. Return the interpretation to the patient.
 */
import { z } from "zod";
import type { Db } from "../db";
import { audit } from "../audit";
import { decryptJson, encryptJson, referenceCode } from "../crypto";
import { env } from "../env";
import { enqueue, type JobHandler } from "../integrations/jobs";
import { driveUpload, sheetAppendUnique, SHEET_HEADER } from "../integrations/google";
import { sendEmail } from "../integrations/email";
import { CONSENT_VERSION, INSTRUMENT_VERSION } from "./instruments";
import { scoreScreening, SEVERITY_LABEL, type ScreeningResult } from "./scoring";

const answer = z.number().int().min(0).max(3);

export const submissionSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    lang: z.enum(["ms", "en"]),
    consent: z.literal(true),
    adultConfirmed: z.literal(true),
    consentVersion: z.literal(CONSENT_VERSION),
    instruments: z.array(z.enum(["phq9", "gad7"])).min(1).max(2),
    answers: z.object({
      phq9: z.array(answer).length(9).optional(),
      gad7: z.array(answer).length(7).optional(),
      phq9Difficulty: answer.nullable().optional(),
      gad7Difficulty: answer.nullable().optional(),
    }),
    contact: z
      .object({
        name: z.string().trim().min(2).max(120),
        phone: z.string().trim().regex(/^\+?[0-9][0-9 \-]{7,15}$/),
        email: z.union([z.string().trim().email().max(200), z.literal("")]).optional(),
        age: z.number().int().min(18).max(120),
        preferred: z.enum(["whatsapp", "call", "email"]),
        consentToContact: z.literal(true),
      })
      .nullable()
      .optional(),
    clientScores: z.object({ phq9: z.number().optional(), gad7: z.number().optional() }).optional(),
    /** Honeypot — must be empty. */
    website: z.string().max(0).optional(),
  })
  .superRefine((v, ctx) => {
    for (const id of ["phq9", "gad7"] as const) {
      const selected = v.instruments.includes(id);
      if (selected && !v.answers[id]) ctx.addIssue({ code: "custom", message: `${id} answers missing`, path: ["answers", id] });
      if (!selected && v.answers[id]) ctx.addIssue({ code: "custom", message: `${id} not selected`, path: ["answers", id] });
    }
    if (v.contact?.preferred === "email" && !v.contact.email) {
      ctx.addIssue({ code: "custom", message: "Email required for email contact", path: ["contact", "email"] });
    }
  });

export type SubmissionInput = z.infer<typeof submissionSchema>;

export interface StoredPayload {
  instrumentVersion: string;
  answers: SubmissionInput["answers"];
  contact: NonNullable<SubmissionInput["contact"]> | null;
}

export interface SubmissionOutcome {
  id: string;
  reference: string;
  result: ScreeningResult;
  duplicate: boolean;
}

export const DEFAULT_RETENTION_DAYS = 7 * 365;

async function retentionDays(db: Db): Promise<number> {
  const row = await db.one<{ value: number }>("select value from app_settings where key = 'screening.retention_days'");
  const n = Number(row?.value);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_RETENTION_DAYS;
}

export async function submitScreening(db: Db, input: SubmissionInput, meta: { ip?: string | null } = {}): Promise<SubmissionOutcome> {
  const result = scoreScreening({ phq9: input.answers.phq9, gad7: input.answers.gad7 });

  const existing = await db.one<{ id: string; reference: string }>(
    "select id, reference from screening_submissions where idempotency_key = $1",
    [input.idempotencyKey],
  );
  if (existing) return { id: existing.id, reference: existing.reference, result, duplicate: true };

  const mismatch =
    (input.clientScores?.phq9 !== undefined && input.clientScores.phq9 !== result.phq9?.score) ||
    (input.clientScores?.gad7 !== undefined && input.clientScores.gad7 !== result.gad7?.score);

  const reference = referenceCode("KN");
  const payload: StoredPayload = {
    instrumentVersion: INSTRUMENT_VERSION,
    answers: input.answers,
    contact: input.contact ?? null,
  };
  const days = await retentionDays(db);
  const retentionUntil = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

  const id = await db.tx(async (t) => {
    const row = await t.one<{ id: string }>(
      `insert into screening_submissions
        (reference, idempotency_key, lang, consent_version, consent_at, instruments,
         phq9_score, phq9_severity, gad7_score, gad7_severity, item9_value, item9_positive,
         priority, contact_requested, payload_enc, retention_until)
       values ($1,$2,$3,$4,now(),$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       on conflict (idempotency_key) do nothing
       returning id`,
      [
        reference,
        input.idempotencyKey,
        input.lang,
        input.consentVersion,
        input.instruments.join(","),
        result.phq9?.score ?? null,
        result.phq9?.severity ?? null,
        result.gad7?.score ?? null,
        result.gad7?.severity ?? null,
        result.item9Value,
        result.item9Positive,
        result.priority,
        !!input.contact,
        encryptJson(payload, `screening:${reference}`),
        retentionUntil,
      ],
    );
    if (!row) return null; // concurrent duplicate
    await t.query("insert into screening_events (submission_id, event_type, details) values ($1, 'submitted', $2::jsonb)", [
      row.id,
      JSON.stringify({ priority: result.priority, consentVersion: input.consentVersion, scoreMismatch: mismatch }),
    ]);
    if (result.item9Positive) {
      await t.query("insert into screening_events (submission_id, event_type, details) values ($1, 'safety_flag', '{}'::jsonb)", [row.id]);
    }
    for (const kind of ["screening.drive", "screening.sheet", "screening.notify"] as const) {
      await enqueue(t, kind, `${kind}:${row.id}`, { submissionId: row.id });
    }
    await audit(t, null, "screening.submitted", { type: "screening", id: row.id }, { reference, priority: result.priority }, null);
    return row.id;
  });

  if (!id) {
    const again = await db.one<{ id: string; reference: string }>(
      "select id, reference from screening_submissions where idempotency_key = $1",
      [input.idempotencyKey],
    );
    return { id: again!.id, reference: again!.reference, result, duplicate: true };
  }
  void meta;
  return { id, reference, result, duplicate: false };
}

// ───────────── integration handlers ─────────────

interface SubmissionRow {
  id: string;
  reference: string;
  submitted_at: Date;
  lang: string;
  instruments: string;
  phq9_score: number | null;
  phq9_severity: string | null;
  gad7_score: number | null;
  gad7_severity: string | null;
  item9_positive: boolean;
  priority: string;
  contact_requested: boolean;
  follow_up_status: string;
  payload_enc: string;
  deleted_at: Date | null;
}

async function loadSubmission(db: Db, id: string): Promise<SubmissionRow> {
  const row = await db.one<SubmissionRow>("select * from screening_submissions where id = $1", [id]);
  if (!row) throw new Error("Submission not found");
  if (row.deleted_at) throw new Error("Submission deleted under retention policy");
  return row;
}

export const myt = (d: Date | string) =>
  new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour12: false });

const sev = (s: string | null) => (s ? SEVERITY_LABEL[s as keyof typeof SEVERITY_LABEL]?.en ?? s : "—");

export function driveSummaryText(row: SubmissionRow, payload: StoredPayload): string {
  const lines = [
    "KLINIK NISSA — MENTAL HEALTH SCREENING RECORD (CONFIDENTIAL)",
    "Screening result — not a diagnosis.",
    "",
    `Reference:        ${row.reference}`,
    `Submitted (MYT):  ${myt(row.submitted_at)}`,
    `Language:         ${row.lang}`,
    `Instrument ver.:  ${payload.instrumentVersion}`,
    `Priority:         ${row.priority.toUpperCase()}${row.item9_positive ? "  (PHQ-9 item 9 positive)" : ""}`,
    "",
    row.phq9_score !== null ? `PHQ-9: ${row.phq9_score}/27 — ${sev(row.phq9_severity)}` : "PHQ-9: not completed",
    payload.answers.phq9 ? `  Item responses: ${payload.answers.phq9.join(", ")}` : "",
    row.gad7_score !== null ? `GAD-7: ${row.gad7_score}/21 — ${sev(row.gad7_severity)}` : "GAD-7: not completed",
    payload.answers.gad7 ? `  Item responses: ${payload.answers.gad7.join(", ")}` : "",
    "",
    payload.contact
      ? `Follow-up requested: ${payload.contact.name} · ${payload.contact.phone}${payload.contact.email ? ` · ${payload.contact.email}` : ""} · age ${payload.contact.age} · prefers ${payload.contact.preferred}`
      : "Follow-up requested: no (anonymous)",
  ];
  return lines.filter((l) => l !== "").join("\n") + "\n";
}

export const screeningHandlers: Record<"screening.drive" | "screening.sheet" | "screening.notify", JobHandler> = {
  "screening.drive": async (db, job) => {
    const row = await loadSubmission(db, String(job.payload.submissionId));
    const payload = decryptJson<StoredPayload>(row.payload_enc, `screening:${row.reference}`);
    const date = new Date(row.submitted_at).toISOString().slice(0, 10);
    const res = await driveUpload({
      folderId: env().GOOGLE_DRIVE_SCREENING_FOLDER_ID,
      name: `${date}_${row.reference}${row.item9_positive ? "_URGENT" : ""}.txt`,
      mime: "text/plain",
      content: Buffer.from(driveSummaryText(row, payload), "utf8"),
      dedupeKey: `screening-${row.id}`,
    });
    await db.query("insert into screening_events (submission_id, event_type, details) values ($1, 'drive_synced', $2::jsonb)", [
      row.id,
      JSON.stringify({ mode: res.mode, reused: res.reused }),
    ]);
    return { driveFileId: res.id, mode: res.mode };
  },

  // Administrative sheet: no names or contact details — those stay in the encrypted database.
  "screening.sheet": async (db, job) => {
    const row = await loadSubmission(db, String(job.payload.submissionId));
    const res = await sheetAppendUnique(
      [
        row.reference,
        myt(row.submitted_at),
        row.instruments,
        row.phq9_score,
        sev(row.phq9_severity),
        row.gad7_score,
        sev(row.gad7_severity),
        row.item9_positive ? "YES — URGENT REVIEW" : "No",
        row.priority,
        row.follow_up_status,
        row.contact_requested ? "Yes" : "No",
      ],
      row.reference,
    );
    return { ...res, header: SHEET_HEADER.length };
  },

  // Minimal-content notification: no scores, names or answers.
  "screening.notify": async (db, job) => {
    const row = await loadSubmission(db, String(job.payload.submissionId));
    const e = env();
    const to = e.SCREENING_NOTIFY_EMAILS.length ? e.SCREENING_NOTIFY_EMAILS : e.ADMIN_NOTIFY_EMAILS;
    if (to.length === 0) return { skipped: "no SCREENING_NOTIFY_EMAILS configured" };
    const urgent = row.priority === "urgent";
    const res = await sendEmail(db, {
      to,
      subject: `${urgent ? "[URGENT REVIEW] " : ""}Saringan baharu / New screening ${row.reference}`,
      text: [
        "A new mental health screening submission is waiting in the staff portal.",
        "Satu saringan kesihatan mental baharu menunggu semakan dalam portal staf.",
        "",
        `Reference / Rujukan: ${row.reference}`,
        `Priority / Keutamaan: ${urgent ? "URGENT — safety item flagged, review as soon as possible" : row.priority}`,
        `Follow-up requested / Minta susulan: ${row.contact_requested ? "Yes / Ya" : "No / Tidak"}`,
        "",
        `Review securely / Semak secara selamat: ${e.SITE_URL}/staff/screening/${row.id}`,
        "",
        "This email intentionally contains no clinical or personal details.",
        "Note: the clinic does not provide 24/7 monitoring of website submissions.",
      ].join("\n"),
    });
    return { mode: res.mode };
  },
};

/** Re-enqueue any integration step missing for recent submissions (idempotent). */
export async function reconcileScreenings(db: Db, days = 30) {
  const rows = await db.query<{ id: string }>(
    "select id from screening_submissions where submitted_at > now() - ($1::int * interval '1 day') and deleted_at is null",
    [days],
  );
  for (const r of rows) {
    for (const kind of ["screening.drive", "screening.sheet", "screening.notify"] as const) {
      await enqueue(db, kind, `${kind}:${r.id}`, { submissionId: r.id });
    }
  }
  const missing = await db.query<{ n: number }>(
    `select count(*)::int as n from screening_submissions s
      where s.deleted_at is null and s.submitted_at > now() - ($1::int * interval '1 day')
        and not exists (select 1 from integration_jobs j where j.dedupe_key = 'screening.drive:' || s.id and j.status = 'succeeded')`,
    [days],
  );
  return { checked: rows.length, notYetSynced: missing[0]?.n ?? 0 };
}

/** Retention: wipe encrypted payloads and notes past their retention date. */
export async function purgeExpiredScreenings(db: Db) {
  const rows = await db.query<{ id: string }>(
    `update screening_submissions set payload_enc = '', notes_enc = null, deleted_at = now()
      where retention_until < current_date and deleted_at is null returning id`,
  );
  for (const r of rows) {
    await db.query("insert into screening_events (submission_id, event_type) values ($1, 'retention_purged')", [r.id]);
  }
  return rows.length;
}
