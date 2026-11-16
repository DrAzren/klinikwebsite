"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Globe, Lock, Menu, X } from "lucide-react";
import { Logo } from "../logo";
import { WhatsAppIcon } from "../icons";
import { cx } from "../ui";
import { localePath, switchLocalePath, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n";

interface Props {
  lang: Locale;
  nav: Dictionary["nav"];
  bookLabel: string;
  bookHref: string;
  logoUrl?: string;
}

export function SiteHeader({ lang, nav, bookLabel, bookHref, logoUrl }: Props) {
  const pathname = usePathname() || "/";
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [svcOpen, setSvcOpen] = useState(false);
  const svcRef = useRef<HTMLDivElement>(null);
  const p = (path: string) => localePath(lang, path);
  const isHome = pathname === "/" || pathname === "/en";
  const onDark = isHome && !scrolled && !open;

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // Close menus when the route changes (adjusting state during render, not in an effect).
  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setOpen(false);
    setSvcOpen(false);
  }

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSvcOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!svcOpen) return;
    const close = (e: MouseEvent) => {
      if (!svcRef.current?.contains(e.target as Node)) setSvcOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [svcOpen]);

  const primary = [
    { href: p("/about"), label: nav.about },
    { href: p("/doctors"), label: nav.doctors },
  ];
  const services = [
    { href: p("/services"), label: nav.services },
    { href: p("/mental-health"), label: nav.mentalHealth },
    { href: p("/weight-management"), label: nav.weight },
    { href: p("/panels"), label: nav.panels },
  ];
  const secondary = [
    { href: p("/screening"), label: nav.screening },
    { href: p("/insights"), label: nav.insights },
    { href: p("/book"), label: nav.book },
    { href: p("/contact"), label: nav.contact },
  ];
  const isActive = (href: string) => (href === p("/") ? pathname === href : pathname.startsWith(href));
  const linkCls = (href: string) =>
    cx(
      "relative whitespace-nowrap rounded-full px-3 py-2 text-[0.9rem] font-medium transition-colors duration-300",
      onDark ? "text-white/80 hover:text-white" : "text-ink-soft hover:text-navy-900",
      isActive(href) && (onDark ? "text-white" : "text-navy-900"),
    );

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-navy-900">
        {nav.skip}
      </a>
      <header
        className={cx(
          "fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-out-expo",
          scrolled || open ? "py-2" : "py-4",
        )}
      >
        <div className="container-page">
          <div
            className={cx(
              "flex items-center justify-between gap-4 rounded-full px-3 py-2 pl-5 transition-all duration-500 ease-out-expo",
              scrolled && !open ? "glass-light shadow-soft" : "bg-transparent",
            )}
          >
            <Link href={p("/")} className="shrink-0" aria-label={`Klinik Nissa — ${nav.home}`}>
              <Logo logoUrl={logoUrl} tone={onDark ? "light" : "dark"} />
            </Link>

            <nav aria-label="Main" className="hidden items-center xl:flex">
              {primary.map((l) => (
                <Link key={l.href} href={l.href} className={linkCls(l.href)} aria-current={isActive(l.href) ? "page" : undefined}>
                  {l.label}
                </Link>
              ))}
              <div className="relative" ref={svcRef}>
                <button
                  type="button"
                  className={cx(linkCls(p("/services")), "inline-flex items-center gap-1")}
                  aria-expanded={svcOpen}
                  aria-haspopup="true"
                  onClick={() => setSvcOpen((v) => !v)}
                >
                  {nav.services}
                  <ChevronDown className={cx("h-3.5 w-3.5 transition-transform", svcOpen && "rotate-180")} aria-hidden />
                </button>
                <AnimatePresence>
                  {svcOpen && (
                    <motion.div
                      initial={reduce ? false : { opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="glass-light absolute left-1/2 top-full mt-3 w-64 -translate-x-1/2 rounded-3xl p-2 shadow-lift"
                    >
                      {services.map((l) => (
                        <Link key={l.href} href={l.href} className="block rounded-2xl px-4 py-3 text-sm font-medium text-navy-900 transition hover:bg-mint">
                          {l.label}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {secondary.map((l) => (
                <Link key={l.href} href={l.href} className={linkCls(l.href)} aria-current={isActive(l.href) ? "page" : undefined}>
                  {l.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-1.5">
              <Link
                href={switchLocalePath(pathname, lang === "ms" ? "en" : "ms")}
                hrefLang={lang === "ms" ? "en" : "ms"}
                className={cx(
                  "hidden h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition sm:inline-flex",
                  onDark ? "text-white/85 hover:bg-white/10" : "text-navy-900 hover:bg-navy-100/70",
                )}
                aria-label={nav.language}
              >
                <Globe className="h-4 w-4" aria-hidden />
                {nav.languageShort}
              </Link>
              <a
                href={bookHref}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden h-10 items-center gap-2 whitespace-nowrap rounded-full bg-teal-500 px-5 text-sm font-semibold text-navy-950 shadow-glow transition hover:bg-teal-400 md:inline-flex"
              >
                <WhatsAppIcon className="h-4 w-4" />
                {bookLabel}
              </a>
              <button
                type="button"
                className={cx(
                  "inline-flex h-11 w-11 items-center justify-center rounded-full transition xl:hidden",
                  onDark ? "text-white hover:bg-white/10" : "text-navy-900 hover:bg-navy-100/70",
                )}
                aria-expanded={open}
                aria-controls="mobile-menu"
                aria-label={open ? nav.close : nav.menu}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label={nav.menu}
            className="fixed inset-0 z-40 overflow-y-auto bg-paper xl:hidden"
            initial={reduce ? false : { clipPath: "circle(0% at 92% 4%)" }}
            animate={{ clipPath: "circle(150% at 92% 4%)" }}
            exit={{ clipPath: "circle(0% at 92% 4%)" }}
            transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
          >
            <div className="container-page flex min-h-full flex-col pb-10 pt-28">
              <motion.ul
                className="space-y-1"
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.15 } } }}
              >
                {[{ href: p("/"), label: nav.home }, ...primary, ...services, ...secondary, { href: p("/careers"), label: nav.careers }].map((l) => (
                  <motion.li
                    key={l.href}
                    variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } } }}
                  >
                    <Link
                      href={l.href}
                      className={cx(
                        "flex items-center justify-between border-b border-line py-3.5 text-[1.6rem] font-semibold tracking-tight",
                        isActive(l.href) ? "text-teal-600" : "text-navy-900",
                      )}
                    >
                      {l.label}
                    </Link>
                  </motion.li>
                ))}
              </motion.ul>
              <div className="mt-auto space-y-3 pt-10">
                <a href={bookHref} target="_blank" rel="noopener noreferrer" className="flex h-14 items-center justify-center gap-2 rounded-full bg-teal-500 text-base font-semibold text-navy-950">
                  <WhatsAppIcon className="h-5 w-5" />
                  {bookLabel}
                </a>
                <div className="flex items-center justify-between">
                  <Link href={switchLocalePath(pathname, lang === "ms" ? "en" : "ms")} className="inline-flex items-center gap-2 py-2 text-sm font-semibold text-navy-900">
                    <Globe className="h-4 w-4" /> {nav.language}
                  </Link>
                  <Link href="/staff/login" className="inline-flex items-center gap-2 py-2 text-sm text-ink-muted">
                    <Lock className="h-4 w-4" /> {nav.staff}
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
