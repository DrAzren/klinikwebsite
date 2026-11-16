import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { LocationSection } from "@/components/site/location";
import { Stagger, StaggerItem } from "@/components/motion";
import { WhatsAppIcon } from "@/components/icons";
import { clinicWhatsApp, getSettings } from "@/lib/content/repo";
import { t } from "@/lib/i18n";
import { pageMeta, resolveLang } from "@/lib/page";
import { WHATSAPP_TOPICS, whatsappLink } from "@/lib/whatsapp";

export async function generateMetadata({ params }: PageProps<"/[lang]/contact">) {
  const { lang, dict } = await resolveLang(params);
  return pageMeta(lang, "/contact", dict.nav.contact, dict.contact.intro);
}

export default async function Contact({ params }: PageProps<"/[lang]/contact">) {
  const { lang, dict } = await resolveLang(params);
  const settings = await getSettings();
  const wa = clinicWhatsApp();
  const order = ["gp", "mental", "weight", "screening", "general"] as const;
  return (
    <>
      <PageHero eyebrow={dict.contact.eyebrow} title={dict.contact.title} intro={dict.contact.intro} />
      <section className="pb-8">
        <div className="container-page">
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {order.filter((o) => WHATSAPP_TOPICS.includes(o)).map((topic) => (
              <StaggerItem key={topic}>
                <a href={whatsappLink(wa, topic, lang)} target="_blank" rel="noopener noreferrer" className="group flex h-full flex-col justify-between gap-8 rounded-[1.75rem] bg-white p-6 ring-1 ring-line transition hover:shadow-lift hover:ring-[#1FAF5A]/50">
                  <span className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1FAF5A]/10 text-[#1FAF5A]"><WhatsAppIcon className="h-5 w-5" /></span>
                    <ArrowUpRight className="h-5 w-5 text-ink-muted transition group-hover:rotate-45 group-hover:text-navy-900" />
                  </span>
                  <span className="text-lg font-semibold text-navy-900">{dict.contact.topics[topic]}</span>
                </a>
              </StaggerItem>
            ))}
          </Stagger>
          <p className="mt-6 flex gap-3 rounded-2xl bg-danger-soft p-5 text-sm text-ink-soft"><AlertTriangle className="h-5 w-5 shrink-0 text-danger" />{dict.contact.emergency}</p>
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
