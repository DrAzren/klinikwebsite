# Architecture

## 1. System overview

```
                         ┌──────────────────────────── Next.js 16 (Vercel, sin1) ───────────────────────────┐
 Patient browser ──TLS──▶│ proxy.ts  (BM at "/", EN at "/en" → app/[lang])                                    │
                         │                                                                                    │
                         │ Public pages  ── 'use cache' + cacheTag("content:*") ─┐  static / ISR              │
                         │ /api/screening  /api/careers  (same-origin, rate-limited, zod)                      │
                         │                                                       │                            │
 Staff browser  ──TLS──▶ │ /staff/* (Partial Prerender: static shell + per-user stream)                        │
                         │   requireStaff() → session → RBAC permission → lib/* domain modules                 │
                         │ /api/staff/*  (uploads w/ progress, permission-checked downloads, CSV exports)      │
                         │ /api/cron/jobs  (Bearer CRON_SECRET)                                                │
                         └───────────┬──────────────────────────────┬───────────────────────────┬──────────────┘
                                     │ SQL (TLS, server only)       │ REST (service role)       │ OAuth/SA, SMTP
                             Supabase Postgres               Supabase Storage (private)   Google Drive / Sheets, Email
                    (RLS on, anon/authenticated revoked)
```

* **One code path** for local and production: the same SQL migrations run on Supabase Postgres (`DATABASE_URL`) and on embedded **PGlite** (local demo and tests).
* **Server-side only secrets.** The browser never talks to Supabase, Google or SMTP. No API keys are exposed.
* **Adapters with demo fallbacks** (`lib/integrations/*`): Drive/Sheets write to `.data/drive-demo` and `.data/sheets-demo`, email is stored in `email_outbox`, storage writes to `.data/uploads`. The Integrations page shows live vs. demo per service.

## 2. Page map

| Public (BM `/…`, EN `/en/…`) | Notes |
| --- | --- |
| `/` | Hero (Scene 1), *How can we help* selector, body→mind bridge (Scene 2), floating service cards (Scene 3), doctors (Scene 4), values, screening promo, panel marquee (Scene 6, confirmed panels only), book (Scene 7), insights, Spread Positivity, location (Scene 8) |
| `/about` | Mission, vision, story, environment, CMS gallery (real photos only), values, doctors |
| `/doctors` | CMS doctor profiles (qualifications hidden until verified) |
| `/services`, `/services/[slug]` | 4 groups; each service: explanation, who benefits, what to expect, FAQ, WhatsApp CTA |
| `/mental-health`, `/weight-management` | Focused landing pages; BMI/waist tool (Asian cut-offs, client-only) |
| `/screening` | PHQ-9 / GAD-7 flow (Scene 5). No analytics, no third-party requests |
| `/report/[token]` | Patient's access-controlled report link (token + reference code) |
| `/panels` | Searchable directory of **confirmed** panels |
| `/insights`, `/insights/[slug]` | Articles (Markdown subset, JSON-LD), FAQs, videos (youtube-nocookie on click), Spread Positivity, events |
| `/book`, `/careers`, `/contact`, `/privacy` | Book (no hard-coded price/stock), recruitment with CV upload, WhatsApp topic cards, PDPA notice & disclaimer |

| Staff (`/staff/…`) | Permission |
| --- | --- |
| `login`, `forgot`, `reset`, `mfa`, `mfa/setup` | Sign-in stages |
| `dashboard`, `account` | Any active staff |
| `leave` | `leave:apply` (review/configure sections by permission) |
| `roster`, `swaps` | `roster:view`, `swap:request` (edit/approve by permission) |
| `incidents`, `incidents/[id]` | `incident:report` (manage/confidential by permission) |
| `documents` | `documents:upload` or `finance:read` |
| `links` | `links:view` (restricted links filtered by role) |
| `screening`, `screening/[id]` | `screening:read` |
| `admin/users`, `admin/content/**`, `admin/integrations`, `admin/audit` | Super Admin |

## 3. Roles & permissions (`src/lib/auth/rbac.ts`)

| Permission group | Super Admin | Resident Doctor | Clinic Assistant | Screening Admin |
| --- | :-: | :-: | :-: | :-: |
| Screening read / manage / assign / contact patient | ✓ | ✓ | – | ✓ |
| Screening export (CSV incl. identifiers) | ✓ | – | – | ✓ |
| Finance documents (invoices, receipts, lab invoices) | ✓ | – | own uploads | – |
| Operational documents (stock, maintenance, admin) | ✓ | ✓ | ✓ | – |
| Leave apply / roster view / swap request / report incident / links | ✓ | ✓ | ✓ | ✓ |
| Leave review & configure, roster edit & configure, swap approve | ✓ | – | – | – |
| Incident manage (non-confidential) | ✓ | ✓ | – | – |
| Confidential incidents | ✓ | reporter/assignee only | reporter/assignee only | reporter/assignee only |
| Users, content, integrations, audit log | ✓ | – | – | – |

