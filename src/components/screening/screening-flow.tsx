"use client";

/**
 * Scene 5 — PHQ-9 / GAD-7 guided screening.
 *
 * Privacy: answers live only in component state until the user submits; they
 * are POSTed once to /api/screening (same-origin, TLS) and never placed in a
 * URL, localStorage, analytics or WhatsApp link.
 * Safety: a non-zero answer to PHQ-9 item 9 immediately opens supportive
 * safety guidance (999, HEAL 15555, Befrienders) before the user continues.
 */
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Lock, Phone, Printer, RotateCcw, ShieldCheck } from "lucide-react";
import {
  CONSENT_VERSION, DIFFICULTY_OPTIONS, DIFFICULTY_QUESTION, FREQUENCY_OPTIONS, INSTRUMENTS, PHQ9_SAFETY_ITEM_INDEX, STEM, type InstrumentId,
} from "@/lib/screening/instruments";
import { gad7Severity, phq9Severity, total, type Severity } from "@/lib/screening/scoring";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { WhatsAppIcon } from "../icons";

type Stage = "intro" | "questions" | "contact" | "results";
type Answers = Record<InstrumentId, (number | null)[]>;
type Contact = { name: string; phone: string; email: string; age: string; preferred: "whatsapp" | "call" | "email" };

interface Result {
  reference: string;
  phq9?: { score: number; severity: Severity };
  gad7?: { score: number; severity: Severity };
  item9Positive: boolean;
}

interface Props {
  lang: Locale;
  d: Dictionary["screening"];
  sevLabels: Record<Severity, string>;
  privacyHref: string;
  bookHref: string;
}

const EASE = [0.16, 1, 0.3, 1] as const;

