import { ActionForm, Submit } from "@/components/staff/form";
import { Card, Input, PageHeader, Select, Status, Table, Td } from "@/components/staff/ui";
import { requireStaff } from "@/lib/auth/dal";
import { ROLE_LABEL, ROLES } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { formatDateTime, isFuture } from "@/lib/format";
import { listStaff } from "@/lib/staff/admin";
import { createUserAction, userAdminAction } from "../../../actions/admin";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const s = await requireStaff("users:manage");
  const users = await listStaff(await getDb(), s);
  const roleOpts = ROLES.map((r) => ({ value: r, label: `${ROLE_LABEL[r].ms} · ${ROLE_LABEL[r].en}` }));
  return (
    <>
      <PageHeader title="Pengguna staf · Staff users" intro="Tiada pendaftaran sendiri. Hanya CEO/Super Admin boleh mencipta akaun. Pengguna baharu mesti menukar kata laluan sementara dan mendaftar MFA pada log masuk pertama." />
      <Card title="Cipta akaun · Create account">
        <ActionForm action={createUserAction} resetOnSuccess className="grid gap-3 md:grid-cols-5">
          <Input label="Nama penuh" name="fullName" required />
          <Input label="Nama pengguna" name="username" required pattern="[a-zA-Z0-9._\-]{3,32}" />
          <Input label="E-mel" name="email" type="email" required />
          <Select label="Peranan" name="role" options={roleOpts} defaultValue="clinic_assistant" />
          <div className="flex items-end"><Submit>Cipta</Submit></div>
        </ActionForm>
        <p className="mt-3 text-xs text-ink-muted">Kata laluan sementara dipaparkan sekali sahaja. Serahkan secara peribadi — jangan hantar melalui e-mel atau WhatsApp bersama nama pengguna.</p>
      </Card>
      <Card title={`Akaun (${users.length})`} className="mt-6">
        <Table head={["Staf", "Peranan", "Status", "Log masuk terakhir", "Tindakan"]}>
          {users.map((u) => {
            const locked = isFuture(u.locked_until);
            return (
              <tr key={u.id} className={u.is_active ? "" : "opacity-60"}>
                <Td><p className="font-semibold text-navy-900">{u.full_name}</p><p className="text-xs text-ink-muted">{u.username} · {u.email}</p></Td>
                <Td>
                  <ActionForm action={userAdminAction} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={u.id} /><input type="hidden" name="op" value="role" />
                    <select name="role" defaultValue={u.role} className="h-9 rounded-lg bg-paper px-2 text-xs ring-1 ring-line">{roleOpts.map((o) => <option key={o.value} value={o.value}>{o.label.split(" · ")[1]}</option>)}</select>
                    <Submit variant="ghost">Tukar</Submit>
                  </ActionForm>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <Status value={u.is_active ? "approved" : "cancelled"} label={u.is_active ? "aktif" : "nyahaktif"} />
                    <Status value={u.mfa_enabled ? "live" : "demo"} label={u.mfa_enabled ? "MFA" : "tiada MFA"} />
                    {u.must_change_password && <Status value="pending" label="tukar kata laluan" />}
                    {locked && <Status value="failed" label="dikunci" />}
                  </div>
                </Td>
                <Td className="text-xs text-ink-muted">{u.last_login_at ? formatDateTime(u.last_login_at) : "—"}</Td>
                <Td>
                  {u.id !== s.user.id && (
                    <div className="flex flex-wrap gap-1">
                      {[
                        u.is_active ? ["deactivate", "Nyahaktif"] : ["activate", "Aktifkan"],
                        ["password", "Kata laluan sementara"],
                        ["mfa", "Set semula MFA"],
                        ...(locked ? [["unlock", "Buka kunci"]] : []),
                      ].map(([op, label]) => (
                        <ActionForm key={op} action={userAdminAction} confirm={`${label}: ${u.full_name}?`}>
                          <input type="hidden" name="id" value={u.id} /><input type="hidden" name="op" value={op} />
                          <Submit variant={op === "deactivate" ? "danger" : "ghost"} className="!h-8 !px-3 !text-xs">{label}</Submit>
                        </ActionForm>
                      ))}
                    </div>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </>
  );
}

/** Per-user, auth-gated page: rendered at request time. */
export const instant = false;
