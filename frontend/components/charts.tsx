"use client";
import { ProgressBar } from "@/components/ui";

/** Horizontal bars with the value printed (no decoration). */
export function BarList({ rows, unit = "", max }: { rows: { label: string; value: number; sub?: string }[]; unit?: string; max?: number }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm"><span className="truncate">{r.label}</span><span className="num font-medium text-indigo">{r.value}{unit}</span></div>
          <ProgressBar value={(r.value / m) * 100} tone="navy" label={r.label} />
          {r.sub && <p className="mt-0.5 text-[11px] text-coop-slate">{r.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Simple column chart with labelled axis ticks. */
export function Columns({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div>
      <div className="flex h-40 items-end gap-3 border-b border-black/10">
        {data.map((d) => (
          <div key={d.label} className="group flex flex-1 flex-col items-center justify-end h-full">
            <span className="num mb-1 text-xs font-medium text-indigo">{d.value}</span>
            <div className="w-full max-w-[44px] rounded-t bg-indigo/85 transition-all duration-700 group-hover:bg-coop-saffron" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 4 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3">{data.map((d) => <span key={d.label} className="flex-1 text-center text-[11px] text-coop-slate">{d.label}</span>)}</div>
    </div>
  );
}

/** Funnel: each stage as a bar, with conversion from the previous stage. */
export function Funnel({ stages }: { stages: { label: string; value: number }[] }) {
  const max = Math.max(1, stages[0]?.value || 1);
  return (
    <ol className="space-y-2.5">
      {stages.map((s, i) => {
        const prev = i ? stages[i - 1].value : null;
        return (
          <li key={s.label} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm">
            <span className="text-coop-slate">{s.label}</span>
            <div className="h-6 rounded bg-black/[0.06]"><div className="h-6 rounded bg-indigo transition-all duration-700" style={{ width: `${(s.value / max) * 100}%`, minWidth: s.value ? 6 : 0, opacity: 1 - i * 0.18 }} /></div>
            <span className="num w-20 text-right font-medium text-indigo">{s.value}{prev ? <span className="ml-1 text-[11px] font-normal text-coop-slate">{prev ? Math.round((s.value / prev) * 100) : 0}%</span> : null}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Ring({ value, size = 84, label }: { value: number; size?: number; label?: string }) {
  const r = (size - 10) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${label || "Progress"}: ${value}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#00000014" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2E7D4F" strokeWidth={6} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * value) / 100} style={{ transition: "stroke-dashoffset 0.8s ease-out" }} />
      </svg>
      <span className="num absolute inset-0 flex items-center justify-center font-display text-lg font-semibold text-indigo">{value}%</span>
    </div>
  );
}
