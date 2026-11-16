import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { FloatingWhatsApp } from "@/components/site/floating-whatsapp";
import { getDictionary, hasLocale, HTML_LANG, LOCALES } from "@/lib/i18n";
import { clinicWhatsApp, getSettings } from "@/lib/content/repo";
import { whatsappLink } from "@/lib/whatsapp";
import { env, isDemoDeployment, showPreviewBanner } from "@/lib/env";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export const viewport: Viewport = {
  themeColor: "#0B1F3A",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const d = getDictionary(lang);
  return {
    metadataBase: new URL(env().SITE_URL),
    title: { default: d.meta.defaultTitle, template: `%s · Klinik Nissa` },
    description: d.meta.defaultDescription,
    applicationName: "Klinik Nissa",
    openGraph: { type: "website", siteName: "Klinik Nissa", locale: lang === "ms" ? "ms_MY" : "en_MY" },
    icons: { icon: "/icon.svg" },
    formatDetection: { telephone: false },
    ...(isDemoDeployment() ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function PublicLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const settings = await getSettings();
  const wa = clinicWhatsApp();
  const bookHref = whatsappLink(wa, "general", lang);

  return (
    <html lang={HTML_LANG[lang]} className={`${jakarta.variable} ${serif.variable}`}>
      <body className="min-h-dvh bg-paper text-ink antialiased">
        {showPreviewBanner() && (
          <div role="note" className="relative z-[60] bg-warning px-4 py-2 text-center text-xs font-semibold text-white sm:text-sm">{dict.common.previewBanner}</div>
        )}
        <SiteHeader lang={lang} nav={dict.nav} bookLabel={dict.cta.book} bookHref={bookHref} logoUrl={settings.logoUrl} />
        <main id="main">{children}</main>
        <SiteFooter lang={lang} dict={dict} settings={settings} whatsappHref={bookHref} />
        <FloatingWhatsApp href={bookHref} label={dict.cta.whatsapp} />
      </body>
    </html>
  );
}
