"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import Icon from "@/components/Icon";
import { Badge, CardSkeleton, Empty, ProgressBar } from "@/components/ui";

type Course = {
  id: string; title: string; description: string | null; skill_tag: string | null; language: string; lessons: number;
  enrolled: boolean; progress_percent: number; completed: boolean; category: string | null; level: string | null;
  duration_hours: number | null; instructor: string | null; institution_name: string | null;
};
const LEVEL_TONE: Record<string, string> = { Beginner: "green", Intermediate: "saffron", Advanced: "red" };

export default function CoursesPage() {
  const { user, loading } = useAuth();
  const toast = useToast();
  const [all, setAll] = useState<Course[] | null>(null);
  const [q, setQ] = useState(""); const [cat, setCat] = useState(""); const [level, setLevel] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => api<Course[]>(user ? "/api/learning/courses" : "/api/public/courses").then(setAll).catch(() => setAll([]));
  useEffect(() => { if (!loading) load(); }, [user, loading]); // eslint-disable-line
  useEffect(() => { setQ(new URLSearchParams(window.location.search).get("q") || ""); }, []);

  const cats = useMemo(() => Array.from(new Set((all || []).map((c) => c.category).filter(Boolean))) as string[], [all]);
  const list = useMemo(() => (all || []).filter((c) => {
    const s = q.trim().toLowerCase();
    return (!s || `${c.title} ${c.description} ${c.skill_tag} ${c.instructor}`.toLowerCase().includes(s)) && (!cat || c.category === cat) && (!level || c.level === level);
  }), [all, q, cat, level]);
  const inProgress = (all || []).filter((c) => c.enrolled && !c.completed);

  async function enrol(c: Course) {
    if (!user) { window.location.href = "/login"; return; }
    setBusy(c.id);
    try { await api(`/api/learning/courses/${c.id}/enroll`, { method: "POST" }); toast(`Enrolled in ${c.title}`); window.location.href = `/learning/${c.id}`; }
    catch (e: any) { toast(e.message || "Only trainee accounts can enrol", "error"); setBusy(null); }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <p className="eyebrow">Learning</p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-indigo">Courses</h1>
      <p className="mt-1 max-w-2xl text-coop-slate">Self-paced courses with videos, interactive lessons, quizzes and assignments. Finish a course to earn a verifiable certificate.</p>

      {inProgress.length > 0 && (
        <section className="mt-8" aria-label="Continue learning">
          <h2 className="font-display text-lg font-semibold text-indigo">Continue learning</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {inProgress.map((c) => (
              <Link key={c.id} href={`/learning/${c.id}`} className="group flex items-center gap-4 rounded-lg border border-black/[0.09] bg-white p-4 hover:border-indigo/40 focus-ring">
                <div className="min-w-0 flex-1"><p className="truncate font-medium group-hover:text-indigo">{c.title}</p><div className="mt-2"><ProgressBar value={c.progress_percent} label={c.title} /></div>
                  <p className="mt-1 text-xs text-coop-slate num">{Math.round(c.progress_percent)}% complete</p></div>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-indigo">Resume<Icon name="arrow" size={14} /></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3 border-y border-black/[0.09] bg-white px-3 py-3 sm:px-4">
        <div className="flex min-w-[14rem] flex-1 items-center gap-2 rounded-md border border-black/12 px-3 py-2"><Icon name="search" size={16} className="text-coop-slate" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses, skills or instructors" aria-label="Search courses" className="w-full bg-transparent text-sm outline-none" /></div>
        <select aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value)} className="rounded-md border border-black/12 bg-white px-3 py-2 text-sm focus-ring"><option value="">Any level</option><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select>
        <span className="ml-auto text-sm text-coop-slate num">{all ? `${list.length} course${list.length === 1 ? "" : "s"}` : ""}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Categories">
        {["", ...cats].map((c) => (
          <button key={c || "all"} onClick={() => setCat(c)} aria-pressed={cat === c} className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors focus-ring ${cat === c ? "border-indigo bg-indigo text-white" : "border-black/12 bg-white text-coop-ink hover:border-indigo/50"}`}>{c || "All"}</button>
        ))}
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {!all && [0, 1, 2].map((i) => <CardSkeleton key={i} rows={5} />)}
        {all && list.length === 0 && <div className="md:col-span-2 xl:col-span-3"><Empty>No courses match your search.</Empty></div>}
        {list.map((c) => (
          <article key={c.id} className="flex flex-col rounded-lg border border-black/[0.09] bg-white p-5 transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold uppercase tracking-wider text-coop-green">{c.category || c.skill_tag || "Course"}</span>
              {c.level && <Badge tone={LEVEL_TONE[c.level] || "slate"}>{c.level}</Badge>}</div>
            <h2 className="mt-2 font-display text-xl font-semibold leading-snug text-indigo">{c.title}</h2>
            <p className="mt-1.5 line-clamp-3 text-sm text-coop-ink/70">{c.description}</p>
            <dl className="mt-4 grid grid-cols-3 gap-2 border-y border-black/[0.06] py-3 text-sm">
              <div><dt className="eyebrow !text-[10px]">Duration</dt><dd className="num">{c.duration_hours ? `${c.duration_hours} h` : "—"}</dd></div>
              <div><dt className="eyebrow !text-[10px]">Lessons</dt><dd className="num">{c.lessons}</dd></div>
              <div><dt className="eyebrow !text-[10px]">Language</dt><dd>{c.language}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-coop-slate">{[c.instructor && `Instructor: ${c.instructor}`, c.institution_name].filter(Boolean).join(" · ") || " "}</p>
            <div className="mt-auto pt-4">
              {c.enrolled ? (
                <div><div className="mb-1.5 flex justify-between text-xs"><span>{c.completed ? "Completed" : "In progress"}</span><span className="num">{Math.round(c.progress_percent)}%</span></div><ProgressBar value={c.progress_percent} label={c.title} />
                  <Link href={`/learning/${c.id}`} className="mt-3 block rounded-md border border-indigo py-2 text-center text-sm font-medium text-indigo hover:bg-indigo hover:text-white transition-colors focus-ring">{c.completed ? "Review course" : "Continue"}</Link></div>
              ) : (
                <button onClick={() => enrol(c)} disabled={busy === c.id} className="w-full rounded-md bg-indigo py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-dark active:scale-[0.99] disabled:opacity-60 focus-ring">{busy === c.id ? "Enrolling…" : user ? "Enrol for free" : "Sign in to enrol"}</button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
