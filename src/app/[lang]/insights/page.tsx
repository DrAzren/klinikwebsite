import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Plus } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { VideoEmbed } from "@/components/site/video-embed";
import { FacebookIcon, InstagramIcon, TiktokIcon, YoutubeIcon } from "@/components/icons";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { getCollection, getSettings } from "@/lib/content/repo";
import { localePath, t } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { pageMeta, resolveLang } from "@/lib/page";
import { env } from "@/lib/env";

export async function generateMetadata({ params }: PageProps<"/[lang]/insights">) {
  const { lang, dict } = await resolveLang(params);
  return pageMeta(lang, "/insights", dict.nav.insights, dict.insights.intro);
}

export default async function Insights({ params }: PageProps<"/[lang]/insights">) {
  const { lang, dict } = await resolveLang(params);
  const p = (path: string) => localePath(lang, path);
  const [articles, faqs, videos, events, settings] = await Promise.all([
    getCollection("articles"), getCollection("faqs"), getCollection("videos"), getCollection("events"), getSettings(),
  ]);
  const sorted = [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const social = [
    { href: settings.social?.instagram, label: "Instagram", Icon: InstagramIcon },
    { href: settings.social?.youtube, label: "YouTube", Icon: YoutubeIcon },
    { href: settings.social?.tiktok, label: "TikTok", Icon: TiktokIcon },
    { href: settings.social?.facebook, label: "Facebook", Icon: FacebookIcon },
  ].filter((s) => s.href);

  return (
    <>
      <PageHero eyebrow={dict.insights.eyebrow} title={dict.insights.title} intro={dict.insights.intro}>
        <nav className="flex flex-wrap gap-2">
          {[["articles", dict.insights.articles], ["faqs", dict.insights.faqs], ["spread-positivity", dict.insights.spread], ["events", dict.insights.events]].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-navy-900 ring-1 ring-line hover:ring-teal-500">{label}</a>
          ))}
        </nav>
      </PageHero>

      <section id="articles" className="scroll-mt-28 py-12 sm:py-16">
        <div className="container-page">
          <h2 className="text-3xl font-semibold text-navy-900">{dict.insights.articles}</h2>
          <Stagger className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {sorted.map((a, i) => (
              <StaggerItem key={a.slug} className={i === 0 ? "md:col-span-2 lg:col-span-2" : ""}>
                <Link href={p(`/insights/${a.slug}`)} className={`group flex h-full flex-col rounded-[1.75rem] p-7 ring-1 ring-line transition hover:shadow-lift ${i === 0 ? "bg-navy-900 text-white sm:p-10" : "bg-white"}`}>
                  <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${i === 0 ? "text-teal-400" : "text-teal-600"}`}>{t(a.category, lang)} · {a.readMinutes} {dict.insights.minutes}</p>
                  <h3 className={`mt-4 font-semibold leading-snug ${i === 0 ? "text-3xl sm:text-4xl" : "text-xl text-navy-900"}`}>{t(a.title, lang)}</h3>
                  <p className={`mt-3 flex-1 leading-relaxed ${i === 0 ? "text-navy-100/80" : "text-ink-muted"}`}>{t(a.excerpt, lang)}</p>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">{dict.cta.readMore}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
          <p className="mt-6 text-sm text-ink-muted">{dict.insights.disclaimer}</p>
        </div>
      </section>

      {faqs.length > 0 && (
        <section id="faqs" className="scroll-mt-28 bg-[#eceefb]/50 py-16 sm:py-24">
          <div className="container-page max-w-4xl">
            <SectionHeading eyebrow={dict.insights.faqs} title={dict.insights.faqs} />
            <div className="mt-10 divide-y divide-line rounded-3xl bg-white ring-1 ring-line">
              {faqs.map((f) => (
                <details key={f.slug} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-navy-900">
                    {t(f.q, lang)}<Plus className="h-5 w-5 shrink-0 text-teal-600 transition-transform group-open:rotate-45" />
                  </summary>
                  <p className="mt-3 leading-relaxed text-ink-muted">{t(f.a, lang)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      <section id="spread-positivity" className="scroll-mt-28 py-16 sm:py-24">
        <div className="container-page">
          <Reveal className="grid items-center gap-10 overflow-hidden rounded-[2rem] bg-navy-900 p-6 text-white sm:p-12 lg:grid-cols-12">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] lg:col-span-4">
              <Image src="/images/dr-azren.jpg" alt="Dr Azren" fill sizes="(min-width:1024px) 30vw, 100vw" className="object-cover object-top" />
            </div>
            <div className="lg:col-span-8">
              <p className="eyebrow !text-teal-400">{dict.insights.spread}</p>
              <p className="mt-5 font-display text-3xl leading-snug sm:text-4xl">{dict.insights.spreadBody}</p>
              {social.length > 0 && (
                <div className="mt-8 flex flex-wrap gap-3">
                  {social.map(({ href, label, Icon }) => (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-semibold ring-1 ring-white/20 hover:bg-white/15">
                      <Icon className="h-4 w-4" />{dict.insights.follow} · {label}
                    </a>
                  ))}
                </div>
              )}
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href={p("/book")} variant="teal" arrow>{dict.book.title}</ButtonLink>
                <ButtonLink href={env().BOOK_PURCHASE_URL} external variant="light">{dict.cta.buyBook}</ButtonLink>
              </div>
            </div>
          </Reveal>
          {videos.length > 0 && (
            <div className="mt-12">
              <h3 className="text-2xl font-semibold text-navy-900">{dict.insights.videos}</h3>
              <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {videos.map((v) => v.youtubeId ? (
                  <VideoEmbed key={v.slug} youtubeId={v.youtubeId} title={t(v.title, lang)} />
                ) : v.url ? (
                  <a key={v.slug} href={v.url} target="_blank" rel="noopener noreferrer" className="flex aspect-video items-center justify-center rounded-3xl bg-mint p-6 text-center font-semibold text-navy-900 ring-1 ring-line">{t(v.title, lang)} ↗</a>
                ) : null)}
              </div>
            </div>
          )}
        </div>
      </section>

      <section id="events" className="scroll-mt-28 pb-24 sm:pb-32">
        <div className="container-page">
          <h2 className="text-3xl font-semibold text-navy-900">{dict.insights.events}</h2>
          {events.length === 0 ? (
            <p className="mt-6 rounded-3xl bg-white p-8 text-ink-muted ring-1 ring-line">{dict.insights.noEvents}</p>
          ) : (
            <ul className="mt-8 grid gap-5 md:grid-cols-2">
              {events.map((e) => (
                <li key={e.slug} className="rounded-[1.75rem] bg-white p-7 ring-1 ring-line">
                  <p className="flex flex-wrap gap-4 text-sm text-ink-muted">
                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-teal-600" />{formatDate(e.date, lang)}</span>
                    {t(e.location, lang) && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-teal-600" />{t(e.location, lang)}</span>}
                  </p>
                  <h3 className="mt-4 text-xl font-semibold text-navy-900">{t(e.title, lang)}</h3>
                  <p className="mt-2 text-ink-muted">{t(e.description, lang)}</p>
                  {e.url && <a href={e.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-semibold text-teal-700 hover:underline">{dict.cta.learnMore} ↗</a>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
