import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { getCollection } from "@/lib/content/repo";
import { localePath, LOCALES } from "@/lib/i18n";

const STATIC = ["/", "/about", "/doctors", "/services", "/mental-health", "/weight-management", "/screening", "/panels", "/insights", "/book", "/careers", "/contact", "/privacy"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env().SITE_URL;
  const [services, articles] = await Promise.all([getCollection("services"), getCollection("articles")]);
  const paths = [...STATIC, ...services.map((s) => `/services/${s.slug}`), ...articles.map((a) => `/insights/${a.slug}`)];
  return paths.map((p) => ({
    url: `${base}${localePath("ms", p)}`,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l === "ms" ? "ms-MY" : "en-MY", `${base}${localePath(l, p)}`])) },
  }));
}
