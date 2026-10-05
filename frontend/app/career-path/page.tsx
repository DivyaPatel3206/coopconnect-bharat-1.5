"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Gate, PageHeader, Select, Spinner, ErrorMsg } from "@/components/ui";
import { AiTag, AskAI } from "@/components/ai/AiBits";

function Step({ n, title, last, children }: { n: number; title: string; last?: boolean; children: React.ReactNode }) {
  return (
    <li className="relative flex gap-4 pb-6">
      {!last && <span className="absolute left-[15px] top-8 h-full w-px bg-indigo/20" aria-hidden />}
      <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo text-sm font-semibold text-white">{n}</span>
      <div className="min-w-0 flex-1 rounded-lg border border-black/[0.09] bg-white p-4"><p className="eyebrow">{title}</p><div className="mt-1.5 text-sm">{children}</div></div>
    </li>
  );
}

function Path() {
  const [goals, setGoals] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api<any>("/api/ai/career-path").then((r) => { setGoals(r.goals); setGoal(r.goals[0]); }).catch((e) => setErr(e.message)); }, []);
  useEffect(() => { if (goal) { setD(null); api(`/api/ai/career-path?goal=${encodeURIComponent(goal)}`).then(setD).catch((e) => setErr(e.message)); } }, [goal]);
  return (
    <div>
      <PageHeader title="Career path" subtitle="Pick a goal. The roadmap compares it with the skills you actually have." actions={<AskAI prompt="What should I do next for my career goal?" label="What should I do next?" />} />
      <div className="mb-6 flex flex-wrap items-center gap-3"><label className="text-sm font-medium" htmlFor="goal">My goal</label>
        <Select id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} className="max-w-xs">{goals.map((g) => <option key={g}>{g}</option>)}</Select><AiTag /></div>
      <ErrorMsg error={err} />
      {!d && !err ? <Spinner /> : d && (
        <ol className="max-w-3xl">
          <Step n={1} title="Skills you have today">{d.have.length ? d.have.map((s: string) => <span key={s} className="mr-1.5 inline-block rounded bg-coop-green/10 px-2 py-0.5 text-xs font-medium text-coop-green">{s}</span>) : <span className="text-coop-slate">None of the required skills are on your profile yet.</span>}
            <p className="mt-2 text-xs text-coop-slate">Goal readiness: <b>{d.readiness}%</b> of required skills covered.</p></Step>
          <Step n={2} title="Skill gap">{d.gap.length ? d.gap.map((s: string) => <span key={s} className="mr-1.5 inline-block rounded bg-coop-saffron/15 px-2 py-0.5 text-xs font-medium text-[#9a5b10]">{s}</span>) : "No gaps. You already cover the core skills."}</Step>
          <Step n={3} title="Recommended courses"><ul className="space-y-1">{d.courses.map((c: any) => <li key={c.skill}>{c.course_id ? <Link href={`/learning/${c.course_id}`} className="font-medium text-indigo hover:underline">{c.title}</Link> : <span className="text-coop-slate">No course yet for “{c.skill}”</span>} <span className="text-xs text-coop-slate">for {c.skill}</span></li>)}</ul></Step>
          <Step n={4} title="Certifications">{d.certifications.map((c: any) => <p key={c.title}>{c.title}</p>)}</Step>
          <Step n={5} title="Projects">{d.projects.map((p: string) => <p key={p}>• {p}</p>)}</Step>
          <Step n={6} title="Internships">{d.internships.map((i: any) => <p key={i.title}>{i.href ? <Link href={i.href} className="text-indigo hover:underline">{i.title}</Link> : i.title}</p>)}</Step>
          <Step n={7} title="Target jobs" last>{d.jobs.length ? d.jobs.map((j: any) => <p key={j.title}><Link href={j.href} className="text-indigo hover:underline">{j.title}</Link></p>) : <span className="text-coop-slate">No matching openings right now. Check back soon.</span>}</Step>
        </ol>)}
      <p className="text-xs text-coop-slate">This roadmap is a suggestion built from your profile and the platform catalogue. It is not an official career assessment.</p>
    </div>
  );
}
export default function CareerPathPage() { return <Gate><Path /></Gate>; }
