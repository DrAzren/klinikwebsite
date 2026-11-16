import { Suspense, type ReactNode } from "react";
import { Sidebar, type NavItem } from "@/components/staff/sidebar";
import { requireStaff } from "@/lib/auth/dal";
import { can, ROLE_LABEL } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { logoutAction } from "../actions/auth";

async function Shell({ children }: { children: ReactNode }) {
  const s = await requireStaff();
  const db = await getDb();
  const role = s.user.role;
  const counts = await db.one<{ leave: number; swaps: number; urgent: number; incidents: number }>(
    `select
       (select count(*)::int from leave_requests where status = 'pending') as leave,
       (select count(*)::int from shift_swaps where status = 'peer_accepted' or (status = 'pending_peer' and target_user_id = $1)) as swaps,
       (select count(*)::int from screening_submissions where priority = 'urgent' and follow_up_status = 'new' and deleted_at is null) as urgent,
       (select count(*)::int from incidents where status in ('open','action_required')) as incidents`,
    [s.user.id],
  );
  const items: NavItem[] = [
    { key: "dashboard", href: "/staff/dashboard", label: "Papan pemuka · Dashboard" },
    { key: "leave", href: "/staff/leave", label: "Cuti · Leave", badge: can(role, "leave:review") ? counts?.leave : undefined, section: "Operasi" },
    { key: "roster", href: "/staff/roster", label: "Jadual tugas · Roster", section: "Operasi" },
    { key: "swaps", href: "/staff/swaps", label: "Tukar syif · Swaps", badge: counts?.swaps, section: "Operasi" },
    { key: "incidents", href: "/staff/incidents", label: "Insiden · Incidents", badge: can(role, "incident:manage") ? counts?.incidents : undefined, section: "Operasi" },
    ...(can(role, "documents:upload") || can(role, "finance:read") ? [{ key: "documents" as const, href: "/staff/documents", label: "Dokumen · Documents", section: "Operasi" }] : []),
    { key: "links", href: "/staff/links", label: "SOP & pautan · Links", section: "Operasi" },
    ...(can(role, "screening:read") ? [{ key: "screening" as const, href: "/staff/screening", label: "Saringan · Screening", badge: counts?.urgent, section: "Klinikal" }] : []),
    ...(can(role, "users:manage") ? [{ key: "users" as const, href: "/staff/admin/users", label: "Pengguna · Users", section: "Pengurusan" }] : []),
    ...(can(role, "content:manage") ? [{ key: "content" as const, href: "/staff/admin/content", label: "Kandungan · Content", section: "Pengurusan" }] : []),
    ...(can(role, "integrations:view") ? [{ key: "integrations" as const, href: "/staff/admin/integrations", label: "Integrasi · Integrations", section: "Pengurusan" }] : []),
    ...(can(role, "audit:view") ? [{ key: "audit" as const, href: "/staff/admin/audit", label: "Log audit · Audit", section: "Pengurusan" }] : []),
    { key: "account", href: "/staff/account", label: "Akaun saya · Account", section: "Saya" },
  ];
  return (
    <div className="min-h-dvh lg:flex">
      <Sidebar items={items} user={{ name: s.user.full_name, role: ROLE_LABEL[role].en }} logout={logoutAction} />
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-10">{children}</main>
    </div>
  );
}

/** Every portal page is per-user and request-time (auth-gated); no static shell to validate. */
export const instant = false;

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center text-sm text-ink-muted">Memuatkan… Loading…</div>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
