/**
 * Service-specific WhatsApp deep links.
 *
 * Only fixed, pre-approved prefill templates can be used — callers pick a
 * topic, they cannot inject arbitrary text. This guarantees screening answers,
 * scores or other health data never end up in a WhatsApp URL.
 */
import type { Locale } from "./i18n/config";

export const WHATSAPP_TOPICS = ["mental", "gp", "weight", "screening", "general"] as const;
export type WhatsAppTopic = (typeof WHATSAPP_TOPICS)[number];

const PREFILL: Record<WhatsAppTopic, Record<Locale, string>> = {
  mental: {
    ms: "Assalamualaikum / Salam sejahtera Klinik Nissa. Saya ingin membuat temujanji untuk konsultasi kesihatan mental.",
    en: "Hello Klinik Nissa. I would like to book a mental health consultation.",
  },
  gp: {
    ms: "Assalamualaikum / Salam sejahtera Klinik Nissa. Saya ingin membuat temujanji untuk konsultasi rawatan am (GP).",
    en: "Hello Klinik Nissa. I would like to book a GP consultation.",
  },
  weight: {
    ms: "Assalamualaikum / Salam sejahtera Klinik Nissa. Saya ingin bertanya tentang program pengurusan berat badan.",
    en: "Hello Klinik Nissa. I would like to ask about weight management.",
  },
  screening: {
    ms: "Assalamualaikum / Salam sejahtera Klinik Nissa. Saya ingin bertanya tentang saringan kesihatan (health screening).",
    en: "Hello Klinik Nissa. I would like to ask about health screening.",
  },
  general: {
    ms: "Assalamualaikum / Salam sejahtera Klinik Nissa. Saya ada pertanyaan.",
    en: "Hello Klinik Nissa. I have an enquiry.",
  },
};

/** Normalise a Malaysian number to international digits, e.g. "012-608 1411" → "60126081411". */
export function normaliseMsisdn(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("0")) d = `6${d}`;
  if (!/^60\d{8,11}$/.test(d)) throw new Error(`Invalid Malaysian WhatsApp number: ${raw}`);
  return d;
}

export function whatsappLink(number: string, topic: WhatsAppTopic, lang: Locale): string {
  if (!WHATSAPP_TOPICS.includes(topic)) throw new Error(`Unknown WhatsApp topic: ${topic}`);
  const text = PREFILL[topic][lang];
  return `https://wa.me/${normaliseMsisdn(number)}?text=${encodeURIComponent(text)}`;
}

export function prefillText(topic: WhatsAppTopic, lang: Locale) {
  return PREFILL[topic][lang];
}

/** Display format: +60 12-608 1411 */
export function displayPhone(number: string): string {
  const d = normaliseMsisdn(number);
  const local = d.slice(2);
  return `+60 ${local.slice(0, 2)}-${local.slice(2, 5)} ${local.slice(5)}`;
}
