import type { ReactNode } from "react";
import { Reveal } from "../motion";

export function PageHero({ eyebrow, title, intro, children, tone = "mint" }: { eyebrow: string; title: ReactNode; intro?: ReactNode; children?: ReactNode; tone?: "mint" | "paper" | "lilac" }) {
  const bg = {
    mint: "from-mint via-paper to-paper",
    paper: "from-navy-100/60 via-paper to-paper",
    lilac: "from-[#eceefb] via-paper to-paper",
  }[tone];
  return (
    <section className={`relative overflow-hidden bg-gradient-to-b ${bg} pb-14 pt-36 sm:pb-20 sm:pt-44`}>
      <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-[30rem] w-[30rem] rounded-full bg-teal-400/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute right-[8%] top-28 hidden h-56 w-56 rounded-full ring-1 ring-navy-900/10 lg:block" />
      <div aria-hidden className="pointer-events-none absolute right-[12%] top-40 hidden h-56 w-56 rounded-full bg-gradient-to-br from-teal-400/30 to-teal-600/10 lg:block" />
      <div className="container-page relative">
        <Reveal>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-[2.5rem] font-semibold leading-[1.04] text-navy-900 sm:text-6xl">{title}</h1>
          {intro && <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted sm:text-xl">{intro}</p>}
          {children && <div className="mt-8">{children}</div>}
        </Reveal>
      </div>
    </section>
  );
}
