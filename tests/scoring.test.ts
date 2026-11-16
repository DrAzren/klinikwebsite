import { describe, expect, it } from "vitest";
import {
  gad7Severity,
  isSafetyItemPositive,
  phq9Severity,
  priorityFor,
  scoreScreening,
  ScoringError,
  validateAnswers,
} from "@/lib/screening/scoring";
import { GAD7, PHQ9, PHQ9_SAFETY_ITEM_INDEX } from "@/lib/screening/instruments";

const phq = (...a: number[]) => a;

describe("instrument definitions", () => {
  it("PHQ-9 has 9 bilingual items and GAD-7 has 7", () => {
    expect(PHQ9.items).toHaveLength(9);
    expect(GAD7.items).toHaveLength(7);
    for (const item of [...PHQ9.items, ...GAD7.items]) {
      expect(item.ms.length).toBeGreaterThan(5);
      expect(item.en.length).toBeGreaterThan(5);
    }
  });
  it("safety item is PHQ-9 item 9 (thoughts of self-harm)", () => {
    expect(PHQ9_SAFETY_ITEM_INDEX).toBe(8);
    expect(PHQ9.items[8].en).toMatch(/better off dead/i);
  });
});

describe("PHQ-9 severity bands", () => {
  it.each([
    [0, "minimal"], [4, "minimal"],
    [5, "mild"], [9, "mild"],
    [10, "moderate"], [14, "moderate"],
    [15, "moderately_severe"], [19, "moderately_severe"],
    [20, "severe"], [27, "severe"],
  ])("score %i → %s", (score, sev) => {
    expect(phq9Severity(score)).toBe(sev);
  });
  it("rejects out-of-range totals", () => {
    expect(() => phq9Severity(28)).toThrow(ScoringError);
    expect(() => phq9Severity(-1)).toThrow(ScoringError);
  });
});

describe("GAD-7 severity bands", () => {
  it.each([
    [0, "minimal"], [4, "minimal"],
    [5, "mild"], [9, "mild"],
    [10, "moderate"], [14, "moderate"],
    [15, "severe"], [21, "severe"],
  ])("score %i → %s", (score, sev) => {
    expect(gad7Severity(score)).toBe(sev);
  });
  it("rejects out-of-range totals", () => {
    expect(() => gad7Severity(22)).toThrow(ScoringError);
  });
});

describe("answer validation", () => {
  it("requires exactly 9 PHQ-9 and 7 GAD-7 answers", () => {
    expect(() => validateAnswers("phq9", [0, 0, 0])).toThrow(ScoringError);
    expect(() => validateAnswers("gad7", new Array(9).fill(0))).toThrow(ScoringError);
  });
  it("rejects non-integer, negative, >3 and non-numeric answers", () => {
    expect(() => validateAnswers("gad7", [0, 0, 0, 0, 0, 0, 4])).toThrow();
    expect(() => validateAnswers("gad7", [0, 0, 0, 0, 0, 0, -1])).toThrow();
    expect(() => validateAnswers("gad7", [0, 0, 0, 0, 0, 0, 1.5])).toThrow();
    expect(() => validateAnswers("gad7", [0, 0, 0, 0, 0, 0, "3"])).toThrow();
    expect(() => validateAnswers("gad7", null)).toThrow();
  });
});

describe("scoreScreening", () => {
  it("computes totals, max and severity for both instruments", () => {
    const r = scoreScreening({ phq9: phq(3, 3, 3, 3, 3, 3, 3, 3, 3), gad7: [3, 3, 3, 3, 3, 3, 3] });
    expect(r.phq9).toEqual({ instrument: "phq9", score: 27, max: 27, severity: "severe" });
    expect(r.gad7).toEqual({ instrument: "gad7", score: 21, max: 21, severity: "severe" });
  });
  it("all zeros → minimal, routine", () => {
    const r = scoreScreening({ phq9: new Array(9).fill(0), gad7: new Array(7).fill(0) });
    expect(r.phq9?.score).toBe(0);
    expect(r.gad7?.score).toBe(0);
    expect(r.priority).toBe("routine");
    expect(r.item9Positive).toBe(false);
  });
  it("supports a single instrument", () => {
    const r = scoreScreening({ gad7: [1, 1, 1, 1, 1, 1, 1] });
    expect(r.phq9).toBeUndefined();
    expect(r.gad7?.score).toBe(7);
    expect(r.item9Value).toBeNull();
  });
  it("requires at least one instrument", () => {
    expect(() => scoreScreening({})).toThrow(ScoringError);
  });
});

describe("PHQ-9 item 9 safety flag", () => {
  it.each([1, 2, 3])("any non-zero item 9 (%i) is positive and urgent even when total is low", (v) => {
    const answers = [0, 0, 0, 0, 0, 0, 0, 0, v];
    expect(isSafetyItemPositive(answers)).toBe(true);
    const r = scoreScreening({ phq9: answers });
    expect(r.item9Positive).toBe(true);
    expect(r.item9Value).toBe(v);
    expect(r.priority).toBe("urgent");
    expect(r.phq9?.severity).toBe("minimal"); // severity alone would not have flagged it
  });
  it("item 9 = 0 is not flagged", () => {
    expect(isSafetyItemPositive([3, 3, 3, 3, 3, 3, 3, 3, 0])).toBe(false);
  });
  it("unanswered item 9 is not flagged (live UI state)", () => {
    expect(isSafetyItemPositive([1, 1, 1, 1, 1, 1, 1, 1])).toBe(false);
    expect(isSafetyItemPositive([1, 1, 1, 1, 1, 1, 1, 1, null])).toBe(false);
  });
});

describe("triage priority", () => {
  it("moderate or above on either tool → review", () => {
    expect(priorityFor({ phq9: { instrument: "phq9", score: 10, max: 27, severity: "moderate" }, item9Positive: false })).toBe("review");
    expect(priorityFor({ gad7: { instrument: "gad7", score: 10, max: 21, severity: "moderate" }, item9Positive: false })).toBe("review");
  });
  it("below 10 on both → routine", () => {
    expect(
      priorityFor({
        phq9: { instrument: "phq9", score: 9, max: 27, severity: "mild" },
        gad7: { instrument: "gad7", score: 9, max: 21, severity: "mild" },
        item9Positive: false,
      }),
    ).toBe("routine");
  });
  it("safety flag overrides everything", () => {
    expect(priorityFor({ item9Positive: true })).toBe("urgent");
  });
});
