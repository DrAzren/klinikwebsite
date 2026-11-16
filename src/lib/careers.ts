/**
 * Careers applications: validated, stored encrypted (6-month retention) and
 * forwarded to CAREERS_EMAIL via the job queue (with the CV attached).
 */
import { z } from "zod";
import type { Db } from "./db";
import { audit } from "./audit";
import { decryptJson, encryptJson } from "./crypto";
import { env } from "./env";
import { sendEmail } from "./integrations/email";
import { enqueue, type JobHandler } from "./integrations/jobs";
import { getObject } from "./integrations/storage";

export const CAREERS_CONSENT_VERSION = "careers-consent/2026-11/v1";

export const applicationSchema = z.object({
  position: z.string().trim().min(1).max(80),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 \-]{7,15}$/),
  message: z.string().trim().max(3000).optional().default(""),
  consent: z.literal("on"),
  website: z.string().max(0).optional(),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

export async function saveApplication(db: Db, input: ApplicationInput, cvFileId: string | null) {
  const retention = new Date(Date.now() + 183 * 86_400_000).toISOString().slice(0, 10);
  const row = await db.one<{ id: string }>(
    `insert into job_applications (position_slug, payload_enc, cv_file_id, consent_version, retention_until)
     values ($1, '', $2, $3, $4) returning id`,
    [input.position, cvFileId, CAREERS_CONSENT_VERSION, retention],
  );
  const id = row!.id;
  const payload = { name: input.name, email: input.email, phone: input.phone, message: input.message };
  await db.query("update job_applications set payload_enc = $2 where id = $1", [id, encryptJson(payload, `application:${id}`)]);
  await enqueue(db, "careers.forward", `careers.forward:${id}`, { applicationId: id });
  await audit(db, null, "careers.application_received", { type: "job_application", id }, { position: input.position });
  return id;
}

export const careersForwardHandler: JobHandler = async (db, job) => {
  const to = env().CAREERS_EMAIL;
  if (!to) throw new Error("CAREERS_EMAIL is not configured — application kept in the database; will retry");
  const app = await db.one<{ id: string; position_slug: string; payload_enc: string; cv_file_id: string | null; created_at: Date }>(
    "select id, position_slug, payload_enc, cv_file_id, created_at from job_applications where id = $1",
    [String(job.payload.applicationId)],
  );
  if (!app) throw new Error("Application not found");
  const p = decryptJson<{ name: string; email: string; phone: string; message: string }>(app.payload_enc, `application:${app.id}`);
  const attachments = [];
  if (app.cv_file_id) {
    const f = await db.one<{ storage_key: string; original_name: string; mime: string }>("select storage_key, original_name, mime from files where id = $1", [app.cv_file_id]);
    if (f) attachments.push({ filename: f.original_name, content: await getObject(f.storage_key), contentType: f.mime });
  }
  const res = await sendEmail(db, {
    to: [to],
    replyTo: p.email,
    subject: `Permohonan kerja / Job application — ${app.position_slug} — ${p.name}`,
    text: [
      `Position: ${app.position_slug}`,
      `Name: ${p.name}`,
      `Email: ${p.email}`,
      `Phone: ${p.phone}`,
      "",
      p.message || "(no message)",
      "",
      `Received: ${new Date(app.created_at).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur" })} (MYT)`,
      `Consent: ${CAREERS_CONSENT_VERSION}. Retain for no more than 6 months unless hired.`,
    ].join("\n"),
    attachments,
  });
  return { mode: res.mode };
};

export async function purgeExpiredApplications(db: Db) {
  const rows = await db.query<{ id: string }>("delete from job_applications where retention_until < current_date returning id");
  return rows.length;
}
