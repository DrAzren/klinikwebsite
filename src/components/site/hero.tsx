"use client";

/**
 * Scene 1 — Cinematic hero. Pure CSS/SVG + Motion (no video) so it loads
 * instantly on mobile: a slow aurora behind a "body & mind" orb pair, and a
 * line-by-line masked headline reveal. An optional Higgsfield loop can be
 * layered in via `videoSrc` (see docs/ASSETS.md); it is skipped for
 * reduced-motion users and on small screens.
 */
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { WhatsAppIcon } from "../icons";

const EASE = [0.16, 1, 0.3, 1] as const;

interface Props {
  eyebrow: string;
  lines: [string, string, string];
  sub: string;
  chips: string[];
  bookLabel: string;
  bookHref: string;
  screeningLabel: string;
  screeningHref: string;
  scrollLabel: string;
  videoSrc?: string;
}

export function Hero(p: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const orbY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "18%"]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, reduce ? 1 : 0]);

  const line = (text: string, i: number, className = "") => (
    <span className="block overflow-hidden pb-[0.08em]">
      <motion.span
        className={`block ${className}`}
        initial={reduce ? false : { y: "110%" }}
        animate={{ y: "0%" }}
        transition={{ duration: 1.1, ease: EASE, delay: 0.25 + i * 0.14 }}
      >
        {text}
      </motion.span>
    </span>
  );

  return (
    <section ref={ref} className="grain relative isolate flex min-h-[100svh] items-end overflow-hidden bg-navy-900 pb-16 pt-32 text-white sm:items-center sm:pb-24">
      {/* Aurora */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute -left-[20%] top-[-10%] h-[70vmax] w-[70vmax] animate-drift rounded-full bg-[radial-gradient(circle_at_center,rgba(0,183,177,0.28),transparent_60%)] blur-2xl" />
        <div className="absolute -right-[25%] bottom-[-30%] h-[80vmax] w-[80vmax] animate-drift rounded-full bg-[radial-gradient(circle_at_center,rgba(36,80,127,0.75),transparent_62%)] blur-2xl [animation-delay:-8s]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,20,40,0)_40%,rgba(6,20,40,0.65)_100%)]" />
        {p.videoSrc && !reduce && (
          <video className="absolute inset-0 hidden h-full w-full object-cover opacity-35 mix-blend-screen md:block" src={p.videoSrc} autoPlay muted loop playsInline preload="none" />
        )}
      </div>

      {/* Body & mind orbs */}
      <motion.div aria-hidden style={{ y: orbY }} className="pointer-events-none absolute right-[-30%] top-[12%] -z-10 h-[34rem] w-[34rem] opacity-60 sm:right-[-8%] sm:h-[42rem] sm:w-[42rem] sm:opacity-100 lg:right-[2%] lg:top-1/2 lg:-translate-y-1/2">
        <motion.div
          className="absolute left-[8%] top-[18%] h-[62%] w-[62%] animate-breathe rounded-full bg-[radial-gradient(circle_at_32%_30%,#7ff0ea_0%,#00b7b1_38%,#0a5f6b_78%,#0b1f3a_100%)] shadow-[0_0_120px_-10px_rgba(0,183,177,0.65)]"
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.8, ease: EASE, delay: 0.1 }}
        />
        <motion.div
          className="glass absolute right-[4%] top-[12%] h-[66%] w-[66%] rounded-full"
          initial={reduce ? false : { scale: 0.7, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ duration: 2, ease: EASE, delay: 0.35 }}
        >
          <div className="absolute inset-[10%] rounded-full ring-1 ring-white/15" />
          <div className="absolute inset-[24%] rounded-full ring-1 ring-white/10" />
        </motion.div>
        <motion.div
          className="absolute h-3 w-3 rounded-full bg-teal-200 shadow-[0_0_24px_6px_rgba(127,240,234,0.6)]"
          style={{ left: "50%", top: "50%" }}
          animate={reduce ? undefined : { x: [0, 180, 0, -180, 0], y: [-180, 0, 180, 0, -180] }}
          transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
        />
      </motion.div>

      <motion.div style={{ opacity: fade }} className="container-page relative">
        <motion.p
          className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-teal-200 ring-1 ring-white/10 backdrop-blur"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
          {p.eyebrow}
        </motion.p>

        <h1 className="mt-7 max-w-4xl text-[clamp(3rem,10.5vw,7.25rem)] font-semibold leading-[0.95] tracking-[-0.035em]">
          {line(p.lines[0], 0)}
          {line(p.lines[1], 1, "font-display font-normal italic text-gradient-teal pr-[0.08em]")}
          {line(p.lines[2], 2, "text-white/90")}
        </h1>

        <motion.p
          className="mt-7 max-w-xl text-lg leading-relaxed text-navy-100/85 sm:text-xl"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 0.75 }}
        >
          {p.sub}
        </motion.p>

        <motion.div
          className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 0.9 }}
        >
          <a href={p.bookHref} target="_blank" rel="noopener noreferrer" className="group inline-flex h-14 items-center justify-center gap-2.5 rounded-full bg-teal-500 px-7 text-base font-semibold text-navy-950 shadow-glow transition hover:bg-teal-400">
            <WhatsAppIcon className="h-5 w-5" />
            {p.bookLabel}
          </a>
          <Link href={p.screeningHref} className="group inline-flex h-14 items-center justify-center gap-2 rounded-full bg-white/[0.08] px-7 text-base font-medium text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/15">
            {p.screeningLabel}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>

        <motion.ul
          className="mt-10 flex flex-wrap gap-2"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.15 }}
        >
          {p.chips.map((c) => (
            <li key={c} className="rounded-full px-3.5 py-1.5 text-xs font-medium text-navy-100/80 ring-1 ring-white/12">
              {c}
            </li>
          ))}
        </motion.ul>
      </motion.div>

      <motion.div
        aria-hidden
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 text-[0.65rem] uppercase tracking-[0.3em] text-white/50 sm:flex"
        animate={reduce ? undefined : { y: [0, 6, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        {p.scrollLabel}
        <ChevronDown className="h-4 w-4" />
      </motion.div>
    </section>
  );
}
