import { createMemoryDb, type Db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import type { Role } from "@/lib/auth/rbac";

export async function freshDb(): Promise<Db> {
  return createMemoryDb();
}

export const TEST_PASSWORD = "Tenang-Laut-47-Biru";

export async function makeUser(
  db: Db,
  username: string,
  role: Role,
  opts: { mustChange?: boolean; active?: boolean } = {},
): Promise<{ id: string; username: string; role: Role }> {
  const row = await db.one<{ id: string }>(
    `insert into staff_users (username, email, full_name, role, password_hash, must_change_password, is_active)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [username, `${username}@example.test`, username.toUpperCase(), role, await hashPassword(TEST_PASSWORD), opts.mustChange ?? false, opts.active ?? true],
  );
  return { id: row!.id, username, role };
}

export const sessionOf = (u: { id: string; username: string; role: Role }) => ({
  id: "test-session",
  stage: "active" as const,
  user: {
    id: u.id,
    username: u.username,
    email: `${u.username}@example.test`,
    full_name: u.username,
    role: u.role,
    must_change_password: false,
    mfa_enabled: false,
    is_active: true,
  },
});
