import { notFound } from "next/navigation";

/** Any unknown public path renders the localized 404 page. */
export default function CatchAll() {
  notFound();
}

/** Known slugs are prerendered via generateStaticParams; new CMS slugs render on demand. */
export const instant = false;
