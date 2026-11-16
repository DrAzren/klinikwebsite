/**
 * Scoring for PHQ-9 and GAD-7. Pure functions — shared by the browser (live
 * feedback) and the server (authoritative re-calculation on submission).
 *
 * Severity bands (standard):
 *   PHQ-9  0–4 minimal · 5–9 mild · 10–14 moderate · 15–19 moderately severe · 20–27 severe
 *   GAD-7  0–4 minimal · 5–9 mild · 10–14 moderate · 15–21 severe
 *
 * These are screening scores, not diagnoses.
 */
import { GAD7, PHQ9, PHQ9_SAFETY_ITEM_INDEX, type InstrumentId } from "./instruments";

export type Severity = "minimal" | "mild" | "moderate" | "moderately_severe" | "severe";
export type Priority = "urgent" | "review" | "routine";

export class ScoringError extends Error {}

export function validateAnswers(instrument: InstrumentId, answers: unknown): number[] {
  const expected = instrument === "phq9" ? PHQ9.items.length : GAD7.items.length;
  if (!Array.isArray(answers) || answers.length !== expected) {
    throw new ScoringError(`${instrument}: expected ${expected} answers`);
  }
  return answers.map((a, i) => {
    if (typeof a !== "number" || !Number.isInteger(a) || a < 0 || a > 3) {
      throw new ScoringError(`${instrument}: answer ${i + 1} must be an integer 0–3`);
    }
    return a;
  });
}

export function total(answers: number[]): number {
  return answers.reduce((s, a) => s + a, 0);
}

export function phq9Severity(score: number): Severity {
  if (score < 0 || score > 27) throw new ScoringError("PHQ-9 score out of range");
  if (score >= 20) return "severe";
  if (score >= 15) return "moderately_severe";
  if (score >= 10) return "moderate";
  if (score >= 5) return "mild";
  return "minimal";
}

export function gad7Severity(score: number): Severity {
  if (score < 0 || score > 21) throw new ScoringError("GAD-7 score out of range");
  if (score >= 15) return "severe";
  if (score >= 10) return "moderate";
  if (score >= 5) return "mild";
  return "minimal";
}

export interface InstrumentResult {
  instrument: InstrumentId;
  score: number;
  max: number;
  severity: Severity;
}

export interface ScreeningResult {
  phq9?: InstrumentResult;
  gad7?: InstrumentResult;
  item9Value: number | null;
  item9Positive: boolean;
  priority: Priority;
}

/** Any non-zero response to PHQ-9 item 9 triggers safety guidance and urgent review. */
export function isSafetyItemPositive(phq9Answers: (number | null | undefined)[]): boolean {
  const v = phq9Answers[PHQ9_SAFETY_ITEM_INDEX];
  return typeof v === "number" && v > 0;
}

export function scoreScreening(input: { phq9?: unknown; gad7?: unknown }): ScreeningResult {
  if (input.phq9 === undefined && input.gad7 === undefined) {
    throw new ScoringError("At least one questionnaire is required");
  }
  const result: ScreeningResult = { item9Value: null, item9Positive: false, priority: "routine" };

  if (input.phq9 !== undefined) {
    const a = validateAnswers("phq9", input.phq9);
    const score = total(a);
    result.phq9 = { instrument: "phq9", score, max: 27, severity: phq9Severity(score) };
    result.item9Value = a[PHQ9_SAFETY_ITEM_INDEX];
    result.item9Positive = isSafetyItemPositive(a);
  }
  if (input.gad7 !== undefined) {
    const a = validateAnswers("gad7", input.gad7);
    const score = total(a);
    result.gad7 = { instrument: "gad7", score, max: 21, severity: gad7Severity(score) };
  }

  result.priority = priorityFor(result);
  return result;
}

/**
 * Triage priority for the clinical review queue:
 *  - urgent:  PHQ-9 item 9 > 0
 *  - review:  PHQ-9 ≥ 10 or GAD-7 ≥ 10 (commonly used cut-off for further assessment)
 *  - routine: otherwise
 */
export function priorityFor(r: Pick<ScreeningResult, "phq9" | "gad7" | "item9Positive">): Priority {
  if (r.item9Positive) return "urgent";
  if ((r.phq9 && r.phq9.score >= 10) || (r.gad7 && r.gad7.score >= 10)) return "review";
  return "routine";
}

export const SEVERITY_LABEL: Record<Severity, { ms: string; en: string }> = {
  minimal: { ms: "Minimum", en: "Minimal" },
  mild: { ms: "Ringan", en: "Mild" },
  moderate: { ms: "Sederhana", en: "Moderate" },
  moderately_severe: { ms: "Sederhana teruk", en: "Moderately severe" },
  severe: { ms: "Teruk", en: "Severe" },
};
