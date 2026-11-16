"use client";

/**
 * Staff form primitives built on React 19 useActionState / useFormStatus.
 * Server actions return ActionResult; errors and success messages render inline.
 */
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/staff/action-result";

export function ActionForm({
  action, children, className, resetOnSuccess, confirm,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state?.error && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{state.error}
        </p>
      )}
      {state?.ok && state.message && (
        <p role="status" className="mt-3 flex items-start gap-2 whitespace-pre-wrap rounded-xl bg-success-soft px-3 py-2 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{state.message}
        </p>
      )}
    </form>
  );
}

export function Submit({ children, variant = "primary", className = "" }: { children: ReactNode; variant?: "primary" | "teal" | "danger" | "ghost"; className?: string }) {
  const { pending } = useFormStatus();
  const v = {
    primary: "bg-navy-900 text-white hover:bg-navy-700",
    teal: "bg-teal-500 text-navy-950 hover:bg-teal-400",
    danger: "bg-white text-danger ring-1 ring-danger/30 hover:bg-danger-soft",
    ghost: "bg-white text-navy-900 ring-1 ring-line hover:bg-paper",
  }[variant];
  return (
    <button type="submit" disabled={pending} className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition disabled:opacity-60 ${v} ${className}`}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
