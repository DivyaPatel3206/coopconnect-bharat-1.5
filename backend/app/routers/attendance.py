"""Module 2 - QR-based digital attendance."""
import csv
import io
import secrets
from datetime import datetime, timedelta, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models, security, models_ext as mx
from app.database import get_db
from app.deps import (require_roles, rv, row, get_or_404, visible_programme_ids, assert_programme_access,
                      user_institution_id, parse_date, STAFF, TRAINEE, TRAINER, SUPER)

router = APIRouter(prefix="/api/attendance", tags=["attendance"])
MIN_SECONDS_BETWEEN_SCANS = 60  # stops an accidental double scan from checking straight back out


class SessionIn(BaseModel):
    programme_id: str
    title: str = Field(min_length=2, max_length=160)
    session_date: str
    duration_minutes: int = Field(480, ge=15, le=1440)


class ScanIn(BaseModel):
    code: str = Field(min_length=4, max_length=64)


class ManualIn(BaseModel):
    session_id: str
    user_id: str
    check_in: str
    check_out: Optional[str] = None


def _dt(v: Optional[str], field: str) -> Optional[datetime]:
    if not v:
        return None
    try:
        return datetime.fromisoformat(v.replace("Z", "")).replace(tzinfo=None)
    except Exception:
        raise HTTPException(status_code=422, detail=f"Invalid {field}")


def _session_out(db: Session, s: mx.AttendanceSession) -> dict:
    prog = db.query(models.Programme).filter(models.Programme.id == s.programme_id).first()
    recs = db.query(mx.AttendanceRecord).filter(mx.AttendanceRecord.session_id == s.id).all()
    live = s.is_open and (not s.closes_at or s.closes_at > datetime.utcnow())
    return {**row(s), "programme_name": prog.name if prog else None, "is_live": live,
            "checked_in": len(recs), "checked_out": sum(1 for r in recs if r.check_out)}


def _hours(r: mx.AttendanceRecord) -> float:
    if r.check_in and r.check_out:
        return round((r.check_out - r.check_in).total_seconds() / 3600, 2)
    return 0.0


def _roster(db: Session, programme_id: str):
    """Approved trainees for the programme + any trainer who has a record in it."""
    prog = get_or_404(db, models.Programme, programme_id, "Programme")
    trainees = (db.query(models.User).join(models.Registration, models.Registration.user_id == models.User.id)
                .filter(models.Registration.programme_id == programme_id,
                        models.Registration.status.in_([models.RegistrationStatus.approved,
                                                        models.RegistrationStatus.completed])).all())
    sids = [s.id for s in db.query(mx.AttendanceSession).filter(mx.AttendanceSession.programme_id == programme_id)]
    trainer_ids = {r.user_id for r in db.query(mx.AttendanceRecord).filter(
        mx.AttendanceRecord.session_id.in_(sids or ["-"]), mx.AttendanceRecord.role == TRAINER)}
    trainers = db.query(models.User).filter(models.User.id.in_(trainer_ids or ["-"])).all()
    return prog, trainees + [t for t in trainers if t not in trainees]


def _csv(name: str, header: list, rows: list) -> StreamingResponse:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(header)
    w.writerows(rows)
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="{name}"'})


# ---------- sessions ----------
@router.post("/sessions", status_code=201)
def create_session(body: SessionIn, db: Session = Depends(get_db),
                   user: models.User = Depends(require_roles(*STAFF))):
    assert_programme_access(db, user, body.programme_id, manage=True)
    d = parse_date(body.session_date, "session_date")
    dup = db.query(mx.AttendanceSession).filter(mx.AttendanceSession.programme_id == body.programme_id,
                                                mx.AttendanceSession.session_date == d,
                                                mx.AttendanceSession.title == body.title).first()
    if dup:
        raise HTTPException(status_code=409, detail="A session with this title already exists for that date")
    s = mx.AttendanceSession(programme_id=body.programme_id, title=body.title, session_date=d,
                             code=secrets.token_urlsafe(9), created_by=user.id,
                             closes_at=datetime.utcnow() + timedelta(minutes=body.duration_minutes))
    db.add(s)
    db.commit()
    return _session_out(db, s)


@router.get("/sessions")
def list_sessions(programme_id: Optional[str] = None, on: Optional[str] = None,
                  db: Session = Depends(get_db), user: models.User = Depends(security.get_current_user)):
    ids = visible_programme_ids(db, user)
    q = db.query(mx.AttendanceSession)
    if ids is not None:
        q = q.filter(mx.AttendanceSession.programme_id.in_(ids or ["-"]))
    if programme_id:
        q = q.filter(mx.AttendanceSession.programme_id == programme_id)
    if on:
        q = q.filter(mx.AttendanceSession.session_date == parse_date(on, "on"))
    out = []
    for s in q.order_by(mx.AttendanceSession.session_date.desc()).limit(200):
        d = _session_out(db, s)
        if rv(user) == TRAINEE:
            d.pop("code")  # trainees must scan the QR shown by the trainer, not read the code from the API
        out.append(d)
    return out


