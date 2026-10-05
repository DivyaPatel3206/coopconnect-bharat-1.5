from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, security

router = APIRouter(prefix="/api/certificates", tags=["certificates"])


@router.get("", response_model=List[schemas.CertificateOut])
def my_certificates(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    return (
        db.query(models.Certificate)
        .filter(models.Certificate.user_id == current_user.id)
        .all()
    )


@router.get("/verify/{verification_id}", response_model=schemas.CertificateVerifyResult)
def verify_certificate(verification_id: str, db: Session = Depends(get_db)):
    cert = (
        db.query(models.Certificate)
        .filter(models.Certificate.verification_id == verification_id.upper())
        .first()
    )
    if not cert:
        return schemas.CertificateVerifyResult(verified=False)

    return schemas.CertificateVerifyResult(
        verified=True,
        programme_name=cert.programme_name,
        institution_name=cert.institution_name,
        skill=cert.skill,
        issued_date=cert.issued_date,
        holder_name=cert.user.name if cert.user else None,
    )
