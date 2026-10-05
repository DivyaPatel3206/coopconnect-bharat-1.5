"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { clean } from "@/lib/http";
import { useAuth } from "@/lib/auth";
import { STAFF } from "@/lib/roles";
import Card from "@/components/Card";
import { Video, Doc, TextLesson, Interactive } from "@/components/learning/Viewers";
import { Gate, Btn, Input, Select, Textarea, Field, Badge, Tabs, Modal, Spinner, ErrorMsg, Notice, Empty, statusTone, fmtDate } from "@/components/ui";

type A = any;
const ICON: Record<string, string> = { video: "▶", pdf: "▤", presentation: "▦", quiz: "?", interactive: "◆", text: "¶" };

function Quiz({ lesson, staff, onDone }: { lesson: A; staff: boolean; onDone: () => void }) {
  const [quiz, setQuiz] = useState<A | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [res, setRes] = useState<A | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setQuiz(null); setRes(null); api<A>(`/api/learning/lessons/${lesson.id}/quiz`).then((q) => { setQuiz(q); setAnswers(q.questions.map(() => -1)); }).catch((e) => setError(e.message)); }, [lesson.id]);
  if (!quiz) return error ? <ErrorMsg error={error} /> : <Spinner />;
  async function submit() {
    setBusy(true); setError(null);
    try { const r = await api<A>(`/api/learning/lessons/${lesson.id}/quiz/attempt`, { method: "POST", body: JSON.stringify({ answers }) }); setRes(r); if (r.passed) onDone(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-coop-slate">Pass mark {quiz.pass_percent}%. {quiz.last_attempt && <>Last attempt: {quiz.last_attempt.score_percent}% {quiz.last_attempt.passed ? "✓" : ""}</>}</p>
      {quiz.questions.map((q: A, qi: number) => {
        const r = res?.results[qi];
        return (<fieldset key={q.id} className="rounded-md border border-black/10 p-4"><legend className="px-1 font-medium text-indigo">{qi + 1}. {q.prompt}</legend>
          <div className="space-y-2 mt-1">{q.options.map((o: string, oi: number) => (
            <label key={oi} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer ${r ? (oi === r.correct_index ? "bg-coop-green/10" : answers[qi] === oi ? "bg-red-50" : "") : "hover:bg-black/5"} ${staff && oi === q.correct_index ? "font-medium text-coop-green" : ""}`}>
              <input type="radio" name={q.id} disabled={!!res || staff} checked={answers[qi] === oi} onChange={() => setAnswers(answers.map((a, i) => (i === qi ? oi : a)))} />{o}</label>))}</div>
          {r && r.explanation && <p className="text-xs text-coop-slate mt-2">{r.correct ? "Correct. " : "Not quite. "}{r.explanation}</p>}</fieldset>);
      })}
      <ErrorMsg error={error} />
      {res && <Notice>{res.passed ? `Passed with ${res.score_percent}% 🎉` : `You scored ${res.score_percent}%. You need ${res.pass_percent}% to pass.`}</Notice>}
      {!staff && (res && !res.passed ? <Btn onClick={() => { setRes(null); setAnswers(quiz.questions.map(() => -1)); }}>Try again</Btn>
        : !res && <Btn onClick={submit} disabled={busy || answers.includes(-1)}>{busy ? "Checking…" : "Submit answers"}</Btn>)}
    </div>
  );
}

function QuizEditor({ lesson, onClose, onSaved }: { lesson: A; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("Quiz"); const [pass, setPass] = useState(60);
  const [qs, setQs] = useState<A[]>([{ prompt: "", options: ["", ""], correct_index: 0, explanation: "" }]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api<A>(`/api/learning/lessons/${lesson.id}/quiz`).then((q) => { setTitle(q.title); setPass(q.pass_percent); setQs(q.questions.map((x: A) => ({ prompt: x.prompt, options: x.options, correct_index: x.correct_index, explanation: x.explanation || "" }))); }).catch(() => {}); }, [lesson.id]);
  const upd = (i: number, p: A) => setQs(qs.map((q, j) => (j === i ? { ...q, ...p } : q)));
  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try { await api(`/api/learning/lessons/${lesson.id}/quiz`, { method: "PUT", body: JSON.stringify({ title, pass_percent: pass, questions: qs.map((q) => ({ ...q, explanation: q.explanation || null })) }) }); onSaved(); onClose(); } catch (x: any) { setError(x.message); }
  }
  return (
    <Modal title={`Quiz: ${lesson.title}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-3 gap-3"><div className="col-span-2"><Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field></div><Field label="Pass %"><Input type="number" min={1} max={100} value={pass} onChange={(e) => setPass(+e.target.value)} /></Field></div>
        {qs.map((q, i) => (<div key={i} className="rounded-md border border-black/10 p-3 space-y-2">
          <Field label={`Question ${i + 1}`}><Input required value={q.prompt} onChange={(e) => upd(i, { prompt: e.target.value })} /></Field>
          {q.options.map((o: string, oi: number) => (<div key={oi} className="flex items-center gap-2"><input type="radio" aria-label={`Option ${oi + 1} is correct`} checked={q.correct_index === oi} onChange={() => upd(i, { correct_index: oi })} />
            <Input required placeholder={`Option ${oi + 1}`} value={o} onChange={(e) => upd(i, { options: q.options.map((x: string, k: number) => (k === oi ? e.target.value : x)) })} />
            {q.options.length > 2 && <button type="button" aria-label="Remove option" className="text-red-600 focus-ring" onClick={() => upd(i, { options: q.options.filter((_: any, k: number) => k !== oi), correct_index: Math.min(q.correct_index, q.options.length - 2) })}>×</button>}</div>))}
          <div className="flex gap-3">{q.options.length < 6 && <button type="button" className="text-sm text-indigo underline focus-ring" onClick={() => upd(i, { options: [...q.options, ""] })}>+ option</button>}
            {qs.length > 1 && <button type="button" className="text-sm text-red-600 underline focus-ring" onClick={() => setQs(qs.filter((_, j) => j !== i))}>Remove question</button>}</div>
          <Input placeholder="Explanation (optional)" value={q.explanation} onChange={(e) => upd(i, { explanation: e.target.value })} /></div>))}
        <Btn type="button" variant="secondary" onClick={() => setQs([...qs, { prompt: "", options: ["", ""], correct_index: 0, explanation: "" }])}>Add question</Btn>
        <ErrorMsg error={error} /><div className="flex justify-end gap-2"><Btn type="button" variant="secondary" onClick={onClose}>Cancel</Btn><Btn type="submit">Save quiz</Btn></div>
      </form>
    </Modal>
  );
}

function LessonForm({ courseId, lesson, onClose, onSaved }: { courseId: string; lesson: A | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<A>(lesson ? { ...lesson, url: lesson.url || "", body: lesson.body || "" } : { title: "", content_type: "video", url: "", body: "", duration_min: 5 });
  const [error, setError] = useState<string | null>(null);
  const t = f.content_type;
  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const body = clean({ title: f.title, content_type: t, url: ["video", "pdf", "presentation"].includes(t) ? f.url : "", body: ["text", "interactive"].includes(t) ? f.body : "", duration_min: Number(f.duration_min) || 5 });
    try { await api(lesson ? `/api/learning/lessons/${lesson.id}` : `/api/learning/courses/${courseId}/lessons`, { method: lesson ? "PUT" : "POST", body: JSON.stringify(body) }); onSaved(); onClose(); } catch (x: any) { setError(x.message); }
  }
  return (
    <Modal title={lesson ? "Edit lesson" : "Add lesson"} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Title"><Input required minLength={2} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Type"><Select value={t} onChange={(e) => setF({ ...f, content_type: e.target.value })}>{["video", "pdf", "presentation", "interactive", "text", "quiz"].map((x) => <option key={x}>{x}</option>)}</Select></Field>
          <Field label="Minutes"><Input type="number" min={1} value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: e.target.value })} /></Field></div>
        {["video", "pdf", "presentation"].includes(t) && <Field label="Link" hint={t === "video" ? "YouTube, Vimeo or a direct .mp4 link" : t === "presentation" ? "PDF export, or a public .pptx link" : "Public PDF link"}><Input required type="url" placeholder="https://" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></Field>}
        {t === "text" && <Field label="Content" hint="Supports ## headings, - lists and **bold**"><Textarea rows={8} required value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>}
        {t === "interactive" && <Field label="Interactive JSON" hint='{"type":"steps","steps":[{"title":"","content":""}]} or {"type":"flashcards","cards":[{"front":"","back":""}]}'><Textarea rows={8} required className="font-mono text-xs" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>}
        {t === "quiz" && <p className="text-sm text-coop-slate">After saving, use “Edit quiz” to add questions.</p>}
        <ErrorMsg error={error} /><div className="flex justify-end gap-2"><Btn type="button" variant="secondary" onClick={onClose}>Cancel</Btn><Btn type="submit">Save</Btn></div>
      </form>
    </Modal>
  );
}

function Assignments({ course, staff, reload }: { course: A; staff: boolean; reload: () => void }) {
  const [sub, setSub] = useState<{ a: A; content: string; link: string } | null>(null);
  const [create, setCreate] = useState<A | null>(null);
  const [grading, setGrading] = useState<{ a: A; list: A[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const call = async (fn: () => Promise<any>, done?: () => void) => { setError(null); try { await fn(); done?.(); reload(); } catch (e: any) { setError(e.message); } };
  return (
    <div className="space-y-4">
      {staff && <Btn onClick={() => setCreate({ title: "", instructions: "", due_date: "", max_marks: 100 })}>New assignment</Btn>}
      {!sub && !create && !grading && <ErrorMsg error={error} />}
      {course.assignments.length === 0 && <Empty>No assignments in this course.</Empty>}
      {course.assignments.map((a: A) => (
        <Card key={a.id}><div className="flex justify-between gap-2"><div><h3 className="font-medium text-indigo">{a.title}</h3><p className="text-xs text-coop-slate">Due {fmtDate(a.due_date)} · {a.max_marks} marks</p></div>
          {a.submission && <Badge tone={statusTone(a.submission.status)}>{a.submission.status}{a.submission.marks != null ? ` · ${a.submission.marks}/${a.max_marks}` : ""}</Badge>}</div>
          <p className="text-sm mt-2 whitespace-pre-wrap">{a.instructions}</p>
          {a.submission?.feedback && <p className="text-sm mt-2 rounded bg-coop-paper p-2">Feedback: {a.submission.feedback}</p>}
          <div className="mt-3 flex gap-2">
            {!staff && a.submission?.status !== "graded" && <Btn onClick={() => setSub({ a, content: a.submission?.content || "", link: a.submission?.link || "" })}>{a.submission ? "Edit submission" : "Submit"}</Btn>}
            {staff && <><Btn variant="secondary" onClick={() => call(async () => setGrading({ a, list: await api<A[]>(`/api/learning/assignments/${a.id}/submissions`) }))}>Submissions ({a.submissions})</Btn>
              <Btn variant="ghost" onClick={() => confirm("Delete this assignment and its submissions?") && call(() => api(`/api/learning/assignments/${a.id}`, { method: "DELETE" }))}>Delete</Btn></>}</div></Card>))}
      {sub && <Modal title={sub.a.title} onClose={() => setSub(null)}><form className="space-y-3" onSubmit={(e) => { e.preventDefault(); call(() => api(`/api/learning/assignments/${sub.a.id}/submit`, { method: "POST", body: JSON.stringify(clean({ content: sub.content, link: sub.link })) }), () => setSub(null)); }}>
        <Field label="Your answer"><Textarea rows={6} maxLength={5000} value={sub.content} onChange={(e) => setSub({ ...sub, content: e.target.value })} /></Field>
        <Field label="Link (optional)"><Input type="url" placeholder="https://" value={sub.link} onChange={(e) => setSub({ ...sub, link: e.target.value })} /></Field>
        <ErrorMsg error={error} /><div className="flex justify-end"><Btn type="submit">Submit</Btn></div></form></Modal>}
      {create && <Modal title="New assignment" onClose={() => setCreate(null)}><form className="space-y-3" onSubmit={(e) => { e.preventDefault(); call(() => api(`/api/learning/courses/${course.id}/assignments`, { method: "POST", body: JSON.stringify(clean({ ...create, max_marks: Number(create.max_marks) })) }), () => setCreate(null)); }}>
        <Field label="Title"><Input required minLength={2} value={create.title} onChange={(e) => setCreate({ ...create, title: e.target.value })} /></Field>
        <Field label="Instructions"><Textarea rows={5} value={create.instructions} onChange={(e) => setCreate({ ...create, instructions: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Due date"><Input type="date" value={create.due_date} onChange={(e) => setCreate({ ...create, due_date: e.target.value })} /></Field><Field label="Max marks"><Input type="number" min={1} value={create.max_marks} onChange={(e) => setCreate({ ...create, max_marks: e.target.value })} /></Field></div>
        <ErrorMsg error={error} /><div className="flex justify-end"><Btn type="submit">Create</Btn></div></form></Modal>}
      {grading && <Modal title={`Submissions: ${grading.a.title}`} onClose={() => setGrading(null)}><div className="space-y-4">
        {grading.list.length === 0 && <p className="text-sm text-coop-slate">Nothing submitted yet.</p>}
        {grading.list.map((s) => <GradeRow key={s.id} s={s} max={grading.a.max_marks} onSaved={async () => setGrading({ ...grading, list: await api<A[]>(`/api/learning/assignments/${grading.a.id}/submissions`) })} />)}</div></Modal>}
    </div>
  );
}

function GradeRow({ s, max, onSaved }: { s: A; max: number; onSaved: () => void }) {
  const [marks, setMarks] = useState(s.marks ?? ""); const [fb, setFb] = useState(s.feedback || ""); const [error, setError] = useState<string | null>(null);
  return (<div className="rounded-md border border-black/10 p-3 space-y-2"><div className="flex justify-between"><b className="text-sm">{s.user_name}</b><Badge tone={statusTone(s.status)}>{s.status}</Badge></div>
    <p className="text-sm whitespace-pre-wrap">{s.content}</p>{s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo underline">{s.link}</a>}
    <div className="flex gap-2 items-end"><div className="w-24"><Field label={`Marks /${max}`}><Input type="number" min={0} max={max} value={marks} onChange={(e) => setMarks(e.target.value)} /></Field></div>
      <div className="flex-1"><Field label="Feedback"><Input value={fb} onChange={(e) => setFb(e.target.value)} /></Field></div>
      <Btn disabled={marks === ""} onClick={() => api(`/api/learning/submissions/${s.id}/grade`, { method: "PATCH", body: JSON.stringify({ marks: Number(marks), feedback: fb || null }) }).then(onSaved).catch((e) => setError(e.message))}>Grade</Btn></div><ErrorMsg error={error} /></div>);
}

function Player() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const staff = !!user && STAFF.includes(user.role);
  const [course, setCourse] = useState<A | null>(null);
  const [tab, setTab] = useState("lessons");
  const [cur, setCur] = useState<string>("");
  const [learners, setLearners] = useState<A[] | null>(null);
  const [lessonForm, setLessonForm] = useState<A | "new" | null>(null);
  const [quizEdit, setQuizEdit] = useState<A | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => { api<A>(`/api/learning/courses/${courseId}`).then((c) => { setCourse(c); setCur((x) => x || (c.lessons.find((l: A) => !l.completed) || c.lessons[0])?.id || ""); }).catch((e) => setError(e.message)); }, [courseId]);
  useEffect(load, [load]);
  useEffect(() => { if (staff && tab === "learners") api<A[]>(`/api/learning/courses/${courseId}/learners`).then(setLearners).catch((e) => setError(e.message)); }, [staff, tab, courseId]);

  if (!course) return error ? <ErrorMsg error={error} /> : <Spinner />;
  const lesson = course.lessons.find((l: A) => l.id === cur);
  const idx = course.lessons.findIndex((l: A) => l.id === cur);

  async function complete() {
    setBusy(true); setError(null);
    try { const r = await api<A>(`/api/learning/lessons/${cur}/complete`, { method: "POST" }); setMsg(r.completed ? "Course complete! Your certificate is on your dashboard." : null); load(); const next = course.lessons[idx + 1]; if (next) setCur(next.id); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <Link href="/learning" className="text-sm text-indigo underline focus-ring">← All courses</Link>
      <div className="flex flex-wrap items-end justify-between gap-3 mt-3 mb-4"><div><h1 className="font-display text-3xl font-semibold text-indigo">{course.title}</h1><p className="text-coop-slate text-sm mt-1">{course.description}</p></div>
        {course.enrolled && <div className="w-48"><div className="flex justify-between text-xs mb-1"><span>Progress</span><span>{Math.round(course.progress_percent)}%</span></div><div className="h-2 rounded-full bg-black/10"><div className="h-2 rounded-full bg-coop-green" style={{ width: `${course.progress_percent}%` }} /></div></div>}</div>
      {!course.can_view_content && <Card className="text-center"><p className="text-coop-slate mb-3">Enrol to access lessons, quizzes and assignments.</p><Btn onClick={() => api(`/api/learning/courses/${courseId}/enroll`, { method: "POST" }).then(load).catch((e) => setError(e.message))}>Enrol now</Btn></Card>}
      {msg && <Notice>{msg}</Notice>}<ErrorMsg error={lessonForm || quizEdit ? null : error} />
      {course.can_view_content && (<>
        <Tabs value={tab} onChange={setTab} tabs={[{ id: "lessons", label: "Lessons" }, { id: "assignments", label: `Assignments (${course.assignments.length})` }, ...(staff ? [{ id: "learners", label: "Learners" }] : [])]} />
        <div className="mt-6">
          {tab === "lessons" && (
            <div className="grid lg:grid-cols-[18rem_1fr] gap-6">
              <aside><ol className="space-y-1">{course.lessons.map((l: A) => (
                <li key={l.id}><button onClick={() => { setCur(l.id); setMsg(null); }} aria-current={l.id === cur} className={`w-full text-left rounded-md px-3 py-2 text-sm flex items-start gap-2 focus-ring ${l.id === cur ? "bg-indigo text-white" : "hover:bg-black/5"}`}>
                  <span aria-hidden>{l.completed ? "✓" : ICON[l.content_type]}</span><span className="flex-1">{l.title}<span className={`block text-xs ${l.id === cur ? "text-white/70" : "text-coop-slate"}`}>{l.content_type} · {l.duration_min} min</span></span></button></li>))}</ol>
                {staff && <Btn variant="secondary" className="mt-3 w-full" onClick={() => setLessonForm("new")}>Add lesson</Btn>}</aside>
              <section>{!lesson ? <Empty>This course has no lessons yet.</Empty> : (
                <Card><div className="flex flex-wrap justify-between gap-2 mb-4"><h2 className="font-display text-xl text-indigo">{lesson.title}</h2>
                  {staff && <div className="flex gap-2">{lesson.content_type === "quiz" && <Btn variant="secondary" onClick={() => setQuizEdit(lesson)}>Edit quiz</Btn>}<Btn variant="secondary" onClick={() => setLessonForm(lesson)}>Edit</Btn>
                    <Btn variant="ghost" onClick={() => confirm("Delete this lesson?") && api(`/api/learning/lessons/${lesson.id}`, { method: "DELETE" }).then(() => { setCur(""); load(); }).catch((e) => setError(e.message))}>Delete</Btn></div>}</div>
                  {lesson.content_type === "video" && lesson.url && <Video url={lesson.url} />}
                  {lesson.content_type === "pdf" && lesson.url && <Doc url={lesson.url} />}
                  {lesson.content_type === "presentation" && lesson.url && <Doc url={lesson.url} presentation />}
                  {lesson.content_type === "text" && <TextLesson body={lesson.body || ""} />}
                  {lesson.content_type === "interactive" && <Interactive key={lesson.id} body={lesson.body || "{}"} />}
                  {lesson.content_type === "quiz" && (lesson.has_quiz ? <Quiz key={lesson.id} lesson={lesson} staff={staff} onDone={load} /> : <Empty>{staff ? "No questions yet. Use “Edit quiz”." : "Quiz coming soon."}</Empty>)}
                  {user?.role === "trainee" && lesson.content_type !== "quiz" && <div className="mt-5 flex items-center justify-between">
                    {lesson.completed ? <Badge tone="green">Completed</Badge> : <Btn onClick={complete} disabled={busy}>{busy ? "Saving…" : "Mark complete & continue"}</Btn>}</div>}
                </Card>)}</section>
            </div>)}
          {tab === "assignments" && <Assignments course={course} staff={staff} reload={load} />}
          {tab === "learners" && (!learners ? <Spinner /> : learners.length === 0 ? <Empty>No learners enrolled.</Empty> : (
            <div className="overflow-x-auto"><Card className="!p-0 min-w-[520px]"><table className="w-full text-sm"><thead className="text-left text-coop-slate border-b border-black/10"><tr><th className="p-3">Learner</th><th>Progress</th><th>Best quiz</th><th>Assignments</th></tr></thead>
              <tbody>{learners.map((l) => <tr key={l.user_id} className="border-b border-black/5 last:border-0"><td className="p-3">{l.name}</td><td>{Math.round(l.progress_percent)}% {l.completed && <Badge tone="green">Done</Badge>}</td><td>{l.quiz_best_percent ?? "—"}{l.quiz_best_percent != null && "%"}</td><td>{l.assignments_submitted}/{l.assignments_total}</td></tr>)}</tbody></table></Card></div>))}
        </div></>)}
      {lessonForm && <LessonForm courseId={courseId} lesson={lessonForm === "new" ? null : lessonForm} onClose={() => setLessonForm(null)} onSaved={load} />}
      {quizEdit && <QuizEditor lesson={quizEdit} onClose={() => setQuizEdit(null)} onSaved={load} />}
    </>
  );
}
export default function CoursePage() { return <Gate><Player /></Gate>; }
