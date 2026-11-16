import en, { type Dictionary } from "./en";
import ms from "./ms";
import type { Locale } from "./config";

const dictionaries: Record<Locale, Dictionary> = { ms, en };

export const getDictionary = (lang: Locale): Dictionary => dictionaries[lang];
export type { Dictionary };
export * from "./config";
