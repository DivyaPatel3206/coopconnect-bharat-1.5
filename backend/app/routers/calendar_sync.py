"""Google Calendar sync, .ics export, and e-mail test/reminder controls for the timetable."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app import models, security, models_ext as mx, notify
from app.database import get_db
from app.deps import require_roles, assert_programme_access, visible_programme_ids, STAFF, ADMINS

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@router.get("/status")
def calendar_status(user: models.User = Depends(security.get_current_user)):
    return notify.status() | {"reminders": notify.smtp_configured()}


@router.get("/ics")
def my_ics(programme_id: Optional[str] = None, db: Session = Depends(get_db),
           user: models.User = Depends(security.get_current_user)):
    ids = visible_programme_ids(db, user)
    q = db.query(mx.TimetableEntry)
    if ids is not None:
        q = q.filter(mx.TimetableEntry.programme_id.in_(ids or ["-"]))
    if programme_id:
        q = q.filter(mx.TimetableEntry.programme_id == programme_id)
    items = [notify.snapshot(db, e) for e in q.order_by(mx.TimetableEntry.session_date).limit(500)]
    return Response(notify.make_ics(items), media_type="text/calendar",
                    headers={"Content-Disposition": 'attachment; filename="coopconnect-timetable.ics"'})


@router.post("/sync/{programme_id}")
def sync_programme(programme_id: str, db: Session = Depends(get_db), user: models.User = Depends(require_roles(*STAFF))):
    assert_programme_access(db, user, programme_id, manage=True)
    if not notify.google_configured():
        raise HTTPException(status_code=400, detail="Google Calendar is not configured on the server (set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_CALENDAR_ID).")
    ok, failed, last = 0, 0, ""
    for e in db.query(mx.TimetableEntry).filter(mx.TimetableEntry.programme_id == programme_id):
        try:
            notify.google_upsert(db, notify.snapshot(db, e))
            ok += 1
        except Exception as ex:
            failed += 1
            last = str(ex)[:160]
    if failed and not ok:
        raise HTTPException(status_code=502, detail=f"Google rejected the requests: {last}. Check that the calendar is shared with the service account (Make changes to events).")
    return {"synced": ok, "failed": failed}


@router.post("/test-email")
def test_email(db: Session = Depends(get_db), user: models.User = Depends(require_roles(*ADMINS))):
    if not notify.smtp_configured():
        raise HTTPException(status_code=400, detail="E-mail is not configured (set SMTP_HOST, SMTP_USER, SMTP_PASSWORD).")
    try:
        notify.send_email([user.email], "CoopConnect Bharat: test e-mail", "E-mail notifications are working.")
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"Could not send: {str(ex)[:160]}")
    return {"sent_to": user.email}


@router.post("/reminders/run")
def run_reminders(user: models.User = Depends(require_roles(*ADMINS))):
    if not notify.smtp_configured():
        raise HTTPException(status_code=400, detail="E-mail is not configured.")
    return {"sent": notify.send_due_reminders(force=True)}
