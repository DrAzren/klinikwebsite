import Link from "next/link";
import { AuthShell } from "@/components/staff/auth-shell";
import { ActionForm, Submit } from "@/components/staff/form";
import { Input, Notice } from "@/components/staff/ui";
import { loginAction } from "../actions/auth";

export const metadata = { title: "Log masuk / Sign in" };

export default function Login() {
  return (
    <AuthShell title="Log masuk staf · Staff sign in" intro="Akaun dicipta oleh Super Admin sahaja. Accounts are created by the Super Admin only.">
      <ActionForm action={loginAction} className="space-y-4">
        <Input label="Nama pengguna / Username" name="username" autoComplete="username" required autoFocus />
        <Input label="Kata laluan / Password" name="password" type="password" autoComplete="current-password" required />
        <Submit className="h-12 w-full">Log masuk / Sign in</Submit>
      </ActionForm>
      <div className="mt-6 flex justify-between text-sm">
        <Link href="/staff/forgot" className="font-medium text-teal-700 hover:underline">Lupa kata laluan? / Forgot password?</Link>
        <Link href="/" className="text-ink-muted hover:text-navy-900">← Laman web</Link>
      </div>
      {!process.env.DATABASE_URL && (
        <div className="mt-8">
          <Notice tone="warn">
            <strong>Demo sahaja / Demo only.</strong> Data direset dari semasa ke semasa. Demo accounts (password <code>Demo-Tenang-2026!</code>): ceo.demo, doktor.demo, pembantu.demo, saringan.demo. They do not exist in production.
          </Notice>
        </div>
      )}
    </AuthShell>
  );
}
