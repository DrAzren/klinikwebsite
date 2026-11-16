import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/staff/ui";
import { requireStaff } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { SCHEMAS } from "@/lib/content/admin";

export const metadata = { title: "Content" };

export default async function ContentIndex() {
  await requireStaff("content:manage");
  const counts = await (await getDb()).query<{ collection: string; total: number; published: number }>(
    "select collection, count(*)::int as total, count(*) filter (where status = 'published')::int as published from content_items group by collection",
  );
  return (
    <>
      <PageHeader title="Kandungan laman web · Website content" intro="Edit kandungan awam. Perubahan yang diterbitkan dikemas kini serta-merta. Sahkan semua maklumat klinikal, kelayakan dan panel sebelum menerbitkan." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SCHEMAS.map((sc) => {
          const c = counts.find((x) => x.collection === sc.name);
          return (
            <Link key={sc.name} href={`/staff/admin/content/${sc.name}`} className="group rounded-3xl bg-white p-6 ring-1 ring-line transition hover:shadow-soft">
              <div className="flex items-center justify-between"><h2 className="font-semibold text-navy-900">{sc.label}</h2><ArrowRight className="h-4 w-4 text-ink-muted transition group-hover:translate-x-1" /></div>
              <p className="mt-2 text-sm text-ink-muted">{sc.description}</p>
              <p className="mt-4 text-xs font-semibold text-teal-700">{c?.published ?? 0} diterbitkan · {c?.total ?? 0} jumlah</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}

/** Per-user, auth-gated page: rendered at request time. */
export const instant = false;
