"use client";

import { useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";

export function CareersForm({ d, positions, privacyHref }: { d: Dictionary["careers"]; positions: { value: string; label: string }[]; privacyHref: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const field = "mt-1.5 w-full rounded-2xl border-0 bg-paper px-4 text-navy-900 ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-teal-500";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/careers", { method: "POST", body: new FormData(e.currentTarget), credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error && json.error !== "invalid" ? json.error : d.error);
      setState("done");
      form.current?.reset();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : d.error);
      setState("error");
    }
  }

  if (state === "done") {
    return <p role="status" className="flex gap-3 rounded-[1.75rem] bg-success-soft p-7 text-success"><CheckCircle2 className="h-6 w-6 shrink-0" />{d.success}</p>;
  }
  return (
    <form ref={form} onSubmit={submit} className="grid gap-4 rounded-[2rem] bg-white p-6 ring-1 ring-line sm:grid-cols-2 sm:p-10">
      <h2 className="text-2xl font-semibold text-navy-900 sm:col-span-2">{d.applyTitle}</h2>
      <label className="text-sm font-medium text-ink-soft sm:col-span-2">{d.position}
        <select name="position" required className={`${field} h-12`}>{positions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
      </label>
      <label className="text-sm font-medium text-ink-soft">{d.name}<input name="name" required minLength={2} maxLength={120} autoComplete="name" className={`${field} h-12`} /></label>
      <label className="text-sm font-medium text-ink-soft">{d.phone}<input name="phone" required inputMode="tel" autoComplete="tel" pattern="\+?[0-9][0-9 \-]{7,15}" className={`${field} h-12`} /></label>
      <label className="text-sm font-medium text-ink-soft sm:col-span-2">{d.email}<input name="email" type="email" required autoComplete="email" className={`${field} h-12`} /></label>
      <label className="text-sm font-medium text-ink-soft sm:col-span-2">{d.message} <span className="text-ink-muted">({d.optional})</span><textarea name="message" rows={4} maxLength={3000} className={`${field} py-3`} /></label>
      <label className="text-sm font-medium text-ink-soft sm:col-span-2">{d.cv} <span className="text-ink-muted">({d.optional})</span>
        <input name="cv" type="file" accept="application/pdf" className="mt-1.5 block w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-navy-900 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white" />
      </label>
      <div aria-hidden className="absolute left-[-9999px]"><input name="website" tabIndex={-1} autoComplete="off" /></div>
      <label className="flex gap-3 text-sm text-ink-soft sm:col-span-2">
        <input type="checkbox" name="consent" required className="mt-0.5 h-5 w-5 shrink-0 accent-teal-600" />
        <span>{d.consent} <a href={privacyHref} className="font-semibold text-teal-700 underline">PDPA</a></span>
      </label>
      {state === "error" && <p role="alert" className="text-sm font-medium text-danger sm:col-span-2">{msg}</p>}
      <button type="submit" disabled={state === "sending"} className="inline-flex h-13 items-center justify-center rounded-full bg-navy-900 px-7 py-3.5 font-semibold text-white transition hover:bg-navy-700 disabled:opacity-50 sm:col-span-2 sm:justify-self-start">
        {state === "sending" ? d.sending : d.submit}
      </button>
    </form>
  );
}
