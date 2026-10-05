"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { clean, downloadFile } from "@/lib/http";
import { useAuth } from "@/lib/auth";
import { STAFF, ADMINS } from "@/lib/roles";
import Card from "@/components/Card";
import { Gate, PageHeader, Btn, Input, Select, Textarea, Field, Badge, Tabs, Modal, Spinner, ErrorMsg, Notice, Empty, statusTone, fmtDate, today } from "@/components/ui";

type A = any;
const KINDS = ["transport", "meal", "equipment", "other"];

function useLoad<T>(path: string | null, deps: any[] = []) {
  const [d, setD] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => { if (path) api<T>(path).then(setD).catch((e) => setErr(e.message)); }, [path]);
  useEffect(() => { setD(null); load(); }, [load, ...deps]);
  return { d, err, reload: load, setErr };
}

function Timetable({ pid, staff, admin }: { pid: string; staff: boolean; admin: boolean }) {
  const { d, err, reload } = useLoad<A[]>(pid ? `/api/logistics/timetable?programme_id=${pid}` : null);
  const venues = useLoad<A[]>(staff ? "/api/logistics/venues" : null);
  const [edit, setEdit] = useState<A | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cal = useLoad<A>("/api/calendar/status");
  const [notifyUsers, setNotifyUsers] = useState(true);
  const [info, setInfo] = useState<string | null>(null);
  const flashInfo = (m: string) => { setInfo(m); setTimeout(() => setInfo(null), 4000); };
  const days: Record<string, A[]> = {};
  (d || []).forEach((e) => (days[e.session_date] ||= []).push(e));

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    const { id, venue_name, programme_name, ...body } = edit;
    try { await api(id ? `/api/logistics/timetable/${id}?notify_users=${notifyUsers}` : `/api/logistics/timetable?notify_users=${notifyUsers}`, { method: id ? "PUT" : "POST", body: JSON.stringify(clean({ ...body, programme_id: pid })) }); setEdit(null); reload(); }
    catch (x: any) { setError(x.message); } finally { setBusy(false); }
  }
  const s = (k: string, v: string) => setEdit({ ...edit, [k]: v });
  return (
    <div className="space-y-4">
      <Card className="!p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2"><Badge tone={cal.d?.google_configured ? "green" : "slate"}>Google Calendar {cal.d?.google_configured ? "connected" : "not connected"}</Badge>
            <Badge tone={cal.d?.email_configured ? "green" : "slate"}>Email alerts {cal.d?.email_configured ? "on" : "off"}</Badge></div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Btn variant="secondary" onClick={() => downloadFile(`/api/calendar/ics?programme_id=${pid}`, "coopconnect-timetable.ics").then(() => flashInfo("Downloaded. Open the file to add it to Google, Outlook or Apple Calendar.")).catch((x) => setError(x.message))}>Add to my calendar (.ics)</Btn>
            {staff && cal.d?.google_configured && <Btn variant="secondary" onClick={() => api<A>(`/api/calendar/sync/${pid}`, { method: "POST" }).then((r) => flashInfo(`Synced ${r.synced} session(s) to Google Calendar`)).catch((x) => setError(x.message))}>Sync to Google Calendar</Btn>}
            {admin && cal.d?.email_configured && <Btn variant="ghost" onClick={() => api<A>("/api/calendar/test-email", { method: "POST" }).then((r) => flashInfo(`Test email sent to ${r.sent_to}`)).catch((x) => setError(x.message))}>Send test email</Btn>}
          </div>
        </div>
        {staff && !cal.d?.google_configured && <p className="mt-2 text-xs text-coop-slate">Tip: ask your administrator to set the Google Calendar and email variables on the server to sync sessions automatically and email participants.</p>}
        {info && <p role="status" className="mt-2 text-sm text-coop-green">{info}</p>}
      </Card>
      {staff && <Btn onClick={() => setEdit({ title: "", topic: "", session_date: today(), start_time: "09:30", end_time: "11:00", trainer_name: "", venue_id: "", notes: "" })}>Add session</Btn>}
      <ErrorMsg error={err || (!edit ? error : null)} />
      {!d ? <Spinner /> : d.length === 0 ? <Empty>No timetable published for this programme.</Empty> :
        Object.entries(days).map(([day, list]) => (
          <div key={day}><h3 className="font-display text-lg text-indigo mb-2">{new Date(day + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}{day === today() && <> <Badge tone="saffron">Today</Badge></>}</h3>
            <div className="grid md:grid-cols-3 gap-3">{list.map((e) => (
              <Card key={e.id} className="!p-4"><p className="text-xs font-medium text-coop-saffron">{e.start_time} – {e.end_time}</p><p className="font-medium text-indigo">{e.title}</p>
                <p className="text-sm text-coop-slate">{[e.trainer_name, e.venue_name].filter(Boolean).join(" · ") || "—"}</p>{e.notes && <p className="text-xs text-coop-slate mt-1">{e.notes}</p>}
                {staff && <div className="mt-2 flex gap-2"><Btn variant="secondary" onClick={() => setEdit({ ...e, topic: e.topic || "", trainer_name: e.trainer_name || "", venue_id: e.venue_id || "", notes: e.notes || "" })}>Edit</Btn>
                  <Btn variant="ghost" onClick={() => confirm("Delete this session?") && api(`/api/logistics/timetable/${e.id}?notify_users=true`, { method: "DELETE" }).then(reload).catch((x) => setError(x.message))}>Delete</Btn></div>}</Card>))}</div></div>))}
      {edit && (
        <Modal title={edit.id ? "Edit session" : "Add session"} onClose={() => setEdit(null)}>
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Field label="Title"><Input required minLength={2} value={edit.title} onChange={(e) => s("title", e.target.value)} /></Field></div>
            <Field label="Date"><Input type="date" required value={edit.session_date} onChange={(e) => s("session_date", e.target.value)} /></Field>
            <Field label="Trainer"><Input value={edit.trainer_name} onChange={(e) => s("trainer_name", e.target.value)} /></Field>
            <Field label="Start"><Input type="time" required value={edit.start_time} onChange={(e) => s("start_time", e.target.value)} /></Field>
            <Field label="End"><Input type="time" required value={edit.end_time} onChange={(e) => s("end_time", e.target.value)} /></Field>
            <div className="col-span-2"><Field label="Venue"><Select value={edit.venue_id} onChange={(e) => s("venue_id", e.target.value)}><option value="">None</option>{(venues.d || []).map((v) => <option key={v.id} value={v.id}>{v.name} ({v.capacity})</option>)}</Select></Field></div>
            <div className="col-span-2"><Field label="Notes"><Textarea value={edit.notes} onChange={(e) => s("notes", e.target.value)} /></Field></div>
            <label className="col-span-2 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={notifyUsers} onChange={(e) => setNotifyUsers(e.target.checked)} /><span>Email participants and the trainer about this change <span className="text-coop-slate">(also updates Google Calendar when connected)</span></span></label>
            <div className="col-span-2"><ErrorMsg error={error} /></div>
            <div className="col-span-2 flex justify-end gap-2"><Btn type="button" variant="secondary" onClick={() => setEdit(null)}>Cancel</Btn><Btn type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Btn></div>
          </form>
        </Modal>)}
    </div>
  );
}

