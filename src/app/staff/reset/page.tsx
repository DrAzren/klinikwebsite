import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/staff/auth-shell";
import { ActionForm, Submit } from "@/components/staff/form";
import { Input, Notice } from "@/components/staff/ui";
import { getStaffSession } from "@/lib/auth/dal";
import { firstLoginPasswordAction, resetWithTokenAction } from "../actions/auth";

export const metadata = { title: "Kata laluan baharu / New password" };

const POLICY = "Minimum 12 aksara, gabungan 3 daripada: huruf kecil, huruf besar, nombor, simbol. At least 12 characters using 3 of: lowercase, uppercase, number, symbol.";

async function ResetForm({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (token) {
    return (
      <ActionForm action={resetWithTokenAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <Input label="Kata laluan baharu / New password" name="next" type="password" autoComplete="new-password" required minLength={12} />
        <Input label="Sahkan / Confirm" name="confirm" type="password" autoComplete="new-password" required minLength={12} />
        <Submit className="h-12 w-full">Simpan / Save</Submit>
      </ActionForm>
    );
  }
  const s = await getStaffSession();
  if (!s) redirect("/staff/login");
  if (s.stage !== "password_change") redirect("/staff/dashboard");
  return (
    <>
      <Notice tone="info">Ini log masuk pertama anda — sila tukar kata laluan sementara. This is your first sign-in — please replace your temporary password.</Notice>
      <ActionForm action={firstLoginPasswordAction} className="mt-5 space-y-4">
        <Input label="Kata laluan sementara / Temporary password" name="current" type="password" autoComplete="current-password" required />
        <Input label="Kata laluan baharu / New password" name="next" type="password" autoComplete="new-password" required minLength={12} />
        <Input label="Sahkan / Confirm" name="confirm" type="password" autoComplete="new-password" required minLength={12} />
        <Submit className="h-12 w-full">Simpan & teruskan / Save & continue</Submit>
      </ActionForm>
    </>
  );
}

export default function Reset({ searchParams }: PageProps<"/staff/reset">) {
  return (
    <AuthShell title="Tetapkan kata laluan · Set password" intro={POLICY}>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-white" />}>
        <ResetForm searchParams={searchParams as Promise<{ token?: string }>} />
      </Suspense>
    </AuthShell>
  );
}
