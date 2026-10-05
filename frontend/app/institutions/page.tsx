"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { clean } from "@/lib/http";
import { useAuth } from "@/lib/auth";
import Card from "@/components/Card";
import { Gate, PageHeader, Btn, Input, Select, Textarea, Field, Badge, Modal, Spinner, ErrorMsg, Empty, statusTone } from "@/components/ui";

const blank = { name: "", type: "RICM", state: "", address: "", district: "", pincode: "", contact_person: "", email: "", phone: "", website: "", facilities: "", status: "active" };

function Institutions() {
  const { user } = useAuth();
  const [list, setList] = useState<any[] | null>(null);
  const [edit, setEdit] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { api<any[]>("/api/institutions").then(setList).catch((e) => setError(e.message)); }, []);
  useEffect(load, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    const { id, programme_count, ...body } = edit;
    try { await api(id ? `/api/institutions/${id}` : "/api/institutions", { method: id ? "PUT" : "POST", body: JSON.stringify(clean({ ...body, name: body.name, type: body.type, status: body.status })) }); setEdit(null); load(); }
    catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }
  const s = (k: string, v: string) => setEdit({ ...edit, [k]: v });
  return (
    <>
      <PageHeader title="Institutions" subtitle="VAMNICOM, RICMs, ICMs and partner institutions." actions={user?.role === "super_admin" && <Btn onClick={() => setEdit({ ...blank })}>Add institution</Btn>} />
      {!edit && <ErrorMsg error={error} />}
      {!list ? <Spinner /> : list.length === 0 ? <Empty>No institutions yet.</Empty> : (
        <div className="grid md:grid-cols-2 gap-4">{list.map((i) => (
          <Card key={i.id}><div className="flex justify-between gap-2"><div><h2 className="font-display text-lg text-indigo">{i.name}</h2><p className="text-sm text-coop-slate">{i.type} · {i.state || "—"}</p></div><Badge tone={statusTone(i.status)}>{i.status}</Badge></div>
            <dl className="mt-3 text-sm text-coop-slate space-y-1"><div>{i.address || "No address"}{i.district ? `, ${i.district}` : ""} {i.pincode}</div><div>{i.contact_person || "—"} · {i.phone || "—"} · {i.email || "—"}</div>
              {i.facilities && <div>Facilities: {i.facilities}</div>}<div>{i.programme_count} programme(s)</div></dl>
            <Btn variant="secondary" className="mt-3" onClick={() => setEdit({ ...blank, ...Object.fromEntries(Object.entries(i).map(([k, v]) => [k, v ?? ""])) })}>Edit</Btn></Card>))}</div>)}
      {edit && (
        <Modal title={edit.id ? "Edit institution" : "Add institution"} onClose={() => setEdit(null)}>
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Field label="Name"><Input required minLength={2} value={edit.name} onChange={(e) => s("name", e.target.value)} /></Field></div>
            <Field label="Type"><Select value={edit.type} onChange={(e) => s("type", e.target.value)}>{["VAMNICOM", "RICM", "ICM", "Other"].map((t) => <option key={t}>{t}</option>)}</Select></Field>
            <Field label="State"><Input value={edit.state} onChange={(e) => s("state", e.target.value)} /></Field>
            <div className="col-span-2"><Field label="Address"><Input value={edit.address} onChange={(e) => s("address", e.target.value)} /></Field></div>
            <Field label="District"><Input value={edit.district} onChange={(e) => s("district", e.target.value)} /></Field>
            <Field label="Pincode"><Input pattern="[0-9]{6}" title="6 digits" value={edit.pincode} onChange={(e) => s("pincode", e.target.value)} /></Field>
            <Field label="Contact person"><Input value={edit.contact_person} onChange={(e) => s("contact_person", e.target.value)} /></Field>
            <Field label="Phone"><Input value={edit.phone} onChange={(e) => s("phone", e.target.value)} /></Field>
            <Field label="Email"><Input type="email" value={edit.email} onChange={(e) => s("email", e.target.value)} /></Field>
            <Field label="Website"><Input value={edit.website} onChange={(e) => s("website", e.target.value)} /></Field>
            <div className="col-span-2"><Field label="Facilities"><Textarea value={edit.facilities} onChange={(e) => s("facilities", e.target.value)} /></Field></div>
            <Field label="Status"><Select value={edit.status} onChange={(e) => s("status", e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
            <div className="col-span-2"><ErrorMsg error={error} /></div>
            <div className="col-span-2 flex justify-end gap-2"><Btn type="button" variant="secondary" onClick={() => setEdit(null)}>Cancel</Btn><Btn type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Btn></div>
          </form>
        </Modal>)}
    </>
  );
}
export default function InstitutionsPage() { return <Gate roles={["super_admin", "institution_admin"]}><Institutions /></Gate>; }
