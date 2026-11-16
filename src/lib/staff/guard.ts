import "server-only";
import { getDb, type Db } from "../db";
import { ForbiddenError, type Permission } from "../auth/rbac";
import type { SessionInfo } from "../auth/service";
import { requireAction, UnauthenticatedError } from "../auth/dal";
import type { ActionResult } from "./action-result";

import { LeaveError } from "./leave";
import { RosterError } from "./roster";
import { SwapError } from "./swaps";
import { IncidentError } from "./incidents";
import { DocumentError } from "./documents";
import { AdminError } from "./admin";
import { ContentError } from "../content/admin";
import { ScreeningAdminError } from "../screening/admin";
import { UploadError } from "../files";

// instanceof (not constructor.name) so this survives production minification.
const DOMAIN_ERRORS = [LeaveError, RosterError, SwapError, IncidentError, DocumentError, AdminError, ContentError, ScreeningAdminError, UploadError];

/**
 * Wraps a staff server action: re-validates the session and permission on the
 * server, maps known domain errors to friendly messages and hides internals.
 */
export async function guarded(
  permission: Permission | undefined,
  fn: (s: SessionInfo, db: Db) => Promise<string | void | ActionResult>,
): Promise<ActionResult> {
  try {
    const s = await requireAction(permission);
    const db = await getDb();
    const out = await fn(s, db);
    if (out && typeof out === "object") return out;
    return { ok: true, message: out || undefined };
  } catch (e) {
    if (e instanceof UnauthenticatedError) return { ok: false, error: "Your session has expired. Please sign in again." };
    if (e instanceof ForbiddenError) return { ok: false, error: "You do not have permission to do this." };
    if (DOMAIN_ERRORS.some((C) => e instanceof C)) return { ok: false, error: (e as Error).message };
    if (typeof e === "object" && e && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    console.error("[staff action]", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
