import Link from "next/link";
import QRCode from "qrcode";
import { ActionForm, Submit } from "@/components/staff/form";
import { Card, Input, Notice, PageHeader } from "@/components/staff/ui";
import { requireStaff } from "@/lib/auth/dal";
import { ROLE_LABEL } from "@/lib/auth/rbac";
import { beginMfaEnrollment, getPendingMfaSecret } from "@/lib/auth/service";
import { otpauthUri } from "@/lib/auth/totp";
import { getDb } from "@/lib/db";
import { accountPasswordAction, mfaConfirmAction } from "../../actions/auth";

export const metadata = { title: "My account" };

export default async function AccountPage({ searchParams }: PageProps<"/staff/account">) {
  const s = await requireStaff();
  const { enrol } = (await searchParams) as { enrol?: string };
  let qr: string | null = null;
  let secret: string | null = null;
  if (!s.user.mfa_enabled && enrol === "1") {
    const db = await getDb();
    secret = (await getPendingMfaSecret(db, s.user.id)) ?? (await beginMfaEnrollment(db, s.user.id));
    qr = await QRCode.toString(otpauthUri(secret, s.user.username), { type: "svg", margin: 1 });
  }
  return (
    <>
      <PageHeader title="Akaun saya · My account" intro={`${s.user.full_name} · ${s.user.username} · ${ROLE_LABEL[s.user.role].en}`} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Tukar kata laluan · Change password">
          <ActionForm action={accountPasswordAction} resetOnSuccess className="space-y-3">
            <Input label="Kata laluan semasa" name="current" type="password" autoComplete="current-password" required />
            <Input label="Kata laluan baharu (min 12 aksara)" name="next" type="password" autoComplete="new-password" minLength={12} required />
            <Input label="Sahkan" name="confirm" type="password" autoComplete="new-password" minLength={12} required />
            <Submit>Simpan</Submit>
          </ActionForm>
        </Card>
        <Card title="Pengesahan dua faktor · Two-factor authentication">
          {s.user.mfa_enabled ? (
            <Notice tone="info">MFA aktif. Jika anda kehilangan telefon, minta Super Admin menetapkan semula MFA.</Notice>
          ) : qr ? (
            <>
              <div className="mx-auto w-48 rounded-2xl bg-white p-3 ring-1 ring-line" dangerouslySetInnerHTML={{ __html: qr }} />
              <code className="mt-2 block break-all text-center text-xs text-ink-muted">{secret}</code>
              <ActionForm action={mfaConfirmAction} className="mt-4 space-y-3">
                <Input label="Kod 6 digit" name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required />
                <Submit>Aktifkan</Submit>
              </ActionForm>
            </>
          ) : (
            <>
              <Notice tone="warn">MFA belum aktif. Ia diwajibkan dalam produksi.</Notice>
              <Link href="/staff/account?enrol=1" className="mt-4 inline-flex h-10 items-center rounded-full bg-navy-900 px-4 text-sm font-semibold text-white">Daftar MFA</Link>
            </>
          )}
        </Card>
      </div>
    </>
  );
}

/** Per-user, auth-gated page: rendered at request time. */
export const instant = false;
