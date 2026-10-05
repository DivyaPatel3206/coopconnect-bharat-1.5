"""CoopConnect AI layer API (/api/ai/*)."""
import json, re
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models, models_ext as mx, security
from app.database import get_db
from app.deps import require_roles, ADMINS
from app.ai import engine as E, retrieval as R, docs as D, admin as A

router = APIRouter(prefix="/api/ai", tags=["ai"])

INTENTS = [("resume", ("resume", "cv", "interview")), ("study_plan", ("study plan", "schedule", "days to complete", "revision")),
           ("scheme", ("scheme", "yojana", "subsidy", "eligib", "benefit", "apply for")), ("jobs", ("job", "intern", "vacanc", "hiring", "opening", "career")),
           ("courses", ("course", "learn", "skill", "certificat", "train")), ("next", ("next", "what should i do", "improve"))]
LANGS = {"en": "English", "hi": "Hindi", "gu": "Gujarati", "mr": "Marathi", "ta": "Tamil", "bn": "Bengali"}


def intent_of(m: str) -> str:
    m = m.lower()
    return next((n for n, ks in INTENTS if any(k in m for k in ks)), "general")


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    language: str = "en"
    page: Optional[str] = None
    history: List[dict] = []


@router.post("/copilot")
def copilot(b: ChatIn, db: Session = Depends(get_db), u: models.User = Depends(security.get_current_user)):
    intent = intent_of(b.message)
    docs = R.build_index(db)
    KB = {"Policy", "Scheme", "Handbook", "Guideline"}
    kb_hits = R.search(docs, b.message, k=2, kinds=KB)
    rest = [h for h in R.search(docs, b.message, k=6) if h["id"] not in {x["id"] for x in kb_hits}]
    hits = (kb_hits + rest)[:5]
    conf = R.confidence(hits, b.message)
    st = E.state(db, u)
    jobs = E.job_analysis(db, u, st)
    gaps = E.gap_skills(jobs)
    sources = [{"n": i + 1, "title": h["title"], "kind": h["kind"], "snippet": h["snippet"], "href": h["href"], "demo": h["demo"]} for i, h in enumerate(hits[:4])]
    ctx = (f"Learner: {u.name}; location {u.location}; interests {u.career_interests}; skills {', '.join(f'{k} {v}%' for k, v in st['skills'].items()) or 'none'}; "
           f"certificates {', '.join(c.programme_name for c in u.certificates) or 'none'}; skill gaps for best-matching jobs: {', '.join(gaps) or 'none'}; "
           f"top jobs: {'; '.join(f'{j['title']} {j['match']}%' for j in jobs[:3])}.")
    src_txt = "\n\n".join(f"[S{s['n']}] ({s['kind']}) {s['title']}: {h['text'][:700]}" for s, h in zip(sources, hits))
    sys_p = ("You are CoopConnect AI, an assistant on India's cooperative training and employment platform. Answer ONLY from the SOURCES and LEARNER CONTEXT. "
             "Cite sources inline like [S1]. If the sources do not contain the answer, say you could not find it in CoopConnect's knowledge base and suggest asking the institution; never invent schemes, dates, amounts or eligibility. "
             "Recommendations are suggestions, never official decisions. Keep it under 180 words with short bullets. Reply in " + LANGS.get(b.language, "English") + ". Use plain, simple words.\n\nLEARNER CONTEXT: " + ctx + "\n\nSOURCES:\n" + (src_txt or "(none found)"))
    msgs = [{"role": m["role"], "content": m["content"]} for m in b.history[-6:] if m.get("role") in ("user", "assistant") and m.get("content")]
    while msgs and msgs[0]["role"] != "user": msgs.pop(0)
    msgs.append({"role": "user", "content": b.message})
    ans, mode = E.llm(sys_p, msgs, 600), "llm"
    if not ans:
        mode = "retrieval"
        if intent in ("jobs",) and jobs:
            ans = "Best-matched openings for your profile:\n" + "\n".join(f"- {j['title']} at {j['company']}: {j['match']}% match" + (f" (missing: {', '.join(j['missing'][:2])})" if j['missing'] else "") for j in jobs[:3])
        elif intent in ("courses", "next"):
            rec = E.course_recs(db, u, st, gaps, 3)
            na = E.next_action(db, u, st, jobs, gaps)
            ans = f"Suggested next step: {na['label']}. {na['why']}" + ("\nCourses for you:\n" + "\n".join(f"- {r['title']}" for r in rec) if rec else "")
        elif conf != "low":
            parts = []
            kb = [h for h in hits if h["kind"] in ("Policy", "Scheme", "Handbook", "Guideline")] or hits
            for h in kb[:2]:
                parts += [x for x in D.best_sentences(h["text"], b.message, 2) if len(x) > 45] or [h["text"][:260]]
            ans = "Based on the CoopConnect sources below:\n" + "\n".join(f"- {p}" for p in parts[:4])
        else:
            ans = "I could not find a reliable answer to this in CoopConnect's knowledge base, so I will not guess. Try rephrasing, or ask your institution or the district cooperative office."
            sources = sources[:1] if conf == "medium" else []
    fu = {"jobs": [("Improve my match", "What skills should I learn to improve my job match?"), ("Open Jobs", "/jobs")],
          "courses": [("Make a study plan", "/ai-studio?tab=plan"), ("Career roadmap", "/career-path")],
          "scheme": [("Explain simply", "Explain this in simple words"), ("Which documents are needed?", "Which documents are usually needed to apply?")],
          "resume": [("Analyse my resume", "/ai-studio?tab=docs")], "study_plan": [("Build my plan", "/ai-studio?tab=plan")],
          "next": [("Open my AI profile", "/ai-profile")], "general": [("What should I do next?", "What should I do next?"), ("Find schemes for me", "Which schemes may suit me?")]}[intent]
    return {"answer": ans, "intent": intent, "mode": mode, "confidence": conf, "sources": sources if mode == "llm" or conf != "low" else [],
            "followups": [{"label": l, **({"href": v} if v.startswith("/") else {"prompt": v})} for l, v in fu], "ai_generated": True,
            "notice": "AI-generated guidance. It is not an official decision."}


