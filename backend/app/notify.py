"""Google Calendar sync + e-mail notifications for the timetable.

Everything is optional and configured by environment variables:
  GOOGLE_SERVICE_ACCOUNT_JSON  service-account key (JSON text, base64 JSON, or a file path)
  GOOGLE_CALENDAR_ID           id of the calendar that is shared with that service account
  SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASSWORD, SMTP_FROM (defaults to SMTP_USER)
When a setting is missing the feature is skipped quietly; the timetable keeps working.
"""
import base64
import json
import logging
import os
import smtplib
import threading
import time
from datetime import datetime, timedelta, timezone, date
from email.message import EmailMessage
from typing import Dict, List, Optional
from urllib.parse import quote

import httpx
from jose import jwt

from app import models, models_ext as mx
from app.database import SessionLocal

log = logging.getLogger("coopconnect.notify")
IST = timezone(timedelta(hours=5, minutes=30))
TZ_NAME = "Asia/Kolkata"
APP_NAME = "CoopConnect Bharat"


# ---------------- configuration ----------------
def smtp_configured() -> bool:
    return all(os.getenv(k) for k in ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"))


def _sa_info() -> Optional[dict]:
    raw = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        return None
    try:
        if raw.startswith("{"):
            return json.loads(raw)
        if os.path.exists(raw):
            with open(raw) as f:
                return json.load(f)
        return json.loads(base64.b64decode(raw).decode())
    except Exception:
        log.warning("GOOGLE_SERVICE_ACCOUNT_JSON could not be read")
        return None


def google_configured() -> bool:
    info = _sa_info()
    return bool(info and info.get("client_email") and info.get("private_key") and os.getenv("GOOGLE_CALENDAR_ID"))


def status() -> dict:
    info = _sa_info() or {}
    return {"google_configured": google_configured(), "service_account_email": info.get("client_email"),
            "calendar_id": os.getenv("GOOGLE_CALENDAR_ID"), "email_configured": smtp_configured(),
            "email_from": os.getenv("SMTP_FROM") or os.getenv("SMTP_USER")}


# ---------------- Google Calendar (REST, service account) ----------------
_tok = {"v": None, "exp": 0.0}


def _g_token() -> str:
    if _tok["v"] and _tok["exp"] > time.time() + 60:
        return _tok["v"]
    info = _sa_info()
    now = int(time.time())
    assertion = jwt.encode({"iss": info["client_email"], "scope": "https://www.googleapis.com/auth/calendar",
                            "aud": "https://oauth2.googleapis.com/token", "iat": now, "exp": now + 3600},
                           info["private_key"], algorithm="RS256")
    r = httpx.post("https://oauth2.googleapis.com/token", timeout=20,
                   data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion})
    r.raise_for_status()
    j = r.json()
    _tok["v"], _tok["exp"] = j["access_token"], time.time() + int(j.get("expires_in", 3600))
    return _tok["v"]


def _cal_url() -> str:
    return f"https://www.googleapis.com/calendar/v3/calendars/{quote(os.getenv('GOOGLE_CALENDAR_ID', ''), safe='')}/events"


def _event_body(s: dict) -> dict:
    return {
        "summary": f"{s['title']} ({s['programme']})",
        "location": s.get("venue") or s.get("location") or "",
        "description": "\n".join(x for x in [s.get("topic"), f"Trainer: {s['trainer']}" if s.get("trainer") else None,
                                              s.get("notes"), f"Programme: {s['programme']}"] if x),
        "start": {"dateTime": f"{s['date']}T{s['start']}:00", "timeZone": TZ_NAME},
        "end": {"dateTime": f"{s['date']}T{s['end']}:00", "timeZone": TZ_NAME},
        "reminders": {"useDefault": False, "overrides": [{"method": "popup", "minutes": 30}, {"method": "email", "minutes": 1440}]},
    }


def google_upsert(db, s: dict) -> str:
    h = {"Authorization": f"Bearer {_g_token()}"}
    link = db.query(mx.CalendarLink).filter(mx.CalendarLink.entry_id == s["id"]).first()
    body = _event_body(s)
    if link:
        r = httpx.put(f"{_cal_url()}/{link.google_event_id}", json=body, headers=h, timeout=20)
        if r.status_code in (404, 410):
            db.delete(link)
            db.commit()
            link = None
        else:
            r.raise_for_status()
            link.synced_at = datetime.utcnow()
            db.commit()
            return link.google_event_id
    r = httpx.post(_cal_url(), json=body, headers=h, timeout=20)
    r.raise_for_status()
    eid = r.json()["id"]
    db.add(mx.CalendarLink(entry_id=s["id"], google_event_id=eid))
    db.commit()
    return eid


