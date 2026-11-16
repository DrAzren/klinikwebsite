"use server";

import { revalidatePath, updateTag } from "next/cache";
import { guarded, str } from "@/lib/staff/guard";
import type { ActionResult } from "@/lib/staff/action-result";
import { createAccount, resetMfa, resetTempPassword, setActive, setRole, unlock } from "@/lib/staff/admin";
import { ContentError, dataFromForm, deleteItem, saveItem, schemaFor } from "@/lib/content/admin";
import type { CollectionName } from "@/lib/content/types";
import { retryJob } from "@/lib/integrations/jobs";
import { runJobs } from "@/lib/integrations/handlers";
import { reconcileScreenings } from "@/lib/screening/service";
import { audit } from "@/lib/audit";
import { FOLLOW_UP_STATUSES, sendPatientFollowUp, updateFollowUp, type FollowUpStatus } from "@/lib/screening/admin";

type A = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

// ───────── users ─────────
export const createUserAction: A = async (_, fd) =>
  guarded("users:manage", async (s, db) => {
    const r = await createAccount(db, s, { username: str(fd, "username"), email: str(fd, "email"), fullName: str(fd, "fullName"), role: str(fd, "role") });
    revalidatePath("/staff/admin/users");
    return `Account created. Temporary password (shown once — give it to the staff member securely, not by email):\n${r.tempPassword}`;
  });

export const userAdminAction: A = async (_, fd) =>
  guarded("users:manage", async (s, db) => {
    const id = str(fd, "id");
    const op = str(fd, "op");
    let msg = "Saved.";
    if (op === "role") await setRole(db, s, id, str(fd, "role"));
    else if (op === "deactivate") await setActive(db, s, id, false);
    else if (op === "activate") await setActive(db, s, id, true);
    else if (op === "unlock") await unlock(db, s, id);
    else if (op === "mfa") { await resetMfa(db, s, id); msg = "MFA reset. The user must enrol again at next sign-in."; }
    else if (op === "password") msg = `Temporary password (shown once):\n${await resetTempPassword(db, s, id)}`;
    revalidatePath("/staff/admin/users");
    return msg;
  });

// ───────── content ─────────
export const saveContentAction: A = async (_, fd) =>
  guarded("content:manage", async (s, db) => {
    const collection = str(fd, "collection") as CollectionName;
    const schema = schemaFor(collection);
    if (!schema) throw new ContentError("Unknown collection");
    const status = (["draft", "published", "archived"] as const).find((x) => x === str(fd, "status")) ?? "draft";
    await saveItem(db, s, { id: str(fd, "id") || undefined, collection, status, sort: Number(str(fd, "sort") || 0), data: dataFromForm(schema, fd) });
    updateTag(`content:${collection}`);
    revalidatePath(`/staff/admin/content/${collection}`);
    return "Saved. Public pages update immediately.";
  });

export const deleteContentAction: A = async (_, fd) =>
  guarded("content:manage", async (s, db) => {
    const row = await deleteItem(db, s, str(fd, "id"));
    if (row) updateTag(`content:${row.collection}`);
    revalidatePath(`/staff/admin/content/${row?.collection ?? ""}`);
    return "Deleted.";
  });

// ───────── integrations ─────────
export const retryJobAction: A = async (_, fd) =>
  guarded("integrations:view", async (s, db) => {
    await retryJob(db, str(fd, "id"));
    await runJobs(db, { onlyIds: [str(fd, "id")] });
    await audit(db, { id: s.user.id, label: s.user.username }, "integrations.job_retried", { type: "job", id: str(fd, "id") });
    revalidatePath("/staff/admin/integrations");
    return "Retried — see status below.";
  });

export const runJobsAction: A = async () =>
  guarded("integrations:view", async (s, db) => {
    const r = await runJobs(db, { limit: 50 });
    revalidatePath("/staff/admin/integrations");
    return `Processed ${r.claimed}: ${r.succeeded} succeeded, ${r.failed} will retry, ${r.dead} dead.`;
  });

export const reconcileAction: A = async () =>
  guarded("integrations:view", async (s, db) => {
    const r = await reconcileScreenings(db, 30);
    await audit(db, { id: s.user.id, label: s.user.username }, "integrations.reconciled", { type: "screening" }, r);
    revalidatePath("/staff/admin/integrations");
    return `Checked ${r.checked} submissions from the last 30 days; ${r.notYetSynced} not yet synced to Drive (jobs ensured).`;
  });

// ───────── screening ─────────
export const followUpAction: A = async (_, fd) =>
  guarded("screening:manage", async (s, db) => {
    const status = str(fd, "status") as FollowUpStatus;
    const assignedRaw = fd.get("assignedTo");
    await updateFollowUp(db, s, str(fd, "id"), {
      status: FOLLOW_UP_STATUSES.includes(status) ? status : undefined,
      assignedTo: assignedRaw === null ? undefined : String(assignedRaw) || null,
      note: str(fd, "note"),
    });
    revalidatePath(`/staff/screening/${str(fd, "id")}`);
    return "Updated.";
  });

export const patientEmailAction: A = async (_, fd) =>
  guarded("screening:contact_patient", async (s, db) => {
    const r = await sendPatientFollowUp(db, s, str(fd, "id"), { includeReportLink: fd.get("report") === "on", message: str(fd, "message") });
    revalidatePath(`/staff/screening/${str(fd, "id")}`);
    return r.mode === "live" ? "Email sent." : "Email recorded in the DEMO outbox (SMTP not configured).";
  });
