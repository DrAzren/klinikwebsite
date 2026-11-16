import type { Db } from "../db";
import { careersForwardHandler, purgeExpiredApplications } from "../careers";
import { purgeExpiredScreenings, screeningHandlers } from "../screening/service";
import { documentDriveHandler } from "../staff/documents";
import { processDueJobs, type JobHandler, type JobKind } from "./jobs";

export const ALL_HANDLERS: Record<JobKind, JobHandler> = {
  ...screeningHandlers,
  "document.drive": documentDriveHandler,
  "careers.forward": careersForwardHandler,
};

export const runJobs = (db: Db, opts?: Parameters<typeof processDueJobs>[2]) => processDueJobs(db, ALL_HANDLERS, opts);

/** Scheduled maintenance: process queue + apply retention policies. */
export async function runMaintenance(db: Db) {
  const jobs = await runJobs(db, { limit: 50 });
  const purgedScreenings = await purgeExpiredScreenings(db);
  const purgedApplications = await purgeExpiredApplications(db);
  await db.query("delete from staff_sessions where expires_at < now() - interval '7 days'");
  await db.query("delete from password_reset_tokens where expires_at < now() - interval '7 days'");
  return { jobs, purgedScreenings, purgedApplications };
}
