"use client";

import { useState, useTransition } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import type { ReportAccess } from "@/lib/screening/admin";
import { openReport } from "./actions";

const L = {
  ms: {
    title: "Ringkasan saringan anda", intro: "Masukkan kod rujukan yang dipaparkan pada skrin keputusan anda untuk membuka ringkasan ini.",
    ref: "Kod rujukan", open: "Buka ringkasan", invalid: "Pautan tidak sah.", expired: "Pautan ini telah tamat tempoh atau telah digunakan sepenuhnya. Hubungi klinik untuk pautan baharu.",
    wrong_code: "Kod rujukan tidak sepadan.", locked: "Terlalu banyak cubaan. Hubungi klinik.", submitted: "Dihantar", score: "Skor",
    note: "Ini ialah keputusan saringan, bukan diagnosis. Hubungi klinik untuk berbincang dengan doktor. Dalam kecemasan, hubungi 999.",
  },
  en: {
    title: "Your screening summary", intro: "Enter the reference code shown on your results screen to open this summary.",
    ref: "Reference code", open: "Open summary", invalid: "This link is not valid.", expired: "This link has expired or reached its view limit. Contact the clinic for a new one.",
    wrong_code: "The reference code does not match.", locked: "Too many attempts. Please contact the clinic.", submitted: "Submitted", score: "Score",
    note: "This is a screening result, not a diagnosis. Contact the clinic to discuss it with a doctor. In an emergency, call 999.",
  },
};

export function ReportViewer({ token, lang, sevLabels }: { token: string; lang: "ms" | "en"; sevLabels: Record<string, string> }) {
  const c = L[lang];
  const [ref, setRef] = useState("");
  const [res, setRes] = useState<ReportAccess | null>(null);
  const [pending, start] = useTransition();

  if (res?.ok) {
    return (
      <div className="rounded-[2rem] bg-white p-8 ring-1 ring-line sm:p-10">
        <p className="inline-flex items-center gap-2 text-sm text-teal-700"><ShieldCheck className="h-4 w-4" />{res.reference}</p>
        <h1 className="mt-3 text-3xl font-semibold text-navy-900">{c.title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{c.submitted}: {res.submittedAt}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {res.phq9 && <div className="rounded-2xl bg-paper p-6 ring-1 ring-line"><p className="font-semibold text-teal-700">PHQ-9</p><p className="mt-2 text-3xl font-semibold text-navy-900">{res.phq9.score}/27</p><p className="text-ink-soft">{sevLabels[res.phq9.severity]}</p></div>}
          {res.gad7 && <div className="rounded-2xl bg-paper p-6 ring-1 ring-line"><p className="font-semibold text-teal-700">GAD-7</p><p className="mt-2 text-3xl font-semibold text-navy-900">{res.gad7.score}/21</p><p className="text-ink-soft">{sevLabels[res.gad7.severity]}</p></div>}
        </div>
        <p className="mt-8 text-sm text-ink-muted">{c.note}</p>
      </div>
    );
  }
  return (
    <form
      className="rounded-[2rem] bg-white p-8 ring-1 ring-line sm:p-10"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setRes(await openReport(token, ref)));
      }}
    >
      <Lock className="h-8 w-8 text-teal-600" />
      <h1 className="mt-4 text-3xl font-semibold text-navy-900">{c.title}</h1>
      <p className="mt-2 text-ink-muted">{c.intro}</p>
      <label className="mt-6 block text-sm font-medium text-ink-soft">{c.ref}
        <input value={ref} onChange={(e) => setRef(e.target.value)} required autoComplete="off" placeholder="KN-XXXX-XXXX" className="mt-1.5 h-12 w-full rounded-2xl border-0 bg-paper px-4 font-mono uppercase tracking-wider text-navy-900 ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-teal-500" />
      </label>
      {res && !res.ok && <p role="alert" className="mt-3 text-sm font-medium text-danger">{c[res.reason]}</p>}
      <button disabled={pending} className="mt-6 inline-flex h-12 items-center rounded-full bg-navy-900 px-6 font-semibold text-white disabled:opacity-50">{c.open}</button>
    </form>
  );
}
