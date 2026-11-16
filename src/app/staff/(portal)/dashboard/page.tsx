import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, Notice, PageHeader, Stat, Status } from "@/components/staff/ui";
import { requireStaff } from "@/lib/auth/dal";
import { can, ROLE_LABEL } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { balances } from "@/lib/staff/leave";
import { myUpcomingShifts } from "@/lib/staff/roster";
import { integrationModes } from "@/lib/env";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: PageProps<"/staff/dashboard">) {
  const s = await requireStaff();
  const { denied } = (await searchParams) as { denied?: string };
  const db = await getDb();
  const role = s.user.role;
  const year = new Date().getFullYear();
  const [shifts, bal, counts] = await Promise.all([
    myUpcomingShifts(db, s.user.id, 14),
    balances(db, s.user.id, year),
    db.one<{ leave: number; swapsMine: number; swapsApprove: number; incidents: number; urgent: number; review: number; dead: number; docs: number }>(
      `select
         (select count(*)::int from leave_requests where status='pending') as leave,
         (select count(*)::int from shift_swaps where status='pending_peer' and target_user_id=$1) as "swapsMine",
         (select count(*)::int from shift_swaps where status='peer_accepted') as "swapsApprove",
         (select count(*)::int from incidents where status in ('open','action_required') and not confidential) as incidents,
         (select count(*)::int from screening_submissions where priority='urgent' and follow_up_status in ('new','in_review') and deleted_at is null) as urgent,
         (select count(*)::int from screening_submissions where priority='review' and follow_up_status='new' and deleted_at is null) as review,
         (select count(*)::int from integration_jobs where status='dead') as dead,
         (select count(*)::int from documents where status='pending') as docs`,
      [s.user.id],
    ),
  ]);
  const c = counts!;
  const modes = integrationModes();
  const demoCount = Object.values(modes).filter((m) => m === "demo").length;
  const hour = Number(new Date().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Kuala_Lumpur" }));
  const greet = hour < 12 ? "Selamat pagi" : hour < 15 ? "Selamat tengah hari" : hour < 19 ? "Selamat petang" : "Selamat malam";

  return (
    <>
      <PageHeader title={`${greet}, ${s.user.full_name.split(" ")[0]}`} intro={`${ROLE_LABEL[role].ms} · ${ROLE_LABEL[role].en}`} />
      {denied && <div className="mb-6"><Notice tone="danger">Anda tiada kebenaran untuk halaman itu. You don&apos;t have permission for that page ({denied}).</Notice></div>}
      {can(role, "integrations:view") && demoCount > 0 && (
        <div className="mb-6"><Notice tone="warn">{demoCount} integrations are running in DEMO mode (no credentials). <Link href="/staff/admin/integrations" className="font-semibold underline">Review integrations</Link>.</Notice></div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {can(role, "screening:read") && <Stat label="Saringan segera (item 9) · Urgent screenings" value={c.urgent} tone={c.urgent ? "alert" : "default"} href="/staff/screening?priority=urgent" />}
        {can(role, "screening:read") && <Stat label="Perlu semakan · Needs review" value={c.review} href="/staff/screening?priority=review&status=new" />}
        {can(role, "leave:review") && <Stat label="Permohonan cuti · Pending leave" value={c.leave} href="/staff/leave" />}
        {can(role, "swap:approve") && <Stat label="Tukar syif menunggu kelulusan · Swaps to approve" value={c.swapsApprove} href="/staff/swaps" />}
        <Stat label="Permintaan tukar syif kepada anda · Swap requests for you" value={c.swapsMine} tone={c.swapsMine ? "teal" : "default"} href="/staff/swaps" />
        {can(role, "incident:manage") && <Stat label="Insiden terbuka · Open incidents" value={c.incidents} href="/staff/incidents" />}
        {can(role, "documents:approve") && <Stat label="Dokumen menunggu · Documents pending" value={c.docs} href="/staff/documents?status=pending" />}
        {can(role, "integrations:view") && <Stat label="Kerja integrasi gagal · Dead integration jobs" value={c.dead} tone={c.dead ? "alert" : "default"} href="/staff/admin/integrations" />}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Syif saya (14 hari) · My shifts" actions={<Link href="/staff/roster" className="text-sm font-semibold text-teal-700">Roster <ArrowRight className="inline h-3.5 w-3.5" /></Link>}>
          {shifts.length === 0 ? <p className="text-sm text-ink-muted">Tiada syif dijadualkan. No shifts scheduled.</p> : (
            <ul className="divide-y divide-line">
              {shifts.map((sh) => (
                <li key={sh.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-navy-900">{formatDate(sh.date, "ms", { weekday: "short", day: "numeric", month: "short" })}</span>
                  <span className="text-ink-muted">{sh.label} · {sh.start_time}–{sh.end_time}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={`Baki cuti ${year} · Leave balance`} actions={<Link href="/staff/leave" className="text-sm font-semibold text-teal-700">Mohon cuti <ArrowRight className="inline h-3.5 w-3.5" /></Link>}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {bal.filter((b) => b.deducts).map((b) => (
              <li key={b.code} className="rounded-2xl bg-paper p-4 ring-1 ring-line">
                <p className="text-xs text-ink-muted">{b.name_ms}</p>
                <p className="mt-1 text-2xl font-semibold text-navy-900">{b.available}<span className="text-sm font-normal text-ink-muted"> / {b.entitlement + b.adjustments}</span></p>
                {b.pending > 0 && <Status value="pending" label={`${b.pending} menunggu`} />}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

/** Per-user, auth-gated page: rendered at request time. */
export const instant = false;
