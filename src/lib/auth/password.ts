/**
 * Password hashing with Argon2id (OWASP-recommended parameters) and a
 * password policy for staff accounts.
 */
import { hash, verify } from "@node-rs/argon2";
import { randomInt } from "node:crypto";

const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1, algorithm: 2 /* Argon2id */ } as const;

export const hashPassword = (pw: string) => hash(pw, OPTIONS);

export async function verifyPassword(hashStr: string, pw: string): Promise<boolean> {
  try {
    return await verify(hashStr, pw);
  } catch {
    return false;
  }
}

/** A fixed dummy hash so unknown usernames take the same time to reject. */
let dummy: Promise<string> | null = null;
export async function burnPasswordCheck(pw: string) {
  dummy ??= hash("not-a-real-password-for-timing", OPTIONS);
  await verifyPassword(await dummy, pw);
}

export interface PolicyResult {
  ok: boolean;
  errors: string[];
}

const COMMON = ["password", "klinik", "nissa", "azren", "12345678", "qwerty", "admin"];

export function checkPasswordPolicy(pw: string, context: { username?: string; email?: string } = {}): PolicyResult {
  const errors: string[] = [];
  if (pw.length < 12) errors.push("At least 12 characters / Sekurang-kurangnya 12 aksara");
  if (pw.length > 128) errors.push("At most 128 characters");
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes < 3) errors.push("Use at least three of: lowercase, uppercase, number, symbol");
  const lower = pw.toLowerCase();
  if (COMMON.some((w) => lower.includes(w))) errors.push("Avoid common words such as the clinic name");
  if (context.username && lower.includes(context.username.toLowerCase())) errors.push("Must not contain your username");
  if (context.email && lower.includes(context.email.split("@")[0].toLowerCase())) errors.push("Must not contain your email");
  return { ok: errors.length === 0, errors };
}

/** Temporary password for new accounts: shown once to the Super Admin, must be changed at first login. */
export function generateTempPassword(): string {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%*?-"];
  const all = sets.join("");
  const chars = sets.map((s) => s[randomInt(s.length)]);
  while (chars.length < 16) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
