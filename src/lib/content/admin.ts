/**
 * CMS administration. Collections are described by field schemas that drive a
 * generic editor in Staff Portal → Content. Saving revalidates the public
 * pages that use the collection.
 */
import type { Db } from "../db";
import { audit } from "../audit";
import { assertCan } from "../auth/rbac";
import type { SessionInfo } from "../auth/service";
import type { CollectionName } from "./types";

export type FieldKind =
  | "text" | "textarea" | "url" | "image" | "boolean" | "number" | "select" | "date"
  | "l-text" | "l-textarea" | "l-markdown" | "l-lines" | "lines" | "json";

export interface Field {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  options?: { value: string; label: string }[];
  help?: string;
}

export interface CollectionSchema {
  name: CollectionName;
  label: string;
  description: string;
  titleKey: string;
  singleton?: boolean;
  fields: Field[];
}

const whatsappTopics = ["mental", "gp", "weight", "screening", "general"].map((v) => ({ value: v, label: v }));

export const SCHEMAS: CollectionSchema[] = [
  {
    name: "settings", label: "Clinic details", description: "Contact details, address, opening hours and social links shown across the site.",
    titleKey: "clinicName", singleton: true,
    fields: [
      { key: "clinicName", label: "Clinic name", kind: "text", required: true },
      { key: "altName", label: "Alternative name", kind: "text" },
      { key: "phone", label: "Phone (display / call)", kind: "text", required: true, help: "WhatsApp number itself is set by the CLINIC_WHATSAPP_NUMBER environment variable." },
      { key: "email", label: "Public email", kind: "text" },
      { key: "addressLines", label: "Address (one line per row)", kind: "lines", required: true },
      { key: "mapQuery", label: "Google Maps search query", kind: "text", required: true, help: "Used for the map embed and directions links. Verify it lands on the clinic." },
      { key: "hours", label: "Opening hours (JSON)", kind: "json", help: 'Example: [{"label":{"ms":"Isnin–Jumaat","en":"Mon–Fri"},"value":{"ms":"9 pg – 10 mlm","en":"9am – 10pm"}}]. Leave [] to show "contact us for hours".' },
      { key: "social", label: "Social links (JSON)", kind: "json", help: '{"instagram":"https://instagram.com/…","facebook":"…","tiktok":"…","youtube":"…"}' },
      { key: "logoUrl", label: "Logo image URL", kind: "image", help: "Official logo file (e.g. /brand/logo.svg). Leave empty to use the wordmark." },
      { key: "gallery", label: "Clinic photo gallery (JSON)", kind: "json", help: 'Real clinic photos only: [{"src":"/images/clinic/reception.jpg","alt":{"ms":"Ruang menunggu","en":"Waiting area"}}]. Shown on About when not empty.' },
    ],
  },
  {
    name: "doctors", label: "Doctors", description: "Doctor profiles. Only enter verified qualifications.", titleKey: "shortName",
    fields: [
      { key: "slug", label: "Slug", kind: "text", required: true },
      { key: "name", label: "Full name", kind: "text", required: true },
      { key: "shortName", label: "Display name", kind: "text", required: true },
      { key: "title", label: "Title / role", kind: "l-text", required: true },
      { key: "photo", label: "Photo URL", kind: "image" },
      { key: "photoAlt", label: "Photo description (alt text)", kind: "l-text" },
      { key: "qualifications", label: "Verified qualifications", kind: "text", help: "Leave EMPTY until verified against MMC / NSR records. Hidden when empty." },
      { key: "credentialsVerified", label: "Credentials verified by CEO", kind: "boolean" },
      { key: "interests", label: "Clinical interests (one per line)", kind: "l-lines" },
      { key: "bio", label: "Profile", kind: "l-textarea", required: true },
      { key: "whatsappTopic", label: "WhatsApp topic", kind: "select", options: whatsappTopics },
    ],
  },
  {
    name: "services", label: "Services", description: "Services grouped by GP, mental health, weight management and others.", titleKey: "title",
    fields: [
      { key: "slug", label: "Slug", kind: "text", required: true },
      { key: "group", label: "Group", kind: "select", required: true, options: [
        { value: "gp", label: "General practice" }, { value: "mental", label: "Mental health" },
        { value: "weight", label: "Weight management" }, { value: "other", label: "Other" },
      ] },
      { key: "title", label: "Title", kind: "l-text", required: true },
      { key: "summary", label: "Short summary", kind: "l-text", required: true },
      { key: "explanation", label: "Explanation", kind: "l-textarea", required: true },
      { key: "whoBenefits", label: "Who may benefit (one per line)", kind: "l-lines" },
      { key: "expect", label: "What to expect (one per line)", kind: "l-lines" },
      { key: "faqs", label: "FAQs (JSON)", kind: "json", help: '[{"q":{"ms":"…","en":"…"},"a":{"ms":"…","en":"…"}}]' },
      { key: "whatsappTopic", label: "WhatsApp topic", kind: "select", options: whatsappTopics },
      { key: "icon", label: "Icon key", kind: "text" },
      { key: "featured", label: "Featured on home page", kind: "boolean" },
    ],
  },
  {
    name: "panels", label: "Panel clinics", description: "Only panels marked Confirmed appear publicly. Use approved logos only.", titleKey: "name",
    fields: [
      { key: "slug", label: "Slug", kind: "text", required: true },
      { key: "name", label: "Panel / insurer name", kind: "text", required: true },
      { key: "verification", label: "Verification", kind: "select", required: true, options: [
        { value: "confirmed", label: "Confirmed active" }, { value: "pending_verification", label: "Pending verification" }, { value: "inactive", label: "Inactive" },
      ] },
      { key: "logoUrl", label: "Approved logo URL", kind: "image" },
      { key: "category", label: "Category", kind: "text" },
    ],
  },
  {
    name: "articles", label: "Health articles", description: "Educational articles. Have each article clinically reviewed before publishing.", titleKey: "title",
    fields: [
      { key: "slug", label: "Slug (URL)", kind: "text", required: true },
      { key: "title", label: "Title", kind: "l-text", required: true },
      { key: "excerpt", label: "Excerpt", kind: "l-textarea", required: true },
      { key: "category", label: "Category", kind: "l-text" },
      { key: "body", label: "Body (Markdown: ## headings, - lists, **bold**, > quote, [link](https://…))", kind: "l-markdown", required: true },
      { key: "readMinutes", label: "Reading time (minutes)", kind: "number" },
      { key: "publishedAt", label: "Publish date", kind: "date" },
      { key: "reviewedBy", label: "Clinically reviewed by", kind: "text" },
    ],
  },
  {
    name: "faqs", label: "Mental health FAQs", description: "Questions shown on the Health Insights and Mental Health pages.", titleKey: "q",
    fields: [
      { key: "slug", label: "Slug", kind: "text", required: true },
      { key: "q", label: "Question", kind: "l-text", required: true },
      { key: "a", label: "Answer", kind: "l-textarea", required: true },
    ],
  },
  {
    name: "videos", label: "Videos", description: "Short educational videos (YouTube IDs load via youtube-nocookie on click).", titleKey: "title",
    fields: [
      { key: "slug", label: "Slug", kind: "text", required: true },
      { key: "title", label: "Title", kind: "l-text", required: true },
      { key: "platform", label: "Platform", kind: "select", options: ["youtube", "instagram", "tiktok", "facebook"].map((v) => ({ value: v, label: v })) },
      { key: "youtubeId", label: "YouTube video ID", kind: "text" },
      { key: "url", label: "External URL", kind: "url" },
    ],
  },
  {
    name: "events", label: "Community events", description: "Talks, screenings and community programmes. Get partner approval before naming partners.", titleKey: "title",
    fields: [
      { key: "slug", label: "Slug", kind: "text", required: true },
      { key: "title", label: "Title", kind: "l-text", required: true },
      { key: "date", label: "Date", kind: "date", required: true },
      { key: "location", label: "Location", kind: "l-text" },
      { key: "description", label: "Description", kind: "l-textarea" },
      { key: "url", label: "More info URL", kind: "url" },
    ],
  },
  {
    name: "jobs", label: "Careers", description: "Open positions. Publish to show on the Careers page.", titleKey: "title",
    fields: [
      { key: "slug", label: "Slug", kind: "text", required: true },
      { key: "title", label: "Job title", kind: "l-text", required: true },
      { key: "type", label: "Type", kind: "l-text" },
      { key: "summary", label: "Summary", kind: "l-textarea", required: true },
      { key: "responsibilities", label: "Responsibilities (one per line)", kind: "l-lines" },
      { key: "requirements", label: "Requirements (one per line)", kind: "l-lines" },
    ],
  },
  {
    name: "values", label: "Clinic values", description: "Values shown on Home and About.", titleKey: "title",
    fields: [
      { key: "slug", label: "Slug", kind: "text", required: true },
      { key: "title", label: "Title", kind: "l-text", required: true },
      { key: "body", label: "Text", kind: "l-textarea", required: true },
      { key: "icon", label: "Icon key", kind: "text" },
    ],
  },
];

