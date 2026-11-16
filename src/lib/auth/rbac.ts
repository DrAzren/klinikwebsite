/**
 * Role-based access control. Pure module — the single source of truth for who
 * may do what. Every server action / route handler checks permissions with
 * `can()` / `requirePermission()` on the server; the UI only hides what the
 * server would refuse anyway.
 *
 * Clinical (screening) data and financial documents are deliberately held by
 * different permissions so that they can be granted independently.
 */
export const ROLES = ["super_admin", "resident_doctor", "clinic_assistant", "screening_admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, { ms: string; en: string }> = {
  super_admin: { ms: "Ketua Pegawai Eksekutif / Super Admin", en: "CEO / Super Admin" },
  resident_doctor: { ms: "Doktor Residen", en: "Resident Doctor" },
  clinic_assistant: { ms: "Pembantu Klinik", en: "Clinic Assistant" },
  screening_admin: { ms: "Pentadbir Saringan", en: "Screening Administrator" },
};

export const PERMISSIONS = [
  // clinical
  "screening:read",
  "screening:manage",
  "screening:assign",
  "screening:export",
  "screening:contact_patient",
  // finance & documents
  "finance:read",
  "documents:upload",
  "documents:read_ops",
  "documents:approve",
  // HR
  "leave:apply",
  "leave:review",
  "leave:configure",
  // roster
  "roster:view",
  "roster:edit",
  "roster:configure",
  "swap:request",
  "swap:approve",
  // incidents
  "incident:report",
  "incident:manage",
  "incident:confidential",
  // knowledge
  "links:view",
  "links:manage",
  // administration
  "users:manage",
  "content:manage",
  "integrations:view",
  "audit:view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const STAFF_BASE: Permission[] = ["leave:apply", "roster:view", "swap:request", "incident:report", "links:view"];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  super_admin: new Set<Permission>(PERMISSIONS),
  resident_doctor: new Set<Permission>([
    ...STAFF_BASE,
    "screening:read",
    "screening:manage",
    "screening:assign",
    "screening:contact_patient",
    "documents:upload",
    "documents:read_ops",
    "incident:manage",
  ]),
  clinic_assistant: new Set<Permission>([...STAFF_BASE, "documents:upload", "documents:read_ops"]),
  screening_admin: new Set<Permission>([
    ...STAFF_BASE,
    "screening:read",
    "screening:manage",
    "screening:assign",
    "screening:export",
    "screening:contact_patient",
  ]),
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export class ForbiddenError extends Error {
  constructor(public permission: string) {
    super(`Forbidden: missing permission ${permission}`);
  }
}

export function assertCan(role: Role | null | undefined, permission: Permission) {
  if (!can(role, permission)) throw new ForbiddenError(permission);
}

export const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as readonly string[]).includes(v);

/** Document categories that are financial records. */
export const FINANCE_CATEGORIES = ["supplier_invoice", "payment_receipt", "lab_invoice"] as const;
export const OPS_CATEGORIES = ["stock", "maintenance", "admin"] as const;
export type DocumentCategory = (typeof FINANCE_CATEGORIES)[number] | (typeof OPS_CATEGORIES)[number];

export function canViewDocument(
  viewer: { id: string; role: Role },
  doc: { category: string; uploaded_by: string },
): boolean {
  if (doc.uploaded_by === viewer.id) return true;
  if ((FINANCE_CATEGORIES as readonly string[]).includes(doc.category)) return can(viewer.role, "finance:read");
  return can(viewer.role, "documents:read_ops") || can(viewer.role, "finance:read");
}

export function canViewIncident(
  viewer: { id: string; role: Role },
  inc: { confidential: boolean; reporter_id: string; assigned_to: string | null },
): boolean {
  if (inc.reporter_id === viewer.id || inc.assigned_to === viewer.id) return true;
  if (inc.confidential) return can(viewer.role, "incident:confidential");
  return can(viewer.role, "incident:manage");
}

export function canViewLink(role: Role, allowedRoles: string[]): boolean {
  if (role === "super_admin") return true;
  return allowedRoles.length === 0 || allowedRoles.includes(role);
}
