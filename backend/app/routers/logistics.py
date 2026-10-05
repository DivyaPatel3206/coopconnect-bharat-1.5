"""Module 3 - Timetable, hostel & logistics management."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models, security, models_ext as mx, notify
from app.database import get_db
from app.deps import (require_roles, rv, row, get_or_404, visible_programme_ids, assert_programme_access,
                      user_institution_id, parse_date, hhmm_ok, STAFF, ADMINS, SUPER, INST)

router = APIRouter(prefix="/api/logistics", tags=["logistics"])
TIME = r"^([01][0-9]|2[0-3]):[0-5][0-9]$"


def _inst_scope(db, user, institution_id: Optional[str]) -> Optional[str]:
    """Non-super admins are pinned to their own institution."""
    if rv(user) == SUPER:
        return institution_id
    own = user_institution_id(db, user)
    if not own:
        raise HTTPException(status_code=403, detail="Your account is not linked to an institution yet")
    return own


def _check_inst(db, user, institution_id):
    if rv(user) != SUPER and institution_id != user_institution_id(db, user):
        raise HTTPException(status_code=403, detail="This belongs to another institution")


# ---------------- venues ----------------
class VenueIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    venue_type: str = Field("Classroom", max_length=40)
    capacity: int = Field(30, ge=1, le=5000)
    location: Optional[str] = Field(None, max_length=200)
    facilities: Optional[str] = Field(None, max_length=300)
    institution_id: Optional[str] = None


@router.get("/venues")
def list_venues(db: Session = Depends(get_db), user: models.User = Depends(require_roles(*STAFF))):
    q = db.query(mx.Venue)
    if rv(user) != SUPER:
        q = q.filter(mx.Venue.institution_id == user_institution_id(db, user))
    return [row(v) for v in q.order_by(mx.Venue.name)]


@router.post("/venues", status_code=201)
def create_venue(body: VenueIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*ADMINS))):
    d = body.model_dump()
    d["institution_id"] = _inst_scope(db, user, d["institution_id"])
    v = mx.Venue(**d)
    db.add(v)
    db.commit()
    return row(v)


@router.put("/venues/{vid}")
def update_venue(vid: str, body: VenueIn, db: Session = Depends(get_db),
                 user: models.User = Depends(require_roles(*ADMINS))):
    v = get_or_404(db, mx.Venue, vid, "Venue")
    _check_inst(db, user, v.institution_id)
    for k, val in body.model_dump(exclude={"institution_id"}).items():
        setattr(v, k, val)
    db.commit()
    return row(v)


@router.delete("/venues/{vid}", status_code=204)
def delete_venue(vid: str, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*ADMINS))):
    v = get_or_404(db, mx.Venue, vid, "Venue")
    _check_inst(db, user, v.institution_id)
    if db.query(mx.TimetableEntry).filter(mx.TimetableEntry.venue_id == vid).count():
        raise HTTPException(status_code=409, detail="Venue is used in the timetable; reassign those sessions first")
    db.delete(v)
    db.commit()


# ---------------- timetable ----------------
class TimetableIn(BaseModel):
    programme_id: str
    title: str = Field(min_length=2, max_length=160)
    topic: Optional[str] = Field(None, max_length=200)
    session_date: str
    start_time: str = Field(pattern=TIME)
    end_time: str = Field(pattern=TIME)
    trainer_name: Optional[str] = Field(None, max_length=120)
    venue_id: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=500)


def _conflicts(db: Session, d: date, start: str, end: str, venue_id, trainer, skip_id=None):
    q = db.query(mx.TimetableEntry).filter(mx.TimetableEntry.session_date == d)
    if skip_id:
        q = q.filter(mx.TimetableEntry.id != skip_id)
    for e in q:
        overlap = start < e.end_time and e.start_time < end
        if not overlap:
            continue
        if venue_id and e.venue_id == venue_id:
            return f"Venue is already booked {e.start_time}-{e.end_time} ({e.title})"
        if trainer and e.trainer_name and e.trainer_name.lower() == trainer.lower():
            return f"{trainer} is already scheduled {e.start_time}-{e.end_time} ({e.title})"
    return None


def _tt_out(db: Session, e: mx.TimetableEntry) -> dict:
    v = db.query(mx.Venue).filter(mx.Venue.id == e.venue_id).first() if e.venue_id else None
    p = db.query(models.Programme).filter(models.Programme.id == e.programme_id).first()
    return {**row(e), "venue_name": v.name if v else None, "programme_name": p.name if p else None}


def _validate_tt(db, user, body: TimetableIn, skip_id=None):
    assert_programme_access(db, user, body.programme_id, manage=True)
    d = parse_date(body.session_date, "session_date")
    if body.end_time <= body.start_time:
        raise HTTPException(status_code=422, detail="End time must be after start time")
    if body.venue_id:
        get_or_404(db, mx.Venue, body.venue_id, "Venue")
    msg = _conflicts(db, d, body.start_time, body.end_time, body.venue_id, body.trainer_name, skip_id)
    if msg:
        raise HTTPException(status_code=409, detail=msg)
    return d


@router.get("/timetable")
def list_timetable(programme_id: Optional[str] = None, date_from: Optional[str] = None,
                   date_to: Optional[str] = None, db: Session = Depends(get_db),
                   user: models.User = Depends(security.get_current_user)):
    ids = visible_programme_ids(db, user)
    q = db.query(mx.TimetableEntry)
    if ids is not None:
        q = q.filter(mx.TimetableEntry.programme_id.in_(ids or ["-"]))
    if programme_id:
        q = q.filter(mx.TimetableEntry.programme_id == programme_id)
    if date_from:
        q = q.filter(mx.TimetableEntry.session_date >= parse_date(date_from, "date_from"))
    if date_to:
        q = q.filter(mx.TimetableEntry.session_date <= parse_date(date_to, "date_to"))
    return [_tt_out(db, e) for e in q.order_by(mx.TimetableEntry.session_date, mx.TimetableEntry.start_time).limit(500)]


@router.post("/timetable", status_code=201)
def create_entry(body: TimetableIn, background: BackgroundTasks, notify_users: bool = True, db: Session = Depends(get_db),
                 user: models.User = Depends(require_roles(*STAFF))):
    d = _validate_tt(db, user, body)
    e = mx.TimetableEntry(**{**body.model_dump(), "session_date": d})
    db.add(e)
    db.commit()
    background.add_task(notify.run_event, "created", notify.snapshot(db, e), notify_users)
    return _tt_out(db, e)


@router.put("/timetable/{eid}")
def update_entry(eid: str, body: TimetableIn, background: BackgroundTasks, notify_users: bool = True,
                 db: Session = Depends(get_db), user: models.User = Depends(require_roles(*STAFF))):
    e = get_or_404(db, mx.TimetableEntry, eid, "Timetable entry")
    assert_programme_access(db, user, e.programme_id, manage=True)
    d = _validate_tt(db, user, body, skip_id=eid)
    for k, v in {**body.model_dump(), "session_date": d}.items():
        setattr(e, k, v)
    db.commit()
    background.add_task(notify.run_event, "updated", notify.snapshot(db, e), notify_users)
    return _tt_out(db, e)


@router.delete("/timetable/{eid}", status_code=204)
def delete_entry(eid: str, background: BackgroundTasks, notify_users: bool = True, db: Session = Depends(get_db),
                 user: models.User = Depends(require_roles(*STAFF))):
    e = get_or_404(db, mx.TimetableEntry, eid, "Timetable entry")
    assert_programme_access(db, user, e.programme_id, manage=True)
    snap = notify.snapshot(db, e)
    db.delete(e)
    db.commit()
    background.add_task(notify.run_event, "cancelled", snap, notify_users)


# ---------------- hostels & rooms ----------------
class HostelIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    gender_type: str = Field("Mixed", pattern=r"^(Male|Female|Mixed)$")
    address: Optional[str] = Field(None, max_length=200)
    institution_id: Optional[str] = None


class RoomsIn(BaseModel):
    floor: int = Field(0, ge=0, le=50)
    prefix: str = Field("", max_length=6)
    start_no: int = Field(1, ge=1, le=9999)
    count: int = Field(1, ge=1, le=100)
    capacity: int = Field(2, ge=1, le=20)


class AllocationIn(BaseModel):
    room_id: str
    user_id: str
    programme_id: Optional[str] = None
    check_in_date: str
    check_out_date: str


def _occupied(db: Session, room_id: str, start: date, end: date, skip_user=None) -> int:
    q = db.query(mx.HostelAllocation).filter(
        mx.HostelAllocation.room_id == room_id, mx.HostelAllocation.status == "active",
        mx.HostelAllocation.check_in_date <= end, mx.HostelAllocation.check_out_date >= start)
    if skip_user:
        q = q.filter(mx.HostelAllocation.user_id != skip_user)
    return q.count()


def _hostel_out(db: Session, h: mx.Hostel, on: date) -> dict:
    rooms = []
    for r in sorted(h.rooms, key=lambda x: (x.floor, x.room_no)):
        occ = db.query(mx.HostelAllocation).filter(
            mx.HostelAllocation.room_id == r.id, mx.HostelAllocation.status == "active",
            mx.HostelAllocation.check_in_date <= on, mx.HostelAllocation.check_out_date >= on).all()
        names = []
        for a in occ:
            u = db.query(models.User).filter(models.User.id == a.user_id).first()
            names.append({"allocation_id": a.id, "user_id": a.user_id, "name": u.name if u else "?",
                          "check_out_date": a.check_out_date})
        cap = r.capacity if r.status == "available" else 0
        rooms.append({**row(r, ("hostel_id",)), "occupants": names, "occupied": len(names),
                      "available": max(0, cap - len(names))})
    beds = sum(r["capacity"] for r in rooms if r["status"] == "available")
    used = sum(r["occupied"] for r in rooms)
    return {**row(h), "rooms": rooms, "total_beds": beds, "occupied_beds": used,
            "available_beds": max(0, beds - used), "occupancy_percent": round(used / beds * 100) if beds else 0}


@router.get("/hostels")
def list_hostels(on: Optional[str] = None, db: Session = Depends(get_db),
                 user: models.User = Depends(require_roles(*STAFF))):
    day = parse_date(on, "on") if on else date.today()
    q = db.query(mx.Hostel)
    if rv(user) != SUPER:
        q = q.filter(mx.Hostel.institution_id == user_institution_id(db, user))
    return [_hostel_out(db, h, day) for h in q.order_by(mx.Hostel.name)]


@router.post("/hostels", status_code=201)
def create_hostel(body: HostelIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*ADMINS))):
    d = body.model_dump()
    d["institution_id"] = _inst_scope(db, user, d["institution_id"])
    h = mx.Hostel(**d)
    db.add(h)
    db.commit()
    return _hostel_out(db, h, date.today())


@router.delete("/hostels/{hid}", status_code=204)
def delete_hostel(hid: str, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*ADMINS))):
    h = get_or_404(db, mx.Hostel, hid, "Hostel")
    _check_inst(db, user, h.institution_id)
    ids = [r.id for r in h.rooms]
    if db.query(mx.HostelAllocation).filter(mx.HostelAllocation.room_id.in_(ids or ["-"]),
                                            mx.HostelAllocation.status == "active").count():
        raise HTTPException(status_code=409, detail="Hostel has active allocations; vacate them first")
    db.query(mx.HostelAllocation).filter(mx.HostelAllocation.room_id.in_(ids or ["-"])).delete(synchronize_session=False)
    db.delete(h)
    db.commit()


@router.post("/hostels/{hid}/rooms", status_code=201)
def add_rooms(hid: str, body: RoomsIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*ADMINS))):
    h = get_or_404(db, mx.Hostel, hid, "Hostel")
    _check_inst(db, user, h.institution_id)
    existing = {r.room_no for r in h.rooms}
    added = 0
    for i in range(body.count):
        no = f"{body.prefix}{body.start_no + i}"
        if no in existing:
            continue
        db.add(mx.Room(hostel_id=h.id, room_no=no, floor=body.floor, capacity=body.capacity))
        added += 1
    if not added:
        raise HTTPException(status_code=409, detail="Those room numbers already exist")
    db.commit()
    db.refresh(h)
    return _hostel_out(db, h, date.today())


@router.patch("/rooms/{rid}")
def update_room(rid: str, status: Optional[str] = None, capacity: Optional[int] = None,
                db: Session = Depends(get_db), user: models.User = Depends(require_roles(*ADMINS))):
    r = get_or_404(db, mx.Room, rid, "Room")
    _check_inst(db, user, r.hostel.institution_id)
    if status:
        if status not in ("available", "maintenance"):
            raise HTTPException(status_code=422, detail="Invalid status")
        r.status = status
    if capacity is not None:
        if capacity < 1 or capacity > 20:
            raise HTTPException(status_code=422, detail="Capacity must be 1-20")
        r.capacity = capacity
    db.commit()
    return row(r)


@router.post("/allocations", status_code=201)
def allocate(body: AllocationIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*ADMINS))):
    room = get_or_404(db, mx.Room, body.room_id, "Room")
    _check_inst(db, user, room.hostel.institution_id)
    person = get_or_404(db, models.User, body.user_id, "User")
    start, end = parse_date(body.check_in_date, "check_in_date"), parse_date(body.check_out_date, "check_out_date")
    if end < start:
        raise HTTPException(status_code=422, detail="Check-out date cannot be before check-in date")
    if room.status != "available":
        raise HTTPException(status_code=409, detail="Room is under maintenance")
    if body.programme_id:
        assert_programme_access(db, user, body.programme_id)
    prof = db.query(mx.Profile).filter(mx.Profile.user_id == person.id).first()
    gt = room.hostel.gender_type
    if gt != "Mixed" and prof and prof.gender in ("Male", "Female") and prof.gender != gt:
        raise HTTPException(status_code=409, detail=f"This is a {gt.lower()}-only hostel")
    clash = db.query(mx.HostelAllocation).filter(
        mx.HostelAllocation.user_id == person.id, mx.HostelAllocation.status == "active",
        mx.HostelAllocation.check_in_date <= end, mx.HostelAllocation.check_out_date >= start).first()
    if clash:
        raise HTTPException(status_code=409, detail=f"{person.name} already has a room for these dates")
    if _occupied(db, room.id, start, end) >= room.capacity:
        raise HTTPException(status_code=409, detail="Room is full for these dates")
    a = mx.HostelAllocation(room_id=room.id, user_id=person.id, programme_id=body.programme_id,
                            check_in_date=start, check_out_date=end)
    db.add(a)
    db.commit()
    return row(a)


@router.patch("/allocations/{aid}/vacate")
def vacate(aid: str, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*ADMINS))):
    a = get_or_404(db, mx.HostelAllocation, aid, "Allocation")
    room = db.query(mx.Room).filter(mx.Room.id == a.room_id).first()
    _check_inst(db, user, room.hostel.institution_id)
    a.status = "vacated"
    db.commit()
    return row(a)


@router.get("/allocations/mine")
def my_allocations(db: Session = Depends(get_db), user: models.User = Depends(security.get_current_user)):
    out = []
    for a in db.query(mx.HostelAllocation).filter(mx.HostelAllocation.user_id == user.id,
                                                  mx.HostelAllocation.status == "active"):
        r = db.query(mx.Room).filter(mx.Room.id == a.room_id).first()
        out.append({**row(a), "room_no": r.room_no, "floor": r.floor, "hostel_name": r.hostel.name,
                    "hostel_address": r.hostel.address})
    return out


@router.get("/allocations")
def list_allocations(programme_id: Optional[str] = None, db: Session = Depends(get_db),
                     user: models.User = Depends(require_roles(*STAFF))):
    q = db.query(mx.HostelAllocation).filter(mx.HostelAllocation.status == "active")
    if programme_id:
        q = q.filter(mx.HostelAllocation.programme_id == programme_id)
    out = []
    for a in q.order_by(mx.HostelAllocation.check_in_date).limit(500):
        r = db.query(mx.Room).filter(mx.Room.id == a.room_id).first()
        if rv(user) != SUPER and r.hostel.institution_id != user_institution_id(db, user):
            continue
        u = db.query(models.User).filter(models.User.id == a.user_id).first()
        out.append({**row(a), "user_name": u.name if u else "?", "room_no": r.room_no, "hostel_name": r.hostel.name})
    return out


# ---------------- transport / meals / other logistics ----------------
class LogisticsIn(BaseModel):
    programme_id: str
    kind: str = Field("other", pattern=r"^(transport|meal|equipment|other)$")
    title: str = Field(min_length=2, max_length=160)
    item_date: Optional[str] = None
    item_time: Optional[str] = Field(None, pattern=TIME)
    details: Optional[str] = Field(None, max_length=600)
    vendor: Optional[str] = Field(None, max_length=120)
    quantity: Optional[int] = Field(None, ge=0, le=100000)
    cost: Optional[float] = Field(None, ge=0)
    status: str = Field("planned", pattern=r"^(planned|confirmed|done|cancelled)$")


def _lg(body: LogisticsIn) -> dict:
    d = body.model_dump()
    d["item_date"] = parse_date(d["item_date"], "item_date") if d.get("item_date") else None
    return d


@router.get("/items")
def list_items(programme_id: Optional[str] = None, kind: Optional[str] = None, db: Session = Depends(get_db),
               user: models.User = Depends(security.get_current_user)):
    ids = visible_programme_ids(db, user)
    q = db.query(mx.LogisticsItem)
    if ids is not None:
        q = q.filter(mx.LogisticsItem.programme_id.in_(ids or ["-"]))
    if programme_id:
        q = q.filter(mx.LogisticsItem.programme_id == programme_id)
    if kind:
        q = q.filter(mx.LogisticsItem.kind == kind)
    items = q.order_by(mx.LogisticsItem.item_date, mx.LogisticsItem.item_time).limit(500).all()
    hide_cost = rv(user) not in STAFF
    return [row(i, ("cost", "vendor") if hide_cost else ()) for i in items]


@router.post("/items", status_code=201)
def create_item(body: LogisticsIn, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*STAFF))):
    assert_programme_access(db, user, body.programme_id, manage=True)
    i = mx.LogisticsItem(**_lg(body))
    db.add(i)
    db.commit()
    return row(i)


@router.put("/items/{iid}")
def update_item(iid: str, body: LogisticsIn, db: Session = Depends(get_db),
                user: models.User = Depends(require_roles(*STAFF))):
    i = get_or_404(db, mx.LogisticsItem, iid, "Item")
    assert_programme_access(db, user, i.programme_id, manage=True)
    assert_programme_access(db, user, body.programme_id, manage=True)
    for k, v in _lg(body).items():
        setattr(i, k, v)
    db.commit()
    return row(i)


@router.delete("/items/{iid}", status_code=204)
def delete_item(iid: str, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*STAFF))):
    i = get_or_404(db, mx.LogisticsItem, iid, "Item")
    assert_programme_access(db, user, i.programme_id, manage=True)
    db.delete(i)
    db.commit()


# ---------------- programme picker (only programmes the caller may see) ----------------
@router.get("/programmes")
def my_programmes(db: Session = Depends(get_db), user: models.User = Depends(security.get_current_user)):
    ids = visible_programme_ids(db, user)
    q = db.query(models.Programme)
    if ids is not None:
        q = q.filter(models.Programme.id.in_(ids or ["-"]))
    return [{"id": p.id, "name": p.name, "start_date": p.start_date, "end_date": p.end_date, "location": p.location,
             "trainer_name": p.trainer_name} for p in q.order_by(models.Programme.start_date.desc())]