Clinical and financial data are deliberately held by **separate permissions**. All checks run on the server inside the domain functions (`assertCan`) and are covered by `tests/rbac-isolation.test.ts` against a real database.

## 4. Data model (`supabase/migrations/0001_core.sql`)

* **Auth:** `staff_users` (Argon2id hash, MFA secret encrypted, lockout counters), `staff_sessions` (SHA-256 token hash, stage, idle/absolute expiry), `password_reset_tokens`, `rate_limits`.
* **Audit:** `audit_log` — append-only (trigger rejects UPDATE/DELETE).
* **CMS:** `content_items(collection, slug, status, sort, data jsonb)`, `app_settings`.
* **Clinical:** `screening_submissions` (scores/severity/priority in clear for triage; answers + contact **AES-256-GCM encrypted** in `payload_enc`; notes encrypted; consent version & timestamp; retention date), `screening_events` (append-only), `report_links`.
* **Integration:** `integration_jobs` (idempotent `dedupe_key`, attempts, backoff, dead-letter), `email_outbox`.
* **HR/ops:** `leave_types`, `leave_entitlements`, `leave_adjustments` (append-only), `leave_requests`, `public_holidays`, `shift_definitions`, `roster_assignments`, `roster_changes` (append-only), `shift_swaps`, `shift_swap_events` (append-only), `incidents`, `incident_events` (append-only), `incident_files`, `documents` (unique SHA-256 → duplicate prevention), `files`, `staff_links`, `job_applications` (encrypted).
* **Supabase hardening (`0002`):** RLS enabled on every table with no policies, and all privileges revoked from `anon`/`authenticated`, so the public Supabase REST/GraphQL APIs can never read these tables even if an anon key leaks. The app connects as the owner role server-side.

## 5. Screening data pipeline

```
Browser ── consent + answers (JSON, POST, same-origin) ──▶ /api/screening
   1. Origin check · rate limit (10/h/IP) · body ≤ 20 KB · zod validation (consent, adult, consent version, exact item counts, honeypot)
   2. Server re-scores (client scores only cross-checked; mismatch logged as an event)
   3. INSERT screening_submissions (encrypted payload, consent version/time, priority) — idempotency key → no duplicates
   4. screening_events: submitted (+ safety_flag when PHQ-9 item 9 > 0) · audit_log
   5–7. enqueue (same transaction): screening.drive · screening.sheet · screening.notify
   ◀── response: reference, scores, severities, item9 flag (UI shows interpretation + safety guidance)
after(): process this submission's jobs immediately
cron (*/10): retries with exponential backoff (30 s → 6 h), dead-letter after 6 attempts, retention purge
Admin → Integrations: retry, run queue, reconcile last 30 days (re-enqueues missing steps idempotently)
```

* **Drive:** a plain-text record per submission in the private screening folder; idempotent via Drive `appProperties.kn_key` (re-runs reuse the existing file). Urgent records are suffixed `_URGENT`.
* **Sheet:** administrative row **without names or contact details** (reference, time, scores, severity, item-9 flag, priority, status, contact requested). Status changes from the portal update the sheet.
* **Email:** minimal — reference, priority, link to the portal. No scores, answers or identity.
* **WhatsApp:** fixed prefill templates per topic only (`lib/whatsapp.ts`); screening data can't be injected (tested).

## 6. Design system

* Tokens in `src/app/globals.css` (`@theme`): Midnight Navy `#0B1F3A`, Royal Blue `#173B63`, Medical Teal `#00B7B1`, Soft Mint `#E9F5F5`, Off White `#F8FAFC`, plus semantic success/warning/danger.
* Type: Plus Jakarta Sans (UI/body) + Instrument Serif italic (emotional accents), self-hosted by `next/font` (no runtime Google requests).
* Components: `components/ui.tsx` (buttons, headings, badges), `components/motion.tsx` (Reveal, Stagger, TiltCard), `components/staff/*` (forms with `useActionState`, tables, status chips).
* Motion: opacity/transform only; every animation honours `prefers-reduced-motion`; GSAP is lazy-loaded only on the home page for Scene 2.

## 7. Rendering & caching

* `cacheComponents` + `partialPrefetching` enabled. Public content reads are `'use cache'` with `cacheTag("content:<collection>")`; CMS saves call `updateTag()` so changes appear immediately.
* During `next build` without `DATABASE_URL`, content reads fall back to the seed so the build never touches a database.
* Staff pages read the session at request time behind Suspense (`loading.tsx`) and call `connection()` in `requireStaff()`.
