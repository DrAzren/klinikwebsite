"use client";

/**
 * BMI & waist check using the Asian cut-offs adopted in Malaysian clinical
 * practice guidelines (normal 18.5–22.9, overweight 23–27.4, obese ≥27.5;
 * increased waist risk ≥90 cm men / ≥80 cm women). Educational only —
 * calculated in the browser and never sent anywhere.
 */
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n/config";

const L = {
  ms: {
    title: "Semak BMI anda", height: "Tinggi (cm)", weight: "Berat (kg)", waist: "Lilitan pinggang (cm, pilihan)", sex: "Jantina",
    male: "Lelaki", female: "Perempuan", result: "BMI anda",
    cats: { under: "Kurang berat badan", normal: "Normal", over: "Berlebihan berat badan", obese1: "Obes (tahap I)", obese2: "Obes (tahap II)", obese3: "Obes (tahap III)" },
    waistRisk: "Lilitan pinggang menunjukkan risiko metabolik yang meningkat.",
    note: "Pengiraan dibuat dalam pelayar anda sahaja dan tidak disimpan. Menggunakan nilai potong Asia yang digunakan dalam garis panduan klinikal Malaysia. Ini bukan diagnosis — bincang dengan doktor untuk penilaian penuh.",
  },
  en: {
    title: "Check your BMI", height: "Height (cm)", weight: "Weight (kg)", waist: "Waist (cm, optional)", sex: "Sex",
    male: "Male", female: "Female", result: "Your BMI",
    cats: { under: "Underweight", normal: "Normal", over: "Overweight", obese1: "Obese (class I)", obese2: "Obese (class II)", obese3: "Obese (class III)" },
    waistRisk: "Your waist measurement suggests increased metabolic risk.",
    note: "Calculated in your browser only and never stored. Uses the Asian cut-offs applied in Malaysian clinical guidelines. Not a diagnosis — talk to a doctor for a full assessment.",
  },
};

type Cat = keyof (typeof L)["en"]["cats"];

export function bmiCategory(bmi: number): Cat {
  if (bmi < 18.5) return "under";
  if (bmi < 23) return "normal";
  if (bmi < 27.5) return "over";
  if (bmi < 35) return "obese1";
  if (bmi < 40) return "obese2";
  return "obese3";
}

export function BmiTool({ lang }: { lang: Locale }) {
  const c = L[lang];
  const [h, setH] = useState("");
  const [w, setW] = useState("");
  const [waist, setWaist] = useState("");
  const [sex, setSex] = useState<"m" | "f">("f");
  const bmi = useMemo(() => {
    const hm = Number(h) / 100;
    const kg = Number(w);
    if (!(hm > 1 && hm < 2.5 && kg > 25 && kg < 350)) return null;
    return kg / (hm * hm);
  }, [h, w]);
  const cat = bmi ? bmiCategory(bmi) : null;
  const waistHigh = Number(waist) > 0 && Number(waist) >= (sex === "m" ? 90 : 80);
  const pct = bmi ? Math.min(100, Math.max(0, ((bmi - 15) / (40 - 15)) * 100)) : 0;

  const input = "mt-1.5 h-12 w-full rounded-2xl border-0 bg-paper px-4 text-lg text-navy-900 ring-1 ring-line focus:ring-2 focus:ring-teal-500 focus:outline-none";
  return (
    <div className="rounded-[2rem] bg-white p-6 shadow-soft ring-1 ring-line sm:p-10">
      <h2 className="text-2xl font-semibold text-navy-900">{c.title}</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-ink-soft">{c.height}<input className={input} inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} placeholder="160" /></label>
        <label className="text-sm font-medium text-ink-soft">{c.weight}<input className={input} inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} placeholder="65" /></label>
        <label className="text-sm font-medium text-ink-soft">{c.waist}<input className={input} inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value)} placeholder="85" /></label>
        <fieldset className="text-sm font-medium text-ink-soft">
          <legend>{c.sex}</legend>
          <div className="mt-1.5 grid h-12 grid-cols-2 rounded-2xl bg-paper p-1 ring-1 ring-line">
            {(["f", "m"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={sex === s} onClick={() => setSex(s)} className={`rounded-xl text-sm font-semibold transition ${sex === s ? "bg-navy-900 text-white" : "text-ink-soft"}`}>
                {s === "m" ? c.male : c.female}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <div aria-live="polite" className="mt-8">
        <AnimatePresence mode="wait">
          {bmi && cat && (
            <motion.div key={cat} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl bg-mint p-6">
              <p className="text-sm text-ink-muted">{c.result}</p>
              <p className="mt-1 text-4xl font-semibold text-navy-900">{bmi.toFixed(1)} <span className="text-lg font-medium text-teal-700">· {c.cats[cat]}</span></p>
              <div className="relative mt-5 h-2.5 rounded-full bg-gradient-to-r from-sky-300 via-teal-400 via-35% to-rose-400">
                <motion.span className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-navy-900 shadow" animate={{ left: `${pct}%` }} transition={{ type: "spring", stiffness: 200, damping: 22 }} />
              </div>
              {waistHigh && <p className="mt-4 text-sm font-medium text-warning">{c.waistRisk}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="mt-6 text-xs leading-relaxed text-ink-muted">{c.note}</p>
    </div>
  );
}
