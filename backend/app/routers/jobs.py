from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, security

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _match_score(user: models.User, job: models.Job, db: Session) -> int:
    """Simple, explainable overlap score between a user's skills/certificates
    and a job's required_skills. Not a black box: every point is traceable."""
    if not job.required_skills:
        return 50

    required = {s.strip().lower() for s in job.required_skills.split(",") if s.strip()}
    if not required:
        return 50

    user_skill_names = {s.skill_name.lower() for s in user.user_skills}
    cert_skill_names = {
        c.skill.lower() for c in user.certificates if c.skill
    }
    have = user_skill_names | cert_skill_names

    overlap = len(required & have)
    score = int(round((overlap / len(required)) * 100))
    return max(10, score)  # floor so results still show, framed as low match


@router.get("", response_model=List[schemas.JobOut])
def list_jobs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    from app import models_ext as mx
    closed = [m.job_id for m in db.query(mx.JobMeta).filter(mx.JobMeta.status == "closed")]
    jobs = db.query(models.Job).filter(~models.Job.id.in_(closed or ["-"])).all()
    results = []
    for j in jobs:
        out = schemas.JobOut.model_validate(j)
        out.company_name = j.employer.company_name if j.employer else None
        out.match_score = _match_score(current_user, j, db)
        results.append(out)
    results.sort(key=lambda x: x.match_score or 0, reverse=True)
    return results


@router.post("/{job_id}/apply", response_model=schemas.JobApplicationOut)
def apply_to_job(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    from app import models_ext as mx
    meta = db.query(mx.JobMeta).filter(mx.JobMeta.job_id == job_id).first()
    if meta and meta.status == "closed":
        raise HTTPException(status_code=410, detail="This job is no longer accepting applications")

    existing = (
        db.query(models.JobApplication)
        .filter(models.JobApplication.job_id == job_id, models.JobApplication.user_id == current_user.id)
        .first()
    )
    if existing:
        return existing

    application = models.JobApplication(
        job_id=job_id,
        user_id=current_user.id,
        match_score=_match_score(current_user, job, db),
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return application


@router.get("/mine/applications", response_model=List[schemas.JobApplicationOut])
def my_applications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    return (
        db.query(models.JobApplication)
        .filter(models.JobApplication.user_id == current_user.id)
        .all()
    )
