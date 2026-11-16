import { ActionForm, Submit } from "@/components/staff/form";
import { Card, Input, PageHeader, Select, Status, Table, Td } from "@/components/staff/ui";
import { requireStaff } from "@/lib/auth/dal";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { myUpcomingShifts } from "@/lib/staff/roster";
import { listSwaps } from "@/lib/staff/swaps";
import { staffDirectory } from "@/lib/staff/admin";
import { cancelSwapAction, decideSwapAction, requestSwapAction, respondSwapAction } from "../../actions/ops";

export const metadata = { title: "Shift swaps" };

export default async function SwapsPage() {
  const s = await requireStaff("swap:request");
  const db = await getDb();
  const approver = can(s.user.role, "swap:approve");
  const [swaps, mine, staff, theirs] = await Promise.all([
    listSwaps(db, s),
    myUpcomingShifts(db, s.user.id, 60),
    staffDirectory(db),
    db.query<{ id: string; date: string; shift_code: string; full_name: string }>(
      `select a.id, to_char(a.date,'YYYY-MM-DD') as date, a.shift_code, u.full_name from roster_assignments a join staff_users u on u.id = a.user_id
        where a.user_id <> $1 and a.date >= current_date and a.date < current_date + 60 order by a.date, a.shift_code limit 300`,
      [s.user.id],
    ),
  ]);
  const incoming = swaps.filter((w) => w.target_user_id === s.user.id && w.status === "pending_peer");
  const toApprove = swaps.filter((w) => w.status === "peer_accepted");
  const shiftLabel = (d: string | null, c: string | null) => (d ? `${formatDate(d, "ms", { weekday: "short", day: "numeric", month: "short" })} · ${c}` : "—");

  return (
    <>
      <PageHeader title="Tukar syif · Shift swaps" intro="Staf A memohon → Staf B bersetuju → pengurus meluluskan. Jadual hanya dikemas kini selepas kelulusan." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Mohon tukar syif · Request a swap">
          {mine.length === 0 ? <p className="text-sm text-ink-muted">Anda tiada syif akan datang untuk ditukar.</p> : (
            <ActionForm action={requestSwapAction} resetOnSuccess className="grid gap-3">
              <Select label="Syif saya / My shift" name="mine" options={mine.map((m) => ({ value: m.id, label: shiftLabel(m.date, `${m.shift_code} ${m.start_time}–${m.end_time}`) }))} />
              <Select label="Rakan sekerja / Colleague" name="target" options={staff.filter((u) => u.id !== s.user.id).map((u) => ({ value: u.id, label: u.full_name }))} />
              <Select label="Syif mereka sebagai pertukaran (pilihan) / Their shift in return (optional)" name="theirs"
                options={[{ value: "", label: "— Tiada (ambil alih sahaja) / None (cover only) —" }, ...theirs.map((t) => ({ value: t.id, label: `${t.full_name} · ${shiftLabel(t.date, t.shift_code)}` }))]} />
              <Input label="Sebab / Reason" name="reason" />
              <div><Submit>Hantar permohonan</Submit></div>
            </ActionForm>
          )}
        </Card>
        <Card title={`Permintaan kepada anda · Requests for you (${incoming.length})`}>
          {incoming.length === 0 ? <p className="text-sm text-ink-muted">Tiada.</p> : incoming.map((w) => (
            <div key={w.id} className="mb-3 rounded-2xl bg-paper p-4 ring-1 ring-line">
              <p className="text-sm"><strong>{w.requester}</strong> mahu anda ambil <strong>{shiftLabel(w.a_date, w.a_shift)}</strong>{w.b_date && <> dan beri mereka <strong>{shiftLabel(w.b_date, w.b_shift)}</strong></>}.</p>
              {w.reason && <p className="mt-1 text-xs text-ink-muted">“{w.reason}”</p>}
              <ActionForm action={respondSwapAction} className="mt-3 flex gap-2">
                <input type="hidden" name="id" value={w.id} />
                <button name="accept" value="1" className="h-9 rounded-full bg-success px-4 text-xs font-semibold text-white">Setuju</button>
                <button name="accept" value="0" className="h-9 rounded-full bg-white px-4 text-xs font-semibold text-danger ring-1 ring-danger/30">Tolak</button>
              </ActionForm>
            </div>
          ))}
        </Card>
      </div>

      {approver && (
        <Card title={`Menunggu kelulusan · Awaiting approval (${toApprove.length})`} className="mt-6">
          <Table head={["Pemohon", "Syif A", "Rakan", "Syif B", "Keputusan"]} empty="Tiada pertukaran menunggu kelulusan.">
            {toApprove.map((w) => (
              <tr key={w.id}>
                <Td>{w.requester}</Td><Td>{shiftLabel(w.a_date, w.a_shift)}</Td><Td>{w.target}</Td><Td>{shiftLabel(w.b_date, w.b_shift)}</Td>
                <Td>
                  <ActionForm action={decideSwapAction} className="flex gap-2">
                    <input type="hidden" name="id" value={w.id} />
                    <button name="approve" value="1" className="h-9 rounded-full bg-success px-3 text-xs font-semibold text-white">Lulus</button>
                    <button name="approve" value="0" className="h-9 rounded-full bg-white px-3 text-xs font-semibold text-danger ring-1 ring-danger/30">Tolak</button>
                  </ActionForm>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      <Card title="Sejarah · History" className="mt-6">
        <Table head={["Dicipta", "Pemohon", "Syif A", "Rakan", "Syif B", "Status", ""]} empty="Tiada rekod.">
          {swaps.map((w) => (
            <tr key={w.id}>
              <Td>{formatDate(w.created_at)}</Td><Td>{w.requester}</Td><Td>{shiftLabel(w.a_date, w.a_shift)}</Td><Td>{w.target}</Td><Td>{shiftLabel(w.b_date, w.b_shift)}</Td>
              <Td><Status value={w.status} /></Td>
              <Td>{w.requester_id === s.user.id && ["pending_peer", "peer_accepted"].includes(w.status) && (
                <ActionForm action={cancelSwapAction}><input type="hidden" name="id" value={w.id} /><Submit variant="ghost">Batal</Submit></ActionForm>
              )}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}

/** Per-user, auth-gated page: rendered at request time. */
export const instant = false;
