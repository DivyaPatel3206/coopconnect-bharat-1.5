"use client";

import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

const fieldCls =
  "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-coop-ink placeholder:text-coop-slate/70 focus-ring disabled:bg-black/5";

export function Btn({
  variant = "primary", className = "", ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const v = {
    primary: "bg-indigo text-white hover:bg-indigo-dark",
    secondary: "border border-black/15 text-coop-ink hover:bg-black/5 bg-white",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-indigo hover:bg-indigo/5",
  }[variant];
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-ring ${v} ${className}`}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block font-medium text-coop-ink mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-coop-slate mt-1">{hint}</span>}
    </label>
  );
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${fieldCls} ${p.className || ""}`} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${fieldCls} ${p.className || ""}`} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={`${fieldCls} ${p.className || ""}`} />;

const tones: Record<string, string> = {
  green: "bg-coop-green/10 text-coop-green",
  saffron: "bg-coop-saffron/10 text-coop-saffron",
  red: "bg-red-100 text-red-700",
  slate: "bg-black/5 text-coop-slate",
  indigo: "bg-indigo/10 text-indigo",
};
export function Badge({ tone = "slate", children }: { tone?: keyof typeof tones | string; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${tones[tone] || tones.slate}`}>{children}</span>;
}

export function statusTone(s?: string | null): string {
  const v = (s || "").toLowerCase();
  if (["active", "present", "hired", "done", "completed", "confirmed", "open", "graded", "available", "approved"].includes(v)) return "green";
  if (["pending", "planned", "applied", "incomplete", "ongoing", "submitted", "interview", "shortlisted"].includes(v)) return "saffron";
  if (["suspended", "absent", "rejected", "cancelled", "closed", "maintenance", "dropped"].includes(v)) return "red";
  return "slate";
}

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-black/10 -mx-1 px-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px focus-ring ${
            value === t.id ? "border-coop-saffron text-indigo" : "border-transparent text-coop-slate hover:text-indigo"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-xl sm:rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold text-indigo">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-coop-slate hover:text-coop-ink text-2xl leading-none focus-ring">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return <p className="py-8 text-center text-sm text-coop-slate" role="status">{label}</p>;
}
export function ErrorMsg({ error }: { error?: string | null }) {
  return error ? <p role="alert" className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p> : null;
}
export function Notice({ children }: { children: ReactNode }) {
  return <p role="status" className="rounded-md bg-coop-green/10 border border-coop-green/30 px-3 py-2 text-sm text-coop-green">{children}</p>;
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-black/15 py-10 text-center text-sm text-coop-slate">{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-indigo">{title}</h1>
        {subtitle && <p className="text-coop-slate mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Wraps a page: handles loading, signed-out and wrong-role states consistently. */
export function Gate({ roles, children }: { roles?: string[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="max-w-6xl mx-auto px-6 py-16"><Spinner /></div>;
  if (!user)
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <p className="text-coop-slate">Sign in to continue.</p>
        <Link href="/login" className="inline-block mt-4 rounded-md bg-indigo text-white px-4 py-2 text-sm hover:bg-indigo-dark focus-ring">Sign in</Link>
      </div>
    );
  if (roles && !roles.includes(user.role))
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <p className="font-display text-xl text-indigo">Not available for your role</p>
        <p className="text-coop-slate mt-2 text-sm">This section is limited to other account types.</p>
        <Link href="/dashboard" className="inline-block mt-4 text-sm text-indigo underline focus-ring">Back to dashboard</Link>
      </div>
    );
  return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">{children}</div>;
}

export const fmtDate = (d?: string | null) =>
  d ? new Date(d.length <= 10 ? d + "T00:00:00" : d.endsWith("Z") ? d : d + "Z").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const fmtTime = (d?: string | null) =>
  d ? new Date(d.endsWith("Z") ? d : d + "Z").toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";
export const today = () => new Date().toISOString().slice(0, 10);

export function useSubmit() {
  return async (fn: () => Promise<any>, onErr: (m: string) => void, onOk?: () => void) => {
    try {
      await fn();
      onOk?.();
    } catch (e: any) {
      onErr(e.message || "Something went wrong");
    }
  };
}


/* ---------- Skeleton, animated progress, toasts ---------- */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-lg border border-black/[0.09] bg-white p-5 space-y-3" role="status" aria-label="Loading">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className={`h-3 ${i % 2 ? "w-2/3" : "w-full"}`} />)}
    </div>
  );
}

import { useState as useStateP, useEffect as useEffectP } from "react";
export function ProgressBar({ value, tone = "green", label }: { value: number; tone?: "green" | "navy" | "saffron"; label?: string }) {
  const [w, setW] = useStateP(0);
  useEffectP(() => { const t = setTimeout(() => setW(Math.max(0, Math.min(100, value))), 60); return () => clearTimeout(t); }, [value]);
  const c = { green: "bg-coop-green", navy: "bg-indigo", saffron: "bg-coop-saffron" }[tone];
  return (
    <div className="h-1.5 w-full rounded-full bg-black/[0.08]" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`h-1.5 rounded-full ${c} transition-[width] duration-700 ease-out`} style={{ width: `${w}%` }} />
    </div>
  );
}
