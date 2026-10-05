"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { clean } from "@/lib/http";
import { useAuth } from "@/lib/auth";
import Card from "@/components/Card";
import { Gate, PageHeader, Btn, Input, Select, Textarea, Field, Badge, Tabs, Modal, Spinner, ErrorMsg, Notice, Empty, statusTone, fmtDate } from "@/components/ui";

type A = any;
const STATUSES = ["applied", "shortlisted", "interview", "hired", "rejected"];
const JOB_TYPES = ["Full-time", "Part-time", "Internship", "Apprenticeship", "Contract"];

function CandidateCard({ c, action }: { c: A; action?: React.ReactNode }) {
  return (
    <Card className="!p-4">
      <div className="flex justify-between gap-2"><div><p className="font-medium text-indigo">{c.name}</p><p className="text-xs text-coop-slate">{[c.location, c.education].filter(Boolean).join(" · ") || "—"}</p></div>
        {c.match_score != null && <Badge tone={c.match_score >= 60 ? "green" : "saffron"}>{c.match_score}% match</Badge>}</div>
      <div className="flex flex-wrap gap-1 mt-2">{c.skills.map((s: A) => <Badge key={s.skill_name} tone="indigo">{s.skill_name} {s.level_percent}%</Badge>)}{c.certificates.map((x: A) => <Badge key={x.verification_id} tone="green">✓ {x.programme_name}</Badge>)}</div>
      {c.training?.length > 0 && <p className="text-xs text-coop-slate mt-2">Training: {c.training.map((t: A) => t.title).join("; ")}</p>}
      {c.bio && <p className="text-sm mt-2">{c.bio}</p>}
      {c.email && <p className="text-xs text-coop-slate mt-2">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>}
      {action && <div className="mt-3">{action}</div>}
    </Card>
  );
}

function Company({ onSaved }: { onSaved: () => void }) {
  const [f, setF] = useState<A>({ company_name: "", sector: "", location: "", website: "", description: "", contact_phone: "" });
  const [exists, setExists] = useState<A | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  useEffect(() => { api<A>("/api/employer/profile").then((c) => { setExists(c); setF(Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v ?? ""]))); }).catch(() => {}).finally(() => setLoaded(true)); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try { const { company_name, sector, location, website, description, contact_phone } = f; const c = await api<A>("/api/employer/profile", { method: "PUT", body: JSON.stringify(clean({ company_name, sector, location, website, description, contact_phone })) }); setExists(c); setOk(true); setTimeout(() => setOk(false), 2500); onSaved(); }
    catch (x: any) { setError(x.message); }
  }
  if (!loaded) return <Spinner />;
  const s = (k: string, v: string) => setF({ ...f, [k]: v });
  return (
    <Card>
      {!exists && <p className="text-sm text-coop-slate mb-4">Register your organisation to post jobs and search candidates.</p>}
      {exists && <p className="mb-4"><Badge tone={exists.verified ? "green" : "saffron"}>{exists.verified ? "Verified employer" : "Awaiting verification"}</Badge></p>}
      <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
        <Field label="Company name"><Input required minLength={2} value={f.company_name} onChange={(e) => s("company_name", e.target.value)} /></Field>
        <Field label="Sector"><Input value={f.sector} onChange={(e) => s("sector", e.target.value)} placeholder="Dairy, Agri, Banking…" /></Field>
        <Field label="Location"><Input value={f.location} onChange={(e) => s("location", e.target.value)} /></Field>
        <Field label="Contact phone"><Input value={f.contact_phone} onChange={(e) => s("contact_phone", e.target.value)} /></Field>
        <div className="sm:col-span-2"><Field label="Website"><Input type="url" placeholder="https://" value={f.website} onChange={(e) => s("website", e.target.value)} /></Field></div>
        <div className="sm:col-span-2"><Field label="About the company"><Textarea maxLength={1000} value={f.description} onChange={(e) => s("description", e.target.value)} /></Field></div>
        <div className="sm:col-span-2 space-y-2"><ErrorMsg error={error} />{ok && <Notice>Saved</Notice>}<Btn type="submit">{exists ? "Save changes" : "Register company"}</Btn></div>
      </form>
    </Card>
  );
}

