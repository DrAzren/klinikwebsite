import { Info } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { PanelSearch } from "@/components/site/panel-search";
import { WhatsAppIcon } from "@/components/icons";
import { ButtonLink } from "@/components/ui";
import { clinicWhatsApp, getPublicPanels } from "@/lib/content/repo";
import { pageMeta, resolveLang } from "@/lib/page";
import { whatsappLink } from "@/lib/whatsapp";

export async function generateMetadata({ params }: PageProps<"/[lang]/panels">) {
  const { lang, dict } = await resolveLang(params);
  return pageMeta(lang, "/panels", dict.panels.title, dict.panels.intro);
}

export default async function Panels({ params }: PageProps<"/[lang]/panels">) {
  const { lang, dict } = await resolveLang(params);
  const panels = await getPublicPanels();
  return (
    <>
      <PageHero eyebrow={dict.panels.eyebrow} title={dict.panels.title} intro={dict.panels.intro} />
      <section className="pb-24 sm:pb-32">
        <div className="container-page">
          <PanelSearch panels={panels} labels={dict.panels} />
          <div className="mt-12 flex flex-col items-start gap-5 rounded-[1.75rem] bg-mint p-7 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex gap-3 text-ink-soft"><Info className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />{dict.panels.confirmNote}</p>
            <ButtonLink href={whatsappLink(clinicWhatsApp(), "general", lang)} external variant="whatsapp"><WhatsAppIcon className="h-4 w-4" />{dict.cta.whatsapp}</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