class TextIn(BaseModel):
    text: str = Field(min_length=3, max_length=6000)
    language: str = "en"
    mode: str = "simplify"


LEGAL = [("the applicant's", "your"), ("shall be determined subject to", "will depend on"), ("notwithstanding", "even if"), ("pursuant to", "under"), ("hereinafter", "from now on"), ("in accordance with", "following"),
         ("the applicant", "you"), ("eligibility shall be", "you can apply if it is"), ("shall", "must"), ("prior to", "before"), ("commence", "start"), ("aforementioned", "mentioned earlier"),
         ("provided that", "as long as"), ("failing which", "otherwise"), ("deemed", "treated as"), ("subsequent to", "after"), ("endeavour", "try"), ("remit", "pay"), ("whereas", "because")]


@router.post("/simplify")
def simplify(b: TextIn, u: models.User = Depends(security.get_current_user)):
    lang = LANGS.get(b.language, "English")
    task = f"Translate into {lang}, keeping meaning exact." if b.mode == "translate" else f"Rewrite in very simple {lang} for a rural learner. Start with 'Simply put:'. Do not add facts."
    out = E.llm("You help Indian learners understand official text. " + task + " Output only the result.", [{"role": "user", "content": b.text}], 700)
    if out:
        return {"result": out, "mode": "llm", "ai_generated": True}
    if b.mode == "translate":
        return {"result": None, "mode": "unavailable", "message": "Translation needs the AI model. Set ANTHROPIC_API_KEY on the backend to enable Hindi, Gujarati and other languages.", "ai_generated": True}
    t = b.text
    for a, s in LEGAL:
        t = re.sub(a, s, t, flags=re.I)
    return {"result": "Simply put: " + t, "mode": "rules", "message": "Basic simplification (word replacement). Connect an AI key for full rewriting.", "ai_generated": True}


@router.get("/profile")
def ai_profile(db: Session = Depends(get_db), u: models.User = Depends(security.get_current_user)):
    st = E.state(db, u)
    skills = E.skill_profile(db, u, st)
    jobs = E.job_analysis(db, u, st)
    gaps = E.gap_skills(jobs)
    rd = E.readiness(db, u, st, jobs, skills)
    known = sorted([s for s in skills if s["score"] is not None], key=lambda s: -s["score"])
    strong = [s["name"] for s in known if s["score"] >= 70]
    weak = [s["name"] for s in known if s["score"] < 60] + [s["name"] for s in skills if s["score"] is None]
    txt = (f"Your strongest area is {known[0]['name']}. " if known else "We do not have enough data on your skills yet. ") + \
          (f"Improving {', '.join(gaps[:2])} could noticeably raise your match rate." if gaps else "Keep building your profile to unlock sharper recommendations.")
    done = sum(1 for e in st["enr"] if e["completed"])
    return {"skills": skills, "readiness": rd, "explanation": txt, "strengths": strong, "weaknesses": weak, "gaps": gaps, "career": jobs[:3],
            "behaviour": {"courses_started": len(st["enr"]), "courses_completed": done, "weak_topics": st["weak"][:4], "quiz_attempts": len(st["attempts"]),
                          "last_active": st["last_active"].isoformat() if st["last_active"] else None, "applications": len(st["apps"])},
            "interests": u.career_interests, "next": E.next_action(db, u, st, jobs, gaps), "ai_generated": True}