function Hostels({ pid, admin }: { pid: string; admin: boolean }) {
  const [on, setOn] = useState(today());
  const { d, err, reload } = useLoad<A[]>(`/api/logistics/hostels?on=${on}`, [on]);
  const people = useLoad<A>(admin ? "/api/people?limit=100&role=trainee" : null);
  const [hostel, setHostel] = useState<A | null>(null);
  const [rooms, setRooms] = useState<A | null>(null);
  const [alloc, setAlloc] = useState<A | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const call = async (fn: () => Promise<any>, done?: () => void, msg?: string) => { setError(null); try { await fn(); done?.(); reload(); if (msg) { setOk(msg); setTimeout(() => setOk(null), 2500); } } catch (e: any) { setError(e.message); } };
  const total = (d || []).reduce((a, h) => a + h.total_beds, 0), used = (d || []).reduce((a, h) => a + h.occupied_beds, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3"><Field label="Occupancy on"><Input type="date" value={on} onChange={(e) => setOn(e.target.value)} /></Field>
        {admin && <Btn onClick={() => setHostel({ name: "", gender_type: "Mixed", address: "" })}>Add hostel</Btn>}
        <p className="text-sm text-coop-slate ml-auto">{used}/{total} beds occupied · {total - used} available</p></div>
      <ErrorMsg error={err || error} />{ok && <Notice>{ok}</Notice>}
      {!d ? <Spinner /> : d.length === 0 ? <Empty>No hostels set up.</Empty> : d.map((h) => (
        <Card key={h.id}>
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-display text-lg text-indigo">{h.name}</h3><p className="text-sm text-coop-slate">{h.gender_type} · {h.address || "—"}</p></div>
            <div className="flex items-center gap-2"><Badge tone={h.occupancy_percent > 90 ? "red" : h.occupancy_percent > 60 ? "saffron" : "green"}>{h.occupied_beds}/{h.total_beds} beds · {h.occupancy_percent}%</Badge>
              {admin && <><Btn variant="secondary" onClick={() => setRooms({ id: h.id, floor: 1, prefix: "", start_no: 1, count: 4, capacity: 2 })}>Add rooms</Btn>
                <Btn variant="ghost" onClick={() => confirm(`Delete ${h.name}?`) && call(() => api(`/api/logistics/hostels/${h.id}`, { method: "DELETE" }))}>Delete</Btn></>}</div></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">{h.rooms.map((r: A) => (
            <div key={r.id} className={`rounded-md border p-3 text-sm ${r.status !== "available" ? "border-red-200 bg-red-50" : r.available === 0 ? "border-coop-saffron/40 bg-coop-saffron/5" : "border-coop-green/30 bg-coop-green/5"}`}>
              <div className="flex justify-between"><b>Room {r.room_no}</b><span className="text-xs text-coop-slate">{r.status !== "available" ? "Maintenance" : `${r.occupied}/${r.capacity}`}</span></div>
              <ul className="mt-1 text-coop-slate">{r.occupants.map((o: A) => <li key={o.allocation_id} className="flex justify-between">{o.name}{admin && <button className="text-xs text-red-600 focus-ring" onClick={() => call(() => api(`/api/logistics/allocations/${o.allocation_id}/vacate`, { method: "PATCH" }), undefined, "Vacated")}>vacate</button>}</li>)}</ul>
              {admin && <div className="mt-2 flex gap-2">{r.available > 0 && <button className="text-xs text-indigo underline focus-ring" onClick={() => setAlloc({ room_id: r.id, room_no: r.room_no, user_id: "", check_in_date: on, check_out_date: on })}>Allocate</button>}
                <button className="text-xs text-coop-slate underline focus-ring" onClick={() => call(() => api(`/api/logistics/rooms/${r.id}?status=${r.status === "available" ? "maintenance" : "available"}`, { method: "PATCH" }))}>{r.status === "available" ? "Maintenance" : "Make available"}</button></div>}
            </div>))}</div>
        </Card>))}
      {hostel && <Modal title="Add hostel" onClose={() => setHostel(null)}><form className="space-y-3" onSubmit={(e) => { e.preventDefault(); call(() => api("/api/logistics/hostels", { method: "POST", body: JSON.stringify(clean(hostel)) }), () => setHostel(null)); }}>
        <Field label="Name"><Input required minLength={2} value={hostel.name} onChange={(e) => setHostel({ ...hostel, name: e.target.value })} /></Field>
        <Field label="Type"><Select value={hostel.gender_type} onChange={(e) => setHostel({ ...hostel, gender_type: e.target.value })}><option>Mixed</option><option>Male</option><option>Female</option></Select></Field>
        <Field label="Address"><Input value={hostel.address} onChange={(e) => setHostel({ ...hostel, address: e.target.value })} /></Field><ErrorMsg error={error} />
        <div className="flex justify-end"><Btn type="submit">Create</Btn></div></form></Modal>}
      {rooms && <Modal title="Add rooms" onClose={() => setRooms(null)}><form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); const { id, ...b } = rooms; call(() => api(`/api/logistics/hostels/${id}/rooms`, { method: "POST", body: JSON.stringify(b) }), () => setRooms(null)); }}>
        <Field label="Floor"><Input type="number" min={0} value={rooms.floor} onChange={(e) => setRooms({ ...rooms, floor: +e.target.value })} /></Field>
        <Field label="Prefix"><Input maxLength={6} value={rooms.prefix} onChange={(e) => setRooms({ ...rooms, prefix: e.target.value })} /></Field>
        <Field label="First room no."><Input type="number" min={1} value={rooms.start_no} onChange={(e) => setRooms({ ...rooms, start_no: +e.target.value })} /></Field>
        <Field label="How many rooms"><Input type="number" min={1} max={100} value={rooms.count} onChange={(e) => setRooms({ ...rooms, count: +e.target.value })} /></Field>
        <Field label="Beds per room"><Input type="number" min={1} max={20} value={rooms.capacity} onChange={(e) => setRooms({ ...rooms, capacity: +e.target.value })} /></Field>
        <div className="col-span-2"><ErrorMsg error={error} /></div><div className="col-span-2 flex justify-end"><Btn type="submit">Add</Btn></div></form></Modal>}
      {alloc && <Modal title={`Allocate room ${alloc.room_no}`} onClose={() => setAlloc(null)}><form className="space-y-3" onSubmit={(e) => { e.preventDefault(); const { room_no, ...b } = alloc; call(() => api("/api/logistics/allocations", { method: "POST", body: JSON.stringify({ ...b, programme_id: pid || null }) }), () => setAlloc(null), "Room allocated"); }}>
        <Field label="Participant"><Select required value={alloc.user_id} onChange={(e) => setAlloc({ ...alloc, user_id: e.target.value })}><option value="">Select…</option>{(people.d?.items || []).map((p: A) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Check in"><Input type="date" required value={alloc.check_in_date} onChange={(e) => setAlloc({ ...alloc, check_in_date: e.target.value })} /></Field>
          <Field label="Check out"><Input type="date" required min={alloc.check_in_date} value={alloc.check_out_date} onChange={(e) => setAlloc({ ...alloc, check_out_date: e.target.value })} /></Field></div>
        <ErrorMsg error={error} /><div className="flex justify-end"><Btn type="submit">Allocate</Btn></div></form></Modal>}
    </div>
  );
}

