import Image from "next/image";
import { PageHero } from "@/components/site/page-hero";
import { DoctorCard } from "@/components/site/cards";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { ServiceIcon } from "@/components/icons";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { clinicWhatsApp, getCollection, getSettings } from "@/lib/content/repo";
import { localePath, t } from "@/lib/i18n";
import { pageMeta, resolveLang } from "@/lib/page";
import { whatsappLink } from "@/lib/whatsapp";

// Draft copy for owner approval (see docs/CONTENT-VERIFICATION.md).
const COPY = {
  ms: {
    title: "Klinik komuniti untuk badan dan minda.",
    intro: "Klinik Nissa ialah klinik am dan kesihatan mental di Bandar Baru Nilai — tempat yang tenang untuk mendapatkan rawatan harian dan bercakap tentang perkara yang lebih berat.",
    missionLabel: "Misi",
    mission: "Menyediakan penjagaan kesihatan fizikal dan mental yang tenang, sulit dan mudah diakses untuk komuniti Nilai dan sekitarnya.",
    visionLabel: "Visi",
    vision: "Komuniti yang sihat badan dan minda — di mana mendapatkan bantuan kesihatan mental adalah perkara biasa, bukan sesuatu yang memalukan.",
    storyEyebrow: "Kisah kami",
    storyTitle: "Bermula dengan satu soalan: kenapa kesihatan mental perlu menunggu?",
    story: [
      "Ramai pesakit datang untuk demam atau tekanan darah, tetapi membawa beban lain yang tidak diluahkan — tidur yang terganggu, kebimbangan yang berpanjangan, atau rasa kosong yang sukar dijelaskan.",
      "Klinik Nissa dibina supaya kedua-duanya boleh dibincangkan di bilik yang sama, dengan doktor yang sama, tanpa stigma. Daripada konsultasi am hingga saringan kesihatan mental dan pengurusan berat badan, kami mahu setiap lawatan terasa dihargai dan difahami.",
    ],
    envEyebrow: "Persekitaran klinik",
    envTitle: "Direka untuk rasa tenang.",
    env: [
      ["shield", "Ruang konsultasi peribadi", "Perbualan anda kekal di dalam bilik."],
      ["heart", "Layanan mesra", "Pasukan yang menyambut anda dengan senyuman dan kesabaran."],
      ["sparkle", "Bersih & teratur", "Prosedur kebersihan dan kawalan jangkitan yang teliti."],
    ],
    galleryTitle: "Di dalam Klinik Nissa",
    team: "Doktor kami",
  },
  en: {
    title: "A community clinic for body and mind.",
    intro: "Klinik Nissa is a general practice and mental health clinic in Bandar Baru Nilai — a calm place for everyday care and for talking about the heavier things too.",
    missionLabel: "Mission",
    mission: "To provide calm, confidential and accessible physical and mental health care for the Nilai community and beyond.",
    visionLabel: "Vision",
    vision: "A community that is healthy in body and mind — where seeking mental health support is ordinary, not shameful.",
    storyEyebrow: "Our story",
    storyTitle: "It started with one question: why should mental health wait?",
    story: [
      "Many patients come in for a fever or blood pressure, but carry something else they don't mention — disrupted sleep, persistent worry, or an emptiness that's hard to explain.",
      "Klinik Nissa was built so both can be discussed in the same room, with the same doctor, without stigma. From general consultations to mental health screening and weight management, we want every visit to feel respected and understood.",
    ],
    envEyebrow: "Clinic environment",
    envTitle: "Designed to feel calm.",
    env: [
      ["shield", "Private consultation rooms", "Your conversation stays in the room."],
      ["heart", "Warm welcome", "A team that greets you with patience and a smile."],
      ["sparkle", "Clean & orderly", "Careful hygiene and infection-control routines."],
    ],
    galleryTitle: "Inside Klinik Nissa",
    team: "Our doctors",
  },
} as const;

export async function generateMetadata({ params }: PageProps<"/[lang]/about">) {
  const { lang, dict } = await resolveLang(params);
  return pageMeta(lang, "/about", dict.nav.about, COPY[lang].intro);
}

