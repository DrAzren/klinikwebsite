/**
 * Incident reporting. Visibility: reporter and assignee always; managers for
 * non-confidential reports; confidential reports only with incident:confidential.
 */
import type { Db } from "../db";
import { audit } from "../audit";
import { assertCan, can, canViewIncident, ForbiddenError } from "../auth/rbac";
import type { SessionInfo } from "../auth/service";
import { randomBytes } from "node:crypto";

export const INCIDENT_CATEGORIES = ["medication_inventory", "missing_stock", "equipment", "safety", "patient_complaint", "operational", "other"] as const;
export const INCIDENT_STATUSES = ["open", "investigating", "action_required", "resolved", "closed"] as const;
export const INCIDENT_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  medication_inventory: "Ubat / inventori · Medication or inventory",
  missing_stock: "Stok hilang · Missing stock",
  equipment: "Peralatan · Equipment",
  safety: "Keselamatan · Safety",
  patient_complaint: "Aduan pesakit · Patient complaint",
  operational: "Operasi · Operational",
  other: "Lain-lain · Other",
};

export class IncidentError extends Error {}

export interface IncidentInput {
  category: (typeof INCIDENT_CATEGORIES)[number];
  occurredAt: string;
  location?: string;
  description: string;
  severity: (typeof INCIDENT_SEVERITIES)[number];
  confidential: boolean;
  fileIds: string[];
}

export async function reportIncident(db: Db, s: SessionInfo, input: IncidentInput) {
  assertCan(s.user.role, "incident:report");
  if (!INCIDENT_CATEGORIES.includes(input.category)) throw new IncidentError("Invalid category");
  if (input.description.trim().length < 10) throw new IncidentError("Please describe what happened (at least 10 characters)");
  const occurred = new Date(input.occurredAt);
  if (Number.isNaN(occurred.getTime()) || occurred.getTime() > Date.now() + 5 * 60_000) throw new IncidentError("Invalid date/time");
  const ym = new Date().toISOString().slice(0, 7).replace("-", "");
  const reference = `INC-${ym}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const id = await db.tx(async (t) => {
    const row = await t.one<{ id: string }>(
      `insert into incidents (reference, category, occurred_at, location, description, severity, confidential, reporter_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [reference, input.category, occurred.toISOString(), input.location?.slice(0, 200) ?? null, input.description.slice(0, 5000), input.severity, input.confidential, s.user.id],
    );
    for (const f of input.fileIds) await t.query("insert into incident_files (incident_id, file_id) values ($1,$2)", [row!.id, f]);
    await t.query("insert into incident_events (incident_id, actor_id, action) values ($1,$2,'reported')", [row!.id, s.user.id]);
    return row!.id;
  });
  await audit(db, { id: s.user.id, label: s.user.username }, "incident.reported", { type: "incident", id }, { category: input.category, confidential: input.confidential });
  return { id, reference };
}

const LIST_SQL = `
  select i.id, i.reference, i.category, i.occurred_at, i.severity, i.confidential, i.status, i.created_at,
         i.reporter_id, r.full_name as reporter, i.assigned_to, a.full_name as assignee
    from incidents i join staff_users r on r.id = i.reporter_id left join staff_users a on a.id = i.assigned_to
   where (i.reporter_id = $1 or i.assigned_to = $1
          or ($2::boolean and not i.confidential)
          or ($3::boolean and i.confidential))
     and ($4::text is null or i.status = $4::text)
   order by i.created_at desc limit 300`;

export async function listIncidents(db: Db, s: SessionInfo, status?: string) {
  return db.query<{
    id: string; reference: string; category: string; occurred_at: Date; severity: string; confidential: boolean; status: string;
    created_at: Date; reporter_id: string; reporter: string; assigned_to: string | null; assignee: string | null;
  }>(LIST_SQL, [s.user.id, can(s.user.role, "incident:manage"), can(s.user.role, "incident:confidential"), status ?? null]);
}

export async function getIncident(db: Db, s: SessionInfo, id: string) {
  const inc = await db.one<{
    id: string; reference: string; category: string; occurred_at: Date; location: string | null; description: string; severity: string;
    confidential: boolean; reporter_id: string; reporter: string; assigned_to: string | null; assignee: string | null;
    corrective_action: string | null; status: string; resolved_at: Date | null; created_at: Date;
  }>(
    `select i.*, r.full_name as reporter, a.full_name as assignee from incidents i
       join staff_users r on r.id = i.reporter_id left join staff_users a on a.id = i.assigned_to where i.id = $1`,
    [id],
  );
  if (!inc) return null;
  if (!canViewIncident({ id: s.user.id, role: s.user.role }, inc)) throw new ForbiddenError("incident:view");
  const [files, events] = await Promise.all([
    db.query<{ id: string; original_name: string; mime: string }>(
      "select f.id, f.original_name, f.mime from incident_files x join files f on f.id = x.file_id where x.incident_id = $1",
      [id],
    ),
    db.query<{ at: Date; actor: string | null; action: string; note: string | null }>(
      "select e.at, u.full_name as actor, e.action, e.note from incident_events e left join staff_users u on u.id = e.actor_id where e.incident_id = $1 order by e.at",
      [id],
    ),
  ]);
  return { ...inc, files, events };
}

export async function updateIncident(
  db: Db,
  s: SessionInfo,
  id: string,
  patch: { status?: string; assignedTo?: string | null; correctiveAction?: string; note?: string },
) {
  assertCan(s.user.role, "incident:manage");
  const inc = await db.one<{ confidential: boolean; status: string }>("select confidential, status from incidents where id = $1", [id]);
  if (!inc) throw new IncidentError("Not found");
  if (inc.confidential) assertCan(s.user.role, "incident:confidential");
  if (patch.status && !INCIDENT_STATUSES.includes(patch.status as (typeof INCIDENT_STATUSES)[number])) throw new IncidentError("Invalid status");
  await db.query(
    `update incidents set
       status = coalesce($2, status),
       assigned_to = case when $3::boolean then $4::uuid else assigned_to end,
       corrective_action = coalesce($5, corrective_action),
       resolved_at = case when $2 in ('resolved','closed') and resolved_at is null then now() else resolved_at end
     where id = $1`,
    [id, patch.status ?? null, patch.assignedTo !== undefined, patch.assignedTo ?? null, patch.correctiveAction ?? null],
  );
  const parts = [
    patch.status && patch.status !== inc.status ? `status → ${patch.status}` : null,
    patch.assignedTo !== undefined ? "assignment updated" : null,
    patch.correctiveAction ? "corrective action updated" : null,
  ].filter(Boolean);
  await db.query("insert into incident_events (incident_id, actor_id, action, note) values ($1,$2,$3,$4)", [
    id, s.user.id, parts.join("; ") || "note", patch.note?.slice(0, 2000) ?? null,
  ]);
  await audit(db, { id: s.user.id, label: s.user.username }, "incident.updated", { type: "incident", id }, { status: patch.status });
}