function MyStay() {
  const { d, err } = useLoad<A[]>("/api/logistics/allocations/mine");
  return (<div className="space-y-3"><ErrorMsg error={err} />{!d ? <Spinner /> : d.length === 0 ? <Empty>No hostel room allocated to you yet.</Empty> : d.map((a) => (
    <Card key={a.id}><p className="font-display text-lg text-indigo">{a.hostel_name} · Room {a.room_no}</p><p className="text-sm text-coop-slate">Floor {a.floor} · {a.hostel_address || ""}</p><p className="text-sm mt-1">{fmtDate(a.check_in_date)} → {fmtDate(a.check_out_date)}</p></Card>))}</div>);
}

function Items({ pid, staff }: { pid: string; staff: boolean }) {
  const [kind, setKind] = useState("");
  const { d, err, reload } = useLoad<A[]>(pid ? `/api/logistics/items?programme_id=${pid}${kind ? `&kind=${kind}` : ""}` : null, [kind]);
  const [edit, setEdit] = useState<A | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const { id, ...b } = edit;
    try { await api(id ? `/api/logistics/items/${id}` : "/api/logistics/items", { method: id ? "PUT" : "POST", body: JSON.stringify(clean({ ...b, programme_id: pid, quantity: b.quantity === "" ? null : b.quantity == null ? null : Number(b.quantity), cost: b.cost === "" || b.cost == null ? null : Number(b.cost) })) }); setEdit(null); reload(); }
    catch (x: any) { setError(x.message); }
  }
  const s = (k: string, v: any) => setEdit({ ...edit, [k]: v });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end"><Field label="Type"><Select value={kind} onChange={(e) => setKind(e.target.value)}><option value="">All</option>{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</Select></Field>
        {staff && <Btn onClick={() => setEdit({ kind: "transport", title: "", item_date: today(), item_time: "", details: "", vendor: "", quantity: "", cost: "", status: "planned" })}>Add item</Btn>}</div>
      <ErrorMsg error={err} />
      {!d ? <Spinner /> : d.length === 0 ? <Empty>Nothing planned yet.</Empty> : (
        <div className="grid md:grid-cols-2 gap-3">{d.map((i) => (
          <Card key={i.id} className="!p-4"><div className="flex justify-between gap-2"><div><Badge tone="indigo">{i.kind}</Badge><p className="font-medium text-indigo mt-1">{i.title}</p></div><Badge tone={statusTone(i.status)}>{i.status}</Badge></div>
            <p className="text-sm text-coop-slate mt-1">{fmtDate(i.item_date)} {i.item_time || ""}{i.quantity != null ? ` · qty ${i.quantity}` : ""}{staff && i.vendor ? ` · ${i.vendor}` : ""}{staff && i.cost != null ? ` · ₹${i.cost}` : ""}</p>
            {i.details && <p className="text-sm mt-1">{i.details}</p>}
            {staff && <div className="mt-2 flex gap-2"><Btn variant="secondary" onClick={() => setEdit(Object.fromEntries(Object.entries(i).map(([k, v]) => [k, v ?? ""])))}>Edit</Btn>
              <Btn variant="ghost" onClick={() => confirm("Delete this item?") && api(`/api/logistics/items/${i.id}`, { method: "DELETE" }).then(reload).catch((x) => setError(x.message))}>Delete</Btn></div>}</Card>))}</div>)}
      <ErrorMsg error={!edit ? error : null} />
      {edit && (<Modal title={edit.id ? "Edit item" : "Add item"} onClose={() => setEdit(null)}>
        <form onSubmit={save} className="grid grid-cols-2 gap-3">
          <Field label="Type"><Select value={edit.kind} onChange={(e) => s("kind", e.target.value)}>{KINDS.map((k) => <option key={k}>{k}</option>)}</Select></Field>
          <Field label="Status"><Select value={edit.status} onChange={(e) => s("status", e.target.value)}>{["planned", "confirmed", "done", "cancelled"].map((k) => <option key={k}>{k}</option>)}</Select></Field>
          <div className="col-span-2"><Field label="Title"><Input required minLength={2} value={edit.title} onChange={(e) => s("title", e.target.value)} /></Field></div>
          <Field label="Date"><Input type="date" value={edit.item_date} onChange={(e) => s("item_date", e.target.value)} /></Field>
          <Field label="Time"><Input type="time" value={edit.item_time} onChange={(e) => s("item_time", e.target.value)} /></Field>
          <Field label="Quantity"><Input type="number" min={0} value={edit.quantity} onChange={(e) => s("quantity", e.target.value)} /></Field>
          <Field label="Cost (₹)"><Input type="number" min={0} step="0.01" value={edit.cost} onChange={(e) => s("cost", e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Vendor"><Input value={edit.vendor} onChange={(e) => s("vendor", e.target.value)} /></Field></div>
          <div className="col-span-2"><Field label="Details"><Textarea value={edit.details} onChange={(e) => s("details", e.target.value)} /></Field></div>
          <div className="col-span-2"><ErrorMsg error={error} /></div>
          <div className="col-span-2 flex justify-end gap-2"><Btn type="button" variant="secondary" onClick={() => setEdit(null)}>Cancel</Btn><Btn type="submit">Save</Btn></div>
        </form></Modal>)}
    </div>
  );
}

