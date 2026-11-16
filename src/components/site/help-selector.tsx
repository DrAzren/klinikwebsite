"use client";

/** "How can we help you?" — animated category selector (tabs). */
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import { ArrowRight, Brain, Check, Scale, Stethoscope } from "lucide-react";
import { WhatsAppIcon } from "../icons";

export interface HelpCategory {
  key: "gp" | "mental" | "weight";
  label: string;
  title: string;
  body: string;
  whoFor: string[];
  links: { label: string; href: string }[];
  exploreHref: string;
  whatsappHref: string;
}

const ICON = { gp: Stethoscope, mental: Brain, weight: Scale };
const TINT = {
  gp: "from-mint via-white to-navy-100/50",
  mental: "from-[#eef0fb] via-white to-mint",
  weight: "from-[#f2f7ec] via-white to-mint",
};

export function HelpSelector({ eyebrow, title, whoForLabel, exploreLabel, whatsappLabel, categories }: {
  eyebrow: string; title: string; whoForLabel: string; exploreLabel: string; whatsappLabel: string; categories: HelpCategory[];
}) {
  const [active, setActive] = useState(categories[0].key);
  const reduce = useReducedMotion();
  const id = useId();
  const cat = categories.find((c) => c.key === active)!;
  const Icon = ICON[cat.key];

  return (
    <section className="relative -mt-10 pb-24 sm:-mt-16 sm:pb-32">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-[2rem] bg-white p-5 shadow-lift ring-1 ring-line sm:p-8 lg:p-12">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="eyebrow">{eyebrow}</p>
              <h2 className="mt-3 text-3xl font-semibold text-navy-900 sm:text-[2.6rem]">{title}</h2>
            </div>
            <div role="tablist" aria-label={title} className="relative grid w-full grid-cols-3 rounded-[1.25rem] bg-paper p-1.5 ring-1 ring-line sm:inline-flex sm:w-auto sm:rounded-full"
              onKeyDown={(e) => {
                const i = categories.findIndex((c) => c.key === active);
                if (e.key === "ArrowRight") setActive(categories[(i + 1) % categories.length].key);
                if (e.key === "ArrowLeft") setActive(categories[(i - 1 + categories.length) % categories.length].key);
              }}
            >
              {categories.map((c) => {
                const selected = c.key === active;
                const TabIcon = ICON[c.key];
                return (
                  <button
                    key={c.key}
                    role="tab"
                    id={`${id}-tab-${c.key}`}
                    aria-selected={selected}
                    aria-controls={`${id}-panel`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActive(c.key)}
                    className="relative rounded-2xl px-2 py-2.5 text-[0.8rem] font-semibold leading-tight transition-colors sm:whitespace-nowrap sm:rounded-full sm:px-5 sm:text-sm"
                  >
                    {selected && (
                      <motion.span layoutId={`${id}-pill`} className="absolute inset-0 rounded-2xl bg-navy-900 shadow-soft sm:rounded-full" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
                    )}
                    <span className={`relative inline-flex items-center justify-center gap-2 ${selected ? "text-white" : "text-ink-soft"}`}>
                      <TabIcon className="hidden h-4 w-4 sm:block" aria-hidden />
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${active}`} className="mt-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={reduce ? false : { opacity: 0, y: 18, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? undefined : { opacity: 0, y: -10, filter: "blur(4px)" }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className={`grid gap-8 rounded-[1.5rem] bg-gradient-to-br ${TINT[cat.key]} p-6 ring-1 ring-line sm:p-10 lg:grid-cols-12`}
              >
                <div className="lg:col-span-7">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-teal-600 shadow-soft ring-1 ring-line">
                    <Icon className="h-7 w-7" strokeWidth={1.5} aria-hidden />
                  </span>
                  <h3 className="mt-6 text-2xl font-semibold text-navy-900 sm:text-3xl">{cat.title}</h3>
                  <p className="mt-3 max-w-xl text-lg leading-relaxed text-ink-muted">{cat.body}</p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {cat.links.map((l) => (
                      <Link key={l.href} href={l.href} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-navy-900 ring-1 ring-line transition hover:ring-teal-500/50">
                        {l.label}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col justify-between gap-6 lg:col-span-5">
                  <div className="rounded-2xl bg-white/80 p-6 ring-1 ring-line">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{whoForLabel}</p>
                    <ul className="mt-4 space-y-3">
                      {cat.whoFor.map((w) => (
                        <li key={w} className="flex gap-3 text-[0.95rem] text-ink-soft">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" aria-hidden />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Link href={cat.exploreHref} className="group inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-navy-900 px-5 text-sm font-semibold text-white transition hover:bg-navy-700">
                      {exploreLabel} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    <a href={cat.whatsappHref} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-navy-900 ring-1 ring-line transition hover:ring-[#1FAF5A]">
                      <WhatsAppIcon className="h-4 w-4 text-[#1FAF5A]" /> {whatsappLabel}
                    </a>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
