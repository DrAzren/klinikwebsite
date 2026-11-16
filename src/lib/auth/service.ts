/**
 * Staff authentication core. Framework-agnostic (takes a Db) so it is fully
 * unit-tested; the Next.js cookie layer lives in ./session.ts.
 *
 * - Username + password (Argon2id); no self-registration.
 * - Account lockout after repeated failures; timing-equalised unknown users.
 * - Opaque session tokens: only SHA-256 hashes are stored server-side.
 * - Session stages enforce: first-login password change → MFA enrolment/verification → active.
 * - Idle (30 min) and absolute (12 h) session timeouts.
 */
import type { Db } from "../db";
import { audit } from "../audit";
import { decryptJson, encryptJson, randomToken, sha256Hex } from "../crypto";
import { mfaRequired } from "../env";
import { burnPasswordCheck, checkPasswordPolicy, hashPassword, verifyPassword } from "./password";
import { isRole, type Role } from "./rbac";
import { generateTotpSecret, verifyTotp } from "./totp";

export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000;
export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;
export const RESET_TOKEN_MS = 30 * 60 * 1000;

export type SessionStage = "active" | "mfa_pending" | "mfa_enroll" | "password_change";

export interface StaffUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: Role;
  must_change_password: boolean;
  mfa_enabled: boolean;
  is_active: boolean;
}

export interface SessionInfo {
  id: string;
  stage: SessionStage;
  user: StaffUser;
}

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

const USER_COLS = "id, username, email, full_name, role, must_change_password, mfa_enabled, is_active";

export function nextStage(user: Pick<StaffUser, "must_change_password" | "mfa_enabled">): SessionStage {
  if (user.must_change_password) return "password_change";
  if (user.mfa_enabled) return "mfa_pending";
  if (mfaRequired()) return "mfa_enroll";
  return "active";
}

export type LoginResult =
  | { ok: true; token: string; stage: SessionStage; user: StaffUser }
  | { ok: false; reason: "invalid" | "locked" };

export async function login(db: Db, username: string, password: string, meta: RequestMeta = {}): Promise<LoginResult> {
  const uname = username.trim().toLowerCase();
  const row = await db.one<StaffUser & { password_hash: string; locked_until: Date | null; failed_login_count: number }>(
    `select ${USER_COLS}, password_hash, locked_until, failed_login_count from staff_users where lower(username) = $1`,
    [uname],
  );
  if (!row) {
    await burnPasswordCheck(password);
    await audit(db, null, "auth.login_failed", { type: "staff_user" }, { reason: "unknown_user" }, meta.ip);
    return { ok: false, reason: "invalid" };
  }
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    await audit(db, { id: row.id, label: row.username }, "auth.login_locked", { type: "staff_user", id: row.id }, {}, meta.ip);
    return { ok: false, reason: "locked" };
  }
  const valid = await verifyPassword(row.password_hash, password);
  if (!valid || !row.is_active) {
    const failures = row.failed_login_count + 1;
    const lock = failures >= LOCKOUT_THRESHOLD ? new Date(Date.now() + LOCKOUT_MS).toISOString() : null;
    await db.query(
      "update staff_users set failed_login_count = $2, locked_until = coalesce($3::timestamptz, locked_until) where id = $1",
      [row.id, lock ? 0 : failures, lock],
    );
    await audit(db, { id: row.id, label: row.username }, lock ? "auth.account_locked" : "auth.login_failed",
      { type: "staff_user", id: row.id }, { reason: row.is_active ? "bad_password" : "inactive" }, meta.ip);
    return { ok: false, reason: lock ? "locked" : "invalid" };
  }

  await db.query("update staff_users set failed_login_count = 0, locked_until = null, last_login_at = now() where id = $1", [row.id]);
  const user = toUser(row);
  const stage = nextStage(user);
  const token = await createSession(db, user.id, stage, meta);
  await audit(db, { id: user.id, label: user.username }, "auth.login", { type: "staff_user", id: user.id }, { stage }, meta.ip);
  return { ok: true, token, stage, user };
}

export async function createSession(db: Db, userId: string, stage: SessionStage, meta: RequestMeta = {}): Promise<string> {
  const token = randomToken(32);
  await db.query(
    `insert into staff_sessions (token_hash, user_id, stage, expires_at, ip, user_agent)
     values ($1, $2, $3, $4, $5, $6)`,
    [sha256Hex(token), userId, stage, new Date(Date.now() + SESSION_ABSOLUTE_MS).toISOString(), meta.ip ?? null, (meta.userAgent ?? "").slice(0, 300)],
  );
  return token;
}

