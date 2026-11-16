import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Lock, Paperclip } from "lucide-react";
import { ActionForm, Submit } from "@/components/staff/form";
import { Card, PageHeader, Select, Status, Textarea } from "@/components/staff/ui";
import { requireStaff } from "@/lib/auth/dal";
import { can, ForbiddenError } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { CATEGORY_LABEL, getIncident, INCIDENT_STATUSES } from "@/lib/staff/incidents";
import { staffDirectory } from "@/lib/staff/admin";
import { updateIncidentAction } from "../../../actions/ops";

export const metadata = { title: "Incident" };

export default async function IncidentDetail({ params }: PageProps<"/staff/incidents/[id]">) {
  const s = await requireStaff("incident:report");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = await getDb();
  let inc;
  try {
    inc = await getIncident(db, s, id);
  } catch (e) {
    if (e instanceof ForbiddenError) redirect("/staff/incidents");
    throw e;
  }
  if (!inc) notFound();
  const manager = can(s.user.role, "incident:manage") && (!inc.confidential || can(s.user.role, "incident:confidential"));
  const staff = manager ? await staffDirectory(db) : [];

  return (
    <>
      <Link href="/staff/incidents" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-700"><ArrowLeft className="h-4 w-4" />Insiden</Link>
      <PageHeader title={inc.reference} intro={CATEGORY_LABEL[inc.category]} actions={<><Status value={inc.severity} /><Status value={inc.status} />{inc.confidential && <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger"><Lock className="h-3 w-3" />Sulit</span>}</>} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Butiran · Details">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-muted">Berlaku</dt><dd className="font-medium">{formatDateTime(inc.occurred_at)}</dd></div>
              <div><dt className="text-ink-muted">Lokasi</dt><dd className="font-medium">{inc.location || "—"}</dd></div>
              <div><dt className="text-ink-muted">Pelapor</dt><dd className="font-medium">{inc.reporter}</dd></div>
              <div><dt className="text-ink-muted">Ditugaskan</dt><dd className="font-medium">{inc.assignee ?? "—"}</dd></div>
            </dl>
            <p className="mt-5 whitespace-pre-wrap text-ink-soft">{inc.description}</p>
            {inc.corrective_action && <div className="mt-5 rounded-2xl bg-mint p-4 text-sm"><p className="font-semibold text-teal-700">Tindakan pembetulan · Corrective action</p><p className="mt-1 whitespace-pre-wrap">{inc.corrective_action}</p></div>}
            {inc.files.length > 0 && (
              <ul className="mt-5 space-y-1">{inc.files.map((f) => <li key={f.id}><a href={`/api/staff/files/${f.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:underline"><Paperclip className="h-4 w-4" />{f.original_name}</a></li>)}</ul>
            )}
          </Card>
          <Card title="Sejarah (tidak boleh diubah) · Immutable history">
            <ol className="space-y-3 border-l-2 border-line pl-4 text-sm">
              {inc.events.map((e, i) => (
                <li key={i}><p className="text-xs text-ink-muted">{formatDateTime(e.at)} · {e.actor ?? "system"}</p><p className="font-medium text-navy-900">{e.action}</p>{e.note && <p className="whitespace-pre-wrap text-ink-soft">{e.note}</p>}</li>
              ))}
            </ol>
          </Card>
        </div>
        {manager && (
          <Card title="Kemas kini · Update">
            <ActionForm action={updateIncidentAction} className="space-y-3">
              <input type="hidden" name="id" value={inc.id} />
              <Select label="Status" name="status" defaultValue={inc.status} options={INCIDENT_STATUSES.map((v) => ({ value: v, label: v.replace("_", " ") }))} />
              <Select label="Tugaskan kepada" name="assignedTo" defaultValue={inc.assigned_to ?? ""} options={[{ value: "", label: "— Tiada —" }, ...staff.map((u) => ({ value: u.id, label: u.full_name }))]} />
              <Textarea label="Tindakan pembetulan" name="correctiveAction" rows={3} defaultValue={inc.corrective_action ?? ""} />
              <Textarea label="Nota (direkodkan dalam sejarah)" name="note" rows={2} />
              <Submit>Simpan</Submit>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}

/** Per-user, auth-gated page: rendered at request time. */
export const instant = false;
