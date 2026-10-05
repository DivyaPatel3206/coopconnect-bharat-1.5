"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { apiForm } from "@/lib/http";
import { LANGS } from "@/lib/ai";
import { Gate, PageHeader, Tabs, Btn, Select, Textarea, Input, ErrorMsg, Spinner } from "@/components/ui";
import { Ring } from "@/components/charts";
import { AiPanel, Meter } from "@/components/ai/AiBits";

const TABS = [{ id: "docs", label: "Resume & documents" }, { id: "simplify", label: "Simplify & translate" }, { id: "plan", label: "Study plan" }, { id: "quiz", label: "Practice quiz" }];
const List = ({ items }: { items: string[] }) => <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">{items.map((x) => <li key={x}>{x}</li>)}</ul>;

function Docs() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [r, setR] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState(""); const [a, setA] = useState<string | null>(null);
  async function run() {
    setBusy(true); setErr(null); setR(null); setA(null);
    const f = new FormData(); if (file) f.append("file", file); f.append("text", text);
    try { const x: any = await apiForm("/api/ai/document", f); if (x.error) setErr(x.error); else setR(x); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  const rs = r?.resume;
  return (
    <div className="space-y-5">
      <AiPanel title="Upload → AI processing → structured information">
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="text-sm font-medium" htmlFor="f">Upload a resume, certificate or form (PDF, DOCX, TXT)</label>
            <input id="f" type="file" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-sm" /></div>
          <div><label className="text-sm font-medium" htmlFor="t">…or paste the text</label><Textarea id="t" rows={4} value={text} onChange={(e) => setText(e.target.value)} /></div>
        </div>
        <div className="mt-4 flex items-center gap-3"><Btn onClick={run} disabled={busy || (!file && !text.trim())}>{busy ? "Analysing…" : "Analyse with AI"}</Btn><span className="text-xs text-coop-slate">Processed on the CoopConnect server. Not shared with employers.</span></div>
        <ErrorMsg error={err} />
      </AiPanel>
      {r && (
        <AiPanel title={`Detected: ${r.doc_type}`}>
          <div className="grid gap-5 md:grid-cols-2">
            <div><p className="eyebrow">Summary</p><List items={r.summary.length ? r.summary : ["Too little text to summarise."]} />
              {r.missing.length > 0 && <><p className="eyebrow mt-4">Possibly missing</p><List items={r.missing} /></>}</div>
            <div><p className="eyebrow">Extracted fields</p><dl className="mt-1 space-y-1 text-sm">{Object.entries(r.entities).filter(([, v]: any) => v.length).map(([k, v]: any) => <div key={k} className="flex gap-2"><dt className="w-16 shrink-0 capitalize text-coop-slate">{k}</dt><dd className="min-w-0 break-words">{v.join(", ")}</dd></div>)}</dl></div>
          </div>
          <div className="mt-5 border-t border-black/[0.08] pt-4"><p className="eyebrow mb-1">Ask about this document</p>
            <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); const x: any = await api("/api/ai/document/ask", { method: "POST", body: JSON.stringify({ text: r.text, question: q }) }); setA(x.answer); }}>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. What is the issue date?" aria-label="Question" /><Btn type="submit" disabled={!q.trim()}>Ask</Btn></form>
            {a && <p className="mt-2 rounded bg-coop-paper p-3 text-sm">{a}</p>}</div>
          <p className="mt-3 text-[11px] text-coop-slate">{r.note}</p>
        </AiPanel>)}
      {rs && (
        <AiPanel title="AI resume analysis">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="text-center"><Ring value={rs.score} size={110} label="AI Resume Score" /><p className="mt-2 font-display text-lg text-indigo">AI Resume Score: {rs.score}/100</p></div>
            <div className="space-y-2.5 md:col-span-2">{rs.rubric.map((x: any) => <Meter key={x.label} label={x.label} value={Math.round((100 * x.value) / x.max)} />)}</div>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div><p className="eyebrow">Strengths</p><List items={rs.strengths.length ? rs.strengths : ["Keep building: no category is fully strong yet."]} />
              <p className="eyebrow mt-4">Weaknesses</p><List items={rs.weaknesses.length ? rs.weaknesses : ["None detected."]} />
              <p className="eyebrow mt-4">Missing skills for top jobs</p><p className="mt-1 text-sm">{rs.missing_skills.join(", ") || "None"}</p></div>
            <div><p className="eyebrow">Recommended improvements</p><List items={rs.improvements.length ? rs.improvements : ["Looks solid. Tailor it to each job."]} />
              <p className="eyebrow mt-4">Suitable jobs</p><ul className="mt-1 space-y-1 text-sm">{rs.suitable_jobs.map((j: any) => <li key={j.id}><Link href="/jobs" className="font-medium text-indigo hover:underline">{j.title}</Link> <b className="num text-coop-green">{j.match}%</b></li>)}</ul></div>
          </div>
          <div className="mt-5 rounded-md bg-coop-paper p-4"><p className="eyebrow">Draft summary you can edit (template, not final)</p><p className="mt-1 text-sm">{rs.draft_summary}</p></div>
        </AiPanel>)}
    </div>
  );
}

