"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AiPanel, AskAI, Why } from "./AiBits";

export function AiInsights() {
  const [d, setD] = useState<any>(null);
  const [n, setN] = useState<any[]>([]);
  useEffect(() => { api("/api/ai/insights").then(setD).catch(() => {}); api<any[]>("/api/ai/notifications").then(setN).catch(() => {}); }, []);
  if (!d) return null;
  return (
    <AiPanel title="AI Insights" className="mt-6" action={<AskAI prompt="What should I do next?" label="What should I do next?" />}>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {d.insights.length === 0 && <p className="text-sm text-coop-slate">Start a course or add skills to your profile and insights will appear here.</p>}
          {d.insights.map((x: any) => <div key={x.title} className="border-l-2 border-coop-saffron pl-3"><p className="eyebrow">{x.title}</p><p className="mt-0.5 text-sm">{x.text} {x.href && <Link href={x.href} className="font-medium text-indigo hover:underline">Practise</Link>}</p></div>)}
          {n.length > 0 && <div className="pt-1"><p className="eyebrow mb-1.5">Recommended for you</p>{n.slice(0, 2).map((x) => <Link key={x.title} href={x.href} className="block py-1 text-sm hover:text-indigo"><b className="font-medium">{x.title}</b><Why>{x.text.replace(/^Recommended because it /, "it ")}</Why></Link>)}</div>}
        </div>
        <div className="rounded-md bg-coop-paper p-4"><p className="eyebrow">Suggested next step</p><p className="mt-1 font-medium text-indigo">{d.next.label}</p><p className="mt-1 text-xs text-coop-slate">{d.next.why}</p>
          <Link href={d.next.href} className="mt-3 inline-block rounded-md bg-indigo px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-dark focus-ring">Continue with AI guidance</Link></div>
      </div>
    </AiPanel>
  );
}

export function AiJobMatches() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { api("/api/ai/recommendations").then(setD).catch(() => {}); }, []);
  if (!d || !d.jobs?.length) return null;
  return (
    <AiPanel title="AI job matching" className="mt-6" action={<AskAI prompt="Which jobs match my skills and how can I improve?" label="Ask AI" />}>
      <ul className="grid gap-4 md:grid-cols-3">{d.jobs.slice(0, 3).map((j: any) => (
        <li key={j.id} className="rounded-md border border-black/10 p-4">
          <div className="flex items-start justify-between gap-2"><p className="font-medium">{j.title}</p><span className="num rounded bg-coop-green/10 px-1.5 py-0.5 text-sm font-semibold text-coop-green">{j.match}%</span></div>
          <p className="text-xs text-coop-slate">{j.company}{j.location ? ` · ${j.location}` : ""}</p>
          <ul className="mt-2 space-y-0.5 text-xs">{j.reasons.slice(0, 3).map((r: string) => <li key={r} className="text-coop-green">✓ {r}</li>)}</ul>
          {j.missing.length > 0 && <p className="mt-1.5 text-xs"><b>Missing:</b> {j.missing.slice(0, 2).join(", ")}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {j.fix && <Link href={`/learning/${j.fix.course_id}`} className="rounded-md bg-indigo px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-dark focus-ring">Improve match</Link>}
            <AskAI prompt={`Am I eligible for ${j.title} at ${j.company}?`} label="Am I eligible?" /></div>
        </li>))}</ul>
      <p className="mt-3 text-[11px] text-coop-slate">Match = share of required skills found in your skills and certificates. Employers make the final decision.</p>
    </AiPanel>
  );
}