@router.get("/recommendations")
def recommendations(db: Session = Depends(get_db), u: models.User = Depends(security.get_current_user)):
    st = E.state(db, u)
    jobs = E.job_analysis(db, u, st)
    gaps = E.gap_skills(jobs)
    return {"courses": E.course_recs(db, u, st, gaps), "jobs": jobs[:5], "schemes": E.scheme_recs(db, u, st), "skills": gaps[:3],
            "certifications": [c for c in E.course_recs(db, u, st, gaps, 6) if True][:2], "next": E.next_action(db, u, st, jobs, gaps),
            "method": "Content-based matching + peer co-enrolment + job-gap analysis. Each item states its reason."}


@router.get("/insights")
def insights(db: Session = Depends(get_db), u: models.User = Depends(security.get_current_user)):
    st = E.state(db, u)
    jobs = E.job_analysis(db, u, st)
    gaps = E.gap_skills(jobs)
    out = []
    pc = E.percentile(db, u, st)
    if pc is not None:
        out.append({"title": "Learning pace", "text": f"You are progressing faster than {pc}% of learners on the platform.", "tone": "good" if pc >= 50 else "info"})
    if jobs and jobs[0]["match"] >= 50:
        out.append({"title": "Opportunities", "text": f"Your strongest opportunity right now is {jobs[0]['title']} ({jobs[0]['match']}% match)." + (f" Learning {jobs[0]['missing'][0]} would raise it." if jobs[0]["missing"] else ""), "tone": "info"})
    elif gaps:
        out.append({"title": "Skill gap", "text": f"AI detected a skill gap: {', '.join(gaps[:2])}. These appear most often in roles that fit you.", "tone": "action"})
    if st["weak"]:
        out.append({"title": "Weak topic", "text": f"You scored {st['weak'][0]['score']}% on '{st['weak'][0]['lesson']}'. A 5-question practice set can help.", "tone": "action", "href": "/ai-studio?tab=quiz"})
    na = E.next_action(db, u, st, jobs, gaps)
    return {"insights": out[:3], "next": na, "ai_generated": True}


@router.get("/notifications")
def smart_notifications(db: Session = Depends(get_db), u: models.User = Depends(security.get_current_user)):
    st = E.state(db, u)
    jobs = E.job_analysis(db, u, st)
    gaps = E.gap_skills(jobs)
    out = [{"title": "Recommended for you: " + r["title"], "text": r["why"], "href": f"/learning/{r['id']}"} for r in E.course_recs(db, u, st, gaps, 2)]
    for j in jobs[:1]:
        if j["match"] >= 60:
            out.append({"title": f"New strong match: {j['title']}", "text": f"{j['match']}% match based on your skills.", "href": "/jobs"})
    return out[:4]


class PlanIn(BaseModel):
    course_id: str
    days: int = 20


@router.post("/study-plan")
def study_plan(b: PlanIn, db: Session = Depends(get_db), u: models.User = Depends(security.get_current_user)):
    p = E.study_plan(db, u, b.course_id, b.days)
    if not p: raise HTTPException(404, "Course not found")
    return p


class QuizIn(BaseModel):
    course_id: Optional[str] = None
    n: int = Field(5, ge=1, le=10)
    topic: Optional[str] = None


