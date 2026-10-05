"""Module 6 - Multimedia & interactive learning (video, PDF, slides, quizzes, interactive lessons, assignments)."""
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models, schemas, security, models_ext as mx
from app.database import get_db
from app.deps import require_roles, rv, row, get_or_404, parse_date, STAFF, TRAINEE
from app.routers import courses as courses_router

router = APIRouter(prefix="/api/learning", tags=["learning"])
TYPES = ("video", "pdf", "presentation", "quiz", "interactive", "text")


class CourseIn(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    description: Optional[str] = Field(None, max_length=1000)
    skill_tag: Optional[str] = Field(None, max_length=80)
    language: str = Field("English", max_length=40)
    programme_id: Optional[str] = None
    category: Optional[str] = Field(None, max_length=60)
    level: str = Field("Beginner", pattern=r"^(Beginner|Intermediate|Advanced)$")
    duration_hours: Optional[float] = Field(None, ge=0.5, le=500)
    instructor: Optional[str] = Field(None, max_length=120)
    institution_name: Optional[str] = Field(None, max_length=160)


class LessonIn(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    content_type: str
    url: Optional[str] = Field(None, max_length=500, pattern=r"^https?://.+")
    body: Optional[str] = Field(None, max_length=20000)
    duration_min: int = Field(5, ge=1, le=600)
    order_index: Optional[int] = None


class QuestionIn(BaseModel):
    prompt: str = Field(min_length=3, max_length=500)
    options: List[str] = Field(min_length=2, max_length=6)
    correct_index: int = Field(ge=0)
    explanation: Optional[str] = Field(None, max_length=500)


class QuizIn(BaseModel):
    title: str = Field("Quiz", max_length=120)
    pass_percent: int = Field(60, ge=1, le=100)
    questions: List[QuestionIn] = Field(min_length=1, max_length=50)


class AttemptIn(BaseModel):
    answers: List[int]


class AssignmentIn(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    instructions: Optional[str] = Field(None, max_length=3000)
    due_date: Optional[str] = None
    max_marks: int = Field(100, ge=1, le=1000)


class SubmitIn(BaseModel):
    content: Optional[str] = Field(None, max_length=5000)
    link: Optional[str] = Field(None, max_length=500, pattern=r"^https?://.+")


class GradeIn(BaseModel):
    marks: int = Field(ge=0)
    feedback: Optional[str] = Field(None, max_length=1000)


def _is_staff(u) -> bool:
    return rv(u) in STAFF


def _enrolled(db, u, course_id) -> bool:
    return _is_staff(u) or db.query(models.Enrollment).filter(
        models.Enrollment.user_id == u.id, models.Enrollment.course_id == course_id).count() > 0


def _lesson_out(db, l: models.Lesson, u, with_content: bool, done: set) -> dict:
    c = db.query(mx.LessonContent).filter(mx.LessonContent.lesson_id == l.id).first()
    q = db.query(mx.Quiz).filter(mx.Quiz.lesson_id == l.id).first()
    out = {"id": l.id, "title": l.title, "content_type": l.content_type, "order_index": l.order_index,
           "duration_min": c.duration_min if c else 5, "completed": l.id in done,
           "has_quiz": bool(q), "pass_percent": q.pass_percent if q else None}
    if with_content:
        out["url"] = c.url if c else None
        out["body"] = c.body if c else None
    return out


def _recalc(db: Session, u: models.User, course_id: str):
    lessons = db.query(models.Lesson).filter(models.Lesson.course_id == course_id).all()
    if not lessons:
        return None
    ids = [l.id for l in lessons]
    done = db.query(mx.LessonProgress).filter(mx.LessonProgress.user_id == u.id, mx.LessonProgress.lesson_id.in_(ids)).count()
    pct = round(done / len(lessons) * 100, 1)
    # Reuse the existing progress endpoint logic: it also issues the certificate at 100%.
    return courses_router.update_progress(schemas.ProgressUpdate(course_id=course_id, progress_percent=pct), db, u)


def _done_ids(db, u, course_id) -> set:
    ids = [l.id for l in db.query(models.Lesson).filter(models.Lesson.course_id == course_id)]
    return {p.lesson_id for p in db.query(mx.LessonProgress).filter(
        mx.LessonProgress.user_id == u.id, mx.LessonProgress.lesson_id.in_(ids or ["-"]))}


META_FIELDS = ("category", "level", "duration_hours", "instructor", "institution_name")


def _meta(db, cid) -> dict:
    m = db.query(mx.CourseMeta).filter(mx.CourseMeta.course_id == cid).first()
    return {k: getattr(m, k) if m else (None if k != "level" else "Beginner") for k in META_FIELDS}


def _save_meta(db, cid, body: "CourseIn"):
    m = db.query(mx.CourseMeta).filter(mx.CourseMeta.course_id == cid).first() or mx.CourseMeta(course_id=cid)
    for k in META_FIELDS:
        setattr(m, k, getattr(body, k))
    db.add(m)


# ---------- catalogue ----------
@router.get("/courses")
def list_courses(db: Session = Depends(get_db), user: models.User = Depends(security.get_current_user)):
    enr = {e.course_id: e for e in db.query(models.Enrollment).filter(models.Enrollment.user_id == user.id)}
    out = []
    for c in db.query(models.Course).order_by(models.Course.title):
        link = db.query(mx.ProgrammeCourse).filter(mx.ProgrammeCourse.course_id == c.id).first()
        e = enr.get(c.id)
        out.append({"id": c.id, "title": c.title, "description": c.description, "skill_tag": c.skill_tag,
                    "language": c.language, "lessons": len(c.lessons), "programme_id": link.programme_id if link else None,
                    "enrolled": bool(e), "progress_percent": e.progress_percent if e else 0,
                    "completed": e.completed if e else False, **_meta(db, c.id)})
    return out


@router.post("/courses/{cid}/enroll")
def enroll(cid: str, db: Session = Depends(get_db), user: models.User = Depends(require_roles(TRAINEE))):
    get_or_404(db, models.Course, cid, "Course")
    e = db.query(models.Enrollment).filter(models.Enrollment.user_id == user.id, models.Enrollment.course_id == cid).first()
    if not e:
        e = models.Enrollment(user_id=user.id, course_id=cid)
        db.add(e)
        db.commit()
    return {"course_id": cid, "progress_percent": e.progress_percent}


@router.get("/courses/{cid}")
def course_detail(cid: str, db: Session = Depends(get_db), user: models.User = Depends(security.get_current_user)):
    c = get_or_404(db, models.Course, cid, "Course")
    ok = _enrolled(db, user, cid)
    done = _done_ids(db, user, cid)
    lessons = sorted(c.lessons, key=lambda l: l.order_index)
    e = db.query(models.Enrollment).filter(models.Enrollment.user_id == user.id, models.Enrollment.course_id == cid).first()
    subs = {s.assignment_id: s for s in db.query(mx.AssignmentSubmission).filter(mx.AssignmentSubmission.user_id == user.id)}
    assigns = []
    for a in db.query(mx.Assignment).filter(mx.Assignment.course_id == cid).order_by(mx.Assignment.due_date):
        s = subs.get(a.id)
        assigns.append({**row(a), "submission": row(s, ("user_id",)) if s else None,
                        "submissions": db.query(mx.AssignmentSubmission).filter(mx.AssignmentSubmission.assignment_id == a.id).count() if _is_staff(user) else None})
    link = db.query(mx.ProgrammeCourse).filter(mx.ProgrammeCourse.course_id == cid).first()
    return {"id": c.id, "title": c.title, "description": c.description, "skill_tag": c.skill_tag, "language": c.language, **_meta(db, c.id),
            "programme_id": link.programme_id if link else None, "enrolled": bool(e), "can_view_content": ok,
            "progress_percent": e.progress_percent if e else 0, "completed": e.completed if e else False,
            "lessons": [_lesson_out(db, l, user, ok, done) for l in lessons], "assignments": assigns if ok else []}


# ---------- authoring (staff) ----------
def _link(db, course_id, programme_id):
    db.query(mx.ProgrammeCourse).filter(mx.ProgrammeCourse.course_id == course_id).delete()
    if programme_id:
        get_or_404(db, models.Programme, programme_id, "Programme")
        db.add(mx.ProgrammeCourse(course_id=course_id, programme_id=programme_id))


@router.post("/courses", status_code=201)
def create_course(body: CourseIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*STAFF))):
    c = models.Course(**body.model_dump(exclude={"programme_id", *META_FIELDS}))
    db.add(c)
    db.flush()
    _link(db, c.id, body.programme_id)
    _save_meta(db, c.id, body)
    db.commit()
    return {"id": c.id}


@router.put("/courses/{cid}")
def update_course(cid: str, body: CourseIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*STAFF))):
    c = get_or_404(db, models.Course, cid, "Course")
    for k, v in body.model_dump(exclude={"programme_id", *META_FIELDS}).items():
        setattr(c, k, v)
    _link(db, c.id, body.programme_id)
    _save_meta(db, c.id, body)
    db.commit()
    return {"id": c.id}