export async function resolveSession(db: Db, token: string | undefined | null, now = Date.now()): Promise<SessionInfo | null> {
  if (!token || token.length < 20 || token.length > 200) return null;
  const row = await db.one<StaffUser & { session_id: string; stage: SessionStage; last_seen_at: Date; expires_at: Date; revoked_at: Date | null }>(
    `select s.id as session_id, s.stage, s.last_seen_at, s.expires_at, s.revoked_at,
            u.id, u.username, u.email, u.full_name, u.role, u.must_change_password, u.mfa_enabled, u.is_active
       from staff_sessions s join staff_users u on u.id = s.user_id
      where s.token_hash = $1`,
    [sha256Hex(token)],
  );
  if (!row || row.revoked_at || !row.is_active || !isRole(row.role)) return null;
  if (new Date(row.expires_at).getTime() <= now) return null;
  if (new Date(row.last_seen_at).getTime() + SESSION_IDLE_MS <= now) {
    await db.query("update staff_sessions set revoked_at = now() where id = $1", [row.session_id]);
    return null;
  }
  // Throttle last_seen writes to once per minute.
  if (now - new Date(row.last_seen_at).getTime() > 60_000) {
    await db.query("update staff_sessions set last_seen_at = now() where id = $1", [row.session_id]);
  }
  return { id: row.session_id, stage: row.stage, user: toUser(row) };
}

export async function setSessionStage(db: Db, sessionId: string, stage: SessionStage) {
  await db.query("update staff_sessions set stage = $2 where id = $1", [sessionId, stage]);
}

export async function revokeSession(db: Db, token: string) {
  await db.query("update staff_sessions set revoked_at = now() where token_hash = $1 and revoked_at is null", [sha256Hex(token)]);
}

export async function revokeAllSessions(db: Db, userId: string, exceptSessionId?: string) {
  await db.query(
    "update staff_sessions set revoked_at = now() where user_id = $1 and revoked_at is null and ($2::uuid is null or id <> $2::uuid)",
    [userId, exceptSessionId ?? null],
  );
}

// ───────────── passwords ─────────────

export async function changePassword(db: Db, user: StaffUser, current: string | null, next: string, meta: RequestMeta = {}) {
  const policy = checkPasswordPolicy(next, { username: user.username, email: user.email });
  if (!policy.ok) return { ok: false as const, errors: policy.errors };
  const row = await db.one<{ password_hash: string }>("select password_hash from staff_users where id = $1", [user.id]);
  if (!row) return { ok: false as const, errors: ["User not found"] };
  if (current !== null && !(await verifyPassword(row.password_hash, current))) {
    return { ok: false as const, errors: ["Current password is incorrect / Kata laluan semasa salah"] };
  }
  if (await verifyPassword(row.password_hash, next)) {
    return { ok: false as const, errors: ["New password must be different / Kata laluan baharu mesti berbeza"] };
  }
  await db.query(
    "update staff_users set password_hash = $2, must_change_password = false, password_changed_at = now() where id = $1",
    [user.id, await hashPassword(next)],
  );
  await audit(db, { id: user.id, label: user.username }, "auth.password_changed", { type: "staff_user", id: user.id }, {}, meta.ip);
  return { ok: true as const };
}

/** Always behaves the same whether or not the account exists (no user enumeration). */
export async function requestPasswordReset(db: Db, identifier: string, meta: RequestMeta = {}): Promise<{ token: string; user: StaffUser } | null> {
  const id = identifier.trim().toLowerCase();
  const user = await db.one<StaffUser>(
    `select ${USER_COLS} from staff_users where (lower(username) = $1 or lower(email) = $1) and is_active`,
    [id],
  );
  if (!user) return null;
  const token = randomToken(32);
  await db.query(
    "insert into password_reset_tokens (user_id, token_hash, expires_at) values ($1, $2, $3)",
    [user.id, sha256Hex(token), new Date(Date.now() + RESET_TOKEN_MS).toISOString()],
  );
  await audit(db, { id: user.id, label: user.username }, "auth.password_reset_requested", { type: "staff_user", id: user.id }, {}, meta.ip);
  return { token, user: toUser(user) };
}

