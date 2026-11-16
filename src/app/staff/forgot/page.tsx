import Link from "next/link";
import { AuthShell } from "@/components/staff/auth-shell";
import { ActionForm, Submit } from "@/components/staff/form";
import { Input } from "@/components/staff/ui";
import { forgotAction } from "../actions/auth";

export const metadata = { title: "Lupa kata laluan / Forgot password" };

export default function Forgot() {
  return (
    <AuthShell title="Set semula kata laluan · Reset password" intro="Masukkan nama pengguna atau e-mel. Pautan sah selama 30 minit. Enter your username or email; the link is valid for 30 minutes.">
      <ActionForm action={forgotAction} className="space-y-4">
        <Input label="Nama pengguna atau e-mel / Username or email" name="identifier" required autoFocus />
        <Submit className="h-12 w-full">Hantar pautan / Send link</Submit>
      </ActionForm>
      <Link href="/staff/login" className="mt-6 inline-block text-sm text-teal-700 hover:underline">← Log masuk / Sign in</Link>
    </AuthShell>
  );
}
