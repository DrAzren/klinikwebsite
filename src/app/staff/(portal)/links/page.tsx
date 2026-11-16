import { ExternalLink, Lock } from "lucide-react";
import { ActionForm, Submit } from "@/components/staff/form";
import { Card, Checkbox, Input, PageHeader, Select } from "@/components/staff/ui";
import { requireStaff } from "@/lib/auth/dal";
import { can, ROLE_LABEL, ROLES } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { LINK_CATEGORIES, LINK_CATEGORY_LABEL, listLinks } from "@/lib/staff/admin";
import { deleteLinkAction, saveLinkAction } from "../../actions/ops";

export const metadata = { title: "SOP & links" };

export default async function LinksPage({ searchParams }: PageProps<"/staff/links">) {
  const s = await requireStaff("links:view");
  const { q } = (await searchParams) as { q?: string };
  const links = await listLinks(await getDb(), s, q);
  const manager = can(s.user.role, "links:manage");
  return (
    <>
      <PageHeader title="SOP & pautan penting · SOP & links" intro="Prosedur, borang dan kenalan penting. Bahan terhad hanya dipaparkan kepada peranan yang dibenarkan." />
      <form className="mb-6 flex max-w-lg gap-2">
        <input name="q" defaultValue={q} placeholder="Cari SOP, borang, kenalan…" className="h-11 flex-1 rounded-full bg-white px-4 text-sm ring-1 ring-line" />
        <button className="h-11 rounded-full bg-navy-900 px-5 text-sm font-semibold text-white">Cari</button>
      </form>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {LINK_CATEGORIES.map((cat) => {
          const items = links.filter((l) => l.category === cat);
          if (!items.length && !manager) return null;
          return (
            <Card key={cat} title={LINK_CATEGORY_LABEL[cat].ms}>
              {items.length === 0 ? <p className="text-sm text-ink-muted">Belum ada pautan.</p> : (
                <ul className="space-y-2">
                  {items.map((l) => (
                    <li key={l.id} className="group flex items-start justify-between gap-2 rounded-2xl bg-paper p-3 ring-1 ring-line">
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-navy-900">{l.title}{l.allowed_roles.length > 0 && <Lock className="h-3 w-3 text-warning" />}<ExternalLink className="h-3 w-3 text-ink-muted" /></p>
                        {l.description && <p className="mt-0.5 text-xs text-ink-muted">{l.description}</p>}
                      </a>
                      {manager && <ActionForm action={deleteLinkAction} confirm="Delete this link?"><input type="hidden" name="id" value={l.id} /><button className="text-xs text-danger opacity-60 hover:opacity-100">Buang</button></ActionForm>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
      {manager && (
        <Card title="Tambah pautan · Add link" className="mt-6">
          <ActionForm action={saveLinkAction} resetOnSuccess className="grid gap-3 md:grid-cols-4">
            <Select label="Kategori" name="category" options={LINK_CATEGORIES.map((c) => ({ value: c, label: LINK_CATEGORY_LABEL[c].ms }))} />
            <Input label="Tajuk" name="title" required />
            <Input label="URL (https:, tel:, mailto:)" name="url" required className="md:col-span-2" />
            <Input label="Keterangan" name="description" className="md:col-span-2" />
            <fieldset className="md:col-span-2">
              <legend className="text-xs font-medium text-ink-soft">Hadkan kepada peranan (kosong = semua staf)</legend>
              <div className="mt-2 flex flex-wrap gap-4">{ROLES.filter((r) => r !== "super_admin").map((r) => <Checkbox key={r} label={ROLE_LABEL[r].ms} name="roles" value={r} />)}</div>
            </fieldset>
            <div><Submit>Simpan</Submit></div>
          </ActionForm>
          <p className="mt-3 text-xs text-ink-muted">Pautan ke Google Drive mengekalkan kebenaran Drive sendiri — kongsi folder hanya dengan akaun staf yang sepatutnya.</p>
        </Card>
      )}
    </>
  );
}

/** Per-user, auth-gated page: rendered at request time. */
export const instant = false;
