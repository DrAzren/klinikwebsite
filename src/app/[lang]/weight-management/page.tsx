import { PageHero } from "@/components/site/page-hero";
import { ServiceCard } from "@/components/site/cards";
import { BmiTool } from "@/components/site/bmi-tool";
import { Reveal } from "@/components/motion";
import { WhatsAppIcon } from "@/components/icons";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { clinicWhatsApp, getCollection } from "@/lib/content/repo";
import { localePath } from "@/lib/i18n";
import { pageMeta, resolveLang } from "@/lib/page";
import { whatsappLink } from "@/lib/whatsapp";

const COPY = {
  ms: {
    title: "Pengurusan berat badan, dipimpin doktor.",
    intro: "Pendekatan perubatan yang realistik — memahami punca, menilai risiko kesihatan, dan membina perubahan yang boleh dikekalkan.",
    principles: [
      ["Tanpa menghakimi", "Berat badan dipengaruhi banyak faktor — genetik, tidur, tekanan, ubat dan persekitaran."],
      ["Berasaskan penilaian", "Setiap pelan bermula dengan penilaian perubatan, bukan pakej standard."],
      ["Keselamatan dahulu", "Sebarang pilihan rawatan dibincangkan dengan jelas termasuk risiko dan alternatif."],
    ],
    approach: "Pendekatan kami",
    note: "Kami tidak mengiklankan ubat preskripsi. Keputusan rawatan dibuat secara individu selepas penilaian klinikal.",
  },
  en: {
    title: "Weight management, led by a doctor.",
    intro: "A realistic medical approach — understanding causes, assessing health risks, and building changes you can keep.",
    principles: [
      ["No judgement", "Weight is shaped by many factors — genetics, sleep, stress, medicines and environment."],
      ["Assessment first", "Every plan starts with a medical assessment, not a standard package."],
      ["Safety first", "Any treatment option is discussed clearly, including risks and alternatives."],
    ],
    approach: "Our approach",
    note: "We do not advertise prescription medicines. Treatment decisions are made individually after clinical assessment.",
  },
} as const;

export async function generateMetadata({ params }: PageProps<"/[lang]/weight-management">) {
  const { lang, dict } = await resolveLang(params);
  return pageMeta(lang, "/weight-management", dict.nav.weight, COPY[lang].intro);
}

export default async function Weight({ params }: PageProps<"/[lang]/weight-management">) {
  const { lang, dict } = await resolveLang(params);
  const c = COPY[lang];
  const services = (await getCollection("services")).filter((s) => s.group === "weight");
  const wa = whatsappLink(clinicWhatsApp(), "weight", lang);
  const p = (path: string) => localePath(lang, path);

  return (
    <>
      <PageHero eyebrow={dict.nav.weight} title={c.title} intro={c.intro}>
        <ButtonLink href={wa} external variant="whatsapp" size="lg"><WhatsAppIcon className="h-5 w-5" />{dict.contact.topics.weight}</ButtonLink>
      </PageHero>

      <section className="py-16 sm:py-20">
        <div className="container-page grid items-start gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeading eyebrow={c.approach} title={c.approach} />
            <ul className="mt-10 space-y-8">
              {c.principles.map(([title, body], i) => (
                <Reveal as="li" key={title} delay={i * 0.08} className="border-l-2 border-teal-500 pl-6">
                  <h3 className="text-lg font-semibold text-navy-900">{title}</h3>
                  <p className="mt-1 text-ink-muted">{body}</p>
                </Reveal>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-7">
            <BmiTool lang={lang} />
          </div>
        </div>
      </section>

      <section className="bg-mint/60 py-16 sm:py-24">
        <div className="container-page">
          <SectionHeading eyebrow={dict.services.eyebrow} title={dict.services.groups.weight} />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s, i) => <ServiceCard key={s.slug} service={s} lang={lang} index={i} href={p(`/services/${s.slug}`)} />)}
          </div>
          <p className="mt-8 text-sm text-ink-muted">{c.note}</p>
        </div>
      </section>
    </>
  );
}
