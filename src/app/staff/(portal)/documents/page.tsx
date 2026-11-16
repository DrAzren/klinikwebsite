import Link from "next/link";
import { Download } from "lucide-react";
import { DocumentUpload } from "@/components/staff/document-upload";
import { ActionForm } from "@/components/staff/form";
import { Card, PageHeader, Status, Table, Td } from "@/components/staff/ui";
import { requireStaff } from "@/lib/auth/dal";
import { can, FINANCE_CATEGORIES } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { formatDate, formatMYR } from "@/lib/format";
import { CATEGORY_LABEL, DOCUMENT_CATEGORIES, listDocuments } from "@/lib/staff/documents";
import { reviewDocumentAction } from "../../actions/ops";

export const metadata = { title: "Documents" };

export default async function DocumentsPage({ searchParams }: PageProps<"/staff/documents">) {
  const s = await requireStaff();
  const role = s.user.role;
  if (!can(role, "documents:upload") && !can(role, "finance:read")) {
    const { redirect } = await import("next/navigation");
    redirect("/staff/dashboard?denied=documents");
  }
  const sp = (await searchParams) as { q?: string; category?: string; status?: string };
  const db = await getDb();
  const docs = await listDocuments(db, s, sp);
  const approver = can(role, "documents:approve");
  const cats = DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: `${CATEGORY_LABEL[c].ms} · ${CATEGORY_LABEL[c].en}` }));

  return (
    <>
      <PageHeader title="Dokumen & invois · Documents" intro="Invois pembekal, resit, invois makmal, stok dan penyelenggaraan. Fail disemak jenisnya, fail pendua ditolak, dan disegerakkan ke folder Google Drive yang ditetapkan." />
      <div className="grid gap-6 xl:grid-cols-5">
        {can(role, "documents:upload") && (
          <Card title="Muat naik · Upload" className="xl:col-span-2"><DocumentUpload categories={cats} /></Card>
        )}
        <Card title={`Dokumen (${docs.length})`} className="xl:col-span-3">
          <form className="mb-4 flex flex-wrap gap-2">
            <input name="q" defaultValue={sp.q} placeholder="Cari tajuk, pembekal, no. rujukan" className="h-10 flex-1 rounded-xl bg-paper px-3 text-sm ring-1 ring-line" />
            <select name="category" defaultValue={sp.category ?? ""} className="h-10 rounded-xl bg-paper px-3 text-sm ring-1 ring-line">
              <option value="">Semua kategori</option>{cats.map((c) => <option key={c.value} value={c.value}>{c.label.split(" · ")[0]}</option>)}
            </select>
            <select name="status" defaultValue={sp.status ?? ""} className="h-10 rounded-xl bg-paper px-3 text-sm ring-1 ring-line">
              <option value="">Semua status</option><option value="pending">pending</option><option value="approved">approved</option><option value="rejected">rejected</option>
            </select>
            <button className="h-10 rounded-full bg-navy-900 px-4 text-sm font-semibold text-white">Tapis</button>
            {(sp.q || sp.category || sp.status) && <Link href="/staff/documents" className="h-10 px-2 text-sm leading-10 text-ink-muted">Reset</Link>}
          </form>
          <Table head={["Dokumen", "Kategori", "Jumlah", "Status", "Drive", ""]} empty="Tiada dokumen.">
            {docs.map((d) => (
              <tr key={d.id}>
                <Td>
                  <p className="font-medium text-navy-900">{d.title}</p>
                  <p className="text-xs text-ink-muted">{[d.supplier, d.reference_no, d.doc_date && formatDate(d.doc_date)].filter(Boolean).join(" · ")}</p>
                  <p className="text-xs text-ink-muted">oleh {d.uploader} · {formatDate(d.created_at)}</p>
                </Td>
                <Td><span className={(FINANCE_CATEGORIES as readonly string[]).includes(d.category) ? "text-navy-700" : ""}>{CATEGORY_LABEL[d.category].ms}</span></Td>
                <Td>{formatMYR(d.amount_myr)}</Td>
                <Td><Status value={d.status} /></Td>
                <Td><Status value={d.drive_status} /></Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <a href={`/api/staff/files/${d.file_id}`} aria-label="Download" className="rounded-full p-2 ring-1 ring-line hover:bg-paper"><Download className="h-4 w-4" /></a>
                    {approver && d.status === "pending" && (
                      <ActionForm action={reviewDocumentAction} className="flex gap-1">
                        <input type="hidden" name="id" value={d.id} />
                        <button name="decision" value="approved" className="h-8 rounded-full bg-success px-3 text-xs font-semibold text-white">Lulus</button>
                        <button name="decision" value="rejected" className="h-8 rounded-full bg-white px-3 text-xs font-semibold text-danger ring-1 ring-danger/30">Tolak</button>
                      </ActionForm>
                    )}
                  </div>
                </Td>
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
