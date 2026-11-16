import Image from "next/image";
import { LifeBuoy, Lock, MessageCircle, Plus } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { ServiceCard } from "@/components/site/cards";
import { Reveal } from "@/components/motion";
import { WhatsAppIcon } from "@/components/icons";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { clinicWhatsApp, getCollection } from "@/lib/content/repo";
import { localePath, t } from "@/lib/i18n";
import { pageMeta, resolveLang } from "@/lib/page";
import { whatsappLink } from "@/lib/whatsapp";

const COPY = {
  ms: {
    title: "Kesihatan mental ialah kesihatan juga.",
    intro: "Ruang yang tenang dan sulit untuk bercakap tentang mood, kebimbangan, tidur dan tekanan hidup — bersama doktor yang mendengar.",
    steps: [
      ["Saringan percuma (pilihan)", "Isi PHQ-9 dan GAD-7 dalam talian untuk memahami simptom anda."],
      ["Konsultasi sulit", "Berbincang dengan doktor tanpa tergesa-gesa dan tanpa menghakimi."],
      ["Pelan bersama", "Sokongan, rawatan atau rujukan yang sesuai — dipersetujui bersama anda."],
    ],
    stepsTitle: "Bagaimana ia berfungsi",
    privacy: "Maklumat kesihatan mental anda dilindungi di bawah kerahsiaan perubatan dan Akta Perlindungan Data Peribadi 2010.",
    crisisTitle: "Perlukan bantuan segera?",
    crisis: "Jika anda atau seseorang dalam bahaya segera, hubungi 999 atau pergi ke Jabatan Kecemasan hospital terdekat. Talian HEAL 15555 menyediakan sokongan kesihatan mental.",
  },
  en: {
    title: "Mental health is health too.",
    intro: "A calm, confidential space to talk about mood, worry, sleep and life stress — with a doctor who listens.",
    steps: [
      ["Free screening (optional)", "Complete the PHQ-9 and GAD-7 online to understand your symptoms."],
      ["Confidential consultation", "Talk with a doctor, unhurried and without judgement."],
      ["A plan, together", "Suitable support, treatment or referral — agreed with you."],
    ],
    stepsTitle: "How it works",
    privacy: "Your mental health information is protected by medical confidentiality and the Personal Data Protection Act 2010.",
    crisisTitle: "Need urgent help?",
    crisis: "If you or someone else is in immediate danger, call 999 or go to the nearest hospital Emergency Department. HEAL 15555 offers mental health support.",
  },
} as const;

export async function generateMetadata({ params }: PageProps<"/[lang]/mental-health">) {
  const { lang, dict } = await resolveLang(params);
  return pageMeta(lang, "/mental-health", dict.nav.mentalHealth, COPY[lang].intro);
}

export default async function MentalHealth({ params }: PageProps<"/[lang]/mental-health">) {
  const { lang, dict } = await resolveLang(params);
  const c = COPY[lang];
  const p = (path: string) => localePath(lang, path);
  const [services, faqs] = await Promise.all([getCollection("services"), getCollection("faqs")]);
  const mental = services.filter((s) => s.group === "mental");
  const wa = whatsappLink(clinicWhatsApp(), "mental", lang);

  return (
    <>
      <PageHero eyebrow={dict.nav.mentalHealth} title={c.title} intro={c.intro} tone="lilac">
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={p("/screening")} variant="primary" size="lg" arrow>{dict.cta.screening}</ButtonLink>
          <ButtonLink href={wa} external variant="outline" size="lg"><WhatsAppIcon className="h-5 w-5 text-[#1FAF5A]" />{dict.contact.topics.mental}</ButtonLink>
        </div>
      </PageHero>

      <section className="py-16 sm:py-24">
        <div className="container-page">
          <SectionHeading eyebrow="01 — 03" title={c.stepsTitle} />
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {c.steps.map(([title, body], i) => (
              <Reveal as="li" key={title} delay={i * 0.1} className="relative rounded-[1.75rem] bg-white p-8 ring-1 ring-line">
                <span className="font-display text-6xl italic text-teal-500/70">{i + 1}</span>
                <h3 className="mt-4 text-xl font-semibold text-navy-900">{title}</h3>
                <p className="mt-2 text-ink-muted">{body}</p>
              </Reveal>
            ))}
          </ol>
          <p className="mt-8 inline-flex items-start gap-2 text-sm text-ink-muted"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />{c.privacy}</p>
        </div>
      </section>

      <section className="bg-[#eceefb]/60 py-16 sm:py-24">
        <div className="container-page">
          <SectionHeading eyebrow={dict.services.eyebrow} title={dict.services.groups.mental} />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {mental.map((s, i) => <ServiceCard key={s.slug} service={s} lang={lang} index={i} href={p(`/services/${s.slug}`)} />)}
          </div>
        </div>
      </section>

      {faqs.length > 0 && (
        <section className="py-16 sm:py-24">
          <div className="container-page grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <SectionHeading eyebrow={dict.insights.faqs} title={<MessageCircle className="h-10 w-10 text-teal-500" />} />
            </div>
            <div className="divide-y divide-line rounded-3xl bg-white ring-1 ring-line lg:col-span-8">
              {faqs.map((f) => (
                <details key={f.slug} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-navy-900">
                    {t(f.q, lang)}
                    <Plus className="h-5 w-5 shrink-0 text-teal-600 transition-transform duration-300 group-open:rotate-45" />
                  </summary>
                  <p className="mt-3 leading-relaxed text-ink-muted">{t(f.a, lang)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="pb-16">
        <div className="container-page grid gap-5 lg:grid-cols-2">
          <Reveal className="rounded-[1.75rem] border border-danger/20 bg-danger-soft p-8">
            <LifeBuoy className="h-8 w-8 text-danger" />
            <h2 className="mt-4 text-2xl font-semibold text-navy-900">{c.crisisTitle}</h2>
            <p className="mt-2 text-ink-soft">{c.crisis}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="tel:999" className="inline-flex h-11 items-center rounded-full bg-danger px-5 text-sm font-semibold text-white">999</a>
              <a href="tel:15555" className="inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-navy-900 ring-1 ring-line">HEAL 15555</a>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="flex items-center gap-6 rounded-[1.75rem] bg-[#fffbe6] p-8 ring-1 ring-[#f2d21b]/40">
            <div className="relative aspect-[914/1280] w-24 shrink-0 overflow-hidden rounded-md shadow-lift">
              <Image src="/images/book-dr-saya-boleh-sembuh-ke.jpg" alt={dict.book.title} fill sizes="6rem" className="object-cover" />
            </div>
            <div>
              <p className="eyebrow">{dict.book.eyebrow}</p>
              <p className="mt-2 text-xl font-semibold text-navy-900">{dict.book.title}</p>
              <ButtonLink href={p("/book")} variant="ghost" arrow className="-ml-5 mt-2">{dict.cta.learnMore}</ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
