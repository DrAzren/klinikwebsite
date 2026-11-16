import { Suspense } from "react";
import { AuthShell } from "@/components/staff/auth-shell";
import { ActionForm, Submit } from "@/components/staff/form";
import { Input } from "@/components/staff/ui";
import { requireStage } from "@/lib/auth/dal";
import { logoutAction, mfaVerifyAction } from "../actions/auth";

export const metadata = { title: "Pengesahan dua faktor / Two-factor" };

async function Gate() {
  await requireStage("mfa_pending");
  return (
    <>
      <ActionForm action={mfaVerifyAction} className="space-y-4">
        <Input label="Kod 6 digit / 6-digit code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus />
        <Submit className="h-12 w-full">Sahkan / Verify</Submit>
      </ActionForm>
      <form action={logoutAction} className="mt-4"><button className="text-sm text-ink-muted hover:text-navy-900">Batal / Cancel</button></form>
    </>
  );
}

export default function Mfa() {
  return (
    <AuthShell title="Pengesahan dua faktor · Two-factor verification" intro="Masukkan kod daripada aplikasi pengesah anda. Enter the code from your authenticator app.">
      <Suspense fallback={null}><Gate /></Suspense>
    </AuthShell>
  );
}
