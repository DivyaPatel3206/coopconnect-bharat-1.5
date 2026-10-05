"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { clean } from "@/lib/http";
import { useAuth } from "@/lib/auth";
import { STAFF } from "@/lib/roles";
import Card from "@/components/Card";
import { Gate, PageHeader, Btn, Input, Select, Textarea, Field, Badge, Modal, Spinner, ErrorMsg, Empty } from "@/components/ui";

function Hub() {
  const { user } = useAuth();
  const staff = !!user && STAFF.includes(user.role);
  const [courses, setCourses] = useState<any[] | null>(null);
  const [progs, setProgs] = useState<any[]>([]);
  const [create, setCreate] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => api<any[]>("/api/learning/courses").then(setCourses).catch((e) => setError(e.message));
  useEffect(() => { load(); if (staff) api<any[]>("/api/logistics/programmes").then(setProgs).catch(() => {}); }, [staff]);

  async function enroll(id: string) { try { await api(`/api/learning/courses/${id}/enroll`, { method: "POST" }); load(); } catch (e: any) { setError(e.message); } }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try { const r = await api<any>("/api/learning/courses", { method: "POST", body: JSON.stringify(clean({ ...create, duration_hours: create.duration_hours === "" ? null : Number(create.duration_hours) })) }); window.location.href = `/learning/${r.id}`; }
    catch (x: any) { setError(x.message); }
  }
  return (
    <>
      <PageHeader title="Interactive learning" subtitle="Videos, PDFs, slides, interactive lessons, quizzes and assignments, with your progress tracked." actions={staff && <Btn onClick={() => setCreate({ title: "", description: "", skill_tag: "", language: "English", programme_id: "", category: "", level: "Beginner", duration_hours: "", instructor: "", institution_name: "" })}>New course</Btn>} />
      {!create && <ErrorMsg error={error} />}
      {!courses ? <Spinner /> : courses.length === 0 ? <Empty>No courses yet.</Empty> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{courses.map((c) => (
          <Card key={c.id} className="flex flex-col"><div className="flex justify-between gap-2"><h2 className="font-display text-lg text-indigo">{c.title}</h2>{c.completed && <Badge tone="green">Completed</Badge>}</div>
            <p className="text-sm text-coop-slate mt-1 flex-1">{c.description}</p>
            <p className="text-xs text-coop-slate mt-2">{c.lessons} lessons · {c.skill_tag || "General"} · {c.language}</p>
            {c.enrolled && <div className="mt-3"><div className="flex justify-between text-xs mb-1"><span>Progress</span><span>{Math.round(c.progress_percent)}%</span></div><div className="h-2 rounded-full bg-black/10"><div className="h-2 rounded-full bg-coop-green" style={{ width: `${c.progress_percent}%` }} /></div></div>}
            <div className="mt-4">{staff || c.enrolled ? <Link href={`/learning/${c.id}`} className="block text-center rounded-md bg-indigo text-white py-2 text-sm hover:bg-indigo-dark focus-ring">{staff ? "Open / manage" : c.completed ? "Review" : "Continue"}</Link>
              : <Btn className="w-full" onClick={() => enroll(c.id)}>Enrol</Btn>}</div></Card>))}</div>)}
      {create && <Modal title="New course" onClose={() => setCreate(null)}><form onSubmit={save} className="space-y-3">
        <Field label="Title"><Input required minLength={3} value={create.title} onChange={(e) => setCreate({ ...create, title: e.target.value })} /></Field>
        <Field label="Description"><Textarea value={create.description} onChange={(e) => setCreate({ ...create, description: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Skill tag" hint="Used for certificates & job matching"><Input value={create.skill_tag} onChange={(e) => setCreate({ ...create, skill_tag: e.target.value })} /></Field>
          <Field label="Language"><Input value={create.language} onChange={(e) => setCreate({ ...create, language: e.target.value })} /></Field></div>
        <div className="grid grid-cols-3 gap-3"><Field label="Category"><Input value={create.category} onChange={(e) => setCreate({ ...create, category: e.target.value })} placeholder="Dairy, Finance…" /></Field>
          <Field label="Level"><Select value={create.level} onChange={(e) => setCreate({ ...create, level: e.target.value })}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></Select></Field>
          <Field label="Hours"><Input type="number" min={0.5} step="0.5" value={create.duration_hours} onChange={(e) => setCreate({ ...create, duration_hours: e.target.value })} /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Instructor"><Input value={create.instructor} onChange={(e) => setCreate({ ...create, instructor: e.target.value })} /></Field>
          <Field label="Institution"><Input value={create.institution_name} onChange={(e) => setCreate({ ...create, institution_name: e.target.value })} /></Field></div>
        <Field label="Linked programme"><Select value={create.programme_id} onChange={(e) => setCreate({ ...create, programme_id: e.target.value })}><option value="">None</option>{progs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <ErrorMsg error={error} /><div className="flex justify-end gap-2"><Btn type="button" variant="secondary" onClick={() => setCreate(null)}>Cancel</Btn><Btn type="submit">Create</Btn></div></form></Modal>}
    </>
  );
}
export default function LearningPage() { return <Gate><Hub /></Gate>; }
