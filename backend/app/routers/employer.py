"""Module 5 - Employer & recruiter dashboard."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import models, security, models_ext as mx
from app.database import get_db
from app.deps import require_roles, rv, row, get_or_404, parse_date, EMPLOYER, SUPER
from app.routers.jobs import _match_score

router = APIRouter(prefix="/api/employer", tags=["employer"])
STATUSES = ("applied", "shortlisted", "interview", "hired", "rejected")


class CompanyIn(BaseModel):
    company_name: str = Field(min_length=2, max_length=160)
    sector: Optional[str] = Field(None, max_length=80)
    location: Optional[str] = Field(None, max_length=160)
    website: Optional[str] = Field(None, max_length=200, pattern=r"^https?://.+")
    description: Optional[str] = Field(None, max_length=1000)
    contact_phone: Optional[str] = Field(None, pattern=r"^[+0-9\-\s]{7,16}$")


class JobIn(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    description: Optional[str] = Field(None, max_length=3000)
    required_skills: Optional[str] = Field(None, max_length=300)
    location: Optional[str] = Field(None, max_length=160)
    job_type: str = Field("Full-time", pattern=r"^(Full-time|Part-time|Internship|Apprenticeship|Contract)$")
    salary_range: Optional[str] = Field(None, max_length=60)
    openings: int = Field(1, ge=1, le=1000)
    experience: Optional[str] = Field(None, max_length=60)
    deadline: Optional[str] = None


class StatusIn(BaseModel):
    status: str


def _company(db: Session, user: models.User) -> mx.EmployerProfile:
    c = db.query(mx.EmployerProfile).filter(mx.EmployerProfile.user_id == user.id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Create your company profile first")
    if c.status != "active":
        raise HTTPException(status_code=403, detail="Your employer account is suspended")
    return c


def _my_job(db: Session, c: mx.EmployerProfile, jid: str) -> models.Job:
    j = get_or_404(db, models.Job, jid, "Job")
    if j.employer_id != c.employer_id:
        raise HTTPException(status_code=404, detail="Job not found")
    return j


def _job_out(db: Session, j: models.Job) -> dict:
    m = db.query(mx.JobMeta).filter(mx.JobMeta.job_id == j.id).first()
    apps = db.query(models.JobApplication).filter(models.JobApplication.job_id == j.id).all()
    return {"id": j.id, "title": j.title, "description": j.description, "required_skills": j.required_skills,
            "location": j.location, "posted_at": j.posted_at,
            **(row(m, ("id", "job_id")) if m else {"job_type": "Full-time", "status": "open", "openings": 1}),
            "applicants": len(apps), "shortlisted": sum(a.status == "shortlisted" for a in apps),
            "hired": sum(a.status == "hired" for a in apps)}


def _candidate(db: Session, u: models.User, job: Optional[models.Job], reveal: bool) -> dict:
    p = db.query(mx.Profile).filter(mx.Profile.user_id == u.id).first()
    out = {"id": u.id, "name": u.name, "location": u.location, "education": u.education,
           "interests": u.career_interests,
           "skills": [{"skill_name": s.skill_name, "level_percent": s.level_percent} for s in u.user_skills],
           "certificates": [{"programme_name": c.programme_name, "skill": c.skill, "verification_id": c.verification_id}
                            for c in u.certificates],
           "training": [{"title": t.title, "status": t.status, "grade": t.grade} for t in
                        db.query(mx.TrainingHistory).filter(mx.TrainingHistory.user_id == u.id)],
           "bio": p.bio if p else None, "match_score": _match_score(u, job, db) if job else None}
    if reveal:  # contact details only once the candidate has applied to this employer
        out["email"] = u.email
        out["phone"] = p.phone if p else None
    return out


# ---------- company ----------
@router.get("/profile")
def get_company(db: Session = Depends(get_db), user: models.User = Depends(require_roles(EMPLOYER))):
    return row(_company(db, user))


@router.put("/profile")
def save_company(body: CompanyIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles(EMPLOYER))):
    c = db.query(mx.EmployerProfile).filter(mx.EmployerProfile.user_id == user.id).first()
    if not c:
        legacy = models.Employer(company_name=body.company_name, sector=body.sector, location=body.location)
        db.add(legacy)
        db.flush()
        c = mx.EmployerProfile(user_id=user.id, employer_id=legacy.id, company_name=body.company_name)
        db.add(c)
    elif c.status != "active":
        raise HTTPException(status_code=403, detail="Your employer account is suspended")
    for k, v in body.model_dump().items():
        setattr(c, k, v)
    legacy = db.query(models.Employer).filter(models.Employer.id == c.employer_id).first()
    if legacy:
        legacy.company_name, legacy.sector, legacy.location = body.company_name, body.sector, body.location
    db.commit()
    return row(c)


# ---------- jobs ----------
@router.get("/jobs")
def my_jobs(db: Session = Depends(get_db), user: models.User = Depends(require_roles(EMPLOYER))):
    c = _company(db, user)
    jobs = db.query(models.Job).filter(models.Job.employer_id == c.employer_id).order_by(models.Job.posted_at.desc())
    return [_job_out(db, j) for j in jobs]


def _apply_job(db, j: models.Job, body: JobIn):
    j.title, j.description, j.required_skills, j.location = body.title, body.description, body.required_skills, body.location
    m = db.query(mx.JobMeta).filter(mx.JobMeta.job_id == j.id).first()
    if not m:
        m = mx.JobMeta(job_id=j.id)
        db.add(m)
    dl = parse_date(body.deadline, "deadline") if body.deadline else None
    m.job_type, m.salary_range, m.openings, m.experience, m.deadline = body.job_type, body.salary_range, body.openings, body.experience, dl


@router.post("/jobs", status_code=201)
def post_job(body: JobIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles(EMPLOYER))):
    c = _company(db, user)
    j = models.Job(employer_id=c.employer_id, title=body.title)
    db.add(j)
    db.flush()
    _apply_job(db, j, body)
    db.commit()
    return _job_out(db, j)


@router.put("/jobs/{jid}")
def edit_job(jid: str, body: JobIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles(EMPLOYER))):
    j = _my_job(db, _company(db, user), jid)
    _apply_job(db, j, body)
    db.commit()
    return _job_out(db, j)


@router.patch("/jobs/{jid}/status")
def set_job_status(jid: str, body: StatusIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles(EMPLOYER))):
    if body.status not in ("open", "closed"):
        raise HTTPException(status_code=422, detail="Status must be open or closed")
    j = _my_job(db, _company(db, user), jid)
    m = db.query(mx.JobMeta).filter(mx.JobMeta.job_id == j.id).first() or mx.JobMeta(job_id=j.id)
    m.status = body.status
    db.add(m)
    db.commit()
    return _job_out(db, j)


# ---------- applications ----------
@router.get("/jobs/{jid}/applications")
def job_applications(jid: str, status: Optional[str] = None, db: Session = Depends(get_db),
                     user: models.User = Depends(require_roles(EMPLOYER))):
    j = _my_job(db, _company(db, user), jid)
    q = db.query(models.JobApplication).filter(models.JobApplication.job_id == j.id)
    if status:
        q = q.filter(models.JobApplication.status == status)
    out = []
    for a in q.order_by(models.JobApplication.match_score.desc()):
        out.append({"id": a.id, "status": a.status, "applied_at": a.applied_at, "match_score": a.match_score,
                    "candidate": _candidate(db, a.user, j, reveal=True)})
    return out


@router.patch("/applications/{aid}")
def set_application_status(aid: str, body: StatusIn, db: Session = Depends(get_db),
                           user: models.User = Depends(require_roles(EMPLOYER))):
    if body.status not in STATUSES:
        raise HTTPException(status_code=422, detail=f"Status must be one of: {', '.join(STATUSES)}")
    c = _company(db, user)
    a = get_or_404(db, models.JobApplication, aid, "Application")
    _my_job(db, c, a.job_id)
    a.status = body.status
    db.commit()
    return {"id": a.id, "status": a.status}


# ---------- candidate search & matching ----------
def _visible_trainee_query(db: Session, c: mx.EmployerProfile):
    """Trainees who opted in to be discoverable, plus anyone who applied to this employer."""
    applicant_ids = db.query(models.JobApplication.user_id).join(models.Job, models.Job.id == models.JobApplication.job_id) \
        .filter(models.Job.employer_id == c.employer_id)
    opted = db.query(mx.Profile.user_id).filter(mx.Profile.open_to_work.is_(True), or_(mx.Profile.status == "active", mx.Profile.status.is_(None)))
    return db.query(models.User).filter(models.User.role == models.RoleEnum.trainee,
                                        or_(models.User.id.in_(opted), models.User.id.in_(applicant_ids))), applicant_ids


@router.get("/candidates")
def search_candidates(q: Optional[str] = None, skill: Optional[str] = None, location: Optional[str] = None,
                      education: Optional[str] = None, job_id: Optional[str] = None, min_match: int = 0,
                      skip: int = 0, limit: int = 20, db: Session = Depends(get_db),
                      user: models.User = Depends(require_roles(EMPLOYER))):
    c = _company(db, user)
    limit = max(1, min(limit, 50))
    job = _my_job(db, c, job_id) if job_id else None
    query, applicant_ids = _visible_trainee_query(db, c)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(models.User.name.ilike(like), models.User.career_interests.ilike(like)))
    if location:
        query = query.filter(models.User.location.ilike(f"%{location.strip()}%"))
    if education:
        query = query.filter(models.User.education.ilike(f"%{education.strip()}%"))
    if skill:
        for s in [x.strip() for x in skill.split(",") if x.strip()]:
            with_skill = db.query(models.UserSkill.user_id).filter(models.UserSkill.skill_name.ilike(f"%{s}%"))
            with_cert = db.query(models.Certificate.user_id).filter(models.Certificate.skill.ilike(f"%{s}%"))
            query = query.filter(or_(models.User.id.in_(with_skill), models.User.id.in_(with_cert)))
    applicants = {r[0] for r in applicant_ids}
    items = []
    for u in query.all():
        d = _candidate(db, u, job, reveal=u.id in applicants)
        d["applied"] = u.id in applicants
        if job and d["match_score"] < min_match:
            continue
        items.append(d)
    if job:
        items.sort(key=lambda x: -(x["match_score"] or 0))
    else:
        items.sort(key=lambda x: x["name"].lower())
    return {"total": len(items), "items": items[skip:skip + limit]}


# ---------- super-admin oversight ----------
@router.get("/admin/employers")
def list_employers(db: Session = Depends(get_db), user: models.User = Depends(require_roles(SUPER))):
    out = []
    for c in db.query(mx.EmployerProfile).order_by(mx.EmployerProfile.created_at.desc()):
        u = db.query(models.User).filter(models.User.id == c.user_id).first()
        out.append({**row(c), "owner_email": u.email if u else None,
                    "jobs": db.query(models.Job).filter(models.Job.employer_id == c.employer_id).count()})
    return out


@router.patch("/admin/employers/{eid}")
def moderate_employer(eid: str, verified: Optional[bool] = None, status: Optional[str] = None,
                      db: Session = Depends(get_db), user: models.User = Depends(require_roles(SUPER))):
    c = get_or_404(db, mx.EmployerProfile, eid, "Employer")
    if verified is not None:
        c.verified = verified
    if status:
        if status not in ("active", "suspended"):
            raise HTTPException(status_code=422, detail="Invalid status")
        c.status = status
    db.commit()
    return row(c)
