/**
 * Scene 3 (floating service cards), Scene 4 (doctor entrance), Scene 6
 * (panel marquee) building blocks.
 */
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ServiceIcon, WhatsAppIcon } from "../icons";
import { TiltCard } from "../motion";
import { DoctorReveal } from "./doctor-reveal";
import { Badge } from "../ui";
import { t, type Locale } from "@/lib/i18n/config";
import type { Doctor, Panel, Service } from "@/lib/content/types";

export function ServiceCard({ service, href, lang, index = 0, float = false }: { service: Service; href: string; lang: Locale; index?: number; float?: boolean }) {
  return (
    <div className={float ? "motion-safe:animate-[float_7s_ease-in-out_infinite]" : undefined} style={float ? { animationDelay: `${index * -1.3}s` } : undefined}>
      <TiltCard className="group relative h-full rounded-[1.75rem]">
        <Link
          href={href}
          className="relative flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-white p-7 shadow-soft ring-1 ring-line transition-shadow duration-500 hover:shadow-lift"
        >
          <div aria-hidden className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-mint opacity-70 transition-transform duration-700 ease-out-expo group-hover:scale-150" />
          <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-900 text-teal-400">
            <ServiceIcon name={service.icon} className="h-6 w-6" />
          </span>
          <h3 className="relative mt-8 text-xl font-semibold text-navy-900">{t(service.title, lang)}</h3>
          <p className="relative mt-2 flex-1 text-[0.95rem] leading-relaxed text-ink-muted">{t(service.summary, lang)}</p>
          <span className="relative mt-6 inline-flex h-10 w-10 items-center justify-center rounded-full bg-paper text-navy-900 ring-1 ring-line transition-all duration-500 group-hover:bg-teal-500 group-hover:text-navy-950 group-hover:ring-teal-500">
            <ArrowUpRight className="h-4 w-4 transition-transform duration-500 group-hover:rotate-45" />
          </span>
        </Link>
      </TiltCard>
    </div>
  );
}

export function DoctorCard({ doctor, lang, labels, whatsappHref, index = 0 }: {
  doctor: Doctor; lang: Locale; index?: number; whatsappHref: string;
  labels: { interests: string; qualifications: string; consult: string; photoPending: string };
}) {
  const initials = doctor.shortName.replace(/^Dr\.?\s*/i, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <DoctorReveal index={index} className="@container group overflow-hidden rounded-[2rem] bg-white shadow-soft ring-1 ring-line">
      <div className="grid h-full @2xl:grid-cols-5">
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-navy-700 via-navy-900 to-navy-950 @2xl:col-span-2 @2xl:aspect-auto @2xl:min-h-[26rem]">
        {doctor.photo ? (
          <Image
            src={doctor.photo}
            alt={t(doctor.photoAlt, lang) || doctor.name}
            fill
            sizes="(min-width: 1280px) 40vw, 100vw"
            className="doctor-photo object-cover object-top transition-transform duration-[1.6s] ease-out-expo group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/80">
            <div className="flex h-28 w-28 items-center justify-center rounded-full font-display text-5xl ring-1 ring-white/20">{initials}</div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">{labels.photoPending}</p>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-navy-950/60 to-transparent" />
      </div>
      <div className="flex flex-col p-7 sm:p-9 @2xl:col-span-3">
        <p className="eyebrow">{t(doctor.title, lang)}</p>
        <h3 className="mt-3 text-3xl font-semibold text-navy-900">{doctor.shortName}</h3>
        {doctor.name !== doctor.shortName && <p className="mt-1 text-sm text-ink-muted">{doctor.name}</p>}
        {doctor.qualifications && (
          <p className="mt-4 text-sm">
            <span className="font-semibold text-navy-900">{labels.qualifications}: </span>
            <span className="text-ink-soft">{doctor.qualifications}</span>
          </p>
        )}
        <p className="mt-5 leading-relaxed text-ink-soft">{t(doctor.bio, lang)}</p>
        {doctor.interests.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{labels.interests}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {doctor.interests.map((i) => (
                <Badge key={t(i, lang)}>{t(i, lang)}</Badge>
              ))}
            </div>
          </div>
        )}
        <div className="mt-auto pt-8">
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-full bg-navy-900 px-6 text-sm font-semibold text-white transition hover:bg-navy-700">
            <WhatsAppIcon className="h-4 w-4 text-teal-400" />
            {labels.consult} {doctor.shortName}
          </a>
        </div>
      </div>
      </div>
    </DoctorReveal>
  );
}

export function PanelMarquee({ panels, unverifiedLabel }: { panels: (Panel & { demo?: boolean })[]; unverifiedLabel: string }) {
  if (panels.length === 0) return null;
  const row = [...panels, ...panels];
  const anyDemo = panels.some((p) => p.demo);
  return (
    <div className="relative">
      {anyDemo && (
        <p className="mb-4 text-center">
          <Badge tone="warn">{unverifiedLabel}</Badge>
        </p>
      )}
      <div className="mask-fade-x group overflow-hidden py-2">
        <ul className="flex w-max animate-marquee gap-4 [--marquee-duration:48s] group-hover:[animation-play-state:paused] motion-reduce:w-auto motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:justify-center">
          {row.map((p, i) => (
            <li
              key={`${p.slug}-${i}`}
              aria-hidden={i >= panels.length}
              className={`flex h-20 min-w-44 items-center justify-center rounded-2xl bg-white px-8 ring-1 ring-line ${i >= panels.length ? "motion-reduce:hidden" : ""}`}
            >
              {p.logoUrl ? (
                <Image src={p.logoUrl} alt={p.name} width={120} height={40} className="h-9 w-auto object-contain opacity-80 grayscale transition hover:opacity-100 hover:grayscale-0" />
              ) : (
                <span className="text-lg font-semibold tracking-tight text-navy-700/80">{p.name}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
