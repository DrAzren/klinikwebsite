export const LOCALES = ["ms", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ms";

export const hasLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);

/** Bahasa Melayu lives at the root ("/about"); English under "/en" ("/en/about"). */
export function localePath(lang: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (lang === DEFAULT_LOCALE) return clean;
  return clean === "/" ? "/en" : `/en${clean}`;
}

/** Swap the locale of a public pathname (as seen in the browser). */
export function switchLocalePath(pathname: string, to: Locale): string {
  const stripped = pathname === "/en" ? "/" : pathname.startsWith("/en/") ? pathname.slice(3) : pathname;
  return localePath(to, stripped || "/");
}

export type Localized = Record<Locale, string>;
export const t = (v: Localized | string | undefined | null, lang: Locale): string =>
  v == null ? "" : typeof v === "string" ? v : v[lang] || v.ms || v.en || "";

export const HTML_LANG: Record<Locale, string> = { ms: "ms-MY", en: "en-MY" };
