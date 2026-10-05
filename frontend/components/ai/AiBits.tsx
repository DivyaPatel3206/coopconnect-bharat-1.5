"use client";
import { ReactNode } from "react";
import Icon from "@/components/Icon";
import { askAI } from "@/lib/ai";

export function AiTag({ children = "AI-generated" }: { children?: ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded border border-indigo/20 bg-indigo/[0.05] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-indigo"><Icon name="spark" size={10} />{children}</span>;
}
export function Conf({ level }: { level: string }) {
  const t: Record<string, string> = { high: "bg-coop-green/10 text-coop-green", medium: "bg-coop-saffron/15 text-[#9a5b10]", low: "bg-red-50 text-red-700" };
  return <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${t[level] || t.low}`}>{level} confidence</span>;
}
export function AiPanel({ title, tag = true, action, children, className = "" }: { title: string; tag?: boolean; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-black/[0.09] bg-white ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] px-5 py-3">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-indigo">{title}{tag && <AiTag />}</h2>{action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
export function Meter({ value, label, hint }: { value: number | null; label: string; hint?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm"><span className="font-medium">{label}</span><span className="num text-coop-slate">{value == null ? "Not enough data" : `${value}%`}</span></div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/[0.07]" role="progressbar" aria-valuenow={value ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-indigo transition-all" style={{ width: `${value ?? 0}%` }} /></div>
      {hint && <p className="mt-1 text-xs text-coop-slate">{hint}</p>}
    </div>
  );
}
export function AskAI({ prompt, label, className = "" }: { prompt: string; label: string; className?: string }) {
  return <button type="button" onClick={() => askAI(prompt)} className={`inline-flex items-center gap-1.5 rounded-md border border-indigo/25 px-3 py-1.5 text-xs font-medium text-indigo hover:bg-indigo hover:text-white transition-colors focus-ring ${className}`}><Icon name="spark" size={12} />{label}</button>;
}
export const Why = ({ children }: { children: ReactNode }) => <p className="mt-1 text-xs text-coop-slate"><span className="font-semibold text-indigo">Why this: </span>{children}</p>;
