"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { STAFF, ROLE_LABEL } from "@/lib/roles";
import Card from "@/components/Card";
import { Gate, PageHeader, Btn, Input, Select, Field, Badge, Modal, Spinner, ErrorMsg, Empty, statusTone } from "@/components/ui";

const PAGE = 20;

function People() {
  const { user } = useAuth();
  const isSuper = user?.role === "super_admin";
  const canCreate = isSuper || user?.role === "institution_admin";
  const [q, setQ] = useState(""); const [role, setRole] = useState(""); const [status, setStatus] = useState("");
  const [skip, setSkip] = useState(0);
  const [res, setRes] = useState<{ total: number; items: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [insts, setInsts] = useState<any[]>([]);
  const [create, setCreate] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const p = new URLSearchParams({ skip: String(skip), limit: String(PAGE) });
    if (q) p.set("q", q); if (role) p.set("role", role); if (status) p.set("status", status);
    api<any>(`/api/people?${p}`).then((r) => { setRes(r); setError(null); }).catch((e) => setError(e.message));
  }, [q, role, status, skip]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { if (isSuper) api<any[]>("/api/institutions").then(setInsts).catch(() => {}); }, [isSuper]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    try { await api("/api/people", { method: "POST", body: JSON.stringify({ ...create, institution_id: create.institution_id || null }) }); setCreate(null); load(); }
    catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }

  const roles = isSuper ? Object.keys(ROLE_LABEL) : ["trainer", "trainee"];
  return (
    <>
      <PageHeader title="People" subtitle="Participants, trainers and staff you manage." actions={canCreate && <Btn onClick={() => setCreate({ name: "", email: "", password: "", role: "trainee", institution_id: "" })}>Add person</Btn>} />
      <div className="grid sm:grid-cols-4 gap-3 mb-4">
        <div className="sm:col-span-2"><Input aria-label="Search" placeholder="Search name, email or location" value={q} onChange={(e) => { setQ(e.target.value); setSkip(0); }} /></div>
        <Select aria-label="Role" value={role} onChange={(e) => { setRole(e.target.value); setSkip(0); }}><option value="">All roles</option>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setSkip(0); }}><option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></Select>
      </div>
      {!create && <ErrorMsg error={error} />}
      {!res ? <Spinner /> : res.items.length === 0 ? <Empty>No people match your filters.</Empty> : (
        <>
          <div className="hidden md:block overflow-x-auto"><Card className="!p-0"><table className="w-full text-sm">
            <thead className="text-left text-coop-slate border-b border-black/10"><tr><th className="p-3">Name</th><th>Email</th><th>Role</th><th>Location</th><th>Status</th><th></th></tr></thead>
            <tbody>{res.items.map((p) => (<tr key={p.id} className="border-b border-black/5 last:border-0">
              <td className="p-3 font-medium text-indigo">{p.name}</td><td>{p.email}</td><td>{ROLE_LABEL[p.role]}</td><td>{p.location || "—"}</td>
              <td><Badge tone={statusTone(p.status)}>{p.status}</Badge></td><td className="pr-3 text-right"><Link className="text-indigo underline focus-ring" href={`/people/${p.id}`}>Open</Link></td></tr>))}</tbody></table></Card></div>
          <ul className="md:hidden space-y-3">{res.items.map((p) => (<li key={p.id}><Card><div className="flex justify-between gap-2"><div><Link href={`/people/${p.id}`} className="font-medium text-indigo">{p.name}</Link>
            <p className="text-xs text-coop-slate break-all">{p.email}</p><p className="text-xs text-coop-slate">{ROLE_LABEL[p.role]} · {p.location || "—"}</p></div><Badge tone={statusTone(p.status)}>{p.status}</Badge></div></Card></li>))}</ul>
          <div className="flex items-center justify-between mt-4 text-sm text-coop-slate">
            <span>{skip + 1}–{Math.min(skip + PAGE, res.total)} of {res.total}</span>
            <div className="flex gap-2"><Btn variant="secondary" disabled={skip === 0} onClick={() => setSkip(Math.max(0, skip - PAGE))}>Previous</Btn><Btn variant="secondary" disabled={skip + PAGE >= res.total} onClick={() => setSkip(skip + PAGE)}>Next</Btn></div>
          </div>
        </>)}
      {create && (
        <Modal title="Add person" onClose={() => setCreate(null)}>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Full name"><Input required minLength={2} value={create.name} onChange={(e) => setCreate({ ...create, name: e.target.value })} /></Field>
            <Field label="Email"><Input required type="email" value={create.email} onChange={(e) => setCreate({ ...create, email: e.target.value })} /></Field>
            <Field label="Temporary password" hint="At least 8 characters. Ask them to change it."><Input required type="password" minLength={8} maxLength={72} value={create.password} onChange={(e) => setCreate({ ...create, password: e.target.value })} /></Field>
            <Field label="Role"><Select value={create.role} onChange={(e) => setCreate({ ...create, role: e.target.value })}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Field>
            {isSuper && <Field label="Institution"><Select value={create.institution_id} onChange={(e) => setCreate({ ...create, institution_id: e.target.value })}><option value="">None</option>{insts.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select></Field>}
            <ErrorMsg error={error} />
            <div className="flex justify-end gap-2"><Btn type="button" variant="secondary" onClick={() => setCreate(null)}>Cancel</Btn><Btn type="submit" disabled={busy}>{busy ? "Creating…" : "Create"}</Btn></div>
          </form>
        </Modal>)}
    </>
  );
}
export default function PeoplePage() { return <Gate roles={STAFF}><People /></Gate>; }
