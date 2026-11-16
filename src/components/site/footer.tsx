import Link from "next/link";
import { Lock, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "../logo";
import { FacebookIcon, InstagramIcon, TiktokIcon, WhatsAppIcon, YoutubeIcon } from "../icons";
import { localePath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n";
import type { SiteSettings } from "@/lib/content/types";
import { cacheLife } from "next/cache";
import { formatPhone } from "@/lib/format";

async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

export function SiteFooter({ lang, dict, settings, whatsappHref }: { lang: Locale; dict: Dictionary; settings: SiteSettings; whatsappHref: string }) {
  const p = (path: string) => localePath(lang, path);
  const social = [
    { href: settings.social?.instagram, label: "Instagram", Icon: InstagramIcon },
    { href: settings.social?.facebook, label: "Facebook", Icon: FacebookIcon },
    { href: settings.social?.tiktok, label: "TikTok", Icon: TiktokIcon },
    { href: settings.social?.youtube, label: "YouTube", Icon: YoutubeIcon },
  ].filter((s) => s.href);
  const cols = [
    {
      title: dict.footer.care,
      links: [
        [p("/services"), dict.nav.services], [p("/mental-health"), dict.nav.mentalHealth], [p("/weight-management"), dict.nav.weight],
        [p("/screening"), dict.nav.screening], [p("/panels"), dict.nav.panels],
      ],
    },
    {
      title: dict.footer.clinic,
      links: [
        [p("/about"), dict.nav.about], [p("/doctors"), dict.nav.doctors], [p("/insights"), dict.nav.insights],
        [p("/book"), dict.nav.book], [p("/careers"), dict.nav.careers], [p("/contact"), dict.nav.contact],
      ],
    },
  ];

  return (
    <footer className="relative overflow-hidden bg-navy-950 text-navy-300">
      <div aria-hidden className="pointer-events-none absolute -top-40 right-[-10%] h-[28rem] w-[28rem] rounded-full bg-teal-500/10 blur-3xl" />
      <div className="container-page relative grid gap-12 py-16 md:grid-cols-12 md:py-20">
        <div className="md:col-span-4">
          <Logo tone="light" logoUrl={settings.logoUrl} />
          <p className="mt-6 max-w-xs font-display text-2xl italic leading-snug text-white">{dict.footer.tagline}</p>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-[#1FAF5A] px-5 text-sm font-semibold text-white transition hover:bg-[#199a4f]">
            <WhatsAppIcon className="h-4 w-4" /> {dict.cta.whatsapp}
          </a>
          {social.length > 0 && (
            <div className="mt-6 flex gap-2">
              {social.map(({ href, label, Icon }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="inline-flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-white/15 transition hover:bg-white/10 hover:text-white">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title} className="md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white">{c.title}</p>
            <ul className="mt-5 space-y-3 text-sm">
              {c.links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="transition hover:text-white">{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div className="md:col-span-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white">{dict.location.title}</p>
          <ul className="mt-5 space-y-4 text-sm">
            <li className="flex gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" aria-hidden />
              <address className="not-italic leading-relaxed">{settings.addressLines.join(", ")}</address>
            </li>
            <li className="flex gap-3">
              <Phone className="h-4 w-4 shrink-0 text-teal-400" aria-hidden />
              <a href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`} className="hover:text-white">{formatPhone(settings.phone)}</a>
            </li>
            {settings.email && (
              <li className="flex gap-3">
                <Mail className="h-4 w-4 shrink-0 text-teal-400" aria-hidden />
                <a href={`mailto:${settings.email}`} className="hover:text-white">{settings.email}</a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© <CopyrightYear /> {settings.clinicName}. {dict.footer.rights}</p>
          <p className="text-navy-300/80">{dict.footer.emergency}</p>
          <div className="flex items-center gap-5">
            <Link href={p("/privacy")} className="hover:text-white">{dict.footer.legal}</Link>
            <Link href={p("/privacy#disclaimer")} className="hover:text-white">{dict.footer.disclaimer}</Link>
            <Link href="/staff/login" className="inline-flex items-center gap-1.5 hover:text-white"><Lock className="h-3 w-3" />{dict.nav.staff}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
