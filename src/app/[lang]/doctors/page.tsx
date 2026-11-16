import { PageHero } from "@/components/site/page-hero";
import { DoctorCard } from "@/components/site/cards";
import { clinicWhatsApp, getCollection } from "@/lib/content/repo";
import { pageMeta, resolveLang } from "@/lib/page";
import { whatsappLink } from "@/lib/whatsapp";

export async function generateMetadata({ params }: PageProps<"/[lang]/doctors">) {
  const { lang, dict } = await resolveLang(params);
  return pageMeta(lang, "/doctors", dict.nav.doctors, dict.doctors.intro);
}

export default async function Doctors({ params }: PageProps<"/[lang]/doctors">) {
  const { lang, dict } = await resolveLang(params);
  const doctors = await getCollection("doctors");
  const wa = clinicWhatsApp();
  return (
    <>
      <PageHero eyebrow={dict.doctors.eyebrow} title={dict.doctors.title} intro={dict.doctors.intro} />
      <section className="pb-24 sm:pb-32">
        <div className="container-page grid gap-8">
          {doctors.map((d, i) => (
            <DoctorCard key={d.slug} doctor={d} lang={lang} index={i} labels={dict.doctors} whatsappHref={whatsappLink(wa, d.whatsappTopic, lang)} />
          ))}
        </div>
      </section>
    </>
  );
}