function Venues() {
  const { d, err, reload } = useLoad<A[]>("/api/logistics/venues");
  const [edit, setEdit] = useState<A | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const { id, institution_id, ...b } = edit;
    try { await api(id ? `/api/logistics/venues/${id}` : "/api/logistics/venues", { method: id ? "PUT" : "POST", body: JSON.stringify(clean({ ...b, capacity: Number(b.capacity) })) }); setEdit(null); reload(); } catch (x: any) { setError(x.message); }
  }
  return (<div className="space-y-4"><Btn onClick={() => setEdit({ name: "", venue_type: "Classroom", capacity: 30, location: "", facilities: "" })}>Add venue</Btn><ErrorMsg error={err || (!edit ? error : null)} />
    {!d ? <Spinner /> : d.length === 0 ? <Empty>No venues yet.</Empty> : <div className="grid md:grid-cols-3 gap-3">{d.map((v) => (
      <Card key={v.id} className="!p-4"><p className="font-medium text-indigo">{v.name}</p><p className="text-sm text-coop-slate">{v.venue_type} · {v.capacity} seats · {v.location || "—"}</p><p className="text-xs text-coop-slate">{v.facilities}</p>
        <div className="mt-2 flex gap-2"><Btn variant="secondary" onClick={() => setEdit(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x ?? ""])))}>Edit</Btn>
          <Btn variant="ghost" onClick={() => confirm("Delete venue?") && api(`/api/logistics/venues/${v.id}`, { method: "DELETE" }).then(reload).catch((x) => setError(x.message))}>Delete</Btn></div></Card>))}</div>}
    {edit && <Modal title={edit.id ? "Edit venue" : "Add venue"} onClose={() => setEdit(null)}><form onSubmit={save} className="space-y-3">
      <Field label="Name"><Input required minLength={2} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Type"><Input value={edit.venue_type} onChange={(e) => setEdit({ ...edit, venue_type: e.target.value })} /></Field>
        <Field label="Capacity"><Input type="number" min={1} value={edit.capacity} onChange={(e) => setEdit({ ...edit, capacity: e.target.value })} /></Field></div>
      <Field label="Location"><Input value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} /></Field>
      <Field label="Facilities"><Input value={edit.facilities} onChange={(e) => setEdit({ ...edit, facilities: e.target.value })} /></Field>
      <ErrorMsg error={error} /><div className="flex justify-end gap-2"><Btn type="button" variant="secondary" onClick={() => setEdit(null)}>Cancel</Btn><Btn type="submit">Save</Btn></div></form></Modal>}</div>);
}

