import Link from "next/link";
import { AlertTriangle, Download } from "lucide-react";
import { Card, Notice, PageHeader, Status, Table, Td } from "@/components/staff/ui";
import { requireStaff } from "@/lib/auth/dal";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { clinicians, FOLLOW_UP_LABEL, FOLLOW_UP_STATUSES, listScreenings, severityLabel, type ScreeningFilters } from "@/lib/screening/admin";

export const metadata = { title: "Screening" };

const SEVERITIES = ["minimal", "mild", "moderate", "moderately_severe", "severe"];

export default async function ScreeningAdmin({ searchParams }: PageProps<"/staff/screening">) {
  const s = await requireStaff("screening:read");
  const sp = (await searchParams) as ScreeningFilters & Record<string, string>;
  const db = await getDb();
  const filters: ScreeningFilters = { q: sp.q, from: sp.from, to: sp.to, instrument: sp.instrument as ScreeningFilters["instrument"], severity: sp.severity, priority: sp.priority, status: sp.status, assigned: sp.assigned };
  const [rows, docs] = await Promise.all([listScreenings(db, s, filters), clinicians(db)]);
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();
  const sel = "h-10 rounded-xl bg-paper px-3 text-sm ring-1 ring-line";

  return (
    <>
      <PageHeader
        title="Saringan kesihatan mental · Screening"
        intro="Rekod sulit. Setiap paparan direkodkan dalam log audit. Keutamaan: SEGERA = PHQ-9 item 9 positif; SEMAK = skor ≥10."
        actions={can(s.user.role, "screening:export") ? (
          <>
            <a href={`/api/staff/screening/export?${qs}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-line"><Download className="h-4 w-4" />CSV (tanpa pengenalan)</a>
            <a href={`/api/staff/screening/export?${qs}&identifiers=1`} className="inline-flex h-10 items-center gap-2 rounded-full bg-navy-900 px-4 text-sm font-semibold text-white"><Download className="h-4 w-4" />CSV + butiran hubungan</a>
          </>
        ) : undefined}
      />
      <div className="mb-5"><Notice tone="warn">Klinik tidak menyediakan pemantauan 24/7. Semak rekod SEGERA secepat mungkin semasa waktu operasi dan ikut protokol risiko klinik.</Notice></div>
      <Card>
        <form className="grid gap-2 sm:grid-cols-4 xl:grid-cols-8">
          <input name="q" defaultValue={sp.q} placeholder="Rujukan / nama / telefon" className={`${sel} sm:col-span-2`} />
          <input name="from" type="date" defaultValue={sp.from} aria-label="From" className={sel} />
          <input name="to" type="date" defaultValue={sp.to} aria-label="To" className={sel} />
          <select name="instrument" defaultValue={sp.instrument ?? ""} className={sel}><option value="">Semua alat</option><option value="phq9">PHQ-9</option><option value="gad7">GAD-7</option></select>
          <select name="severity" defaultValue={sp.severity ?? ""} className={sel}><option value="">Semua tahap</option>{SEVERITIES.map((v) => <option key={v} value={v}>{severityLabel(v, "ms")}</option>)}</select>
          <select name="priority" defaultValue={sp.priority ?? ""} className={sel}><option value="">Semua keutamaan</option><option value="urgent">Segera</option><option value="review">Semak</option><option value="routine">Rutin</option></select>
          <select name="status" defaultValue={sp.status ?? ""} className={sel}><option value="">Semua status</option>{FOLLOW_UP_STATUSES.map((v) => <option key={v} value={v}>{FOLLOW_UP_LABEL[v].ms}</option>)}</select>
          <select name="assigned" defaultValue={sp.assigned ?? ""} className={sel}><option value="">Semua klinisian</option><option value="me">Saya</option><option value="unassigned">Belum ditugaskan</option>{docs.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}</select>
          <div className="flex gap-2 sm:col-span-2 xl:col-span-1">
            <button className="h-10 flex-1 rounded-full bg-navy-900 px-4 text-sm font-semibold text-white">Tapis</button>
            <Link href="/staff/screening" className="h-10 px-2 text-sm leading-10 text-ink-muted">Reset</Link>
          </div>
        </form>
      </Card>
      <Card className="mt-5" title={`${rows.length} rekod`}>
        <Table head={["Keutamaan", "Rujukan", "Dihantar", "PHQ-9", "GAD-7", "Susulan", "Status", "Klinisian"]} empty="Tiada rekod sepadan.">
          {rows.map((r) => (
            <tr key={r.id} className={r.priority === "urgent" && r.follow_up_status === "new" ? "bg-danger-soft/50" : ""}>
              <Td>{r.priority === "urgent" ? <span className="inline-flex items-center gap-1 rounded-full bg-danger px-2.5 py-0.5 text-xs font-bold text-white"><AlertTriangle className="h-3 w-3" />SEGERA</span> : <Status value={r.priority} />}</Td>
              <Td><Link href={`/staff/screening/${r.id}`} className="font-mono font-semibold text-teal-700 hover:underline">{r.reference}</Link></Td>
              <Td className="whitespace-nowrap text-xs text-ink-muted">{formatDateTime(r.submitted_at)}</Td>
              <Td>{r.phq9_score ?? "—"} <span className="text-xs text-ink-muted">{r.phq9_severity && severityLabel(r.phq9_severity, "ms")}</span></Td>
              <Td>{r.gad7_score ?? "—"} <span className="text-xs text-ink-muted">{r.gad7_severity && severityLabel(r.gad7_severity, "ms")}</span></Td>
              <Td>{r.contact_requested ? "Ya" : "Tanpa nama"}</Td>
              <Td><Status value={r.follow_up_status} label={FOLLOW_UP_LABEL[r.follow_up_status].ms} /></Td>
              <Td>{r.assignee ?? <span className="text-ink-muted">—</span>}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}

/** Per-user, auth-gated page: rendered at request time. */
export const instant = false;
