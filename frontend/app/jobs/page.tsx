"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AiJobMatches } from "@/components/ai/AiInsights";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Ring } from "@/components/charts";
import Icon from "@/components/Icon";
import { Badge, CardSkeleton, Empty, ProgressBar, fmtDate } from "@/components/ui";

type Job = {
  id: string; title: string; description: string | null; required_skills: string | null; location: string | null; company_name: string | null;
  sector: string | null; posted_at: string; job_type: string; salary_range: string | null; openings: number | null; experience: string | null; deadline: string | null;
};
const TYPES = ["Full-time", "Part-time", "Internship", "Apprenticeship", "Contract"];
const STAGES = ["applied", "shortlisted", "interview", "hired"];

const skillList = (s: string | null) => (s || "").split(",").map((x) => x.trim()).filter(Boolean);

function Stepper({ status }: { status: string }) {
  if (status === "rejected") return <Badge tone="red">Not selected</Badge>;
  const at = Math.max(0, STAGES.indexOf(status));
  return (
    <ol className="flex items-center gap-1.5 text-[11px]" aria-label={`Application status: ${status}`}>
      {STAGES.map((s, i) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${i <= at ? "bg-coop-green text-white" : "bg-black/10 text-coop-slate"}`}>{i < at ? "✓" : i + 1}</span>
          <span className={i === at ? "font-semibold text-coop-ink" : "text-coop-slate"}>{s[0].toUpperCase() + s.slice(1)}</span>
          {i < STAGES.length - 1 && <span className="h-px w-3 bg-black/20" />}
        </li>
      ))}
    </ol>
  );
}

export default function JobsPage() {
  const { user, loading } = useAuth();
  const toast = useToast();
  const isTrainee = user?.role === "trainee";
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [match, setMatch] = useState<Record<string, number>>({});
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [mine, setMine] = useState<string[]>([]);
  const [comp, setComp] = useState<{ percent: number; missing: string[] } | null>(null);
  const [q, setQ] = useState(""); const [types, setTypes] = useState<string[]>([]); const [loc, setLoc] = useState(""); const [skill, setSkill] = useState("");
  const [good, setGood] = useState(false); const [sort, setSort] = useState("match"); const [filtersOpen, setFiltersOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { setQ(new URLSearchParams(window.location.search).get("q") || ""); api<Job[]>("/api/public/jobs").then(setJobs).catch(() => setJobs([])); }, []);
  useEffect(() => {
    if (!user) return;
    api<{ id: string; match_score: number | null }[]>("/api/jobs").then((l) => setMatch(Object.fromEntries(l.map((j) => [j.id, j.match_score ?? 0])))).catch(() => {});
    api<{ job_id: string; status: string }[]>("/api/jobs/mine/applications").then((l) => setApplied(Object.fromEntries(l.map((a) => [a.job_id, a.status])))).catch(() => {});
    api<any>("/api/profiles/me").then((p) => setMine([...p.skills.map((s: any) => s.skill_name), ...p.certificates.map((c: any) => c.skill).filter(Boolean)].map((s: string) => s.toLowerCase()))).catch(() => {});
    if (isTrainee) api<{ percent: number; missing: string[] }>("/api/dashboard/profile-completeness").then(setComp).catch(() => {});
  }, [user, isTrainee]);

  const has = (s: string) => mine.some((m) => m.includes(s.toLowerCase()) || s.toLowerCase().includes(m));
  const locations = useMemo(() => Array.from(new Set((jobs || []).map((j) => j.location).filter(Boolean))) as string[], [jobs]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    let out = (jobs || []).filter((j) =>
      (!s || `${j.title} ${j.company_name} ${j.required_skills} ${j.location}`.toLowerCase().includes(s)) &&
      (!types.length || types.includes(j.job_type)) && (!loc || j.location === loc) &&
      (!skill || (j.required_skills || "").toLowerCase().includes(skill.toLowerCase())) && (!good || (match[j.id] ?? 0) >= 50));
    out = [...out].sort((a, b) => sort === "match" && user ? (match[b.id] ?? 0) - (match[a.id] ?? 0) : +new Date(b.posted_at) - +new Date(a.posted_at));
    return out;
  }, [jobs, q, types, loc, skill, good, sort, match, user]);

  const recommended = useMemo(() => (jobs || []).filter((j) => !applied[j.id] && (match[j.id] ?? 0) >= 50).sort((a, b) => (match[b.id] ?? 0) - (match[a.id] ?? 0)).slice(0, 3), [jobs, match, applied]);

  async function apply(j: Job) {
    if (!user) { window.location.href = "/login"; return; }
    setBusy(j.id);
    try { await api(`/api/jobs/${j.id}/apply`, { method: "POST" }); setApplied((a) => ({ ...a, [j.id]: "applied" })); toast(`Applied to ${j.title}`); }
    catch (e: any) { toast(e.message || "Could not apply", "error"); } finally { setBusy(null); }
  }
  const toggleType = (t: string) => setTypes((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]));
  const activeFilters = types.length + (loc ? 1 : 0) + (skill ? 1 : 0) + (good ? 1 : 0);

  const Filters = (
    <div className="space-y-5">
      <fieldset><legend className="eyebrow mb-2">Type</legend>{TYPES.map((t) => (
        <label key={t} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={types.includes(t)} onChange={() => toggleType(t)} />{t}</label>))}</fieldset>
      <label className="block text-sm"><span className="eyebrow mb-2 block">Location</span>
        <select value={loc} onChange={(e) => setLoc(e.target.value)} className="w-full rounded-md border border-black/12 bg-white px-3 py-2 text-sm focus-ring"><option value="">Anywhere</option>{locations.map((l) => <option key={l}>{l}</option>)}</select></label>
      <label className="block text-sm"><span className="eyebrow mb-2 block">Skill</span>
        <input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="e.g. Communication" className="w-full rounded-md border border-black/12 px-3 py-2 text-sm focus-ring" /></label>
      {isTrainee && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={good} onChange={(e) => setGood(e.target.checked)} />Only roles that match me (50%+)</label>}
      {activeFilters > 0 && <button onClick={() => { setTypes([]); setLoc(""); setSkill(""); setGood(false); }} className="text-sm text-indigo underline focus-ring rounded">Clear filters</button>}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <p className="eyebrow">Employment</p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-indigo">Jobs & opportunities</h1>
      <p className="mt-1 max-w-2xl text-coop-slate">Openings from cooperative-sector employers, matched against your skills and certificates. Every match shows exactly which skills you have and which you are missing.</p>

      {isTrainee && comp && comp.percent < 100 && (
        <section className="mt-6 flex flex-wrap items-center gap-5 rounded-lg border border-black/[0.09] bg-white p-5" aria-label="Profile completeness">
          <Ring value={comp.percent} label="Profile completeness" />
          <div className="min-w-[14rem] flex-1"><p className="font-medium">A complete profile gets better matches</p>
            <p className="mt-0.5 text-sm text-coop-slate">Still missing: {comp.missing.slice(0, 3).join(", ")}{comp.missing.length > 3 ? ` and ${comp.missing.length - 3} more` : ""}.</p></div>
          <Link href="/profile" className="rounded-md border border-indigo px-4 py-2 text-sm font-medium text-indigo hover:bg-indigo hover:text-white transition-colors focus-ring">Complete profile</Link>
        </section>
      )}

      {isTrainee && <AiJobMatches />}

      {!user && !loading && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-coop-saffron/30 bg-coop-saffron/[0.07] px-5 py-4">
          <p className="text-sm"><b>Sign in to see how well you match each role</b> and to apply in one click.</p>
          <Link href="/login" className="rounded-md bg-indigo px-4 py-2 text-sm font-medium text-white hover:bg-indigo-dark focus-ring">Sign in</Link></div>
      )}

      {recommended.length > 0 && (
        <section className="mt-8" aria-label="Recommended">
          <h2 className="font-display text-lg font-semibold text-indigo">Recommended for you</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">{recommended.map((j) => (
            <button key={j.id} onClick={() => { setQ(j.title); setExpanded(j.id); }} className="rounded-lg border border-black/[0.09] bg-white p-4 text-left hover:border-indigo/40 focus-ring">
              <div className="flex items-start justify-between gap-2"><p className="font-medium">{j.title}</p><span className="num shrink-0 rounded bg-coop-green/10 px-1.5 py-0.5 text-xs font-semibold text-coop-green">{match[j.id]}%</span></div>
              <p className="mt-0.5 text-sm text-coop-slate">{[j.company_name, j.location].filter(Boolean).join(" · ")}</p></button>))}</div>
        </section>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_1fr]">
        <aside className="lg:sticky lg:top-32 lg:self-start">
          <button onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen} className="flex w-full items-center justify-between rounded-md border border-black/12 bg-white px-4 py-2.5 text-sm font-medium lg:hidden focus-ring">
            Filters{activeFilters ? ` (${activeFilters})` : ""}<Icon name="chevron" size={16} className={`transition-transform ${filtersOpen ? "rotate-180" : ""}`} /></button>
          <div className={`${filtersOpen ? "mt-3 block" : "hidden"} rounded-lg border border-black/[0.09] bg-white p-5 lg:block`}>{Filters}</div>
        </aside>

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-[14rem] flex-1 items-center gap-2 rounded-md border border-black/12 bg-white px-3 py-2"><Icon name="search" size={16} className="text-coop-slate" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by role, company or skill" aria-label="Search jobs" className="w-full bg-transparent text-sm outline-none" /></div>
            <label className="flex items-center gap-2 text-sm text-coop-slate">Sort
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-md border border-black/12 bg-white px-2 py-2 text-sm text-coop-ink focus-ring"><option value="match">Best match</option><option value="new">Newest</option></select></label>
          </div>
          <p className="mt-3 text-sm text-coop-slate num" aria-live="polite">{jobs ? `${list.length} opportunit${list.length === 1 ? "y" : "ies"}` : "Loading…"}</p>

          <div className="mt-3 space-y-3">
            {!jobs && [0, 1, 2].map((i) => <CardSkeleton key={i} rows={3} />)}
            {jobs && list.length === 0 && <Empty>No roles match your filters. Try clearing them or searching a different skill.</Empty>}
            {list.map((j) => {
              const req = skillList(j.required_skills);
              const got = req.filter(has).length;
              const score = match[j.id];
              const status = applied[j.id];
              const open = expanded === j.id;
              return (
                <article key={j.id} className="rounded-lg border border-black/[0.09] bg-white p-5 transition-shadow hover:shadow-md">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0"><h2 className="font-display text-lg font-semibold text-indigo">{j.title}</h2>
                      <p className="text-sm text-coop-slate">{[j.company_name, j.location].filter(Boolean).join(" · ")}</p></div>
                    {user && score !== undefined && (
                      <div className="w-28 text-right"><p className="num text-lg font-semibold text-coop-ink">{score}%<span className="ml-1 text-xs font-normal text-coop-slate">match</span></p><ProgressBar value={score} tone={score >= 60 ? "green" : "saffron"} label="Match" /></div>)}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><Badge tone="indigo">{j.job_type}</Badge>{j.salary_range && <Badge>{j.salary_range}</Badge>}{j.experience && <Badge>{j.experience}</Badge>}
                    {j.deadline && <span className="text-coop-slate">Apply by {fmtDate(j.deadline)}</span>}{j.openings ? <span className="text-coop-slate">· {j.openings} opening{j.openings > 1 ? "s" : ""}</span> : null}</div>

                  {req.length > 0 && (
                    <div className="mt-3"><p className="text-xs text-coop-slate">{user ? `You have ${got} of ${req.length} required skills` : "Skills required"}</p>
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">{req.map((s) => { const ok = user && has(s); return (
                        <li key={s} className={`rounded-full border px-2.5 py-0.5 text-xs ${ok ? "border-coop-green/40 bg-coop-green/10 text-coop-green" : "border-black/12 text-coop-ink/70"}`}>{ok ? "✓ " : ""}{s}</li>); })}</ul></div>)}

                  {open && j.description && <p className="fade-in mt-3 whitespace-pre-line text-sm text-coop-ink/80">{j.description}</p>}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-3">
                    <button onClick={() => setExpanded(open ? null : j.id)} aria-expanded={open} className="text-sm font-medium text-indigo hover:underline focus-ring rounded">{open ? "Hide details" : "View details"}</button>
                    {status ? <Stepper status={status} />
                      : isTrainee || !user ? <button onClick={() => apply(j)} disabled={busy === j.id} className="rounded-md bg-indigo px-5 py-2 text-sm font-medium text-white hover:bg-indigo-dark active:scale-[0.98] transition disabled:opacity-60 focus-ring">{busy === j.id ? "Applying…" : user ? "Apply" : "Sign in to apply"}</button>
                      : <span className="text-xs text-coop-slate">Applications are for trainee accounts</span>}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
