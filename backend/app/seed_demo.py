"""Idempotent demo data: a complete 5-day programme that exercises every new module.
Runs once (skipped if the demo programme already exists). Set SEED_DEMO=0 to disable."""
import json
import secrets
from datetime import date, datetime, timedelta, time

from app.database import SessionLocal
from app import models, models_ext as mx, security

DEMO_NAME = "Digital Cooperative Entrepreneurship Bootcamp (Demo)"
PW = "Demo@1234"


def _user(db, name, email, role, location=None, education=None, interests=None):
    u = db.query(models.User).filter(models.User.email == email).first()
    if not u:
        u = models.User(name=name, email=email, hashed_password=security.hash_password(PW), role=models.RoleEnum(role),
                        location=location, education=education, career_interests=interests)
        db.add(u)
        db.commit()
    return u


def _profile(db, u, **kw):
    p = db.query(mx.Profile).filter(mx.Profile.user_id == u.id).first()
    if not p:
        p = mx.Profile(user_id=u.id)
        db.add(p)
    for k, v in kw.items():
        setattr(p, k, v)
    db.commit()
    return p


def run_demo_seed():
    db = SessionLocal()
    try:
        if db.query(models.Programme).filter(models.Programme.name == DEMO_NAME).first():
            return
        inst = db.query(models.Institution).filter(models.Institution.name == "RICM Gandhinagar").first()
        if not inst:
            inst = models.Institution(name="RICM Gandhinagar", type="RICM", state="Gujarat")
            db.add(inst)
            db.commit()
        if not db.query(mx.InstitutionProfile).filter(mx.InstitutionProfile.institution_id == inst.id).first():
            db.add(mx.InstitutionProfile(institution_id=inst.id, district="Gandhinagar", address="Sector 15, Gandhinagar",
                                         pincode="382016", contact_person="Registrar", email="ricm.demo@example.com",
                                         phone="0790000000", facilities="Classrooms, computer lab, hostel, canteen"))
            db.commit()

        today = date.today()
        start = today - timedelta(days=2)
        trainer_name = "Kavita Joshi"

        # ---- people ----
        admin = _user(db, "Admin Demo", "admin@coopconnect.demo", "super_admin", "Gandhinagar, Gujarat")
        instadm = _user(db, "Institution Admin Demo", "inst@coopconnect.demo", "institution_admin", "Gandhinagar, Gujarat")
        trainer = _user(db, trainer_name, "trainer@coopconnect.demo", "trainer", "Gandhinagar, Gujarat")
        emp_user = _user(db, "Recruiter Demo", "employer@coopconnect.demo", "employer", "Anand, Gujarat")
        for u in (admin, instadm, trainer):
            _profile(db, u, institution_id=inst.id if u is not admin else None, state="Gujarat")
        _profile(db, trainer, designation="Senior Faculty", organisation="RICM Gandhinagar")

        priya = db.query(models.User).filter(models.User.email == "priya@example.com").first()
        trainee_specs = [
            ("Rahul Mehta", "rahul@coopconnect.demo", "Male", "Ahmedabad, Gujarat", "B.Sc Agriculture", "Dairy, Agri business",
             [("Cooperative Management", 55), ("Communication", 65)]),
            ("Meena Patel", "meena@coopconnect.demo", "Female", "Anand, Gujarat", "B.A.", "Marketing, Entrepreneurship",
             [("Digital Literacy", 70), ("Communication", 75)]),
            ("Arjun Solanki", "arjun@coopconnect.demo", "Male", "Mehsana, Gujarat", "Diploma in Rural Management", "Credit societies",
             [("Cooperative Management", 45)]),
            ("Sneha Desai", "sneha@coopconnect.demo", "Female", "Surat, Gujarat", "B.Com", "Digital marketing",
             [("Digital Literacy", 85), ("Communication", 60)]),
        ]
        trainees = [priya] if priya else []
        if priya:
            _profile(db, priya, gender="Female", institution_id=inst.id, state="Gujarat", district="Gandhinagar", open_to_work=True)
        for name, email, gender, loc, edu, interests, skills in trainee_specs:
            u = _user(db, name, email, "trainee", loc, edu, interests)
            _profile(db, u, gender=gender, institution_id=inst.id, state="Gujarat", open_to_work=(name != "Arjun Solanki"))
            if not u.user_skills:
                for s, lvl in skills:
                    db.add(models.UserSkill(user_id=u.id, skill_name=s, level_percent=lvl))
                db.commit()
            trainees.append(u)

        # ---- programme + registrations ----
        prog = models.Programme(
            name=DEMO_NAME, category="Entrepreneurship", institution_id=inst.id, trainer_name=trainer_name,
            start_date=datetime.combine(start, time(9, 30)), end_date=datetime.combine(start + timedelta(days=4), time(16, 0)),
            capacity=30, location="RICM Gandhinagar", mode="Classroom",
            description="A 5-day residential demo programme: build and pitch a cooperative business idea using digital tools. "
                        "Includes timetable, hostel stay, meals, QR attendance, a self-paced course with quizzes, and job connect.")
        db.add(prog)
        db.commit()
        for u in trainees:
            db.add(models.Registration(user_id=u.id, programme_id=prog.id, status=models.RegistrationStatus.approved))
            db.add(mx.TrainingHistory(user_id=u.id, title=DEMO_NAME, institution_name="RICM Gandhinagar",
                                      start_date=start, end_date=start + timedelta(days=4), status="ongoing"))
        db.commit()

        # ---- venues & timetable ----
        hall = mx.Venue(institution_id=inst.id, name="Seminar Hall A", venue_type="Seminar hall", capacity=60, location="Ground floor", facilities="Projector, PA system")
        lab = mx.Venue(institution_id=inst.id, name="Computer Lab 1", venue_type="Computer lab", capacity=30, location="First floor", facilities="30 PCs, Wi-Fi")
        db.add_all([hall, lab])
        db.commit()
        plan = [
            [("Orientation & cooperative principles", hall), ("Cooperative business models", hall), ("Digital tools for societies", lab)],
            [("Market research & customer discovery", hall), ("Costing & pricing basics", hall), ("Digital payments & UPI practice", lab)],
            [("Business plan canvas", hall), ("Digital marketing & WhatsApp Business", lab), ("Group workshop: draft your plan", hall)],
            [("Governance & compliance basics", hall), ("Credit linkages & support schemes", hall), ("Pitch practice", hall)],
            [("Pitch day", hall), ("Career pathways & job connect", hall), ("Feedback & certificates", hall)],
        ]
        slots = [("09:30", "11:00"), ("11:30", "13:00"), ("14:00", "16:00")]
        for d, day in enumerate(plan):
            for (title, venue), (s, e) in zip(day, slots):
                db.add(mx.TimetableEntry(programme_id=prog.id, title=title, topic=f"Day {d + 1}", session_date=start + timedelta(days=d),
                                         start_time=s, end_time=e, trainer_name=trainer_name, venue_id=venue.id))
        db.commit()

        # ---- hostels ----
        boys = mx.Hostel(institution_id=inst.id, name="Sahyadri Boys Hostel", gender_type="Male", address="RICM campus, Block B")
        girls = mx.Hostel(institution_id=inst.id, name="Gauri Girls Hostel", gender_type="Female", address="RICM campus, Block C")
        db.add_all([boys, girls])
        db.commit()
        for h, base, n in ((boys, 101, 5), (girls, 201, 4)):
            for i in range(n):
                db.add(mx.Room(hostel_id=h.id, room_no=str(base + i), floor=base // 100, capacity=2))
        db.commit()
        room = lambda h, no: db.query(mx.Room).filter(mx.Room.hostel_id == h.id, mx.Room.room_no == no).first()
        by_email = {u.email: u for u in trainees}
        assign = [("rahul@coopconnect.demo", boys, "101"), ("arjun@coopconnect.demo", boys, "101"),
                  ("meena@coopconnect.demo", girls, "201"), ("sneha@coopconnect.demo", girls, "202"), ("priya@example.com", girls, "201")]
        for email, h, no in assign:
            if email in by_email:
                db.add(mx.HostelAllocation(room_id=room(h, no).id, user_id=by_email[email].id, programme_id=prog.id,
                                           check_in_date=start, check_out_date=start + timedelta(days=4)))
        db.commit()

        # ---- logistics ----
        L = lambda kind, title, off, t, details, qty=None, status="confirmed", vendor=None, cost=None: db.add(mx.LogisticsItem(
            programme_id=prog.id, kind=kind, title=title, item_date=start + timedelta(days=off), item_time=t,
            details=details, quantity=qty, status=status, vendor=vendor, cost=cost))
        L("transport", "Pickup from Gandhinagar railway station", 0, "08:00", "Bus, 2 trips. Meet at the station main gate.", 35, "done", "City Travels", 6000)
        L("transport", "Field visit: dairy cooperative", 2, "13:30", "Bus to a nearby dairy cooperative society and back by 17:00.", 35, "done", "City Travels", 8500)
        L("transport", "Drop to railway station", 4, "17:00", "Bus, after certificate distribution.", 35, "planned", "City Travels", 6000)
        for d in range(5):
            L("meal", f"Day {d + 1}: breakfast, lunch, tea", d, "08:30", "Vegetarian. Lunch at 13:00 in the canteen.", 35,
              "done" if start + timedelta(days=d) < today else "confirmed", "RICM canteen", 35 * 250)
        L("equipment", "Training kits (notebook, pen, ID card)", 0, "09:00", "Distributed at registration desk.", 35, "done")
        L("other", "Certificates printing & signing", 3, None, "Print on Day 4 for distribution on Day 5.", 35, "planned")

        # ---- attendance ----
        def add_session(off):
            d = start + timedelta(days=off)
            is_today = d == today
            return d, mx.AttendanceSession(programme_id=prog.id, title=f"Day {off + 1} attendance", session_date=d,
                                           code=secrets.token_urlsafe(9), created_by=trainer.id, is_open=is_today,
                                           closes_at=datetime.utcnow() + timedelta(hours=8) if is_today else datetime.combine(d, time(18, 0)))
        for off in range(5):
            d = start + timedelta(days=off)
            if d > today:
                continue
            d, s = add_session(off)
            db.add(s)
            db.commit()
            if d < today:  # history so reports have data
                for u in [trainer] + trainees:
                    if off == 1 and u.email == "arjun@coopconnect.demo":
                        continue  # one absentee
                    cin = datetime.combine(d, time(9, 20)) + timedelta(minutes=secrets.randbelow(15))
                    db.add(mx.AttendanceRecord(session_id=s.id, user_id=u.id, role=str(u.role.value), check_in=cin,
                                               check_out=datetime.combine(d, time(16, 5)), method="qr"))
                db.commit()

        # ---- learning course ----
        course = models.Course(title="Cooperative Digital Entrepreneurship", skill_tag="Cooperative Entrepreneurship", language="English",
                               description="Self-paced companion to the bootcamp: video, PDF, slides, interactive lessons, a quiz and an assignment.")
        db.add(course)
        db.commit()
        db.add(mx.ProgrammeCourse(programme_id=prog.id, course_id=course.id))
        steps = {"type": "steps", "steps": [
            {"title": "1. Pick a need", "content": "Talk to 5 members of your society. What do they buy, sell or struggle with every week? Write the top three needs."},
            {"title": "2. Choose the model", "content": "Decide whether a producer, consumer, credit or service cooperative fits best, and who the members would be."},
            {"title": "3. Cost and price", "content": "List monthly costs (rent, transport, labour, packing). Divide by expected units to find your break-even price."},
            {"title": "4. Go digital", "content": "Pick one digital habit: UPI collection, WhatsApp Business catalogue, or a simple sales register in a spreadsheet."},
            {"title": "5. Pitch in 60 seconds", "content": "Problem, members, product, price, ask. Practise it aloud once before Day 5."}]}
        cards = {"type": "flashcards", "cards": [
            {"front": "Cooperative", "back": "An autonomous association of persons united voluntarily to meet common needs through a jointly owned, democratically controlled enterprise."},
            {"front": "One member, one vote", "back": "Voting power is equal regardless of shares held; this is what keeps control democratic."},
            {"front": "PACS", "back": "Primary Agricultural Credit Society: village-level cooperative providing credit and inputs to farmers."},
            {"front": "Break-even point", "back": "Sales volume at which total revenue equals total costs; no profit, no loss."},
            {"front": "UPI", "back": "Unified Payments Interface: instant bank-to-bank payments from a phone, useful for society collections."}]}
        case = ("## A women's dairy cooperative\n\nA group of 40 women in a village began pooling milk and selling it together instead of to individual traders.\n\n"
                "**What changed**\n- A shared chilling tank cut spoilage.\n- Digital payment records made monthly settlement transparent.\n- Bulk selling gave a better, steadier price.\n\n"
                "**Discuss:** Which of these steps could your idea copy? What would you do differently?")
        lessons = [
            ("Welcome: why cooperatives?", "video", "https://www.youtube.com/watch?v=aqz-KE-bpKQ", None, 8),
            ("Cooperative business canvas (PDF)", "pdf", "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", None, 10),
            ("Digital payments for societies (slides)", "presentation", "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", None, 12),
            ("Build your first business plan (guided)", "interactive", None, json.dumps(steps), 15),
            ("Key terms flashcards", "interactive", None, json.dumps(cards), 6),
            ("Case study: a women's dairy cooperative", "text", None, case, 8),
            ("Module quiz", "quiz", None, None, 10),
        ]
        lesson_rows = []
        for i, (title, ctype, url, body, dur) in enumerate(lessons):
            l = models.Lesson(course_id=course.id, title=title, content_type=ctype, order_index=i)
            db.add(l)
            db.flush()
            db.add(mx.LessonContent(lesson_id=l.id, url=url, body=body, duration_min=dur))
            lesson_rows.append(l)
        db.commit()
        qz = mx.Quiz(lesson_id=lesson_rows[-1].id, title="Module quiz", pass_percent=60)
        db.add(qz)
        db.commit()
        qs = [("How many votes does each member have in a cooperative?", ["One", "One per share held", "Depends on age", "Two for founders"], 0, "One member, one vote keeps control democratic."),
              ("Break-even means:", ["Maximum profit", "Revenue equals total cost", "Zero sales", "Highest price"], 1, "At break-even you neither gain nor lose."),
              ("Which is a good first digital habit for a small society?", ["Ignore records", "UPI collections and a sales register", "Cash only", "Verbal accounts"], 1, "Simple digital records improve transparency."),
              ("A PACS mainly provides:", ["Village-level credit and inputs", "Airline tickets", "Movie streaming", "Mobile towers"], 0, "PACS = Primary Agricultural Credit Society."),
              ("In a 60-second pitch you should include:", ["Only your name", "Problem, members, product, price, ask", "Only the price", "A long history"], 1, "Keep it short and structured.")]
        for i, (p, o, c, ex) in enumerate(qs):
            db.add(mx.QuizQuestion(quiz_id=qz.id, prompt=p, options=json.dumps(o), correct_index=c, explanation=ex, order_index=i))
        asg = mx.Assignment(course_id=course.id, title="One-page business idea", max_marks=100, due_date=today + timedelta(days=3),
                            instructions="Write one page: the need, your cooperative model, members, costs and price, and one digital tool you will use.")
        db.add(asg)
        db.commit()
        done_counts = {"priya@example.com": 3, "rahul@coopconnect.demo": 5, "meena@coopconnect.demo": 2, "sneha@coopconnect.demo": 1, "arjun@coopconnect.demo": 0}
        for u in trainees:
            n = done_counts.get(u.email, 0)
            for l in lesson_rows[:n]:
                db.add(mx.LessonProgress(user_id=u.id, lesson_id=l.id))
            db.add(models.Enrollment(user_id=u.id, course_id=course.id, progress_percent=round(n / len(lesson_rows) * 100, 1)))
        rahul = by_email.get("rahul@coopconnect.demo")
        if rahul:
            db.add(mx.AssignmentSubmission(assignment_id=asg.id, user_id=rahul.id, content="Idea: a village milk-collection cooperative with UPI settlement.", status="submitted"))
        db.commit()

        # ---- employer + jobs ----
        legacy = models.Employer(company_name="Sahkar Agro Foods", sector="Agri & Dairy Processing", location="Anand, Gujarat")
        db.add(legacy)
        db.commit()
        if not db.query(mx.EmployerProfile).filter(mx.EmployerProfile.user_id == emp_user.id).first():
            db.add(mx.EmployerProfile(user_id=emp_user.id, employer_id=legacy.id, company_name="Sahkar Agro Foods", sector="Agri & Dairy Processing",
                                      location="Anand, Gujarat", website="https://example.com", verified=True,
                                      description="Demo employer hiring cooperative-trained talent for field and digital roles."))
            db.commit()
        jobs = [("Cooperative Business Associate", "Full-time", "Cooperative Entrepreneurship, Communication", "Support member societies with business planning and records.", "₹15,000–20,000 / month", 3),
                ("Digital Marketing Intern", "Internship", "Digital Literacy, Communication", "Run WhatsApp catalogues and social posts for cooperative products.", "₹6,000 stipend / month", 2),
                ("Farmer Group Coordinator", "Apprenticeship", "Cooperative Management, Communication", "Coordinate farmer groups for procurement and quality checks.", "₹10,000 / month", 4)]
        job_rows = []
        for title, jtype, skills, desc, sal, openings in jobs:
            j = models.Job(employer_id=legacy.id, title=title, description=desc, required_skills=skills, location="Anand, Gujarat")
            db.add(j)
            db.flush()
            db.add(mx.JobMeta(job_id=j.id, job_type=jtype, salary_range=sal, openings=openings, deadline=today + timedelta(days=30), status="open"))
            job_rows.append(j)
        db.commit()
        from app.routers.jobs import _match_score
        apps = [("priya@example.com", 0, "shortlisted"), ("rahul@coopconnect.demo", 0, "applied"), ("meena@coopconnect.demo", 1, "interview")]
        for email, ji, status in apps:
            u = by_email.get(email)
            if u:
                db.add(models.JobApplication(job_id=job_rows[ji].id, user_id=u.id, status=status, match_score=_match_score(u, job_rows[ji], db)))
        db.commit()
    finally:
        db.close()
