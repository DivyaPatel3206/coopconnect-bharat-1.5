"use client";
import { useState } from "react";
import { Btn } from "@/components/ui";

export function embedUrl(url: string): { kind: "iframe" | "video"; src: string } {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) return { kind: "iframe", src: `https://www.youtube.com/embed/${u.searchParams.get("v")}` };
    if (u.hostname === "youtu.be") return { kind: "iframe", src: `https://www.youtube.com/embed${u.pathname}` };
    if (u.hostname.includes("youtube.com") && u.pathname.startsWith("/embed/")) return { kind: "iframe", src: url };
    if (u.hostname.includes("vimeo.com") && /^\/\d+$/.test(u.pathname)) return { kind: "iframe", src: `https://player.vimeo.com/video${u.pathname}` };
    if (/\.(mp4|webm|ogg)$/i.test(u.pathname)) return { kind: "video", src: url };
  } catch {}
  return { kind: "iframe", src: url };
}

export function Video({ url }: { url: string }) {
  const e = embedUrl(url);
  return e.kind === "video"
    ? <video controls className="w-full rounded-md bg-black aspect-video" src={e.src} />
    : <div className="aspect-video"><iframe className="w-full h-full rounded-md" src={e.src} title="Lesson video" allowFullScreen allow="accelerometer; encrypted-media; picture-in-picture" /></div>;
}

export function Doc({ url, presentation }: { url: string; presentation?: boolean }) {
  const office = presentation && /\.(pptx?|ppsx)(\?|$)/i.test(url);
  const src = office ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}` : url;
  return (
    <div>
      <iframe src={src} title={presentation ? "Presentation" : "PDF document"} className="w-full h-[70vh] rounded-md border border-black/10 bg-white" />
      <p className="text-xs text-coop-slate mt-2">Not loading? <a className="text-indigo underline focus-ring" href={url} target="_blank" rel="noopener noreferrer">Open in a new tab</a></p>
    </div>
  );
}

function inline(t: string) {
  return t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>));
}
/** Tiny markdown subset (## headings, - lists, **bold**), rendered as React nodes (no HTML injection). */
export function TextLesson({ body }: { body: string }) {
  const out: React.ReactNode[] = []; let list: string[] = [];
  const flush = () => { if (list.length) { out.push(<ul key={out.length} className="list-disc pl-5 space-y-1">{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; } };
  body.split("\n").forEach((line) => {
    if (line.startsWith("- ")) return void list.push(line.slice(2));
    flush();
    if (line.startsWith("## ")) out.push(<h3 key={out.length} className="font-display text-xl text-indigo">{line.slice(3)}</h3>);
    else if (line.trim()) out.push(<p key={out.length}>{inline(line)}</p>);
  });
  flush();
  return <div className="space-y-3 text-sm leading-relaxed">{out}</div>;
}

export function Interactive({ body }: { body: string }) {
  const [i, setI] = useState(0); const [flip, setFlip] = useState(false);
  let data: any;
  try { data = JSON.parse(body); } catch { return <p className="text-sm text-red-600">This lesson content is invalid.</p>; }
  const items: any[] = data.type === "flashcards" ? data.cards : data.steps;
  const cur = items[i];
  const go = (n: number) => { setI(n); setFlip(false); };
  return (
    <div>
      <div className="h-1.5 rounded-full bg-black/10 mb-4"><div className="h-1.5 rounded-full bg-coop-saffron" style={{ width: `${((i + 1) / items.length) * 100}%` }} /></div>
      {data.type === "flashcards" ? (
        <button onClick={() => setFlip(!flip)} aria-label="Flip card" className="w-full min-h-[10rem] rounded-lg border border-black/10 bg-coop-paper p-6 text-center focus-ring">
          <span className="block text-xs text-coop-slate mb-2">{flip ? "Answer" : "Term"} · tap to flip</span>
          <span className={flip ? "text-sm" : "font-display text-2xl text-indigo"}>{flip ? cur.back : cur.front}</span></button>
      ) : (
        <div className="rounded-lg border border-black/10 bg-coop-paper p-6"><h3 className="font-display text-xl text-indigo">{cur.title}</h3><p className="mt-2 text-sm">{cur.content}</p></div>
      )}
      <div className="flex items-center justify-between mt-4"><Btn variant="secondary" disabled={i === 0} onClick={() => go(i - 1)}>Back</Btn>
        <span className="text-sm text-coop-slate">{i + 1} / {items.length}</span><Btn variant="secondary" disabled={i === items.length - 1} onClick={() => go(i + 1)}>Next</Btn></div>
    </div>
  );
}
