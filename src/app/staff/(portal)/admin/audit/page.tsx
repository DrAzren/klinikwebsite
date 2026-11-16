import { Card, PageHeader, Table, Td } from "@/components/staff/ui";
import { requireStaff } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { auditLog } from "@/lib/staff/admin";

export const metadata = { title: "Audit log" };

const GROUPS = ["", "auth.", "screening.", "users.", "document.", "file.", "leave.", "roster.", "incident.", "content.", "integrations."];

export default async function AuditPage({ searchParams }: PageProps<"/staff/admin/audit">) {
  const s = await requireStaff("audit:view");
  const sp = (await searchParams) as { q?: string; action?: string };
  const rows = await auditLog(await getDb(), s, { q: sp.q, action: sp.action, limit: 300 });
  return (
    <>
      <PageHeader title="Log audit keselamatan · Security audit log" intro="Rekod tambah-sahaja (tidak boleh diubah atau dipadam pada peringkat pangkalan data)." />
      <Card>
        <form className="mb-4 flex flex-wrap gap-2">
          <select name="action" defaultValue={sp.action ?? ""} className="h-10 rounded-xl bg-paper px-3 text-sm ring-1 ring-line">{GROUPS.map((g) => <option key={g} value={g}>{g || "Semua tindakan"}</option>)}</select>
          <input name="q" defaultValue={sp.q} placeholder="Pengguna atau ID entiti" className="h-10 flex-1 rounded-xl bg-paper px-3 text-sm ring-1 ring-line" />
          <button className="h-10 rounded-full bg-navy-900 px-4 text-sm font-semibold text-white">Tapis</button>
        </form>
        <Table head={["Masa", "Pelaku", "Tindakan", "Entiti", "IP", "Butiran"]} empty="Tiada rekod.">
          {rows.map((r) => (
            <tr key={r.id}>
              <Td className="whitespace-nowrap text-xs text-ink-muted">{formatDateTime(r.at)}</Td>
              <Td>{r.actor_label}</Td>
              <Td className={`font-mono text-xs ${r.action.includes("failed") || r.action.includes("locked") ? "text-danger" : ""}`}>{r.action}</Td>
              <Td className="font-mono text-xs">{r.entity}{r.entity_id ? `:${r.entity_id.slice(0, 12)}` : ""}</Td>
              <Td className="text-xs">{r.ip ?? "—"}</Td>
              <Td className="max-w-xs truncate font-mono text-xs text-ink-muted">{Object.keys(r.details ?? {}).length ? JSON.stringify(r.details) : ""}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}

/** Per-user, auth-gated page: rendered at request time. */
export const instant = false;
