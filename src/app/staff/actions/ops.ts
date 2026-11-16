"use server";

import { revalidatePath } from "next/cache";
import { guarded, str } from "@/lib/staff/guard";
import type { ActionResult } from "@/lib/staff/action-result";
import { storeFile, validateUpload } from "@/lib/files";
import { adjustBalance, applyLeave, cancelLeave, reviewLeave, setEntitlement } from "@/lib/staff/leave";
import { applyRotation, assign, saveShiftDef, unassign } from "@/lib/staff/roster";
import { cancelSwap, decideSwap, requestSwap, respondSwap } from "@/lib/staff/swaps";
import { reportIncident, updateIncident, INCIDENT_CATEGORIES, INCIDENT_SEVERITIES } from "@/lib/staff/incidents";
import { reviewDocument } from "@/lib/staff/documents";
import { addHoliday, deleteLink, removeHoliday, saveLink, saveWorkingDays } from "@/lib/staff/admin";

type A = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

// ───────── leave ─────────
export const applyLeaveAction: A = async (_, fd) =>
  guarded("leave:apply", async (s, db) => {
    const file = fd.get("attachment");
    let fileId: string | null = null;
    if (file instanceof File && file.size > 0) fileId = await storeFile(db, await validateUpload(file, "leave"), "leave", s.user.id);
    const r = await applyLeave(db, s, {
      leaveType: str(fd, "leaveType"), startDate: str(fd, "startDate"), endDate: str(fd, "endDate") || str(fd, "startDate"),
      halfDay: fd.get("halfDay") === "on", reason: str(fd, "reason"), attachmentFileId: fileId,
    });
    revalidatePath("/staff/leave");
    return `Permohonan dihantar (${r.days} hari). Request submitted (${r.days} day(s)).`;
  });

export const cancelLeaveAction: A = async (_, fd) =>
  guarded("leave:apply", async (s, db) => {
    await cancelLeave(db, s, str(fd, "id"));
    revalidatePath("/staff/leave");
    return "Cancelled.";
  });

export const reviewLeaveAction: A = async (_, fd) =>
  guarded("leave:review", async (s, db) => {
    const decision = str(fd, "decision") === "approved" ? "approved" : "rejected";
    await reviewLeave(db, s, str(fd, "id"), decision, str(fd, "comment"));
    revalidatePath("/staff/leave");
    return decision === "approved" ? "Approved." : "Rejected.";
  });

export const setEntitlementAction: A = async (_, fd) =>
  guarded("leave:configure", async (s, db) => {
    await setEntitlement(db, s, str(fd, "userId"), Number(str(fd, "year")), str(fd, "leaveType"), Number(str(fd, "days")));
    revalidatePath("/staff/leave");
    return "Entitlement saved.";
  });

export const adjustBalanceAction: A = async (_, fd) =>
  guarded("leave:configure", async (s, db) => {
    await adjustBalance(db, s, str(fd, "userId"), Number(str(fd, "year")), str(fd, "leaveType"), Number(str(fd, "delta")), str(fd, "reason"));
    revalidatePath("/staff/leave");
    return "Adjustment recorded.";
  });

export const workingDaysAction: A = async (_, fd) =>
  guarded("leave:configure", async (s, db) => {
    await saveWorkingDays(db, s, fd.getAll("days").map(Number));
    revalidatePath("/staff/leave");
    return "Working days saved.";
  });

export const holidayAction: A = async (_, fd) =>
  guarded("leave:configure", async (s, db) => {
    if (str(fd, "remove")) await removeHoliday(db, s, str(fd, "remove"));
    else await addHoliday(db, s, str(fd, "date"), str(fd, "name"));
    revalidatePath("/staff/leave");
    return "Holidays updated.";
  });

// ───────── roster ─────────
export const assignAction: A = async (_, fd) =>
  guarded("roster:edit", async (s, db) => {
    await assign(db, s, str(fd, "date"), str(fd, "shift"), str(fd, "userId"));
    revalidatePath("/staff/roster");
    return "Assigned.";
  });

export const unassignAction: A = async (_, fd) =>
  guarded("roster:edit", async (s, db) => {
    await unassign(db, s, str(fd, "id"));
    revalidatePath("/staff/roster");
    return "Removed.";
  });

export const rotationAction: A = async (_, fd) =>
  guarded("roster:edit", async (s, db) => {
    const pattern = str(fd, "pattern").toUpperCase().split(/[\s,]+/).filter(Boolean);
    await applyRotation(db, s, str(fd, "userId"), str(fd, "startDate"), str(fd, "endDate"), pattern);
    revalidatePath("/staff/roster");
    return "Rotation applied.";
  });

