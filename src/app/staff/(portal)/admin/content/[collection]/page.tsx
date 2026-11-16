import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { ActionForm, Submit } from "@/components/staff/form";
import { Card, PageHeader, Status, Table, Td } from "@/components/staff/ui";
import { requireStaff } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { listItems, schemaFor } from "@/lib/content/admin";
import { formatDateTime } from "@/lib/format";
import { deleteContentAction } from "../../../../actions/admin";

export const metadata = { title: "Content" };

const titleOf = (data: Record<string, unknown>, key: string) => {
  const v = data[key];
  if (v && typeof v === "object" && "ms" in v) return String((v as { ms: string }).ms);
  return String(v ?? data.slug ?? "—");
};

export default async function CollectionPage({ params }: PageProps<"/staff/admin/content/[collection]">) {
  const s = await requireStaff("content:manage");
  const { collection } = await params;
  const schema = schemaFor(collection);
  if (!schema) notFound();
  const items = await listItems(await getDb(), s, schema.name);
  if (schema.singleton && items[0]) {
    const { redirect } = await import("next/navigation");
    redirect(`/staff/admin/content/${schema.name}/${items[0].id}`);
  }
  return (
    <>
      <Link href="/staff/admin/content" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-700"><ArrowLeft className="h-4 w-4" />Kandungan</Link>
      <PageHeader title={schema.label} intro={schema.description} actions={
        !schema.singleton && <Link href={`/staff/admin/content/${schema.name}/new`} className="inline-flex h-10 items-center gap-2 rounded-full bg-navy-900 px-4 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Baharu</Link>
      } />
      <Card>
        <Table head={["Tajuk", "Slug", "Status", "Susunan", "Dikemas kini", ""]} empty="Tiada item.">
          {items.map((it) => (
            <tr key={it.id}>
              <Td><Link href={`/staff/admin/content/${schema.name}/${it.id}`} className="font-semibold text-teal-700 hover:underline">{titleOf(it.data, schema.titleKey)}</Link>
                {schema.name === "panels" && <span className="ml-2"><Status value={String(it.data.verification) === "confirmed" ? "approved" : "pending"} label={String(it.data.verification).replace("_", " ")} /></span>}
              </Td>
              <Td className="font-mono text-xs">{it.slug}</Td>
              <Td><Status value={it.status} /></Td>
              <Td>{it.sort}</Td>
              <Td className="text-xs text-ink-muted">{formatDateTime(it.updated_at)}</Td>
              <Td><ActionForm action={deleteContentAction} confirm="Delete permanently?"><input type="hidden" name="id" value={it.id} /><Submit variant="danger" className="!h-8 !text-xs">Padam</Submit></ActionForm></Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}

/** Per-user, auth-gated page: rendered at request time. */
export const instant = false;
