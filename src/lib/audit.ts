/**
 * Append-only audit trail (the audit_log table rejects UPDATE/DELETE at the
 * database level). Never put clinical answers, passwords or tokens in details.
 */
import type { Db } from "./db";

export interface AuditActor {
  id: string | null;
  label: string;
}

export async function audit(
  db: Db,
  actor: AuditActor | null,
  action: string,
  entity?: { type: string; id?: string | null },
  details: Record<string, unknown> = {},
  ip?: string | null,
) {
  await db.query(
    `insert into audit_log (actor_id, actor_label, action, entity, entity_id, ip, details)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [actor?.id ?? null, actor?.label ?? "system", action, entity?.type ?? null, entity?.id ?? null, ip ?? null, JSON.stringify(details)],
  );
}
