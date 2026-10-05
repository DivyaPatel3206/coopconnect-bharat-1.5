"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/roles";
import { Ring } from "@/components/charts";
import { useToast } from "@/components/Toast";
import Icon from "@/components/Icon";
import { AiInsights } from "@/components/ai/AiInsights";
import { Badge, CardSkeleton, Empty, ProgressBar, Skeleton, statusTone, fmtDate } from "@/components/ui";

type Ev = { type: string; title: string; subtitle: string; date: string; status: string | null; href: string | null };
type Note = { tone: "info" | "action" | "good" | "warn"; text: string; href: string };
type H = {
  summary: { sessions_attended: number; hours: number; attendance_percent: number | null; courses_completed: number; certificates: number; applications: number };
  upcoming: { id: string; title: string; date: string; start: string; end: string; venue: string | null }[];
  events: Ev[]; notifications: Note[]; profile: { percent: number; missing: string[] }; skills: { skill_name: string; level_percent: number }[];
  recommended_courses: { id: string; title: string; level: string | null; duration_hours: number | null; category: string | null; reason: string }[];
  recommended_jobs: { id: string; title: string; company: string; location: string | null; job_type: string; match: number }[];
};
type Course = { id: string; title: string; enrolled: boolean; progress_percent: number; completed: boolean };
type Cert = { id: string; verification_id: string; programme_name: string };

const NOTE_DOT: Record<string, string> = { info: "bg-indigo", action: "bg-coop-saffron", good: "bg-coop-green", warn: "bg-red-500" };
const TYPE_ICON: Record<string, string> = { attendance: "qr", training: "graduation", learning: "book", certificate: "award", career: "briefcase", stay: "bed" };
const FILTERS = [["all", "All"], ["attendance", "Attendance"], ["training", "Training"], ["learning", "Learning"], ["career", "Career"]];

