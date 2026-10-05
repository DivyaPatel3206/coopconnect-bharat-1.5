"""Module 4 - Career counselling chatbot (Claude API when configured, rule-based fallback otherwise)."""
import os
from datetime import datetime, timedelta
from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models, security, models_ext as mx
from app.database import get_db
from app.deps import row
from app.routers.jobs import _match_score

router = APIRouter(prefix="/api/chat", tags=["chatbot"])

ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL = os.getenv("CHATBOT_MODEL", "claude-sonnet-5-5")
HOURLY_LIMIT = int(os.getenv("CHAT_HOURLY_LIMIT", "40"))

SYSTEM = """You are Saarthi, the career counsellor inside CoopConnect Bharat, a platform for cooperative-sector \
training in India (VAMNICOM, RICMs, ICMs). Give practical, encouraging, concise guidance on careers, skills to \
build, jobs, internships, entrepreneurship (cooperatives, SHGs, FPOs, dairy, agri, credit societies) and training. \
Personalise using the LEARNER CONTEXT. When you mention jobs, programmes or courses on the platform, use ONLY the ones \
listed in the context - never invent openings, salaries or deadlines. For anything outside the context, say it is \
general guidance and suggest verifying. Keep answers under 220 words, use short bullet lists, and end with one \
concrete next step. Reply in the language the learner writes in."""


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


def build_context(db: Session, u: models.User) -> dict:
    p = db.query(mx.Profile).filter(mx.Profile.user_id == u.id).first()
    skills = [f"{s.skill_name} ({s.level_percent}%)" for s in u.user_skills]
    certs = [f"{c.programme_name}" + (f" [{c.skill}]" if c.skill else "") for c in u.certificates]
    training = [f"{t.title} ({t.status})" for t in db.query(mx.TrainingHistory).filter(mx.TrainingHistory.user_id == u.id)]
    enrol = []
    for e in u.enrollments:
        c = db.query(models.Course).filter(models.Course.id == e.course_id).first()
        if c:
            enrol.append(f"{c.title} - {int(e.progress_percent)}%")
    jobs = []
    for j in db.query(models.Job).all():
        meta = db.query(mx.JobMeta).filter(mx.JobMeta.job_id == j.id).first()
        if meta and meta.status != "open":
            continue
        jobs.append({"title": j.title, "company": j.employer.company_name if j.employer else "",
                     "type": meta.job_type if meta else "Job", "skills": j.required_skills or "",
                     "location": j.location or "", "match": _match_score(u, j, db)})
    jobs.sort(key=lambda x: -x["match"])
    now = datetime.utcnow()
    progs = [f"{x.name} ({x.category}, {x.mode}, starts {x.start_date.date() if x.start_date else 'TBA'})"
             for x in db.query(models.Programme).filter(models.Programme.end_date >= now).limit(8)]
    courses = [f"{c.title} [{c.skill_tag}]" for c in db.query(models.Course).limit(12)]
    return {"name": u.name, "location": u.location or (p.district if p else None), "education": u.education,
            "interests": u.career_interests, "skills": skills, "certificates": certs, "training": training,
            "courses_in_progress": enrol, "jobs": jobs[:6], "programmes": progs, "courses_available": courses}


def _ctx_text(c: dict) -> str:
    jobs = "; ".join(f"{j['title']} at {j['company']} ({j['type']}, needs {j['skills']}, {j['match']}% match)" for j in c["jobs"])
    return (f"Name: {c['name']}\nLocation: {c['location']}\nEducation: {c['education']}\nInterests: {c['interests']}\n"
            f"Skills: {', '.join(c['skills']) or 'none recorded'}\nCertificates: {', '.join(c['certificates']) or 'none'}\n"
            f"Training history: {', '.join(c['training']) or 'none'}\nCourses in progress: {', '.join(c['courses_in_progress']) or 'none'}\n"
            f"Open jobs/internships on platform: {jobs or 'none'}\nUpcoming programmes: {'; '.join(c['programmes']) or 'none'}\n"
            f"Courses available: {'; '.join(c['courses_available']) or 'none'}")


def _skill_gaps(c: dict) -> List[str]:
    have = {s.split(" (")[0].lower() for s in c["skills"]} | {x.split("[")[-1].strip("]").lower() for x in c["certificates"] if "[" in x}
    gaps = []
    for j in c["jobs"][:4]:
        for s in [x.strip() for x in j["skills"].split(",") if x.strip()]:
            if s.lower() not in have and s not in gaps:
                gaps.append(s)
    return gaps[:5]


