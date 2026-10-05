"""Public (no sign-in) data for the homepage and job board, plus announcement management."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models, models_ext as mx
from app.database import get_db
from app.deps import require_roles, row, get_or_404, SUPER

router = APIRouter(prefix="/api/public", tags=["public"])


def _open_jobs(db: Session, limit: Optional[int] = None):
    closed = [m.job_id for m in db.query(mx.JobMeta).filter(mx.JobMeta.status == "closed")]
    q = db.query(models.Job).filter(~models.Job.id.in_(closed or ["-"])).order_by(models.Job.posted_at.desc())
    jobs = q.limit(limit).all() if limit else q.all()
    out = []
    for j in jobs:
        m = db.query(mx.JobMeta).filter(mx.JobMeta.job_id == j.id).first()
        out.append({"id": j.id, "title": j.title, "description": j.description, "required_skills": j.required_skills,
                    "location": j.location, "company_name": j.employer.company_name if j.employer else None,
                    "sector": j.employer.sector if j.employer else None, "posted_at": j.posted_at,
                    "job_type": m.job_type if m else "Full-time", "salary_range": m.salary_range if m else None,
                    "openings": m.openings if m else None, "experience": m.experience if m else None,
                    "deadline": m.deadline if m else None})
    return out


def _programme_out(db: Session, p: models.Programme) -> dict:
    taken = db.query(models.Registration).filter(models.Registration.programme_id == p.id).count()
    return {"id": p.id, "name": p.name, "category": p.category, "mode": p.mode, "location": p.location,
            "start_date": p.start_date, "end_date": p.end_date, "trainer_name": p.trainer_name,
            "institution_name": p.institution.name if p.institution else None,
            "capacity": p.capacity, "seats_left": max(0, (p.capacity or 0) - taken) if p.capacity else None}


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    regs = db.query(models.Registration).count()
    done = db.query(models.Registration).filter(models.Registration.status == models.RegistrationStatus.completed).count()
    now = datetime.utcnow()
    progs = db.query(models.Programme).filter(models.Programme.end_date >= now).order_by(models.Programme.start_date).limit(4).all() \
        or db.query(models.Programme).order_by(models.Programme.start_date.desc()).limit(4).all()
    anns = db.query(mx.Announcement).order_by(mx.Announcement.created_at.desc()).limit(4).all()
    return {
        "stats": {"trainees": db.query(models.User).filter(models.User.role == models.RoleEnum.trainee).count(),
                  "programmes": db.query(models.Programme).count(), "certificates": db.query(models.Certificate).count(),
                  "institutions": db.query(models.Institution).count(), "courses": db.query(models.Course).count(),
                  "open_jobs": len(_open_jobs(db)), "completion_rate": round(done / regs * 100) if regs else 0},
        "programmes": [_programme_out(db, p) for p in progs],
        "jobs": _open_jobs(db, 4),
        "announcements": [row(a) for a in anns],
        "institutions": [{"name": i.name, "type": i.type, "state": i.state} for i in db.query(models.Institution).order_by(models.Institution.name)],
    }


@router.get("/jobs")
def public_jobs(db: Session = Depends(get_db)):
    return _open_jobs(db)


@router.get("/courses")
def public_courses(db: Session = Depends(get_db)):
    out = []
    for c in db.query(models.Course).order_by(models.Course.title):
        m = db.query(mx.CourseMeta).filter(mx.CourseMeta.course_id == c.id).first()
        out.append({"id": c.id, "title": c.title, "description": c.description, "skill_tag": c.skill_tag, "language": c.language,
                    "lessons": len(c.lessons), "enrolled": False, "progress_percent": 0, "completed": False,
                    "category": m.category if m else None, "level": m.level if m else "Beginner",
                    "duration_hours": m.duration_hours if m else None, "instructor": m.instructor if m else None,
                    "institution_name": m.institution_name if m else None})
    return out


@router.get("/programmes")
def public_programmes(db: Session = Depends(get_db)):
    return [_programme_out(db, p) for p in db.query(models.Programme).order_by(models.Programme.start_date)]


class AnnouncementIn(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    body: Optional[str] = Field(None, max_length=600)
    tag: str = Field("Update", pattern=r"^(Programme|Platform|Employment|Update)$")
    link: Optional[str] = Field(None, max_length=300)


@router.get("/announcements")
def announcements(db: Session = Depends(get_db)):
    return [row(a) for a in db.query(mx.Announcement).order_by(mx.Announcement.created_at.desc()).limit(30)]


@router.post("/announcements", status_code=201)
def post_announcement(body: AnnouncementIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles(SUPER))):
    a = mx.Announcement(**body.model_dump())
    db.add(a)
    db.commit()
    return row(a)


@router.delete("/announcements/{aid}", status_code=204)
def delete_announcement(aid: str, db: Session = Depends(get_db), user: models.User = Depends(require_roles(SUPER))):
    db.delete(get_or_404(db, mx.Announcement, aid, "Announcement"))
    db.commit()
