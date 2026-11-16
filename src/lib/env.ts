/**
 * Central, validated server configuration.
 *
 * Every external integration is optional: when its credentials are missing the
 * app falls back to a clearly labelled local/demo adapter, and the staff
 * "Integrations" page reports which mode each service is in. Nothing here is
 * ever sent to the browser except values explicitly passed to components.
 */
import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : v === "true" || v === "1"));

const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SITE_URL: z.string().url().default("http://localhost:3000"),

  // Database: Supabase Postgres in production; embedded PGlite when unset.
  DATABASE_URL: z.string().optional(),
  PGLITE_DIR: z.string().default(".data/pglite"),

  // 32-byte key, base64. Encrypts screening payloads, TOTP secrets and other sensitive fields.
  APP_ENCRYPTION_KEY: z.string().optional(),

  // Clinic contact (verify before production — see docs/CREDENTIALS.md)
  CLINIC_WHATSAPP_NUMBER: z.string().default("60126081411"),
  CAREERS_EMAIL: z.string().email().optional(),
  SCREENING_NOTIFY_EMAILS: csv,
  ADMIN_NOTIFY_EMAILS: csv,
  EMAIL_FROM: z.string().default("Klinik Nissa <no-reply@localhost>"),

  // Email transport (SMTP, e.g. Google Workspace / Gmail app password)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // Google Drive / Sheets — service account (Shared Drive) OR OAuth refresh token
  GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_DRIVE_SCREENING_FOLDER_ID: z.string().optional(),
  GOOGLE_SHEETS_SCREENING_ID: z.string().optional(),
  GOOGLE_SHEETS_SCREENING_TAB: z.string().default("Saringan"),
  GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID: z.string().optional(),
  // Optional JSON map of document category -> Drive folder id
  GOOGLE_DRIVE_DOCUMENT_FOLDERS_JSON: z.string().optional(),

  // Object storage (Supabase Storage). Local filesystem when unset.
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("klinik-private"),
  LOCAL_STORAGE_DIR: z.string().default(".data/uploads"),

  // Ops
  CRON_SECRET: z.string().optional(),
  MFA_REQUIRED: bool,
  SHOW_PREVIEW_BANNER: bool,
  DEMO_PREVIEW_UNVERIFIED_PANELS: bool,
  BOOK_PURCHASE_URL: z
    .string()
    .url()
    .default("https://www.bookcafe.my/collections/terbaru/products/dr-saya-boleh-sembuh-ke-"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";

/** MFA is enforced by default in production; can be forced on in development. */
export const mfaRequired = () => env().MFA_REQUIRED ?? isProduction();

/** Banner reminding viewers that content is unverified preview data. */
export const showPreviewBanner = () => env().SHOW_PREVIEW_BANNER ?? !isProduction();

export type IntegrationMode = "live" | "demo";

export function integrationModes() {
  const e = env();
  const google =
    !!e.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 ||
    (!!e.GOOGLE_OAUTH_CLIENT_ID && !!e.GOOGLE_OAUTH_CLIENT_SECRET && !!e.GOOGLE_OAUTH_REFRESH_TOKEN);
  return {
    database: (e.DATABASE_URL ? "live" : "demo") as IntegrationMode,
    email: (e.SMTP_HOST && e.SMTP_USER && e.SMTP_PASS ? "live" : "demo") as IntegrationMode,
    drive: (google && e.GOOGLE_DRIVE_SCREENING_FOLDER_ID ? "live" : "demo") as IntegrationMode,
    sheets: (google && e.GOOGLE_SHEETS_SCREENING_ID ? "live" : "demo") as IntegrationMode,
    documentsDrive: (google && e.GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID ? "live" : "demo") as IntegrationMode,
    storage: (e.SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY ? "live" : "demo") as IntegrationMode,
    encryptionKey: (e.APP_ENCRYPTION_KEY ? "live" : "demo") as IntegrationMode,
  };
}
