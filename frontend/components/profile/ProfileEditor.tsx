"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { apiForm, openFile, clean } from "@/lib/http";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import Card from "@/components/Card";
import { Btn, Field, Input, Select, Textarea, Badge, Tabs, Spinner, ErrorMsg, Notice, Empty, Modal, statusTone, fmtDate } from "@/components/ui";

type P = any;
const DOC_TYPES = ["ID proof", "Address proof", "Education certificate", "Training certificate", "Photo", "Other"];

export default function ProfileEditor({ uid }: { uid: string }) {
  const { user: me } = useAuth();
  const [data, setData] = useState<P | null>(null);
  const [insts, setInsts] = useState<P[]>([]);
  const [tab, setTab] = useState("personal");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [form, setForm] = useState<P>({});
  const [busy, setBusy] = useState(false);
  const [training, setTraining] = useState<P | null>(null);
  const [skill, setSkill] = useState({ skill_name: "", level_percent: 50 });
  const [doc, setDoc] = useState<{ title: string; doc_type: string; file_url: string; file: File | null }>({ title: "", doc_type: "Other", file_url: "", file: null });

  const base = `/api/profiles/${uid}`;
  const isSelf = uid === "me" || uid === me?.id;
  const isAdmin = me?.role === "super_admin" || me?.role === "institution_admin";
  const canEdit = isSelf || isAdmin;

  const load = useCallback(() => {
    api<P>(base).then((d) => {
      setData(d);
      setForm({ ...d.user, ...d.profile, dob: d.profile.dob || "" });
    }).catch((e) => setError(e.message));
  }, [base]);
  useEffect(() => { load(); api<P[]>("/api/institutions").then(setInsts).catch(() => {}); }, [load]);

  const flash = (m: string) => { setOk(m); setError(null); setTimeout(() => setOk(null), 3000); };
  const run = async (fn: () => Promise<any>, msg: string) => {
    setBusy(true); setError(null);
    try { await fn(); flash(msg); load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const set = (k: string, v: any) => setForm((f: P) => ({ ...f, [k]: v }));

  if (!data) return error ? <ErrorMsg error={error} /> : <Spinner />;
  const u = data.user;
  const trainee = u.role === "trainee";
  const lockInstitution = !isAdmin && ["trainer", "institution_admin"].includes(u.role);

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const f = clean({
      name: form.name, location: form.location, education: form.education, career_interests: form.career_interests,
      phone: form.phone, dob: form.dob, gender: form.gender, address: form.address, district: form.district,
      state: form.state, pincode: form.pincode, organisation: form.organisation, designation: form.designation,
      bio: form.bio, preferred_language: form.preferred_language,
      ...(lockInstitution ? {} : { institution_id: form.institution_id }),
      ...(trainee ? { open_to_work: !!form.open_to_work } : {}),
    });
    run(() => api(base, { method: "PUT", body: JSON.stringify(f) }), "Profile saved");
  }

  function saveTraining(e: React.FormEvent) {
    e.preventDefault();
    const t = clean(training!);
    const { id, user_id, ...body } = t;
    run(async () => {
      await api(id ? `${base}/training/${id}` : `${base}/training`, { method: id ? "PUT" : "POST", body: JSON.stringify(body) });
      setTraining(null);
    }, "Training record saved");
  }

  function addDoc(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("title", doc.title); fd.append("doc_type", doc.doc_type);
    if (doc.file) fd.append("file", doc.file); else fd.append("file_url", doc.file_url);
    run(async () => { await apiForm(`${base}/documents`, fd); setDoc({ title: "", doc_type: "Other", file_url: "", file: null }); }, "Document added");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="h-12 w-12 rounded-full bg-indigo text-white flex items-center justify-center font-display text-xl" aria-hidden>{u.name[0]}</div>
        <div>
          <h2 className="font-display text-2xl text-indigo">{u.name}</h2>
          <p className="text-sm text-coop-slate">{u.email} · <Badge tone="indigo">{ROLE_LABEL[u.role] || u.role}</Badge>{" "}
            <Badge tone={statusTone(data.profile.status)}>{data.profile.status}</Badge></p>
        </div>
        {isAdmin && !isSelf && (
          <Select aria-label="Account status" className="!w-auto ml-auto" value={data.profile.status}
            onChange={(e) => run(() => api(`${base}/status`, { method: "PATCH", body: JSON.stringify({ status: e.target.value }) }), "Status updated")}>
            <option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option>
          </Select>
        )}
      </div>

      <div className="space-y-2 mb-4"><ErrorMsg error={error} />{ok && <Notice>{ok}</Notice>}</div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "personal", label: "Personal & institution" }, { id: "training", label: `Training history (${data.training.length})` },
        { id: "skills", label: `Skills & certificates` }, { id: "documents", label: `Documents (${data.documents?.length || 0})` }]} />

      <div className="mt-6">
        {tab === "personal" && (
          <Card>
            <form onSubmit={saveProfile} className="grid sm:grid-cols-2 gap-4">
              <Field label="Full name"><Input required minLength={2} value={form.name || ""} onChange={(e) => set("name", e.target.value)} disabled={!canEdit} /></Field>
              <Field label="Phone"><Input inputMode="tel" placeholder="+91 98765 43210" value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} disabled={!canEdit} /></Field>
              <Field label="Date of birth"><Input type="date" max={new Date().toISOString().slice(0, 10)} value={form.dob || ""} onChange={(e) => set("dob", e.target.value)} disabled={!canEdit} /></Field>
              <Field label="Gender"><Select value={form.gender || ""} onChange={(e) => set("gender", e.target.value)} disabled={!canEdit}><option value="">Prefer not to say</option><option>Male</option><option>Female</option><option>Other</option></Select></Field>
              <Field label="Address"><Input value={form.address || ""} onChange={(e) => set("address", e.target.value)} disabled={!canEdit} /></Field>
              <Field label="District"><Input value={form.district || ""} onChange={(e) => set("district", e.target.value)} disabled={!canEdit} /></Field>
              <Field label="State"><Input value={form.state || ""} onChange={(e) => set("state", e.target.value)} disabled={!canEdit} /></Field>
              <Field label="Pincode"><Input inputMode="numeric" pattern="[0-9]{6}" title="6 digits" value={form.pincode || ""} onChange={(e) => set("pincode", e.target.value)} disabled={!canEdit} /></Field>
              <Field label="City / location"><Input value={form.location || ""} onChange={(e) => set("location", e.target.value)} disabled={!canEdit} /></Field>
              <Field label="Education"><Input value={form.education || ""} onChange={(e) => set("education", e.target.value)} disabled={!canEdit} /></Field>
              <Field label="Institution">
                <Select value={form.institution_id || ""} onChange={(e) => set("institution_id", e.target.value)} disabled={!canEdit || lockInstitution}>
                  <option value="">Not assigned</option>{insts.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </Select>
              </Field>
              <Field label="Society / organisation"><Input value={form.organisation || ""} onChange={(e) => set("organisation", e.target.value)} disabled={!canEdit} /></Field>
              <Field label="Designation"><Input value={form.designation || ""} onChange={(e) => set("designation", e.target.value)} disabled={!canEdit} /></Field>
              <Field label="Preferred language"><Select value={form.preferred_language || "English"} onChange={(e) => set("preferred_language", e.target.value)} disabled={!canEdit}>{["English", "Hindi", "Gujarati", "Marathi", "Bengali", "Tamil", "Telugu"].map((l) => <option key={l}>{l}</option>)}</Select></Field>
              <div className="sm:col-span-2"><Field label="Career interests" hint="Comma-separated; used by the career chatbot and job matching."><Input value={form.career_interests || ""} onChange={(e) => set("career_interests", e.target.value)} disabled={!canEdit} /></Field></div>
              <div className="sm:col-span-2"><Field label="About"><Textarea maxLength={1000} value={form.bio || ""} onChange={(e) => set("bio", e.target.value)} disabled={!canEdit} /></Field></div>
              {trainee && (
                <label className="sm:col-span-2 flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={!!form.open_to_work} onChange={(e) => set("open_to_work", e.target.checked)} disabled={!canEdit} />
                  <span><b>Open to work</b> — let verified employers find my skills, certificates and training on the candidate search. My contact details stay hidden until I apply to that employer.</span>
                </label>
              )}
              {canEdit && <div className="sm:col-span-2"><Btn type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile"}</Btn></div>}
            </form>
          </Card>
        )}

        {tab === "training" && (
          <div className="space-y-3">
            {canEdit && <Btn onClick={() => setTraining({ title: "", institution_name: "", start_date: "", end_date: "", status: "completed", grade: "" })}>Add training</Btn>}
            {data.training.length === 0 && <Empty>No training recorded yet.</Empty>}
            {data.training.map((t: P) => (
              <Card key={t.id} className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="font-medium text-indigo">{t.title}</p>
                  <p className="text-sm text-coop-slate">{t.institution_name || "—"} · {fmtDate(t.start_date)} – {fmtDate(t.end_date)}{t.grade ? ` · Grade ${t.grade}` : ""}</p></div>
                <div className="flex items-center gap-2"><Badge tone={statusTone(t.status)}>{t.status}</Badge>
                  {canEdit && <><Btn variant="secondary" onClick={() => setTraining(t)}>Edit</Btn>
                    <Btn variant="ghost" onClick={() => confirm("Delete this record?") && run(() => api(`${base}/training/${t.id}`, { method: "DELETE" }), "Deleted")}>Delete</Btn></>}</div>
              </Card>
            ))}
          </div>
        )}

        {tab === "skills" && (
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <h3 className="font-display text-lg text-indigo mb-3">Skills</h3>
              {data.skills.length === 0 && <p className="text-sm text-coop-slate">No skills added.</p>}
              <ul className="space-y-3">{data.skills.map((s: P) => (
                <li key={s.id}><div className="flex justify-between text-sm"><span>{s.skill_name}</span><span className="text-coop-slate">{s.level_percent}%
                  {canEdit && <button aria-label={`Remove ${s.skill_name}`} className="ml-2 text-red-600 focus-ring" onClick={() => run(() => api(`${base}/skills/${s.id}`, { method: "DELETE" }), "Removed")}>×</button>}</span></div>
                  <div className="h-2 rounded-full bg-black/10"><div className="h-2 rounded-full bg-coop-green" style={{ width: `${s.level_percent}%` }} /></div></li>))}</ul>
              {canEdit && (
                <form className="mt-4 flex flex-wrap gap-2 items-end" onSubmit={(e) => { e.preventDefault(); run(async () => { await api(`${base}/skills`, { method: "POST", body: JSON.stringify(skill) }); setSkill({ skill_name: "", level_percent: 50 }); }, "Skill saved"); }}>
                  <div className="flex-1 min-w-[8rem]"><Field label="Skill"><Input required minLength={2} value={skill.skill_name} onChange={(e) => setSkill({ ...skill, skill_name: e.target.value })} /></Field></div>
                  <div className="w-24"><Field label="Level %"><Input type="number" min={0} max={100} value={skill.level_percent} onChange={(e) => setSkill({ ...skill, level_percent: Number(e.target.value) })} /></Field></div>
                  <Btn type="submit" disabled={busy}>Add</Btn>
                </form>)}
            </Card>
            <Card>
              <h3 className="font-display text-lg text-indigo mb-3">Certificates</h3>
              {data.certificates.length === 0 && <p className="text-sm text-coop-slate">Certificates appear here when courses are completed.</p>}
              <ul className="space-y-2 text-sm">{data.certificates.map((c: P) => (
                <li key={c.id} className="flex justify-between gap-2"><span>{c.programme_name}{c.skill ? ` · ${c.skill}` : ""}</span>
                  <a className="text-indigo underline focus-ring" href={`/certificates/verify?id=${c.verification_id}`}>{c.verification_id}</a></li>))}</ul>
            </Card>
          </div>
        )}

        {tab === "documents" && (
          <div className="space-y-3">
            {(data.documents || []).length === 0 && <Empty>No documents uploaded.</Empty>}
            {(data.documents || []).map((d: P) => (
              <Card key={d.id} className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="font-medium text-indigo">{d.title}</p><p className="text-sm text-coop-slate">{d.doc_type} · {fmtDate(d.uploaded_at)}</p></div>
                <div className="flex items-center gap-2">
                  <Badge tone={d.verified ? "green" : "slate"}>{d.verified ? "Verified" : "Unverified"}</Badge>
                  {d.has_file ? <Btn variant="secondary" onClick={() => openFile(`/api/documents/${d.id}/file`).catch((e) => setError(e.message))}>Open</Btn>
                    : <a className="text-sm text-indigo underline focus-ring" href={d.file_url} target="_blank" rel="noopener noreferrer">Open link</a>}
                  {isAdmin && <Btn variant="ghost" onClick={() => run(() => api(`/api/documents/${d.id}/verify?verified=${!d.verified}`, { method: "PATCH" }), "Updated")}>{d.verified ? "Unverify" : "Verify"}</Btn>}
                  {canEdit && <Btn variant="ghost" onClick={() => confirm("Delete this document?") && run(() => api(`/api/documents/${d.id}`, { method: "DELETE" }), "Deleted")}>Delete</Btn>}
                </div>
              </Card>))}
            {canEdit && (
              <Card>
                <h3 className="font-display text-lg text-indigo mb-3">Add document</h3>
                <form onSubmit={addDoc} className="grid sm:grid-cols-2 gap-4">
                  <Field label="Title"><Input required minLength={2} value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} /></Field>
                  <Field label="Type"><Select value={doc.doc_type} onChange={(e) => setDoc({ ...doc, doc_type: e.target.value })}>{DOC_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
                  <Field label="Upload file" hint="PDF, PNG, JPG or DOCX, up to 5 MB"><Input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" onChange={(e) => setDoc({ ...doc, file: e.target.files?.[0] || null })} /></Field>
                  <Field label="…or a link"><Input type="url" placeholder="https://" value={doc.file_url} disabled={!!doc.file} onChange={(e) => setDoc({ ...doc, file_url: e.target.value })} /></Field>
                  <div className="sm:col-span-2"><Btn type="submit" disabled={busy || (!doc.file && !doc.file_url)}>{busy ? "Adding…" : "Add document"}</Btn></div>
                </form>
              </Card>)}
          </div>
        )}
      </div>

      {training && (
        <Modal title={training.id ? "Edit training" : "Add training"} onClose={() => setTraining(null)}>
          <form onSubmit={saveTraining} className="space-y-3">
            <Field label="Programme / course"><Input required minLength={2} value={training.title} onChange={(e) => setTraining({ ...training, title: e.target.value })} /></Field>
            <Field label="Institution"><Input value={training.institution_name || ""} onChange={(e) => setTraining({ ...training, institution_name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start"><Input type="date" value={training.start_date || ""} onChange={(e) => setTraining({ ...training, start_date: e.target.value })} /></Field>
              <Field label="End"><Input type="date" value={training.end_date || ""} onChange={(e) => setTraining({ ...training, end_date: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status"><Select value={training.status} onChange={(e) => setTraining({ ...training, status: e.target.value })}><option value="ongoing">Ongoing</option><option value="completed">Completed</option><option value="dropped">Dropped</option></Select></Field>
              <Field label="Grade"><Input value={training.grade || ""} onChange={(e) => setTraining({ ...training, grade: e.target.value })} /></Field>
            </div>
            <ErrorMsg error={error} />
            <div className="flex gap-2 justify-end"><Btn type="button" variant="secondary" onClick={() => setTraining(null)}>Cancel</Btn><Btn type="submit" disabled={busy}>Save</Btn></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