@router.post("/quiz")
def quiz(b: QuizIn, db: Session = Depends(get_db), u: models.User = Depends(security.get_current_user)):
    st = E.state(db, u)
    weak = [w for w in st["weak"] if not b.course_id or w["course_id"] == b.course_id]
    topic = b.topic or (weak[0]["lesson"] if weak else None)
    if not topic and b.course_id:
        c = db.query(models.Course).filter(models.Course.id == b.course_id).first()
        topic = c.title if c else None
    if not topic:
        raise HTTPException(400, "Pick a course or a topic")
    lesson_ids = [w["lesson_id"] for w in weak]
    q = []
    if E.ANTHROPIC_KEY:
        raw = E.llm("Create multiple-choice questions for learners of an Indian cooperative training platform. Return ONLY JSON: a list of objects with keys prompt, options (4 strings), correct_index (0-3), explanation. Beginner friendly.",
                    [{"role": "user", "content": f"Topic: {topic}. Make {b.n} questions."}], 1200)
        try:
            q = json.loads(re.sub(r"```(json)?", "", raw or "").strip())[: b.n]
            for x in q: x["topic"] = topic
        except Exception:
            q = []
    mode = "ai_generated"
    if not q:
        mode = "question_bank"
        qs = db.query(mx.QuizQuestion).join(mx.Quiz, mx.Quiz.id == mx.QuizQuestion.quiz_id)
        if lesson_ids: qs = qs.filter(mx.Quiz.lesson_id.in_(lesson_ids))
        elif b.course_id: qs = qs.join(models.Lesson, models.Lesson.id == mx.Quiz.lesson_id).filter(models.Lesson.course_id == b.course_id)
        q = [{"prompt": x.prompt, "options": json.loads(x.options), "correct_index": x.correct_index, "explanation": x.explanation or "", "topic": topic} for x in qs.limit(b.n)]
    return {"topic": topic, "weak_topics": [w["lesson"] for w in weak], "questions": q, "mode": mode,
            "message": None if q else "No questions available yet for this topic. Connect an AI key to generate fresh ones."}


@router.get("/search")
def semantic_search(q: str, db: Session = Depends(get_db), u: models.User = Depends(security.get_current_user)):
    hits = R.search(R.build_index(db), q, k=14)
    groups = {}
    for h in hits:
        groups.setdefault(h["kind"] if h["kind"] in ("Course", "Job", "Programme") else "Knowledge & schemes", []).append(
            {"title": h["title"], "snippet": h["snippet"][:200], "href": h["href"], "score": h["score"], "demo": h["demo"]})
    return {"query": q, "intent": intent_of(q), "groups": groups, "method": "Hybrid keyword + synonym expansion + title reranking"}


GOALS = {"Cooperative Banking Officer": ["banking", "accounting", "cooperative management", "excel", "communication"],
         "Cooperative Accountant": ["accounting", "tally", "excel", "auditing", "record keeping"],
         "Dairy Cooperative Manager": ["dairy management", "cooperative management", "leadership", "accounting", "communication"],
         "FPO / Agri Cooperative Manager": ["agriculture", "cooperative management", "marketing", "digital payments", "leadership"],
         "Cooperative Society Secretary": ["cooperative management", "record keeping", "communication", "computer", "compliance"]}


@router.get("/career-path")
def career_path(goal: Optional[str] = None, db: Session = Depends(get_db), u: models.User = Depends(security.get_current_user)):
    if not goal:
        return {"goals": list(GOALS)}
    if goal not in GOALS: raise HTTPException(400, "Unknown goal")
    st = E.state(db, u)
    req = GOALS[goal]
    have = [s for s in req if any(s in h or h in s for h in st["have"])]
    gap = [s for s in req if s not in have]
    courses = db.query(models.Course).all()
    steps_c = []
    for g in gap:
        t = set(R.tokens(g))
        c = max(courses, key=lambda c: len(t & set(R.tokens(f"{c.title} {c.skill_tag or ''} {c.description or ''}"))), default=None)
        if c and t & set(R.tokens(f"{c.title} {c.skill_tag or ''} {c.description or ''}")):
            steps_c.append({"skill": g, "course_id": c.id, "title": c.title})
        else:
            steps_c.append({"skill": g, "course_id": None, "title": None})
    docs = R.build_index(db)
    jobs = [{"title": h["title"], "href": h["href"]} for h in R.search(docs, goal, k=6, kinds={"Job"})]
    interns = [j for j in jobs if "intern" in j["title"].lower()]
    return {"goal": goal, "required": req, "have": have, "gap": gap, "courses": steps_c,
            "certifications": [{"title": c.programme_name} for c in u.certificates][:3] or [{"title": "Earn a CoopConnect certificate in each gap course"}],
            "projects": [f"Build a small portfolio piece that uses {gap[0]}" if gap else "Document a real cooperative process end to end", "Prepare a one-page case note on a local cooperative society"],
            "internships": interns or [{"title": "Look for internships under Jobs (filter: Internship)", "href": "/jobs"}], "jobs": jobs[:3],
            "readiness": round(100 * len(have) / len(req)), "ai_generated": True}


