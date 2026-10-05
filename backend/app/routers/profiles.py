"""Module 1 - Participant, Institution & Trainee profile management."""
import os
import uuid
from datetime import date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import models, security, models_ext as mx
from app.database import get_db
from app.deps import (require_roles, rv, row, get_or_404, user_institution_id, parse_date,
                      SUPER, INST, TRAINER, STAFF, ADMINS)

router = APIRouter(prefix="/api", tags=["profiles"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
ALLOWED_EXT = {".pdf", ".png", ".jpg", ".jpeg", ".docx"}
MAX_UPLOAD = 5 * 1024 * 1024
ALL_ROLES = {r.value for r in models.RoleEnum}


# ---------- access helpers ----------
def _target_in_scope(db: Session, actor: models.User, target: models.User) -> bool:
    """Institution admins / trainers may see people attached to their institution."""
    inst = user_institution_id(db, actor)
    if not inst:
        return False
    tp = db.query(mx.Profile).filter(mx.Profile.user_id == target.id).first()
    if tp and tp.institution_id == inst:
        return True
    pids = [p.id for p in db.query(models.Programme).filter(models.Programme.institution_id == inst)]
    if not pids:
        return False
    return db.query(models.Registration).filter(
        models.Registration.user_id == target.id, models.Registration.programme_id.in_(pids)).count() > 0


def resolve_target(db: Session, actor: models.User, uid: str, edit: bool) -> models.User:
    if uid == "me" or uid == actor.id:
        return actor
    target = get_or_404(db, models.User, uid, "User")
    role = rv(actor)
    if role == SUPER:
        return target
    if role == INST and _target_in_scope(db, actor, target):
        return target
    if role == TRAINER and not edit and _target_in_scope(db, actor, target):
        return target
    raise HTTPException(status_code=403, detail="You do not have access to this profile")


def _ensure_profile(db: Session, user: models.User) -> mx.Profile:
    p = db.query(mx.Profile).filter(mx.Profile.user_id == user.id).first()
    if not p:
        p = mx.Profile(user_id=user.id)
        db.add(p)
        db.commit()
        db.refresh(p)
    return p


def _full(db: Session, u: models.User, include_docs: bool = True) -> dict:
    p = _ensure_profile(db, u)
    inst = db.query(models.Institution).filter(models.Institution.id == p.institution_id).first() if p.institution_id else None
    out = {
        "user": {"id": u.id, "name": u.name, "email": u.email, "role": rv(u), "location": u.location,
                 "education": u.education, "career_interests": u.career_interests, "created_at": u.created_at},
        "profile": row(p),
        "institution": {"id": inst.id, "name": inst.name, "type": inst.type, "state": inst.state} if inst else None,
        "skills": [row(s, ("user_id",)) for s in u.user_skills],
        "training": [row(t) for t in db.query(mx.TrainingHistory).filter(mx.TrainingHistory.user_id == u.id)
                     .order_by(mx.TrainingHistory.start_date.desc())],
        "certificates": [{"id": c.id, "verification_id": c.verification_id, "programme_name": c.programme_name,
                          "skill": c.skill, "issued_date": c.issued_date} for c in u.certificates],
    }
    if include_docs:
        out["documents"] = [row(d, ("file_path",)) | {"has_file": bool(d.file_path)} for d in
                            db.query(mx.ProfileDocument).filter(mx.ProfileDocument.user_id == u.id)
                            .order_by(mx.ProfileDocument.uploaded_at.desc())]
    return out


# ---------- schemas ----------
class ProfileIn(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    location: Optional[str] = Field(None, max_length=160)
    education: Optional[str] = Field(None, max_length=160)
    career_interests: Optional[str] = Field(None, max_length=400)
    phone: Optional[str] = Field(None, pattern=r"^[+0-9\-\s]{7,16}$")
    dob: Optional[str] = None
    gender: Optional[str] = Field(None, pattern=r"^(Male|Female|Other)$")
    address: Optional[str] = Field(None, max_length=300)
    district: Optional[str] = Field(None, max_length=80)
    state: Optional[str] = Field(None, max_length=80)
    pincode: Optional[str] = Field(None, pattern=r"^[0-9]{6}$")
    institution_id: Optional[str] = None
    organisation: Optional[str] = Field(None, max_length=160)
    designation: Optional[str] = Field(None, max_length=120)
    bio: Optional[str] = Field(None, max_length=1000)
    preferred_language: Optional[str] = Field(None, max_length=40)
    open_to_work: Optional[bool] = None


class StatusIn(BaseModel):
    status: str = Field(pattern=r"^(active|inactive|suspended)$")


class AdminUserIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    role: str
    institution_id: Optional[str] = None
    location: Optional[str] = None


class TrainingIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    institution_name: Optional[str] = Field(None, max_length=200)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: str = Field("completed", pattern=r"^(ongoing|completed|dropped)$")
    grade: Optional[str] = Field(None, max_length=40)


class SkillIn(BaseModel):
    skill_name: str = Field(min_length=2, max_length=80)
    level_percent: int = Field(50, ge=0, le=100)


class InstitutionIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    type: str = Field("RICM", pattern=r"^(VAMNICOM|RICM|ICM|Other)$")
    state: Optional[str] = None
    address: Optional[str] = None
    district: Optional[str] = None
    pincode: Optional[str] = Field(None, pattern=r"^[0-9]{6}$")
    contact_person: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, pattern=r"^[+0-9\-\s]{7,16}$")
    website: Optional[str] = None
    facilities: Optional[str] = Field(None, max_length=600)
    status: str = Field("active", pattern=r"^(active|inactive)$")


# ---------- profiles ----------
@router.get("/profiles/me")
def my_profile(db: Session = Depends(get_db), user: models.User = Depends(security.get_current_user)):
    return _full(db, user)


@router.get("/profiles/{uid}")
def get_profile(uid: str, db: Session = Depends(get_db), user: models.User = Depends(security.get_current_user)):
    return _full(db, resolve_target(db, user, uid, edit=False))


@router.put("/profiles/{uid}")
def update_profile(uid: str, body: ProfileIn, db: Session = Depends(get_db),
                   user: models.User = Depends(security.get_current_user)):
    target = resolve_target(db, user, uid, edit=True)
    p = _ensure_profile(db, target)
    data = body.model_dump(exclude_unset=True)
    for f in ("name", "location", "education", "career_interests"):
        if f in data and data[f] is not None:
            setattr(target, f, data.pop(f))
        else:
            data.pop(f, None)
    if "dob" in data:
        d = parse_date(data["dob"], "dob") if data["dob"] else None
        if d and d >= date.today():
            raise HTTPException(status_code=422, detail="Date of birth must be in the past")
        data["dob"] = d
    if data.get("institution_id"):
        get_or_404(db, models.Institution, data["institution_id"], "Institution")
        # Staff cannot grant themselves an institution scope; only a super admin (or an
        # institution admin assigning their own institution to someone else) can.
        if rv(user) != SUPER and target.id == user.id and rv(target) in (INST, TRAINER):
            raise HTTPException(status_code=403, detail="Ask an administrator to assign your institution")
        # Institution-admins may only assign their own institution
        if rv(user) == INST and data["institution_id"] != user_institution_id(db, user):
            raise HTTPException(status_code=403, detail="You can only assign your own institution")
    for k, v in data.items():
        setattr(p, k, v)
    db.commit()
    return _full(db, target)


@router.patch("/profiles/{uid}/status")
def set_status(uid: str, body: StatusIn, db: Session = Depends(get_db),
               user: models.User = Depends(require_roles(SUPER, INST))):
    target = resolve_target(db, user, uid, edit=True)
    if target.id == user.id:
        raise HTTPException(status_code=400, detail="You cannot change your own status")
    _ensure_profile(db, target).status = body.status
    db.commit()
    return {"id": target.id, "status": body.status}


@router.get("/people")
def list_people(q: Optional[str] = None, role: Optional[str] = None, status: Optional[str] = None,
                institution_id: Optional[str] = None, skip: int = 0, limit: int = 25,
                db: Session = Depends(get_db), user: models.User = Depends(require_roles(*STAFF))):
    limit = max(1, min(limit, 100))
    query = db.query(models.User, mx.Profile).outerjoin(mx.Profile, mx.Profile.user_id == models.User.id)
    if rv(user) != SUPER:
        inst = user_institution_id(db, user)
        if not inst:
            return {"total": 0, "items": []}
        pids = [p.id for p in db.query(models.Programme).filter(models.Programme.institution_id == inst)]
        reg_users = db.query(models.Registration.user_id).filter(models.Registration.programme_id.in_(pids or ["-"]))
        query = query.filter(or_(mx.Profile.institution_id == inst, models.User.id.in_(reg_users)))
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(or_(models.User.name.ilike(like), models.User.email.ilike(like),
                                 models.User.location.ilike(like)))
    if role:
        if role not in ALL_ROLES:
            raise HTTPException(status_code=422, detail="Unknown role")
        query = query.filter(models.User.role == role)
    if status:
        query = query.filter(mx.Profile.status == status) if status != "active" else \
            query.filter(or_(mx.Profile.status == "active", mx.Profile.status.is_(None)))
    if institution_id:
        query = query.filter(mx.Profile.institution_id == institution_id)
    total = query.count()
    rows = query.order_by(models.User.created_at.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": [{
        "id": u.id, "name": u.name, "email": u.email, "role": rv(u), "location": u.location,
        "status": (p.status if p else "active") or "active", "phone": p.phone if p else None,
        "institution_id": p.institution_id if p else None} for u, p in rows]}


