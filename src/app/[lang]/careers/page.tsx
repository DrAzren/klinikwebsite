import { Check } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { CareersForm } from "@/components/site/careers-form";
import { Reveal } from "@/components/motion";
import { getCollection } from "@/lib/content/repo";
import { localePath, t } from "@/lib/i18n";
import { pageMeta, resolveLang } from "@/lib/page";

export async function generateMetadata({ params }: PageProps<"/[lang]/careers">) {
  const { lang, dict } = await resolveLang(params);
  return pageMeta(lang, "/careers", dict.nav.careers, dict.careers.intro);
}

export default async function Careers({ params }: PageProps<"/[lang]/careers">) {
  const { lang, dict } = await resolveLang(params);
  const d = dict.careers;
  const jobs = await getCollection("jobs");
  const positions = [...jobs.map((j) => ({ value: j.slug, label: t(j.title, lang) })), { value: "general", label: d.general }];

  return (
    <>
      <PageHero eyebrow={d.eyebrow} title={d.title} intro={d.intro} />
      <section className="pb-24 sm:pb-32">
        <div className="container-page grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <h2 className="text-2xl font-semibold text-navy-900">{d.open}</h2>
            {jobs.length === 0 ? (
              <p className="mt-6 rounded-[1.75rem] bg-white p-7 text-ink-muted ring-1 ring-line">{d.none}</p>
            ) : (
              <div className="mt-6 space-y-5">
                {jobs.map((j, i) => (
                  <Reveal key={j.slug} delay={i * 0.06} as="article" className="rounded-[1.75rem] bg-white p-7 ring-1 ring-line">
                    <p className="text-sm font-semibold text-teal-700">{t(j.type, lang)}</p>
                    <h3 className="mt-2 text-2xl font-semibold text-navy-900">{t(j.title, lang)}</h3>
                    <p className="mt-3 text-ink-muted">{t(j.summary, lang)}</p>
                    <div className="mt-6 grid gap-6 sm:grid-cols-2">
                      {[[d.responsibilities, j.responsibilities], [d.requirements, j.requirements]].map(([label, list]) => (
                        <div key={label as string}>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{label as string}</p>
                          <ul className="mt-3 space-y-2">
                            {(list as typeof j.requirements).map((x) => <li key={t(x, lang)} className="flex gap-2 text-sm text-ink-soft"><Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />{t(x, lang)}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </Reveal>
                ))}
              </div>
            )}
          </div>
          <div className="lg:col-span-6">
            <CareersForm d={d} positions={positions} privacyHref={localePath(lang, "/privacy#careers")} />
          </div>
        </div>
      </section>
    </>
  );
}
