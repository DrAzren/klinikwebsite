import type { MetadataRoute } from "next";
import { env, isDemoDeployment } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  if (isDemoDeployment()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/staff", "/api", "/report", "/en/report"] }],
    sitemap: `${env().SITE_URL}/sitemap.xml`,
  };
}
