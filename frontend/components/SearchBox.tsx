"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Icon from "@/components/Icon";

type Item = { kind: string; label: string; sub?: string; href: string };
const PAGES: Item[] = [
  { kind: "Page", label: "Training programmes", href: "/programmes" }, { kind: "Page", label: "Courses", href: "/courses" },
  { kind: "Page", label: "Jobs & opportunities", href: "/jobs" }, { kind: "Page", label: "Analytics", href: "/analytics" },
  { kind: "Page", label: "Cooperatives", href: "/cooperatives" }, { kind: "Page", label: "Resources & help", href: "/resources" },
  { kind: "Page", label: "Verify a certificate", href: "/certificates/verify" },
];

export default function SearchBox({ className = "", onDone }: { className?: string; onDone?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const [data, setData] = useState<Item[] | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); } };
    const c = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("keydown", k); document.addEventListener("mousedown", c);
    return () => { window.removeEventListener("keydown", k); document.removeEventListener("mousedown", c); };
  }, []);

  function load() {
    if (data) return;
    Promise.all([api<any[]>("/api/public/programmes").catch(() => []), api<any[]>("/api/public/courses").catch(() => []), api<any[]>("/api/public/jobs").catch(() => [])]).then(([p, c, j]) =>
      setData([
        ...p.map((x) => ({ kind: "Programme", label: x.name, sub: [x.institution_name, x.location].filter(Boolean).join(" · "), href: `/programmes?q=${encodeURIComponent(x.name)}` })),
        ...c.map((x) => ({ kind: "Course", label: x.title, sub: [x.level, x.category].filter(Boolean).join(" · "), href: `/courses?q=${encodeURIComponent(x.title)}` })),
        ...j.map((x) => ({ kind: "Job", label: x.title, sub: [x.company_name, x.location].filter(Boolean).join(" · "), href: `/jobs?q=${encodeURIComponent(x.title)}` })),
      ]));
  }

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return PAGES.slice(0, 5);
    return [...PAGES, ...(data || [])].filter((i) => (i.label + " " + (i.sub || "")).toLowerCase().includes(s)).slice(0, 8);
  }, [q, data]);
  useEffect(() => setSel(0), [q]);

  function go(i?: Item) {
    const t = i || results[sel];
    if (!t) return;
    setOpen(false); setQ(""); onDone?.(); router.push(t.href);
  }

  return (
    <div ref={box} className={`relative ${className}`}>
      <div className="flex items-center gap-2 rounded-md border border-black/12 bg-white/80 px-3 py-1.5 focus-within:border-indigo">
        <Icon name="search" size={16} className="text-coop-slate" />
        <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => { setOpen(true); load(); }}
          onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); } else if (e.key === "Enter") go(); else if (e.key === "Escape") setOpen(false); }}
          placeholder="Search programmes, courses, jobs" aria-label="Search" role="combobox" aria-expanded={open} aria-controls="search-results"
          className="w-full bg-transparent text-sm outline-none placeholder:text-coop-slate/70" />
        <kbd className="hidden xl:block rounded border border-black/15 px-1.5 text-[10px] text-coop-slate">Ctrl K</kbd>
      </div>
      {open && (
        <ul id="search-results" role="listbox" className="absolute left-0 right-0 z-40 mt-1.5 max-h-80 overflow-auto rounded-md border border-black/10 bg-white p-1 shadow-lg">
          {results.length === 0 && <li className="px-3 py-3 text-sm text-coop-slate">No results for “{q}”.</li>}
          {results.map((r, i) => (
            <li key={r.kind + r.href + r.label} role="option" aria-selected={i === sel}>
              <button onMouseEnter={() => setSel(i)} onClick={() => go(r)} className={`flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm ${i === sel ? "bg-indigo/[0.07]" : ""}`}>
                <span className="min-w-0"><span className="block truncate font-medium">{r.label}</span>{r.sub && <span className="block truncate text-xs text-coop-slate">{r.sub}</span>}</span>
                <span className="eyebrow !text-[10px] shrink-0">{r.kind}</span>
              </button>
            </li>
          ))}
          {q.trim().length > 2 && <li><button onClick={() => { setOpen(false); onDone?.(); router.push(`/ai-search?q=${encodeURIComponent(q)}`); setQ(""); }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-medium text-indigo hover:bg-indigo/[0.07]"><Icon name="spark" size={14} />Ask AI in natural language: “{q}”</button></li>}
        </ul>
      )}
    </div>
  );
}
