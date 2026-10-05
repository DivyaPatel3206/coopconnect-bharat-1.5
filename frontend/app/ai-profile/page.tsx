"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Gate, PageHeader, Spinner, ErrorMsg, Badge } from "@/components/ui";
import { Ring } from "@/components/charts";
import { AiPanel, Meter, AskAI } from "@/components/ai/AiBits";

function Profile() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api("/api/ai/profile").then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <ErrorMsg error={err} />;
  if (!d) return <Spinner />;
  const b = d.behaviour;
  return (
    <div>
      <PageHeader title="My AI Profile" subtitle="A living picture of your skills, learning and opportunities, rebuilt from your real activity every time you open it."
        actions={<AskAI prompt="How can I improve my employability?" label="How can I improve my employability?" />} />
      <div className="grid gap-5 lg:grid-cols-3">
        <AiPanel title="Employment readiness" className="lg:col-span-1">
          <div className="flex items-center gap-5"><Ring value={d.readiness.score} size={96} label="Employment readiness" /><p className="text-sm">{d.explanation}</p></div>
          <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium text-indigo">How is this calculated?</summary>
            <ul className="mt-2 space-y-1 text-xs text-coop-slate">{d.readiness.breakdown.map((x: any) => <li key={x.label} className="flex justify-between"><span>{x.label} (weight {Math.round(x.weight * 100)}%)</span><b className="num">{x.value}%</b></li>)}</ul>
            <p className="mt-2 text-[11px] text-coop-slate">An estimate to guide you, not an official assessment.</p></details>
        </AiPanel>
        <AiPanel title="AI skill map" className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">{d.skills.map((s: any) => <Meter key={s.name} label={s.name} value={s.score} hint={s.evidence[0] || "Add skills or finish a related course to see this."} />)}</div>
        </AiPanel>
        <AiPanel title="Strengths and gaps">
          <p className="eyebrow">Strengths</p><div className="mt-1 flex flex-wrap gap-1.5">{d.strengths.length ? d.strengths.map((x: string) => <Badge key={x} tone="green">{x}</Badge>) : <span className="text-sm text-coop-slate">Build a skill above 70% to list it here.</span>}</div>
          <p className="eyebrow mt-4">Needs work</p><div className="mt-1 flex flex-wrap gap-1.5">{d.weaknesses.map((x: string) => <Badge key={x} tone="saffron">{x}</Badge>)}</div>
          <p className="eyebrow mt-4">Skill gaps for roles you match</p><p className="mt-1 text-sm">{d.gaps.join(", ") || "None detected"}</p>
        </AiPanel>
        <AiPanel title="Learning behaviour">
          <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="eyebrow">Courses started</dt><dd className="num text-xl">{b.courses_started}</dd></div><div><dt className="eyebrow">Completed</dt><dd className="num text-xl">{b.courses_completed}</dd></div>
            <div><dt className="eyebrow">Quiz attempts</dt><dd className="num text-xl">{b.quiz_attempts}</dd></div><div><dt className="eyebrow">Applications</dt><dd className="num text-xl">{b.applications}</dd></div></dl>
          {b.weak_topics.length > 0 && <p className="mt-3 text-sm"><b>Weak topic:</b> {b.weak_topics[0].lesson} ({b.weak_topics[0].score}%) <Link href="/ai-studio?tab=quiz" className="text-indigo underline">Practise</Link></p>}
        </AiPanel>
        <AiPanel title="Suggested next step">
          <p className="font-medium text-indigo">{d.next.label}</p><p className="mt-1 text-sm text-coop-slate">{d.next.why}</p>
          <Link href={d.next.href} className="mt-4 inline-block rounded-md bg-indigo px-4 py-2 text-sm font-medium text-white hover:bg-indigo-dark focus-ring">Continue</Link>
          <p className="mt-3 text-xs"><Link href="/career-path" className="text-indigo underline">See my full career roadmap</Link></p>
        </AiPanel>
        <AiPanel title="Career recommendations" className="lg:col-span-3">
          <div className="grid gap-4 md:grid-cols-3">{d.career.map((j: any) => (
            <div key={j.id} className="rounded-md border border-black/10 p-4"><div className="flex justify-between gap-2"><p className="font-medium">{j.title}</p><b className="num text-coop-green">{j.match}%</b></div>
              <p className="text-xs text-coop-slate">{j.company}</p>
              <ul className="mt-2 text-xs text-coop-green">{j.reasons.slice(0, 3).map((r: string) => <li key={r}>✓ {r}</li>)}</ul>
              {j.missing.length > 0 && <p className="mt-1 text-xs"><b>Missing:</b> {j.missing.join(", ")}</p>}
              {j.fix && <Link href={`/learning/${j.fix.course_id}`} className="mt-2 inline-block text-xs font-medium text-indigo underline">Improve match: {j.fix.title}</Link>}</div>))}</div>
        </AiPanel>
      </div>
      <p className="mt-6 text-xs text-coop-slate">Your profile data is used only to personalise your own experience on CoopConnect. AI-generated insights are estimates and do not replace decisions by institutions or employers.</p>
    </div>
  );
}
export default function AiProfilePage() { return <Gate><Profile /></Gate>; }
