"use client";

/**
 * Scene 2 — Abstract transition from physical health to mental wellbeing.
 * A single SVG line begins as a heartbeat (ECG) and resolves into a slow,
 * calm wave. GSAP ScrollTrigger scrubs the stroke as the section scrolls.
 * Reduced motion: the full line is shown statically.
 */
import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

const PATH =
  "M0 120 L150 120 L172 120 L186 98 L200 120 L222 120 L238 36 L258 196 L276 120 L306 120 L324 104 L344 120 L430 120 " +
  "C 480 120, 490 66, 552 66 S 624 172, 686 172 S 760 84, 822 84 S 896 152, 958 152 S 1030 104, 1090 108 S 1160 124, 1200 120";

export function MindBodyBridge({ eyebrow, title, body, physical, mental }: { eyebrow: string; title: string; body: string; physical: string; mental: string }) {
  const section = useRef<HTMLElement>(null);
  const path = useRef<SVGPathElement>(null);
  const glow = useRef<SVGPathElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce || !section.current || !path.current) return;
    let revert: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => {
        const len = path.current!.getTotalLength();
        for (const el of [path.current!, glow.current!]) gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
        const tl = gsap.timeline({
          scrollTrigger: { trigger: section.current, start: "top 70%", end: "bottom 55%", scrub: 0.9 },
        });
        tl.to([path.current, glow.current], { strokeDashoffset: 0, ease: "none", duration: 1 }, 0)
          .fromTo(".bridge-left", { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.25 }, 0.05)
          .fromTo(".bridge-right", { opacity: 0, x: 16 }, { opacity: 1, x: 0, duration: 0.25 }, 0.7)
          .fromTo(".bridge-bg", { opacity: 0.4 }, { opacity: 1, duration: 1, ease: "none" }, 0);
      }, section);
      revert = () => ctx.revert();
    })();
    return () => {
      cancelled = true;
      revert?.();
    };
  }, [reduce]);

  return (
    <section ref={section} className="relative overflow-hidden bg-paper py-24 sm:py-32">
      <div aria-hidden className="bridge-bg pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-1/2 h-[40rem] w-[50%] -translate-y-1/2 bg-[radial-gradient(ellipse_at_left,rgba(0,183,177,0.10),transparent_65%)]" />
        <div className="absolute right-0 top-1/2 h-[40rem] w-[50%] -translate-y-1/2 bg-[radial-gradient(ellipse_at_right,rgba(124,141,213,0.14),transparent_65%)]" />
      </div>
      <div className="container-page relative">
        <div className="mx-auto max-w-3xl text-center">
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-4 text-[2rem] font-semibold leading-[1.08] text-navy-900 sm:text-5xl">{title}</h2>
          <p className="mt-6 text-lg leading-relaxed text-ink-muted">{body}</p>
        </div>

        <div className="relative mt-14 sm:mt-20">
          <svg viewBox="0 0 1200 240" className="h-auto w-full overflow-visible" role="img" aria-label={`${physical} → ${mental}`}>
            <defs>
              <linearGradient id="bridge-stroke" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#00B7B1" />
                <stop offset="0.45" stopColor="#2FD0C9" />
                <stop offset="1" stopColor="#8B93D9" />
              </linearGradient>
              <filter id="bridge-blur" x="-10%" y="-50%" width="120%" height="200%">
                <feGaussianBlur stdDeviation="8" />
              </filter>
            </defs>
            <path d="M0 120 H1200" stroke="#DBE3EC" strokeWidth="1" strokeDasharray="4 8" fill="none" />
            <path ref={glow} d={PATH} stroke="url(#bridge-stroke)" strokeWidth="10" fill="none" opacity="0.35" filter="url(#bridge-blur)" />
            <path ref={path} d={PATH} stroke="url(#bridge-stroke)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <div className="mt-6 flex justify-between text-sm font-semibold sm:absolute sm:inset-x-0 sm:-bottom-4 sm:mt-0">
            <span className="bridge-left inline-flex items-center gap-2 text-teal-700">
              <span className="h-2 w-2 rounded-full bg-teal-500" /> {physical}
            </span>
            <span className="bridge-right inline-flex items-center gap-2 text-[#5b63b5]">
              {mental} <span className="h-2 w-2 rounded-full bg-[#8B93D9]" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
