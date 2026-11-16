/**
 * Authorised screening administration: search/filter, secure record view
 * (decrypt + audit), follow-up workflow, assignment, export and the
 * consent-gated patient follow-up email / access-controlled report link.
 */
import type { Db } from "../db";
import { audit } from "../audit";
import { assertCan, can } from "../auth/rbac";
import type { SessionInfo } from "../auth/service";
import { decryptJson, encryptJson, randomToken, safeEqual, sha256Hex } from "../crypto";
import { env } from "../env";
import { sendEmail } from "../integrations/email";
import { sheetUpdateStatus } from "../integrations/google";
import type { StoredPayload } from "./service";
import { myt } from "./service";
import { SEVERITY_LABEL } from "./scoring";

export const FOLLOW_UP_STATUSES = ["new", "in_review", "contacted", "appointment_booked", "no_response", "closed"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const FOLLOW_UP_LABEL: Record<FollowUpStatus, { ms: string; en: string }> = {
  new: { ms: "Baharu", en: "New" },
  in_review: { ms: "Dalam semakan", en: "In review" },
  contacted: { ms: "Telah dihubungi", en: "Contacted" },
  appointment_booked: { ms: "Temujanji dibuat", en: "Appointment booked" },
  no_response: { ms: "Tiada respons", en: "No response" },
  closed: { ms: "Ditutup", en: "Closed" },
};

export class ScreeningAdminError extends Error {}

export interface ScreeningFilters {
  q?: string;
  from?: string;
  to?: string;
  instrument?: "phq9" | "gad7" | "";
  severity?: string;
  priority?: string;
  status?: string;
  assigned?: string; // user id | "me" | "unassigned"
}

export interface ScreeningListRow {
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
  follow_up_status: FollowUpStatus;
  assigned_to: string | null;
  assignee: string | null;
  deleted_at: Date | null;
}

export async function listScreenings(db: Db, s: SessionInfo, f: ScreeningFilters = {}) {
  assertCan(s.user.role, "screening:read");
  const assigned = f.assigned === "me" ? s.user.id : f.assigned;
  const rows = await db.query<ScreeningListRow & { payload_enc: string }>(
    `select x.id, x.reference, x.submitted_at, x.lang, x.instruments, x.phq9_score, x.phq9_severity, x.gad7_score, x.gad7_severity,
            x.item9_positive, x.priority, x.contact_requested, x.follow_up_status, x.assigned_to, u.full_name as assignee, x.deleted_at, x.payload_enc
       from screening_submissions x left join staff_users u on u.id = x.assigned_to
      where ($1::date is null or x.submitted_at >= $1::date)
        and ($2::date is null or x.submitted_at < ($2::date + 1))
        and ($3::text is null or x.instruments like '%' || $3 || '%')
        and ($4::text is null or x.phq9_severity = $4 or x.gad7_severity = $4)
        and ($5::text is null or x.priority = $5)
        and ($6::text is null or x.follow_up_status = $6)
        and ($7::text is null or ($7 = 'unassigned' and x.assigned_to is null) or x.assigned_to::text = $7)
      order by case x.priority when 'urgent' then 0 when 'review' then 1 else 2 end,
               x.follow_up_status = 'closed', x.submitted_at desc
      limit 2000`,
    [f.from || null, f.to || null, f.instrument || null, f.severity || null, f.priority || null, f.status || null, assigned || null],
  );
  const q = f.q?.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) => {
        if (r.reference.toLowerCase().includes(q)) return true;
        if (!r.contact_requested || !r.payload_enc) return false;
        // Contact details are encrypted; search decrypts within the filtered set only.
        const p = decryptJson<StoredPayload>(r.payload_enc, `screening:${r.reference}`);
        return [p.contact?.name, p.contact?.phone, p.contact?.email].some((v) => v?.toLowerCase().includes(q));
      })
    : rows;
  if (q) await audit(db, { id: s.user.id, label: s.user.username }, "screening.searched", { type: "screening" }, { hasQuery: true });
  return filtered.slice(0, 500).map(({ payload_enc: _p, ...r }) => { void _p; return r; });
}

