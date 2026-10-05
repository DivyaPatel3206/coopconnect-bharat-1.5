"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Gate, PageHeader, Btn, Input, Badge, ErrorMsg, Spinner } from "@/components/ui";
import { BarList } from "@/components/charts";
import { AiPanel, AiTag } from "@/components/ai/AiBits";

const EX = ["Show me districts with low training completion", "Which learners are at risk of dropping out?", "Where is the biggest skill gap?", "How is the employment funnel doing?"];

function Admin() {
  const [q, setQ] = useState(""); const [r, setR] = useState<any>(null); const [ov, setOv] = useState<any>(null); const [arch, setArch] = useState<any>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api("/api/ai/admin/overview").then(setOv).catch((e) => setErr(e.message)); api("/api/ai/architecture").then(setArch).catch(() => {}); }, []);
  async function ask(s: string) { if (!s.trim()) return; setQ(s); setBusy(true); setErr(null); try { setR(await api("/api/ai/admin/ask", { method: "POST", body: JSON.stringify({ question: s }) })); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } }
  return (
    <div className="space-y-5">
      <PageHeader title="AI Admin Copilot" subtitle="Ask questions about your training and employment data. Answers are computed from live platform records." />
      <AiPanel title="Ask your data">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(q); }}><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask in natural language…" aria-label="Question" /><Btn type="submit" disabled={busy}>Ask</Btn></form>
        <div className="mt-3 flex flex-wrap gap-2">{EX.map((e) => <button key={e} onClick={() => ask(e)} className="rounded-full border border-black/10 px-3 py-1 text-xs text-indigo hover:bg-indigo hover:text-white focus-ring">{e}</button>)}</div>
        <ErrorMsg error={err} />
        {busy && <Spinner label="Analysing…" />}
        {r && <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div><p className="eyebrow">AI insight · {r.topic}</p><p className="mt-1 text-sm">{r.insight}</p>{r.predicted && <p className="mt-1 text-xs text-coop-saffron">Prediction: an estimate from activity patterns, not a certainty.</p>}
            <p className="eyebrow mt-4">Recommended action</p><p className="mt-1 text-sm">{r.action}</p></div>
          <div>{r.chart && <BarList rows={r.chart.items} unit={r.chart.unit?.startsWith("%") ? "%" : ""} />}
            {r.table && <ul className="space-y-2 text-sm">{r.table.map((t: any) => <li key={t.learner_id + t.course}><b>{t.learner}</b> · {t.course} <Badge tone={t.level === "High" ? "red" : "saffron"}>{t.level}</Badge><span className="block text-xs text-coop-slate">{t.reasons.join(", ")}</span></li>)}</ul>}</div>
        </div>}
        {r && <p className="mt-3 text-[11px] text-coop-slate">{r.notice}</p>}
      </AiPanel>
      {ov && <AiPanel title="AI early warning">
        {ov.at_risk.length === 0 ? <p className="text-sm text-coop-slate">No learners currently flagged.</p> : <>
          <p className="text-sm"><b>{ov.at_risk.length} learner{ov.at_risk.length > 1 ? "s" : ""}</b> may be at risk of dropping out. Recommended action: send a personalised check-in.</p>
          <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="eyebrow"><tr><th className="py-1.5">Learner</th><th>Course</th><th>Risk</th><th>Reasons</th></tr></thead>
            <tbody className="divide-y divide-black/[0.06]">{ov.at_risk.map((t: any) => <tr key={t.learner_id + t.course}><td className="py-2 font-medium">{t.learner}</td><td>{t.course}</td><td><Badge tone={t.level === "High" ? "red" : "saffron"}>{t.level}</Badge></td><td className="text-xs text-coop-slate">{t.reasons.join(", ")}</td></tr>)}</tbody></table></div></>}
        <p className="mt-3 text-[11px] text-coop-slate">Human review required before any action affecting an individual learner.</p>
      </AiPanel>}
      {arch && <AiPanel title="How the AI works" tag={false}>
        <ol className="grid gap-2 md:grid-cols-3">{arch.stages.map((s: any, i: number) => <li key={s.name} className="rounded-md border border-black/10 p-3"><p className="flex items-center justify-between text-sm font-medium"><span><span className="num mr-1.5 text-coop-slate">{i + 1}</span>{s.name}</span><Badge tone={s.status === "live" ? "green" : "saffron"}>{s.status}</Badge></p><p className="mt-1 text-xs text-coop-slate">{s.detail}</p></li>)}</ol>
        <p className="eyebrow mt-5">Responsible AI safeguards</p><ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">{arch.responsible_ai.map((x: string) => <li key={x}>{x}</li>)}</ul></AiPanel>}
    </div>
  );
}
export default function AiAdminPage() { return <Gate roles={["super_admin", "institution_admin"]}><Admin /></Gate>; }