function Logistics() {
  const { user } = useAuth();
  const staff = !!user && STAFF.includes(user.role);
  const admin = !!user && ADMINS.includes(user.role);
  const [tab, setTab] = useState("timetable");
  const [progs, setProgs] = useState<A[] | null>(null);
  const [pid, setPid] = useState("");
  useEffect(() => { api<A[]>("/api/logistics/programmes").then((p) => { setProgs(p); if (p[0]) setPid(p[0].id); }).catch(() => setProgs([])); }, []);
  const tabs = [{ id: "timetable", label: "Timetable" }, ...(admin ? [{ id: "hostel", label: "Hostel & rooms" }] : []), ...(!staff ? [{ id: "stay", label: "My stay" }] : []),
    { id: "items", label: "Transport, meals & more" }, ...(admin ? [{ id: "venues", label: "Venues" }] : [])];
  if (!progs) return <Spinner />;
  return (
    <>
      <PageHeader title="Timetable & logistics" subtitle="Course-wise schedule, hostel stay, transport, meals and venues." />
      {progs.length > 0 && tab !== "hostel" && tab !== "venues" && tab !== "stay" && <div className="max-w-sm mb-4"><Field label="Programme"><Select value={pid} onChange={(e) => setPid(e.target.value)}>{progs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field></div>}
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <div className="mt-6">
        {tab === "timetable" && (pid ? <Timetable pid={pid} staff={staff} admin={admin} key={pid} /> : <Empty>No programmes available to you yet.</Empty>)}
        {tab === "hostel" && <Hostels pid={pid} admin={admin} />}
        {tab === "stay" && <MyStay />}
        {tab === "items" && (pid ? <Items pid={pid} staff={staff} key={pid} /> : <Empty>No programmes available to you yet.</Empty>)}
        {tab === "venues" && <Venues />}
      </div>
    </>
  );
}
export default function LogisticsPage() { return <Gate roles={["super_admin", "institution_admin", "trainer", "trainee"]}><Logistics /></Gate>; }