export async function getScreening(db: Db, s: SessionInfo, id: string) {
  assertCan(s.user.role, "screening:read");
  const row = await db.one<ScreeningListRow & { payload_enc: string; notes_enc: string | null; consent_version: string; consent_at: Date; item9_value: number | null; retention_until: string }>(
    `select x.*, to_char(x.retention_until,'YYYY-MM-DD') as retention_until, u.full_name as assignee
       from screening_submissions x left join staff_users u on u.id = x.assigned_to where x.id = $1`,
    [id],
  );
  if (!row) return null;
  const payload = row.payload_enc ? decryptJson<StoredPayload>(row.payload_enc, `screening:${row.reference}`) : null;
  const notes = row.notes_enc ? decryptJson<{ at: string; by: string; text: string }[]>(row.notes_enc, `notes:${row.id}`) : [];
  const events = await db.query<{ at: Date; actor: string | null; event_type: string; details: Record<string, unknown> }>(
    "select e.at, u.full_name as actor, e.event_type, e.details from screening_events e left join staff_users u on u.id = e.actor_id where e.submission_id = $1 order by e.at",
    [id],
  );
  await db.query("insert into screening_events (submission_id, actor_id, event_type) values ($1,$2,'viewed')", [id, s.user.id]);
  await audit(db, { id: s.user.id, label: s.user.username }, "screening.viewed", { type: "screening", id }, { reference: row.reference });
  const { payload_enc: _p, notes_enc: _n, ...rest } = row;
  void _p; void _n;
  return { ...rest, payload, notes, events };
}

export async function updateFollowUp(
  db: Db,
  s: SessionInfo,
  id: string,
  patch: { status?: FollowUpStatus; assignedTo?: string | null; note?: string },
) {
  assertCan(s.user.role, "screening:manage");
  if (patch.assignedTo !== undefined) assertCan(s.user.role, "screening:assign");
  if (patch.status && !FOLLOW_UP_STATUSES.includes(patch.status)) throw new ScreeningAdminError("Invalid status");
  if (patch.assignedTo) {
    const assignee = await db.one<{ role: string }>("select role from staff_users where id = $1 and is_active", [patch.assignedTo]);
    if (!assignee || !can(assignee.role as never, "screening:read")) throw new ScreeningAdminError("Assignee is not an authorised clinician");
  }
  const cur = await db.one<{ reference: string; notes_enc: string | null; follow_up_status: string }>(
    "select reference, notes_enc, follow_up_status from screening_submissions where id = $1",
    [id],
  );
  if (!cur) throw new ScreeningAdminError("Not found");
  let notesEnc = cur.notes_enc;
  if (patch.note?.trim()) {
    const notes = cur.notes_enc ? decryptJson<{ at: string; by: string; text: string }[]>(cur.notes_enc, `notes:${id}`) : [];
    notes.push({ at: new Date().toISOString(), by: s.user.full_name, text: patch.note.trim().slice(0, 4000) });
    notesEnc = encryptJson(notes, `notes:${id}`);
  }
  await db.query(
    `update screening_submissions set
        follow_up_status = coalesce($2, follow_up_status),
        assigned_to = case when $3::boolean then $4::uuid else assigned_to end,
        notes_enc = $5,
        reviewed_at = coalesce(reviewed_at, now())
      where id = $1`,
    [id, patch.status ?? null, patch.assignedTo !== undefined, patch.assignedTo ?? null, notesEnc],
  );
  await db.query("insert into screening_events (submission_id, actor_id, event_type, details) values ($1,$2,'follow_up_updated',$3::jsonb)", [
    id, s.user.id, JSON.stringify({ status: patch.status, assigned: patch.assignedTo !== undefined, note: !!patch.note?.trim() }),
  ]);
  await audit(db, { id: s.user.id, label: s.user.username }, "screening.follow_up_updated", { type: "screening", id }, { status: patch.status });
  if (patch.status && patch.status !== cur.follow_up_status) {
    await sheetUpdateStatus(cur.reference, patch.status).catch((e) => console.error("[sheets] status update failed", e));
  }
}

