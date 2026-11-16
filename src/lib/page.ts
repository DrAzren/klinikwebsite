import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDictionary, hasLocale, localePath, type Locale } from "./i18n";

export async function resolveLang(params: Promise<{ lang: string }>): Promise<{ lang: Locale; dict: ReturnType<typeof getDictionary> }> {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return { lang, dict: getDictionary(lang) };
}

/** Per-page metadata with hreflang alternates for BM (root) and English (/en). */
export function pageMeta(lang: Locale, path: string, title: string, description?: string): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: localePath(lang, path),
      languages: { "ms-MY": localePath("ms", path), "en-MY": localePath("en", path), "x-default": localePath("ms", path) },
    },
    openGraph: { title, description },
  };
}