def _save_lesson(db, l: models.Lesson, body: LessonIn):
    if body.content_type not in TYPES:
        raise HTTPException(status_code=422, detail=f"Lesson type must be one of: {', '.join(TYPES)}")
    if body.content_type in ("video", "pdf", "presentation") and not body.url:
        raise HTTPException(status_code=422, detail="A link is required for video, PDF and presentation lessons")
    if body.content_type in ("text", "interactive") and not body.body:
        raise HTTPException(status_code=422, detail="Lesson content is required")
    if body.content_type == "interactive":
        try:
            data = json.loads(body.body)
            assert data.get("type") in ("steps", "flashcards")
            assert data.get("steps") or data.get("cards")
        except Exception:
            raise HTTPException(status_code=422, detail='Interactive content must be JSON: {"type":"steps"|"flashcards", "steps"|"cards":[...]}')
    l.title, l.content_type = body.title, body.content_type
    c = db.query(mx.LessonContent).filter(mx.LessonContent.lesson_id == l.id).first() or mx.LessonContent(lesson_id=l.id)
    c.url, c.body, c.duration_min = body.url, body.body, body.duration_min
    db.add(c)


@router.post("/courses/{cid}/lessons", status_code=201)
def add_lesson(cid: str, body: LessonIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*STAFF))):
    course = get_or_404(db, models.Course, cid, "Course")
    idx = body.order_index if body.order_index is not None else len(course.lessons)
    l = models.Lesson(course_id=cid, title=body.title, content_type=body.content_type, order_index=idx)
    db.add(l)
    db.flush()
    _save_lesson(db, l, body)
    db.commit()
    return {"id": l.id}