def google_delete(db, entry_id: str):
    link = db.query(mx.CalendarLink).filter(mx.CalendarLink.entry_id == entry_id).first()
    if not link:
        return
    r = httpx.delete(f"{_cal_url()}/{link.google_event_id}", headers={"Authorization": f"Bearer {_g_token()}"}, timeout=20)
    if r.status_code not in (200, 204, 404, 410):
        r.raise_for_status()
    db.delete(link)
    db.commit()


# ---------------- iCalendar ----------------
def _esc(t: str) -> str:
    return (t or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _utc(d: str, hhmm: str) -> str:
    local = datetime.fromisoformat(f"{d}T{hhmm}:00").replace(tzinfo=IST)
    return local.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def make_ics(items: List[dict], method: str = "PUBLISH") -> str:
    now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = ["BEGIN:VCALENDAR", "VERSION:2.0", f"PRODID:-//{APP_NAME}//Timetable//EN", "CALSCALE:GREGORIAN", f"METHOD:{method}"]
    for s in items:
        out += ["BEGIN:VEVENT", f"UID:{s['id']}@coopconnect-bharat", f"DTSTAMP:{now}", f"SEQUENCE:{int(time.time())}",
                f"DTSTART:{_utc(s['date'], s['start'])}", f"DTEND:{_utc(s['date'], s['end'])}",
                f"SUMMARY:{_esc(s['title'] + ' (' + s['programme'] + ')')}",
                f"LOCATION:{_esc(s.get('venue') or s.get('location') or '')}",
                f"DESCRIPTION:{_esc(' | '.join(x for x in [s.get('topic'), 'Trainer: ' + s['trainer'] if s.get('trainer') else None, s.get('notes')] if x))}",
                "STATUS:CANCELLED" if method == "CANCEL" else "STATUS:CONFIRMED",
                "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:Session starts soon", "END:VALARM", "END:VEVENT"]
    out.append("END:VCALENDAR")
    return "\r\n".join(out) + "\r\n"


# ---------------- e-mail ----------------
def send_email(recipients: List[str], subject: str, text: str, ics: Optional[str] = None, method: str = "PUBLISH") -> int:
    recipients = sorted({r for r in recipients if r})
    if not recipients or not smtp_configured():
        return 0
    sender = os.getenv("SMTP_FROM") or os.getenv("SMTP_USER")
    msg = EmailMessage()
    msg["Subject"], msg["From"], msg["To"] = subject, f"{APP_NAME} <{sender}>", f"{APP_NAME} <{sender}>"  # real recipients go in Bcc (private)
    msg.set_content(text)
    if ics:
        msg.add_attachment(ics.encode(), maintype="text", subtype="calendar", filename="timetable.ics",
                           params={"method": method, "charset": "utf-8"})
    host, port = os.getenv("SMTP_HOST"), int(os.getenv("SMTP_PORT", "587"))
    cls = smtplib.SMTP_SSL if port == 465 else smtplib.SMTP
    with cls(host, port, timeout=30) as smtp:
        if port != 465:
            smtp.starttls()
        smtp.login(os.getenv("SMTP_USER"), os.getenv("SMTP_PASSWORD"))
        smtp.send_message(msg, to_addrs=recipients)
    return len(recipients)


# ---------------- snapshots & recipients ----------------
def snapshot(db, e: mx.TimetableEntry) -> dict:
    prog = db.query(models.Programme).filter(models.Programme.id == e.programme_id).first()
    venue = db.query(mx.Venue).filter(mx.Venue.id == e.venue_id).first() if e.venue_id else None
    emails = {u.email for u in db.query(models.User).join(models.Registration, models.Registration.user_id == models.User.id)
              .filter(models.Registration.programme_id == e.programme_id,
                      models.Registration.status.in_([models.RegistrationStatus.approved, models.RegistrationStatus.completed]))}
    if e.trainer_name:
        emails |= {u.email for u in db.query(models.User).filter(models.User.role == models.RoleEnum.trainer, models.User.name.ilike(e.trainer_name))}
    return {"id": e.id, "programme_id": e.programme_id, "programme": prog.name if prog else "Programme",
            "location": prog.location if prog else None, "title": e.title, "topic": e.topic, "notes": e.notes,
            "date": str(e.session_date), "start": e.start_time, "end": e.end_time, "trainer": e.trainer_name,
            "venue": venue.name if venue else None, "recipients": sorted(emails)}


def _fmt(s: dict) -> str:
    d = datetime.fromisoformat(s["date"]).strftime("%A, %d %B %Y")
    return f"{s['title']}\n  {d}, {s['start']}-{s['end']} IST\n  Venue: {s.get('venue') or s.get('location') or 'To be announced'}" + \
           (f"\n  Trainer: {s['trainer']}" if s.get("trainer") else "")


def _log(db, entry_id, kind, n, status_, detail=""):
    db.add(mx.NotificationLog(entry_id=entry_id, kind=kind, recipients=n, status=status_, detail=(detail or "")[:250]))
    db.commit()


def run_event(action: str, snap: dict, notify: bool = True):
    """Runs in a background task: sync Google Calendar, then e-mail participants. Never raises."""
    db = SessionLocal()
    try:
        if google_configured():
            try:
                google_delete(db, snap["id"]) if action == "cancelled" else google_upsert(db, snap)
            except Exception as ex:
                log.warning("Google Calendar sync failed: %s", ex)
                _log(db, snap["id"], action, 0, "failed", f"google: {ex}")
        if notify and smtp_configured() and snap["recipients"]:
            verb = {"created": "New session scheduled", "updated": "Session updated", "cancelled": "Session cancelled"}[action]
            try:
                n = send_email(snap["recipients"], f"{verb}: {snap['title']} ({snap['programme']})",
                               f"{verb}.\n\n{_fmt(snap)}\n\nProgramme: {snap['programme']}\n\nOpen the attached file to add or update this in your calendar.\n\n— {APP_NAME}",
                               make_ics([snap], "CANCEL" if action == "cancelled" else "REQUEST"), "CANCEL" if action == "cancelled" else "REQUEST")
                _log(db, snap["id"], action, n, "sent")
            except Exception as ex:
                log.warning("E-mail failed: %s", ex)
                _log(db, snap["id"], action, 0, "failed", f"smtp: {ex}")
    finally:
        db.close()


# ---------------- reminders ----------------
def send_due_reminders(force: bool = False) -> int:
    """E-mail a digest of tomorrow's sessions, once per session. Runs in the evening (IST) unless forced."""
    if not smtp_configured():
        return 0
    now = datetime.now(IST)
    if not force and not (16 <= now.hour <= 22):
        return 0
    tomorrow = (now + timedelta(days=1)).date()
    db = SessionLocal()
    sent = 0
    try:
        done = {r.entry_id for r in db.query(mx.NotificationLog).filter(mx.NotificationLog.kind == "reminder", mx.NotificationLog.status == "sent")}
        by_prog: Dict[str, List[mx.TimetableEntry]] = {}
        for e in db.query(mx.TimetableEntry).filter(mx.TimetableEntry.session_date == tomorrow).order_by(mx.TimetableEntry.start_time):
            if force or e.id not in done:
                by_prog.setdefault(e.programme_id, []).append(e)
        for entries in by_prog.values():
            snaps = [snapshot(db, e) for e in entries]
            people = sorted({r for s in snaps for r in s["recipients"]})
            if not people:
                continue
            try:
                n = send_email(people, f"Reminder: {len(snaps)} session(s) tomorrow - {snaps[0]['programme']}",
                               "Your schedule for tomorrow:\n\n" + "\n\n".join(_fmt(s) for s in snaps) + f"\n\n— {APP_NAME}",
                               make_ics(snaps, "PUBLISH"))
                for s in snaps:
                    _log(db, s["id"], "reminder", n, "sent")
                sent += n
            except Exception as ex:
                log.warning("Reminder failed: %s", ex)
                _log(db, snaps[0]["id"], "reminder", 0, "failed", str(ex))
    finally:
        db.close()
    return sent


_started = False


def start_reminder_loop():
    global _started
    if _started or os.getenv("REMINDERS", "1") == "0":
        return
    _started = True

    def loop():
        while True:
            try:
                send_due_reminders()
            except Exception:
                log.exception("reminder loop error")
            time.sleep(1800)

    threading.Thread(target=loop, daemon=True, name="coop-reminders").start()