@router.patch("/sessions/{sid}")
def set_session_open(sid: str, is_open: bool, db: Session = Depends(get_db),
                     user: models.User = Depends(require_roles(*STAFF))):
    s = get_or_404(db, mx.AttendanceSession, sid, "Session")
    assert_programme_access(db, user, s.programme_id, manage=True)
    s.is_open = is_open
    if is_open and (not s.closes_at or s.closes_at < datetime.utcnow()):
        s.closes_at = datetime.utcnow() + timedelta(hours=4)
    db.commit()
    return _session_out(db, s)


@router.post("/sessions/{sid}/rotate")
def rotate_code(sid: str, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*STAFF))):
    """Issue a fresh QR (invalidates a screenshot that was shared around)."""
    s = get_or_404(db, mx.AttendanceSession, sid, "Session")
    assert_programme_access(db, user, s.programme_id, manage=True)
    s.code = secrets.token_urlsafe(9)
    db.commit()
    return _session_out(db, s)


# ---------- scan ----------
@router.post("/scan")
def scan(body: ScanIn, db: Session = Depends(get_db),
         user: models.User = Depends(require_roles(TRAINEE, TRAINER))):
    s = db.query(mx.AttendanceSession).filter(mx.AttendanceSession.code == body.code.strip()).first()
    if not s:
        raise HTTPException(status_code=404, detail="This QR code is not valid")
    now = datetime.utcnow()
    if not s.is_open or (s.closes_at and s.closes_at < now):
        raise HTTPException(status_code=410, detail="This attendance session is closed")
    prog = get_or_404(db, models.Programme, s.programme_id, "Programme")
    role = rv(user)
    if role == TRAINEE:
        ok = db.query(models.Registration).filter(
            models.Registration.user_id == user.id, models.Registration.programme_id == s.programme_id,
            models.Registration.status.in_([models.RegistrationStatus.approved,
                                            models.RegistrationStatus.completed])).first()
        if not ok:
            raise HTTPException(status_code=403, detail="You are not an approved participant of this programme")
    elif user_institution_id(db, user) != prog.institution_id:
        raise HTTPException(status_code=403, detail="You are not assigned to this programme's institution")

    rec = db.query(mx.AttendanceRecord).filter(mx.AttendanceRecord.session_id == s.id,
                                               mx.AttendanceRecord.user_id == user.id).first()
    if not rec:
        rec = mx.AttendanceRecord(session_id=s.id, user_id=user.id, role=role, check_in=now, method="qr")
        db.add(rec)
        action = "check_in"
    elif rec.check_out:
        raise HTTPException(status_code=409, detail="You have already checked in and out for this session")
    elif (now - rec.check_in).total_seconds() < MIN_SECONDS_BETWEEN_SCANS:
        raise HTTPException(status_code=429, detail="You just checked in. Wait a minute before checking out.")
    else:
        rec.check_out = now
        action = "check_out"
    db.commit()
    return {"action": action, "session": _session_out(db, s), "record": row(rec)}


@router.post("/manual", status_code=201)
def manual_mark(body: ManualIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*STAFF))):
    s = get_or_404(db, mx.AttendanceSession, body.session_id, "Session")
    assert_programme_access(db, user, s.programme_id, manage=True)
    target = get_or_404(db, models.User, body.user_id, "User")
    cin, cout = _dt(body.check_in, "check_in"), _dt(body.check_out, "check_out")
    if cout and cin and cout < cin:
        raise HTTPException(status_code=422, detail="Check-out cannot be before check-in")
    rec = db.query(mx.AttendanceRecord).filter(mx.AttendanceRecord.session_id == s.id,
                                               mx.AttendanceRecord.user_id == target.id).first()
    if not rec:
        rec = mx.AttendanceRecord(session_id=s.id, user_id=target.id, role=rv(target))
        db.add(rec)
    rec.check_in, rec.check_out, rec.method = cin, cout, "manual"
    db.commit()
    return row(rec)


# ---------- records & reports ----------
def _record_rows(db: Session, recs):
    out = []
    for r in recs:
        s = db.query(mx.AttendanceSession).filter(mx.AttendanceSession.id == r.session_id).first()
        u = db.query(models.User).filter(models.User.id == r.user_id).first()
        prog = db.query(models.Programme).filter(models.Programme.id == s.programme_id).first() if s else None
        out.append({**row(r), "hours": _hours(r), "user_name": u.name if u else None,
                    "session_title": s.title if s else None, "session_date": s.session_date if s else None,
                    "programme_id": s.programme_id if s else None, "programme_name": prog.name if prog else None})
    return out


