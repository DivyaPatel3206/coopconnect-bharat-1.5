"""Admin intelligence: aggregate analytics + explainable predictions. Predictions are estimates, not facts."""
from collections import Counter, defaultdict
from datetime import datetime
from sqlalchemy.orm import Session
from app import models, models_ext as mx


def _district(db, uid, cache={}):
    p = db.query(mx.Profile).filter(mx.Profile.user_id == uid).first()
    u = db.query(models.User).filter(models.User.id == uid).first()
    return (p.district if p and p.district else (u.location if u and u.location else "Unknown")) or "Unknown"


def completion_by_district(db: Session) -> dict:
    agg = defaultdict(lambda: [0, 0])
    for e in db.query(models.Enrollment).all():
        d = _district(db, e.user_id)
        agg[d][0] += 1
        agg[d][1] += 1 if e.completed else 0
    tot = sum(v[0] for v in agg.values()) or 1
    avg = round(100 * sum(v[1] for v in agg.values()) / tot)
    rows = sorted([{"label": k, "value": round(100 * c / n), "enrolled": n} for k, (n, c) in agg.items()], key=lambda x: x["value"])
    return {"avg": avg, "rows": rows}


def dropout_risk(db: Session, limit=12) -> list:
    now, out = datetime.utcnow(), []
    for e in db.query(models.Enrollment).filter(models.Enrollment.completed == False).all():  # noqa
        u = db.query(models.User).filter(models.User.id == e.user_id).first()
        c = db.query(models.Course).filter(models.Course.id == e.course_id).first()
        if not u or not c:
            continue
        last = db.query(mx.LessonProgress).filter(mx.LessonProgress.user_id == u.id).order_by(mx.LessonProgress.completed_at.desc()).first()
        idle = (now - last.completed_at).days if last else None
        fails = db.query(mx.QuizAttempt).filter(mx.QuizAttempt.user_id == u.id, mx.QuizAttempt.passed == False).count()  # noqa
        prog = e.progress_percent or 0
        risk = 0.40 * (min(idle, 30) / 30 if idle is not None else 0.8) + 0.35 * (1 - prog / 100) + 0.25 * min(fails, 3) / 3
        if risk < 0.4:
            continue
        why = []
        if idle is None: why.append("no learning activity recorded")
        elif idle >= 7: why.append(f"inactive for {idle} days")
        if prog < 25: why.append(f"only {int(prog)}% progress")
        if fails: why.append(f"{fails} failed assessment(s)")
        out.append({"learner": u.name, "learner_id": u.id, "course": c.title, "risk": round(risk, 2), "level": "High" if risk >= 0.65 else "Medium", "reasons": why})
    return sorted(out, key=lambda x: -x["risk"])[:limit]


def skill_demand_supply(db: Session) -> list:
    dem, sup = defaultdict(int), defaultdict(int)
    for j in db.query(models.Job).all():
        for s in (j.required_skills or "").split(","):
            if s.strip(): dem[s.strip().lower()] += 1
    for s in db.query(models.UserSkill).all():
        sup[s.skill_name.lower()] += 1
    rows = [{"label": k.title(), "demand": v, "supply": sup.get(k, 0), "gap": v - sup.get(k, 0)} for k, v in dem.items()]
    return sorted(rows, key=lambda x: -x["gap"])[:8]


def employment_funnel(db: Session) -> dict:
    a = db.query(models.JobApplication).all()
    return {"applied": len(a), "shortlisted": sum(1 for x in a if x.status == "shortlisted"), "rejected": sum(1 for x in a if x.status == "rejected")}


def ask(db: Session, q: str) -> dict:
    t = q.lower()
    if any(w in t for w in ("dropout", "risk", "inactive", "early warning", "at risk")):
        r = dropout_risk(db)
        high = sum(1 for x in r if x["level"] == "High")
        return {"topic": "Dropout risk", "insight": f"{len(r)} learners show elevated dropout risk ({high} high). Main drivers: " + (", ".join(k for k, _ in Counter(("inactivity" if ("inactive" in w or "no learning" in w) else "low progress" if "progress" in w else "failed assessments") for x in r for w in x["reasons"]).most_common(3)) or "none") + ".",
                "action": "Send a personalised nudge to the high-risk group and offer a short catch-up session.", "table": r[:6], "predicted": True}
    if any(w in t for w in ("skill", "demand", "gap", "supply")):
        r = skill_demand_supply(db)
        top = r[0] if r else None
        return {"topic": "Skill demand vs supply", "insight": (f"'{top['label']}' has the largest gap: {top['demand']} job(s) ask for it, {top['supply']} learner(s) hold it." if top else "No job data yet."),
                "action": f"Schedule a beginner programme on {top['label']}." if top else "Post jobs to start collecting demand data.", "chart": {"items": [{"label": x["label"], "value": x["gap"]} for x in r], "unit": "gap (jobs minus learners)"}, "predicted": False}
    if any(w in t for w in ("job", "employ", "placement", "hire", "application")):
        f = employment_funnel(db)
        rate = round(100 * f["shortlisted"] / f["applied"]) if f["applied"] else 0
        return {"topic": "Employment funnel", "insight": f"{f['applied']} applications so far; {rate}% shortlisted.", "action": "Run a resume-clinic session for learners with low match scores.",
                "chart": {"items": [{"label": k.title(), "value": v} for k, v in f.items()], "unit": "applications"}, "predicted": False}
    c = completion_by_district(db)
    rows = c["rows"]
    low = rows[0] if rows else None
    if low and all(r["value"] == c["avg"] for r in rows):
        return {"topic": "Training completion by district", "insight": f"Completion is {c['avg']}% in every district so far, so no district stands out yet.",
                "action": "Collect more enrolment data, then re-check.", "chart": {"items": rows, "unit": "% completed"}, "predicted": False}
    diff = (c["avg"] - low["value"]) if low else 0
    return {"topic": "Training completion by district", "insight": (f"{low['label']} has the lowest completion at {low['value']}%, {diff} points below the platform average of {c['avg']}%." if low else "No enrolment data yet."),
            "action": "Add a beginner-level digital literacy programme and a trainer follow-up in the lowest districts." if low else "Enrol learners to see trends.",
            "chart": {"items": rows, "unit": "% completed"}, "predicted": False}
