"""Dashboard history: a unified, role-aware timeline of a user's past records + headline numbers."""
from datetime import datetime, date, timedelta
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, security, models_ext as mx
from app.database import get_db
from app.deps import rv, visible_programme_ids, STAFF, TRAINEE, EMPLOYER
from app.routers.jobs import _match_score

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _dt(v):
    if isinstance(v, datetime):
        return v
    if isinstance(v, date):
        return datetime.combine(v, datetime.min.time())
    return datetime.min


def completeness(db: Session, user: models.User) -> dict:
    p = db.query(mx.Profile).filter(mx.Profile.user_id == user.id).first()
    checks = [("Phone number", bool(p and p.phone)), ("Date of birth", bool(p and p.dob)), ("Address", bool(p and p.address)),
              ("State", bool(p and p.state)), ("Institution", bool(p and p.institution_id)), ("About you", bool(p and p.bio)),
              ("Education", bool(user.education)), ("Career interests", bool(user.career_interests)),
              ("At least one skill", len(user.user_skills) > 0),
              ("An ID or education document", db.query(mx.ProfileDocument).filter(mx.ProfileDocument.user_id == user.id).count() > 0)]
    done = sum(1 for _, ok in checks if ok)
    return {"percent": round(done / len(checks) * 100), "missing": [n for n, ok in checks if not ok]}


@router.get("/profile-completeness")
def profile_completeness(db: Session = Depends(get_db), user: models.User = Depends(security.get_current_user)):
    return completeness(db, user)