export const schemaFor = (name: string) => SCHEMAS.find((s) => s.name === name) ?? null;

export class ContentError extends Error {}

export async function listItems(db: Db, s: SessionInfo, collection: CollectionName) {
  assertCan(s.user.role, "content:manage");
  return db.query<{ id: string; slug: string; status: string; sort: number; data: Record<string, unknown>; updated_at: Date }>(
    "select id, slug, status, sort, data, updated_at from content_items where collection = $1 order by sort, slug",
    [collection],
  );
}

export async function getItemById(db: Db, s: SessionInfo, id: string) {
  assertCan(s.user.role, "content:manage");
  return db.one<{ id: string; collection: CollectionName; slug: string; status: string; sort: number; data: Record<string, unknown> }>(
    "select id, collection, slug, status, sort, data from content_items where id = $1",
    [id],
  );
}

/** Build a typed data object from submitted form fields according to the schema. */
export function dataFromForm(schema: CollectionSchema, form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const str = (k: string) => String(form.get(k) ?? "").trim();
  const lines = (k: string) => str(k).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const f of schema.fields) {
    switch (f.kind) {
      case "boolean": out[f.key] = form.get(f.key) === "on"; break;
      case "number": out[f.key] = Number(str(f.key) || 0); break;
      case "lines": out[f.key] = lines(f.key); break;
      case "l-text": case "l-textarea": case "l-markdown":
        out[f.key] = { ms: str(`${f.key}.ms`), en: str(`${f.key}.en`) };
        break;
      case "l-lines": {
        const ms = lines(`${f.key}.ms`);
        const en = lines(`${f.key}.en`);
        out[f.key] = Array.from({ length: Math.max(ms.length, en.length) }, (_, i) => ({ ms: ms[i] ?? en[i] ?? "", en: en[i] ?? ms[i] ?? "" }));
        break;
      }
      case "json": {
        const raw = str(f.key);
        try {
          out[f.key] = raw ? JSON.parse(raw) : f.key === "social" ? {} : [];
        } catch {
          throw new ContentError(`“${f.label}” is not valid JSON`);
        }
        break;
      }
      case "url": case "image": {
        const v = str(f.key);
        if (v && !v.startsWith("/") && !/^https:\/\//.test(v)) throw new ContentError(`“${f.label}” must be https:// or a /path`);
        out[f.key] = v;
        break;
      }
      default: out[f.key] = str(f.key);
    }
    if (f.required) {
      const v = out[f.key] as unknown;
      const empty = v === "" || v == null || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && v !== null && "ms" in v && !(v as unknown as { ms: string }).ms && !(v as unknown as { en: string }).en);
      if (empty) throw new ContentError(`“${f.label}” is required`);
    }
  }
  if (out.slug !== undefined && !/^[a-z0-9-]{1,80}$/.test(String(out.slug))) throw new ContentError("Slug: lowercase letters, numbers and hyphens only");
  return out;
}