export async function consumePasswordReset(db: Db, token: string, next: string, meta: RequestMeta = {}) {
  const row = await db.one<{ id: string; user_id: string; expires_at: Date; used_at: Date | null }>(
    "select id, user_id, expires_at, used_at from password_reset_tokens where token_hash = $1",
    [sha256Hex(token)],
  );
  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false as const, errors: ["This reset link is invalid or has expired / Pautan tidak sah atau telah tamat tempoh"] };
  }
  const user = await db.one<StaffUser>(`select ${USER_COLS} from staff_users where id = $1`, [row.user_id]);
  if (!user || !user.is_active) return { ok: false as const, errors: ["Account unavailable"] };
  const res = await changePassword(db, toUser(user), null, next, meta);
  if (!res.ok) return res;
  await db.query("update password_reset_tokens set used_at = now() where id = $1", [row.id]);
  await revokeAllSessions(db, user.id);
  return { ok: true as const };
}

// ───────────── MFA ─────────────

export async function beginMfaEnrollment(db: Db, userId: string): Promise<string> {
  const secret = generateTotpSecret();
  await db.query("update staff_users set mfa_secret_enc = $2, mfa_enabled = false where id = $1", [userId, encryptJson(secret, `mfa:${userId}`)]);
  return secret;
}

export async function getPendingMfaSecret(db: Db, userId: string): Promise<string | null> {
  const row = await db.one<{ mfa_secret_enc: string | null; mfa_enabled: boolean }>(
    "select mfa_secret_enc, mfa_enabled from staff_users where id = $1",
    [userId],
  );
  if (!row?.mfa_secret_enc || row.mfa_enabled) return null;
  return decryptJson<string>(row.mfa_secret_enc, `mfa:${userId}`);
}

export async function confirmMfaEnrollment(db: Db, user: StaffUser, code: string, meta: RequestMeta = {}): Promise<boolean> {
  const secret = await getPendingMfaSecret(db, user.id);
  if (!secret || !verifyTotp(secret, code)) return false;
  await db.query("update staff_users set mfa_enabled = true where id = $1", [user.id]);
  await audit(db, { id: user.id, label: user.username }, "auth.mfa_enabled", { type: "staff_user", id: user.id }, {}, meta.ip);
  return true;
}

export async function verifyMfaCode(db: Db, user: StaffUser, code: string, meta: RequestMeta = {}): Promise<boolean> {
  const row = await db.one<{ mfa_secret_enc: string | null }>("select mfa_secret_enc from staff_users where id = $1 and mfa_enabled", [user.id]);
  const ok = !!row?.mfa_secret_enc && verifyTotp(decryptJson<string>(row.mfa_secret_enc, `mfa:${user.id}`), code);
  await audit(db, { id: user.id, label: user.username }, ok ? "auth.mfa_verified" : "auth.mfa_failed", { type: "staff_user", id: user.id }, {}, meta.ip);
  return ok;
}

// ───────────── account administration (Super Admin only — checked by caller) ─────────────

export interface NewStaffInput {
  username: string;
  email: string;
  fullName: string;
  role: Role;
  tempPassword: string;
}

export async function createStaffUser(db: Db, actor: { id: string; label: string }, input: NewStaffInput) {
  const username = input.username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error("Username must be 3–32 characters: letters, numbers, . _ -");
  const exists = await db.one("select 1 from staff_users where lower(username) = $1 or lower(email) = lower($2)", [username, input.email.trim()]);
  if (exists) throw new Error("Username or email already exists");
  const row = await db.one<{ id: string }>(
    `insert into staff_users (username, email, full_name, role, password_hash, must_change_password, created_by)
     values ($1, $2, $3, $4, $5, true, $6) returning id`,
    [username, input.email.trim(), input.fullName.trim(), input.role, await hashPassword(input.tempPassword), actor.id],
  );
  await audit(db, actor, "users.created", { type: "staff_user", id: row!.id }, { username, role: input.role });
  return row!.id;
}

function toUser(r: StaffUser): StaffUser {
  return {
    id: r.id,
    username: r.username,
    email: r.email,
    full_name: r.full_name,
    role: r.role,
    must_change_password: r.must_change_password,
    mfa_enabled: r.mfa_enabled,
    is_active: r.is_active,
  };
}