export function ScreeningFlow({ lang, d, sevLabels, privacyHref, bookHref }: Props) {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<Stage>("intro");
  const [consent, setConsent] = useState(false);
  const [adult, setAdult] = useState(false);
  const [selection, setSelection] = useState<InstrumentId[]>(["phq9", "gad7"]);
  const [mode, setMode] = useState<"step" | "grouped">("step");
  const [answers, setAnswers] = useState<Answers>({ phq9: Array(9).fill(null), gad7: Array(7).fill(null) });
  const [difficulty, setDifficulty] = useState<Record<InstrumentId, number | null>>({ phq9: null, gad7: null });
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [safetyAcknowledged, setSafetyAcknowledged] = useState(false);
  const [wantsContact, setWantsContact] = useState<boolean | null>(null);
  const [contact, setContact] = useState<Contact>({ name: "", phone: "", email: "", age: "", preferred: "whatsapp" });
  const [contactConsent, setContactConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const idemKey = useRef<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Flat list of steps: each question, then an optional difficulty item per instrument.
  const steps = useMemo(() => {
    const out: { inst: InstrumentId; index: number | "difficulty" }[] = [];
    for (const inst of selection) {
      INSTRUMENTS[inst].items.forEach((_, i) => out.push({ inst, index: i }));
      out.push({ inst, index: "difficulty" });
    }
    return out;
  }, [selection]);

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });

  const setAnswer = useCallback((inst: InstrumentId, i: number, v: number) => {
    setAnswers((a) => ({ ...a, [inst]: a[inst].map((x, j) => (j === i ? v : x)) }));
    setError(null);
    if (inst === "phq9" && i === PHQ9_SAFETY_ITEM_INDEX && v > 0 && !safetyAcknowledged) setSafetyOpen(true);
  }, [safetyAcknowledged]);

  const current = steps[step];
  const progress = stage === "questions" && mode === "step" ? (step + 1) / steps.length : stage === "contact" || stage === "results" ? 1 : 0;

  const allAnswered = selection.every((inst) => answers[inst].every((v) => v !== null));
  const item9Positive = selection.includes("phq9") && (answers.phq9[PHQ9_SAFETY_ITEM_INDEX] ?? 0) > 0;

  function next() {
    if (!current) return;
    if (current.index !== "difficulty" && answers[current.inst][current.index] === null) {
      setError(d.answerRequired);
      return;
    }
    setError(null);
    setDir(1);
    if (step < steps.length - 1) setStep(step + 1);
    else {
      setStage("contact");
      scrollTop();
    }
  }
  function prev() {
    setError(null);
    setDir(-1);
    if (step > 0) setStep(step - 1);
    else setStage("intro");
  }

  // Keyboard: 0–3 choose, Enter/→ next, ← previous (step mode only)
  useEffect(() => {
    if (stage !== "questions" || mode !== "step" || safetyOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "TEXTAREA" || (target.tagName === "INPUT" && (target as HTMLInputElement).type === "text")) return;
      if (/^[0-3]$/.test(e.key) && current) {
        const v = Number(e.key);
        if (current.index === "difficulty") setDifficulty((dd) => ({ ...dd, [current.inst]: v }));
        else setAnswer(current.inst, current.index, v);
      } else if (e.key === "Enter" || e.key === "ArrowRight") {
        if (target.tagName === "BUTTON" && e.key === "Enter") return;
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function submit() {
    setError(null);
    if (!allAnswered) {
      setError(d.allRequired);
      return;
    }
    if (wantsContact && !contactConsent) {
      setError(d.consentRequired);
      return;
    }
    setSubmitting(true);
    idemKey.current ??= crypto.randomUUID();
    const body = {
      idempotencyKey: idemKey.current,
      lang,
      consent: true,
      adultConfirmed: true,
      consentVersion: CONSENT_VERSION,
      instruments: selection,
      answers: {
        ...(selection.includes("phq9") ? { phq9: answers.phq9, phq9Difficulty: difficulty.phq9 } : {}),
        ...(selection.includes("gad7") ? { gad7: answers.gad7, gad7Difficulty: difficulty.gad7 } : {}),
      },
      contact: wantsContact
        ? { name: contact.name, phone: contact.phone, email: contact.email, age: Number(contact.age), preferred: contact.preferred, consentToContact: true }
        : null,
      clientScores: {
        ...(selection.includes("phq9") ? { phq9: total(answers.phq9 as number[]) } : {}),
        ...(selection.includes("gad7") ? { gad7: total(answers.gad7 as number[]) } : {}),
      },
      website: (document.getElementById("kn-website") as HTMLInputElement | null)?.value ?? "",
    };
    try {
      const res = await fetch("/api/screening", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin", cache: "no-store" });
      if (res.status === 429) throw new Error(d.rateLimited);
      if (!res.ok) throw new Error(d.error);
      const json = (await res.json()) as Result;
      setResult(json);
      setStage("results");
      scrollTop();
    } catch (e) {
      setError(e instanceof Error ? e.message : d.error);
    } finally {
      setSubmitting(false);
    }
  }

  function restart() {
    setAnswers({ phq9: Array(9).fill(null), gad7: Array(7).fill(null) });
    setDifficulty({ phq9: null, gad7: null });
    setStep(0);
    setResult(null);
    setWantsContact(null);
    setContact({ name: "", phone: "", email: "", age: "", preferred: "whatsapp" });
    setContactConsent(false);
    setSafetyAcknowledged(false);
    idemKey.current = null;
    setStage("intro");
    scrollTop();
  }

  return (
    <div ref={topRef} className="scroll-mt-28">
      {/* Progress */}
      {stage !== "intro" && stage !== "results" && (
        <div className="mb-6" aria-hidden={mode === "grouped"}>
          <div className="h-1.5 overflow-hidden rounded-full bg-navy-100">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-[#8B93D9]" animate={{ width: `${Math.max(4, progress * 100)}%` }} transition={{ duration: 0.6, ease: EASE }} />
          </div>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {stage === "intro" && (
          <motion.div key="intro" initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.5, ease: EASE }}
            className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-[1.75rem] bg-white p-7 ring-1 ring-line sm:p-9">
              <h2 className="text-xl font-semibold text-navy-900">{d.eligibilityTitle}</h2>
              <ul className="mt-5 space-y-3">
                {d.eligibility.map((e, i) => (
                  <li key={e} className={`flex gap-3 ${i === 2 ? "font-medium text-danger" : "text-ink-soft"}`}>
                    {i === 2 ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> : <Check className="mt-0.5 h-5 w-5 shrink-0 text-teal-500" />}
                    {e}
                  </li>
                ))}
              </ul>
              <h2 className="mt-9 text-xl font-semibold text-navy-900">{d.privacyTitle}</h2>
              <ul className="mt-5 space-y-3">
                {d.privacyPoints.map((e) => (
                  <li key={e} className="flex gap-3 text-ink-soft"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />{e}</li>
                ))}
              </ul>
              <Link href={privacyHref} className="mt-5 inline-block text-sm font-semibold text-teal-700 underline-offset-4 hover:underline">{d.readPrivacy}</Link>
            </div>

            <div className="flex flex-col rounded-[1.75rem] bg-navy-900 p-7 text-white sm:p-9">
              <fieldset>
                <legend className="text-xl font-semibold">{d.chooseTitle}</legend>
                <div className="mt-5 grid gap-2">
                  {([["phq9", "gad7"], ["phq9"], ["gad7"]] as InstrumentId[][]).map((sel) => {
                    const label = sel.length === 2 ? d.both : sel[0] === "phq9" ? d.phqOnly : d.gadOnly;
                    const on = sel.join() === selection.join();
                    return (
                      <label key={sel.join()} className={`flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3.5 ring-1 transition ${on ? "bg-teal-500/15 ring-teal-400" : "ring-white/15 hover:ring-white/30"}`}>
                        <input type="radio" name="instruments" className="h-4 w-4 accent-teal-500" checked={on} onChange={() => setSelection(sel)} />
                        <span className="font-medium">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset className="mt-6">
                <legend className="text-sm font-semibold text-navy-300">{d.mode}</legend>
                <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1">
                  {(["step", "grouped"] as const).map((m) => (
                    <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${mode === m ? "bg-white text-navy-900" : "text-navy-100 hover:bg-white/10"}`}>
                      {m === "step" ? d.modeStep : d.modeGrouped}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="mt-6 space-y-3 text-sm">
                <label className="flex cursor-pointer gap-3">
                  <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-teal-500" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
                  <span className="text-navy-100">{lang === "ms" ? "Saya berumur 18 tahun ke atas." : "I am 18 years of age or older."}</span>
                </label>
                <label className="flex cursor-pointer gap-3">
                  <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-teal-500" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span className="text-navy-100">{d.consentLabel}</span>
                </label>
              </div>
              {error && <p role="alert" className="mt-4 text-sm font-medium text-rose-300">{error}</p>}
              <button
                type="button"
                className="mt-8 inline-flex h-14 items-center justify-center gap-2 rounded-full bg-teal-500 px-6 text-base font-semibold text-navy-950 shadow-glow transition hover:bg-teal-400 disabled:opacity-40"
                onClick={() => {
                  if (!consent || !adult) {
                    setError(d.consentRequired);
                    return;
                  }
                  setError(null);
                  setStep(0);
                  setStage("questions");
                  scrollTop();
                }}
              >
                {d.startCta} <ArrowRight className="h-5 w-5" />
              </button>
              <p className="mt-4 text-center text-xs text-navy-300">{d.notDiagnosis}</p>
            </div>
          </motion.div>
        )}

        {stage === "questions" && mode === "step" && current && (
          <motion.div key="step" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-[2rem] bg-white p-6 shadow-soft ring-1 ring-line sm:p-12">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="rounded-full bg-mint px-3 py-1 font-semibold text-teal-700">{INSTRUMENTS[current.inst].title[lang]}</span>
              <span className="text-ink-muted" aria-live="polite">{d.question} {step + 1} {d.of} {steps.length}</span>
            </div>
            <p className="mt-6 text-sm text-ink-muted">{current.index === "difficulty" ? `${d.optional}` : STEM[lang]}</p>
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              <motion.div
                key={`${current.inst}-${current.index}`}
                custom={dir}
                initial={reduce ? false : { opacity: 0, x: dir * 48, filter: "blur(4px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={reduce ? undefined : { opacity: 0, x: dir * -48, filter: "blur(4px)" }}
                transition={{ duration: 0.38, ease: EASE }}
              >
                <QuestionBlock
                  id={`q-${current.inst}-${current.index}`}
                  number={current.index === "difficulty" ? null : current.index + 1}
                  text={current.index === "difficulty" ? DIFFICULTY_QUESTION[lang] : INSTRUMENTS[current.inst].items[current.index][lang]}
                  options={(current.index === "difficulty" ? DIFFICULTY_OPTIONS : FREQUENCY_OPTIONS).map((o) => ({ value: o.value, label: o.label[lang] }))}
                  value={current.index === "difficulty" ? difficulty[current.inst] : answers[current.inst][current.index]}
                  onChange={(v) => {
                    if (current.index === "difficulty") setDifficulty((dd) => ({ ...dd, [current.inst]: v }));
                    else {
                      setAnswer(current.inst, current.index, v);
                      // gentle auto-advance (not for the safety item, which may open guidance)
                      const isSafety = current.inst === "phq9" && current.index === PHQ9_SAFETY_ITEM_INDEX && v > 0;
                      if (!isSafety && !reduce) setTimeout(() => { setDir(1); setStep((s) => (s === step && s < steps.length - 1 ? s + 1 : s)); }, 280);
                    }
                  }}
                  large
                />
              </motion.div>
            </AnimatePresence>
            {error && <p role="alert" className="mt-4 text-sm font-medium text-danger">{error}</p>}
            <div className="mt-10 flex items-center justify-between gap-3">
              <button type="button" onClick={prev} className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold text-navy-900 ring-1 ring-line transition hover:bg-paper">
                <ArrowLeft className="h-4 w-4" /> {d.previous}
              </button>
              <button type="button" onClick={next} className="inline-flex h-12 items-center gap-2 rounded-full bg-navy-900 px-6 text-sm font-semibold text-white transition hover:bg-navy-700">
                {step === steps.length - 1 ? d.review : d.next} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-6 hidden text-center text-xs text-ink-muted sm:block">
              {lang === "ms" ? "Papan kekunci: tekan 0–3 untuk menjawab, Enter untuk seterusnya." : "Keyboard: press 0–3 to answer, Enter for next."}
            </p>
          </motion.div>
        )}

        {stage === "questions" && mode === "grouped" && (
          <motion.div key="grouped" initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {selection.map((inst) => (
              <fieldset key={inst} className="rounded-[2rem] bg-white p-6 ring-1 ring-line sm:p-10">
                <legend className="sr-only">{INSTRUMENTS[inst].name}</legend>
                <p className="inline-block rounded-full bg-mint px-3 py-1 text-sm font-semibold text-teal-700">{INSTRUMENTS[inst].title[lang]}</p>
                <p className="mt-4 text-ink-muted">{STEM[lang]}</p>
                <div className="mt-6 divide-y divide-line">
                  {INSTRUMENTS[inst].items.map((item, i) => (
                    <div key={i} className="py-6 first:pt-0">
                      <QuestionBlock
                        id={`g-${inst}-${i}`}
                        number={i + 1}
                        text={item[lang]}
                        options={FREQUENCY_OPTIONS.map((o) => ({ value: o.value, label: o.label[lang] }))}
                        value={answers[inst][i]}
                        onChange={(v) => setAnswer(inst, i, v)}
                        invalid={!!error && answers[inst][i] === null}
                      />
                    </div>
                  ))}
                  <div className="py-6">
                    <QuestionBlock
                      id={`g-${inst}-difficulty`}
                      number={null}
                      text={`${DIFFICULTY_QUESTION[lang]} (${d.optional})`}
                      options={DIFFICULTY_OPTIONS.map((o) => ({ value: o.value, label: o.label[lang] }))}
                      value={difficulty[inst]}
                      onChange={(v) => setDifficulty((dd) => ({ ...dd, [inst]: v }))}
                    />
                  </div>
                </div>
              </fieldset>
            ))}
            {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
            <div className="flex justify-between">
              <button type="button" onClick={() => setStage("intro")} className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold text-navy-900 ring-1 ring-line"><ArrowLeft className="h-4 w-4" />{d.previous}</button>
              <button type="button" onClick={() => { if (!allAnswered) { setError(d.allRequired); return; } setError(null); setStage("contact"); scrollTop(); }} className="inline-flex h-12 items-center gap-2 rounded-full bg-navy-900 px-6 text-sm font-semibold text-white">{d.next}<ArrowRight className="h-4 w-4" /></button>
            </div>
          </motion.div>
        )}

        {stage === "contact" && (
          <motion.div key="contact" initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-[2rem] bg-white p-6 shadow-soft ring-1 ring-line sm:p-12">
            <h2 className="text-2xl font-semibold text-navy-900">{d.contactTitle}</h2>
            <p className="mt-3 max-w-2xl text-ink-muted">{d.contactIntro}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[true, false].map((v) => (
                <button key={String(v)} type="button" aria-pressed={wantsContact === v} onClick={() => setWantsContact(v)}
                  className={`rounded-2xl px-5 py-4 text-left font-medium ring-1 transition ${wantsContact === v ? "bg-navy-900 text-white ring-navy-900" : "bg-paper text-navy-900 ring-line hover:ring-navy-900/30"}`}>
                  {v ? d.contactYes : d.contactNo}
                </button>
              ))}
            </div>
            <AnimatePresence>
              {wantsContact && (
                <motion.div initial={reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="grid gap-4 pt-6 sm:grid-cols-2">
                    <Field label={d.name} value={contact.name} onChange={(v) => setContact({ ...contact, name: v })} autoComplete="name" required />
                    <Field label={d.phone} value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} autoComplete="tel" inputMode="tel" required />
                    <Field label={`${d.email}${contact.preferred === "email" ? "" : ` (${d.optional})`}`} value={contact.email} onChange={(v) => setContact({ ...contact, email: v })} autoComplete="email" inputMode="email" type="email" required={contact.preferred === "email"} />
                    <Field label={d.age} value={contact.age} onChange={(v) => setContact({ ...contact, age: v.replace(/\D/g, "").slice(0, 3) })} inputMode="numeric" required />
                    <label className="text-sm font-medium text-ink-soft sm:col-span-2">
                      {d.preferred}
                      <select className="mt-1.5 h-12 w-full rounded-2xl border-0 bg-paper px-4 text-navy-900 ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-teal-500" value={contact.preferred} onChange={(e) => setContact({ ...contact, preferred: e.target.value as Contact["preferred"] })}>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="call">{lang === "ms" ? "Panggilan telefon" : "Phone call"}</option>
                        <option value="email">{d.email}</option>
                      </select>
                    </label>
                    <label className="flex cursor-pointer gap-3 text-sm text-ink-soft sm:col-span-2">
                      <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-teal-600" checked={contactConsent} onChange={(e) => setContactConsent(e.target.checked)} />
                      {d.contactConsent}
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {/* Honeypot */}
            <div aria-hidden className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
              <label>Website<input id="kn-website" tabIndex={-1} autoComplete="off" /></label>
            </div>
            {error && <p role="alert" className="mt-4 text-sm font-medium text-danger">{error}</p>}
            <div className="mt-8 flex flex-col-reverse justify-between gap-3 sm:flex-row">
              <button type="button" onClick={() => { setStage("questions"); if (mode === "step") setStep(steps.length - 1); }} className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-navy-900 ring-1 ring-line"><ArrowLeft className="h-4 w-4" />{d.previous}</button>
              <button type="button" disabled={submitting || wantsContact === null || (wantsContact && (!contact.name || !contact.phone || !contact.age || Number(contact.age) < 18))} onClick={submit}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-teal-500 px-8 text-base font-semibold text-navy-950 shadow-glow transition hover:bg-teal-400 disabled:opacity-40">
                {submitting ? d.submitting : d.submit} {!submitting && <ArrowRight className="h-5 w-5" />}
              </button>
            </div>
            {wantsContact && Number(contact.age) > 0 && Number(contact.age) < 18 && (
              <p className="mt-3 text-sm text-warning">{lang === "ms" ? "Saringan dalam talian ini untuk individu berumur 18 tahun ke atas." : "This online screening is for people aged 18 and over."}</p>
            )}
          </motion.div>
        )}

        {stage === "results" && result && (
          <motion.div key="results" initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="space-y-5">
            {result.item9Positive && <SafetyCard d={d} />}
            <div className="rounded-[2rem] bg-white p-6 shadow-soft ring-1 ring-line sm:p-12">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-semibold text-navy-900">{d.resultsTitle}</h2>
                  <p className="mt-2 inline-flex items-center gap-2 text-sm text-ink-muted"><ShieldCheck className="h-4 w-4 text-teal-600" />{d.notDiagnosis}</p>
                </div>
                <div className="rounded-2xl bg-paper px-4 py-3 text-right ring-1 ring-line">
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">{d.reference}</p>
                  <p className="font-mono text-lg font-semibold tracking-wider text-navy-900">{result.reference}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-ink-muted">{d.referenceNote}</p>

              <div className="mt-10 grid gap-5 md:grid-cols-2">
                {(["phq9", "gad7"] as const).map((inst) => {
                  const r = result[inst];
                  if (!r) return null;
                  return (
                    <div key={inst} className="rounded-[1.5rem] bg-paper p-6 ring-1 ring-line">
                      <div className="flex items-center gap-6">
                        <ScoreRing score={r.score} max={INSTRUMENTS[inst].maxScore} severity={r.severity} reduce={!!reduce} />
                        <div>
                          <p className="text-sm font-semibold text-teal-700">{INSTRUMENTS[inst].title[lang]}</p>
                          <p className="mt-1 text-sm text-ink-muted">{d.score}: {r.score}/{INSTRUMENTS[inst].maxScore}</p>
                          <p className="mt-2 text-xl font-semibold text-navy-900">{d.severity}: {sevLabels[r.severity]}</p>
                        </div>
                      </div>
                      <p className="mt-5 leading-relaxed text-ink-soft">{d.interpretation[r.severity]}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <a href={bookHref} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-navy-900 px-6 text-sm font-semibold text-white transition hover:bg-navy-700">
                  <WhatsAppIcon className="h-4 w-4 text-teal-400" />{d.bookCta}
                </a>
                <button type="button" onClick={() => window.print()} className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-navy-900 ring-1 ring-line print:hidden"><Printer className="h-4 w-4" />{d.print}</button>
                <button type="button" onClick={restart} className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-navy-900 ring-1 ring-line print:hidden"><RotateCcw className="h-4 w-4" />{d.retake}</button>
              </div>
              <p className="mt-6 text-xs text-ink-muted">{d.notStoredNote}</p>
              <p className="mt-2 text-xs text-ink-muted">{lang === "ms" ? "Pautan WhatsApp di atas hanya membuka mesej temujanji umum — keputusan anda tidak dikongsi." : "The WhatsApp link above only opens a general booking message — your results are not shared."}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Immediate safety guidance for PHQ-9 item 9 */}
      <AnimatePresence>
        {safetyOpen && (
          <motion.div className="fixed inset-0 z-[70] flex items-end justify-center bg-navy-950/60 p-4 backdrop-blur-sm sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div role="alertdialog" aria-modal="true" aria-labelledby="safety-title" initial={reduce ? false : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ duration: 0.4, ease: EASE }}
              className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[2rem] bg-white p-6 shadow-lift sm:p-8">
              <SafetyCard d={d} titleId="safety-title" />
              <button type="button" autoFocus onClick={() => { setSafetyOpen(false); setSafetyAcknowledged(true); }}
                className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-navy-900 text-sm font-semibold text-white">
                {d.safety.continue}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {item9Positive && stage === "questions" && !safetyOpen && (
        <p className="mt-4 text-center text-sm">
          <button type="button" onClick={() => setSafetyOpen(true)} className="font-semibold text-danger underline underline-offset-4">{d.safety.title}</button>
        </p>
      )}
    </div>
  );
}

function SafetyCard({ d, titleId }: { d: Dictionary["screening"]; titleId?: string }) {
  return (
    <div className="rounded-[1.5rem] border border-danger/25 bg-danger-soft p-6">
      <h2 id={titleId} className="text-xl font-semibold text-navy-900">{d.safety.title}</h2>
      <p className="mt-2 leading-relaxed text-ink-soft">{d.safety.body}</p>
      <p className="mt-4 text-sm font-semibold text-danger">{d.safety.immediate}</p>
      <div className="mt-3 grid gap-2">
        <a href="tel:999" className="flex items-center gap-3 rounded-2xl bg-danger px-4 py-3 font-semibold text-white"><Phone className="h-5 w-5" />{d.safety.call999}</a>
        <p className="px-1 text-sm text-ink-soft">{d.safety.hospital}</p>
        <a href="tel:15555" className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-navy-900 ring-1 ring-line"><Phone className="h-4 w-4 text-teal-600" />{d.safety.heal}</a>
        <a href="tel:+60376272929" className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-navy-900 ring-1 ring-line"><Phone className="h-4 w-4 text-teal-600" />{d.safety.befrienders}</a>
      </div>
      <p className="mt-4 text-sm text-ink-soft">{d.safety.trusted}</p>
      <p className="mt-3 text-xs text-ink-muted">{d.safety.noMonitoring}</p>
    </div>
  );
}

function QuestionBlock({ id, number, text, options, value, onChange, large, invalid }: {
  id: string; number: number | null; text: string; options: { value: number; label: string }[]; value: number | null; onChange: (v: number) => void; large?: boolean; invalid?: boolean;
}) {
  return (
    <fieldset aria-invalid={invalid || undefined}>
      <legend id={`${id}-legend`} className={`${large ? "mt-3 text-2xl sm:text-[1.75rem]" : "text-lg"} font-semibold leading-snug text-navy-900`}>
        {number !== null && <span className="mr-2 text-teal-600">{number}.</span>}
        {text}
      </legend>
      <div role="radiogroup" aria-labelledby={`${id}-legend`} className={`mt-5 grid gap-2.5 ${large ? "sm:grid-cols-2" : "sm:grid-cols-4"}`}>
        {options.map((o) => {
          const on = value === o.value;
          return (
            <label key={o.value} className={`group relative flex cursor-pointer items-center gap-3 rounded-2xl px-4 ${large ? "py-4" : "py-3"} ring-1 transition-all duration-200 ${on ? "bg-navy-900 text-white ring-navy-900" : `bg-paper text-navy-900 ${invalid ? "ring-danger/60" : "ring-line"} hover:ring-teal-500/60`}`}>
              <input type="radio" name={id} value={o.value} checked={on} onChange={() => onChange(o.value)} className="sr-only" />
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${on ? "bg-teal-500 text-navy-950" : "bg-white text-ink-muted ring-1 ring-line"}`}>{o.value}</span>
              <span className={`${large ? "text-base" : "text-sm"} font-medium`}>{o.label}</span>
              <span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-teal-500 opacity-0 group-has-[:focus-visible]:opacity-100" />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Field({ label, value, onChange, ...rest }: { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="text-sm font-medium text-ink-soft">
      {label}
      <input {...rest} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1.5 h-12 w-full rounded-2xl border-0 bg-paper px-4 text-navy-900 ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-teal-500" />
    </label>
  );
}

function ScoreRing({ score, max, severity, reduce }: { score: number; max: number; severity: Severity; reduce: boolean }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const color = { minimal: "#00B7B1", mild: "#2FD0C9", moderate: "#E3A008", moderately_severe: "#E07A2E", severe: "#B42318" }[severity];
  return (
    <svg viewBox="0 0 80 80" className="h-24 w-24 shrink-0 -rotate-90" aria-hidden>
      <circle cx="40" cy="40" r={r} fill="none" stroke="#E3EAF2" strokeWidth="7" />
      <motion.circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={c}
        initial={{ strokeDashoffset: reduce ? c - (score / max) * c : c }} animate={{ strokeDashoffset: c - (score / max) * c }} transition={{ duration: 1.4, ease: EASE, delay: 0.2 }} />
      <text x="40" y="40" textAnchor="middle" dominantBaseline="central" className="rotate-90 fill-navy-900 text-[1.4rem] font-semibold" style={{ transformOrigin: "40px 40px" }}>{score}</text>
    </svg>
  );
}

// Re-export for server-side preview/testing of client-side severity logic parity.
export const clientSeverity = { phq9: phq9Severity, gad7: gad7Severity };
