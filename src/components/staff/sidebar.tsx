"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarDays, ClipboardList, FileText, HeartPulse, LayoutDashboard, Link2, LogOut, Menu, PlugZap, Repeat, ScrollText,
  Siren, UserCog, UserRound, X, Newspaper,
} from "lucide-react";
import { Logo } from "../logo";

const ICONS = {
  dashboard: LayoutDashboard, leave: CalendarDays, roster: ClipboardList, swaps: Repeat, incidents: Siren, documents: FileText,
  links: Link2, screening: HeartPulse, users: UserCog, content: Newspaper, integrations: PlugZap, audit: ScrollText, account: UserRound,
};
export type NavKey = keyof typeof ICONS;
export interface NavItem { key: NavKey; href: string; label: string; badge?: number; section?: string }

export function Sidebar({ items, user, logout }: { items: NavItem[]; user: { name: string; role: string }; logout: () => Promise<void> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="Staff">
      {items.map((it, i) => {
        const Icon = ICONS[it.key];
        const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
        const header = it.section && it.section !== items[i - 1]?.section ? it.section : null;
        return (
          <div key={it.href}>
            {header && <p className="px-3 pb-1.5 pt-5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-navy-300/70">{header}</p>}
            <Link href={it.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-white/10 text-white" : "text-navy-300 hover:bg-white/5 hover:text-white"}`}>
              <Icon className={`h-4 w-4 ${active ? "text-teal-400" : ""}`} />
              <span className="flex-1">{it.label}</span>
              {!!it.badge && <span className="rounded-full bg-teal-500 px-2 py-0.5 text-[0.65rem] font-bold text-navy-950">{it.badge}</span>}
            </Link>
          </div>
        );
      })}
    </nav>
  );
  const footer = (
    <div className="border-t border-white/10 p-4">
      <p className="truncate text-sm font-semibold text-white">{user.name}</p>
      <p className="truncate text-xs text-navy-300">{user.role}</p>
      <form action={logout} className="mt-3">
        <button className="inline-flex items-center gap-2 text-xs font-medium text-navy-300 hover:text-white"><LogOut className="h-3.5 w-3.5" />Log keluar / Sign out</button>
      </form>
    </div>
  );
  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between bg-navy-900 px-4 py-3 lg:hidden">
        <Logo tone="light" />
        <button type="button" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-lg p-2 text-white">{open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}</button>
      </div>
      {open && (
        <div className="fixed inset-0 top-[60px] z-30 flex flex-col bg-navy-900 lg:hidden">{nav}{footer}</div>
      )}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-navy-900 lg:flex">
        <div className="px-6 py-5"><Link href="/staff/dashboard"><Logo tone="light" /></Link></div>
        {nav}
        {footer}
      </aside>
    </>
  );
}
