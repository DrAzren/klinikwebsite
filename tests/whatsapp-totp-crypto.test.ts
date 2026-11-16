import { describe, expect, it } from "vitest";
import { displayPhone, normaliseMsisdn, prefillText, whatsappLink, WHATSAPP_TOPICS } from "@/lib/whatsapp";
import { base32Decode, base32Encode, hotp, totp, verifyTotp } from "@/lib/auth/totp";
import { decryptJson, encryptJson, referenceCode } from "@/lib/crypto";
import { checkPasswordPolicy, generateTempPassword } from "@/lib/auth/password";
import { localePath, switchLocalePath } from "@/lib/i18n/config";

describe("WhatsApp links", () => {
  it("normalises Malaysian numbers", () => {
    expect(normaliseMsisdn("+60126081411")).toBe("60126081411");
    expect(normaliseMsisdn("012-608 1411")).toBe("60126081411");
    expect(() => normaliseMsisdn("12345")).toThrow();
  });
  it("builds a wa.me link with a fixed, service-specific prefill", () => {
    const url = new URL(whatsappLink("0126081411", "mental", "ms"));
    expect(url.hostname).toBe("wa.me");
    expect(url.pathname).toBe("/60126081411");
    expect(url.searchParams.get("text")).toMatch(/kesihatan mental/);
  });
  it("has distinct prefills for every topic in both languages", () => {
    for (const lang of ["ms", "en"] as const) {
      const texts = WHATSAPP_TOPICS.map((t) => prefillText(t, lang));
      expect(new Set(texts).size).toBe(WHATSAPP_TOPICS.length);
    }
  });
  it("never carries screening data: prefills contain no scores or questionnaire terms", () => {
    for (const lang of ["ms", "en"] as const) {
      for (const topic of WHATSAPP_TOPICS) {
        const text = prefillText(topic, lang);
        expect(text).not.toMatch(/PHQ|GAD|skor|score|\d+\s*\/\s*2[17]/i);
      }
    }
  });
  it("rejects unknown topics (no arbitrary text injection)", () => {
    // @ts-expect-error — runtime guard
    expect(() => whatsappLink("0126081411", "PHQ-9 score 20", "ms")).toThrow();
  });
  it("formats for display", () => {
    expect(displayPhone("60126081411")).toBe("+60 12-608 1411");
  });
});

describe("TOTP (RFC 6238 / 4226 vectors)", () => {
  const rfcSecret = base32Encode(Buffer.from("12345678901234567890"));
  it("round-trips base32", () => {
    expect(base32Decode(rfcSecret).toString()).toBe("12345678901234567890");
  });
  it("matches RFC 4226 HOTP vectors", () => {
    const expected = ["755224", "287082", "359152", "969429", "338314"];
    expected.forEach((code, i) => expect(hotp(Buffer.from("12345678901234567890"), i)).toBe(code));
  });
  it("matches RFC 6238 SHA-1 vector at T=59s (8 digits truncated to 6)", () => {
    // RFC value 94287082 → last 6 digits 287082
    expect(totp(rfcSecret, 59_000)).toBe("287082");
  });
  it("verifies with ±1 step drift and rejects garbage", () => {
    const now = 1_700_000_000_000;
    expect(verifyTotp(rfcSecret, totp(rfcSecret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(rfcSecret, totp(rfcSecret, now - 90_000), now)).toBe(false);
    expect(verifyTotp(rfcSecret, "abc123", now)).toBe(false);
  });
});

describe("field encryption", () => {
  it("round-trips and binds to associated data", () => {
    const enc = encryptJson({ a: [1, 2, 3] }, "screening:KN-1");
    expect(enc.startsWith("v1.")).toBe(true);
    expect(decryptJson(enc, "screening:KN-1")).toEqual({ a: [1, 2, 3] });
    expect(() => decryptJson(enc, "screening:KN-2")).toThrow();
  });
  it("produces different ciphertexts for the same plaintext", () => {
    expect(encryptJson("x")).not.toBe(encryptJson("x"));
  });
  it("reference codes are well-formed", () => {
    expect(referenceCode()).toMatch(/^KN-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  });
});

describe("password policy", () => {
  it("rejects weak passwords and accepts strong ones", () => {
    expect(checkPasswordPolicy("short").ok).toBe(false);
    expect(checkPasswordPolicy("klinikNissa2026!").ok).toBe(false);
    expect(checkPasswordPolicy("alllowercaseletters").ok).toBe(false);
    expect(checkPasswordPolicy("Tenang-Laut-47-Biru").ok).toBe(true);
  });
  it("generated temporary passwords satisfy the policy", () => {
    for (let i = 0; i < 50; i++) expect(checkPasswordPolicy(generateTempPassword()).ok).toBe(true);
  });
});

describe("locale paths", () => {
  it("BM at root, English under /en", () => {
    expect(localePath("ms", "/services")).toBe("/services");
    expect(localePath("en", "/services")).toBe("/en/services");
    expect(localePath("en", "/")).toBe("/en");
    expect(switchLocalePath("/en/services", "ms")).toBe("/services");
    expect(switchLocalePath("/", "en")).toBe("/en");
    expect(switchLocalePath("/en", "ms")).toBe("/");
  });
});
