from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/national", response_model=schemas.NationalAnalytics)
def national_analytics(db: Session = Depends(get_db)):
    total_trainees = db.query(models.User).filter(models.User.role == models.RoleEnum.trainee).count()
    total_programmes = db.query(models.Programme).count()
    total_certificates = db.query(models.Certificate).count()
    total_jobs = db.query(models.Job).count()

    total_regs = db.query(models.Registration).count()
    completed_regs = (
        db.query(models.Registration)
        .filter(models.Registration.status == models.RegistrationStatus.completed)
        .count()
    )
    completion_rate = round((completed_regs / total_regs) * 100, 1) if total_regs else 0.0

    employment_linked = db.query(models.JobApplication).filter(models.JobApplication.status == "shortlisted").count()

    return schemas.NationalAnalytics(
        total_trainees=total_trainees,
        total_programmes=total_programmes,
        total_certificates=total_certificates,
        total_jobs=total_jobs,
        completion_rate=completion_rate,
        employment_linked=employment_linked,
    )
