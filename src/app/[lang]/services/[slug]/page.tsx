import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, CircleDot, Plus } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { ServiceCard } from "@/components/site/cards";
import { Reveal } from "@/components/motion";
import { WhatsAppIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui";
import { clinicWhatsApp, getCollection, getItem } from "@/lib/content/repo";
import { SEED } from "@/lib/content/seed";
import { LOCALES, localePath, t } from "@/lib/i18n";
import { pageMeta, resolveLang } from "@/lib/page";
import { whatsappLink } from "@/lib/whatsapp";

export function generateStaticParams() {
  return LOCALES.flatMap((lang) => SEED.services.map((s) => ({ lang, slug: s.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/services/[slug]">) {
  const { lang } = await resolveLang(params);
  const { slug } = await params;
  const s = await getItem("services", slug);
  if (!s) return {};
  return pageMeta(lang, `/services/${slug}`, t(s.title, lang), t(s.summary, lang));
}

export default async function ServicePage({ params }: PageProps<"/[lang]/services/[slug]">) {
  const { lang, dict } = await resolveLang(params);
  const { slug } = await params;
  const service = await getItem("services", slug);
  if (!service) notFound();
  const related = (await getCollection("services")).filter((s) => s.group === service.group && s.slug !== slug).slice(0, 3);
  const wa = whatsappLink(clinicWhatsApp(), service.whatsappTopic, lang);
  const p = (path: string) => localePath(lang, path);

  return (
    <>
      <PageHero eyebrow={dict.services.groups[service.group]} title={t(service.title, lang)} intro={t(service.summary, lang)} tone={service.group === "mental" ? "lilac" : "mint"}>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={wa} external variant="whatsapp" size="lg"><WhatsAppIcon className="h-5 w-5" />{dict.services.askWhatsApp}</ButtonLink>
          <ButtonLink href={p("/services")} variant="ghost" size="lg"><ArrowLeft className="h-4 w-4" />{dict.nav.services}</ButtonLink>
        </div>
      </PageHero>

      <section className="py-16 sm:py-20">
        <div className="container-page grid gap-12 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <p className="text-xl leading-relaxed text-ink-soft sm:text-2xl">{t(service.explanation, lang)}</p>

            {service.faqs.length > 0 && (
              <div className="mt-14">
                <h2 className="text-2xl font-semibold text-navy-900">{dict.services.faq}</h2>
                <div className="mt-6 divide-y divide-line rounded-3xl bg-white ring-1 ring-line">
                  {service.faqs.map((f) => (
                    <details key={t(f.q, lang)} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-navy-900">
                        {t(f.q, lang)}
                        <Plus className="h-5 w-5 shrink-0 text-teal-600 transition-transform duration-300 group-open:rotate-45" />
                      </summary>
                      <p className="mt-3 leading-relaxed text-ink-muted">{t(f.a, lang)}</p>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </Reveal>

          <div className="space-y-5 lg:col-span-5">
            {service.whoBenefits.length > 0 && (
              <Reveal delay={0.1} className="rounded-[1.75rem] bg-white p-7 ring-1 ring-line">
                <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{dict.services.whoBenefits}</h2>
                <ul className="mt-5 space-y-3">
                  {service.whoBenefits.map((w) => (
                    <li key={t(w, lang)} className="flex gap-3 text-ink-soft"><Check className="mt-1 h-4 w-4 shrink-0 text-teal-500" />{t(w, lang)}</li>
                  ))}
                </ul>
              </Reveal>
            )}
            {service.expect.length > 0 && (
              <Reveal delay={0.18} className="rounded-[1.75rem] bg-navy-900 p-7 text-white">
                <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-navy-300">{dict.services.whatToExpect}</h2>
                <ol className="mt-5 space-y-4">
                  {service.expect.map((w, i) => (
                    <li key={t(w, lang)} className="flex gap-4">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-sm font-semibold text-teal-300">{i + 1}</span>
                      <span className="text-navy-100">{t(w, lang)}</span>
                    </li>
                  ))}
                </ol>
              </Reveal>
            )}
            <p className="flex gap-2 px-2 text-sm text-ink-muted"><CircleDot className="mt-0.5 h-4 w-4 shrink-0" />{dict.services.scopeNote}</p>
          </div>
        </div>
      </section>

      {service.group === "mental" && (
        <section className="pb-8">
          <div className="container-page">
            <div className="flex flex-col items-start justify-between gap-6 rounded-[1.75rem] bg-[#eceefb] p-8 sm:flex-row sm:items-center">
              <p className="max-w-xl text-lg text-navy-900">{dict.screening.intro}</p>
              <ButtonLink href={p("/screening")} variant="primary" arrow>{dict.screening.startCta}</ButtonLink>
            </div>
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="py-16 sm:py-24">
          <div className="container-page">
            <h2 className="text-2xl font-semibold text-navy-900">{dict.services.groups[service.group]}</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((s) => <ServiceCard key={s.slug} service={s} lang={lang} href={p(`/services/${s.slug}`)} />)}
            </div>
            <Link href={p("/services")} className="mt-8 inline-block text-sm font-semibold text-teal-700 hover:underline">{dict.cta.viewAll} →</Link>
          </div>
        </section>
      )}
    </>
  );
}