@router.post("/people", status_code=201)
def create_user(body: AdminUserIn, db: Session = Depends(get_db),
                user: models.User = Depends(require_roles(SUPER, INST))):
    if body.role not in ALL_ROLES:
        raise HTTPException(status_code=422, detail="Unknown role")
    if rv(user) == INST and body.role not in ("trainer", "trainee"):
        raise HTTPException(status_code=403, detail="Institution admins can only create trainers and trainees")
    if db.query(models.User).filter(models.User.email == body.email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    inst_id = user_institution_id(db, user) if rv(user) == INST else body.institution_id
    if inst_id:
        get_or_404(db, models.Institution, inst_id, "Institution")
    u = models.User(name=body.name, email=body.email, hashed_password=security.hash_password(body.password),
                    role=models.RoleEnum(body.role), location=body.location)
    db.add(u)
    db.commit()
    db.add(mx.Profile(user_id=u.id, institution_id=inst_id))
    db.commit()
    return {"id": u.id, "email": u.email, "role": body.role}


# ---------- training history ----------
def _training_from(body: TrainingIn) -> dict:
    d = body.model_dump()
    d["start_date"] = parse_date(d["start_date"], "start_date") if d.get("start_date") else None
    d["end_date"] = parse_date(d["end_date"], "end_date") if d.get("end_date") else None
    if d["start_date"] and d["end_date"] and d["end_date"] < d["start_date"]:
        raise HTTPException(status_code=422, detail="End date cannot be before start date")
    return d


@router.post("/profiles/{uid}/training", status_code=201)
def add_training(uid: str, body: TrainingIn, db: Session = Depends(get_db),
                 user: models.User = Depends(security.get_current_user)):
    t = resolve_target(db, user, uid, edit=True)
    obj = mx.TrainingHistory(user_id=t.id, **_training_from(body))
    db.add(obj)
    db.commit()
    return row(obj)


@router.put("/profiles/{uid}/training/{tid}")
def edit_training(uid: str, tid: str, body: TrainingIn, db: Session = Depends(get_db),
                  user: models.User = Depends(security.get_current_user)):
    t = resolve_target(db, user, uid, edit=True)
    obj = get_or_404(db, mx.TrainingHistory, tid, "Training record")
    if obj.user_id != t.id:
        raise HTTPException(status_code=404, detail="Training record not found")
    for k, v in _training_from(body).items():
        setattr(obj, k, v)
    db.commit()
    return row(obj)


@router.delete("/profiles/{uid}/training/{tid}", status_code=204)
def delete_training(uid: str, tid: str, db: Session = Depends(get_db),
                    user: models.User = Depends(security.get_current_user)):
    t = resolve_target(db, user, uid, edit=True)
    obj = get_or_404(db, mx.TrainingHistory, tid, "Training record")
    if obj.user_id != t.id:
        raise HTTPException(status_code=404, detail="Training record not found")
    db.delete(obj)
    db.commit()


# ---------- skills ----------
@router.post("/profiles/{uid}/skills", status_code=201)
def add_skill(uid: str, body: SkillIn, db: Session = Depends(get_db),
              user: models.User = Depends(security.get_current_user)):
    t = resolve_target(db, user, uid, edit=True)
    name = body.skill_name.strip()
    existing = db.query(models.UserSkill).filter(models.UserSkill.user_id == t.id,
                                                  models.UserSkill.skill_name.ilike(name)).first()
    if existing:
        existing.level_percent = body.level_percent
        obj = existing
    else:
        obj = models.UserSkill(user_id=t.id, skill_name=name, level_percent=body.level_percent)
        db.add(obj)
    db.commit()
    return row(obj, ("user_id",))


@router.delete("/profiles/{uid}/skills/{sid}", status_code=204)
def delete_skill(uid: str, sid: str, db: Session = Depends(get_db),
                 user: models.User = Depends(security.get_current_user)):
    t = resolve_target(db, user, uid, edit=True)
    obj = get_or_404(db, models.UserSkill, sid, "Skill")
    if obj.user_id != t.id:
        raise HTTPException(status_code=404, detail="Skill not found")
    db.delete(obj)
    db.commit()


# ---------- documents ----------
@router.post("/profiles/{uid}/documents", status_code=201)
async def add_document(uid: str, title: str = Form(..., min_length=2, max_length=160),
                       doc_type: str = Form("Other"), file_url: Optional[str] = Form(None),
                       file: Optional[UploadFile] = File(None), db: Session = Depends(get_db),
                       user: models.User = Depends(security.get_current_user)):
    t = resolve_target(db, user, uid, edit=True)
    if not file and not file_url:
        raise HTTPException(status_code=422, detail="Upload a file or provide a link")
    if file_url and not file_url.lower().startswith(("http://", "https://")):
        raise HTTPException(status_code=422, detail="Link must start with http:// or https://")
    stored = None
    orig = None
    if file:
        ext = os.path.splitext(file.filename or "")[1].lower()
        if ext not in ALLOWED_EXT:
            raise HTTPException(status_code=422, detail="Allowed file types: PDF, PNG, JPG, DOCX")
        data = await file.read()
        if len(data) > MAX_UPLOAD:
            raise HTTPException(status_code=413, detail="File is larger than 5 MB")
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        stored = f"{uuid.uuid4().hex}{ext}"
        with open(os.path.join(UPLOAD_DIR, stored), "wb") as fh:
            fh.write(data)
        orig = os.path.basename(file.filename or stored)[:120]
    obj = mx.ProfileDocument(user_id=t.id, title=title, doc_type=doc_type[:40], file_path=stored,
                             file_url=None if file else file_url, original_name=orig)
    db.add(obj)
    db.commit()
    return row(obj, ("file_path",)) | {"has_file": bool(stored)}


@router.get("/documents/{doc_id}/file")
def download_document(doc_id: str, db: Session = Depends(get_db),
                      user: models.User = Depends(security.get_current_user)):
    d = get_or_404(db, mx.ProfileDocument, doc_id, "Document")
    owner = get_or_404(db, models.User, d.user_id, "User")
    resolve_target(db, user, owner.id, edit=False)
    if not d.file_path:
        raise HTTPException(status_code=404, detail="No file stored for this document")
    path = os.path.join(UPLOAD_DIR, os.path.basename(d.file_path))
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File is no longer available on the server")
    return FileResponse(path, filename=d.original_name or d.file_path)


@router.patch("/documents/{doc_id}/verify")
def verify_document(doc_id: str, verified: bool = True, db: Session = Depends(get_db),
                    user: models.User = Depends(require_roles(SUPER, INST))):
    d = get_or_404(db, mx.ProfileDocument, doc_id, "Document")
    resolve_target(db, user, d.user_id, edit=True)
    d.verified = verified
    db.commit()
    return {"id": d.id, "verified": d.verified}


@router.delete("/documents/{doc_id}", status_code=204)
def delete_document(doc_id: str, db: Session = Depends(get_db),
                    user: models.User = Depends(security.get_current_user)):
    d = get_or_404(db, mx.ProfileDocument, doc_id, "Document")
    resolve_target(db, user, d.user_id, edit=True)
    if d.file_path:
        try:
            os.remove(os.path.join(UPLOAD_DIR, os.path.basename(d.file_path)))
        except OSError:
            pass
    db.delete(d)
    db.commit()


# ---------- institutions ----------
def _inst_out(db: Session, i: models.Institution) -> dict:
    p = db.query(mx.InstitutionProfile).filter(mx.InstitutionProfile.institution_id == i.id).first()
    out = {"id": i.id, "name": i.name, "type": i.type, "state": i.state}
    out.update(row(p, ("id", "institution_id")) if p else {"status": "active"})
    out["programme_count"] = db.query(models.Programme).filter(models.Programme.institution_id == i.id).count()
    return out


@router.get("/institutions")
def list_institutions(db: Session = Depends(get_db), user: models.User = Depends(security.get_current_user)):
    return [_inst_out(db, i) for i in db.query(models.Institution).order_by(models.Institution.name)]


def _save_inst(db: Session, i: models.Institution, body: InstitutionIn):
    d = body.model_dump()
    i.name, i.type, i.state = d.pop("name"), d.pop("type"), d.pop("state")
    p = db.query(mx.InstitutionProfile).filter(mx.InstitutionProfile.institution_id == i.id).first()
    if not p:
        p = mx.InstitutionProfile(institution_id=i.id)
        db.add(p)
    for k, v in d.items():
        setattr(p, k, v)


@router.post("/institutions", status_code=201)
def create_institution(body: InstitutionIn, db: Session = Depends(get_db),
                       user: models.User = Depends(require_roles(SUPER))):
    if db.query(models.Institution).filter(models.Institution.name.ilike(body.name)).first():
        raise HTTPException(status_code=400, detail="An institution with this name already exists")
    i = models.Institution(name=body.name)
    db.add(i)
    db.flush()
    _save_inst(db, i, body)
    db.commit()
    return _inst_out(db, i)


@router.put("/institutions/{iid}")
def update_institution(iid: str, body: InstitutionIn, db: Session = Depends(get_db),
                       user: models.User = Depends(require_roles(SUPER, INST))):
    i = get_or_404(db, models.Institution, iid, "Institution")
    if rv(user) == INST and user_institution_id(db, user) != iid:
        raise HTTPException(status_code=403, detail="You can only edit your own institution")
    _save_inst(db, i, body)
    db.commit()
    return _inst_out(db, i)