export async function saveItem(
  db: Db,
  s: SessionInfo,
  input: { id?: string; collection: CollectionName; status: "draft" | "published" | "archived"; sort: number; data: Record<string, unknown> },
) {
  assertCan(s.user.role, "content:manage");
  const slug = String(input.data.slug ?? "site");
  if (input.id) {
    await db.query(
      "update content_items set slug = $2, status = $3, sort = $4, data = $5::jsonb, updated_by = $6 where id = $1 and collection = $7",
      [input.id, slug, input.status, input.sort, JSON.stringify(input.data), s.user.id, input.collection],
    );
  } else {
    const exists = await db.one("select 1 from content_items where collection = $1 and slug = $2", [input.collection, slug]);
    if (exists) throw new ContentError("An item with this slug already exists");
    await db.query(
      "insert into content_items (collection, slug, status, sort, data, updated_by) values ($1,$2,$3,$4,$5::jsonb,$6)",
      [input.collection, slug, input.status, input.sort, JSON.stringify(input.data), s.user.id],
    );
  }
  await audit(db, { id: s.user.id, label: s.user.username }, "content.saved", { type: input.collection, id: slug }, { status: input.status });
}

export async function deleteItem(db: Db, s: SessionInfo, id: string) {
  assertCan(s.user.role, "content:manage");
  const row = await db.one<{ collection: string; slug: string }>("delete from content_items where id = $1 returning collection, slug", [id]);
  if (row) await audit(db, { id: s.user.id, label: s.user.username }, "content.deleted", { type: row.collection, id: row.slug });
  return row;
}