@router.put("/lessons/{lid}")
def edit_lesson(lid: str, body: LessonIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*STAFF))):
    l = get_or_404(db, models.Lesson, lid, "Lesson")
    _save_lesson(db, l, body)
    if body.order_index is not None:
        l.order_index = body.order_index
    db.commit()
    return {"id": l.id}


@router.delete("/lessons/{lid}", status_code=204)
def delete_lesson(lid: str, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*STAFF))):
    l = get_or_404(db, models.Lesson, lid, "Lesson")
    qz = db.query(mx.Quiz).filter(mx.Quiz.lesson_id == lid).first()
    if qz:
        db.query(mx.QuizQuestion).filter(mx.QuizQuestion.quiz_id == qz.id).delete()
        db.query(mx.QuizAttempt).filter(mx.QuizAttempt.quiz_id == qz.id).delete()
        db.delete(qz)
    db.query(mx.LessonContent).filter(mx.LessonContent.lesson_id == lid).delete()
    db.query(mx.LessonProgress).filter(mx.LessonProgress.lesson_id == lid).delete()
    db.delete(l)
    db.commit()


# ---------- progress ----------
@router.post("/lessons/{lid}/complete")
def complete_lesson(lid: str, db: Session = Depends(get_db), user: models.User = Depends(require_roles(TRAINEE))):
    l = get_or_404(db, models.Lesson, lid, "Lesson")
    if not _enrolled(db, user, l.course_id):
        raise HTTPException(status_code=403, detail="Enrol in the course first")
    if l.content_type == "quiz":
        raise HTTPException(status_code=400, detail="Pass the quiz to complete this lesson")
    if not db.query(mx.LessonProgress).filter(mx.LessonProgress.user_id == user.id, mx.LessonProgress.lesson_id == lid).first():
        db.add(mx.LessonProgress(user_id=user.id, lesson_id=lid))
        db.commit()
    e = _recalc(db, user, l.course_id)
    return {"progress_percent": e.progress_percent, "completed": e.completed}


