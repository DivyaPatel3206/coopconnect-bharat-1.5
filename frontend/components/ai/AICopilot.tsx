"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { LANGS } from "@/lib/ai";
import Icon from "@/components/Icon";
import { AiTag, Conf } from "./AiBits";

type Src = { n: number; title: string; kind: string; snippet: string; href: string; demo: boolean };
type Fu = { label: string; prompt?: string; href?: string };
type Msg = { role: "user" | "assistant"; content: string; sources?: Src[]; confidence?: string; followups?: Fu[]; mode?: string; extra?: string };

const CONTEXT: [string, string[]][] = [
  ["/courses", ["Which course should I take next?", "Which courses help me get a cooperative banking job?"]],
  ["/learning", ["Explain this topic like I'm a beginner", "Quiz me on what I just studied"]],
  ["/jobs", ["Which jobs match my skills?", "What skills should I learn to improve my match?"]],
  ["/programmes", ["Which programmes are relevant to me?", "How do I register for a programme?"]],
  ["/certificates", ["How are certificates verified?"]],
  ["/profile", ["How can I improve my employability?"]],
  ["/analytics", ["Explain what these trends mean"]],
];
const DEFAULT = ["What should I do next?", "Which schemes may suit me?", "How do I get a certificate?"];

export default function AICopilot() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState("en");
  const [listening, setListening] = useState(false);
  const [openSrc, setOpenSrc] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const SR: any = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  const tag = LANGS.find((l) => l[0] === lang)?.[2] || "en-IN";
  const suggestions = useMemo(() => CONTEXT.find(([p]) => path.startsWith(p))?.[1] || DEFAULT, [path]);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy, open]);
  useEffect(() => {
    const h = (e: Event) => { setOpen(true); send((e as CustomEvent).detail); };
    window.addEventListener("coopconnect:ask", h);
    return () => window.removeEventListener("coopconnect:ask", h);
  });

  async function send(m: string) {
    const message = (m || "").trim();
    if (!message || busy) return;
    setText(""); setBusy(true);
    const history = msgs.slice(-6).map((x) => ({ role: x.role, content: x.content }));
    setMsgs((x) => [...x, { role: "user", content: message }]);
    try {
      const r: any = await api("/api/ai/copilot", { method: "POST", body: JSON.stringify({ message, language: lang, page: path, history }) });
      setMsgs((x) => [...x, { role: "assistant", content: r.answer, sources: r.sources, confidence: r.confidence, followups: r.followups, mode: r.mode }]);
    } catch (e: any) { setMsgs((x) => [...x, { role: "assistant", content: `Sorry, I could not reach the assistant (${e.message}).`, confidence: "low" }]); }
    finally { setBusy(false); }
  }
  async function transform(i: number, mode: "simplify" | "translate") {
    try {
      const r: any = await api("/api/ai/simplify", { method: "POST", body: JSON.stringify({ text: msgs[i].content, language: lang, mode }) });
      setMsgs((x) => x.map((m, k) => (k === i ? { ...m, extra: r.result || r.message } : m)));
    } catch (e: any) { setMsgs((x) => x.map((m, k) => (k === i ? { ...m, extra: e.message } : m))); }
  }
  function listen() {
    if (!SR) return;
    const r = new SR(); r.lang = tag; r.interimResults = false;
    r.onresult = (e: any) => { setListening(false); send(e.results[0][0].transcript); };
    r.onerror = () => setListening(false); r.onend = () => setListening(false);
    setListening(true); r.start();
  }
  function speak(t: string) { const u = new SpeechSynthesisUtterance(t); u.lang = tag; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); }

  if (!open) return (
    <button onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-indigo px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-indigo-dark transition-colors focus-ring print:hidden" aria-label="Open CoopConnect AI">
      <Icon name="spark" size={16} />Ask CoopConnect AI</button>
  );
  return (
    <div role="dialog" aria-label="CoopConnect AI Copilot" className="fade-in fixed inset-x-0 bottom-0 z-50 flex h-[88vh] flex-col rounded-t-xl border border-black/10 bg-white shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:h-[min(640px,85vh)] sm:w-[420px] sm:rounded-xl print:hidden">
      <div className="flex items-center justify-between border-b border-black/[0.08] px-4 py-3">
        <div><p className="flex items-center gap-2 font-display text-base font-semibold text-indigo">CoopConnect AI <AiTag>Copilot</AiTag></p>
          <p className="text-[11px] text-coop-slate">Answers come from CoopConnect sources and your profile.</p></div>
        <div className="flex items-center gap-1.5">
          <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language" className="rounded border border-black/12 bg-white px-1.5 py-1 text-xs focus-ring">{LANGS.map((l) => <option key={l[0]} value={l[0]}>{l[1]}</option>)}</select>
          <button onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1.5 hover:bg-black/5 focus-ring"><Icon name="x" size={18} /></button>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {msgs.length === 0 && (
          <div><p className="text-sm text-coop-slate">Ask about courses, jobs, schemes, certificates or your next step. In Hindi or Gujarati too.</p>
            <div className="mt-3 flex flex-wrap gap-2">{suggestions.map((s) => <button key={s} onClick={() => send(s)} className="rounded-full border border-black/10 px-3 py-1.5 text-left text-xs text-indigo hover:bg-indigo hover:text-white transition-colors focus-ring">{s}</button>)}</div></div>)}
        {msgs.map((m, i) => m.role === "user" ? (
          <div key={i} className="flex justify-end"><div className="max-w-[85%] rounded-lg bg-indigo px-3.5 py-2 text-sm text-white">{m.content}</div></div>
        ) : (
          <div key={i} className="rounded-lg border border-black/10 bg-coop-paper/60 p-3.5">
            <div className="mb-1.5 flex flex-wrap items-center gap-2"><AiTag>AI answer</AiTag>{m.confidence && <Conf level={m.confidence} />}</div>
            <p className="whitespace-pre-wrap text-sm text-coop-ink">{m.content}</p>
            {m.extra && <p className="mt-2 whitespace-pre-wrap rounded border border-black/10 bg-white p-2 text-sm">{m.extra}</p>}
            {m.sources && m.sources.length > 0 && (
              <div className="mt-3 border-t border-black/[0.08] pt-2"><p className="eyebrow mb-1">Sources</p>
                <ul className="space-y-1">{m.sources.map((s) => { const k = `${i}-${s.n}`; return (
                  <li key={k} className="text-xs"><div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate"><b>[S{s.n}]</b> {s.title} <span className="text-coop-slate">· {s.kind}{s.demo ? " · demo content" : ""}</span></span>
                    <button onClick={() => setOpenSrc(openSrc === k ? null : k)} className="shrink-0 font-medium text-indigo hover:underline focus-ring">{openSrc === k ? "Hide" : "View source"}</button></div>
                    {openSrc === k && <div className="mt-1 rounded border border-black/10 bg-white p-2 text-coop-slate">“{s.snippet}” <Link href={s.href} className="font-medium text-indigo hover:underline">Open page</Link></div>}</li>); })}</ul></div>)}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {m.followups?.map((f) => f.href ? <Link key={f.label} href={f.href} onClick={() => setOpen(false)} className="rounded-full border border-indigo/25 px-2.5 py-1 text-xs text-indigo hover:bg-indigo hover:text-white focus-ring">{f.label}</Link>
                : <button key={f.label} onClick={() => send(f.prompt!)} className="rounded-full border border-indigo/25 px-2.5 py-1 text-xs text-indigo hover:bg-indigo hover:text-white focus-ring">{f.label}</button>)}
              <button onClick={() => transform(i, "simplify")} className="rounded-full border border-black/12 px-2.5 py-1 text-xs hover:bg-black/5 focus-ring">Simplify</button>
              <button onClick={() => transform(i, "translate")} className="rounded-full border border-black/12 px-2.5 py-1 text-xs hover:bg-black/5 focus-ring">Translate to {LANGS.find((l) => l[0] === lang)?.[1]}</button>
              {canSpeak && <button onClick={() => speak(m.extra || m.content)} className="inline-flex items-center gap-1 rounded-full border border-black/12 px-2.5 py-1 text-xs hover:bg-black/5 focus-ring"><Icon name="speaker" size={12} />Listen</button>}
            </div>
            <p className="mt-2 text-[10.5px] text-coop-slate">AI-generated guidance, not an official decision. Check details with your institution.</p>
          </div>))}
        {busy && <p className="text-sm text-coop-slate" role="status">Searching CoopConnect sources…</p>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex items-center gap-2 border-t border-black/[0.08] p-3">
        {SR && <button type="button" onClick={listen} aria-label="Ask by voice" className={`rounded-md border p-2 focus-ring ${listening ? "border-coop-saffron bg-coop-saffron/15" : "border-black/12 hover:bg-black/5"}`}><Icon name="mic" size={16} /></button>}
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} aria-label="Your question" placeholder={listening ? "Listening…" : "Ask anything about CoopConnect"} className="min-w-0 flex-1 rounded-md border border-black/12 px-3 py-2 text-sm focus-ring" />
        <button disabled={busy || !text.trim()} className="rounded-md bg-indigo p-2.5 text-white hover:bg-indigo-dark disabled:opacity-50 focus-ring" aria-label="Send"><Icon name="send" size={16} /></button>
      </form>
    </div>
  );
}
