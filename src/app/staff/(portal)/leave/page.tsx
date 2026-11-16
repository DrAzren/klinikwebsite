import { ActionForm, Submit } from "@/components/staff/form";
import { Card, Checkbox, Input, Notice, PageHeader, Select, Status, Table, Td, Textarea } from "@/components/staff/ui";
import { requireStaff } from "@/lib/auth/dal";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { adjustmentHistory, balances, hrSettings, leaveTypes, listLeave } from "@/lib/staff/leave";
import { staffDirectory } from "@/lib/staff/admin";
import { adjustBalanceAction, applyLeaveAction, cancelLeaveAction, holidayAction, reviewLeaveAction, setEntitlementAction, workingDaysAction } from "../../actions/ops";

export const metadata = { title: "Leave" };
const DAYS = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];

export default async function LeavePage() {
  const s = await requireStaff("leave:apply");
  const db = await getDb();
  const year = new Date().getFullYear();
  const reviewer = can(s.user.role, "leave:review");
  const configurer = can(s.user.role, "leave:configure");
  const [types, bal, mine, all, staff, hr, holidays, adjustments] = await Promise.all([
    leaveTypes(db), balances(db, s.user.id, year), listLeave(db, s, "mine"),
    reviewer ? listLeave(db, s, "all") : Promise.resolve([]),
    configurer ? staffDirectory(db) : Promise.resolve([]),
    hrSettings(db),
    db.query<{ date: string; name: string }>("select to_char(date,'YYYY-MM-DD') as date, name from public_holidays where date >= current_date - 30 order by date"),
    configurer ? adjustmentHistory(db, s) : Promise.resolve([]),
  ]);
  const pending = all.filter((r) => r.status === "pending");
  const typeOpts = types.map((t) => ({ value: t.code, label: `${t.name_ms} / ${t.name_en}${t.requires_attachment ? " *" : ""}` }));

  return (
    <>
      <PageHeader title="Cuti · Leave" intro="Mohon cuti, semak baki dan status. Apply for leave and check balances and status." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {bal.map((b) => (
          <div key={b.code} className="rounded-3xl bg-white p-5 ring-1 ring-line">
            <p className="text-xs text-ink-muted">{b.name_ms}</p>
            {b.deducts ? (
              <>
                <p className="mt-1 text-3xl font-semibold text-navy-900">{b.available}</p>
                <p className="text-xs text-ink-muted">Kelayakan {b.entitlement}{b.adjustments ? ` ${b.adjustments > 0 ? "+" : ""}${b.adjustments}` : ""} · diambil {b.taken} · menunggu {b.pending}</p>
              </>
            ) : <p className="mt-1 text-sm text-ink-muted">Tiada had · Not deducted</p>}
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <Card title="Mohon cuti · Apply" className="xl:col-span-2">
          <ActionForm action={applyLeaveAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
            <Select label="Jenis / Type" name="leaveType" options={typeOpts} className="sm:col-span-2" />
            <Input label="Dari / From" name="startDate" type="date" required />
            <Input label="Hingga / To" name="endDate" type="date" />
            <div className="sm:col-span-2"><Checkbox label="Separuh hari (satu tarikh) / Half day" name="halfDay" /></div>
            <Textarea label="Sebab / Reason" name="reason" rows={2} className="sm:col-span-2" />
            <Input label="Dokumen sokongan (MC) — PDF/JPG/PNG, maks 8 MB" name="attachment" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sm:col-span-2" />
            <p className="text-xs text-ink-muted sm:col-span-2">* Memerlukan dokumen sokongan. Requires a supporting document.</p>
            <div className="sm:col-span-2"><Submit>Hantar / Submit</Submit></div>
          </ActionForm>
        </Card>

        <Card title="Sejarah saya · My history" className="xl:col-span-3">
          <Table head={["Jenis", "Tarikh", "Hari", "Status", ""]} empty="Tiada permohonan. No requests yet.">
            {mine.map((r) => (
              <tr key={r.id}>
                <Td>{r.name_ms}</Td>
                <Td>{formatDate(r.start_date)}{r.end_date !== r.start_date && ` – ${formatDate(r.end_date)}`}</Td>
                <Td>{Number(r.days)}</Td>
                <Td><Status value={r.status} />{r.review_comment && <p className="mt-1 text-xs text-ink-muted">{r.review_comment}</p>}</Td>
                <Td>{r.status === "pending" && (
                  <ActionForm action={cancelLeaveAction}><input type="hidden" name="id" value={r.id} /><Submit variant="ghost">Batal</Submit></ActionForm>
                )}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      {reviewer && (
        <Card title={`Permohonan menunggu · Pending approvals (${pending.length})`} className="mt-6">
          <Table head={["Staf", "Jenis", "Tarikh", "Hari", "Sebab", "Keputusan"]} empty="Tiada permohonan menunggu.">
            {pending.map((r) => (
              <tr key={r.id}>
                <Td className="font-medium text-navy-900">{r.full_name}</Td>
                <Td>{r.name_ms}{r.attachment_file_id && <a className="ml-2 text-xs font-semibold text-teal-700 underline" href={`/api/staff/files/${r.attachment_file_id}`}>Lampiran</a>}</Td>
                <Td>{formatDate(r.start_date)}{r.end_date !== r.start_date && ` – ${formatDate(r.end_date)}`}</Td>
                <Td>{Number(r.days)}</Td>
                <Td className="max-w-xs text-ink-muted">{r.reason}</Td>
                <Td>
                  <ActionForm action={reviewLeaveAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <input name="comment" placeholder="Komen" className="h-9 w-32 rounded-lg bg-paper px-2 text-xs ring-1 ring-line" />
                    <button name="decision" value="approved" className="h-9 rounded-full bg-success px-3 text-xs font-semibold text-white">Lulus</button>
                    <button name="decision" value="rejected" className="h-9 rounded-full bg-white px-3 text-xs font-semibold text-danger ring-1 ring-danger/30">Tolak</button>
                  </ActionForm>
                </Td>
              </tr>
            ))}
          </Table>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-navy-900">Semua permohonan · All requests ({all.length})</summary>
            <Table head={["Staf", "Jenis", "Tarikh", "Hari", "Status", "Disemak oleh"]}>
              {all.filter((r) => r.status !== "pending").map((r) => (
                <tr key={r.id}><Td>{r.full_name}</Td><Td>{r.name_ms}</Td><Td>{formatDate(r.start_date)} – {formatDate(r.end_date)}</Td><Td>{Number(r.days)}</Td><Td><Status value={r.status} /></Td><Td>{r.reviewer_name}</Td></tr>
              ))}
            </Table>
          </details>
        </Card>
      )}

      {configurer && (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card title="Kelayakan & pelarasan · Entitlements & adjustments">
            <Notice tone="warn">Nilai lalai mengikut minimum Akta Kerja 1955 (&lt;2 tahun perkhidmatan). Sahkan mengikut polisi HR klinik. Defaults mirror Employment Act 1955 minimums — confirm against the clinic&apos;s HR policy.</Notice>
            <ActionForm action={setEntitlementAction} className="mt-4 grid gap-3 sm:grid-cols-4">
              <Select label="Staf" name="userId" options={staff.map((u) => ({ value: u.id, label: u.full_name }))} className="sm:col-span-2" />
              <Select label="Jenis" name="leaveType" options={typeOpts} />
              <Input label="Tahun" name="year" type="number" defaultValue={year} />
              <Input label="Hari kelayakan / Days" name="days" type="number" step="0.5" min="0" required />
              <div className="flex items-end"><Submit>Tetapkan</Submit></div>
            </ActionForm>
            <ActionForm action={adjustBalanceAction} className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-4">
              <Select label="Staf" name="userId" options={staff.map((u) => ({ value: u.id, label: u.full_name }))} className="sm:col-span-2" />
              <Select label="Jenis" name="leaveType" options={typeOpts} />
              <Input label="Tahun" name="year" type="number" defaultValue={year} />
              <Input label="Pelarasan (+/-)" name="delta" type="number" step="0.5" required />
              <Input label="Sebab (wajib)" name="reason" required className="sm:col-span-2" />
              <div className="flex items-end"><Submit>Rekod</Submit></div>
            </ActionForm>
            {adjustments.length > 0 && (
              <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold">Sejarah pelarasan (tidak boleh diubah)</summary>
                <ul className="mt-2 space-y-1 text-xs text-ink-muted">{adjustments.map((a) => <li key={a.id}>{formatDate(a.at)} · {a.full_name} · {a.leave_type} {Number(a.delta) > 0 ? "+" : ""}{Number(a.delta)} · {a.reason} · oleh {a.actor}</li>)}</ul>
              </details>
            )}
          </Card>
          <Card title="Hari bekerja & cuti umum · Working days & holidays">
            <ActionForm action={workingDaysAction} className="flex flex-wrap items-center gap-3">
              {DAYS.map((d, i) => <Checkbox key={d} label={d} name="days" value={String(i)} defaultChecked={hr.workingDays.includes(i)} />)}
              <Submit variant="ghost">Simpan</Submit>
            </ActionForm>
            <ActionForm action={holidayAction} resetOnSuccess className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-3">
              <Input label="Tarikh" name="date" type="date" required />
              <Input label="Nama cuti umum" name="name" required />
              <div className="flex items-end"><Submit variant="ghost">Tambah</Submit></div>
            </ActionForm>
            <ul className="mt-4 divide-y divide-line text-sm">
              {holidays.map((h) => (
                <li key={h.date} className="flex items-center justify-between py-2">
                  <span>{formatDate(h.date)} · {h.name}</span>
                  <ActionForm action={holidayAction}><input type="hidden" name="remove" value={h.date} /><Submit variant="ghost">Buang</Submit></ActionForm>
                </li>
              ))}
              {holidays.length === 0 && <li className="py-2 text-ink-muted">Tiada cuti umum direkodkan. Add Negeri Sembilan public holidays for accurate day counts.</li>}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}

/** Per-user, auth-gated page: rendered at request time. */
export const instant = false;
