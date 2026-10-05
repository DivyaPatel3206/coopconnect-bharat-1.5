"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import Card from "@/components/Card";
import { Gate, PageHeader, Btn, Input, Field, ErrorMsg, Badge, fmtTime } from "@/components/ui";

function extractCode(raw: string): string {
  try { const c = new URL(raw).searchParams.get("code"); if (c) return c; } catch {}
  return raw.trim();
}

function Scanner() {
  const params = useSearchParams();
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const [cameraErr, setCameraErr] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const auto = useRef(false);

  const submit = useCallback(async (raw: string) => {
    const code = extractCode(raw);
    if (!code || busy) return;
    setBusy(true); setError(null); setResult(null);
    try { setResult(await api("/api/attendance/scan", { method: "POST", body: JSON.stringify({ code }) })); setCamera(false); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }, [busy]);

  useEffect(() => {
    const c = params.get("code");
    if (c && !auto.current) { auto.current = true; submit(c); }
  }, [params, submit]);

  useEffect(() => {
    if (!camera) return;
    let stream: MediaStream | null = null; let stop = false;
    (async () => {
      const BD = (window as any).BarcodeDetector;
      if (!BD) { setCameraErr("Live scanning isn't supported in this browser. Use your phone's camera app to scan the QR, or type the code."); setCamera(false); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (video.current) { video.current.srcObject = stream; await video.current.play(); }
        const det = new BD({ formats: ["qr_code"] });
        const tick = async () => {
          if (stop || !video.current) return;
          try { const r = await det.detect(video.current); if (r[0]?.rawValue) { stop = true; submit(r[0].rawValue); return; } } catch {}
          setTimeout(tick, 300);
        };
        tick();
      } catch { setCameraErr("Camera access was blocked. Allow it in your browser, or type the code."); setCamera(false); }
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [camera, submit]);

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="Scan attendance QR" subtitle="Scan once to check in, and again later to check out." />
      {result && (
        <Card className="border-coop-green/40 bg-coop-green/5 mb-4" >
          <p className="font-display text-xl text-coop-green">{result.action === "check_in" ? "Checked in ✓" : "Checked out ✓"}</p>
          <p className="text-sm mt-1">{result.session.programme_name} · {result.session.title}</p>
          <p className="text-sm text-coop-slate">In: {fmtTime(result.record.check_in)} {result.record.check_out && <>· Out: {fmtTime(result.record.check_out)}</>}</p>
          <Link href="/attendance" className="text-sm text-indigo underline focus-ring inline-block mt-2">View my attendance</Link>
        </Card>)}
      <ErrorMsg error={error} />
      {busy && <p className="text-sm text-coop-slate my-3" role="status">Recording attendance…</p>}
      <Card className="mt-4 space-y-4">
        {camera ? (<div><video ref={video} muted playsInline className="w-full rounded-md bg-black aspect-square object-cover" aria-label="Camera preview" /><Btn variant="secondary" className="mt-2" onClick={() => setCamera(false)}>Stop camera</Btn></div>)
          : <Btn onClick={() => { setCameraErr(null); setCamera(true); }}>Scan with camera</Btn>}
        {cameraErr && <p className="text-sm text-coop-slate">{cameraErr}</p>}
        <form onSubmit={(e) => { e.preventDefault(); submit(manual); }} className="flex gap-2 items-end">
          <div className="flex-1"><Field label="Or enter the code shown under the QR"><Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="e.g. Xk3J9…" autoCapitalize="off" /></Field></div>
          <Btn type="submit" disabled={busy || !manual.trim()}>Submit</Btn>
        </form>
      </Card>
    </div>
  );
}

export default function ScanPage() {
  return <Gate roles={["trainee", "trainer"]}><Suspense fallback={<p className="text-sm text-coop-slate">Loading…</p>}><Scanner /></Suspense></Gate>;
}