export async function exportScreeningsCsv(db: Db, s: SessionInfo, f: ScreeningFilters, includeIdentifiers: boolean) {
  assertCan(s.user.role, "screening:export");
  const rows = await listScreenings(db, s, f);
  const header = ["Reference", "Submitted (MYT)", "Instruments", "PHQ-9", "PHQ-9 severity", "GAD-7", "GAD-7 severity", "Item 9 flag", "Priority", "Status", "Assigned to"];
  if (includeIdentifiers) header.push("Name", "Phone", "Email", "Age", "Preferred contact");
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [header.map(esc).join(",")];
  for (const r of rows) {
    const line: unknown[] = [r.reference, myt(r.submitted_at), r.instruments, r.phq9_score, r.phq9_severity, r.gad7_score, r.gad7_severity, r.item9_positive ? "YES" : "No", r.priority, r.follow_up_status, r.assignee];
    if (includeIdentifiers) {
      const full = await db.one<{ payload_enc: string }>("select payload_enc from screening_submissions where id = $1", [r.id]);
      const p = full?.payload_enc ? decryptJson<StoredPayload>(full.payload_enc, `screening:${r.reference}`) : null;
      line.push(p?.contact?.name, p?.contact?.phone, p?.contact?.email, p?.contact?.age, p?.contact?.preferred);
    }
    lines.push(line.map(esc).join(","));
  }
  await audit(db, { id: s.user.id, label: s.user.username }, "screening.exported", { type: "screening" }, { rows: rows.length, includeIdentifiers });
  return lines.join("\n") + "\n";
}

// ───────────── patient follow-up ─────────────

export const REPORT_LINK_DAYS = 7;

/**
 * Email the patient a gentle follow-up (only if they requested follow-up,
 * gave an email and consented to contact). The email never contains scores.
 * Optionally includes an expiring report link that also requires the
 * reference code shown on their results screen (not included in the email).
 */
export async function sendPatientFollowUp(db: Db, s: SessionInfo, id: string, opts: { includeReportLink: boolean; message?: string }) {
  assertCan(s.user.role, "screening:contact_patient");
  const row = await db.one<{ reference: string; payload_enc: string; lang: "ms" | "en"; contact_requested: boolean }>(
    "select reference, payload_enc, lang, contact_requested from screening_submissions where id = $1 and deleted_at is null",
    [id],
  );
  if (!row) throw new ScreeningAdminError("Not found");
  const p = decryptJson<StoredPayload>(row.payload_enc, `screening:${row.reference}`);
  if (!row.contact_requested || !p.contact?.consentToContact || !p.contact.email) {
    throw new ScreeningAdminError("Patient did not request follow-up by email or gave no email address");
  }
  let link = "";
  if (opts.includeReportLink) {
    const token = randomToken(32);
    await db.query(
      "insert into report_links (submission_id, token_hash, expires_at, created_by) values ($1,$2,$3,$4)",
      [id, sha256Hex(token), new Date(Date.now() + REPORT_LINK_DAYS * 86_400_000).toISOString(), s.user.id],
    );
    const prefix = row.lang === "en" ? "/en" : "";
    link = `${env().SITE_URL}${prefix}/report/${token}`;
  }
  const ms = row.lang === "ms";
  const text = [
    ms ? `Salam sejahtera ${p.contact.name},` : `Dear ${p.contact.name},`,
    "",
    ms
      ? "Terima kasih kerana melengkapkan saringan kesihatan mental bersama Klinik Nissa. Pasukan klinikal kami ingin membuat susulan dengan anda."
      : "Thank you for completing a mental health screening with Klinik Nissa. Our clinical team would like to follow up with you.",
    opts.message?.trim() ? `\n${opts.message.trim().slice(0, 2000)}\n` : "",
    link
      ? ms
        ? `Anda boleh melihat ringkasan saringan anda secara selamat di pautan berikut (sah ${REPORT_LINK_DAYS} hari). Anda perlu memasukkan kod rujukan yang dipaparkan pada skrin keputusan anda:\n${link}`
        : `You can view your screening summary securely at the link below (valid for ${REPORT_LINK_DAYS} days). You will need the reference code shown on your results screen:\n${link}`
      : "",
    "",
    ms
      ? "Untuk temujanji, sila balas e-mel ini atau hubungi kami melalui WhatsApp. Jika anda dalam kecemasan, hubungi 999."
      : "To book an appointment, reply to this email or contact us on WhatsApp. If this is an emergency, call 999.",
    "",
    "Klinik Nissa",
  ].filter((l) => l !== undefined).join("\n");

  const res = await sendEmail(db, {
    to: [p.contact.email],
    subject: ms ? "Susulan saringan anda — Klinik Nissa" : "Your screening follow-up — Klinik Nissa",
    text,
  });
  await db.query("insert into screening_events (submission_id, actor_id, event_type, details) values ($1,$2,'patient_emailed',$3::jsonb)", [
    id, s.user.id, JSON.stringify({ reportLink: opts.includeReportLink, mode: res.mode }),
  ]);
  await audit(db, { id: s.user.id, label: s.user.username }, "screening.patient_emailed", { type: "screening", id }, { reportLink: opts.includeReportLink });
  return res;
}

