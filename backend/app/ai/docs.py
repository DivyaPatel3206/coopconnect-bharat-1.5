"""Document intelligence: text extraction, classification, entity extraction, resume analysis."""
import io, re, zipfile
from collections import Counter
from app.ai import retrieval as R

EXTRA_SKILLS = ["excel", "tally", "ms office", "communication", "accounting", "bookkeeping", "auditing", "banking", "loan processing", "data entry",
                "cooperative management", "leadership", "marketing", "computer", "english", "hindi", "gujarati", "customer service", "record keeping",
                "digital payments", "dairy management", "agriculture", "teamwork", "problem solving", "report writing"]


def extract_text(name: str, data: bytes) -> tuple:
    n = (name or "").lower()
    try:
        if n.endswith(".pdf"):
            from pypdf import PdfReader
            t = "\n".join((p.extract_text() or "") for p in PdfReader(io.BytesIO(data)).pages)
            if len(t.strip()) < 30:
                return "", "This PDF has no selectable text (probably a scan). OCR is needed: install Tesseract and see README."
            return t, None
        if n.endswith(".docx"):
            x = zipfile.ZipFile(io.BytesIO(data)).read("word/document.xml").decode("utf8", "ignore")
            return re.sub(r"\s+", " ", re.sub(r"</w:p>", "\n", re.sub(r"<[^>]+>", lambda m: "\n" if m.group(0) == "</w:p>" else "", x))), None
        if n.endswith((".png", ".jpg", ".jpeg")):
            try:
                import pytesseract
                from PIL import Image
                return pytesseract.image_to_string(Image.open(io.BytesIO(data))), None
            except Exception:
                return "", "Image OCR is not enabled on this server. Install pytesseract + Tesseract, or upload a PDF/DOCX/TXT."
        return data.decode("utf8", "ignore"), None
    except Exception as e:
        return "", f"Could not read this file ({type(e).__name__})."


TYPES = {"Resume": ["curriculum vitae", "resume", "objective", "work experience", "skills", "references", "career objective"],
         "Certificate": ["certificate", "certify", "certified that", "has successfully completed", "awarded", "verification"],
         "Government form": ["application form", "applicant", "declaration", "signature of applicant", "aadhaar", "form no", "scheme", "undertaking"],
         "Training document": ["syllabus", "module", "training", "curriculum", "learning outcomes", "session"],
         "Cooperative document": ["bye-laws", "bylaws", "society", "general body", "audit report", "balance sheet", "cooperative societies act", "registrar"]}


def classify(text: str) -> dict:
    t = text.lower()
    sc = {k: sum(t.count(w) for w in ws) for k, ws in TYPES.items()}
    best = max(sc, key=sc.get)
    tot = sum(sc.values())
    return {"type": best if sc[best] else "Other", "confidence": round(sc[best] / tot, 2) if tot else 0}


