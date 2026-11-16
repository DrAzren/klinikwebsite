import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Reveal } from "@/components/motion";
import { ButtonLink } from "@/components/ui";
import { getItem } from "@/lib/content/repo";
import { SEED } from "@/lib/content/seed";
import { formatDate } from "@/lib/format";
import { LOCALES, localePath, t } from "@/lib/i18n";
import { renderMarkdown } from "@/lib/markdown";
import { pageMeta, resolveLang } from "@/lib/page";
import { env } from "@/lib/env";

export function generateStaticParams() {
  return LOCALES.flatMap((lang) => SEED.articles.map((a) => ({ lang, slug: a.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/insights/[slug]">) {
  const { lang } = await resolveLang(params);
  const { slug } = await params;
  const a = await getItem("articles", slug);
  if (!a) return {};
  return { ...pageMeta(lang, `/insights/${slug}`, t(a.title, lang), t(a.excerpt, lang)), openGraph: { type: "article", title: t(a.title, lang), publishedTime: a.publishedAt } };
}

export default async function Article({ params }: PageProps<"/[lang]/insights/[slug]">) {
  const { lang, dict } = await resolveLang(params);
  const { slug } = await params;
  const a = await getItem("articles", slug);
  if (!a) notFound();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    headline: t(a.title, lang),
    description: t(a.excerpt, lang),
    datePublished: a.publishedAt,
    inLanguage: lang === "ms" ? "ms-MY" : "en-MY",
    publisher: { "@type": "MedicalClinic", name: "Klinik Nissa" },
    url: `${env().SITE_URL}${localePath(lang, `/insights/${slug}`)}`,
    ...(a.reviewedBy ? { reviewedBy: { "@type": "Person", name: a.reviewedBy } } : {}),
  };
  return (
    <article className="pb-24 pt-36 sm:pt-44">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="container-page max-w-3xl">
        <Link href={localePath(lang, "/insights")} className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:underline"><ArrowLeft className="h-4 w-4" />{dict.nav.insights}</Link>
        <Reveal>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-teal-600">{t(a.category, lang)} · {a.readMinutes} {dict.insights.minutes}</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl">{t(a.title, lang)}</h1>
          <p className="mt-5 text-xl leading-relaxed text-ink-muted">{t(a.excerpt, lang)}</p>
          <p className="mt-6 text-sm text-ink-muted">
            {formatDate(a.publishedAt, lang, { day: "numeric", month: "long", year: "numeric" })}
            {a.reviewedBy && <> · {dict.insights.reviewedBy} {a.reviewedBy}</>}
          </p>
        </Reveal>
        <div className="prose-clinic mt-10 border-t border-line pt-6" dangerouslySetInnerHTML={{ __html: renderMarkdown(t(a.body, lang)) }} />
        <aside className="mt-14 rounded-3xl bg-mint p-7">
          <p className="text-sm text-ink-soft">{dict.insights.disclaimer}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink href={localePath(lang, "/screening")} variant="primary" arrow>{dict.cta.screening}</ButtonLink>
            <ButtonLink href={localePath(lang, "/contact")} variant="outline">{dict.nav.contact}</ButtonLink>
          </div>
        </aside>
      </div>
    </article>
  );
}

/** Known slugs are prerendered via generateStaticParams; new CMS slugs render on demand. */
export const instant = false;
