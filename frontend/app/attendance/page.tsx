"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";
import { downloadFile } from "@/lib/http";
import { useAuth } from "@/lib/auth";
import { STAFF } from "@/lib/roles";
import Card from "@/components/Card";
import { Gate, PageHeader, Btn, Input, Select, Field, Badge, Tabs, Modal, Spinner, ErrorMsg, Notice, Empty, statusTone, fmtDate, fmtTime, today } from "@/components/ui";

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return <div className="overflow-x-auto"><Card className="!p-0 min-w-[560px]"><table className="w-full text-sm"><thead className="text-left text-coop-slate border-b border-black/10"><tr>{head.map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead><tbody>{children}</tbody></table></Card></div>;
}

function MyAttendance() {
  const [recs, setRecs] = useState<any[] | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<any[]>("/api/attendance/mine").then(setRecs).catch((e) => setError(e.message));
    api<any[]>(`/api/attendance/sessions?on=${today()}`).then(setSessions).catch(() => {});
  }, []);
  const hours = (recs || []).reduce((a, r) => a + r.hours, 0);
  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-display text-lg text-indigo">Today</h2>
          {sessions.length === 0 ? <p className="text-sm text-coop-slate">No attendance sessions today.</p> :
            sessions.map((s) => <p key={s.id} className="text-sm">{s.programme_name} · {s.title} <Badge tone={s.is_live ? "green" : "slate"}>{s.is_live ? "Open" : "Closed"}</Badge></p>)}</div>
        <Link href="/attendance/scan" className="rounded-md bg-indigo text-white px-4 py-2 text-sm hover:bg-indigo-dark focus-ring">Scan QR</Link>
      </Card>
      <ErrorMsg error={error} />
      <div className="grid grid-cols-2 gap-4 max-w-md"><Card><p className="text-2xl font-display text-indigo">{recs?.length ?? "—"}</p><p className="text-sm text-coop-slate">Sessions attended</p></Card>
        <Card><p className="text-2xl font-display text-indigo">{hours.toFixed(1)}</p><p className="text-sm text-coop-slate">Hours</p></Card></div>
      <h2 className="font-display text-lg text-indigo">My records</h2>
      {!recs ? <Spinner /> : recs.length === 0 ? <Empty>No attendance yet. Scan the QR shown by your trainer.</Empty> : (
        <Table head={["Date", "Programme", "Session", "In", "Out", "Hours"]}>{recs.map((r) => <tr key={r.id} className="border-b border-black/5 last:border-0"><td className="p-3">{fmtDate(r.session_date)}</td><td>{r.programme_name}</td><td>{r.session_title}</td><td>{fmtTime(r.check_in)}</td><td>{r.check_out ? fmtTime(r.check_out) : <Badge tone="saffron">Not checked out</Badge>}</td><td>{r.hours}</td></tr>)}</Table>)}
    </div>
  );
}

