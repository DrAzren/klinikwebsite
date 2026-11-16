import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Hero } from "@/components/site/hero";
import { HelpSelector, type HelpCategory } from "@/components/site/help-selector";
import { MindBodyBridge } from "@/components/site/mind-body-bridge";
import { DoctorCard, PanelMarquee, ServiceCard } from "@/components/site/cards";
import { Book3D } from "@/components/site/book-3d";
import { LocationSection } from "@/components/site/location";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ServiceIcon } from "@/components/icons";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { clinicWhatsApp, getCollection, getPublicPanels, getSettings } from "@/lib/content/repo";
import { localePath, t } from "@/lib/i18n";
import { pageMeta, resolveLang } from "@/lib/page";
import { whatsappLink } from "@/lib/whatsapp";
import { env } from "@/lib/env";

export async function generateMetadata({ params }: PageProps<"/[lang]">) {
  const { lang, dict } = await resolveLang(params);
  return { ...pageMeta(lang, "/", dict.meta.defaultTitle, dict.meta.defaultDescription), title: { absolute: dict.meta.defaultTitle } };
}

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang, dict } = await resolveLang(params);
  const p = (path: string) => localePath(lang, path);
  const [services, doctors, values, panels, articles, settings] = await Promise.all([
    getCollection("services"), getCollection("doctors"), getCollection("values"), getPublicPanels(), getCollection("articles"), getSettings(),
  ]);
  const wa = clinicWhatsApp();
  const byGroup = (g: string) => services.filter((s) => s.group === g);

  const categories: HelpCategory[] = (["gp", "mental", "weight"] as const).map((key) => {
    const group = byGroup(key);
    const featured = group.find((s) => s.featured) ?? group[0];
    return {
      key,
      label: dict.services.groups[key],
      title: featured ? t(featured.title, lang) : dict.services.groups[key],
      body: featured ? t(featured.explanation, lang) : "",
      whoFor: (featured?.whoBenefits ?? []).slice(0, 3).map((w) => t(w, lang)),
      links: group.filter((s) => s !== featured).slice(0, 4).map((s) => ({ label: t(s.title, lang), href: p(`/services/${s.slug}`) })),
      exploreHref: key === "gp" ? p("/services#gp") : key === "mental" ? p("/mental-health") : p("/weight-management"),
      whatsappHref: whatsappLink(wa, key, lang),
    };
  });

  const featured = services.filter((s) => s.featured).concat(services.filter((s) => !s.featured && s.group === "other")).slice(0, 4);

  return (
    <>
      <Hero
        eyebrow={dict.hero.eyebrow}
        lines={[dict.hero.line1, dict.hero.line2, dict.hero.line3]}
        sub={dict.hero.sub}
        chips={dict.hero.chips}
        bookLabel={dict.cta.book}
        bookHref={whatsappLink(wa, "general", lang)}
        screeningLabel={dict.cta.screening}
        screeningHref={p("/screening")}
        scrollLabel={dict.hero.scroll}
        videoSrc={process.env.NEXT_PUBLIC_HERO_VIDEO || undefined}
      />

      <HelpSelector
        eyebrow={dict.help.eyebrow}
        title={dict.help.title}
        whoForLabel={dict.help.whoFor}
        exploreLabel={dict.help.explore}
        whatsappLabel={dict.cta.whatsapp}
        categories={categories}
      />

      <MindBodyBridge eyebrow={dict.bridge.eyebrow} title={dict.bridge.title} body={dict.bridge.body} physical={dict.bridge.physical} mental={dict.bridge.mental} />

      {/* Scene 3 — floating service cards */}
      <section className="bg-mint/60 py-24 sm:py-32">
        <div className="container-page">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <SectionHeading eyebrow={dict.services.eyebrow} title={dict.services.title} intro={dict.services.intro} />
            <ButtonLink href={p("/services")} variant="outline" arrow>{dict.cta.viewAll}</ButtonLink>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((s, i) => (
              <ServiceCard key={s.slug} service={s} lang={lang} href={p(`/services/${s.slug}`)} index={i} float />
            ))}
          </div>
        </div>
      </section>

      {/* Scene 4 — doctors */}
      <section className="py-24 sm:py-32">
        <div className="container-page">
          <SectionHeading eyebrow={dict.doctors.eyebrow} title={dict.doctors.title} intro={dict.doctors.intro} />
          <div className="mt-14 grid gap-6 xl:grid-cols-2">
            {doctors.map((d, i) => (
              <DoctorCard key={d.slug} doctor={d} lang={lang} index={i} whatsappHref={whatsappLink(wa, d.whatsappTopic, lang)} labels={dict.doctors} />
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="relative overflow-hidden bg-navy-900 py-24 text-white sm:py-32">
        <div aria-hidden className="absolute -left-40 top-0 h-[30rem] w-[30rem] rounded-full bg-teal-500/15 blur-3xl" />
        <div className="container-page relative">
          <SectionHeading eyebrow={dict.values.eyebrow} title={dict.values.title} tone="light" />
          <Stagger className="mt-14 grid gap-px overflow-hidden rounded-[2rem] bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v) => (
              <StaggerItem key={v.slug} className="bg-navy-900 p-8">
                <ServiceIcon name={v.icon} className="h-7 w-7 text-teal-400" />
                <h3 className="mt-8 text-xl font-semibold">{t(v.title, lang)}</h3>
                <p className="mt-3 leading-relaxed text-navy-300">{t(v.body, lang)}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Screening promo */}
      <section className="py-24 sm:py-32">
        <div className="container-page">
          <Reveal className="grain relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-navy-700 via-navy-900 to-navy-950 p-8 text-white sm:p-14">
            <div aria-hidden className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(0,183,177,0.45),transparent_65%)]" />
            <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="eyebrow !text-teal-400">{dict.screening.eyebrow}</p>
                <h2 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">{dict.screening.title}</h2>
                <p className="mt-5 max-w-lg text-lg text-navy-100/80">{dict.screening.intro}</p>
                <p className="mt-4 inline-flex items-center gap-2 text-sm text-teal-200">
                  <ShieldCheck className="h-4 w-4" /> {dict.screening.notDiagnosis}
                </p>
              </div>
              <div className="flex flex-col gap-4 lg:items-end">
                <div className="grid w-full max-w-md grid-cols-2 gap-3">
                  {[["PHQ-9", "0–27"], ["GAD-7", "0–21"]].map(([n, r]) => (
                    <div key={n} className="glass rounded-2xl p-5">
                      <p className="text-2xl font-semibold">{n}</p>
                      <p className="mt-1 text-sm text-navy-300">{r}</p>
                    </div>
                  ))}
                </div>
                <ButtonLink href={p("/screening")} variant="teal" size="lg" arrow className="w-full max-w-md">{dict.screening.startCta}</ButtonLink>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Scene 6 — panel marquee (confirmed panels only) */}
      {panels.length > 0 && (
        <section className="pb-24">
          <div className="container-page">
            <SectionHeading eyebrow={dict.panels.eyebrow} title={dict.panels.title} align="center" />
          </div>
          <div className="mt-10">
            <PanelMarquee panels={panels} unverifiedLabel={dict.panels.unverified} />
          </div>
          <p className="container-page mt-6 text-center text-sm text-ink-muted">
            <Link href={p("/panels")} className="font-semibold text-teal-700 underline-offset-4 hover:underline">{dict.cta.viewAll}</Link>
          </p>
        </section>
      )}

      {/* Scene 7 — book */}
      <section className="overflow-hidden bg-gradient-to-b from-[#fffbe6] to-paper py-24 sm:py-32">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <Book3D src="/images/book-dr-saya-boleh-sembuh-ke.jpg" alt={`${dict.book.title} — Dr Azren`} />
          <Reveal>
            <p className="eyebrow">{dict.book.eyebrow}</p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl">{dict.book.title}</h2>
            <p className="mt-3 font-display text-2xl italic text-ink-soft">{dict.book.subtitle}</p>
            <p className="mt-6 text-lg leading-relaxed text-ink-muted">{dict.book.synopsis}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={env().BOOK_PURCHASE_URL} external variant="primary" size="lg" arrow>{dict.cta.buyBook}</ButtonLink>
              <ButtonLink href={p("/book")} variant="ghost" size="lg">{dict.cta.learnMore}</ButtonLink>
            </div>
            <p className="mt-4 text-xs text-ink-muted">{dict.book.priceNote}</p>
          </Reveal>
        </div>
      </section>

      {/* Insights */}
      {articles.length > 0 && (
        <section className="py-24 sm:py-32">
          <div className="container-page">
            <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
              <SectionHeading eyebrow={dict.insights.eyebrow} title={dict.insights.title} />
              <ButtonLink href={p("/insights")} variant="outline" arrow>{dict.cta.viewAll}</ButtonLink>
            </div>
            <Stagger className="mt-14 grid gap-5 md:grid-cols-3">
              {articles.slice(0, 3).map((a) => (
                <StaggerItem key={a.slug}>
                  <Link href={p(`/insights/${a.slug}`)} className="group flex h-full flex-col rounded-[1.75rem] bg-white p-7 ring-1 ring-line transition hover:shadow-lift">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-600">{t(a.category, lang)}</p>
                    <h3 className="mt-4 text-xl font-semibold leading-snug text-navy-900">{t(a.title, lang)}</h3>
                    <p className="mt-3 flex-1 text-[0.95rem] leading-relaxed text-ink-muted">{t(a.excerpt, lang)}</p>
                    <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-navy-900">
                      {dict.cta.readMore} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>
      )}

      {/* Spread Positivity strip */}
      <section className="pb-8">
        <div className="container-page">
          <Reveal className="grid items-center gap-8 overflow-hidden rounded-[2rem] bg-mint p-6 ring-1 ring-line sm:p-10 md:grid-cols-[auto_1fr]">
            <div className="relative h-40 w-40 overflow-hidden rounded-full ring-4 ring-white sm:h-48 sm:w-48">
              <Image src="/images/dr-azren.jpg" alt="Dr Azren" fill sizes="12rem" className="object-cover object-top" />
            </div>
            <div>
              <p className="eyebrow">{dict.insights.spread}</p>
              <p className="mt-3 max-w-2xl font-display text-2xl leading-snug text-navy-900 sm:text-3xl">{dict.insights.spreadBody}</p>
              <ButtonLink href={p("/insights#spread-positivity")} variant="ghost" arrow className="mt-4 -ml-5">{dict.cta.learnMore}</ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>

      <LocationSection
        lang={lang}
        labels={dict.location}
        addressLines={settings.addressLines}
        mapQuery={settings.mapQuery}
        hours={settings.hours.map((h) => ({ label: t(h.label, lang), value: t(h.value, lang) }))}
        phone={settings.phone}
        email={settings.email}
      />
    </>
  );
}
