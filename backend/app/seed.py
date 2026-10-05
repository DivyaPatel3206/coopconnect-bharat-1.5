from datetime import datetime, timedelta

from app.database import SessionLocal
from app import models, security


def run_seed_if_empty():
    db = SessionLocal()
    try:
        if db.query(models.Institution).count() > 0:
            return  # already seeded

        # ---------- Institutions ----------
        vamnicom = models.Institution(name="VAMNICOM", type="VAMNICOM", state="Maharashtra")
        ricm_gj = models.Institution(name="RICM Gandhinagar", type="RICM", state="Gujarat")
        icm_kolkata = models.Institution(name="ICM Kolkata", type="ICM", state="West Bengal")
        db.add_all([vamnicom, ricm_gj, icm_kolkata])
        db.commit()

        # ---------- Programmes ----------
        now = datetime.utcnow()
        programmes = [
            models.Programme(
                name="Digital Literacy for Rural Youth", category="Digital Skills",
                institution_id=vamnicom.id, trainer_name="A. Deshpande",
                start_date=now + timedelta(days=10), end_date=now + timedelta(days=17),
                capacity=40, location="Pune", mode="Hybrid",
                description="Foundational digital skills for rural participants: devices, internet, digital payments.",
            ),
            models.Programme(
                name="Cooperative Management Essentials", category="Management",
                institution_id=vamnicom.id, trainer_name="R. Kulkarni",
                start_date=now + timedelta(days=20), end_date=now + timedelta(days=27),
                capacity=35, location="Pune", mode="Classroom",
                description="Core principles of running a cooperative society effectively.",
            ),
            models.Programme(
                name="Dairy Cooperative Development", category="Dairy",
                institution_id=ricm_gj.id, trainer_name="P. Patel",
                start_date=now + timedelta(days=5), end_date=now + timedelta(days=12),
                capacity=30, location="Gandhinagar", mode="Classroom",
                description="Operations, quality control and growth strategy for dairy cooperatives.",
            ),
            models.Programme(
                name="PACS Digital Transformation", category="Digital Skills",
                institution_id=ricm_gj.id, trainer_name="S. Shah",
                start_date=now + timedelta(days=30), end_date=now + timedelta(days=34),
                capacity=25, location="Online", mode="Online",
                description="Moving Primary Agricultural Credit Societies onto digital record-keeping.",
            ),
            models.Programme(
                name="Women Entrepreneurship in Cooperatives", category="Entrepreneurship",
                institution_id=icm_kolkata.id, trainer_name="M. Sen",
                start_date=now + timedelta(days=15), end_date=now + timedelta(days=19),
                capacity=30, location="Kolkata", mode="Hybrid",
                description="Business planning and mentorship for women-led cooperative ventures.",
            ),
        ]
        db.add_all(programmes)
        db.commit()

        # ---------- Courses ----------
        courses_data = [
            ("Digital Literacy Basics", "Digital Literacy", [
                ("Using Smartphones Safely", "video"),
                ("Digital Payments 101", "video"),
                ("Basics Quiz", "quiz"),
            ]),
            ("Cooperative Management Fundamentals", "Cooperative Management", [
                ("Principles of Cooperation", "pdf"),
                ("Governance & Bylaws", "video"),
                ("Case Study: PACS", "pdf"),
                ("Management Quiz", "quiz"),
            ]),
            ("Dairy Quality & Operations", "Dairy Operations", [
                ("Milk Quality Standards", "video"),
                ("Cold Chain Basics", "video"),
                ("Operations Quiz", "quiz"),
            ]),
            ("Communication Skills for the Workplace", "Communication", [
                ("Speaking with Confidence", "video"),
                ("Writing Clear Reports", "pdf"),
                ("Communication Quiz", "quiz"),
            ]),
        ]
        for title, skill_tag, lessons in courses_data:
            course = models.Course(title=title, description=f"{title} — self-paced digital course.", skill_tag=skill_tag)
            db.add(course)
            db.commit()
            for i, (lesson_title, ctype) in enumerate(lessons):
                db.add(models.Lesson(course_id=course.id, title=lesson_title, content_type=ctype, order_index=i))
            db.commit()

        # ---------- Employers & Jobs ----------
        amul = models.Employer(company_name="Amul Dairy Cooperative", sector="Dairy", location="Anand, Gujarat")
        ifco = models.Employer(company_name="IFFCO", sector="Agri Inputs", location="New Delhi")
        db.add_all([amul, ifco])
        db.commit()

        jobs = [
            models.Job(
                employer_id=amul.id, title="Field Coordinator - Dairy Cooperatives",
                description="Support dairy cooperative societies with quality control and farmer engagement.",
                required_skills="Dairy Operations, Communication", location="Anand, Gujarat",
            ),
            models.Job(
                employer_id=amul.id, title="Digital Records Associate",
                description="Maintain digital records for member cooperatives.",
                required_skills="Digital Literacy, Cooperative Management", location="Anand, Gujarat",
            ),
            models.Job(
                employer_id=ifco.id, title="Cooperative Outreach Officer",
                description="Coordinate training and outreach programmes for PACS members.",
                required_skills="Cooperative Management, Communication", location="New Delhi",
            ),
        ]
        db.add_all(jobs)
        db.commit()

        # ---------- Demo trainee ----------
        demo_user = models.User(
            name="Priya Sharma",
            email="priya@example.com",
            hashed_password=security.hash_password("password123"),
            role=models.RoleEnum.trainee,
            location="Gandhinagar, Gujarat",
            education="B.Com",
            career_interests="Cooperative Management, Dairy Operations",
        )
        db.add(demo_user)
        db.commit()
        db.add_all([
            models.UserSkill(user_id=demo_user.id, skill_name="Digital Literacy", level_percent=80),
            models.UserSkill(user_id=demo_user.id, skill_name="Communication", level_percent=60),
        ])
        db.commit()

    finally:
        db.close()
