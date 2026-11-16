/**
 * CEO / Super Admin management: staff accounts, SOP & important links,
 * HR configuration helpers, audit log and integration overview.
 */
import type { Db } from "../db";
import { audit } from "../audit";
import { assertCan, canViewLink, isRole, type Role } from "../auth/rbac";
import { beginMfaEnrollment, createStaffUser, revokeAllSessions, type SessionInfo } from "../auth/service";
import { generateTempPassword, hashPassword } from "../auth/password";

export class AdminError extends Error {}

const actor = (s: SessionInfo) => ({ id: s.user.id, label: s.user.username });

// ───────────── users ─────────────

export async function listStaff(db: Db, s: SessionInfo) {
  assertCan(s.user.role, "users:manage");
  return db.query<{
    id: string; username: string; email: string; full_name: string; role: Role; is_active: boolean; mfa_enabled: boolean;
    must_change_password: boolean; last_login_at: Date | null; locked_until: Date | null; created_at: Date;
  }>(
    "select id, username, email, full_name, role, is_active, mfa_enabled, must_change_password, last_login_at, locked_until, created_at from staff_users order by is_active desc, full_name",
  );
}

/** Minimal directory (names only) for pickers — available to all signed-in staff. */
export async function staffDirectory(db: Db) {
  return db.query<{ id: string; full_name: string; role: Role }>("select id, full_name, role from staff_users where is_active order by full_name");
}

export async function createAccount(db: Db, s: SessionInfo, input: { username: string; email: string; fullName: string; role: string }) {
  assertCan(s.user.role, "users:manage");
  if (!isRole(input.role)) throw new AdminError("Invalid role");
  if (!/^\S+@\S+\.\S+$/.test(input.email)) throw new AdminError("Invalid email");
  if (input.fullName.trim().length < 2) throw new AdminError("Full name required");
  const tempPassword = generateTempPassword();
  const id = await createStaffUser(db, actor(s), { ...input, role: input.role, tempPassword });
  return { id, tempPassword };
}

async function superAdminCount(db: Db) {
  return (await db.one<{ n: number }>("select count(*)::int as n from staff_users where role = 'super_admin' and is_active"))!.n;
}

export async function setRole(db: Db, s: SessionInfo, userId: string, role: string) {
  assertCan(s.user.role, "users:manage");
  if (!isRole(role)) throw new AdminError("Invalid role");
  const cur = await db.one<{ role: Role }>("select role from staff_users where id = $1", [userId]);
  if (!cur) throw new AdminError("User not found");
  if (cur.role === "super_admin" && role !== "super_admin" && (await superAdminCount(db)) <= 1) {
    throw new AdminError("Cannot remove the last active Super Admin");
  }
  await db.query("update staff_users set role = $2 where id = $1", [userId, role]);
  await revokeAllSessions(db, userId); // force re-login with new permissions
  await audit(db, actor(s), "users.role_changed", { type: "staff_user", id: userId }, { from: cur.role, to: role });
}

export async function setActive(db: Db, s: SessionInfo, userId: string, active: boolean) {
  assertCan(s.user.role, "users:manage");
  if (userId === s.user.id && !active) throw new AdminError("You cannot deactivate your own account");
  const cur = await db.one<{ role: Role }>("select role from staff_users where id = $1", [userId]);
  if (!cur) throw new AdminError("User not found");
  if (!active && cur.role === "super_admin" && (await superAdminCount(db)) <= 1) throw new AdminError("Cannot deactivate the last Super Admin");
  await db.query("update staff_users set is_active = $2 where id = $1", [userId, active]);
  if (!active) await revokeAllSessions(db, userId);
  await audit(db, actor(s), active ? "users.reactivated" : "users.deactivated", { type: "staff_user", id: userId });
}

export async function resetTempPassword(db: Db, s: SessionInfo, userId: string) {
  assertCan(s.user.role, "users:manage");
  const temp = generateTempPassword();
  await db.query("update staff_users set password_hash = $2, must_change_password = true, failed_login_count = 0, locked_until = null where id = $1", [userId, await hashPassword(temp)]);
  await revokeAllSessions(db, userId);
  await audit(db, actor(s), "users.password_reset_by_admin", { type: "staff_user", id: userId });
  return temp;
}

export async function resetMfa(db: Db, s: SessionInfo, userId: string) {
  assertCan(s.user.role, "users:manage");
  await beginMfaEnrollment(db, userId); // replaces secret, disables MFA until re-enrolled
  await db.query("update staff_users set mfa_secret_enc = null where id = $1", [userId]);
  await revokeAllSessions(db, userId);
  await audit(db, actor(s), "users.mfa_reset", { type: "staff_user", id: userId });
}

export async function unlock(db: Db, s: SessionInfo, userId: string) {
  assertCan(s.user.role, "users:manage");
  await db.query("update staff_users set failed_login_count = 0, locked_until = null where id = $1", [userId]);
  await audit(db, actor(s), "users.unlocked", { type: "staff_user", id: userId });
}

// ───────────── links ─────────────

export const LINK_CATEGORIES = [
  "opening_closing",
  "yezza",
  "panels",
  "laboratory",
  "inventory",
  "hr",
  "forms",
  "maintenance",
  "emergency",
] as const;