@router.get("/history")
def history(limit: int = 80, db: Session = Depends(get_db), user: models.User = Depends(security.get_current_user)):
    limit = max(10, min(limit, 200))
    uid, role = user.id, rv(user)
    ev: List[dict] = []

    def add(kind, title, sub, when, status=None, href=None):
        if when:
            ev.append({"type": kind, "title": title, "subtitle": sub, "date": _dt(when).isoformat(), "status": status, "href": href})

    # attendance (everyone who scans)
    recs = db.query(mx.AttendanceRecord).filter(mx.AttendanceRecord.user_id == uid).all()
    hours = 0.0
    for r in recs:
        s = db.query(mx.AttendanceSession).filter(mx.AttendanceSession.id == r.session_id).first()
        p = db.query(models.Programme).filter(models.Programme.id == s.programme_id).first() if s else None
        h = round((r.check_out - r.check_in).total_seconds() / 3600, 1) if r.check_in and r.check_out else 0
        hours += h
        add("attendance", s.title if s else "Attendance", f"{p.name if p else ''}" + (f" · {h} h" if h else " · not checked out"),
            r.check_in, "present" if r.check_out else "incomplete", "/attendance")

    # training history & registrations
    for t in db.query(mx.TrainingHistory).filter(mx.TrainingHistory.user_id == uid):
        add("training", t.title, f"{t.institution_name or ''}".strip() + (f" · Grade {t.grade}" if t.grade else ""), t.end_date or t.start_date, t.status, "/profile")
    for r in db.query(models.Registration).filter(models.Registration.user_id == uid):
        p = db.query(models.Programme).filter(models.Programme.id == r.programme_id).first()
        add("training", f"Registered: {p.name if p else 'Programme'}", "Programme registration", r.registered_at, r.status.value if hasattr(r.status, "value") else str(r.status), "/programmes")

    # learning
    for c in user.certificates:
        add("certificate", c.programme_name, f"Certificate {c.verification_id}", c.issued_date, "completed", "/certificates/verify")
    done_courses = 0
    for e in user.enrollments:
        if e.completed:
            done_courses += 1
        c = db.query(models.Course).filter(models.Course.id == e.course_id).first()
        if c:
            add("learning", f"Course: {c.title}", f"{int(e.progress_percent)}% complete", None, "completed" if e.completed else "ongoing", f"/learning/{c.id}")
    for a in db.query(mx.QuizAttempt).filter(mx.QuizAttempt.user_id == uid):
        qz = db.query(mx.Quiz).filter(mx.Quiz.id == a.quiz_id).first()
        add("learning", f"Quiz: {qz.title if qz else 'Quiz'}", f"Scored {a.score_percent}%", a.created_at, "completed" if a.passed else "failed", "/learning")
    for s in db.query(mx.AssignmentSubmission).filter(mx.AssignmentSubmission.user_id == uid):
        a = db.query(mx.Assignment).filter(mx.Assignment.id == s.assignment_id).first()
        add("learning", f"Assignment: {a.title if a else ''}", f"{s.marks}/{a.max_marks} marks" if s.marks is not None and a else "Awaiting grading", s.submitted_at, s.status, "/learning")

    # careers
    apps = db.query(models.JobApplication).filter(models.JobApplication.user_id == uid).all()
    for a in apps:
        j = db.query(models.Job).filter(models.Job.id == a.job_id).first()
        add("career", f"Applied: {j.title if j else 'Job'}", f"{j.employer.company_name if j and j.employer else ''} · {a.match_score}% match", a.applied_at, a.status, "/jobs")
    for al in db.query(mx.HostelAllocation).filter(mx.HostelAllocation.user_id == uid):
        room = db.query(mx.Room).filter(mx.Room.id == al.room_id).first()
        add("stay", f"Hostel: {room.hostel.name if room else ''} · Room {room.room_no if room else ''}", f"{al.check_in_date} to {al.check_out_date}", al.check_in_date, al.status, "/logistics")

    # staff: sessions they opened; employers: jobs they posted
    if role in STAFF:
        for s in db.query(mx.AttendanceSession).filter(mx.AttendanceSession.created_by == uid):
            n = db.query(mx.AttendanceRecord).filter(mx.AttendanceRecord.session_id == s.id).count()
            add("attendance", f"Opened: {s.title}", f"{n} checked in", s.created_at, "done", "/attendance")
    if role == EMPLOYER:
        ep = db.query(mx.EmployerProfile).filter(mx.EmployerProfile.user_id == uid).first()
        if ep:
            for j in db.query(models.Job).filter(models.Job.employer_id == ep.employer_id):
                n = db.query(models.JobApplication).filter(models.JobApplication.job_id == j.id).count()
                add("career", f"Posted: {j.title}", f"{n} applicant(s)", j.posted_at, "open", "/employer")

    now = datetime.utcnow()
    ev = [e for e in ev if e["date"] <= (now + timedelta(days=1)).isoformat()]  # past records only
    ev.sort(key=lambda e: e["date"], reverse=True)

    # headline numbers
    pids = visible_programme_ids(db, user)
    held = 0
    if role == TRAINEE and pids:
        held = db.query(mx.AttendanceSession).filter(mx.AttendanceSession.programme_id.in_(pids), mx.AttendanceSession.session_date <= date.today()).count()
    summary = {"sessions_attended": len(recs), "hours": round(hours, 1),
               "attendance_percent": round(len(recs) / held * 100) if held else None,
               "courses_completed": done_courses, "certificates": len(user.certificates), "applications": len(apps)}

    # upcoming
    q = db.query(mx.TimetableEntry).filter(mx.TimetableEntry.session_date >= date.today())
    if pids is not None:
        q = q.filter(mx.TimetableEntry.programme_id.in_(pids or ["-"]))
    upcoming = []
    for e in q.order_by(mx.TimetableEntry.session_date, mx.TimetableEntry.start_time).limit(5):
        v = db.query(mx.Venue).filter(mx.Venue.id == e.venue_id).first() if e.venue_id else None
        upcoming.append({"id": e.id, "title": e.title, "date": str(e.session_date), "start": e.start_time, "end": e.end_time,
                         "venue": v.name if v else None, "trainer": e.trainer_name})

    # notifications (derived, nothing stored)
    notes = []
    for u_ in upcoming:
        if u_["date"] == str(date.today()):
            notes.append({"tone": "info", "text": f"Today: {u_['title']} at {u_['start']}" + (f", {u_['venue']}" if u_["venue"] else ""), "href": "/logistics"})
    if role == TRAINEE and pids:
        live = db.query(mx.AttendanceSession).filter(mx.AttendanceSession.programme_id.in_(pids), mx.AttendanceSession.is_open.is_(True),
                                                      mx.AttendanceSession.session_date == date.today()).all()
        mine = {r.session_id: r for r in recs}
        for s_ in live:
            r_ = mine.get(s_.id)
            if not r_:
                notes.append({"tone": "action", "text": f"Attendance is open: {s_.title}. Scan the QR to check in.", "href": "/attendance/scan"})
            elif not r_.check_out:
                notes.append({"tone": "action", "text": f"You are checked in to {s_.title}. Scan again to check out.", "href": "/attendance/scan"})
    for a in apps:
        if a.status in ("shortlisted", "interview", "hired"):
            j = db.query(models.Job).filter(models.Job.id == a.job_id).first()
            notes.append({"tone": "good", "text": f"Your application for {j.title if j else 'a job'} is {a.status}.", "href": "/jobs"})
    for sub in db.query(mx.AssignmentSubmission).filter(mx.AssignmentSubmission.user_id == uid, mx.AssignmentSubmission.status == "graded"):
        a_ = db.query(mx.Assignment).filter(mx.Assignment.id == sub.assignment_id).first()
        notes.append({"tone": "good", "text": f"Assignment graded: {a_.title if a_ else ''} ({sub.marks}/{a_.max_marks if a_ else ''}).", "href": "/learning"})
    if role == TRAINEE:
        enrolled = {e.course_id for e in user.enrollments}
        for a_ in db.query(mx.Assignment).filter(mx.Assignment.course_id.in_(enrolled or ["-"]), mx.Assignment.due_date.isnot(None),
                                                 mx.Assignment.due_date >= date.today(), mx.Assignment.due_date <= date.today() + timedelta(days=3)):
            if not db.query(mx.AssignmentSubmission).filter(mx.AssignmentSubmission.assignment_id == a_.id, mx.AssignmentSubmission.user_id == uid).first():
                notes.append({"tone": "warn", "text": f"Assignment due {a_.due_date}: {a_.title}", "href": f"/learning/{a_.course_id}"})
    if role in STAFF:
        pending = db.query(mx.AssignmentSubmission).filter(mx.AssignmentSubmission.status == "submitted").count()
        if pending:
            notes.append({"tone": "action", "text": f"{pending} assignment submission(s) waiting to be graded.", "href": "/learning"})
    if role == EMPLOYER:
        ep = db.query(mx.EmployerProfile).filter(mx.EmployerProfile.user_id == uid).first()
        if not ep:
            notes.append({"tone": "action", "text": "Register your company to post jobs and find candidates.", "href": "/employer"})
        else:
            new = db.query(models.JobApplication).join(models.Job, models.Job.id == models.JobApplication.job_id).filter(
                models.Job.employer_id == ep.employer_id, models.JobApplication.status == "applied").count()
            if new:
                notes.append({"tone": "action", "text": f"{new} new application(s) to review.", "href": "/employer"})
    comp = completeness(db, user)
    if comp["percent"] < 80:
        notes.append({"tone": "warn", "text": f"Your profile is {comp['percent']}% complete. Add {comp['missing'][0].lower()} to improve job matches.", "href": "/profile"})

    # recommendations
    skills = [{"skill_name": k.skill_name, "level_percent": k.level_percent} for k in sorted(user.user_skills, key=lambda k: -k.level_percent)[:6]]
    enrolled_ids = {e.course_id for e in user.enrollments}
    have = {k.skill_name.lower() for k in user.user_skills}
    interests = (user.career_interests or "").lower()
    rec_courses = []
    for c in db.query(models.Course).all():
        if c.id in enrolled_ids:
            continue
        meta = db.query(mx.CourseMeta).filter(mx.CourseMeta.course_id == c.id).first()
        tag = (c.skill_tag or "").lower()
        score = (2 if tag and tag not in have else 0) + (2 if tag and any(w in interests for w in tag.split()) else 0) + (1 if meta and meta.level == "Beginner" else 0)
        rec_courses.append((score, {"id": c.id, "title": c.title, "skill_tag": c.skill_tag, "level": meta.level if meta else None,
                                    "duration_hours": meta.duration_hours if meta else None, "category": meta.category if meta else None,
                                    "reason": f"Builds {c.skill_tag}" if c.skill_tag and c.skill_tag.lower() not in have else "Popular with learners"}))
    rec_courses = [c for _, c in sorted(rec_courses, key=lambda x: -x[0])[:3]]
    rec_jobs = []
    if role == TRAINEE:
        applied = {a.job_id for a in apps}
        closed = {m.job_id for m in db.query(mx.JobMeta).filter(mx.JobMeta.status == "closed")}
        scored = [(_match_score(user, j, db), j) for j in db.query(models.Job).all() if j.id not in applied and j.id not in closed]
        for sc, j in sorted(scored, key=lambda x: -x[0])[:3]:
            m = db.query(mx.JobMeta).filter(mx.JobMeta.job_id == j.id).first()
            rec_jobs.append({"id": j.id, "title": j.title, "company": j.employer.company_name if j.employer else "", "location": j.location,
                             "job_type": m.job_type if m else "Full-time", "match": sc})
    return {"summary": summary, "upcoming": upcoming, "events": ev[:limit], "notifications": notes[:8], "profile": comp,
            "skills": skills, "recommended_courses": rec_courses, "recommended_jobs": rec_jobs}