export const shiftDefAction: A = async (_, fd) =>
  guarded("roster:configure", async (s, db) => {
    await saveShiftDef(db, s, {
      code: str(fd, "code").toUpperCase(), label: str(fd, "label"), start_time: str(fd, "start"), end_time: str(fd, "end"),
      min_staff: Number(str(fd, "min")), color: str(fd, "color") || "#00B7B1", active: fd.get("active") === "on", sort: Number(str(fd, "sort") || 99),
    });
    revalidatePath("/staff/roster");
    return "Shift saved.";
  });

// ───────── swaps ─────────
export const requestSwapAction: A = async (_, fd) =>
  guarded("swap:request", async (s, db) => {
    await requestSwap(db, s, { myAssignmentId: str(fd, "mine"), targetUserId: str(fd, "target"), targetAssignmentId: str(fd, "theirs") || null, reason: str(fd, "reason") });
    revalidatePath("/staff/swaps");
    return "Request sent to your colleague.";
  });

export const respondSwapAction: A = async (_, fd) =>
  guarded("swap:request", async (s, db) => {
    await respondSwap(db, s, str(fd, "id"), str(fd, "accept") === "1", str(fd, "note"));
    revalidatePath("/staff/swaps");
    return "Response recorded.";
  });

export const cancelSwapAction: A = async (_, fd) =>
  guarded("swap:request", async (s, db) => {
    await cancelSwap(db, s, str(fd, "id"));
    revalidatePath("/staff/swaps");
    return "Cancelled.";
  });

export const decideSwapAction: A = async (_, fd) =>
  guarded("swap:approve", async (s, db) => {
    await decideSwap(db, s, str(fd, "id"), str(fd, "approve") === "1", str(fd, "note"));
    revalidatePath("/staff/swaps");
    revalidatePath("/staff/roster");
    return "Decision recorded.";
  });

// ───────── incidents ─────────
export const reportIncidentAction: A = async (_, fd) =>
  guarded("incident:report", async (s, db) => {
    const fileIds: string[] = [];
    for (const f of fd.getAll("evidence")) {
      if (f instanceof File && f.size > 0) fileIds.push(await storeFile(db, await validateUpload(f, "incident"), "incident", s.user.id));
    }
    const category = str(fd, "category") as (typeof INCIDENT_CATEGORIES)[number];
    const severity = (INCIDENT_SEVERITIES as readonly string[]).includes(str(fd, "severity")) ? (str(fd, "severity") as (typeof INCIDENT_SEVERITIES)[number]) : "medium";
    const r = await reportIncident(db, s, {
      category, severity, occurredAt: new Date(`${str(fd, "occurredAt")}:00+08:00`).toISOString(),
      location: str(fd, "location"), description: str(fd, "description"), confidential: fd.get("confidential") === "on", fileIds,
    });
    revalidatePath("/staff/incidents");
    return `Reported as ${r.reference}.`;
  });

export const updateIncidentAction: A = async (_, fd) =>
  guarded("incident:manage", async (s, db) => {
    const assignedRaw = fd.get("assignedTo");
    await updateIncident(db, s, str(fd, "id"), {
      status: str(fd, "status") || undefined,
      assignedTo: assignedRaw === null ? undefined : String(assignedRaw) || null,
      correctiveAction: str(fd, "correctiveAction") || undefined,
      note: str(fd, "note"),
    });
    revalidatePath(`/staff/incidents/${str(fd, "id")}`);
    return "Incident updated.";
  });

// ───────── documents ─────────
export const reviewDocumentAction: A = async (_, fd) =>
  guarded("documents:approve", async (s, db) => {
    await reviewDocument(db, s, str(fd, "id"), str(fd, "decision") === "approved" ? "approved" : "rejected", str(fd, "comment"));
    revalidatePath("/staff/documents");
    return "Saved.";
  });

// ───────── links ─────────
export const saveLinkAction: A = async (_, fd) =>
  guarded("links:manage", async (s, db) => {
    await saveLink(db, s, {
      id: str(fd, "id") || undefined, category: str(fd, "category"), title: str(fd, "title"), url: str(fd, "url"),
      description: str(fd, "description"), allowedRoles: fd.getAll("roles").map(String), sort: Number(str(fd, "sort") || 0),
    });
    revalidatePath("/staff/links");
    return "Link saved.";
  });

export const deleteLinkAction: A = async (_, fd) =>
  guarded("links:manage", async (s, db) => {
    await deleteLink(db, s, str(fd, "id"));
    revalidatePath("/staff/links");
    return "Deleted.";
  });
