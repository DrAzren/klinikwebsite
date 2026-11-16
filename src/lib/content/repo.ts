/**
 * Public content reads (cached). Pages prerender with this data and are
 * refreshed on demand when staff edit content (revalidateTag "content:<collection>").
 */
import { cacheLife, cacheTag } from "next/cache";
import { getDb, isBuildWithoutDatabase } from "../db";
import { env } from "../env";
import { SEED } from "./seed";
import type { CollectionMap, CollectionName, Panel, SiteSettings } from "./types";

async function readCollection<C extends CollectionName>(collection: C): Promise<CollectionMap[C][]> {
  if (isBuildWithoutDatabase()) {
    return SEED[collection].filter((i) => i.status === "published").map((i) => i.data) as CollectionMap[C][];
  }
  const db = await getDb();
  const rows = await db.query<{ data: CollectionMap[C] }>(
    "select data from content_items where collection = $1 and status = 'published' order by sort asc, updated_at desc",
    [collection],
  );
  return rows.map((r) => r.data);
}

export async function getCollection<C extends CollectionName>(collection: C): Promise<CollectionMap[C][]> {
  "use cache";
  cacheLife("hours");
  cacheTag(`content:${collection}`);
  return readCollection(collection);
}

export async function getItem<C extends CollectionName>(collection: C, slug: string) {
  const all = await getCollection(collection);
  return (all as Array<CollectionMap[C] & { slug: string }>).find((i) => i.slug === slug) ?? null;
}

export async function getSettings(): Promise<SiteSettings> {
  const [s] = await getCollection("settings");
  return (s ?? SEED.settings[0].data) as SiteSettings;
}

/** Only verified, active panels are public. Demo preview of candidates is opt-in and labelled. */
export async function getPublicPanels(): Promise<(Panel & { demo?: boolean })[]> {
  const all = await getCollection("panels");
  const confirmed = all.filter((p) => p.verification === "confirmed");
  if (confirmed.length === 0 && env().DEMO_PREVIEW_UNVERIFIED_PANELS && env().NODE_ENV !== "production") {
    return all.filter((p) => p.verification === "pending_verification").map((p) => ({ ...p, demo: true }));
  }
  return confirmed;
}

export function clinicWhatsApp(): string {
  return env().CLINIC_WHATSAPP_NUMBER;
}
