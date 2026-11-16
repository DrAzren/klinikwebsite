# Security & privacy review

Scope: public website, screening pipeline, staff portal, integrations. Framework: Malaysian **Personal Data Protection Act 2010** (as amended 2024), OWASP ASVS L2 as a practical baseline. This is an engineering review, **not legal advice** — the clinic's DPO/legal adviser must review the privacy notice and processing records before launch.

## 1. Data inventory

| Data | Sensitivity | Where | Protection |
| --- | --- | --- | --- |
| PHQ-9/GAD-7 answers, optional name/phone/email/age | **Sensitive (health)** | `screening_submissions.payload_enc` | AES-256-GCM app-level encryption (AAD-bound to reference), TLS, provider disk encryption, RBAC, audit on every view/search/export |
| Scores, severity, item-9 flag, priority | Health (pseudonymous) | clear columns for triage | RBAC; never in email/WhatsApp; Sheet row has no identity |
| Clinical follow-up notes | Health | `notes_enc` | Encrypted, RBAC, audit |
| Staff credentials | Secret | `staff_users` | Argon2id (m=19 MiB, t=2), never logged; MFA secret encrypted |
| Session / reset tokens | Secret | DB stores SHA-256 hash only | 32-byte random, HttpOnly `__Host-` cookie, SameSite=Strict, Secure |
| Job applications & CVs | Personal | `job_applications.payload_enc`, private storage | Encrypted, 6-month retention purge, CV PDF-only |
| Finance documents | Confidential business | private storage + Shared Drive | `finance:read` permission, permission-checked & audited downloads |

## 2. Controls implemented

**Authentication**
- No self-registration; only Super Admin creates accounts (`users:manage`), with a one-time temporary password (16 chars, policy-compliant) shown once.
- First login forces a password change; MFA (RFC 6238 TOTP) is **enforced in production** before any portal access. Session token rotates on privilege change (after password change / MFA) to prevent fixation.
- Password policy: ≥12 chars, 3 character classes, blocks clinic words / username / email; must differ from current.
- Lockout: 5 failures → 15 min; per-IP login rate limit (30/15 min); unknown users take the same time as wrong passwords (no enumeration); reset requests always return the same message.
- Sessions: 30-min idle and 12-h absolute timeout, server-side revocation; deactivation or role change revokes all of a user's sessions.
- Password reset: single-use, 30-min, hashed tokens; reset revokes other sessions.

**Authorisation**
- Central permission matrix (`rbac.ts`), enforced **inside domain functions** on the server, not just in UI. Clinical vs finance separation. Confidential incidents isolated. Restricted SOP links filtered by role. Last-Super-Admin and self-deactivation guards.
- Every private file download goes through `/api/staff/files/[id]` → `authoriseFileDownload()` (purpose-specific checks) → audited.
- 128 tests include isolation tests against a real database (assistant can't read screening, doctor can't export identifiers or see invoices, screening admin sees no documents, etc.).

**Input & transport**
- Zod validation server-side for all public endpoints; strict schemas (exact item counts, consent literals, adult confirmation, honeypot).
- Same-origin `Origin` checks on JSON/multipart APIs; Server Actions use Next.js built-in origin checks.
- Uploads: type verified by **magic bytes** (PDF/JPEG/PNG/WebP), size limits, randomised storage keys, SHA-256 duplicate prevention; downloads served with `nosniff` and a sandboxing CSP.
- Rate limits (Postgres-backed): screening 10/h/IP, careers 5/h/IP, forgot-password 5/h/IP, MFA 6 codes/10 min/session, report links 20/h/IP + 5 wrong codes per link.
- Headers: CSP (`frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`, limited `frame-src`), HSTS preload, `X-Frame-Options: DENY`, `nosniff`, strict referrer, Permissions-Policy, COOP; `X-Powered-By` removed; `/staff` and `/api` are `no-store` and `noindex`.
- Markdown renderer escapes HTML and allows only https/mailto/tel/relative links. CMS URLs validated.

**Privacy by design**
- Screening page: no analytics, pixels or third-party requests (verified: 0 third-party requests in e2e); fonts self-hosted; Google Maps and YouTube load **only after a click**.
- WhatsApp links use fixed templates per topic — screening data can't be placed in a URL (unit-tested). The floating WhatsApp button is hidden on the screening and report pages.
- Minimal notifications; Sheet without identity; Drive record in a private Shared Drive folder.
- Patient report links: 7-day expiry, max 3 views, require the reference code shown only on the patient's results screen (not in the email), lock after 5 wrong attempts.
- Retention: screening default 7 years (configurable `screening.retention_days`), applications 6 months; purge runs in the scheduled job and leaves an event trail.
- Explicit, versioned consent (`CONSENT_VERSION`) stored with each submission.

**Accountability**
- Append-only `audit_log`, `screening_events`, `roster_changes`, `shift_swap_events`, `incident_events`, `leave_adjustments` (database triggers reject UPDATE/DELETE).
- Audit covers logins/failures/lockouts, MFA, password changes, account admin, screening views/searches/exports/emails, file downloads, CMS edits, HR changes, integration retries.

**Supabase**
- RLS enabled on all tables with no policies + privileges revoked from `anon`/`authenticated` (migration `0002`). The service-role key is used only server-side for Storage.

## 3. Safety (clinical) controls

- Any non-zero PHQ-9 item 9 answer **immediately** opens an alert dialog with 999, hospital ED, HEAL 15555 and Befrienders KL, before the user can continue; it is repeated on the results screen.
- Submissions are flagged `urgent`, sorted first in the admin queue, highlighted, and the notification email subject is prefixed `[URGENT REVIEW]`.
- Copy everywhere states results are **not a diagnosis** and that the site is **not monitored 24/7**.
- Clinic must define an internal risk-response protocol (who reviews urgent flags, within what time, during which hours). See `CREDENTIALS.md → Clinical sign-off`.

## 4. Residual risks & recommendations

| Risk | Recommendation |
| --- | --- |
| CSP allows `'unsafe-inline'` scripts (needed for Next.js hydration with static prerendering) | Acceptable with no user-generated HTML; consider nonce-based CSP if pages become fully dynamic. |
| In-app auth instead of Supabase Auth (chosen for username login, admin-only creation and one code path) | Uses standard primitives and is fully tested; keep `@node-rs/argon2` patched; consider WebAuthn passkeys later. |
| Single encryption key | Store in a secrets manager + offline backup. Rotation: add key versioning (`v2.` prefix) before rotating. |
| Email deliverability / misdelivery | Use a Workspace sender with SPF/DKIM/DMARC; keep emails minimal (already enforced). |
| Drive sharing drift | Restrict the Shared Drive to named clinical staff; review membership quarterly. |
| Cross-border transfer (cloud regions) | Choose Supabase region `ap-southeast-1` (Singapore) or Malaysia when available; disclose in privacy notice (draft includes this). |
| PDPA 2024 amendments (DPO appointment, breach notification within 72 h, data portability) | Appoint/register a DPO; adopt a breach response plan using the audit log; confirm processor agreements (Supabase, Google, Vercel). |
| Medical advertising rules (Medicine Advertisements Board / MMC guidelines) | Have all service, weight-management and article copy reviewed; no prescription medicines are named or promoted. |

## 5. Backup & recovery

- Supabase: enable daily backups + **Point-in-Time Recovery** (Pro plan). Test a restore quarterly into a staging project.
- Storage bucket: enable versioning/replication or periodic export; Drive copies of documents and screening records provide a secondary copy.
- Keep `APP_ENCRYPTION_KEY` backed up separately — backups are useless without it.
