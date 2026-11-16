/**
 * Server-side email. SMTP via nodemailer when configured (e.g. Google
 * Workspace / Gmail with an app password); otherwise a demo transport that
 * records the message in the email_outbox table (visible to the Super Admin
 * under Integrations) and logs a one-line notice.
 *
 * Keep clinical detail OUT of emails — notifications link to the portal.
 */
import type { Db } from "../db";
import { env } from "../env";

export interface EmailMessage {
  to: string[];
  subject: string;
  text: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}

export async function sendEmail(db: Db, msg: EmailMessage): Promise<{ mode: "live" | "demo"; messageId: string | null }> {
  const e = env();
  const to = msg.to.filter(Boolean);
  if (to.length === 0) throw new Error("No recipients configured");

  if (e.SMTP_HOST && e.SMTP_USER && e.SMTP_PASS) {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      secure: e.SMTP_PORT === 465,
      auth: { user: e.SMTP_USER, pass: e.SMTP_PASS },
      requireTLS: true,
    });
    const info = await transport.sendMail({
      from: e.EMAIL_FROM,
      to,
      subject: msg.subject,
      text: msg.text,
      replyTo: msg.replyTo,
      attachments: msg.attachments,
    });
    // Metadata only — message bodies are not duplicated into the database.
    await db.query(
      "insert into email_outbox (transport, to_addresses, subject, body_text, attachments, message_id) values ('smtp', $1, $2, $3, $4::jsonb, $5)",
      [to.join(", "), msg.subject, "[sent via SMTP — body not stored]", JSON.stringify((msg.attachments ?? []).map((a) => a.filename)), info.messageId ?? null],
    );
    return { mode: "live", messageId: info.messageId ?? null };
  }

  await db.query(
    "insert into email_outbox (transport, to_addresses, subject, body_text, attachments) values ('demo', $1, $2, $3, $4::jsonb)",
    [to.join(", "), msg.subject, msg.text, JSON.stringify((msg.attachments ?? []).map((a) => a.filename))],
  );
  console.info(`[email:demo] "${msg.subject}" → ${to.join(", ")} (stored in email_outbox)`);
  return { mode: "demo", messageId: null };
}
