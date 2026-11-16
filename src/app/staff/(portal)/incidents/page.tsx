import Link from "next/link";
import { Lock } from "lucide-react";
import { ActionForm, Submit } from "@/components/staff/form";
import { Card, Checkbox, Input, PageHeader, Select, Status, Table, Td, Textarea } from "@/components/staff/ui";
import { requireStaff } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { formatDateTime, nowMytInput } from "@/lib/format";
import { CATEGORY_LABEL, INCIDENT_CATEGORIES, INCIDENT_SEVERITIES, INCIDENT_STATUSES, listIncidents } from "@/lib/staff/incidents";
import { reportIncidentAction } from "../../actions/ops";

export const metadata = { title: "Incidents" };

export default async function IncidentsPage({ searchParams }: PageProps<"/staff/incidents">) {
  const s = await requireStaff("incident:report");
  const { status } = (await searchParams) as { status?: string };
  const db = await getDb();
  const list = await listIncidents(db, s, INCIDENT_STATUSES.includes(status as never) ? status : undefined);
  const nowLocal = nowMytInput();

  return (
    <>
      <PageHeader title="Laporan insiden · Incidents" intro="Laporkan insiden ubat, stok, peralatan, keselamatan, aduan pesakit atau operasi. Laporan sulit hanya dilihat oleh CEO, pelapor dan pegawai yang ditugaskan." />
      <div className="grid gap-6 xl:grid-cols-5">
        <Card title="Laporkan insiden · Report" className="xl:col-span-2">
          <ActionForm action={reportIncidentAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
            <Select label="Kategori" name="category" options={INCIDENT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} className="sm:col-span-2" />
            <Input label="Tarikh & masa (MYT)" name="occurredAt" type="datetime-local" required defaultValue={nowLocal} max={nowLocal} />
            <Select label="Tahap" name="severity" defaultValue="medium" options={INCIDENT_SEVERITIES.map((v) => ({ value: v, label: v }))} />
            <Input label="Lokasi" name="location" className="sm:col-span-2" />
            <Textarea label="Apa yang berlaku? / What happened?" name="description" rows={4} required minLength={10} className="sm:col-span-2" />
            <Input label="Bukti (PDF/gambar, boleh pilih beberapa)" name="evidence" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className="sm:col-span-2" />
            <div className="sm:col-span-2"><Checkbox label="Sulit — hadkan akses / Confidential — restrict access" name="confidential" /></div>
            <div><Submit>Hantar laporan</Submit></div>
          </ActionForm>
        </Card>
        <Card title="Insiden · Incidents" className="xl:col-span-3" actions={
          <div className="flex flex-wrap gap-1 text-xs">
            {["", ...INCIDENT_STATUSES].map((st) => <Link key={st} href={st ? `/staff/incidents?status=${st}` : "/staff/incidents"} className={`rounded-full px-2.5 py-1 ring-1 ${status === st || (!status && !st) ? "bg-navy-900 text-white ring-navy-900" : "ring-line"}`}>{st || "semua"}</Link>)}
          </div>
        }>
          <Table head={["Rujukan", "Kategori", "Tahap", "Status", "Pelapor", "Tarikh"]} empty="Tiada insiden.">
            {list.map((i) => (
              <tr key={i.id}>
                <Td><Link href={`/staff/incidents/${i.id}`} className="font-semibold text-teal-700 hover:underline">{i.reference}</Link>{i.confidential && <Lock className="ml-1 inline h-3.5 w-3.5 text-danger" aria-label="Confidential" />}</Td>
                <Td>{CATEGORY_LABEL[i.category]?.split(" · ")[0]}</Td>
                <Td><Status value={i.severity} /></Td>
                <Td><Status value={i.status} /></Td>
                <Td>{i.reporter}</Td>
                <Td className="whitespace-nowrap text-xs text-ink-muted">{formatDateTime(i.occurred_at)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </>
  );
}

/** Per-user, auth-gated page: rendered at request time. */
export const instant = false;
