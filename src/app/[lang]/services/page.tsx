import Link from "next/link";
import { PageHero } from "@/components/site/page-hero";
import { ServiceCard } from "@/components/site/cards";
import { Reveal } from "@/components/motion";
import { getCollection } from "@/lib/content/repo";
import { localePath } from "@/lib/i18n";
import { pageMeta, resolveLang } from "@/lib/page";

const GROUPS = ["gp", "mental", "weight", "other"] as const;

export async function generateMetadata({ params }: PageProps<"/[lang]/services">) {
  const { lang, dict } = await resolveLang(params);
  return pageMeta(lang, "/services", dict.nav.services, dict.services.intro);
}

export default async function Services({ params }: PageProps<"/[lang]/services">) {
  const { lang, dict } = await resolveLang(params);
  const services = await getCollection("services");
  const p = (path: string) => localePath(lang, path);

  return (
    <>
      <PageHero eyebrow={dict.services.eyebrow} title={dict.services.title} intro={dict.services.intro}>
        <nav aria-label={dict.services.eyebrow} className="flex flex-wrap gap-2">
          {GROUPS.map((g) => (
            <a key={g} href={`#${g}`} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-navy-900 ring-1 ring-line transition hover:ring-teal-500">
              {dict.services.groups[g]}
            </a>
          ))}
        </nav>
      </PageHero>
      {GROUPS.map((g, gi) => {
        const items = services.filter((s) => s.group === g);
        if (!items.length) return null;
        return (
          <section key={g} id={g} className={`scroll-mt-28 py-16 sm:py-20 ${gi % 2 === 1 ? "bg-mint/50" : ""}`}>
            <div className="container-page">
              <Reveal className="flex items-end justify-between gap-6">
                <h2 className="text-3xl font-semibold text-navy-900 sm:text-4xl">{dict.services.groups[g]}</h2>
                {g === "mental" && <Link href={p("/mental-health")} className="text-sm font-semibold text-teal-700 hover:underline">{dict.cta.learnMore} →</Link>}
                {g === "weight" && <Link href={p("/weight-management")} className="text-sm font-semibold text-teal-700 hover:underline">{dict.cta.learnMore} →</Link>}
              </Reveal>
              <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((s, i) => (
                  <ServiceCard key={s.slug} service={s} lang={lang} index={i} href={p(`/services/${s.slug}`)} />
                ))}
              </div>
            </div>
          </section>
        );
      })}
      <p className="container-page pb-20 text-sm text-ink-muted">{dict.services.scopeNote}</p>
    </>
  );
}
