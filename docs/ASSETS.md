# Animation & media asset specification

Principles: motion is **code-first** (CSS/SVG/Motion/GSAP) so it loads instantly, stays editable and respects `prefers-reduced-motion`. Pre-rendered video is used only for optional ambience, never for interactions. **No generated people** — real people appear only in real photographs. Generated imagery must be abstract/environmental and must not be presented as the actual clinic.

## Scenes

| # | Scene | Implementation | Asset file(s) | Source | Desktop / mobile | Fallback | Compression | Loading |
|---|---|---|---|---|---|---|---|---|
| 1 | Cinematic hero, headline reveal | `components/site/hero.tsx` — CSS aurora, body (solid orb) + mind (glass ring) pair, line-mask headline, scroll parallax | Optional `public/motion/hero-loop.webm` + `.mp4` + `hero-loop-poster.jpg` | Higgsfield (prompt H1 below) | Video desktop ≥ md only; mobile uses CSS scene | CSS aurora (always rendered) | VP9 CRF 34, 1920×1080, ≤ 8 s loop, ≤ 1.5 MB; H.264 CRF 23 ≤ 2.5 MB; poster AVIF/WebP ≤ 80 KB | `preload="none"`, muted autoplay, skipped for reduced motion; enable with `NEXT_PUBLIC_HERO_VIDEO` |
| 2 | Physical → mental transition | `mind-body-bridge.tsx` — single SVG path: ECG heartbeat resolving into a calm wave, GSAP ScrollTrigger scrub, colour shift teal → lilac | none | Code | Same SVG, responsive viewBox | Full path drawn statically | n/a | GSAP + ScrollTrigger dynamically imported only on Home |
| 3 | Floating service cards | `cards.tsx` `ServiceCard` + `TiltCard` — 6 px float loop (staggered), pointer tilt with glare, icon chip | none | Code (lucide icons) | Tilt mouse-only; float on all | Static cards | n/a | Inline |
| 4 | Doctor profile entrance | `doctor-reveal.tsx` — rounded clip-path wipe + rise; photo slow zoom on hover | `public/images/dr-azren.jpg` (897×1121) | Clinic Drive *DR AZREN THUMBNAIL.png* (real) | `next/image` responsive (AVIF/WebP), container-query layout | Monogram tile when no photo | JPEG q84 → served AVIF/WebP | Lazy below the fold |
| 5 | PHQ-9/GAD-7 transitions | `screening-flow.tsx` — directional slide + blur per question, progress bar, animated score rings | none | Code | Identical; large touch targets | Instant swaps | n/a | Client component, no third-party requests |
| 6 | Panel logo marquee | `PanelMarquee` — CSS marquee, edge mask, pause on hover | `public/brand/panels/<slug>.svg` (approved logos only) | Panel providers (written permission) | Same | Typographic wordmarks; reduced motion → wrapped grid | SVG ≤ 10 KB each | Only **confirmed** panels render |
| 7 | Featured book | `book-3d.tsx` — CSS 3D book (cover, spine, page block), pointer-follow spring, sheen | `public/images/book-dr-saya-boleh-sembuh-ke.jpg` (914×1280) | Clinic Drive *Front Cover Dr Saya Boleh Sembuh Ke?.jpeg* (real) | Same; tilt on fine pointers | Fixed −18° angle | JPEG q86 → AVIF/WebP | Lazy |
| 8 | Location guide | `location.tsx` — animated route line + bouncing pin → accurate Google Maps embed **on click**; Google Maps / Waze deep links from the address query | none | Google Maps (address query, not invented coordinates) | Same | Address + directions buttons | n/a | iframe only after consent click |
| — | Brand opener (social / events) | `motion/brand-opener.html` — editable GSAP composition, 1920×1080, 10 s | `public/motion/brand-opener.webm/.mp4` (render) | HyperFrames-style local composition | 16:9; duplicate stage at 1080×1920 for Reels | Poster frame | WebM VP9 CRF 32 / MP4 H.264 CRF 22 | Not loaded by the site |

## Higgsfield prompts (optional ambience)

Not generated yet — generation spends account credits, so run when approved. Keep outputs abstract; reject any clip containing faces, text, medical equipment or anything resembling a specific clinic.

- **H1 — hero loop (16:9, 8 s, seamless):** "Slow cinematic abstract light, deep midnight navy (#0B1F3A) background, soft teal (#00B7B1) and pale mint volumetric glow drifting like breath, subtle glass refraction, gentle bokeh, calm, premium healthcare mood, no people, no text, no objects, seamless loop, minimal motion."
- **H2 — mobile poster (9:16 still):** same palette, centred soft orb of teal light with a translucent ring, generous negative space at top for the headline.
- **H3 — section texture (still, 3:2):** "Macro photograph of soft mint fabric folds in diffuse daylight, off-white and teal tones, calm and clean, shallow depth of field, no people."

## Real photography still needed

Clinic exterior, reception/waiting area, consultation room (empty), team portrait (with consent), Dr Aminah portrait, and a professional Dr Azren portrait. Shoot at 3:2 and 4:5, ≥ 2400 px long edge; upload via **CMS → Clinic details → Gallery** (`/images/clinic/*.jpg`) and doctor profiles.

## Performance budget

- LCP element is text (hero headline), not media → fast LCP on mobile.
- Fonts self-hosted via `next/font` with `display: swap`.
- No video, map or YouTube loads by default. GSAP is code-split to the home page.
- All animations are transform/opacity; `prefers-reduced-motion` disables loops, parallax and scrubbing site-wide.
