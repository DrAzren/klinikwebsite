"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import {
  changePassword, confirmMfaEnrollment, consumePasswordReset, createSession, login, nextStage, requestPasswordReset,
  revokeSession, setSessionStage, verifyMfaCode, type SessionStage,
} from "@/lib/auth/service";
import { getStaffSession } from "@/lib/auth/dal";
import { clearSessionCookie, readSessionToken, requestMeta, setSessionCookie } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/integrations/email";
import type { ActionResult } from "@/lib/staff/action-result";

const STAGE_PATH: Record<SessionStage, string> = {
  active: "/staff/dashboard",
  password_change: "/staff/reset",
  mfa_pending: "/staff/mfa",
  mfa_enroll: "/staff/mfa/setup",
};

export async function loginAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const username = String(fd.get("username") ?? "").slice(0, 64);
  const password = String(fd.get("password") ?? "").slice(0, 200);
  if (!username || !password) return { ok: false, error: "Enter your username and password / Masukkan nama pengguna dan kata laluan." };
  const db = await getDb();
  const meta = await requestMeta();
  const ipLimit = await rateLimit(db, "login-ip", meta.ip ?? "unknown", 30, 900);
  if (!ipLimit.allowed) return { ok: false, error: "Too many attempts. Try again in 15 minutes / Terlalu banyak cubaan." };
  const res = await login(db, username, password, meta);
  if (!res.ok) {
    return {
      ok: false,
      error: res.reason === "locked"
        ? "Account temporarily locked after repeated failures. Try again in 15 minutes or contact the Super Admin."
        : "Incorrect username or password / Nama pengguna atau kata laluan salah.",
    };
  }
  await setSessionCookie(res.token);
  redirect(STAGE_PATH[res.stage]);
}

export async function logoutAction() {
  const token = await readSessionToken();
  if (token) await revokeSession(await getDb(), token);
  await clearSessionCookie();
  redirect("/staff/login");
}

/** Rotate the session token when privilege level changes (prevents session fixation). */
async function rotate(stage: SessionStage, userId: string) {
  const db = await getDb();
  const old = await readSessionToken();
  if (old) await revokeSession(db, old);
  const token = await createSession(db, userId, stage, await requestMeta());
  await setSessionCookie(token);
}

export async function firstLoginPasswordAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await getStaffSession();
  if (!s) redirect("/staff/login");
  const next = String(fd.get("next") ?? "");
  if (next !== String(fd.get("confirm") ?? "")) return { ok: false, error: "Passwords do not match / Kata laluan tidak sepadan." };
  const db = await getDb();
  const res = await changePassword(db, s.user, String(fd.get("current") ?? ""), next, await requestMeta());
  if (!res.ok) return { ok: false, error: res.errors.join(" · ") };
  const stage = nextStage({ must_change_password: false, mfa_enabled: s.user.mfa_enabled });
  await rotate(stage, s.user.id);
  redirect(STAGE_PATH[stage]);
}

export async function accountPasswordAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await getStaffSession();
  if (!s || s.stage !== "active") return { ok: false, error: "Please sign in again." };
  const next = String(fd.get("next") ?? "");
  if (next !== String(fd.get("confirm") ?? "")) return { ok: false, error: "Passwords do not match." };
  const res = await changePassword(await getDb(), s.user, String(fd.get("current") ?? ""), next, await requestMeta());
  return res.ok ? { ok: true, message: "Password updated / Kata laluan dikemas kini." } : { ok: false, error: res.errors.join(" · ") };
}

export async function forgotAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = String(fd.get("identifier") ?? "").slice(0, 200);
  const generic: ActionResult = { ok: true, message: "If the account exists, a reset link has been sent to its email. / Jika akaun wujud, pautan set semula telah dihantar." };
  if (!id) return { ok: false, error: "Enter your username or email." };
  const db = await getDb();
  const meta = await requestMeta();
  const rl = await rateLimit(db, "forgot", meta.ip ?? "unknown", 5, 3600);
  if (!rl.allowed) return generic;
  const r = await requestPasswordReset(db, id, meta);
  if (r) {
    const link = `${env().SITE_URL}/staff/reset?token=${encodeURIComponent(r.token)}`;
    await sendEmail(db, {
      to: [r.user.email],
      subject: "Klinik Nissa staff portal — password reset",
      text: `Hello ${r.user.full_name},\n\nUse this link within 30 minutes to set a new password:\n${link}\n\nIf you did not request this, ignore this email and tell the Super Admin.\n`,
    }).catch((e) => console.error("[forgot] email failed", e));
  }
  return generic;
}

export async function resetWithTokenAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const token = String(fd.get("token") ?? "");
  const next = String(fd.get("next") ?? "");
  if (next !== String(fd.get("confirm") ?? "")) return { ok: false, error: "Passwords do not match." };
  const res = await consumePasswordReset(await getDb(), token, next, await requestMeta());
  if (!res.ok) return { ok: false, error: res.errors.join(" · ") };
  redirect("/staff/login?reset=1");
}

export async function mfaVerifyAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await getStaffSession();
  if (!s || s.stage !== "mfa_pending") redirect("/staff/login");
  const db = await getDb();
  const rl = await rateLimit(db, "mfa", s.id, 6, 600);
  if (!rl.allowed) return { ok: false, error: "Too many codes tried. Sign in again in 10 minutes." };
  if (!(await verifyMfaCode(db, s.user, String(fd.get("code") ?? ""), await requestMeta()))) return { ok: false, error: "Invalid code / Kod tidak sah." };
  await rotate("active", s.user.id);
  redirect("/staff/dashboard");
}

export async function mfaConfirmAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const s = await getStaffSession();
  if (!s || (s.stage !== "mfa_enroll" && s.stage !== "active")) redirect("/staff/login");
  const db = await getDb();
  if (!(await confirmMfaEnrollment(db, s.user, String(fd.get("code") ?? ""), await requestMeta()))) {
    return { ok: false, error: "That code didn't match. Check your phone's time and try the newest code." };
  }
  if (s.stage === "mfa_enroll") {
    await rotate("active", s.user.id);
    redirect("/staff/dashboard");
  }
  await setSessionStage(db, s.id, "active");
  return { ok: true, message: "Two-factor authentication enabled." };
}