function Manage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("sessions");
  const [progs, setProgs] = useState<any[]>([]);
  const [pid, setPid] = useState("");
  const [sessions, setSessions] = useState<any[] | null>(null);
  const [qr, setQr] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", session_date: today(), duration_minutes: 480 });
  const [records, setRecords] = useState<any[] | null>(null);
  const [day, setDay] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const [report, setReport] = useState<any | null>(null);

  useEffect(() => { api<any[]>("/api/logistics/programmes").then((p) => { setProgs(p); if (p[0]) setPid(p[0].id); }).catch((e) => setError(e.message)); }, []);
  const loadSessions = useCallback(() => { if (pid) api<any[]>(`/api/attendance/sessions?programme_id=${pid}`).then(setSessions).catch((e) => setError(e.message)); }, [pid]);
  useEffect(loadSessions, [loadSessions]);
  useEffect(() => { if (tab === "records" && pid) { setRecords(null); api<any[]>(`/api/attendance/records?programme_id=${pid}`).then(setRecords).catch((e) => setError(e.message)); } }, [tab, pid]);
  useEffect(() => {
    if (!pid || (tab !== "daily" && tab !== "monthly")) return;
    setReport(null);
    api<any>(tab === "daily" ? `/api/attendance/report/daily?programme_id=${pid}&on=${day}` : `/api/attendance/report/monthly?programme_id=${pid}&month=${month}`).then(setReport).catch((e) => setError(e.message));
  }, [tab, pid, day, month]);

  const act = async (fn: () => Promise<any>, msg?: string) => { setError(null); try { const r = await fn(); if (msg) { setOk(msg); setTimeout(() => setOk(null), 2500); } return r; } catch (e: any) { setError(e.message); } };
  const scanUrl = (code: string) => `${window.location.origin}/attendance/scan?code=${code}`;

  return (
    <div>
      <div className="max-w-sm mb-4"><Field label="Programme"><Select value={pid} onChange={(e) => setPid(e.target.value)}>{progs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field></div>
      <div className="space-y-2 mb-4"><ErrorMsg error={error} />{ok && <Notice>{ok}</Notice>}</div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "sessions", label: "Sessions & QR" }, { id: "records", label: "Records" }, { id: "daily", label: "Daily report" }, { id: "monthly", label: "Monthly report" }]} />
      <div className="mt-6">
        {tab === "sessions" && (<div className="space-y-4">
          <Card><h3 className="font-display text-lg text-indigo mb-3">New session</h3>
            <form className="grid sm:grid-cols-4 gap-3 items-end" onSubmit={async (e) => { e.preventDefault(); const r = await act(() => api("/api/attendance/sessions", { method: "POST", body: JSON.stringify({ ...form, programme_id: pid }) }), "Session created"); if (r) { setForm({ ...form, title: "" }); loadSessions(); } }}>
              <div className="sm:col-span-2"><Field label="Title"><Input required minLength={2} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Day 3 attendance" /></Field></div>
              <Field label="Date"><Input type="date" required value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} /></Field>
              <Btn type="submit" disabled={!pid}>Create & open</Btn></form></Card>
          {!sessions ? <Spinner /> : sessions.length === 0 ? <Empty>No sessions yet for this programme.</Empty> : (
            <Table head={["Date", "Session", "Status", "In", "Out", ""]}>{sessions.map((s) => (
              <tr key={s.id} className="border-b border-black/5 last:border-0"><td className="p-3">{fmtDate(s.session_date)}</td><td>{s.title}</td>
                <td><Badge tone={s.is_live ? "green" : "slate"}>{s.is_live ? "Open" : "Closed"}</Badge></td><td>{s.checked_in}</td><td>{s.checked_out}</td>
                <td className="p-2 text-right whitespace-nowrap">{s.is_live && <Btn variant="secondary" onClick={() => setQr(s)}>Show QR</Btn>}{" "}
                  <Btn variant="ghost" onClick={async () => { await act(() => api(`/api/attendance/sessions/${s.id}?is_open=${!s.is_live}`, { method: "PATCH" })); loadSessions(); }}>{s.is_live ? "Close" : "Reopen"}</Btn></td></tr>))}</Table>)}
        </div>)}

        {tab === "records" && (!records ? <Spinner /> : records.length === 0 ? <Empty>No attendance records yet.</Empty> : (
          <Table head={["Date", "Name", "Session", "In", "Out", "Hours", "Method"]}>{records.map((r) => <tr key={r.id} className="border-b border-black/5 last:border-0"><td className="p-3">{fmtDate(r.session_date)}</td><td>{r.user_name} <span className="text-xs text-coop-slate">({r.role})</span></td><td>{r.session_title}</td><td>{fmtTime(r.check_in)}</td><td>{r.check_out ? fmtTime(r.check_out) : "—"}</td><td>{r.hours}</td><td>{r.method}</td></tr>)}</Table>))}

        {tab === "daily" && (<div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3"><Field label="Date"><Input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></Field>
            <Btn variant="secondary" onClick={() => act(() => downloadFile(`/api/attendance/report/daily?programme_id=${pid}&on=${day}&format=csv`, `attendance-${day}.csv`))}>Download CSV</Btn></div>
          {!report ? <Spinner /> : (<>
            <p className="text-sm text-coop-slate">{report.sessions} session(s) · Present {report.summary.present} · Incomplete {report.summary.incomplete} · Absent {report.summary.absent} of {report.summary.total}</p>
            {report.rows.length === 0 ? <Empty>No participants.</Empty> : <Table head={["Name", "Role", "Status", "In", "Out", "Hours"]}>{report.rows.map((r: any) => <tr key={r.user_id} className="border-b border-black/5 last:border-0"><td className="p-3">{r.name}</td><td>{r.role}</td><td><Badge tone={statusTone(r.status)}>{r.status}</Badge></td><td>{fmtTime(r.check_in)}</td><td>{fmtTime(r.check_out)}</td><td>{r.hours}</td></tr>)}</Table>}</>)}
        </div>)}

        {tab === "monthly" && (<div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3"><Field label="Month"><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
            <Btn variant="secondary" onClick={() => act(() => downloadFile(`/api/attendance/report/monthly?programme_id=${pid}&month=${month}&format=csv`, `attendance-${month}.csv`))}>Download CSV</Btn></div>
          {!report ? <Spinner /> : (<>
            <p className="text-sm text-coop-slate">{report.sessions_held} session(s) held in {month}</p>
            {report.rows.length === 0 ? <Empty>No participants.</Empty> : <Table head={["Name", "Role", "Days present", "Hours", "Attendance"]}>{report.rows.map((r: any) => <tr key={r.user_id} className="border-b border-black/5 last:border-0"><td className="p-3">{r.name}</td><td>{r.role}</td><td>{r.days_present}/{r.sessions_held}</td><td>{r.hours}</td>
              <td><div className="flex items-center gap-2"><div className="h-2 w-24 rounded-full bg-black/10"><div className={`h-2 rounded-full ${r.percentage >= 75 ? "bg-coop-green" : "bg-coop-saffron"}`} style={{ width: `${r.percentage}%` }} /></div>{r.percentage}%</div></td></tr>)}</Table>}</>)}
        </div>)}
      </div>

      {qr && (
        <Modal title={qr.title} onClose={() => setQr(null)}>
          <div className="text-center">
            <div className="inline-block rounded-lg bg-white p-3 border border-black/10"><QRCodeSVG value={scanUrl(qr.code)} size={240} includeMargin /></div>
            <p className="text-sm text-coop-slate mt-3">Participants scan to check in, and again to check out.</p>
            <p className="mt-2 font-mono text-sm break-all bg-black/5 rounded px-2 py-1 select-all">{qr.code}</p>
            <div className="flex justify-center gap-2 mt-4">
              <Btn variant="secondary" onClick={async () => { const r = await act(() => api(`/api/attendance/sessions/${qr.id}/rotate`, { method: "POST" }), "New QR issued"); if (r) { setQr(r); loadSessions(); } }}>Refresh QR</Btn>
              <Btn variant="secondary" onClick={() => window.print()}>Print</Btn>
            </div>
          </div>
        </Modal>)}
    </div>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  const staff = !!user && STAFF.includes(user.role);
  return (
    <Gate roles={["super_admin", "institution_admin", "trainer", "trainee"]}>
      <PageHeader title="Attendance" subtitle={staff ? "Open a session, show the QR, and review records and reports." : "Check in and out with the session QR and track your attendance."}
        actions={user?.role === "trainer" && <Link href="/attendance/scan" className="rounded-md border border-black/15 bg-white px-4 py-2 text-sm hover:bg-black/5 focus-ring">Scan my attendance</Link>} />
      {staff ? <Manage /> : <MyAttendance />}
    </Gate>
  );
}
