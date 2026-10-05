from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, security

router = APIRouter(prefix="/api/programmes", tags=["programmes"])


def _to_out(p: models.Programme) -> schemas.ProgrammeOut:
    out = schemas.ProgrammeOut.model_validate(p)
    out.institution_name = p.institution.name if p.institution else None
    return out


@router.get("", response_model=List[schemas.ProgrammeOut])
def list_programmes(db: Session = Depends(get_db)):
    programmes = db.query(models.Programme).all()
    return [_to_out(p) for p in programmes]


@router.get("/{programme_id}", response_model=schemas.ProgrammeOut)
def get_programme(programme_id: str, db: Session = Depends(get_db)):
    p = db.query(models.Programme).filter(models.Programme.id == programme_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Programme not found")
    return _to_out(p)


@router.post("/{programme_id}/register", response_model=schemas.RegistrationOut)
def register_for_programme(
    programme_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    programme = db.query(models.Programme).filter(models.Programme.id == programme_id).first()
    if not programme:
        raise HTTPException(status_code=404, detail="Programme not found")

    existing = (
        db.query(models.Registration)
        .filter(
            models.Registration.programme_id == programme_id,
            models.Registration.user_id == current_user.id,
        )
        .first()
    )
    if existing:
        return existing

    reg = models.Registration(user_id=current_user.id, programme_id=programme_id)
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return reg


@router.get("/mine/registrations", response_model=List[schemas.RegistrationOut])
def my_registrations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    return (
        db.query(models.Registration)
        .filter(models.Registration.user_id == current_user.id)
        .all()
    )