function Jobs({ jobs, reload, openApplicants }: { jobs: A[] | null; reload: () => void; openApplicants: (j: A) => void }) {
  const [edit, setEdit] = useState<A | null>(null);
  const [error, setError] = useState<string | null>(null);
  const blank = { title: "", description: "", required_skills: "", location: "", job_type: "Full-time", salary_range: "", openings: 1, experience: "", deadline: "" };
  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const { id, applicants, shortlisted, hired, posted_at, status, ...b } = edit;
    try { await api(id ? `/api/employer/jobs/${id}` : "/api/employer/jobs", { method: id ? "PUT" : "POST", body: JSON.stringify(clean({ ...b, openings: Number(b.openings) })) }); setEdit(null); reload(); }
    catch (x: any) { setError(x.message); }
  }
  const s = (k: string, v: any) => setEdit({ ...edit, [k]: v });
  return (
    <div className="space-y-4">
      <Btn onClick={() => setEdit({ ...blank })}>Post a job</Btn>
      {!edit && <ErrorMsg error={error} />}
      {!jobs ? <Spinner /> : jobs.length === 0 ? <Empty>No jobs posted yet.</Empty> : (
        <div className="grid md:grid-cols-2 gap-4">{jobs.map((j) => (
          <Card key={j.id}><div className="flex justify-between gap-2"><div><h3 className="font-display text-lg text-indigo">{j.title}</h3><p className="text-sm text-coop-slate">{j.job_type} · {j.location || "—"} · {j.salary_range || "Salary not listed"}</p></div><Badge tone={statusTone(j.status)}>{j.status}</Badge></div>
            <p className="text-xs text-coop-slate mt-2">Skills: {j.required_skills || "—"} · Openings {j.openings}{j.deadline ? ` · Apply by ${fmtDate(j.deadline)}` : ""}</p>
            <p className="text-sm mt-2">{j.applicants} applicant(s) · {j.shortlisted} shortlisted · {j.hired} hired</p>
            <div className="mt-3 flex flex-wrap gap-2"><Btn onClick={() => openApplicants(j)}>Applicants</Btn>
              <Btn variant="secondary" onClick={() => setEdit(Object.fromEntries(Object.entries(j).map(([k, v]) => [k, v ?? ""])))}>Edit</Btn>
              <Btn variant="ghost" onClick={() => api(`/api/employer/jobs/${j.id}/status`, { method: "PATCH", body: JSON.stringify({ status: j.status === "open" ? "closed" : "open" }) }).then(reload).catch((x) => setError(x.message))}>{j.status === "open" ? "Close" : "Reopen"}</Btn></div></Card>))}</div>)}
      {edit && <Modal title={edit.id ? "Edit job" : "Post a job"} onClose={() => setEdit(null)}>
        <form onSubmit={save} className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Field label="Job title"><Input required minLength={3} value={edit.title} onChange={(e) => s("title", e.target.value)} /></Field></div>
          <Field label="Type"><Select value={edit.job_type} onChange={(e) => s("job_type", e.target.value)}>{JOB_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
          <Field label="Openings"><Input type="number" min={1} value={edit.openings} onChange={(e) => s("openings", e.target.value)} /></Field>
          <Field label="Location"><Input value={edit.location} onChange={(e) => s("location", e.target.value)} /></Field>
          <Field label="Salary / stipend"><Input value={edit.salary_range} onChange={(e) => s("salary_range", e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Required skills" hint="Comma-separated. These drive candidate matching, e.g. Digital Literacy, Communication."><Input value={edit.required_skills} onChange={(e) => s("required_skills", e.target.value)} /></Field></div>
          <Field label="Experience"><Input value={edit.experience} onChange={(e) => s("experience", e.target.value)} placeholder="Fresher, 1-2 years…" /></Field>
          <Field label="Apply by"><Input type="date" value={edit.deadline} onChange={(e) => s("deadline", e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Description"><Textarea rows={4} value={edit.description} onChange={(e) => s("description", e.target.value)} /></Field></div>
          <div className="col-span-2"><ErrorMsg error={error} /></div>
          <div className="col-span-2 flex justify-end gap-2"><Btn type="button" variant="secondary" onClick={() => setEdit(null)}>Cancel</Btn><Btn type="submit">{edit.id ? "Save" : "Publish"}</Btn></div>
        </form></Modal>}
    </div>
  );
}

function Applicants({ jobs, jobId, setJobId }: { jobs: A[]; jobId: string; setJobId: (id: string) => void }) {
  const [filter, setFilter] = useState("");
  const [apps, setApps] = useState<A[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => { if (!jobId) return; setApps(null); api<A[]>(`/api/employer/jobs/${jobId}/applications${filter ? `?status=${filter}` : ""}`).then(setApps).catch((e) => setError(e.message)); }, [jobId, filter]);
  useEffect(load, [load]);
  async function setStatus(id: string, status: string) { setError(null); try { await api(`/api/employer/applications/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); load(); } catch (e: any) { setError((e as Error).message); } }
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3 max-w-xl"><Field label="Job"><Select value={jobId} onChange={(e) => setJobId(e.target.value)}>{jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</Select></Field>
        <Field label="Stage"><Select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></Field></div>
      <ErrorMsg error={error} />
      {!jobId ? <Empty>Post a job to start receiving applications.</Empty> : !apps ? <Spinner /> : apps.length === 0 ? <Empty>No applications here yet.</Empty> : (
        <div className="grid md:grid-cols-2 gap-4">{apps.map((a) => (
          <CandidateCard key={a.id} c={{ ...a.candidate, match_score: a.match_score }} action={
            <div className="flex items-center gap-2"><Badge tone={statusTone(a.status)}>{a.status}</Badge>
              <Select aria-label="Change status" className="!w-auto" value={a.status} onChange={(e) => setStatus(a.id, e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</Select>
              <span className="text-xs text-coop-slate">Applied {fmtDate(a.applied_at)}</span></div>} />))}</div>)}
    </div>
  );
}

function Candidates({ jobs }: { jobs: A[] }) {
  const [f, setF] = useState({ q: "", skill: "", location: "", education: "", job_id: "", min_match: 0 });
  const [res, setRes] = useState<{ total: number; items: A[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => { if (v) p.set(k, String(v)); });
      api<A>(`/api/employer/candidates?${p}`).then((r) => { setRes(r); setError(null); }).catch((e) => setError(e.message));
    }, 300);
    return () => clearTimeout(t);
  }, [f]);
  return (
    <div className="space-y-4">
      <Card className="grid sm:grid-cols-3 gap-3">
        <Field label="Name or interest"><Input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></Field>
        <Field label="Skills" hint="Comma-separated; all must match"><Input value={f.skill} onChange={(e) => setF({ ...f, skill: e.target.value })} placeholder="Communication, Digital Literacy" /></Field>
        <Field label="Location"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
        <Field label="Education"><Input value={f.education} onChange={(e) => setF({ ...f, education: e.target.value })} /></Field>
        <Field label="Match against job"><Select value={f.job_id} onChange={(e) => setF({ ...f, job_id: e.target.value, min_match: 0 })}><option value="">— none —</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</Select></Field>
        <Field label={`Minimum match: ${f.min_match}%`}><input type="range" min={0} max={100} step={10} disabled={!f.job_id} value={f.min_match} onChange={(e) => setF({ ...f, min_match: +e.target.value })} className="w-full" aria-label="Minimum match" /></Field>
      </Card>
      <ErrorMsg error={error} />
      {!res ? <Spinner /> : res.items.length === 0 ? <Empty>No candidates match. Only trainees who are open to work, or who applied to you, appear here.</Empty> : (
        <><p className="text-sm text-coop-slate">{res.total} candidate(s){f.job_id ? ", best match first" : ""}</p>
          <div className="grid md:grid-cols-2 gap-4">{res.items.map((c) => <CandidateCard key={c.id} c={c} action={c.applied ? <Badge tone="saffron">Applied to you</Badge> : undefined} />)}</div></>)}
    </div>
  );
}

function AdminEmployers() {
  const [list, setList] = useState<A[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => { api<A[]>("/api/employer/admin/employers").then(setList).catch((e) => setError(e.message)); }, []);
  useEffect(load, [load]);
  const patch = (id: string, q: string) => api(`/api/employer/admin/employers/${id}?${q}`, { method: "PATCH" }).then(load).catch((e) => setError(e.message));
  return (<div className="space-y-3"><ErrorMsg error={error} />{!list ? <Spinner /> : list.length === 0 ? <Empty>No employers registered.</Empty> : list.map((c) => (
    <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium text-indigo">{c.company_name}</p><p className="text-sm text-coop-slate">{c.owner_email} · {c.sector || "—"} · {c.jobs} job(s)</p></div>
      <div className="flex items-center gap-2"><Badge tone={c.verified ? "green" : "saffron"}>{c.verified ? "Verified" : "Unverified"}</Badge><Badge tone={statusTone(c.status)}>{c.status}</Badge>
        <Btn variant="secondary" onClick={() => patch(c.id, `verified=${!c.verified}`)}>{c.verified ? "Unverify" : "Verify"}</Btn>
        <Btn variant="ghost" onClick={() => patch(c.id, `status=${c.status === "active" ? "suspended" : "active"}`)}>{c.status === "active" ? "Suspend" : "Reinstate"}</Btn></div></Card>))}</div>);
}

function Hub() {
  const { user } = useAuth();
  const isEmployer = user?.role === "employer";
  const [tab, setTab] = useState(isEmployer ? "jobs" : "admin");
  const [hasCompany, setHasCompany] = useState<boolean | null>(isEmployer ? null : true);
  const [jobs, setJobs] = useState<A[] | null>(null);
  const [jobId, setJobId] = useState("");
  const loadJobs = useCallback(() => {
    if (!isEmployer) return;
    api<A[]>("/api/employer/jobs").then((j) => { setJobs(j); setHasCompany(true); setJobId((cur) => cur || j[0]?.id || ""); setTab((t) => t); }).catch(() => { setHasCompany(false); setTab("company"); });
  }, [isEmployer]);
  useEffect(loadJobs, [loadJobs]);
  if (!isEmployer) return (<><PageHeader title="Employer oversight" subtitle="Verify and moderate registered employers." /><AdminEmployers /></>);
  if (hasCompany === null) return <Spinner />;
  const tabs = hasCompany ? [{ id: "jobs", label: "Jobs" }, { id: "applicants", label: "Applicants" }, { id: "candidates", label: "Find candidates" }, { id: "company", label: "Company" }] : [{ id: "company", label: "Company" }];
  return (
    <>
      <PageHeader title="Employer hub" subtitle="Post jobs, search skilled trainees, shortlist and track hiring." />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <div className="mt-6">
        {tab === "jobs" && <Jobs jobs={jobs} reload={loadJobs} openApplicants={(j) => { setJobId(j.id); setTab("applicants"); }} />}
        {tab === "applicants" && <Applicants jobs={jobs || []} jobId={jobId} setJobId={setJobId} />}
        {tab === "candidates" && <Candidates jobs={jobs || []} />}
        {tab === "company" && <Company onSaved={loadJobs} />}
      </div>
    </>
  );
}
export default function EmployerPage() { return <Gate roles={["employer", "super_admin"]}><Hub /></Gate>; }
