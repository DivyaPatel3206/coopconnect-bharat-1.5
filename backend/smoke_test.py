"""Quick self-check for the new modules. Run from the backend folder:  python smoke_test.py
Uses a throw-away database (smoke_test.db), so your real data is untouched."""
import os, sys, traceback
if os.path.exists("smoke_test.db"):
    os.remove("smoke_test.db")
os.environ["DATABASE_URL"] = "sqlite:///./smoke_test.db"
os.environ["SEED_DEMO"] = "1"

from datetime import date
from fastapi.testclient import TestClient
from app.main import app

results = []
def check(name, fn):
    try:
        fn()
        results.append((True, name))
        print("PASS ", name)
    except Exception as e:
        results.append((False, name))
        print("FAIL ", name, "->", repr(e)[:300])

def run():
    with TestClient(app) as c:
        tok = {}
        def login(email):
            r = c.post("/api/auth/login", json={"email": email, "password": "Demo@1234"})
            assert r.status_code == 200, f"login {email}: {r.status_code} {r.text[:200]}"
            tok[email] = {"Authorization": "Bearer " + r.json()["access_token"]}
            return tok[email]
        H = lambda e: tok.get(e) or login(e)
        ST, TR, AD, TE = "rahul@coopconnect.demo", "trainer@coopconnect.demo", "admin@coopconnect.demo", "inst@coopconnect.demo"
        state = {}

        def ok(r, code=200):
            assert r.status_code == code, f"{r.request.method} {r.request.url.path} -> {r.status_code} {r.text[:200]}"
            return r

        check("health", lambda: ok(c.get("/api/health")))
        for e in (ST, TR, AD, TE, "employer@coopconnect.demo"):
            check(f"login {e}", lambda e=e: login(e))

        # --- 1. profiles ---
        check("my profile", lambda: ok(c.get("/api/profiles/me", headers=H(ST))).json()["profile"])
        check("edit profile", lambda: ok(c.put("/api/profiles/me", headers=H(ST), json={"phone": "+91 98765 43210", "pincode": "380001", "gender": "Male", "dob": "2000-05-01"})))
        check("bad pincode rejected", lambda: ok(c.put("/api/profiles/me", headers=H(ST), json={"pincode": "12"}), 422))
        check("add training", lambda: ok(c.post("/api/profiles/me/training", headers=H(ST), json={"title": "Test course", "status": "ongoing"}), 201))
        check("add document link", lambda: ok(c.post("/api/profiles/me/documents", headers=H(ST), data={"title": "ID", "doc_type": "ID proof", "file_url": "https://example.com/id.pdf"}), 201))
        check("people list (trainer)", lambda: (lambda j: j["total"] > 0 or (_ for _ in ()).throw(AssertionError("0 people")))(ok(c.get("/api/people", headers=H(TR))).json()))
        check("trainee blocked from people", lambda: ok(c.get("/api/people", headers=H(ST)), 403))
        check("institutions list", lambda: ok(c.get("/api/institutions", headers=H(AD))))

        # --- 2. attendance ---
        def progs():
            j = ok(c.get("/api/logistics/programmes", headers=H(TR))).json()
            assert j, "trainer sees no programmes"
            state["pid"] = [p for p in j if "Demo" in p["name"]][0]["id"]
        check("trainer programmes", progs)
        def mk():
            r = ok(c.post("/api/attendance/sessions", headers=H(TR), json={"programme_id": state["pid"], "title": "Smoke session", "session_date": date.today().isoformat()}), 201)
            state["code"] = r.json()["code"]; state["sid"] = r.json()["id"]
        check("create session", mk)
        check("trainee check-in", lambda: assert_eq(ok(c.post("/api/attendance/scan", headers=H(ST), json={"code": state["code"]})).json()["action"], "check_in"))
        check("double scan blocked", lambda: ok(c.post("/api/attendance/scan", headers=H(ST), json={"code": state["code"]}), 429))
        check("trainer check-in", lambda: ok(c.post("/api/attendance/scan", headers=H(TR), json={"code": state["code"]})))
        check("bad QR rejected", lambda: ok(c.post("/api/attendance/scan", headers=H(ST), json={"code": "nope-nope"}), 404))
        check("my records", lambda: ok(c.get("/api/attendance/mine", headers=H(ST))))
        check("admin records", lambda: ok(c.get("/api/attendance/records", headers=H(AD))))
        check("daily report", lambda: ok(c.get(f"/api/attendance/report/daily?programme_id={state['pid']}&on={date.today()}", headers=H(TR))))
        check("daily report CSV", lambda: ok(c.get(f"/api/attendance/report/daily?programme_id={state['pid']}&on={date.today()}&format=csv", headers=H(TR))))
        check("monthly report", lambda: ok(c.get(f"/api/attendance/report/monthly?programme_id={state['pid']}&month={str(date.today())[:7]}", headers=H(TR))))
        check("trainee cannot read reports", lambda: ok(c.get(f"/api/attendance/report/daily?programme_id={state['pid']}&on={date.today()}", headers=H(ST)), 403))

        # --- 3. logistics ---
        check("timetable (trainee)", lambda: assert_true(len(ok(c.get(f"/api/logistics/timetable?programme_id={state['pid']}", headers=H(ST))).json()) > 0, "empty"))
        check("hostels (admin)", lambda: assert_true(len(ok(c.get("/api/logistics/hostels", headers=H(AD))).json()) > 0, "no hostels"))
        check("my room (trainee)", lambda: assert_true(len(ok(c.get("/api/logistics/allocations/mine", headers=H(ST))).json()) > 0, "no allocation"))
        check("logistics items (trainee)", lambda: assert_true("cost" not in ok(c.get(f"/api/logistics/items?programme_id={state['pid']}", headers=H(ST))).json()[0], "cost leaked"))
        check("timetable clash detected", lambda: ok(c.post("/api/logistics/timetable", headers=H(TR), json={"programme_id": state["pid"], "title": "Clash", "session_date": (lambda t: t["session_date"])(ok(c.get(f"/api/logistics/timetable?programme_id={state['pid']}", headers=H(TR))).json()[0]), "start_time": "09:30", "end_time": "10:00", "trainer_name": "Kavita Joshi"}), 409))
        check("trainee cannot create hostel", lambda: ok(c.post("/api/logistics/hostels", headers=H(ST), json={"name": "X"}), 403))

        # --- calendar, e-mail & dashboard history ---
        check("calendar status", lambda: assert_true("google_configured" in ok(c.get("/api/calendar/status", headers=H(TR))).json(), "bad status"))
        check("timetable .ics export", lambda: assert_true("BEGIN:VEVENT" in ok(c.get(f"/api/calendar/ics?programme_id={state['pid']}", headers=H(ST))).text, "no events"))
        check("timetable create (no mail configured)", lambda: ok(c.post("/api/logistics/timetable?notify_users=true", headers=H(TR), json={"programme_id": state["pid"], "title": "Smoke extra", "session_date": "2031-01-05", "start_time": "09:00", "end_time": "10:00"}), 201))
        check("sync without Google config -> clear 400", lambda: ok(c.post(f"/api/calendar/sync/{state['pid']}", headers=H(TR)), 400))
        check("dashboard history (trainee)", lambda: assert_true(len(ok(c.get("/api/dashboard/history", headers=H(ST))).json()["events"]) > 0, "no past records"))
        check("dashboard history (trainer)", lambda: ok(c.get("/api/dashboard/history", headers=H(TR))))
        check("dashboard history (employer)", lambda: ok(c.get("/api/dashboard/history", headers=H("employer@coopconnect.demo"))))

        # --- redesign: public data, courses, analytics ---
        check("public overview (no login)", lambda: assert_true(ok(c.get("/api/public/overview")).json()["stats"]["programmes"] > 0, "no programmes"))
        check("public jobs", lambda: ok(c.get("/api/public/jobs")))
        check("public courses has 5+ courses", lambda: assert_true(len(ok(c.get("/api/public/courses")).json()) >= 5, "expected demo + 4 new courses"))
        check("learning list has course metadata", lambda: assert_true(any(x.get("level") and x.get("duration_hours") for x in ok(c.get("/api/learning/courses", headers=H(ST))).json()), "no meta"))
        check("analytics insights", lambda: assert_true("participation" in ok(c.get("/api/analytics/insights", headers=H(AD))).json(), "bad shape"))
        check("dashboard has notifications & recommendations", lambda: assert_true(all(k in ok(c.get("/api/dashboard/history", headers=H(ST))).json() for k in ("notifications", "recommended_courses", "recommended_jobs", "profile", "skills")), "missing keys"))
        check("profile completeness", lambda: ok(c.get("/api/dashboard/profile-completeness", headers=H(ST))))
        check("admin posts announcement", lambda: ok(c.post("/api/public/announcements", headers=H(AD), json={"title": "Smoke announcement", "tag": "Update"}), 201))
        check("trainee cannot post announcement", lambda: ok(c.post("/api/public/announcements", headers=H(ST), json={"title": "Nope nope", "tag": "Update"}), 403))

        # --- other modules (quick) ---
        check("employer jobs", lambda: ok(c.get("/api/employer/jobs", headers=H("employer@coopconnect.demo"))))
        check("learning courses", lambda: ok(c.get("/api/learning/courses", headers=H(ST))))
        check("chatbot", lambda: ok(c.post("/api/chat", headers=H(ST), json={"message": "Which jobs match my skills?"})))

def assert_eq(a, b): assert a == b, f"{a!r} != {b!r}"
def assert_true(v, msg=""): assert v, msg

try:
    run()
except Exception:
    traceback.print_exc()
    print("\nSTARTUP FAILED: copy everything above and send it back.")
    sys.exit(1)
bad = [n for okk, n in results if not okk]
print(f"\n{len(results) - len(bad)}/{len(results)} checks passed")
if bad:
    print("Failed:", *bad, sep="\n  - ")
sys.exit(1 if bad else 0)
