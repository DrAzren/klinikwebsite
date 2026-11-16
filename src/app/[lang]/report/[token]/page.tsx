import { Suspense } from "react";
import { resolveLang } from "@/lib/page";
import { SEVERITY_LABEL } from "@/lib/screening/scoring";
import { ReportViewer } from "./report-viewer";

export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

async function Viewer({ params }: { params: Promise<{ lang: string; token: string }> }) {
  const { lang } = await resolveLang(params);
  const { token } = await params;
  const sevLabels = Object.fromEntries(Object.entries(SEVERITY_LABEL).map(([k, v]) => [k, v[lang]]));
  return <ReportViewer token={token} lang={lang} sevLabels={sevLabels} />;
}

export default function ReportPage({ params }: PageProps<"/[lang]/report/[token]">) {
  return (
    <section className="min-h-[70vh] bg-mint/40 pb-24 pt-36">
      <div className="container-page max-w-xl">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-[2rem] bg-white" />}>
          <Viewer params={params} />
        </Suspense>
      </div>
    </section>
  );
}

/** Known slugs are prerendered via generateStaticParams; new CMS slugs render on demand. */
export const instant = false;