@router.post("/document")
async def document(file: Optional[UploadFile] = File(None), text: str = Form(""), db: Session = Depends(get_db), u: models.User = Depends(security.get_current_user)):
    err = None
    if file is not None:
        data = await file.read()
        if len(data) > 8_000_000: raise HTTPException(413, "File too large (8 MB max)")
        text, err = D.extract_text(file.filename or "", data)
    text = (text or "").strip()
    if not text:
        return {"error": err or "Nothing to analyse. Upload a file or paste text."}
    cls = D.classify(text)
    ent = D.entities(text)
    out = {"text": text[:20000], "doc_type": cls["type"], "type_confidence": cls["confidence"], "entities": ent,
           "summary": D.summarize(text), "missing": D.missing_fields(cls["type"], text, ent), "ai_generated": True,
           "note": "Extracted automatically. Please verify important fields yourself."}
    if cls["type"] == "Resume":
        jobs = [{"id": j.id, "title": j.title, "company": j.employer.company_name if j.employer else "", "required_skills": j.required_skills} for j in db.query(models.Job).all()]
        vocab = [s.strip() for j in jobs for s in (j["required_skills"] or "").split(",") if s.strip()] + [c.skill_tag for c in db.query(models.Course).all() if c.skill_tag]
        out["resume"] = D.analyze_resume(text, vocab, jobs)
    return out


class AskDoc(BaseModel):
    text: str
    question: str


@router.post("/document/ask")
def ask_document(b: AskDoc, u: models.User = Depends(security.get_current_user)):
    out = E.llm("Answer the question using ONLY the document. If it is not in the document, say so. Be brief and simple.", [{"role": "user", "content": f"DOCUMENT:\n{b.text[:12000]}\n\nQUESTION: {b.question}"}], 400)
    if out: return {"answer": out, "mode": "llm"}
    s = D.best_sentences(b.text, b.question, 2)
    return {"answer": " ".join(s) if s else "I could not find this in the document.", "mode": "extractive"}


class AdminAsk(BaseModel):
    question: str = Field(min_length=2, max_length=300)


@router.post("/admin/ask")
def admin_ask(b: AdminAsk, db: Session = Depends(get_db), u: models.User = Depends(require_roles(*ADMINS))):
    r = A.ask(db, b.question)
    r["ai_generated"] = True
    r["notice"] = "AI-generated analysis of platform data. Predictions are estimates; confirm before acting on individuals."
    return r


@router.get("/admin/overview")
def admin_overview(db: Session = Depends(get_db), u: models.User = Depends(require_roles(*ADMINS))):
    return {"at_risk": A.dropout_risk(db), "completion": A.completion_by_district(db), "skills": A.skill_demand_supply(db)}


@router.get("/architecture")
def architecture(db: Session = Depends(get_db), u: models.User = Depends(require_roles(*ADMINS))):
    n = len(R.build_index(db))
    return {"stages": [
        {"name": "User & platform data", "detail": "Profiles, skills, enrolments, quiz attempts, jobs, programmes (SQL database)", "status": "live"},
        {"name": "Data processing", "detail": "Tokenisation, stemming, synonym expansion; section-level chunking of knowledge files", "status": "live"},
        {"name": "Index / embeddings", "detail": f"{n} indexed passages. Backend: TF-IDF (drop-in slot for sentence-transformers)", "status": "live"},
        {"name": "Vector / retrieval store", "detail": "In-memory index rebuilt per request (swap for pgvector / Qdrant at scale)", "status": "live"},
        {"name": "RAG retrieval + reranking", "detail": "Top-k passages, title-aware rerank, confidence gate that refuses to guess", "status": "live"},
        {"name": "LLM generation", "detail": f"Claude ({E.MODEL}) with grounded prompt and citations" if E.ANTHROPIC_KEY else "Not connected. Set ANTHROPIC_API_KEY. Retrieval-only answers are used meanwhile", "status": "live" if E.ANTHROPIC_KEY else "optional"},
        {"name": "Recommendation engine", "detail": "Content-based + peer co-enrolment + job-gap analysis, explainable reasons", "status": "live"},
        {"name": "Personalization engine", "detail": "Skill profile, readiness score, next-best-action from learner evidence", "status": "live"},
        {"name": "AI Copilot", "detail": "Persistent assistant: chat, voice, simplify, translate, contextual actions", "status": "live"}],
        "responsible_ai": ["Every answer shows sources and a confidence level", "Low confidence = the AI says it does not know", "Scores list their evidence", "Predictions are labelled as estimates", "Admissions and hiring decisions stay with people"]}
