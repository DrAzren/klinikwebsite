import type { ComponentProps, ReactNode } from "react";

export function PageHeader({ title, intro, actions }: { title: string; intro?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900 sm:text-3xl">{title}</h1>
        {intro && <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "", actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`rounded-3xl bg-white p-5 ring-1 ring-line sm:p-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold text-navy-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const fieldCls = "mt-1 w-full rounded-xl border-0 bg-paper px-3 text-sm text-navy-900 ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-teal-500";

export function Input({ label, className = "", ...rest }: { label: string } & ComponentProps<"input">) {
  return (
    <label className={`block text-xs font-medium text-ink-soft ${className}`}>
      {label}
      <input {...rest} className={`${fieldCls} h-10`} />
    </label>
  );
}

export function Textarea({ label, className = "", ...rest }: { label: string } & ComponentProps<"textarea">) {
  return (
    <label className={`block text-xs font-medium text-ink-soft ${className}`}>
      {label}
      <textarea {...rest} className={`${fieldCls} py-2`} />
    </label>
  );
}

export function Select({ label, options, className = "", ...rest }: { label: string; options: { value: string; label: string }[] } & ComponentProps<"select">) {
  return (
    <label className={`block text-xs font-medium text-ink-soft ${className}`}>
      {label}
      <select {...rest} className={`${fieldCls} h-10`}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Checkbox({ label, ...rest }: { label: string } & ComponentProps<"input">) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-soft">
      <input type="checkbox" {...rest} className="h-4 w-4 accent-teal-600" />
      {label}
    </label>
  );
}

const TONES: Record<string, string> = {
  pending: "bg-warning-soft text-warning", pending_peer: "bg-warning-soft text-warning", peer_accepted: "bg-navy-100 text-navy-700",
  approved: "bg-success-soft text-success", succeeded: "bg-success-soft text-success", resolved: "bg-success-soft text-success", closed: "bg-slate-100 text-slate-600",
  rejected: "bg-danger-soft text-danger", declined: "bg-danger-soft text-danger", dead: "bg-danger-soft text-danger", failed: "bg-danger-soft text-danger",
  cancelled: "bg-slate-100 text-slate-600", open: "bg-warning-soft text-warning", investigating: "bg-navy-100 text-navy-700", action_required: "bg-danger-soft text-danger",
  urgent: "bg-danger text-white", review: "bg-warning-soft text-warning", routine: "bg-slate-100 text-slate-600",
  new: "bg-navy-100 text-navy-700", in_review: "bg-mint text-teal-700", contacted: "bg-mint text-teal-700", appointment_booked: "bg-success-soft text-success", no_response: "bg-slate-100 text-slate-600",
  live: "bg-success-soft text-success", demo: "bg-warning-soft text-warning", running: "bg-navy-100 text-navy-700",
  critical: "bg-danger text-white", high: "bg-danger-soft text-danger", medium: "bg-warning-soft text-warning", low: "bg-slate-100 text-slate-600",
  synced: "bg-success-soft text-success", draft: "bg-slate-100 text-slate-600", published: "bg-success-soft text-success", archived: "bg-slate-100 text-slate-500",
};

export function Status({ value, label }: { value: string; label?: string }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[value] ?? "bg-slate-100 text-slate-600"}`}>{label ?? value.replace(/_/g, " ")}</span>;
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string }) {
  const hasRows = Array.isArray(children) ? children.flat().filter(Boolean).length > 0 : !!children;
  return (
    <div className="-mx-5 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-muted">
            {head.map((h) => <th key={h} className="px-3 py-2.5 font-semibold first:pl-5 sm:first:pl-3">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {!hasRows && empty && <p className="px-3 py-8 text-center text-sm text-ink-muted">{empty}</p>}
    </div>
  );
}

export const Td = ({ children, className = "" }: { children?: ReactNode; className?: string }) => (
  <td className={`px-3 py-3 align-top first:pl-5 sm:first:pl-3 ${className}`}>{children}</td>
);

export function Stat({ label, value, tone = "default", href }: { label: string; value: ReactNode; tone?: "default" | "alert" | "teal"; href?: string }) {
  const cls = tone === "alert" ? "bg-danger-soft ring-danger/20" : tone === "teal" ? "bg-mint ring-teal-500/20" : "bg-white ring-line";
  const inner = (
    <>
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-navy-900">{value}</p>
    </>
  );
  return href ? <a href={href} className={`block rounded-3xl p-5 ring-1 transition hover:shadow-soft ${cls}`}>{inner}</a> : <div className={`rounded-3xl p-5 ring-1 ${cls}`}>{inner}</div>;
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "danger" }) {
  const cls = { info: "bg-mint text-teal-700", warn: "bg-warning-soft text-warning", danger: "bg-danger-soft text-danger" }[tone];
  return <div className={`rounded-2xl px-4 py-3 text-sm ${cls}`}>{children}</div>;
}
