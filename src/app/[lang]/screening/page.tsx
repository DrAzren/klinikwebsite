import { PageHero } from "@/components/site/page-hero";
import { ScreeningFlow } from "@/components/screening/screening-flow";
import { clinicWhatsApp } from "@/lib/content/repo";
import { localePath } from "@/lib/i18n";
import { pageMeta, resolveLang } from "@/lib/page";
import { SEVERITY_LABEL } from "@/lib/screening/scoring";
import { whatsappLink } from "@/lib/whatsapp";

export async function generateMetadata({ params }: PageProps<"/[lang]/screening">) {
  const { lang, dict } = await resolveLang(params);
  return { ...pageMeta(lang, "/screening", dict.screening.eyebrow, dict.screening.intro), referrer: "no-referrer" as const };
}

/**
 * No analytics, tracking pixels or third-party scripts are loaded on this page.
 */
export default async function Screening({ params }: PageProps<"/[lang]/screening">) {
  const { lang, dict } = await resolveLang(params);
  const sevLabels = Object.fromEntries(Object.entries(SEVERITY_LABEL).map(([k, v]) => [k, v[lang]])) as Record<keyof typeof SEVERITY_LABEL, string>;
  return (
    <>
      <PageHero eyebrow={dict.screening.eyebrow} title={dict.screening.title} intro={dict.screening.intro} tone="lilac" />
      <section className="pb-24 sm:pb-32">
        <div className="container-page max-w-5xl">
          <ScreeningFlow
            lang={lang}
            d={dict.screening}
            sevLabels={sevLabels}
            privacyHref={localePath(lang, "/privacy#screening")}
            bookHref={whatsappLink(clinicWhatsApp(), "mental", lang)}
          />
        </div>
      </section>
    </>
  );
}
