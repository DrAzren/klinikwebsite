import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, TriangleAlert } from "lucide-react";
import { ActionForm, Submit } from "@/components/staff/form";
import { Card, Checkbox, Input, PageHeader, Select, Table, Td } from "@/components/staff/ui";
import { requireStaff } from "@/lib/auth/dal";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import { getMonth, rosterHistory } from "@/lib/staff/roster";
import { toISODate } from "@/lib/staff/leave";
import { staffDirectory } from "@/lib/staff/admin";
import { assignAction, rotationAction, shiftDefAction, unassignAction } from "../../actions/ops";

export const metadata = { title: "Roster" };
const WD = ["Isn", "Sel", "Rab", "Kha", "Jum", "Sab", "Ahd"];

export default async function RosterPage({ searchParams }: PageProps<"/staff/roster">) {
  const s = await requireStaff("roster:view");
  const sp = (await searchParams) as { m?: string; view?: string };
  const now = new Date();
  const [y, m] = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m!.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const db = await getDb();
  const editor = can(s.user.role, "roster:edit");
  const configurer = can(s.user.role, "roster:configure");
  const [month, staff, history] = await Promise.all([getMonth(db, s, y, m), editor ? staffDirectory(db) : Promise.resolve([]), rosterHistory(db, s, 40)]);
  const key = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, "0")}`;
  const prev = m === 1 ? key(y - 1, 12) : key(y, m - 1);
  const next = m === 12 ? key(y + 1, 1) : key(y, m + 1);
  const view = sp.view === "list" ? "list" : "calendar";
  const active = month.shifts.filter((x) => x.active);
  const firstDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday-first
  const today = toISODate(new Date());
  const warnFor = (date: string) => month.warnings.filter((w) => w.date === date);
  const title = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("ms-MY", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <PageHeader
        title="Jadual tugas · Duty roster"
        intro="Syif A, B dan C dengan amaran liputan berdasarkan cuti yang diluluskan."
        actions={
          <>
            <Link href={`/staff/roster?m=${key(y, m)}&view=${view === "list" ? "calendar" : "list"}`} className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-semibold ring-1 ring-line">{view === "list" ? "Paparan kalendar" : "Paparan senarai"}</Link>
            <a href={`/api/staff/roster/export?m=${key(y, m)}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-navy-900 px-4 text-sm font-semibold text-white"><Download className="h-4 w-4" />CSV</a>
          </>
        }
      />
      <div className="mb-4 flex items-center gap-3">
        <Link aria-label="Previous month" href={`/staff/roster?m=${prev}&view=${view}`} className="rounded-full p-2 ring-1 ring-line hover:bg-white"><ChevronLeft className="h-4 w-4" /></Link>
        <h2 className="min-w-44 text-center text-lg font-semibold capitalize text-navy-900">{title}</h2>
        <Link aria-label="Next month" href={`/staff/roster?m=${next}&view=${view}`} className="rounded-full p-2 ring-1 ring-line hover:bg-white"><ChevronRight className="h-4 w-4" /></Link>
        <div className="ml-auto hidden gap-3 text-xs sm:flex">
          {active.map((sh) => <span key={sh.code} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: sh.color }} />{sh.code} {sh.start_time}–{sh.end_time} (min {sh.min_staff})</span>)}
        </div>
      </div>

      {month.warnings.length > 0 && (
        <details className="mb-4 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">
          <summary className="cursor-pointer font-semibold"><TriangleAlert className="mr-1 inline h-4 w-4" />{month.warnings.length} amaran liputan · coverage warnings</summary>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">{month.warnings.slice(0, 60).map((w, i) => <li key={i}>{formatDate(w.date)} · {w.shift} · {w.kind.replace("_", " ")} — {w.detail}</li>)}</ul>
        </details>
      )}

      {view === "calendar" ? (
        <div className="overflow-x-auto rounded-3xl bg-white p-3 ring-1 ring-line">
          <div className="grid min-w-[860px] grid-cols-7 gap-1.5">
            {WD.map((d) => <div key={d} className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">{d}</div>)}
            {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: month.days }).map((_, i) => {
              const date = key(y, m) + `-${String(i + 1).padStart(2, "0")}`;
              const w = warnFor(date);
              return (
                <div key={date} className={`min-h-32 rounded-2xl p-2 ring-1 ${date === today ? "ring-2 ring-teal-500" : w.length ? "ring-warning/40" : "ring-line"} ${w.length ? "bg-warning-soft/50" : "bg-paper"}`}>
                  <p className="text-xs font-semibold text-navy-900">{i + 1}</p>
                  <div className="mt-1 space-y-1">
                    {active.map((sh) => {
                      const people = month.assignments.filter((a) => a.date === date && a.shift_code === sh.code);
                      return (
                        <div key={sh.code} className="flex items-start gap-1 text-[0.7rem] leading-tight">
                          <span className="mt-0.5 rounded px-1 font-bold text-white" style={{ background: sh.color }}>{sh.code}</span>
                          <span className={people.length < sh.min_staff ? "text-warning" : "text-ink-soft"}>{people.map((p) => p.full_name.replace(/^DEMO\s+/, "").split(" ").slice(0, 2).join(" ")).join(", ") || "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Card>
          <Table head={["Tarikh", "Syif", "Staf", ""]} empty="Tiada tugasan bulan ini.">
            {month.assignments.map((a) => (
              <tr key={a.id}>
                <Td>{formatDate(a.date, "ms", { weekday: "short", day: "numeric", month: "short" })}</Td>
                <Td>{a.shift_code}</Td>
                <Td>{a.full_name}</Td>
                <Td>{editor && <ActionForm action={unassignAction}><input type="hidden" name="id" value={a.id} /><Submit variant="ghost">Buang</Submit></ActionForm>}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {editor && (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card title="Tugaskan syif · Assign a shift">
            <ActionForm action={assignAction} className="grid gap-3 sm:grid-cols-4">
              <Input label="Tarikh" name="date" type="date" required defaultValue={today} />
              <Select label="Syif" name="shift" options={active.map((sh) => ({ value: sh.code, label: `${sh.code} · ${sh.label}` }))} />
              <Select label="Staf" name="userId" options={staff.map((u) => ({ value: u.id, label: u.full_name }))} />
              <div className="flex items-end"><Submit>Tugaskan</Submit></div>
            </ActionForm>
          </Card>
          <Card title="Corak giliran · Rotation pattern">
            <ActionForm action={rotationAction} className="grid gap-3 sm:grid-cols-2">
              <Select label="Staf" name="userId" options={staff.map((u) => ({ value: u.id, label: u.full_name }))} className="sm:col-span-2" />
              <Input label="Mula" name="startDate" type="date" required />
              <Input label="Tamat" name="endDate" type="date" required />
              <Input label="Corak (cth: A A B B OFF OFF)" name="pattern" required placeholder="A A B B C OFF" className="sm:col-span-2" />
              <p className="text-xs text-ink-muted sm:col-span-2">Menggantikan tugasan sedia ada staf ini dalam julat tarikh. Replaces this person&apos;s existing assignments in the range.</p>
              <div><Submit>Gunakan</Submit></div>
            </ActionForm>
          </Card>
        </div>
      )}

      {configurer && (
        <Card title="Tetapan syif · Shift settings (CEO)" className="mt-6">
          <div className="space-y-3">
            {[...month.shifts, { code: "", label: "", start_time: "", end_time: "", min_staff: 1, color: "#00B7B1", active: true, sort: 99 }].map((sh) => (
              <ActionForm key={sh.code || "new"} action={shiftDefAction} className="grid items-end gap-2 rounded-2xl bg-paper p-3 sm:grid-cols-8">
                <Input label="Kod" name="code" defaultValue={sh.code} required maxLength={4} />
                <Input label="Label" name="label" defaultValue={sh.label} required className="sm:col-span-2" />
                <Input label="Mula" name="start" type="time" defaultValue={sh.start_time} required />
                <Input label="Tamat" name="end" type="time" defaultValue={sh.end_time} required />
                <Input label="Min staf" name="min" type="number" min={0} defaultValue={sh.min_staff} />
                <Input label="Warna" name="color" type="color" defaultValue={sh.color} />
                <div className="flex items-center gap-3"><Checkbox label="Aktif" name="active" defaultChecked={sh.active} /><input type="hidden" name="sort" value={sh.sort} /><Submit variant="ghost">{sh.code ? "Simpan" : "Tambah"}</Submit></div>
              </ActionForm>
            ))}
          </div>
        </Card>
      )}

      <Card title="Sejarah perubahan · Change history" className="mt-6">
        <ul className="divide-y divide-line text-sm">
          {history.map((h) => (
            <li key={h.id} className="py-2 text-ink-soft">
              <span className="text-xs text-ink-muted">{formatDateTime(h.at)}</span> · <strong className="text-navy-900">{h.actor ?? "system"}</strong> {h.action} {h.shift_code ?? ""} {formatDate(h.date)} {h.staff ? `· ${h.staff}` : ""}
            </li>
          ))}
          {history.length === 0 && <li className="py-2 text-ink-muted">Tiada perubahan direkodkan.</li>}
        </ul>
      </Card>
    </>
  );
}

/** Per-user, auth-gated page: rendered at request time. */
export const instant = false;