export type ReportAccess =
  | { ok: true; reference: string; submittedAt: string; lang: "ms" | "en"; phq9: { score: number; severity: string } | null; gad7: { score: number; severity: string } | null }
  | { ok: false; reason: "invalid" | "expired" | "wrong_code" | "locked" };

/** Patient-side access to an emailed report link (token + reference code). */
export async function accessReport(db: Db, token: string, referenceInput: string): Promise<ReportAccess> {
  const link = await db.one<{ id: string; submission_id: string; expires_at: Date; max_views: number; views: number; failed_attempts: number; revoked_at: Date | null }>(
    "select id, submission_id, expires_at, max_views, views, failed_attempts, revoked_at from report_links where token_hash = $1",
    [sha256Hex(token)],
  );
  if (!link || link.revoked_at) return { ok: false, reason: "invalid" };
  if (new Date(link.expires_at).getTime() < Date.now() || link.views >= link.max_views) return { ok: false, reason: "expired" };
  if (link.failed_attempts >= 5) return { ok: false, reason: "locked" };
  const sub = await db.one<{ reference: string; submitted_at: Date; lang: "ms" | "en"; phq9_score: number | null; phq9_severity: string | null; gad7_score: number | null; gad7_severity: string | null; deleted_at: Date | null }>(
    "select reference, submitted_at, lang, phq9_score, phq9_severity, gad7_score, gad7_severity, deleted_at from screening_submissions where id = $1",
    [link.submission_id],
  );
  if (!sub || sub.deleted_at) return { ok: false, reason: "invalid" };
  const normalise = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!safeEqual(normalise(referenceInput), normalise(sub.reference))) {
    await db.query("update report_links set failed_attempts = failed_attempts + 1 where id = $1", [link.id]);
    return { ok: false, reason: link.failed_attempts + 1 >= 5 ? "locked" : "wrong_code" };
  }
  await db.query("update report_links set views = views + 1 where id = $1", [link.id]);
  await db.query("insert into screening_events (submission_id, event_type) values ($1, 'report_viewed_by_patient')", [link.submission_id]);
  return {
    ok: true,
    reference: sub.reference,
    submittedAt: myt(sub.submitted_at),
    lang: sub.lang,
    phq9: sub.phq9_score !== null ? { score: sub.phq9_score, severity: sub.phq9_severity! } : null,
    gad7: sub.gad7_score !== null ? { score: sub.gad7_score, severity: sub.gad7_severity! } : null,
  };
}

export async function clinicians(db: Db) {
  const rows = await db.query<{ id: string; full_name: string; role: string }>("select id, full_name, role from staff_users where is_active order by full_name");
  return rows.filter((r) => can(r.role as never, "screening:read"));
}

export const severityLabel = (s: string | null, lang: "ms" | "en") =>
  s ? SEVERITY_LABEL[s as keyof typeof SEVERITY_LABEL]?.[lang] ?? s : "—";