@router.get("/mine")
def my_records(db: Session = Depends(get_db), user: models.User = Depends(security.get_current_user)):
    recs = db.query(mx.AttendanceRecord).filter(mx.AttendanceRecord.user_id == user.id) \
        .order_by(mx.AttendanceRecord.check_in.desc()).limit(200).all()
    return _record_rows(db, recs)


@router.get("/records")
def all_records(programme_id: Optional[str] = None, user_id: Optional[str] = None,
                date_from: Optional[str] = None, date_to: Optional[str] = None,
                db: Session = Depends(get_db), user: models.User = Depends(require_roles(*STAFF))):
    ids = visible_programme_ids(db, user)
    q = db.query(mx.AttendanceRecord).join(mx.AttendanceSession, mx.AttendanceSession.id == mx.AttendanceRecord.session_id)
    if ids is not None:
        q = q.filter(mx.AttendanceSession.programme_id.in_(ids or ["-"]))
    if programme_id:
        q = q.filter(mx.AttendanceSession.programme_id == programme_id)
    if user_id:
        q = q.filter(mx.AttendanceRecord.user_id == user_id)
    if date_from:
        q = q.filter(mx.AttendanceSession.session_date >= parse_date(date_from, "date_from"))
    if date_to:
        q = q.filter(mx.AttendanceSession.session_date <= parse_date(date_to, "date_to"))
    return _record_rows(db, q.order_by(mx.AttendanceSession.session_date.desc(), mx.AttendanceRecord.check_in.desc()).limit(500))


@router.get("/report/daily")
def daily_report(programme_id: str, on: str, format: str = "json", db: Session = Depends(get_db),
                 user: models.User = Depends(require_roles(*STAFF))):
    assert_programme_access(db, user, programme_id, manage=True)
    d = parse_date(on, "on")
    prog, people = _roster(db, programme_id)
    sessions = db.query(mx.AttendanceSession).filter(mx.AttendanceSession.programme_id == programme_id,
                                                     mx.AttendanceSession.session_date == d).all()
    sids = [s.id for s in sessions]
    recs = {(r.user_id): r for r in db.query(mx.AttendanceRecord).filter(mx.AttendanceRecord.session_id.in_(sids or ["-"]))}
    rows = []
    for p in people:
        r = recs.get(p.id)
        status = "absent" if not r else ("present" if r.check_out else "incomplete")
        rows.append({"user_id": p.id, "name": p.name, "role": rv(p), "status": status,
                     "check_in": r.check_in if r else None, "check_out": r.check_out if r else None,
                     "hours": _hours(r) if r else 0})
    summary = {"present": sum(x["status"] == "present" for x in rows),
               "incomplete": sum(x["status"] == "incomplete" for x in rows),
               "absent": sum(x["status"] == "absent" for x in rows), "total": len(rows)}
    if format == "csv":
        return _csv(f"attendance-{d}.csv", ["Name", "Role", "Status", "Check in (UTC)", "Check out (UTC)", "Hours"],
                    [[x["name"], x["role"], x["status"], x["check_in"] or "", x["check_out"] or "", x["hours"]] for x in rows])
    return {"programme": prog.name, "date": d, "sessions": len(sessions), "summary": summary, "rows": rows}


@router.get("/report/monthly")
def monthly_report(programme_id: str, month: str, format: str = "json", db: Session = Depends(get_db),
                   user: models.User = Depends(require_roles(*STAFF))):
    assert_programme_access(db, user, programme_id, manage=True)
    try:
        start = date.fromisoformat(month + "-01")
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid month, expected YYYY-MM")
    end = date(start.year + (start.month == 12), (start.month % 12) + 1, 1)
    prog, people = _roster(db, programme_id)
    sessions = db.query(mx.AttendanceSession).filter(mx.AttendanceSession.programme_id == programme_id,
                                                     mx.AttendanceSession.session_date >= start,
                                                     mx.AttendanceSession.session_date < end).all()
    held = len(sessions)
    recs = db.query(mx.AttendanceRecord).filter(mx.AttendanceRecord.session_id.in_([s.id for s in sessions] or ["-"])).all()
    rows = []
    for p in people:
        mine = [r for r in recs if r.user_id == p.id]
        present = len(mine)
        rows.append({"user_id": p.id, "name": p.name, "role": rv(p), "sessions_held": held,
                     "days_present": present, "hours": round(sum(_hours(r) for r in mine), 2),
                     "percentage": round(present / held * 100) if held else 0})
    if format == "csv":
        return _csv(f"attendance-{month}.csv", ["Name", "Role", "Sessions held", "Days present", "Hours", "Attendance %"],
                    [[x["name"], x["role"], x["sessions_held"], x["days_present"], x["hours"], x["percentage"]] for x in rows])
    return {"programme": prog.name, "month": month, "sessions_held": held, "rows": rows}
