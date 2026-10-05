"""Aggregate analytics (no personal data): participation, completion, skills, employment outcomes, regions, institutions."""
from collections import Counter, defaultdict
from datetime import datetime, date

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, models_ext as mx, security
from app.database import get_db

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/insights")
def insights(db: Session = Depends(get_db), user: models.User = Depends(security.get_current_user)):
    progs = db.query(models.Programme).all()
    regs = db.query(models.Registration).all()
    prog_by_id = {p.id: p for p in progs}
    done_status = models.RegistrationStatus.completed

    # participation by category
    cat = defaultdict(lambda: {"registrations": 0, "programmes": 0})
    for p in progs:
        cat[p.category or "Other"]["programmes"] += 1
    for r in regs:
        p = prog_by_id.get(r.programme_id)
        cat[(p.category if p else None) or "Other"]["registrations"] += 1
    participation = sorted([{"label": k, **v} for k, v in cat.items()], key=lambda x: -x["registrations"])

    # registrations by month (last 6 months, zero-filled)
    today = date.today()
    months = []
    y, m = today.year, today.month
    for _ in range(6):
        months.append((y, m))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    months.reverse()
    counts = Counter((r.registered_at.year, r.registered_at.month) for r in regs if r.registered_at)
    monthly = [{"label": datetime(y, m, 1).strftime("%b"), "value": counts.get((y, m), 0)} for y, m in months]

    # course completion
    completion = []
    for c in db.query(models.Course).all():
        es = db.query(models.Enrollment).filter(models.Enrollment.course_id == c.id).all()
        if es:
            completion.append({"label": c.title, "enrolled": len(es), "completed": sum(1 for e in es if e.completed),
                               "avg_progress": round(sum(e.progress_percent for e in es) / len(es))})
    completion.sort(key=lambda x: -x["enrolled"])

    # skills
    rows = db.query(models.UserSkill.skill_name, func.count(models.UserSkill.id), func.avg(models.UserSkill.level_percent)) \
        .group_by(models.UserSkill.skill_name).order_by(func.count(models.UserSkill.id).desc()).limit(8).all()
    skills = [{"label": n, "learners": c, "avg_level": round(a or 0)} for n, c, a in rows]

    # employment funnel
    apps = db.query(models.JobApplication.status, func.count(models.JobApplication.id)).group_by(models.JobApplication.status).all()
    st = {s: c for s, c in apps}
    applied_total = sum(st.values())
    reached_short = st.get("shortlisted", 0) + st.get("interview", 0) + st.get("hired", 0)
    reached_int = st.get("interview", 0) + st.get("hired", 0)
    funnel = [{"label": "Applied", "value": applied_total}, {"label": "Shortlisted", "value": reached_short},
              {"label": "Interview", "value": reached_int}, {"label": "Hired", "value": st.get("hired", 0)}]

    # regions & institutions
    regions = defaultdict(lambda: {"registrations": 0, "programmes": 0})
    inst_stats = {}
    for i in db.query(models.Institution).all():
        ps = [p for p in progs if p.institution_id == i.id]
        rs = [r for r in regs if r.programme_id in {p.id for p in ps}]
        sess = db.query(mx.AttendanceSession).filter(mx.AttendanceSession.programme_id.in_([p.id for p in ps] or ["-"]),
                                                     mx.AttendanceSession.session_date <= today).all()
        approved = [r for r in rs if r.status in (models.RegistrationStatus.approved, done_status)]
        possible = len(sess) * max(1, len(approved)) if sess and approved else 0
        recs = db.query(mx.AttendanceRecord).filter(mx.AttendanceRecord.session_id.in_([s.id for s in sess] or ["-"]),
                                                    mx.AttendanceRecord.role == "trainee").count() if sess else 0
        inst_stats[i.id] = {"label": i.name, "state": i.state, "programmes": len(ps), "registrations": len(rs),
                            "completed": sum(1 for r in rs if r.status == done_status),
                            "attendance_percent": round(recs / possible * 100) if possible else None}
        regions[i.state or "Unspecified"]["registrations"] += len(rs)
        regions[i.state or "Unspecified"]["programmes"] += len(ps)
    return {
        "totals": {"registrations": len(regs), "programmes": len(progs), "completed": sum(1 for r in regs if r.status == done_status),
                   "certificates": db.query(models.Certificate).count(), "hired": st.get("hired", 0)},
        "participation": participation, "monthly": monthly, "completion": completion, "skills": skills, "funnel": funnel,
        "regions": sorted([{"label": k, **v} for k, v in regions.items()], key=lambda x: -x["registrations"]),
        "institutions": sorted(inst_stats.values(), key=lambda x: -x["registrations"]),
    }
