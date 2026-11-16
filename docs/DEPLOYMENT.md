# Deployment

Target: **Vercel** (region `sin1`, Singapore) + **Supabase** (region `ap-southeast-1`). Any Node 22 host works (`npm run build && npm start`); see "Self-hosting" below.

## 1. Supabase

1. Create a project in `ap-southeast-1`. Enable **PITR / daily backups**.
2. *Project Settings → Database → Connection string → Transaction pooler* → copy the URI (port 6543). This is `DATABASE_URL`.
3. Apply migrations from your machine (or CI):
   ```bash
   DATABASE_URL="postgresql://…" npm run db:migrate
   ```
   (or `supabase db push` — the files in `supabase/migrations/` are standard SQL.)
4. Seed reference data and the initial CMS content (no demo users in production):
   ```bash
   DATABASE_URL="postgresql://…" NODE_ENV=production APP_ENCRYPTION_KEY="…" npm run db:seed
   ```
5. *Storage* → create a **private** bucket `klinik-private`. Copy the project URL and the `service_role` key (server-side only).

## 2. Google Drive & Sheets (optional but recommended)

1. Google Cloud project → enable **Google Drive API** and **Google Sheets API**.
2. Create a service account → create a JSON key → `base64 -w0 key.json` → `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`.
3. In the clinic's **Shared Drive**, add the service account email as *Content manager*. Create folders: `Saringan (sulit)`, `Invois & Resit`, etc. Copy folder IDs from the URL.
4. Create a Google Sheet for screening administration inside the Shared Drive, add a tab named `Saringan` with header row: `Reference | Submitted (MYT) | Instruments | PHQ-9 | PHQ-9 severity | GAD-7 | GAD-7 severity | Item 9 flag | Priority | Follow-up status | Contact requested`. Share only with authorised clinicians. Copy its ID.

Service accounts have no personal storage quota — folders **must** be in a Shared Drive (or use the OAuth refresh-token option).

## 3. Email

Use Google Workspace SMTP (`smtp.gmail.com:465`) with an **App Password** for a dedicated sender (e.g. `no-reply@` alias), or any SMTP provider. Configure SPF, DKIM and DMARC for the sending domain.

## 4. Vercel

1. Import the GitHub repository. Framework: Next.js. Node 22.
2. Set environment variables from `.env.example` for **Production** (and Preview with separate, non-production resources). Required in production: `SITE_URL`, `DATABASE_URL`, `APP_ENCRYPTION_KEY`, `CLINIC_WHATSAPP_NUMBER`, `CAREERS_EMAIL`, `SCREENING_NOTIFY_EMAILS`, `SMTP_*`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`. Google variables when ready.
3. Deploy. `vercel.json` schedules `/api/cron/jobs` every 10 minutes (needs a Pro plan for sub-daily crons; on Hobby use an external scheduler calling the endpoint with `Authorization: Bearer $CRON_SECRET`).
4. Add the custom domain; HSTS is sent automatically.

## 5. First Super Admin

```bash
DATABASE_URL="postgresql://…" NODE_ENV=production APP_ENCRYPTION_KEY="…" npm run staff:create-admin -- --username drazren --email <ceo email> --name "Dr Fakrul Azren bin Azhar"
```

The temporary password is printed once. Sign in at `https://<domain>/staff/login` → change password → enrol MFA. Then create other staff in **Users**.

## 6. Go-live checklist

- [ ] Every item in [CONTENT-VERIFICATION.md](CONTENT-VERIFICATION.md) signed off; panels marked *Confirmed* only when verified
- [ ] Logo uploaded (CMS → Clinic details → Logo), opening hours and social links set
- [ ] Integrations page shows **LIVE** for database, storage, email, encryption key (and Google if used)
- [ ] Test screening end-to-end in production: email arrives, Drive file and Sheet row created, urgent flag path tested with a test submission, then delete test data
- [ ] Clinical risk-response protocol documented and staff trained
- [ ] Backups/PITR enabled and a restore tested
- [ ] `SHOW_PREVIEW_BANNER` unset (banner hidden in production by default)

## 7. Operations

- **Monitoring:** Vercel logs; Integrations page for failed/dead jobs; dashboard shows dead job count to the CEO.
- **Retries:** automatic (30 s → 6 h backoff, 6 attempts). Manual retry and *Reconcile (30 days)* on the Integrations page.
- **Retention:** `screening.retention_days` in `app_settings` (default 2555). Purges run in the cron job.
- **Encryption key rotation:** not automatic — plan a migration before rotating (see SECURITY.md).

## Self-hosting

`npm ci && npm run build && npm start` behind a TLS reverse proxy that sets `X-Forwarded-For`. Schedule `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/jobs` every 10 minutes. PGlite is for local/demo only — always use Postgres (`DATABASE_URL`) in production.
