# Content verification register

Every public fact, its source, and its status. Edit content in **Staff Portal → Content**; code-level copy lives in `src/lib/i18n/` and page files noted below.

| Item | Current value | Source | Status |
| --- | --- | --- | --- |
| Clinic name / alternative name | Klinik Nissa / Klinik Dr Azren | Project brief; Drive branding folder | ✅ from owner |
| Address | 9697 Ground Floor, Jalan BBN 1/3C, Pusat Bandar Putra Point, 71800 Bandar Baru Nilai, N. Sembilan | Clinic PDPA registration record (Jan 2024) | ⚠️ re-confirm; check map pin |
| Phone / WhatsApp | +60 12-608 1411 | Brief (public directory) and PDPA record | ⚠️ verify it's the WhatsApp Business line |
| Public email | kliniknissa@gmail.com | PDPA registration record | ⚠️ confirm still monitored |
| Opening hours | *not shown* ("contact us") | — | ❌ provide |
| Tagline & sub-headline | As per brief | Brief | ✅ |
| Doctor: Dr Fakrul Azren bin Azhar (Dr Azren), founder | Bio, interests (mental health, depression & anxiety, education) | Brief; book cover | ⚠️ qualifications blank; confirm interests & title |
| Doctor: Dr Aminah, resident doctor | Short bio, no photo | Brief | ⚠️ full name, qualifications, interests, photo |
| Dr Azren photo | `/public/images/dr-azren.jpg` | Clinic Drive (*DR AZREN THUMBNAIL.png*, a video frame) | ⚠️ replace with a professional portrait when available |
| Services (GP, mental health, weight, FOMEMA, Hajj) | 17 services with explanations/FAQ | Brief; drafted copy | ⚠️ clinical + advertising review |
| Weight management | No medicines named; suitability assessment wording only | — | ⚠️ regulatory review |
| Panels | AIA, PMCare, Etiqa, Great Eastern, HealthMetrics, MedKad, eMas, Red Alert, Perodua, MAINS, OneWorks | Brief (candidates) | ❌ all *pending verification* — none public |
| Book | *Dr, Saya Boleh Sembuh Ke?*, Whitecoat, ISBN 978-967-2705-70-3, 290 pp, 2026 | bookcafe.my listing; cover from clinic Drive | ✅ (price/stock intentionally not shown) |
| Book synopsis | Paraphrased summary | bookcafe.my blurb | ⚠️ author approval |
| PHQ-9 / GAD-7 English | Standard wording | Pfizer/PHQ Screeners (free to reproduce) | ✅ |
| PHQ-9 / GAD-7 BM | Clinic's existing form wording | Clinic Drive (*Saringan Kesihatan Mental Klinik Nissa*) | ⚠️ validate against official Malay version |
| Severity bands | Standard (PHQ-9 5/10/15/20; GAD-7 5/10/15) | Published scoring | ✅ |
| Helplines | 999; HEAL 15555; Befrienders KL 03-7627 2929 | Brief (999, HEAL); public info | ⚠️ re-check numbers/hours periodically |
| Mission, vision, story, values | Draft copy | Written for review | ⚠️ owner approval (`src/app/[lang]/about/page.tsx`) |
| Health articles (3) | General education | Drafted | ⚠️ clinical review; add *Reviewed by* in CMS |
| Mental health FAQs (5) | General education | Drafted | ⚠️ clinical review |
| Careers | One *draft* vacancy (Clinic Assistant) | Drafted | ❌ publish only when open |
| Events | *Mind Matters @ KUL* (15 Oct 2026) as **draft** | Clinic Drive screening programme | ⚠️ partner approval before publishing |
| Privacy policy & disclaimer | Draft (`src/app/[lang]/privacy/page.tsx`) | Written for PDPA | ❌ legal review |
| BMI cut-offs | Asian cut-offs (23 / 27.5; waist 90/80 cm) | Malaysian CPG practice | ⚠️ clinical confirmation |
| Logo | Wordmark placeholder | — | ❌ upload official logo |
| Clinic gallery | Hidden until real photos are added | — | ❌ provide real clinic photographs |

Legend: ✅ verified/sourced · ⚠️ needs confirmation · ❌ missing / must provide.