function Simplify() {
  const [text, setText] = useState("Eligibility shall be determined subject to the applicant's prior residence in the State, notwithstanding any other provision.");
  const [lang, setLang] = useState("en"); const [out, setOut] = useState<any>(null); const [busy, setBusy] = useState(false);
  async function go(mode: string) { setBusy(true); try { setOut(await api("/api/ai/simplify", { method: "POST", body: JSON.stringify({ text, language: lang, mode }) })); } catch (e: any) { setOut({ message: e.message }); } finally { setBusy(false); } }
  return (
    <AiPanel title="Explain simply and translate">
      <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} aria-label="Text" />
      <div className="mt-3 flex flex-wrap items-center gap-2"><Select value={lang} onChange={(e) => setLang(e.target.value)} className="max-w-[10rem]" aria-label="Language">{LANGS.map((l) => <option key={l[0]} value={l[0]}>{l[1]}</option>)}</Select>
        <Btn onClick={() => go("simplify")} disabled={busy}>Explain simply</Btn><Btn variant="secondary" onClick={() => go("translate")} disabled={busy}>Translate</Btn></div>
      {out && <div className="mt-4 rounded-md bg-coop-paper p-4 text-sm"><p className="whitespace-pre-wrap">{out.result || out.message}</p>{out.result && out.message && <p className="mt-2 text-xs text-coop-slate">{out.message}</p>}</div>}
    </AiPanel>
  );
}

function CoursePick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [cs, setCs] = useState<any[]>([]);
  useEffect(() => { api<any[]>("/api/learning/courses").then((c) => { setCs(c); if (c[0] && !value) onChange(c[0].id); }).catch(() => {}); }, []);
  return <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Course" className="max-w-sm">{cs.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>;
}

function Plan() {
  const [cid, setCid] = useState(""); const [days, setDays] = useState(20); const [p, setP] = useState<any>(null); const [err, setErr] = useState<string | null>(null);
  async function go() { setErr(null); try { setP(await api("/api/ai/study-plan", { method: "POST", body: JSON.stringify({ course_id: cid, days }) })); } catch (e: any) { setErr(e.message); } }
  return (
    <AiPanel title="AI study plan generator">
      <div className="flex flex-wrap items-end gap-3"><div><label className="text-sm font-medium">Course</label><CoursePick value={cid} onChange={setCid} /></div>
        <div><label className="text-sm font-medium" htmlFor="d">I have (days)</label><Input id="d" type="number" min={2} max={90} value={days} onChange={(e) => setDays(+e.target.value)} className="w-24" /></div><Btn onClick={go} disabled={!cid}>Generate plan</Btn></div>
      <ErrorMsg error={err} />
      {p && <><p className="mt-4 text-sm text-coop-slate">{p.course}: {p.lessons_done} of {p.lessons_total} lessons done. {p.note}</p>
        <ol className="mt-3 divide-y divide-black/[0.06] rounded-md border border-black/10">{p.plan.map((r: any) => <li key={r.day} className="flex gap-3 px-4 py-2.5 text-sm"><b className="num w-14 shrink-0 text-indigo">Day {r.day}</b><span className={`w-20 shrink-0 text-xs font-semibold uppercase ${r.type === "Learn" ? "text-coop-green" : "text-coop-saffron"}`}>{r.type}</span><span>{r.title}</span></li>)}</ol></>}
    </AiPanel>
  );
}