def fallback_reply(msg: str, c: dict) -> str:
    m = msg.lower()
    first = (c["name"] or "there").split()[0]
    gaps = _skill_gaps(c)
    if any(k in m for k in ("intern",)):
        pool = [j for j in c["jobs"] if "intern" in j["type"].lower() or "apprentice" in j["type"].lower()] or c["jobs"]
        body = "Internship/entry options on the platform:\n" + "\n".join(f"- {j['title']} at {j['company']} ({j['match']}% match)" for j in pool[:3]) if pool else \
            "No internships are listed right now. Check the Jobs page again soon."
        return f"{first}, here is what I can see.\n{body}\nNext step: apply to the best match and finish one course that covers: {', '.join(gaps[:2]) or 'your top skill'}."
    if any(k in m for k in ("job", "career", "work", "opening", "hire", "employ")):
        body = "\n".join(f"- {j['title']} at {j['company']}, {j['location']} ({j['match']}% match)" for j in c["jobs"][:4]) or "- No open roles are listed right now."
        g = f"\nSkills that would raise your match: {', '.join(gaps)}." if gaps else ""
        return f"Best-matched openings for your profile, {first}:\n{body}{g}\nNext step: open the Jobs page and apply to the top match."
    if any(k in m for k in ("business", "entrepreneur", "startup", "own", "self employ", "shg", "fpo")):
        return (f"{first}, cooperative-style ventures suit people with your background ({c['education'] or 'your education'}). Ideas:\n"
                "- Start or join a producer group (dairy, agri-processing, handicrafts)\n- Offer digital record-keeping and payments help to local societies\n"
                "- Form a small women-led SHG-to-cooperative enterprise\n"
                f"Skills to build first: {', '.join(gaps) or 'Cooperative Management, Communication'}.\n"
                "Next step: enrol in an entrepreneurship programme listed under Programmes and draft a one-page business idea.")
    if any(k in m for k in ("skill", "learn", "course", "improve", "certificate")):
        rec = [x for x in c["courses_available"] if any(g.lower() in x.lower() for g in gaps)] or c["courses_available"][:3]
        return (f"Skill plan for you, {first}:\n- Gaps for roles you match: {', '.join(gaps) or 'you cover the listed roles well'}\n"
                + "\n".join(f"- Course: {x}" for x in rec[:3]) + "\nNext step: start the first course this week; a certificate is issued at 100%.")
    if any(k in m for k in ("train", "programme", "program", "workshop")):
        body = "\n".join(f"- {p}" for p in c["programmes"][:4]) or "- No upcoming programmes are listed."
        return f"Upcoming training you can join:\n{body}\nNext step: register from the Programmes page."
    return (f"Hi {first}! I can help with jobs, internships, skills to learn, training programmes and starting your own venture. "
            f"Right now your strongest match is {c['jobs'][0]['title'] if c['jobs'] else 'not available yet'}. "
            "What would you like to explore?")


def call_claude(history: List[dict], ctx: dict) -> str:
    r = httpx.post("https://api.anthropic.com/v1/messages", timeout=30,
                   headers={"x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                   json={"model": MODEL, "max_tokens": 600,
                         "system": SYSTEM + "\n\nLEARNER CONTEXT:\n" + _ctx_text(ctx), "messages": history})
    r.raise_for_status()
    parts = [b.get("text", "") for b in r.json().get("content", []) if b.get("type") == "text"]
    text = "".join(parts).strip()
    if not text:
        raise ValueError("empty reply")
    return text


@router.post("")
def chat(body: ChatIn, db: Session = Depends(get_db), user: models.User = Depends(security.get_current_user)):
    since = datetime.utcnow() - timedelta(hours=1)
    used = db.query(mx.ChatMessage).filter(mx.ChatMessage.user_id == user.id, mx.ChatMessage.role == "user",
                                           mx.ChatMessage.created_at >= since).count()
    if used >= HOURLY_LIMIT:
        raise HTTPException(status_code=429, detail="Message limit reached for this hour. Please try again later.")
    prior = db.query(mx.ChatMessage).filter(mx.ChatMessage.user_id == user.id) \
        .order_by(mx.ChatMessage.created_at.desc()).limit(10).all()[::-1]
    history = [{"role": m.role, "content": m.content} for m in prior]
    while history and history[0]["role"] != "user":
        history.pop(0)
    history.append({"role": "user", "content": body.message})
    ctx = build_context(db, user)
    source = "rules"
    try:
        if not ANTHROPIC_KEY:
            raise RuntimeError("no key")
        reply = call_claude(history, ctx)
        source = "ai"
    except Exception:
        reply = fallback_reply(body.message, ctx)
    db.add(mx.ChatMessage(user_id=user.id, role="user", content=body.message))
    db.flush()
    db.add(mx.ChatMessage(user_id=user.id, role="assistant", content=reply, created_at=datetime.utcnow() + timedelta(milliseconds=5)))
    db.commit()
    return {"reply": reply, "source": source}


@router.get("/history")
def history(db: Session = Depends(get_db), user: models.User = Depends(security.get_current_user)):
    msgs = db.query(mx.ChatMessage).filter(mx.ChatMessage.user_id == user.id) \
        .order_by(mx.ChatMessage.created_at.desc()).limit(60).all()[::-1]
    return [row(m, ("user_id",)) for m in msgs]


@router.delete("/history", status_code=204)
def clear_history(db: Session = Depends(get_db), user: models.User = Depends(security.get_current_user)):
    db.query(mx.ChatMessage).filter(mx.ChatMessage.user_id == user.id).delete()
    db.commit()
