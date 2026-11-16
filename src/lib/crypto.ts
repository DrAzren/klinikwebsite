/**
 * Application-level encryption for sensitive fields (screening answers and
 * contact details, TOTP secrets). This is in addition to the database
 * provider's encryption at rest and TLS in transit.
 *
 * Format: "v1.<iv b64url>.<tag b64url>.<ciphertext b64url>"  (AES-256-GCM)
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { env, isProduction } from "./env";

let warned = false;

function key(): Buffer {
  const raw = env().APP_ENCRYPTION_KEY;
  if (raw) {
    const buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) throw new Error("APP_ENCRYPTION_KEY must be 32 bytes, base64 encoded");
    return buf;
  }
  if (isProduction()) {
    throw new Error("APP_ENCRYPTION_KEY is required in production");
  }
  if (!warned) {
    warned = true;
    console.warn("[crypto] APP_ENCRYPTION_KEY not set — using an insecure development key. Never use real data.");
  }
  return createHash("sha256").update("klinik-nissa-insecure-development-key").digest();
}

export function encryptJson(value: unknown, aad = ""): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  if (aad) cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptJson<T>(payload: string, aad = ""): T {
  const [v, ivB, tagB, ctB] = payload.split(".");
  if (v !== "v1" || !ivB || !tagB || !ctB) throw new Error("Unsupported ciphertext format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64url"));
  if (aad) decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  const pt = Buffer.concat([decipher.update(Buffer.from(ctB, "base64url")), decipher.final()]);
  return JSON.parse(pt.toString("utf8")) as T;
}

export const sha256Hex = (input: string | Buffer) => createHash("sha256").update(input).digest("hex");

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Short human-friendly reference code, e.g. KN-7Q4M-2XRD (no ambiguous chars). */
export function referenceCode(prefix = "KN"): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${prefix}-${out.slice(0, 4)}-${out.slice(4)}`;
}
