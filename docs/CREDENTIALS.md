# Production credentials & approvals required

Nothing below is configured yet. Until each item is provided, the platform runs that part in **DEMO mode** (labelled in *Staff Portal → Integrations*) and never claims a live integration.

## A. Credentials / configuration

| # | Item | Env variable(s) | Owner | Notes |
| --- | --- | --- | --- | --- |
| 1 | Supabase project (Postgres, pooler URL) | `DATABASE_URL` | CEO / IT | Region `ap-southeast-1`; enable PITR |
| 2 | Supabase Storage private bucket + service-role key | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` | IT | Server-side only |
| 3 | Application encryption key | `APP_ENCRYPTION_KEY` | CEO | 32 random bytes (base64). Keep an offline backup — losing it makes encrypted data unreadable |
| 4 | Verified clinic WhatsApp number | `CLINIC_WHATSAPP_NUMBER` | CEO | Public directory number `+60 12-608 1411` used provisionally |
| 5 | Careers inbox (clinic Gmail) | `CAREERS_EMAIL` | CEO | Applications are queued and retried until set |
| 6 | Screening alert recipients (authorised clinicians) | `SCREENING_NOTIFY_EMAILS` | CEO / Resident Doctor | Minimal-content alerts only |
| 7 | SMTP sender (Workspace app password or provider) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | IT | Configure SPF/DKIM/DMARC |
| 8 | Google service account (Drive + Sheets APIs) | `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` (or OAuth trio) | IT | Add as *Content manager* on the clinic Shared Drive |
| 9 | Private screening Drive folder | `GOOGLE_DRIVE_SCREENING_FOLDER_ID` | CEO | Access limited to clinical staff |
| 10 | Screening administration Sheet | `GOOGLE_SHEETS_SCREENING_ID`, `GOOGLE_SHEETS_SCREENING_TAB` | CEO | No names/contacts are written |
| 11 | Document folders (invoices, receipts, lab, stock, maintenance) | `GOOGLE_DRIVE_DOCUMENTS_FOLDER_ID`, `GOOGLE_DRIVE_DOCUMENT_FOLDERS_JSON` | CEO | Existing folders e.g. *INVOIS BARANG KLINIK*, *PAYMENT BARANG KLINIK* can be used |
| 12 | Cron secret | `CRON_SECRET` | IT | Vercel sends it automatically to cron routes |
| 13 | Production domain | `SITE_URL` | CEO | Used in emails, sitemap, canonical URLs |
| 14 | Official logo file (SVG/PNG) | CMS → Clinic details → Logo | CEO | *Klinik Nissa Logo Clean.png* exists in Drive but was not shareable |
| 15 | First Super Admin | `npm run staff:create-admin` | CEO | Then create staff accounts in the portal |
| 16 | Social links (Instagram, TikTok, YouTube, Facebook) | CMS → Clinic details → Social | CEO | Instagram could not be read automatically (login wall) |
| 17 | Optional: Higgsfield-generated hero loop | `NEXT_PUBLIC_HERO_VIDEO` | Marketing | See ASSETS.md; site works without it |

## B. Approvals & sign-offs

| # | Approval | By | Why |
| --- | --- | --- | --- |
| 1 | **Clinical sign-off of BM PHQ-9/GAD-7 wording** against a validated Malay version | Resident Doctor / Dr Azren | English is standard; BM currently uses the clinic's existing form wording (`src/lib/screening/instruments.ts`, `TRANSLATION_STATUS`) |
| 2 | Clinical risk-response protocol for urgent (item 9) flags: reviewer, response time, hours | Dr Azren | Website is not monitored 24/7 — the protocol defines real-world handling |
| 3 | Severity interpretation and result wording | Resident Doctor | `src/lib/i18n/*.ts → screening.interpretation` |
| 4 | Doctor profiles: titles, qualifications, MMC/NSR registration, clinical interests, photos | Each doctor | Qualifications are intentionally blank until verified |
| 5 | Service list and descriptions; FOMEMA/Hajj eligibility; vaccine availability | Dr Azren | Advertising rules; no prescription medicines are promoted |
| 6 | Panel affiliations — mark *Confirmed* only with an active agreement; logo usage permission | Admin | All candidates are *pending verification* (none public) |
| 7 | Privacy policy & PDPA notices; DPO appointment; processor agreements (Supabase, Google, Vercel) | Legal / DPO | Draft at `/privacy` |
| 8 | Medical advertising review of all public copy and articles | Dr Azren / regulatory adviser | Before publishing |
| 9 | Emergency/helpline numbers (999, HEAL 15555, Befrienders KL 03-7627 2929) and hours | Admin | Re-check periodically |
| 10 | Opening hours and address/map pin | Admin | Address from the clinic's PDPA registration record |
| 11 | HR leave entitlements and working days per the clinic's approved HR policy | CEO | Defaults = Employment Act 1955 minimums (< 2 years' service) |
| 12 | Partner name use (e.g. Mind Matters @ KUL event) | Partner | Event seeded as *draft* |
