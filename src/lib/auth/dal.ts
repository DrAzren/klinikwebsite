/**
 * Data Access Layer for the staff portal. Every staff page and server action
 * goes through requireStaff()/requireAction(), which re-validate the session
 * against the database and check permissions on the server.
 */
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getDb } from "../db";
import { can, ForbiddenError, type Permission } from "./rbac";
import { resolveSession, type SessionInfo, type SessionStage } from "./service";
import { readSessionToken } from "./session";

export const getStaffSession = cache(async (): Promise<SessionInfo | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  return resolveSession(await getDb(), token);
});

const STAGE_PATH: Record<Exclude<SessionStage, "active">, string> = {
  password_change: "/staff/reset",
  mfa_pending: "/staff/mfa",
  mfa_enroll: "/staff/mfa/setup",
};

/** For portal pages: redirects instead of throwing. */
export async function requireStaff(permission?: Permission): Promise<SessionInfo> {
  const s = await getStaffSession();
  if (!s) redirect("/staff/login");
  if (s.stage !== "active") redirect(STAGE_PATH[s.stage]);
  if (permission && !can(s.user.role, permission)) redirect(`/staff/dashboard?denied=${encodeURIComponent(permission)}`);
  return s;
}

/** For pages in the sign-in flow that need a specific stage. */
export async function requireStage(stage: SessionStage): Promise<SessionInfo> {
  const s = await getStaffSession();
  if (!s) redirect("/staff/login");
  if (s.stage !== stage) redirect(s.stage === "active" ? "/staff/dashboard" : STAGE_PATH[s.stage]);
  return s;
}

export class UnauthenticatedError extends Error {}

/** For server actions and route handlers: throws instead of redirecting. */
export async function requireAction(permission?: Permission): Promise<SessionInfo> {
  const s = await getStaffSession();
  if (!s || s.stage !== "active") throw new UnauthenticatedError("Not signed in");
  if (permission && !can(s.user.role, permission)) throw new ForbiddenError(permission);
  return s;
}

export const actorOf = (s: SessionInfo) => ({ id: s.user.id, label: s.user.username });
