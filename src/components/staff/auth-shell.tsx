import Link from "next/link";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Logo } from "../logo";

export function AuthShell({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="grain relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:flex lg:flex-col">
        <div aria-hidden className="absolute -left-40 top-1/3 h-[36rem] w-[36rem] animate-drift rounded-full bg-[radial-gradient(circle,rgba(0,183,177,0.3),transparent_60%)]" />
        <Link href="/" className="relative"><Logo tone="light" /></Link>
        <div className="relative mt-auto">
          <p className="font-display text-5xl italic leading-tight">Your Health.<br />Your Mind.<br />Our Priority.</p>
          <p className="mt-6 max-w-sm text-sm text-navy-300">Klinik Nissa staff intranet. Authorised personnel only. All access is logged.</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="lg:hidden"><Logo /></Link>
          <div className="mt-10 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-mint text-teal-700 lg:mt-0"><Lock className="h-5 w-5" /></div>
          <h1 className="mt-5 text-2xl font-semibold text-navy-900">{title}</h1>
          {intro && <p className="mt-2 text-sm text-ink-muted">{intro}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </main>
  );
}
