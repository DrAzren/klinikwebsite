import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowRight } from "lucide-react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variant = "primary" | "teal" | "ghost" | "light" | "outline" | "whatsapp";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-navy-900 text-white hover:bg-navy-700 shadow-[0_8px_24px_-10px_rgba(11,31,58,0.6)]",
  teal: "bg-teal-500 text-navy-950 hover:bg-teal-400 shadow-glow",
  ghost: "text-navy-900 hover:bg-navy-100/60",
  light: "bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20 backdrop-blur",
  outline: "text-navy-900 ring-1 ring-navy-900/15 hover:ring-navy-900/40 bg-white",
  whatsapp: "bg-[#1FAF5A] text-white hover:bg-[#199a4f] shadow-[0_10px_30px_-12px_rgba(31,175,90,0.7)]",
};

const SIZES = { sm: "h-9 px-4 text-sm", md: "h-11 px-5 text-[0.95rem]", lg: "h-13 px-7 text-base" } as const;

const base =
  "group inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-300 ease-out-expo focus-visible:outline-offset-4 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

export function ButtonLink({
  href, children, variant = "primary", size = "md", arrow, external, className, ...rest
}: { href: string; children: ReactNode; variant?: Variant; size?: keyof typeof SIZES; arrow?: boolean; external?: boolean; className?: string } & Omit<ComponentProps<"a">, "href">) {
  const cls = cx(base, VARIANTS[variant], SIZES[size], className);
  const inner = (
    <>
      {children}
      {arrow && <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />}
    </>
  );
  if (external) {
    return (
      <a href={href} className={cls} target="_blank" rel="noopener noreferrer" {...rest}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...rest}>
      {inner}
    </Link>
  );
}

export function Button({
  children, variant = "primary", size = "md", className, ...rest
}: { variant?: Variant; size?: keyof typeof SIZES } & ComponentProps<"button">) {
  return (
    <button className={cx(base, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {children}
    </button>
  );
}

export function SectionHeading({
  eyebrow, title, intro, align = "left", tone = "dark", className,
}: { eyebrow?: string; title: ReactNode; intro?: ReactNode; align?: "left" | "center"; tone?: "dark" | "light"; className?: string }) {
  return (
    <div className={cx(align === "center" && "mx-auto text-center", "max-w-3xl", className)}>
      {eyebrow && <p className={cx("eyebrow", tone === "light" && "!text-teal-400")}>{eyebrow}</p>}
      <h2 className={cx("mt-4 text-[2rem] font-semibold leading-[1.08] sm:text-5xl", tone === "light" ? "text-white" : "text-navy-900")}>
        {title}
      </h2>
      {intro && <p className={cx("mt-5 text-lg leading-relaxed", tone === "light" ? "text-navy-300" : "text-ink-muted")}>{intro}</p>}
    </div>
  );
}

export function Badge({ children, tone = "mint", className }: { children: ReactNode; tone?: "mint" | "navy" | "warn" | "danger" | "success" | "muted"; className?: string }) {
  const tones = {
    mint: "bg-mint text-teal-700 ring-teal-500/20",
    navy: "bg-navy-100 text-navy-700 ring-navy-700/10",
    warn: "bg-warning-soft text-warning ring-warning/20",
    danger: "bg-danger-soft text-danger ring-danger/20",
    success: "bg-success-soft text-success ring-success/20",
    muted: "bg-slate-100 text-slate-600 ring-slate-500/10",
  } as const;
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone], className)}>{children}</span>;
}
