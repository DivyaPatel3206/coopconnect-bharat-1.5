"""Shared helpers for the extension modules (RBAC, scoping, serialisation)."""
from datetime import date, datetime
from typing import Optional, List

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, security
from app.database import get_db
from app import models_ext as mx

SUPER = "super_admin"
INST = "institution_admin"
TRAINER = "trainer"
TRAINEE = "trainee"
EMPLOYER = "employer"
ADMINS = (SUPER, INST)
STAFF = (SUPER, INST, TRAINER)


def rv(user: models.User) -> str:
    r = user.role
    return r.value if hasattr(r, "value") else str(r)


def require_roles(*roles: str):
    allowed = set(roles)

    def dep(user: models.User = Depends(security.get_current_user)) -> models.User:
        if rv(user) not in allowed:
            raise HTTPException(status_code=403, detail="You do not have permission to do this")
        return user

    return dep


def row(obj, exclude: tuple = ()) -> dict:
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns if c.name not in exclude}


def get_or_404(db: Session, model, id_: str, label: str = "Record"):
    obj = db.query(model).filter(model.id == id_).first()
    if not obj:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return obj


def user_institution_id(db: Session, user: models.User) -> Optional[str]:
    p = db.query(mx.Profile).filter(mx.Profile.user_id == user.id).first()
    return p.institution_id if p else None


def visible_programme_ids(db: Session, user: models.User) -> Optional[List[str]]:
    """None => all programmes. Otherwise the list of programme ids this user may see."""
    role = rv(user)
    if role == SUPER:
        return None
    if role in (INST, TRAINER):
        inst = user_institution_id(db, user)
        if not inst:
            return []
        return [p.id for p in db.query(models.Programme).filter(models.Programme.institution_id == inst)]
    if role == TRAINEE:
        regs = db.query(models.Registration).filter(
            models.Registration.user_id == user.id,
            models.Registration.status.in_([models.RegistrationStatus.approved, models.RegistrationStatus.completed]),
        )
        return [r.programme_id for r in regs]
    return []


def assert_programme_access(db: Session, user: models.User, programme_id: str, manage: bool = False):
    if manage and rv(user) not in STAFF:
        raise HTTPException(status_code=403, detail="You do not have permission to do this")
    ids = visible_programme_ids(db, user)
    if ids is not None and programme_id not in ids:
        raise HTTPException(status_code=403, detail="You do not have access to this programme")
    get_or_404(db, models.Programme, programme_id, "Programme")


def parse_date(v: str, field: str = "date") -> date:
    try:
        return date.fromisoformat(v)
    except Exception:
        raise HTTPException(status_code=422, detail=f"Invalid {field}, expected YYYY-MM-DD")


def hhmm_ok(v: str) -> bool:
    try:
        datetime.strptime(v, "%H:%M")
        return True
    except Exception:
        return False
