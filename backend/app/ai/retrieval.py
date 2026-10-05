"""Retrieval layer. Default backend: TF-IDF + synonym expansion + title-aware reranking (zero extra dependencies).
Swap `embed_backend` for sentence-transformers / a vector DB later; the rest of the pipeline stays the same."""
import math, os, re, glob
from collections import Counter
from dataclasses import dataclass, field
from typing import List

from sqlalchemy.orm import Session
from app import models, models_ext as mx

KB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "knowledge")
STOP = set("a an the and or of to in on for is are be am i me my we you your it its this that with from as at by can how what which do does should would could will about want need get".split())
SYN = {"bank": ["banking", "credit", "finance"], "banking": ["bank", "credit"], "job": ["jobs", "employment", "career", "vacancy", "opening", "work"],
       "jobs": ["job", "employment", "career"], "course": ["courses", "training", "learn", "lesson"], "learn": ["course", "training", "study"],
       "scheme": ["schemes", "programme", "subsidy", "support", "yojana"], "accounting": ["accounts", "accountant", "bookkeeping", "finance"],
       "accountant": ["accounting", "accounts"], "excel": ["spreadsheet", "digital"], "digital": ["computer", "smartphone", "online"],
       "dairy": ["milk", "amul"], "farm": ["agriculture", "agri", "farmer"], "farmer": ["agriculture", "agri"], "entrepreneur": ["startup", "business", "venture"],
       "entrepreneurship": ["entrepreneur", "business", "startup"], "certificate": ["certification", "certified"], "eligibility": ["eligible", "criteria", "qualify"],
       "rural": ["village", "agriculture"], "intern": ["internship", "apprentice", "trainee"], "internship": ["intern", "apprentice"]}


def stem(w: str) -> str:
    for suf in ("ing", "ies", "ed", "es", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            return w[: -len(suf)] + ("y" if suf == "ies" else "")
    return w


def tokens(text: str, expand=False) -> List[str]:
    base = [w for w in re.findall(r"[a-z0-9]+", (text or "").lower()) if w not in STOP and len(w) > 1]
    if expand:
        extra = [s for w in base for s in SYN.get(w, [])]
        base = base + extra
    return [stem(w) for w in base]


@dataclass
class Doc:
    id: str
    title: str
    kind: str          # Policy | Scheme | Handbook | Guideline | Course | Job | Programme
    text: str
    href: str = ""
    meta: dict = field(default_factory=dict)
    tf: Counter = field(default_factory=Counter)
    tt: set = field(default_factory=set)


_static: List[Doc] = []


def _load_static():
    global _static
    if _static:
        return _static
    docs = []
    for i, path in enumerate(sorted(glob.glob(os.path.join(KB_DIR, "*.md")) + glob.glob(os.path.join(KB_DIR, "*.txt")))):
        if os.path.basename(path).lower().startswith("readme"):
            continue
        lines = open(path, encoding="utf-8").read().splitlines()
        title, kind, body = lines[0].strip() if lines else path, "Guideline", lines[1:]
        if body and body[0].lower().startswith("kind:"):
            kind = body[0].split(":", 1)[1].strip() or kind
            body = body[1:]
        text = "\n".join(body).strip()
        # split into passages so citations point at a specific section
        paras = [p.strip() for p in re.split(r"\n\s*\n|\n(?=[A-Z][^.\n]{3,60}:)", text) if len(p.strip()) > 40] or [text]
        for j, p in enumerate(paras):
            docs.append(Doc(id=f"kb{i}-{j}", title=re.sub(r"\s*\(.*?\)\s*$", "", title), kind=kind, text=p, href="/resources",
                            meta={"file": os.path.basename(path), "demo": "demo content" in title.lower()}))
    _static = docs
    return docs


def build_index(db: Session) -> List[Doc]:
    docs = list(_load_static())
    for c in db.query(models.Course).all():
        cm = db.query(mx.CourseMeta).filter(mx.CourseMeta.course_id == c.id).first()
        docs.append(Doc(f"course:{c.id}", c.title, "Course", f"{c.title}. {c.description or ''} Skill: {c.skill_tag or ''}. {cm.category if cm else ''} {cm.level if cm else ''}",
                        "/courses", {"id": c.id, "skill": c.skill_tag}))
    for j in db.query(models.Job).all():
        m = db.query(mx.JobMeta).filter(mx.JobMeta.job_id == j.id).first()
        if m and m.status != "open":
            continue
        docs.append(Doc(f"job:{j.id}", j.title, "Job", f"{j.title}. {j.description or ''} Skills: {j.required_skills or ''}. {j.location or ''} {m.job_type if m else ''}",
                        "/jobs", {"id": j.id}))
    for p in db.query(models.Programme).all():
        docs.append(Doc(f"prog:{p.id}", p.name, "Programme", f"{p.name}. {p.description or ''} {p.category or ''} {p.mode or ''} {p.location or ''}", "/programmes", {"id": p.id}))
    for d in docs:
        d.tf = Counter(tokens(d.title + " " + d.text))
        d.tt = set(tokens(d.title))
    return docs


def search(docs: List[Doc], query: str, k=5, kinds=None) -> List[dict]:
    q = tokens(query, expand=True)
    if not q:
        return []
    pool = [d for d in docs if not kinds or d.kind in kinds]
    n = len(pool) or 1
    df = Counter()
    for d in pool:
        for t in set(d.tf):
            df[t] += 1
    idf = {t: math.log(1 + n / (1 + df[t])) for t in set(q)}
    qtf = Counter(q)
    out = []
    for d in pool:
        length = sum(d.tf.values()) or 1
        s = sum(idf[t] * qtf[t] * (d.tf[t] / length) ** 0.5 for t in qtf if t in d.tf)
        if s <= 0:
            continue
        s *= 1 + 0.6 * len(d.tt & set(q))  # rerank: title matches count more
        out.append((s, d))
    out.sort(key=lambda x: -x[0])
    top = out[0][0] if out else 1
    res = []
    for s, d in out[:k]:
        res.append({"id": d.id, "title": d.title, "kind": d.kind, "href": d.href, "snippet": d.text[:420], "text": d.text,
                    "score": round(s / top, 3), "raw": round(s, 3), "demo": d.meta.get("demo", False), "meta": d.meta})
    return res


def confidence(results: List[dict], query: str) -> str:
    if not results:
        return "low"
    q = set(tokens(query))
    hit = len(q & set(tokens(results[0]["title"] + " " + results[0]["text"]))) / (len(q) or 1)
    if results[0]["raw"] > 0.9 and hit >= 0.5:
        return "high"
    return "medium" if hit >= 0.3 else "low"
