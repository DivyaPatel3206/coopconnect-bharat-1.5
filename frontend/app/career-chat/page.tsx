"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import Card from "@/components/Card";
import { Gate, PageHeader, Btn, Input, ErrorMsg, Spinner } from "@/components/ui";

type Msg = { id?: string; role: "user" | "assistant"; content: string };
const SUGGESTIONS = ["Which jobs match my skills?", "Any internships for me?", "What skills should I learn next?", "How can I start a cooperative business?", "Which training programmes are coming up?"];

function Chat() {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { api<Msg[]>("/api/chat/history").then(setMsgs).catch((e) => { setError(e.message); setMsgs([]); }); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  async function send(m: string) {
    const message = m.trim();
    if (!message || busy) return;
    setText(""); setError(null); setBusy(true);
    setMsgs((x) => [...(x || []), { role: "user", content: message }]);
    try { const r = await api<{ reply: string }>("/api/chat", { method: "POST", body: JSON.stringify({ message }) }); setMsgs((x) => [...(x || []), { role: "assistant", content: r.reply }]); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Career counsellor" subtitle="Ask about jobs, internships, skills, training and starting your own venture. Advice uses your profile, skills and training."
        actions={msgs && msgs.length > 0 && <Btn variant="secondary" onClick={() => confirm("Clear this conversation?") && api("/api/chat/history", { method: "DELETE" }).then(() => setMsgs([])).catch((e) => setError(e.message))}>Clear chat</Btn>} />
      <Card className="!p-0 flex flex-col h-[65vh] min-h-[420px]">
        <div className="flex-1 overflow-y-auto p-4 space-y-3" aria-live="polite">
          {!msgs ? <Spinner /> : msgs.length === 0 && (
            <div className="text-center py-8"><p className="text-coop-slate mb-4">Hi! I'm Saarthi. Try one of these:</p>
              <div className="flex flex-wrap justify-center gap-2">{SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm text-indigo hover:bg-indigo hover:text-white transition-colors focus-ring">{s}</button>)}</div></div>)}
          {msgs?.map((m, i) => (
            <div key={m.id || i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-indigo text-white" : "bg-coop-paper border border-black/10 text-coop-ink"}`}>{m.content}</div></div>))}
          {busy && <p className="text-sm text-coop-slate" role="status">Saarthi is thinking…</p>}
          <div ref={end} />
        </div>
        <div className="border-t border-black/10 p-3">
          <ErrorMsg error={error} />
          <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex gap-2 mt-1">
            <Input aria-label="Your message" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="Type your question…" />
            <Btn type="submit" disabled={busy || !text.trim()}>Send</Btn></form>
          <p className="text-xs text-coop-slate mt-2">AI guidance is general advice. Check job and programme details on their pages before you decide.</p>
        </div>
      </Card>
    </div>
  );
}
export default function CareerChatPage() { return <Gate roles={["trainee", "trainer", "career_counselor", "super_admin", "institution_admin"]}><Chat /></Gate>; }
