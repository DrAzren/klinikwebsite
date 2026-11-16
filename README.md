# Klinik Nissa — Digital Healthcare Platform

Bilingual (Bahasa Melayu / English) website and secure staff intranet for **Klinik Nissa** (Klinik Dr Azren), a GP and mental-health clinic in Bandar Baru Nilai, Negeri Sembilan.

> **Your Health. Your Mind. Our Priority.**
> *Penjagaan kesihatan fizikal dan mental dalam satu tempat.*

| Area | What it does |
| --- | --- |
| **Public website** | Cinematic home, about, doctors, services (GP / mental health / weight / FOMEMA & hajj), panel directory, health insights CMS, book feature, careers, contact, privacy. BM at `/`, English at `/en`. |
| **Mental health screening** | PHQ-9 & GAD-7 with consent, step or grouped mode, keyboard support, server-verified scoring, **immediate safety guidance on PHQ-9 item 9**, encrypted storage, Drive/Sheets/email pipeline with retries. |
| **Staff portal** (`/staff`) | Username + password + TOTP MFA, admin-created accounts only. Leave, duty roster (A/B/C), shift swaps, incidents, documents & invoices, SOP links, screening administration, CEO management (users, CMS, integrations, audit log). |

Everything external (Supabase, Google Drive/Sheets, SMTP) has a **live adapter** and a clearly labelled **demo adapter**, so the whole platform runs locally with zero credentials. Nothing claims to be live unless it is — see **Staff Portal → Integrations**.

---

## Quick start (local demo)

Requires Node.js ≥ 22.6.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. On first start an embedded Postgres (PGlite) database is created in `.data/`, migrated, and seeded with the initial CMS content **plus fictional demo staff and data**.

Staff portal: http://localhost:3000/staff/login (demo password `Demo-Tenang-2026!`)

| Username | Role |
| --- | --- |
| `ceo.demo` | CEO / Super Admin |
| `doktor.demo` | Resident Doctor |
| `pembantu.demo`, `pembantu2.demo` | Clinic Assistant |
| `saringan.demo` | Screening Administrator |

Demo accounts are never created when `NODE_ENV=production`. To reset local data: stop the dev server, then `npm run db:reset-demo`. (PGlite is single-process — don't run `db:*` scripts while `npm run dev` is running.)

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server |
| `npm test` | Vitest suite (scoring, safety flag, auth, RBAC isolation, workflows, pipeline) |
| `npm run typecheck` · `npm run lint` | TypeScript and ESLint |
| `npm run db:migrate` | Apply `supabase/migrations/*.sql` to `DATABASE_URL` (or local PGlite) |
| `npm run db:seed` | Reference data + initial CMS content (production-safe, no demo users) |
| `npm run staff:create-admin -- --username … --email … --name "…"` | Create the first Super Admin (prints a one-time temporary password) |
| `npm run db:reset-demo` | Delete the local PGlite database |

## Tech stack

Next.js 16 (App Router, Cache Components, Partial Prerendering) · React 19 · TypeScript · Tailwind CSS 4 · Motion · GSAP (ScrollTrigger) · Supabase Postgres + Storage · PGlite (local/tests) · Argon2id · Zod · nodemailer · google-auth-library · Vitest · Playwright (verification).

## Documentation

| Doc | Contents |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture, page map, data model, screening data pipeline, design system |
| [docs/SECURITY.md](docs/SECURITY.md) | Security & privacy review (PDPA), threat model, controls, residual risks |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Step-by-step production deployment (Supabase + Vercel), backups, operations |
| [docs/CREDENTIALS.md](docs/CREDENTIALS.md) | Every production credential and approval required, with owners |
| [docs/CONTENT-VERIFICATION.md](docs/CONTENT-VERIFICATION.md) | Business, clinical and regulatory facts that must be verified before launch |
| [docs/ASSETS.md](docs/ASSETS.md) | Animation & media asset specification (8 motion scenes, Higgsfield/HyperFrames) |
| [.env.example](.env.example) | Environment variable template |

## Project layout

```
src/
  app/[lang]/…           Public pages (BM at /, English at /en via src/proxy.ts)
  app/staff/…            Staff sign-in flow + (portal) pages, server actions
  app/api/…              Screening, careers, staff uploads/downloads/exports, cron
  components/            Site scenes, screening flow, staff UI kit
  lib/auth/              Argon2id passwords, sessions, TOTP, RBAC, data-access layer
  lib/screening/         PHQ-9/GAD-7 instruments, scoring, pipeline, admin
  lib/staff/             Leave, roster, swaps, incidents, documents, admin
  lib/integrations/      Job queue, Google Drive/Sheets, email, storage
  lib/content/           CMS types, seed content, cached public reads, admin schemas
supabase/migrations/     Postgres schema (works on Supabase and PGlite)
tests/                   Vitest suites
motion/                  Editable HyperFrames-style GSAP composition
```

## Status & honesty notes

- **Not yet verified for publication:** doctor qualifications (intentionally blank), panel affiliations (all *pending verification* → none shown publicly), opening hours, social links, BM questionnaire translation sign-off, privacy policy legal review. A preview banner is shown outside production. See [docs/CONTENT-VERIFICATION.md](docs/CONTENT-VERIFICATION.md).
- **No fabricated testimonials, reviews, patient photos, credentials or clinical claims.** Real assets used: Dr Azren's photograph and the book cover (from the clinic's Google Drive). The official clinic logo was not accessible; a wordmark is used until the logo is uploaded via CMS.
- Screening results are **not diagnoses**; the website is **not monitored 24/7**.