function Panel({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-black/[0.09] bg-white ${className}`}>
      <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-3"><h2 className="font-display text-base font-semibold text-indigo">{title}</h2>{action}</div>
      <div className="p-5">{children}</div>
    </section>
  );
}
const More = ({ href, label }: { href: string; label: string }) => <Link href={href} className="text-xs font-medium text-indigo hover:underline">{label}</Link>;

function Announce({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ title: "", body: "", tag: "Update" });
  return (
    <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); try { await api("/api/public/announcements", { method: "POST", body: JSON.stringify({ ...f, body: f.body || null }) }); toast("Announcement published on the homepage"); setF({ title: "", body: "", tag: "Update" }); onDone(); } catch (x: any) { toast(x.message, "error"); } }}>
      <input required minLength={3} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Headline" aria-label="Headline" className="w-full rounded-md border border-black/12 px-3 py-2 text-sm focus-ring" />
      <textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Details (optional)" aria-label="Details" rows={2} className="w-full rounded-md border border-black/12 px-3 py-2 text-sm focus-ring" />
      <div className="flex gap-2"><select value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} aria-label="Tag" className="rounded-md border border-black/12 bg-white px-2 py-2 text-sm focus-ring">{["Update", "Programme", "Platform", "Employment"].map((t) => <option key={t}>{t}</option>)}</select>
        <button className="rounded-md bg-indigo px-4 py-2 text-sm font-medium text-white hover:bg-indigo-dark focus-ring">Publish</button></div>
    </form>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [h, setH] = useState<H | null>(null);
  const [err, setErr] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [filter, setFilter] = useState("all");
  const [shown, setShown] = useState(6);

  useEffect(() => {
    if (!user) return;
    api<H>("/api/dashboard/history").then(setH).catch(() => setErr(true));
    api<Course[]>("/api/learning/courses").then(setCourses).catch(() => {});
    api<Cert[]>("/api/certificates").then(setCerts).catch(() => {});
  }, [user]);

  const events = useMemo(() => (h?.events || []).filter((e) => filter === "all" || e.type === filter || (filter === "learning" && e.type === "certificate")), [h, filter]);
  if (loading) return <div className="mx-auto max-w-7xl px-6 py-12"><CardSkeleton rows={4} /></div>;
  if (!user) return <div className="mx-auto max-w-md px-6 py-16 text-center"><p className="text-coop-slate">Sign in to see your dashboard.</p><Link href="/login" className="font-medium text-indigo hover:underline">Sign in</Link></div>;

  const role = user.role;
  const learner = role === "trainee";
  const staff = ["super_admin", "institution_admin", "trainer"].includes(role);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const s = h?.summary;
  const inProgress = courses.filter((c) => c.enrolled && !c.completed);
  const actions: { href: string; label: string; primary?: boolean }[] =
    learner ? [{ href: "/attendance/scan", label: "Scan attendance QR", primary: true }, { href: "/courses", label: "Find a course" }, { href: "/jobs", label: "Browse jobs" }]
    : staff ? [{ href: "/attendance", label: "Open attendance", primary: true }, { href: "/logistics", label: "Timetable" }, { href: "/people", label: "People" }]
    : role === "employer" ? [{ href: "/employer", label: "Employer hub", primary: true }, { href: "/employer", label: "Find candidates" }]
    : [{ href: "/career-chat", label: "Career chat", primary: true }];
  const metrics = learner || staff
    ? [["Sessions attended", s?.sessions_attended, s?.attendance_percent != null ? `${s.attendance_percent}% attendance` : ""], ["Hours trained", s?.hours, ""], ["Courses completed", s?.courses_completed, ""], ["Certificates", s?.certificates ?? certs.length, ""]]
    : [["Applications", s?.applications, ""], ["Sessions", s?.sessions_attended, ""], ["Certificates", s?.certificates, ""]];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · {ROLE_LABEL[role] || role}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-indigo">{greet}, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-coop-slate">{h && h.notifications.length ? `You have ${h.notifications.length} thing${h.notifications.length > 1 ? "s" : ""} that need${h.notifications.length > 1 ? "" : "s"} attention.` : "You are all caught up."}</p>
        </div>
        <div className="flex flex-wrap gap-2">{actions.map((a) => <Link key={a.label} href={a.href} className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-ring ${a.primary ? "bg-indigo text-white hover:bg-indigo-dark" : "border border-black/15 bg-white text-indigo hover:border-indigo/50"}`}>{a.label}</Link>)}</div>
      </header>

      {learner && <AiInsights />}

      <dl className="mt-6 grid grid-cols-2 divide-black/[0.08] rounded-lg border border-black/[0.09] bg-white md:grid-cols-4 md:divide-x" aria-label="Summary">
        {metrics.map(([l, v, hint], i) => (
          <div key={l as string} className={`p-5 ${i > 1 ? "border-t border-black/[0.08] md:border-t-0" : ""}`}>
            <dd className="num font-display text-3xl font-semibold text-indigo">{v === undefined ? <Skeleton className="h-8 w-14" /> : (v as number)}</dd>
            <dt className="mt-1 text-sm text-coop-slate">{l}</dt>{hint ? <p className="text-xs text-coop-slate/70">{hint}</p> : null}
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {(learner || role === "trainer") && (
            <Panel title="Continue learning" action={<More href="/learning" label="All courses" />}>
              {!courses.length ? <Skeleton className="h-12 w-full" /> : inProgress.length === 0 ? <p className="text-sm text-coop-slate">No course in progress. <Link href="/courses" className="text-indigo underline">Pick one to start</Link>.</p> : (
                <ul className="space-y-4">{inProgress.map((c) => (
                  <li key={c.id} className="flex items-center gap-4"><div className="min-w-0 flex-1"><Link href={`/learning/${c.id}`} className="block truncate font-medium hover:text-indigo">{c.title}</Link><div className="mt-2"><ProgressBar value={c.progress_percent} label={c.title} /></div></div>
                    <span className="num w-10 text-right text-sm text-coop-slate">{Math.round(c.progress_percent)}%</span><Link href={`/learning/${c.id}`} className="rounded-md border border-indigo px-3 py-1.5 text-sm font-medium text-indigo hover:bg-indigo hover:text-white transition-colors focus-ring">Resume</Link></li>))}</ul>)}
            </Panel>
          )}

          {learner && (
            <Panel title="Recommended for you">
              {!h ? <Skeleton className="h-24 w-full" /> : (
                <div className="grid gap-6 md:grid-cols-2">
                  <div><p className="eyebrow mb-2">Training</p>{h.recommended_courses.length === 0 ? <p className="text-sm text-coop-slate">You are enrolled in everything available.</p> :
                    <ul className="space-y-3">{h.recommended_courses.map((c) => <li key={c.id}><Link href="/courses" className="group block"><p className="text-sm font-medium group-hover:text-indigo">{c.title}</p><p className="text-xs text-coop-slate">{[c.level, c.duration_hours && `${c.duration_hours} h`, c.reason].filter(Boolean).join(" · ")}</p></Link></li>)}</ul>}</div>
                  <div><p className="eyebrow mb-2">Opportunities</p>{h.recommended_jobs.length === 0 ? <p className="text-sm text-coop-slate">Add skills to your profile to see matches.</p> :
                    <ul className="space-y-3">{h.recommended_jobs.map((j) => <li key={j.id}><Link href={`/jobs?q=${encodeURIComponent(j.title)}`} className="group block"><div className="flex justify-between gap-2"><p className="text-sm font-medium group-hover:text-indigo">{j.title}</p><span className="num text-xs font-semibold text-coop-green">{j.match}%</span></div><p className="text-xs text-coop-slate">{[j.company, j.job_type].filter(Boolean).join(" · ")}</p></Link></li>)}</ul>}</div>
                </div>)}
            </Panel>
          )}

          <Panel title="Recent activity" action={
            <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Filter activity">{FILTERS.map(([id, l]) => (
              <button key={id} role="tab" aria-selected={filter === id} onClick={() => { setFilter(id); setShown(6); }} className={`rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap focus-ring ${filter === id ? "bg-indigo text-white" : "text-coop-slate hover:bg-black/5"}`}>{l}</button>))}</div>}>
            {!h && !err && <Skeleton className="h-32 w-full" />}
            {err && <Empty>Could not load activity. Refresh to try again.</Empty>}
            {h && events.length === 0 && <Empty>Nothing here yet. Your attendance, training, learning and job activity will appear as you go.</Empty>}
            <ol className="divide-y divide-black/[0.06]">{events.slice(0, shown).map((e, i) => {
              const row = (<div className="flex items-center gap-3 py-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo/[0.08] text-indigo"><Icon name={TYPE_ICON[e.type] || "history"} size={15} /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{e.title}</p><p className="truncate text-xs text-coop-slate">{e.subtitle}</p></div>
                <div className="shrink-0 text-right"><p className="num text-xs text-coop-slate">{fmtDate(e.date)}</p>{e.status && <Badge tone={statusTone(e.status)}>{e.status}</Badge>}</div></div>);
              return <li key={i}>{e.href ? <Link href={e.href} className="block -mx-2 rounded px-2 hover:bg-black/[0.025] focus-ring">{row}</Link> : row}</li>; })}</ol>
            {events.length > shown && <button onClick={() => setShown(shown + 10)} className="mt-3 w-full rounded-md border border-black/12 py-2 text-sm font-medium text-indigo hover:bg-black/[0.03] focus-ring">Show older</button>}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Notifications">
            {!h ? <Skeleton className="h-16 w-full" /> : h.notifications.length === 0 ? <p className="text-sm text-coop-slate">No new notifications.</p> : (
              <ul className="space-y-3">{h.notifications.map((n, i) => <li key={i}><Link href={n.href} className="flex gap-3 text-sm hover:text-indigo focus-ring rounded"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${NOTE_DOT[n.tone]}`} aria-hidden /><span>{n.text}</span></Link></li>)}</ul>)}
          </Panel>

          <Panel title="Coming up" action={<More href="/logistics" label="Timetable" />}>
            {!h ? <Skeleton className="h-16 w-full" /> : h.upcoming.length === 0 ? <p className="text-sm text-coop-slate">No sessions scheduled.</p> : (
              <ul className="space-y-3">{h.upcoming.map((u) => { const d = new Date(u.date + "T00:00:00"); return (
                <li key={u.id} className="flex gap-3"><div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded border border-black/10 leading-none"><span className="text-[9px] font-semibold uppercase text-coop-saffron">{d.toLocaleDateString("en-IN", { month: "short" })}</span><span className="num text-base font-semibold text-indigo">{d.getDate()}</span></div>
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{u.title}</p><p className="text-xs text-coop-slate num">{u.start}–{u.end}{u.venue ? ` · ${u.venue}` : ""}</p></div></li>); })}</ul>)}
          </Panel>

          {h && (learner || role === "trainer") && (
            <Panel title="Skills & profile" action={<More href="/profile" label="Edit" />}>
              <div className="flex items-center gap-4"><Ring value={h.profile.percent} label="Profile completeness" /><div className="text-sm"><p className="font-medium">Profile {h.profile.percent}% complete</p>{h.profile.missing[0] && <p className="text-xs text-coop-slate">Next: add {h.profile.missing[0].toLowerCase()}</p>}</div></div>
              {h.skills.length > 0 && <ul className="mt-5 space-y-3">{h.skills.map((k) => <li key={k.skill_name}><div className="mb-1 flex justify-between text-sm"><span>{k.skill_name}</span><span className="num text-coop-slate">{k.level_percent}%</span></div><ProgressBar value={k.level_percent} tone="navy" label={k.skill_name} /></li>)}</ul>}
            </Panel>
          )}

          {(learner || certs.length > 0) && (
            <Panel title="Certificates">
              {certs.length === 0 ? <p className="text-sm text-coop-slate">Complete a course to earn your first certificate.</p> : (
                <ul className="space-y-2.5">{certs.map((c) => <li key={c.id} className="flex items-center gap-3"><Icon name="award" size={18} className="shrink-0 text-coop-saffron" /><div className="min-w-0"><p className="truncate text-sm font-medium">{c.programme_name}</p><p className="num text-xs text-coop-slate">{c.verification_id}</p></div></li>)}</ul>)}
            </Panel>
          )}

          {role === "super_admin" && <Panel title="Post an announcement"><Announce onDone={() => {}} /></Panel>}
        </div>
      </div>
    </div>
  );
}
