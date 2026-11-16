import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import {
  beginMfaEnrollment,
  changePassword,
  confirmMfaEnrollment,
  consumePasswordReset,
  createStaffUser,
  LOCKOUT_THRESHOLD,
  login,
  requestPasswordReset,
  resolveSession,
  revokeSession,
  SESSION_IDLE_MS,
  verifyMfaCode,
} from "@/lib/auth/service";
import { totp } from "@/lib/auth/totp";
import { sha256Hex } from "@/lib/crypto";
import { freshDb, makeUser, TEST_PASSWORD } from "./helpers";

let db: Db;
beforeAll(async () => {
  db = await freshDb();
});

describe("staff login", () => {
  it("logs in with correct username/password, case-insensitive username", async () => {
    await makeUser(db, "aina", "clinic_assistant");
    const r = await login(db, "AINA", TEST_PASSWORD);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.stage).toBe("active");
      const s = await resolveSession(db, r.token);
      expect(s?.user.username).toBe("aina");
    }
  });

  it("stores only a hash of the session token", async () => {
    const r = await login(db, "aina", TEST_PASSWORD);
    if (!r.ok) throw new Error("login failed");
    const raw = await db.one("select 1 from staff_sessions where token_hash = $1", [r.token]);
    expect(raw).toBeNull();
    const hashed = await db.one("select 1 from staff_sessions where token_hash = $1", [sha256Hex(r.token)]);
    expect(hashed).not.toBeNull();
  });

  it("never stores plaintext passwords", async () => {
    const rows = await db.query<{ password_hash: string }>("select password_hash from staff_users");
    for (const r of rows) {
      expect(r.password_hash).not.toContain(TEST_PASSWORD);
      expect(r.password_hash.startsWith("$argon2id$")).toBe(true);
    }
  });

  it("rejects wrong password and unknown users identically", async () => {
    expect(await login(db, "aina", "wrong-password")).toEqual({ ok: false, reason: "invalid" });
    expect(await login(db, "nobody", "whatever")).toEqual({ ok: false, reason: "invalid" });
  });

  it("locks the account after repeated failures, even for the right password", async () => {
    await makeUser(db, "locky", "clinic_assistant");
    for (let i = 0; i < LOCKOUT_THRESHOLD; i++) await login(db, "locky", "bad");
    expect(await login(db, "locky", TEST_PASSWORD)).toEqual({ ok: false, reason: "locked" });
  });

  it("refuses deactivated accounts", async () => {
    await makeUser(db, "gone", "clinic_assistant", { active: false });
    expect((await login(db, "gone", TEST_PASSWORD)).ok).toBe(false);
  });

  it("forces a password change at first login", async () => {
    await makeUser(db, "newbie", "clinic_assistant", { mustChange: true });
    const r = await login(db, "newbie", TEST_PASSWORD);
    expect(r.ok && r.stage).toBe("password_change");
  });

  it("revoked and idle sessions are invalid", async () => {
    const r = await login(db, "aina", TEST_PASSWORD);
    if (!r.ok) throw new Error();
    expect(await resolveSession(db, r.token, Date.now() + SESSION_IDLE_MS + 1000)).toBeNull();
    const r2 = await login(db, "aina", TEST_PASSWORD);
    if (!r2.ok) throw new Error();
    await revokeSession(db, r2.token);
    expect(await resolveSession(db, r2.token)).toBeNull();
  });

  it("deactivating a user invalidates existing sessions", async () => {
    const u = await makeUser(db, "leaver", "clinic_assistant");
    const r = await login(db, "leaver", TEST_PASSWORD);
    if (!r.ok) throw new Error();
    await db.query("update staff_users set is_active = false where id = $1", [u.id]);
    expect(await resolveSession(db, r.token)).toBeNull();
  });
});

describe("passwords & recovery", () => {
  it("enforces policy and current password on change", async () => {
    const u = await makeUser(db, "changer", "clinic_assistant");
    const user = (await resolveSession(db, ((await login(db, "changer", TEST_PASSWORD)) as { token: string }).token))!.user;
    expect((await changePassword(db, user, TEST_PASSWORD, "weak")).ok).toBe(false);
    expect((await changePassword(db, user, "not-current", "Another-Strong-Pass-9")).ok).toBe(false);
    expect((await changePassword(db, user, TEST_PASSWORD, "Another-Strong-Pass-9")).ok).toBe(true);
    expect((await login(db, "changer", "Another-Strong-Pass-9")).ok).toBe(true);
    void u;
  });

  it("reset tokens are single-use and revoke other sessions", async () => {
    await makeUser(db, "forgetful", "clinic_assistant");
    const before = await login(db, "forgetful", TEST_PASSWORD);
    const req = await requestPasswordReset(db, "forgetful@example.test");
    expect(req).not.toBeNull();
    expect((await consumePasswordReset(db, req!.token, "Brand-New-Secret-77")).ok).toBe(true);
    expect((await consumePasswordReset(db, req!.token, "Brand-New-Secret-78")).ok).toBe(false);
    if (before.ok) expect(await resolveSession(db, before.token)).toBeNull();
    expect((await login(db, "forgetful", "Brand-New-Secret-77")).ok).toBe(true);
  });

  it("unknown identifiers produce no token (caller shows the same message)", async () => {
    expect(await requestPasswordReset(db, "nobody@nowhere.test")).toBeNull();
  });
});

describe("MFA (TOTP)", () => {
  it("enrols with a valid code, then requires MFA at login", async () => {
    await makeUser(db, "mfauser", "resident_doctor");
    const s = await resolveSession(db, ((await login(db, "mfauser", TEST_PASSWORD)) as { token: string }).token);
    const secret = await beginMfaEnrollment(db, s!.user.id);
    expect(await confirmMfaEnrollment(db, s!.user, "000000")).toBe(false);
    expect(await confirmMfaEnrollment(db, s!.user, totp(secret))).toBe(true);

    const stored = await db.one<{ mfa_secret_enc: string }>("select mfa_secret_enc from staff_users where id = $1", [s!.user.id]);
    expect(stored!.mfa_secret_enc).not.toContain(secret); // encrypted at rest

    const r = await login(db, "mfauser", TEST_PASSWORD);
    expect(r.ok && r.stage).toBe("mfa_pending");
    const user = { ...s!.user, mfa_enabled: true };
    expect(await verifyMfaCode(db, user, totp(secret))).toBe(true);
    expect(await verifyMfaCode(db, user, "123456")).toBe(false);
  });
});

describe("account creation", () => {
  it("creates users that must change password, with an audit entry", async () => {
    const admin = await makeUser(db, "ceo", "super_admin");
    const id = await createStaffUser(db, { id: admin.id, label: "ceo" }, {
      username: "Dr.Aminah",
      email: "aminah@example.test",
      fullName: "Dr Aminah",
      role: "resident_doctor",
      tempPassword: "Temp-Password-123!",
    });
    const row = await db.one<{ username: string; must_change_password: boolean }>("select username, must_change_password from staff_users where id = $1", [id]);
    expect(row).toEqual({ username: "dr.aminah", must_change_password: true });
    const log = await db.one("select 1 from audit_log where action = 'users.created' and entity_id = $1", [id]);
    expect(log).not.toBeNull();
    await expect(
      createStaffUser(db, { id: admin.id, label: "ceo" }, { username: "dr.aminah", email: "x@example.test", fullName: "x", role: "clinic_assistant", tempPassword: "x" }),
    ).rejects.toThrow(/already exists/);
  });
});
