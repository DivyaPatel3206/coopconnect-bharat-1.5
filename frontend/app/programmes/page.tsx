"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import Icon from "@/components/Icon";
import { Badge, CardSkeleton, Empty, fmtDate } from "@/components/ui";

type Programme = {
  id: string; name: string; category: string | null; trainer_name: string | null; start_date: string | null; end_date: string | null;
  location: string | null; mode: string; institution_name: string | null; capacity: number | null; seats_left: number | null;
};

export default function ProgrammesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [all, setAll] = useState<Programme[] | null>(null);
  const [registered, setRegistered] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [mode, setMode] = useState("");
  const [descs, setDescs] = useState<Record<string, string>>({});

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQ(p.get("q") || ""); setCat(p.get("category") || "");
    api<Programme[]>("/api/public/programmes").then(setAll).catch(() => setAll([]));
    api<{ id: string; description: string | null }[]>("/api/programmes").then((l) => setDescs(Object.fromEntries(l.map((x) => [x.id, x.description || ""])))).catch(() => {});
  }, []);
  useEffect(() => {
    if (!user) return;
    api<{ programme_id: string }[]>("/api/programmes/mine/registrations").then((r) => setRegistered(new Set(r.map((x) => x.programme_id)))).catch(() => {});
  }, [user]);

  const cats = useMemo(() => Array.from(new Set((all || []).map((p) => p.category).filter(Boolean))) as string[], [all]);
  const list = useMemo(() => (all || []).filter((p) => {
    const s = q.trim().toLowerCase();
    return (!s || `${p.name} ${p.institution_name} ${p.location} ${p.trainer_name}`.toLowerCase().includes(s)) && (!cat || p.category === cat) && (!mode || p.mode === mode);
  }), [all, q, cat, mode]);

  async function register(p: Programme) {
    if (!user) { window.location.href = "/login"; return; }
    setBusy(p.id);
    try { await api(`/api/programmes/${p.id}/register`, { method: "POST" }); setRegistered((s) => new Set(s).add(p.id)); toast(`Registered for ${p.name}. Your institution will confirm.`); }
    catch (e: any) { toast(e.message || "Could not register", "error"); } finally { setBusy(null); }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <p className="eyebrow">Training</p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-indigo">Training programmes</h1>
      <p className="mt-1 max-w-2xl text-coop-slate">Run by VAMNICOM and its regional and state institutes. Register, and your institution confirms your seat.</p>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-y border-black/[0.09] bg-white px-3 py-3 sm:px-4">
        <div className="flex min-w-[14rem] flex-1 items-center gap-2 rounded-md border border-black/12 px-3 py-2"><Icon name="search" size={16} className="text-coop-slate" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, institution or place" aria-label="Search programmes" className="w-full bg-transparent text-sm outline-none" /></div>
        <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-md border border-black/12 bg-white px-3 py-2 text-sm focus-ring"><option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
        <select aria-label="Mode" value={mode} onChange={(e) => setMode(e.target.value)} className="rounded-md border border-black/12 bg-white px-3 py-2 text-sm focus-ring"><option value="">Any mode</option><option>Classroom</option><option>Online</option><option>Hybrid</option></select>
        {(q || cat || mode) && <button onClick={() => { setQ(""); setCat(""); setMode(""); }} className="text-sm text-indigo underline focus-ring rounded">Clear</button>}
        <span className="ml-auto text-sm text-coop-slate num">{all ? `${list.length} programme${list.length === 1 ? "" : "s"}` : ""}</span>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {!all && [0, 1, 2, 3].map((i) => <CardSkeleton key={i} rows={4} />)}
        {all && list.length === 0 && <div className="lg:col-span-2"><Empty>No programmes match. Try clearing a filter.</Empty></div>}
        {list.map((p) => {
          const isReg = registered.has(p.id);
          const full = p.seats_left === 0;
          return (
            <article key={p.id} className="flex flex-col rounded-lg border border-black/[0.09] bg-white p-5 transition-shadow hover:shadow-md">
              <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold uppercase tracking-wider text-coop-green">{p.category}</span><Badge tone="slate">{p.mode}</Badge></div>
              <h2 className="mt-2 font-display text-xl font-semibold text-indigo">{p.name}</h2>
              {descs[p.id] && <p className="mt-1 line-clamp-2 text-sm text-coop-ink/70">{descs[p.id]}</p>}
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div><dt className="eyebrow !text-[10px]">Institution</dt><dd>{p.institution_name || "—"}</dd></div>
                <div><dt className="eyebrow !text-[10px]">Trainer</dt><dd>{p.trainer_name || "—"}</dd></div>
                <div><dt className="eyebrow !text-[10px]">Location</dt><dd>{p.location || "—"}</dd></div>
                <div><dt className="eyebrow !text-[10px]">Starts</dt><dd className="num">{p.start_date ? fmtDate(p.start_date) : "To be announced"}</dd></div>
              </dl>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-black/[0.06] pt-4">
                <span className="text-sm text-coop-slate num">{p.seats_left != null ? (full ? "Registration full" : `${p.seats_left} of ${p.capacity} seats left`) : ""}</span>
                {isReg ? <Link href="/logistics" className="rounded-md border border-coop-green/40 bg-coop-green/10 px-4 py-2 text-sm font-medium text-coop-green">Registered · view timetable</Link>
                  : <button onClick={() => register(p)} disabled={busy === p.id || full} className="rounded-md bg-indigo px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-dark active:scale-[0.98] disabled:opacity-60 focus-ring">{busy === p.id ? "Registering…" : full ? "Full" : "Register"}</button>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
