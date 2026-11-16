import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ActionForm, Submit } from "@/components/staff/form";
import { Card, PageHeader } from "@/components/staff/ui";
import { requireStaff } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { getItemById, schemaFor, type Field } from "@/lib/content/admin";
import { saveContentAction } from "../../../../../actions/admin";

export const metadata = { title: "Edit content" };

type L = { ms?: string; en?: string };
const field = "mt-1 w-full rounded-xl border-0 bg-paper px-3 text-sm text-navy-900 ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-teal-500";

function FieldInput({ f, value }: { f: Field; value: unknown }) {
  const label = (
    <span className="text-xs font-medium text-ink-soft">{f.label}{f.required && <span className="text-danger"> *</span>}{f.help && <span className="mt-0.5 block font-normal text-ink-muted">{f.help}</span>}</span>
  );
  switch (f.kind) {
    case "boolean":
      return <label className="flex items-center gap-2 text-sm"><input type="checkbox" name={f.key} defaultChecked={!!value} className="h-4 w-4 accent-teal-600" />{f.label}</label>;
    case "select":
      return <label className="block">{label}<select name={f.key} defaultValue={String(value ?? "")} className={`${field} h-10`}>{f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
    case "textarea":
      return <label className="block">{label}<textarea name={f.key} rows={4} defaultValue={String(value ?? "")} className={`${field} py-2`} /></label>;
    case "lines":
      return <label className="block">{label}<textarea name={f.key} rows={4} defaultValue={((value as string[]) ?? []).join("\n")} className={`${field} py-2`} /></label>;
    case "json":
      return <label className="block">{label}<textarea name={f.key} rows={6} defaultValue={JSON.stringify(value ?? (f.key === "social" ? {} : []), null, 2)} className={`${field} py-2 font-mono text-xs`} /></label>;
    case "l-text": case "l-textarea": case "l-markdown": {
      const v = (value as L) ?? {};
      const rows = f.kind === "l-markdown" ? 16 : 4;
      return (
        <fieldset>{label}
          <div className="mt-1 grid gap-2 md:grid-cols-2">
            {(["ms", "en"] as const).map((lng) => (
              <label key={lng} className="block text-[0.65rem] font-semibold uppercase tracking-wider text-ink-muted">{lng === "ms" ? "Bahasa Melayu" : "English"}
                {f.kind === "l-text"
                  ? <input name={`${f.key}.${lng}`} defaultValue={v[lng] ?? ""} className={`${field} h-10 font-normal normal-case tracking-normal`} />
                  : <textarea name={`${f.key}.${lng}`} rows={rows} defaultValue={v[lng] ?? ""} className={`${field} py-2 font-normal normal-case tracking-normal ${f.kind === "l-markdown" ? "font-mono text-xs" : ""}`} />}
              </label>
            ))}
          </div>
        </fieldset>
      );
    }
    case "l-lines": {
      const arr = (value as L[]) ?? [];
      return (
        <fieldset>{label}
          <div className="mt-1 grid gap-2 md:grid-cols-2">
            {(["ms", "en"] as const).map((lng) => (
              <label key={lng} className="block text-[0.65rem] font-semibold uppercase tracking-wider text-ink-muted">{lng === "ms" ? "BM — satu baris setiap item" : "EN — one line per item"}
                <textarea name={`${f.key}.${lng}`} rows={4} defaultValue={arr.map((x) => x[lng] ?? "").join("\n")} className={`${field} py-2 font-normal normal-case tracking-normal`} />
              </label>
            ))}
          </div>
        </fieldset>
      );
    }
    default:
      return <label className="block">{label}<input name={f.key} type={f.kind === "number" ? "number" : f.kind === "date" ? "date" : "text"} defaultValue={String(value ?? "")} className={`${field} h-10`} /></label>;
  }
}

export default async function EditContent({ params }: PageProps<"/staff/admin/content/[collection]/[id]">) {
  const s = await requireStaff("content:manage");
  const { collection, id } = await params;
  const schema = schemaFor(collection);
  if (!schema) notFound();
  const item = id === "new" ? null : await getItemById(await getDb(), s, id);
  if (id !== "new" && (!item || item.collection !== schema.name)) notFound();
  const data = item?.data ?? {};
  return (
    <>
      <Link href={`/staff/admin/content/${schema.name}`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-700"><ArrowLeft className="h-4 w-4" />{schema.label}</Link>
      <PageHeader title={item ? `Edit · ${schema.label}` : `Baharu · ${schema.label}`} intro={schema.description} />
      <ActionForm action={saveContentAction} className="space-y-6">
        <input type="hidden" name="collection" value={schema.name} />
        {item && <input type="hidden" name="id" value={item.id} />}
        {schema.singleton && <input type="hidden" name="slug" value="site" />}
        <Card>
          <div className="grid gap-5">
            {schema.fields.map((f) => <FieldInput key={f.key} f={f} value={data[f.key]} />)}
          </div>
        </Card>
        <Card>
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-xs font-medium text-ink-soft">Status
              <select name="status" defaultValue={item?.status ?? "draft"} className={`${field} h-10 w-40`}>
                <option value="draft">Draf</option><option value="published">Diterbitkan</option><option value="archived">Arkib</option>
              </select>
            </label>
            <label className="text-xs font-medium text-ink-soft">Susunan / Sort<input name="sort" type="number" defaultValue={item?.sort ?? 0} className={`${field} h-10 w-28`} /></label>
            <Submit>Simpan / Save</Submit>
          </div>
        </Card>
      </ActionForm>
    </>
  );
}

/** Per-user, auth-gated page: rendered at request time. */
export const instant = false;