# ---------- quiz ----------
@router.put("/lessons/{lid}/quiz")
def save_quiz(lid: str, body: QuizIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*STAFF))):
    l = get_or_404(db, models.Lesson, lid, "Lesson")
    for i, q in enumerate(body.questions, 1):
        if q.correct_index >= len(q.options):
            raise HTTPException(status_code=422, detail=f"Question {i}: correct answer is out of range")
        if len({o.strip().lower() for o in q.options}) != len(q.options) or any(not o.strip() for o in q.options):
            raise HTTPException(status_code=422, detail=f"Question {i}: options must be non-empty and different")
    qz = db.query(mx.Quiz).filter(mx.Quiz.lesson_id == lid).first()
    if not qz:
        qz = mx.Quiz(lesson_id=lid)
        db.add(qz)
        db.flush()
    qz.title, qz.pass_percent = body.title, body.pass_percent
    db.query(mx.QuizQuestion).filter(mx.QuizQuestion.quiz_id == qz.id).delete()
    for i, q in enumerate(body.questions):
        db.add(mx.QuizQuestion(quiz_id=qz.id, prompt=q.prompt, options=json.dumps(q.options),
                               correct_index=q.correct_index, explanation=q.explanation, order_index=i))
    l.content_type = "quiz"
    db.commit()
    return {"quiz_id": qz.id, "questions": len(body.questions)}


def _quiz_for(db, lid):
    qz = db.query(mx.Quiz).filter(mx.Quiz.lesson_id == lid).first()
    if not qz:
        raise HTTPException(status_code=404, detail="This lesson has no quiz")
    qs = db.query(mx.QuizQuestion).filter(mx.QuizQuestion.quiz_id == qz.id).order_by(mx.QuizQuestion.order_index).all()
    return qz, qs


@router.get("/lessons/{lid}/quiz")
def get_quiz(lid: str, db: Session = Depends(get_db), user: models.User = Depends(security.get_current_user)):
    l = get_or_404(db, models.Lesson, lid, "Lesson")
    if not _enrolled(db, user, l.course_id):
        raise HTTPException(status_code=403, detail="Enrol in the course first")
    qz, qs = _quiz_for(db, lid)
    staff = _is_staff(user)
    last = db.query(mx.QuizAttempt).filter(mx.QuizAttempt.quiz_id == qz.id, mx.QuizAttempt.user_id == user.id) \
        .order_by(mx.QuizAttempt.created_at.desc()).first()
    return {"id": qz.id, "title": qz.title, "pass_percent": qz.pass_percent,
            "last_attempt": row(last, ("user_id",)) if last else None,
            "questions": [{"id": q.id, "prompt": q.prompt, "options": json.loads(q.options),
                           **({"correct_index": q.correct_index, "explanation": q.explanation} if staff else {})} for q in qs]}


@router.post("/lessons/{lid}/quiz/attempt")
def attempt_quiz(lid: str, body: AttemptIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles(TRAINEE))):
    l = get_or_404(db, models.Lesson, lid, "Lesson")
    if not _enrolled(db, user, l.course_id):
        raise HTTPException(status_code=403, detail="Enrol in the course first")
    qz, qs = _quiz_for(db, lid)
    if len(body.answers) != len(qs):
        raise HTTPException(status_code=422, detail="Answer every question before submitting")
    results, right = [], 0
    for q, a in zip(qs, body.answers):
        ok = a == q.correct_index
        right += ok
        results.append({"question_id": q.id, "correct": ok, "correct_index": q.correct_index, "explanation": q.explanation})
    pct = round(right / len(qs) * 100)
    passed = pct >= qz.pass_percent
    db.add(mx.QuizAttempt(quiz_id=qz.id, user_id=user.id, score_percent=pct, passed=passed))
    db.commit()
    progress = None
    if passed:
        if not db.query(mx.LessonProgress).filter(mx.LessonProgress.user_id == user.id, mx.LessonProgress.lesson_id == lid).first():
            db.add(mx.LessonProgress(user_id=user.id, lesson_id=lid))
            db.commit()
        e = _recalc(db, user, l.course_id)
        progress = {"progress_percent": e.progress_percent, "completed": e.completed}
    return {"score_percent": pct, "passed": passed, "pass_percent": qz.pass_percent, "results": results, "progress": progress}


