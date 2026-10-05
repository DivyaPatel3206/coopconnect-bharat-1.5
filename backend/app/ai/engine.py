"""Personalization + recommendation + planning engine. Everything here is computed from real platform data
and every score returns the evidence behind it (explainable, no black box)."""
import json, os, re
from datetime import datetime
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app import models, models_ext as mx
from app.ai import retrieval as R

ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL = os.getenv("CHATBOT_MODEL", "claude-sonnet-5-5")


def llm(system: str, messages: list, max_tokens=700) -> Optional[str]:
    """Returns text, or None when no key / any failure (callers always have a non-LLM fallback)."""
    if not ANTHROPIC_KEY:
        return None
    try:
        r = httpx.post("https://api.anthropic.com/v1/messages", timeout=40,
                       headers={"x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                       json={"model": MODEL, "max_tokens": max_tokens, "system": system, "messages": messages})
        r.raise_for_status()
        t = "".join(b.get("text", "") for b in r.json().get("content", []) if b.get("type") == "text").strip()
        return t or None
    except Exception:
        return None


CATS = {
    "Technical Skills": ["account", "tally", "excel", "audit", "financ", "bank", "computer", "data", "credit", "loan"],
    "Communication": ["communicat", "english", "speak", "counsel", "present", "writing", "marketing", "negotiat"],
    "Digital Literacy": ["digital", "computer", "excel", "online", "smartphone", "internet", "payment"],
    "Cooperative Management": ["cooperative", "manage", "governance", "leader", "dairy", "society", "secretary", "complian", "member"],
}


def state(db: Session, u: models.User) -> dict:
    skills = {s.skill_name.lower(): s.level_percent for s in u.user_skills}
    cert_skills = {c.skill.lower() for c in u.certificates if c.skill}
    enr = []
    for e in u.enrollments:
        c = db.query(models.Course).filter(models.Course.id == e.course_id).first()
        if c:
            enr.append({"course": c, "progress": float(e.progress_percent or 0), "completed": bool(e.completed)})
    attempts = db.query(mx.QuizAttempt, mx.Quiz, models.Lesson).join(mx.Quiz, mx.Quiz.id == mx.QuizAttempt.quiz_id) \
        .join(models.Lesson, models.Lesson.id == mx.Quiz.lesson_id).filter(mx.QuizAttempt.user_id == u.id) \
        .order_by(mx.QuizAttempt.created_at).all()
    last_by_quiz = {}
    for a, q, l in attempts:
        last_by_quiz[q.id] = (a, l)
    weak = [{"lesson_id": l.id, "lesson": l.title, "course_id": l.course_id, "score": a.score_percent}
            for a, l in last_by_quiz.values() if not a.passed or a.score_percent < 60]
    last = db.query(mx.LessonProgress).filter(mx.LessonProgress.user_id == u.id).order_by(mx.LessonProgress.completed_at.desc()).first()
    apps = db.query(models.JobApplication).filter(models.JobApplication.user_id == u.id).all()
    prof = db.query(mx.Profile).filter(mx.Profile.user_id == u.id).first()
    return {"skills": skills, "cert_skills": cert_skills, "enr": enr, "weak": weak, "attempts": [a for a, _, _ in attempts],
            "last_active": last.completed_at if last else None, "apps": apps, "prof": prof,
            "have": set(skills) | cert_skills}


def skill_profile(db: Session, u: models.User, st: dict) -> list:
    out = []
    for cat, keys in CATS.items():
        ev = []
        for n, lv in st["skills"].items():
            if any(k in n for k in keys):
                ev.append((lv, f"Skill: {n} ({lv}%)"))
        for n in st["cert_skills"]:
            if any(k in n for k in keys):
                ev.append((85, f"Certified: {n}"))
        for e in st["enr"]:
            txt = f"{e['course'].skill_tag or ''} {e['course'].title}".lower()
            if any(k in txt for k in keys) and e["progress"] > 0:
                ev.append((e["progress"], f"Course: {e['course'].title} ({int(e['progress'])}%)"))
        for w in st["weak"]:
            if any(k in w["lesson"].lower() for k in keys):
                ev.append((w["score"], f"Quiz needs revision: {w['lesson']} ({w['score']}%)"))
        score = round(sum(v for v, _ in ev) / len(ev)) if ev else None
        out.append({"name": cat, "score": score, "evidence": [t for _, t in ev][:4]})
    return out


def job_analysis(db: Session, u: models.User, st: dict, limit=20) -> list:
    courses = db.query(models.Course).all()
    res = []
    for j in db.query(models.Job).all():
        m = db.query(mx.JobMeta).filter(mx.JobMeta.job_id == j.id).first()
        if m and m.status != "open":
            continue
        req = [s.strip() for s in (j.required_skills or "").split(",") if s.strip()]
        matched = [s for s in req if s.lower() in st["have"]]
        missing = [s for s in req if s.lower() not in st["have"]]
        pct = max(10, round(100 * len(matched) / len(req))) if req else 50
        reasons = [f"Has {s}" for s in matched]
        loc = (u.location or (st["prof"].district if st["prof"] else "") or "").lower()
        if loc and j.location and (loc in j.location.lower() or j.location.lower() in loc):
            reasons.append(f"Location matches ({j.location})")
        fix = None
        if missing:
            tok = set(R.tokens(missing[0]))
            best = max(courses, key=lambda c: len(tok & set(R.tokens(f"{c.title} {c.skill_tag or ''} {c.description or ''}"))), default=None)
            if best and tok & set(R.tokens(f"{best.title} {best.skill_tag or ''} {best.description or ''}")):
                fix = {"course_id": best.id, "title": best.title, "skill": missing[0]}
        res.append({"id": j.id, "title": j.title, "company": j.employer.company_name if j.employer else "", "location": j.location,
                    "job_type": m.job_type if m else "Job", "match": pct, "matched": matched, "missing": missing, "reasons": reasons, "fix": fix})
    res.sort(key=lambda x: -x["match"])
    return res[:limit]


def readiness(db, u, st, jobs, skills) -> dict:
    best = jobs[0]["match"] if jobs else 0
    known = [s["score"] for s in skills if s["score"] is not None]
    skill_avg = round(sum(known) / len(known)) if known else 0
    certs = min(len(u.certificates), 3) / 3 * 100
    prog = round(sum(e["progress"] for e in st["enr"]) / len(st["enr"])) if st["enr"] else 0
    parts = [("Best job match", best, 0.40), ("Skill strength", skill_avg, 0.25), ("Certificates", round(certs), 0.20), ("Learning progress", prog, 0.15)]
    return {"score": round(sum(v * w for _, v, w in parts)), "breakdown": [{"label": n, "value": v, "weight": w} for n, v, w in parts]}


def gap_skills(jobs: list, top=5) -> list:
    cnt = {}
    for j in jobs[:6]:
        for s in j["missing"]:
            cnt[s] = cnt.get(s, 0) + j["match"] + 10
    return [s for s, _ in sorted(cnt.items(), key=lambda x: -x[1])][:top]


def course_recs(db, u, st, gaps, k=4) -> list:
    done = {e["course"].id for e in st["enr"] if e["completed"]}
    enrolled = {e["course"].id: e for e in st["enr"]}
    interest = set(R.tokens(u.career_interests or ""))
    mine = set(st["skills"])
    others = db.query(models.UserSkill).filter(models.UserSkill.user_id != u.id).all()
    peers = {x.user_id for x in others if x.skill_name.lower() in mine}
    out = []
    for c in db.query(models.Course).all():
        if c.id in done:
            continue
        cm = db.query(mx.CourseMeta).filter(mx.CourseMeta.course_id == c.id).first()
        ct = set(R.tokens(f"{c.title} {c.skill_tag or ''} {c.description or ''}"))
        gap_hit = [g for g in gaps if set(R.tokens(g)) & ct]
        int_hit = interest & ct
        co = db.query(models.Enrollment).filter(models.Enrollment.course_id == c.id, models.Enrollment.user_id.in_(peers or {"-"})).count()
        s = 3 * len(gap_hit) + len(int_hit) + min(co, 3) * 0.5 + (1 if c.id in enrolled else 0)
        if s <= 0:
            continue
        why = []
        if gap_hit: why.append(f"closes your {gap_hit[0]} skill gap for jobs you match")
        if int_hit: why.append("fits your career interests")
        if co: why.append(f"{co} learners with a similar skill profile enrolled")
        if c.id in enrolled: why.append(f"you are {int(enrolled[c.id]['progress'])}% through it")
        out.append({"id": c.id, "title": c.title, "level": cm.level if cm else None, "hours": cm.duration_hours if cm else None, "score": s, "why": "Recommended because it " + ", and ".join(why) + "."})
    out.sort(key=lambda x: -x["score"])
    return out[:k]


def scheme_recs(db, u, st, k=3) -> list:
    q = f"{u.career_interests or ''} {u.education or ''} {u.location or ''} cooperative"
    docs = R.build_index(db)
    return [{"title": r["title"], "snippet": r["snippet"], "href": r["href"], "demo": r["demo"],
             "why": "Matched to your interests and profile. Confirm eligibility on the official portal."}
            for r in R.search(docs, q, k=k, kinds={"Scheme"})]


def percentile(db, u, st) -> Optional[int]:
    if not st["enr"]:
        return None
    mine = sum(e["progress"] for e in st["enr"]) / len(st["enr"])
    vals = []
    for uid, in db.query(models.Enrollment.user_id).distinct():
        if uid == u.id:
            continue
        es = db.query(models.Enrollment).filter(models.Enrollment.user_id == uid).all()
        vals.append(sum(e.progress_percent or 0 for e in es) / len(es))
    if len(vals) < 3:
        return None
    return round(100 * sum(1 for v in vals if v < mine) / len(vals))


def next_action(db, u, st, jobs, gaps) -> dict:
    p = st["prof"]
    if st["weak"]:
        w = st["weak"][0]
        return {"label": f"Practise '{w['lesson']}'", "why": f"You scored {w['score']}% on this quiz. A short practice set will help you pass.", "href": "/ai-studio?tab=quiz", "kind": "practice"}
    ip = [e for e in st["enr"] if not e["completed"] and e["progress"] > 0]
    if ip:
        e = max(ip, key=lambda x: x["progress"])
        return {"label": f"Continue '{e['course'].title}'", "why": f"You are {int(e['progress'])}% done. Finishing earns a certificate employers can verify.", "href": f"/learning/{e['course'].id}", "kind": "course"}
    if not st["skills"] or not (u.career_interests or (p and p.bio)):
        return {"label": "Complete your profile", "why": "Skills and interests are what the matching engine uses. Without them, recommendations stay generic.", "href": "/profile", "kind": "profile"}
    if gaps:
        rec = course_recs(db, u, st, gaps, 1)
        if rec:
            return {"label": f"Start '{rec[0]['title']}'", "why": rec[0]["why"], "href": f"/learning/{rec[0]['id']}", "kind": "course"}
    applied = {a.job_id for a in st["apps"]}
    todo = [j for j in jobs if j["id"] not in applied and j["match"] >= 50]
    if todo:
        return {"label": f"Apply: {todo[0]['title']}", "why": f"{todo[0]['match']}% match with your current skills.", "href": "/jobs", "kind": "job"}
    return {"label": "Explore programmes", "why": "Upcoming training can widen your options.", "href": "/programmes", "kind": "programme"}


def study_plan(db, u, course_id: str, days: int) -> dict:
    c = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not c:
        return {}
    lessons = db.query(models.Lesson).filter(models.Lesson.course_id == c.id).order_by(models.Lesson.order_index).all()
    done = {x.lesson_id for x in db.query(mx.LessonProgress).filter(mx.LessonProgress.user_id == u.id)}
    todo = [l for l in lessons if l.id not in done]
    days = max(2, min(days, 90))
    rev_days = set(range(4, days, 4)) if days >= 8 else set()
    final = days
    study_days = [d for d in range(1, days) if d not in rev_days] or [1]
    plan = {d: [] for d in range(1, days + 1)}
    for i, l in enumerate(todo):
        plan[study_days[min(int(i * len(study_days) / max(len(todo), 1)), len(study_days) - 1)]].append(l)
    rows, seen = [], []
    for d in range(1, days + 1):
        if d == final:
            rows.append({"day": d, "type": "Revision", "title": "Final revision and pending quizzes", "items": [l.title for l in seen[-4:]] or ["Review all lessons"]})
        elif d in rev_days:
            rows.append({"day": d, "type": "Revision", "title": "Revise and practise", "items": [l.title for l in seen[-3:]] or ["Review notes"]})
        elif plan[d]:
            seen += plan[d]
            rows.append({"day": d, "type": "Learn", "title": ", ".join(l.title for l in plan[d]), "items": [f"{l.title} ({l.content_type})" for l in plan[d]]})
        else:
            rows.append({"day": d, "type": "Buffer", "title": "Catch-up day", "items": ["Finish anything pending"]})
    return {"course": c.title, "days": days, "lessons_total": len(lessons), "lessons_done": len(lessons) - len(todo), "plan": rows,
            "note": "Built from your current progress. Regenerate any time and the plan adapts."}