def entities(text: str) -> dict:
    return {"emails": sorted(set(re.findall(r"[\w.+-]+@[\w-]+\.[\w.]+", text)))[:5],
            "phones": sorted(set(re.findall(r"(?:\+91[\s-]?)?[6-9]\d{9}\b", text)))[:5],
            "dates": sorted(set(re.findall(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s\d{4}\b", text)))[:6],
            "amounts": sorted(set(re.findall(r"(?:Rs\.?|INR|₹)\s?[\d,]+(?:\.\d+)?", text)))[:6],
            "ids": sorted(set(re.findall(r"\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{8,14}\b", text)))[:4]}


def sentences(text: str):
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", text) if len(s.strip()) > 25]


def summarize(text: str, n=3) -> list:
    ss = sentences(text)
    if not ss:
        return []
    freq = Counter(R.tokens(text))
    sc = [(sum(freq[t] for t in R.tokens(s)) / (len(R.tokens(s)) or 1) ** 0.7, i, s) for i, s in enumerate(ss)]
    return [s for _, _, s in sorted(sorted(sc, reverse=True)[:n], key=lambda x: x[1])]


def best_sentences(text: str, question: str, n=2) -> list:
    q = set(R.tokens(question, expand=True))
    sc = [(len(q & set(R.tokens(s))), s) for s in sentences(text)]
    return [s for c, s in sorted(sc, key=lambda x: -x[0])[:n] if c > 0]


REQUIRED = {"Certificate": ["name", "date", "issuer", "id"], "Resume": ["email", "phone", "education", "experience", "skills"],
            "Government form": ["date", "signature", "name"]}


def missing_fields(kind: str, text: str, ent: dict) -> list:
    t = text.lower()
    chk = {"name": "name" in t, "date": bool(ent["dates"]), "issuer": any(w in t for w in ("institute", "council", "university", "society", "vamnicom", "ricm")),
           "id": bool(ent["ids"]) or "id" in t, "email": bool(ent["emails"]), "phone": bool(ent["phones"]),
           "education": any(w in t for w in ("education", "b.com", "bba", "degree", "diploma", "graduat", "hsc", "ssc", "m.com", "mba")),
           "experience": any(w in t for w in ("experience", "worked", "intern", "employment")),
           "skills": "skill" in t, "signature": "signature" in t or "sign" in t}
    return [f for f in REQUIRED.get(kind, []) if not chk.get(f, True)]


def analyze_resume(text: str, vocab: list, jobs: list) -> dict:
    t = text.lower()
    found = sorted({s for s in set(vocab + EXTRA_SKILLS) if re.search(r"\b" + re.escape(s.lower()) + r"\b", t)}, key=str.lower)
    ent = entities(text)
    sec = {"summary": any(w in t for w in ("objective", "summary", "profile")), "education": any(w in t for w in ("education", "b.com", "degree", "diploma", "graduat", "bba", "mba")),
           "experience": any(w in t for w in ("experience", "worked", "intern", "employment")), "certs": any(w in t for w in ("certif", "course", "training"))}
    rubric = [("Contact details", 10 if ent["emails"] and ent["phones"] else 5 if ent["emails"] or ent["phones"] else 0, 10),
              ("Education", 15 if sec["education"] else 0, 15), ("Experience", 20 if sec["experience"] else 0, 20),
              ("Skills listed", round(min(len(found), 8) / 8 * 20), 20), ("Certifications / training", 15 if sec["certs"] else 0, 15),
              ("Professional summary", 5 if sec["summary"] else 0, 5), ("Length", 5 if 120 <= len(t.split()) <= 900 else 2, 5)]
    fit = []
    fs = {x.lower() for x in found}
    for j in jobs:
        req = [s.strip() for s in (j["required_skills"] or "").split(",") if s.strip()]
        if not req: continue
        m = [s for s in req if s.lower() in fs]
        fit.append({"id": j["id"], "title": j["title"], "company": j["company"], "match": round(100 * len(m) / len(req)), "missing": [s for s in req if s.lower() not in fs]})
    fit.sort(key=lambda x: -x["match"])
    best = fit[0]["match"] if fit else 0
    rubric.append(("Fit with open jobs", round(best / 10), 10))
    score = sum(v for _, v, _ in rubric)
    strengths = [f"{n} is well covered" for n, v, m in rubric if v >= m * 0.8 and m >= 10][:3]
    weak = [f"{n} is missing or thin" for n, v, m in rubric if v < m * 0.5][:4]
    improv = []
    if not ent["emails"] or not ent["phones"]: improv.append("Add a clear email address and phone number at the top.")
    if not sec["summary"]: improv.append("Add a 2-line professional summary stating the role you want.")
    if len(found) < 6: improv.append("List at least 6 relevant skills, using the same words as job posts.")
    if not sec["experience"]: improv.append("Add internships, projects or volunteering with a result for each.")
    if not sec["certs"]: improv.append("List courses and certificates, including CoopConnect certificates with verification IDs.")
    missing = sorted({m for f in fit[:3] for m in f["missing"]})[:5]
    return {"score": score, "rubric": [{"label": n, "value": v, "max": m} for n, v, m in rubric], "skills": found, "entities": ent,
            "strengths": strengths, "weaknesses": weak, "missing_skills": missing, "improvements": improv, "suitable_jobs": fit[:4],
            "draft_summary": f"Motivated candidate with skills in {', '.join(found[:5]) or 'cooperative sector basics'}, seeking a role in the cooperative sector where I can apply my training and keep learning."}