# ---------- assignments ----------
@router.post("/courses/{cid}/assignments", status_code=201)
def create_assignment(cid: str, body: AssignmentIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*STAFF))):
    get_or_404(db, models.Course, cid, "Course")
    a = mx.Assignment(course_id=cid, title=body.title, instructions=body.instructions, max_marks=body.max_marks,
                      due_date=parse_date(body.due_date, "due_date") if body.due_date else None)
    db.add(a)
    db.commit()
    return row(a)


@router.delete("/assignments/{aid}", status_code=204)
def delete_assignment(aid: str, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*STAFF))):
    a = get_or_404(db, mx.Assignment, aid, "Assignment")
    db.query(mx.AssignmentSubmission).filter(mx.AssignmentSubmission.assignment_id == aid).delete()
    db.delete(a)
    db.commit()


@router.post("/assignments/{aid}/submit")
def submit_assignment(aid: str, body: SubmitIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles(TRAINEE))):
    a = get_or_404(db, mx.Assignment, aid, "Assignment")
    if not _enrolled(db, user, a.course_id):
        raise HTTPException(status_code=403, detail="Enrol in the course first")
    if not (body.content or "").strip() and not body.link:
        raise HTTPException(status_code=422, detail="Write your answer or add a link")
    s = db.query(mx.AssignmentSubmission).filter(mx.AssignmentSubmission.assignment_id == aid, mx.AssignmentSubmission.user_id == user.id).first()
    if s and s.status == "graded":
        raise HTTPException(status_code=409, detail="This submission has been graded and can no longer be changed")
    from datetime import datetime
    if not s:
        s = mx.AssignmentSubmission(assignment_id=aid, user_id=user.id)
        db.add(s)
    s.content, s.link, s.submitted_at = body.content, body.link, datetime.utcnow()
    db.commit()
    return row(s, ("user_id",))


@router.get("/assignments/{aid}/submissions")
def list_submissions(aid: str, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*STAFF))):
    get_or_404(db, mx.Assignment, aid, "Assignment")
    out = []
    for s in db.query(mx.AssignmentSubmission).filter(mx.AssignmentSubmission.assignment_id == aid).order_by(mx.AssignmentSubmission.submitted_at):
        u = db.query(models.User).filter(models.User.id == s.user_id).first()
        out.append({**row(s), "user_name": u.name if u else "?"})
    return out


@router.patch("/submissions/{sid}/grade")
def grade(sid: str, body: GradeIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*STAFF))):
    s = get_or_404(db, mx.AssignmentSubmission, sid, "Submission")
    a = get_or_404(db, mx.Assignment, s.assignment_id, "Assignment")
    if body.marks > a.max_marks:
        raise HTTPException(status_code=422, detail=f"Marks cannot exceed {a.max_marks}")
    s.marks, s.feedback, s.status = body.marks, body.feedback, "graded"
    db.commit()
    return row(s, ("user_id",))


# ---------- learner analytics (staff) ----------
@router.get("/courses/{cid}/learners")
def learners(cid: str, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*STAFF))):
    get_or_404(db, models.Course, cid, "Course")
    aids = [a.id for a in db.query(mx.Assignment).filter(mx.Assignment.course_id == cid)]
    lids = [l.id for l in db.query(models.Lesson).filter(models.Lesson.course_id == cid)]
    qids = [q.id for q in db.query(mx.Quiz).filter(mx.Quiz.lesson_id.in_(lids or ["-"]))]
    out = []
    for e in db.query(models.Enrollment).filter(models.Enrollment.course_id == cid):
        u = db.query(models.User).filter(models.User.id == e.user_id).first()
        best = [a.score_percent for a in db.query(mx.QuizAttempt).filter(mx.QuizAttempt.user_id == e.user_id, mx.QuizAttempt.quiz_id.in_(qids or ["-"]))]
        out.append({"user_id": e.user_id, "name": u.name if u else "?", "progress_percent": e.progress_percent,
                    "completed": e.completed, "quiz_best_percent": max(best) if best else None,
                    "assignments_submitted": db.query(mx.AssignmentSubmission).filter(
                        mx.AssignmentSubmission.user_id == e.user_id, mx.AssignmentSubmission.assignment_id.in_(aids or ["-"])).count(),
                    "assignments_total": len(aids)})
    return out