export default async function About({ params }: PageProps<"/[lang]/about">) {
  const { lang, dict } = await resolveLang(params);
  const c = COPY[lang];
  const [doctors, values, settings] = await Promise.all([getCollection("doctors"), getCollection("values"), getSettings()]);
  const wa = clinicWhatsApp();
  const gallery = settings.gallery ?? [];

  return (
    <>
      <PageHero eyebrow={dict.nav.about} title={c.title} intro={c.intro} />

      <section className="py-16 sm:py-24">
        <div className="container-page grid gap-5 md:grid-cols-2">
          {[[c.missionLabel, c.mission], [c.visionLabel, c.vision]].map(([label, text], i) => (
            <Reveal key={label} delay={i * 0.1} className={`rounded-[2rem] p-8 sm:p-12 ${i === 0 ? "bg-navy-900 text-white" : "bg-white ring-1 ring-line"}`}>
              <p className={`eyebrow ${i === 0 ? "!text-teal-400" : ""}`}>{label}</p>
              <p className={`mt-6 font-display text-3xl leading-snug sm:text-[2.2rem] ${i === 0 ? "text-white" : "text-navy-900"}`}>{text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="container-page grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeading eyebrow={c.storyEyebrow} title={c.storyTitle} />
          </div>
          <Reveal className="space-y-6 text-lg leading-relaxed text-ink-soft lg:col-span-6 lg:col-start-7">
            {c.story.map((para) => <p key={para}>{para}</p>)}
            <div className="flex items-center gap-4 pt-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-white">
                <Image src="/images/dr-azren.jpg" alt="Dr Azren" fill sizes="4rem" className="object-cover object-top" />
              </div>
              <div>
                <p className="font-semibold text-navy-900">Dr Azren</p>
                <p className="text-sm text-ink-muted">{lang === "ms" ? "Pengasas, Klinik Nissa" : "Founder, Klinik Nissa"}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-mint/60 py-20 sm:py-28">
        <div className="container-page">
          <SectionHeading eyebrow={c.envEyebrow} title={c.envTitle} />
          <Stagger className="mt-12 grid gap-5 md:grid-cols-3">
            {c.env.map(([icon, title, body]) => (
              <StaggerItem key={title} className="rounded-[1.75rem] bg-white p-8 ring-1 ring-line">
                <ServiceIcon name={icon} className="h-7 w-7 text-teal-600" />
                <h3 className="mt-6 text-xl font-semibold text-navy-900">{title}</h3>
                <p className="mt-2 text-ink-muted">{body}</p>
              </StaggerItem>
            ))}
          </Stagger>

          {gallery.length > 0 && (
            <div className="mt-16">
              <h3 className="text-2xl font-semibold text-navy-900">{c.galleryTitle}</h3>
              <div className="mt-6 grid auto-rows-[14rem] grid-cols-2 gap-4 md:grid-cols-4">
                {gallery.map((g, i) => (
                  <Reveal key={g.src} delay={i * 0.05} className={`relative overflow-hidden rounded-3xl ${i % 5 === 0 ? "col-span-2 row-span-2" : ""}`}>
                    <Image src={g.src} alt={t(g.alt, lang)} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover transition-transform duration-[1.4s] ease-out-expo hover:scale-105" />
                  </Reveal>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="container-page">
          <SectionHeading eyebrow={dict.values.eyebrow} title={dict.values.title} />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v, i) => (
              <Reveal key={v.slug} delay={i * 0.06} className="border-t-2 border-teal-500 pt-6">
                <h3 className="text-lg font-semibold text-navy-900">{t(v.title, lang)}</h3>
                <p className="mt-2 text-ink-muted">{t(v.body, lang)}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-24 sm:pb-32">
        <div className="container-page">
          <SectionHeading eyebrow={dict.doctors.eyebrow} title={c.team} />
          <div className="mt-12 grid gap-6 xl:grid-cols-2">
            {doctors.map((d, i) => (
              <DoctorCard key={d.slug} doctor={d} lang={lang} index={i} labels={dict.doctors} whatsappHref={whatsappLink(wa, d.whatsappTopic, lang)} />
            ))}
          </div>
          <div className="mt-12">
            <ButtonLink href={localePath(lang, "/contact")} variant="primary" arrow>{dict.nav.contact}</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
