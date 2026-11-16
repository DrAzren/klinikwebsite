import { Suspense } from "react";
import QRCode from "qrcode";
import { AuthShell } from "@/components/staff/auth-shell";
import { ActionForm, Submit } from "@/components/staff/form";
import { Input } from "@/components/staff/ui";
import { requireStage } from "@/lib/auth/dal";
import { beginMfaEnrollment, getPendingMfaSecret } from "@/lib/auth/service";
import { otpauthUri } from "@/lib/auth/totp";
import { getDb } from "@/lib/db";
import { mfaConfirmAction } from "../../actions/auth";

export const metadata = { title: "Daftar dua faktor / Set up two-factor" };

async function Enrol() {
  const s = await requireStage("mfa_enroll");
  const db = await getDb();
  const secret = (await getPendingMfaSecret(db, s.user.id)) ?? (await beginMfaEnrollment(db, s.user.id));
  const svg = await QRCode.toString(otpauthUri(secret, s.user.username), { type: "svg", margin: 1, color: { dark: "#0B1F3A", light: "#FFFFFF" } });
  return (
    <>
      <ol className="space-y-2 text-sm text-ink-soft">
        <li>1. Pasang Google Authenticator, Microsoft Authenticator atau 1Password. Install an authenticator app.</li>
        <li>2. Imbas kod QR. Scan the QR code.</li>
        <li>3. Masukkan kod 6 digit. Enter the 6-digit code.</li>
      </ol>
      <div className="mx-auto mt-6 w-52 rounded-2xl bg-white p-3 ring-1 ring-line" dangerouslySetInnerHTML={{ __html: svg }} />
      <details className="mt-3 text-center text-xs text-ink-muted">
        <summary className="cursor-pointer">Tidak boleh imbas? / Can&apos;t scan?</summary>
        <code className="mt-2 block break-all rounded-lg bg-paper p-2 text-navy-900">{secret}</code>
      </details>
      <ActionForm action={mfaConfirmAction} className="mt-6 space-y-4">
        <Input label="Kod 6 digit / 6-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required />
        <Submit className="h-12 w-full">Aktifkan / Enable</Submit>
      </ActionForm>
    </>
  );
}

export default function MfaSetup() {
  return (
    <AuthShell title="Lindungi akaun anda · Protect your account" intro="Pengesahan dua faktor diwajibkan untuk portal staf. Two-factor authentication is required for the staff portal.">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white" />}><Enrol /></Suspense>
    </AuthShell>
  );
}
