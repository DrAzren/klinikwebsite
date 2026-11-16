/**
 * PHQ-9 and GAD-7 instrument definitions.
 *
 * English: standard published wording (Spitzer, Williams, Kroenke et al.;
 * developed with an educational grant from Pfizer — "No permission required to
 * reproduce, translate, display or distribute").
 *
 * Bahasa Melayu: wording from Klinik Nissa's existing screening form
 * ("Saringan Kesihatan Mental Klinik Nissa"). TRANSLATION STATUS: must be
 * checked against a validated Malay version (e.g. the Malay PHQ-9 validated in
 * Malaysian primary care, and the official Malay translations distributed via
 * phqscreeners.com) and signed off by the clinical lead before production.
 * See docs/CREDENTIALS.md → "Clinical sign-off".
 */
import type { Locale } from "../i18n/config";

export type InstrumentId = "phq9" | "gad7";
type L = Record<Locale, string>;

export const TRANSLATION_STATUS = {
  en: "standard",
  ms: "clinic-provided — pending validation sign-off",
} as const;

export const FREQUENCY_OPTIONS: { value: 0 | 1 | 2 | 3; label: L }[] = [
  { value: 0, label: { en: "Not at all", ms: "Tidak langsung" } },
  { value: 1, label: { en: "Several days", ms: "Beberapa hari" } },
  { value: 2, label: { en: "More than half the days", ms: "Lebih separuh daripada hari-hari tersebut" } },
  { value: 3, label: { en: "Nearly every day", ms: "Hampir setiap hari" } },
];

export const DIFFICULTY_OPTIONS: { value: 0 | 1 | 2 | 3; label: L }[] = [
  { value: 0, label: { en: "Not difficult at all", ms: "Tidak sukar langsung" } },
  { value: 1, label: { en: "Somewhat difficult", ms: "Agak sukar" } },
  { value: 2, label: { en: "Very difficult", ms: "Sangat sukar" } },
  { value: 3, label: { en: "Extremely difficult", ms: "Amat sukar" } },
];

export const STEM: L = {
  en: "Over the last 2 weeks, how often have you been bothered by any of the following problems?",
  ms: "Sepanjang 2 minggu yang lalu, berapa kerapkah anda terganggu oleh masalah berikut?",
};

export const DIFFICULTY_QUESTION: L = {
  en: "If you checked off any problems, how difficult have these problems made it for you to do your work, take care of things at home, or get along with other people?",
  ms: "Jika anda mengalami mana-mana masalah di atas, sejauh manakah masalah ini menyukarkan anda untuk melakukan kerja, menguruskan hal di rumah, atau bergaul dengan orang lain?",
};

export interface Instrument {
  id: InstrumentId;
  name: string;
  title: L;
  description: L;
  items: L[];
  maxScore: number;
}

export const PHQ9: Instrument = {
  id: "phq9",
  name: "PHQ-9",
  title: { en: "Mood (PHQ-9)", ms: "Emosi & mood (PHQ-9)" },
  description: {
    en: "Nine questions about mood and related symptoms over the past two weeks.",
    ms: "Sembilan soalan tentang mood dan simptom berkaitan sepanjang dua minggu lalu.",
  },
  maxScore: 27,
  items: [
    { en: "Little interest or pleasure in doing things", ms: "Kurang minat atau tidak seronok melakukan apa-apa" },
    { en: "Feeling down, depressed, or hopeless", ms: "Rasa sedih, murung atau putus harapan" },
    {
      en: "Trouble falling or staying asleep, or sleeping too much",
      ms: "Sukar tidur, tidur tidak lena, atau tidur terlalu banyak",
    },
    { en: "Feeling tired or having little energy", ms: "Rasa letih atau kurang tenaga" },
    { en: "Poor appetite or overeating", ms: "Kurang selera makan atau makan berlebihan" },
    {
      en: "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
      ms: "Rasa tidak baik tentang diri sendiri, rasa diri gagal, atau telah mengecewakan diri sendiri atau keluarga",
    },
    {
      en: "Trouble concentrating on things, such as reading the newspaper or watching television",
      ms: "Sukar memberi tumpuan, contohnya semasa membaca atau menonton TV",
    },
    {
      en: "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual",
      ms: "Bergerak atau bercakap terlalu perlahan sehingga orang lain perasan; atau sebaliknya, terlalu gelisah sehingga lebih banyak bergerak daripada biasa",
    },
    {
      en: "Thoughts that you would be better off dead or of hurting yourself in some way",
      ms: "Terfikir bahawa lebih baik anda mati, atau terfikir untuk mencederakan diri sendiri dengan apa cara sekalipun",
    },
  ],
};

export const GAD7: Instrument = {
  id: "gad7",
  name: "GAD-7",
  title: { en: "Anxiety (GAD-7)", ms: "Keresahan (GAD-7)" },
  description: {
    en: "Seven questions about worry and anxiety over the past two weeks.",
    ms: "Tujuh soalan tentang kebimbangan dan keresahan sepanjang dua minggu lalu.",
  },
  maxScore: 21,
  items: [
    { en: "Feeling nervous, anxious, or on edge", ms: "Rasa gementar, cemas atau tidak tenteram" },
    { en: "Not being able to stop or control worrying", ms: "Tidak dapat menghentikan atau mengawal rasa bimbang" },
    { en: "Worrying too much about different things", ms: "Terlalu bimbang tentang pelbagai perkara" },
    { en: "Trouble relaxing", ms: "Sukar untuk bertenang" },
    { en: "Being so restless that it is hard to sit still", ms: "Terlalu resah sehingga sukar untuk duduk diam" },
    { en: "Becoming easily annoyed or irritable", ms: "Mudah rasa jengkel atau cepat marah" },
    { en: "Feeling afraid, as if something awful might happen", ms: "Rasa takut seolah-olah sesuatu yang buruk akan berlaku" },
  ],
};

export const INSTRUMENTS: Record<InstrumentId, Instrument> = { phq9: PHQ9, gad7: GAD7 };

/** Index (0-based) of PHQ-9 item 9 — thoughts of self-harm. */
export const PHQ9_SAFETY_ITEM_INDEX = 8;

/** Version string recorded with every submission. Bump when wording changes. */
export const INSTRUMENT_VERSION = "phq9-gad7/2026-11/v1";
export const CONSENT_VERSION = "screening-consent/2026-11/v1";