export const LINK_CATEGORY_LABEL: Record<(typeof LINK_CATEGORIES)[number], { ms: string; en: string }> = {
  opening_closing: { ms: "SOP buka/tutup klinik", en: "Clinic opening/closing SOP" },
  yezza: { ms: "Yezza", en: "Yezza" },
  panels: { ms: "Panel", en: "Panels" },
  laboratory: { ms: "Aliran kerja makmal", en: "Laboratory workflows" },
  inventory: { ms: "Inventori", en: "Inventory" },
  hr: { ms: "Polisi HR", en: "HR policies" },
  forms: { ms: "Borang operasi", en: "Operational forms" },
  maintenance: { ms: "Penyelenggaraan", en: "Maintenance" },
  emergency: { ms: "Kenalan kecemasan", en: "Emergency contacts" },
};

export async function listLinks(db: Db, s: SessionInfo, q?: string) {
  assertCan(s.user.role, "links:view");
  const rows = await db.query<{ id: string; category: string; title: string; url: string; description: string | null; allowed_roles: string[]; sort: number }>(
    `select id, category, title, url, description, allowed_roles, sort from staff_links
      where ($1::text is null or title ilike '%' || $1 || '%' or description ilike '%' || $1 || '%')
      order by category, sort, title`,
    [q?.trim() || null],
  );
  return rows.filter((r) => canViewLink(s.user.role, r.allowed_roles ?? []));
}

export async function saveLink(
  db: Db,
  s: SessionInfo,
  input: { id?: string; category: string; title: string; url: string; description?: string; allowedRoles: string[]; sort?: number },
) {
  assertCan(s.user.role, "links:manage");
  if (!(LINK_CATEGORIES as readonly string[]).includes(input.category)) throw new AdminError("Invalid category");
  let url: URL;
  try {
    url = new URL(input.url);
  } catch {
    throw new AdminError("Invalid URL");
  }
  if (!["https:", "http:", "tel:", "mailto:"].includes(url.protocol)) throw new AdminError("Only https, tel and mailto links are allowed");
  const roles = input.allowedRoles.filter(isRole);
  if (input.id) {
    await db.query(
      "update staff_links set category=$2, title=$3, url=$4, description=$5, allowed_roles=$6::jsonb, sort=$7, updated_by=$8, updated_at=now() where id=$1",
      [input.id, input.category, input.title.slice(0, 200), url.toString(), input.description?.slice(0, 500) ?? null, JSON.stringify(roles), input.sort ?? 0, s.user.id],
    );
  } else {
    await db.query(
      "insert into staff_links (category, title, url, description, allowed_roles, sort, updated_by) values ($1,$2,$3,$4,$5::jsonb,$6,$7)",
      [input.category, input.title.slice(0, 200), url.toString(), input.description?.slice(0, 500) ?? null, JSON.stringify(roles), input.sort ?? 0, s.user.id],
    );
  }
  await audit(db, actor(s), "links.saved", { type: "link", id: input.id ?? null }, { title: input.title });
}

export async function deleteLink(db: Db, s: SessionInfo, id: string) {
  assertCan(s.user.role, "links:manage");
  await db.query("delete from staff_links where id = $1", [id]);
  await audit(db, actor(s), "links.deleted", { type: "link", id });
}

// ───────────── audit ─────────────

export async function auditLog(db: Db, s: SessionInfo, f: { q?: string; action?: string; limit?: number } = {}) {
  assertCan(s.user.role, "audit:view");
  return db.query<{ id: number; at: Date; actor_label: string | null; action: string; entity: string | null; entity_id: string | null; ip: string | null; details: Record<string, unknown> }>(
    `select id, at, actor_label, action, entity, entity_id, ip, details from audit_log
      where ($1::text is null or action like $1 || '%')
        and ($2::text is null or actor_label ilike '%' || $2 || '%' or entity_id = $2)
      order by at desc limit $3`,
    [f.action || null, f.q?.trim() || null, Math.min(f.limit ?? 200, 1000)],
  );
}

// ───────────── HR config ─────────────

export async function saveWorkingDays(db: Db, s: SessionInfo, days: number[]) {
  assertCan(s.user.role, "leave:configure");
  const clean = [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  await db.query(
    "insert into app_settings (key, value, updated_by) values ('hr.working_days', $1::jsonb, $2) on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()",
    [JSON.stringify(clean), s.user.id],
  );
  await audit(db, actor(s), "hr.working_days_set", { type: "settings" }, { days: clean });
}

export async function addHoliday(db: Db, s: SessionInfo, date: string, name: string) {
  assertCan(s.user.role, "leave:configure");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AdminError("Invalid date");
  await db.query("insert into public_holidays (date, name) values ($1,$2) on conflict (date) do update set name = excluded.name", [date, name.slice(0, 100)]);
  await audit(db, actor(s), "hr.holiday_added", { type: "holiday", id: date }, { name });
}

export async function removeHoliday(db: Db, s: SessionInfo, date: string) {
  assertCan(s.user.role, "leave:configure");
  await db.query("delete from public_holidays where date = $1", [date]);
  await audit(db, actor(s), "hr.holiday_removed", { type: "holiday", id: date });
}
