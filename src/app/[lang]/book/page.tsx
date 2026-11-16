import Image from "next/image";
import { PageHero } from "@/components/site/page-hero";
import { Book3D } from "@/components/site/book-3d";
import { Reveal } from "@/components/motion";
import { ButtonLink } from "@/components/ui";
import { localePath } from "@/lib/i18n";
import { pageMeta, resolveLang } from "@/lib/page";
import { env } from "@/lib/env";

// Topics as printed on the book cover.
const TOPICS = ["OCD", "Depression", "Addiction", "Anxiety", "ADHD", "Bipolar", "Schizophrenia", "PTSD", "Personality Disorder"];
// Bibliographic details from the publisher's listing on bookcafe.my (Nov 2026). Price is intentionally not shown.
const DETAILS = { publisher: "Whitecoat", isbn: "978-967-2705-70-3", pages: 290, year: 2026 };

export async function generateMetadata({ params }: PageProps<"/[lang]/book">) {
  const { lang, dict } = await resolveLang(params);
  return pageMeta(lang, "/book", dict.book.title, dict.book.subtitle);
}

export default async function BookPage({ params }: PageProps<"/[lang]/book">) {
  const { lang, dict } = await resolveLang(params);
  const buy = env().BOOK_PURCHASE_URL;
  return (
    <>
      <PageHero eyebrow={dict.book.eyebrow} title={dict.book.title} intro={dict.book.subtitle}>
        <ButtonLink href={buy} external variant="primary" size="lg" arrow>{dict.cta.buyBook}</ButtonLink>
      </PageHero>
      <section className="overflow-hidden bg-gradient-to-b from-paper to-[#fffbe6] py-16 sm:py-24">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <Book3D src="/images/book-dr-saya-boleh-sembuh-ke.jpg" alt={`${dict.book.title} — Dr Azren`} />
          <Reveal>
            <p className="text-xl leading-relaxed text-ink-soft">{dict.book.synopsis}</p>
            <ul className="mt-8 flex flex-wrap gap-2">
              {TOPICS.map((tp) => <li key={tp} className="rounded-full bg-[#f2d21b]/30 px-3.5 py-1.5 text-sm font-semibold text-[#26307a]">{tp}</li>)}
            </ul>
            <dl className="mt-8 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              {[["Publisher", DETAILS.publisher], ["ISBN", DETAILS.isbn], [lang === "ms" ? "Halaman" : "Pages", String(DETAILS.pages)], [lang === "ms" ? "Bahasa" : "Language", "Bahasa Melayu"]].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-white p-4 ring-1 ring-line"><dt className="text-ink-muted">{k}</dt><dd className="mt-1 font-semibold text-navy-900">{v}</dd></div>
              ))}
            </dl>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={buy} external variant="primary" size="lg" arrow>{dict.cta.buyBook}</ButtonLink>
              <ButtonLink href={localePath(lang, "/screening")} variant="ghost" size="lg">{dict.cta.screening}</ButtonLink>
            </div>
            <p className="mt-4 text-xs text-ink-muted">{dict.book.priceNote}</p>
          </Reveal>
        </div>
      </section>
      <section className="py-20 sm:py-28">
        <div className="container-page">
          <Reveal className="grid items-center gap-8 rounded-[2rem] bg-white p-6 ring-1 ring-line sm:p-10 md:grid-cols-[14rem_1fr]">
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl">
              <Image src="/images/dr-azren.jpg" alt="Dr Azren" fill sizes="14rem" className="object-cover object-top" />
            </div>
            <div>
              <p className="eyebrow">{dict.book.authorTitle}</p>
              <h2 className="mt-3 text-3xl font-semibold text-navy-900">Dr Azren</h2>
              <p className="mt-4 text-lg leading-relaxed text-ink-soft">{dict.book.authorBody}</p>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
