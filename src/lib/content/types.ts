import type { Localized } from "../i18n/config";
import type { WhatsAppTopic } from "../whatsapp";

export type ServiceGroup = "gp" | "mental" | "weight" | "other";

export interface SiteSettings {
  clinicName: string;
  altName: string;
  phone: string; // display/call number
  email: string;
  addressLines: string[];
  mapQuery: string;
  hours: { label: Localized; value: Localized }[];
  social: { instagram?: string; facebook?: string; tiktok?: string; youtube?: string; threads?: string };
  logoUrl?: string;
  /** Real clinic photographs only (no stock / generated people). */
  gallery?: { src: string; alt: Localized }[];
}

export interface Doctor {
  slug: string;
  name: string;
  shortName: string;
  title: Localized;
  photo?: string;
  photoAlt?: Localized;
  /** Verified qualifications only. Leave empty until confirmed — hidden when empty. */
  qualifications: string;
  /** MMC / NSR registration confirmed by admin. */
  credentialsVerified: boolean;
  interests: Localized[];
  bio: Localized;
  whatsappTopic: WhatsAppTopic;
}

export interface Faq {
  q: Localized;
  a: Localized;
}

export interface Service {
  slug: string;
  group: ServiceGroup;
  title: Localized;
  summary: Localized;
  explanation: Localized;
  whoBenefits: Localized[];
  expect: Localized[];
  faqs: Faq[];
  whatsappTopic: WhatsAppTopic;
  icon: string;
  featured?: boolean;
}

export interface Panel {
  slug: string;
  name: string;
  /** Only "confirmed" panels are shown publicly. */
  verification: "confirmed" | "pending_verification" | "inactive";
  /** Approved logo only. Text wordmark is shown when empty. */
  logoUrl?: string;
  category?: string;
}

export interface Article {
  slug: string;
  title: Localized;
  excerpt: Localized;
  body: Localized; // limited markdown subset
  category: Localized;
  readMinutes: number;
  publishedAt: string;
  reviewedBy?: string;
}

export interface Video {
  slug: string;
  title: Localized;
  youtubeId?: string;
  url?: string;
  platform: "youtube" | "instagram" | "tiktok" | "facebook";
}

export interface ClinicEvent {
  slug: string;
  title: Localized;
  date: string;
  location: Localized;
  description: Localized;
  url?: string;
}

export interface Job {
  slug: string;
  title: Localized;
  type: Localized;
  summary: Localized;
  responsibilities: Localized[];
  requirements: Localized[];
}

export interface Value {
  slug: string;
  title: Localized;
  body: Localized;
  icon: string;
}

export interface CollectionMap {
  settings: SiteSettings & { slug: string };
  doctors: Doctor;
  services: Service;
  panels: Panel;
  articles: Article;
  faqs: Faq & { slug: string };
  videos: Video;
  events: ClinicEvent;
  jobs: Job;
  values: Value;
}
export type CollectionName = keyof CollectionMap;

export interface SeedItem<C extends CollectionName = CollectionName> {
  slug: string;
  status: "draft" | "published";
  sort: number;
  data: CollectionMap[C];
}