function Quiz() {
  const [cid, setCid] = useState(""); const [d, setD] = useState<any>(null); const [ans, setAns] = useState<Record<number, number>>({}); const [err, setErr] = useState<string | null>(null);
  async function go() { setErr(null); setAns({}); setD(null); try { setD(await api("/api/ai/quiz", { method: "POST", body: JSON.stringify({ course_id: cid, n: 5 }) })); } catch (e: any) { setErr(e.message); } }
  const score = d ? d.questions.filter((q: any, i: number) => ans[i] === q.correct_index).length : 0;
  return (
    <AiPanel title="Practice quiz from your weak topics">
      <div className="flex flex-wrap items-end gap-3"><div><label className="text-sm font-medium">Course</label><CoursePick value={cid} onChange={setCid} /></div><Btn onClick={go} disabled={!cid}>Generate 5 questions</Btn></div>
      <ErrorMsg error={err} />
      {d && <div className="mt-4">
        <p className="text-sm text-coop-slate">{d.weak_topics.length ? `AI detected weak topic: ${d.weak_topics.join(", ")}.` : `Topic: ${d.topic}.`} Source: {d.mode === "ai_generated" ? "freshly generated by AI" : "course question bank"}.</p>
        {d.message && <p className="mt-2 text-sm">{d.message}</p>}
        <div className="mt-3 space-y-4">{d.questions.map((q: any, i: number) => (
          <fieldset key={i} className="rounded-md border border-black/10 p-4"><legend className="px-1 text-sm font-medium">{i + 1}. {q.prompt}</legend>
            <div className="mt-1 space-y-1">{q.options.map((o: string, k: number) => { const done = ans[i] !== undefined; const right = k === q.correct_index; return (
              <button key={k} disabled={done} onClick={() => setAns({ ...ans, [i]: k })} className={`block w-full rounded border px-3 py-2 text-left text-sm focus-ring ${done ? (right ? "border-coop-green bg-coop-green/10" : ans[i] === k ? "border-red-400 bg-red-50" : "border-black/10") : "border-black/12 hover:bg-black/5"}`}>{o}</button>); })}</div>
            {ans[i] !== undefined && q.explanation && <p className="mt-2 text-xs text-coop-slate"><b>Explain my mistake / answer:</b> {q.explanation}</p>}</fieldset>))}</div>
        {d.questions.length > 0 && Object.keys(ans).length === d.questions.length && <p className="mt-4 font-medium text-indigo">You scored {score} of {d.questions.length}.</p>}</div>}
    </AiPanel>
  );
}

function Studio() {
  const [tab, setTab] = useState("docs");
  useEffect(() => { const t = new URLSearchParams(window.location.search).get("tab"); if (t && TABS.some((x) => x.id === t)) setTab(t); }, []);
  return (
    <div>
      <PageHeader title="AI Studio" subtitle="Tools that read, explain and plan for you: resumes, documents, official language, study schedules and practice." />
      <div className="mb-5"><Tabs tabs={TABS} value={tab} onChange={setTab} /></div>
      {tab === "docs" ? <Docs /> : tab === "simplify" ? <Simplify /> : tab === "plan" ? <Plan /> : <Quiz />}
    </div>
  );
}
export default function AiStudioPage() { return <Gate><Studio /></Gate>; }
