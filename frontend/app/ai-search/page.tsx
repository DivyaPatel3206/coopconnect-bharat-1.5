"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Gate, PageHeader, Input, Btn, Spinner } from "@/components/ui";
import { AiTag, AskAI } from "@/components/ai/AiBits";

function Search() {
  const [q, setQ] = useState(""); const [d, setD] = useState<any>(null); const [busy, setBusy] = useState(false);
  async function go(s: string) { if (!s.trim()) return; setBusy(true); try { setD(await api(`/api/ai/search?q=${encodeURIComponent(s)}`)); } finally { setBusy(false); } }
  useEffect(() => { const s = new URLSearchParams(window.location.search).get("q"); if (s) { setQ(s); go(s); } }, []);
  return (
    <div>
      <PageHeader title="AI Search" subtitle="Describe what you need in your own words. Results span courses, jobs, programmes, schemes and guidance." />
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); go(q); }}><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="I want a course that helps me get a cooperative banking job" aria-label="Search in natural language" /><Btn type="submit">Search</Btn></form>
      {busy && <Spinner />}
      {d && <div className="mt-6 space-y-6"><p className="text-xs text-coop-slate">Understood as: <b>{d.intent}</b> · {d.method}</p>
        {Object.keys(d.groups).length === 0 && <p className="text-sm text-coop-slate">Nothing relevant found. Try different words, or <AskAI prompt={q} label="ask the Copilot" />.</p>}
        {Object.entries(d.groups).map(([k, items]: any) => <section key={k}><p className="eyebrow mb-2">{k}</p><ul className="space-y-2">{items.map((x: any) => <li key={x.title + x.snippet} className="rounded-md border border-black/[0.09] bg-white p-4"><Link href={x.href} className="font-medium text-indigo hover:underline">{x.title}</Link>{x.demo && <span className="ml-2 text-[10px] uppercase text-coop-slate">demo content</span>}<p className="mt-1 text-sm text-coop-slate">{x.snippet}</p></li>)}</ul></section>)}</div>}
    </div>
  );
}
export default function AiSearchPage() { return <Gate><Search /></Gate>; }
