"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Panel } from "@/lib/content/types";

export function PanelSearch({ panels, labels }: { panels: (Panel & { demo?: boolean })[]; labels: { search: string; empty: string; noMatch: string; unverified: string } }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => panels.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())), [panels, q]);
  if (panels.length === 0) {
    return <p className="rounded-[1.75rem] bg-white p-8 text-lg text-ink-soft ring-1 ring-line">{labels.empty}</p>;
  }
  return (
    <div>
      <label className="relative block max-w-xl">
        <span className="sr-only">{labels.search}</span>
        <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={labels.search}
          className="h-14 w-full rounded-full border-0 bg-white pl-13 pr-5 text-navy-900 shadow-soft ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-teal-500" style={{ paddingLeft: "3.25rem" }} />
      </label>
      <p aria-live="polite" className="sr-only">{list.length}</p>
      {list.length === 0 ? (
        <p className="mt-8 text-ink-muted">{labels.noMatch}</p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((p) => (
            <li key={p.slug} className="relative flex h-28 flex-col items-center justify-center gap-2 rounded-2xl bg-white px-4 text-center ring-1 ring-line">
              {p.logoUrl ? <Image src={p.logoUrl} alt={p.name} width={140} height={48} className="h-10 w-auto object-contain" /> : <span className="text-lg font-semibold text-navy-900">{p.name}</span>}
              {p.demo && <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-warning">{labels.unverified}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
