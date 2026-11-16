"use client";

/**
 * Scene 8 — Location guide. An animated route line leads to an accurate
 * Google Maps embed that only loads after the visitor asks for it (no
 * third-party requests by default). Directions open in Google Maps / Waze.
 */
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Clock, Mail, MapPin, Navigation, Phone } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import { formatPhone } from "@/lib/format";

interface Props {
  lang: Locale;
  labels: { eyebrow: string; title: string; address: string; hours: string; hoursFallback: string; phone: string; email: string; loadMap: string; mapNote: string; waze: string; google: string };
  addressLines: string[];
  mapQuery: string;
  hours: { label: string; value: string }[];
  phone: string;
  email?: string;
}

export function LocationSection({ lang, labels, addressLines, mapQuery, hours, phone, email }: Props) {
  const [mapOn, setMapOn] = useState(false);
  const reduce = useReducedMotion();
  const q = encodeURIComponent(mapQuery);
  const gmaps = `https://www.google.com/maps/search/?api=1&query=${q}`;
  const waze = `https://waze.com/ul?q=${q}&navigate=yes`;
  const embed = `https://www.google.com/maps?q=${q}&output=embed&hl=${lang}`;

  return (
    <section className="py-24 sm:py-32" aria-labelledby="location-title">
      <div className="container-page grid items-stretch gap-6 lg:grid-cols-12">
        <div className="flex flex-col rounded-[2rem] bg-navy-900 p-8 text-white sm:p-10 lg:col-span-5">
          <p className="eyebrow !text-teal-400">{labels.eyebrow}</p>
          <h2 id="location-title" className="mt-4 text-4xl font-semibold">{labels.title}</h2>
          <dl className="mt-10 space-y-7 text-navy-100">
            <div className="flex gap-4">
              <MapPin className="mt-1 h-5 w-5 shrink-0 text-teal-400" aria-hidden />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-navy-300">{labels.address}</dt>
                <dd className="mt-1.5 leading-relaxed"><address className="not-italic">{addressLines.map((l) => <span key={l} className="block">{l}</span>)}</address></dd>
              </div>
            </div>
            <div className="flex gap-4">
              <Clock className="mt-1 h-5 w-5 shrink-0 text-teal-400" aria-hidden />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-navy-300">{labels.hours}</dt>
                <dd className="mt-1.5">
                  {hours.length ? (
                    <ul className="space-y-1">{hours.map((h) => <li key={h.label} className="flex justify-between gap-6"><span>{h.label}</span><span className="text-white">{h.value}</span></li>)}</ul>
                  ) : (
                    <span className="text-navy-300">{labels.hoursFallback}</span>
                  )}
                </dd>
              </div>
            </div>
            <div className="flex gap-4">
              <Phone className="mt-1 h-5 w-5 shrink-0 text-teal-400" aria-hidden />
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-navy-300">{labels.phone}</dt>
                <dd className="mt-1.5"><a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="hover:text-white">{formatPhone(phone)}</a></dd>
              </div>
            </div>
            {email && (
              <div className="flex gap-4">
                <Mail className="mt-1 h-5 w-5 shrink-0 text-teal-400" aria-hidden />
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-navy-300">{labels.email}</dt>
                  <dd className="mt-1.5"><a href={`mailto:${email}`} className="hover:text-white">{email}</a></dd>
                </div>
              </div>
            )}
          </dl>
          <div className="mt-auto flex flex-col gap-3 pt-10 sm:flex-row lg:flex-col xl:flex-row">
            <a href={gmaps} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-teal-500 px-4 text-sm font-semibold text-navy-950 transition hover:bg-teal-400">
              <Navigation className="h-4 w-4" /> {labels.google}
            </a>
            <a href={waze} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/15">
              {labels.waze}
            </a>
          </div>
        </div>

        <div className="relative min-h-[24rem] overflow-hidden rounded-[2rem] bg-mint ring-1 ring-line lg:col-span-7">
          {mapOn ? (
            <iframe title={labels.title} src={embed} className="absolute inset-0 h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
          ) : (
            <>
              <svg aria-hidden viewBox="0 0 700 460" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
                <defs>
                  <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse">
                    <path d="M36 0H0V36" fill="none" stroke="#c9e2e2" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="700" height="460" fill="url(#grid)" />
                <path d="M-20 330 C 120 300, 160 380, 300 340 S 470 220, 560 250 S 690 200, 740 180" fill="none" stroke="#ffffff" strokeWidth="26" strokeLinecap="round" />
                <path d="M120 -20 C 160 120, 120 220, 220 300 S 330 470, 360 500" fill="none" stroke="#ffffff" strokeWidth="18" strokeLinecap="round" />
                <motion.path
                  d="M40 400 C 140 360, 200 330, 300 300 S 410 230, 452 212"
                  fill="none"
                  stroke="#00B7B1"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="1 12"
                  initial={reduce ? false : { pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 2.4, ease: [0.76, 0, 0.24, 1] }}
                />
              </svg>
              <motion.div
                className="absolute left-[64.5%] top-[46%] -translate-x-1/2 -translate-y-full"
                initial={reduce ? false : { y: -20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 2.2, type: "spring", stiffness: 260, damping: 18 }}
              >
                <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-navy-900 text-teal-400 shadow-lift">
                  <MapPin className="h-6 w-6" />
                  <span className="absolute inset-0 animate-ping rounded-full bg-teal-500/30 motion-reduce:hidden" />
                </span>
              </motion.div>
              <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-white/95 via-white/80 to-transparent p-8 pt-20 text-center">
                <button type="button" onClick={() => setMapOn(true)} className="inline-flex h-12 items-center gap-2 rounded-full bg-navy-900 px-6 text-sm font-semibold text-white shadow-soft transition hover:bg-navy-700">
                  <MapPin className="h-4 w-4 text-teal-400" /> {labels.loadMap}
                </button>
                <p className="text-xs text-ink-muted">{labels.mapNote}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
