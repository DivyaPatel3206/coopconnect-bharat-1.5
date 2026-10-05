"""Idempotent catalogue seed: 4 sample courses (with lessons, quizzes, assignments), course metadata and announcements.
Safe to run on every start; each item is created only if it does not exist yet."""
import json
from datetime import date, timedelta, datetime

from app.database import SessionLocal
from app import models, models_ext as mx

VIDEO = "https://www.youtube.com/watch?v=aqz-KE-bpKQ"  # placeholder: replace from the lesson editor
PDF = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"  # placeholder


def steps(*pairs):
    return json.dumps({"type": "steps", "steps": [{"title": t, "content": c} for t, c in pairs]})


def cards(*pairs):
    return json.dumps({"type": "flashcards", "cards": [{"front": f, "back": b} for f, b in pairs]})


COURSES = [
    {
        "title": "Digital Literacy for Cooperative Members", "tag": "Digital Literacy", "lang": "English",
        "desc": "Use a smartphone confidently: digital payments, safe browsing and simple record-keeping for your society.",
        "meta": dict(category="Digital Skills", level="Beginner", duration_hours=6, instructor="A. Deshpande", institution_name="VAMNICOM"),
        "lessons": [
            ("Why digital skills matter for your society", "video", VIDEO, None, 8),
            ("Make a UPI payment, step by step", "interactive", None, steps(
                ("Open your payment app", "Open the app and unlock it with your PIN or fingerprint. Never share the PIN with anyone."),
                ("Choose who to pay", "Scan the shop's QR code, or enter the mobile number or UPI ID. Check the name shown before you continue."),
                ("Enter the amount", "Type the amount and an optional note such as 'milk collection, March'."),
                ("Confirm with your UPI PIN", "Enter your PIN only on the payment screen. You never need a PIN to receive money."),
                ("Keep the receipt", "Take a screenshot of the success screen and note the transaction ID in your register."))
             , 12),
            ("Digital terms you will hear", "interactive", None, cards(
                ("UPI", "Instant bank-to-bank payments from a phone using a UPI ID or QR code."),
                ("OTP", "A one-time code sent to your phone. Banks never ask you to read it out over a call."),
                ("Phishing", "A fake message or website that tries to trick you into giving passwords or PINs."),
                ("Cloud backup", "A copy of your files stored online so they are safe if your phone is lost."),
                ("Spreadsheet", "A grid of rows and columns for lists and totals, such as member and sales registers.")), 8),
            ("Staying safe online", "text", None,
             "## Five habits that protect you\n- Never share your PIN, password or OTP, even with someone who says they are from the bank.\n- Check the sender before you tap a link in a message.\n"
             "- Use a screen lock and install updates when your phone asks.\n- Pay only through the official app or a QR code you have checked.\n- If money goes missing, tell your bank at once and report it on the national cyber crime helpline.\n\n"
             "**Discuss:** Which of these habits does your society already follow?", 10),
            ("Check your understanding", "quiz", None, [
                ("Who should you share your UPI PIN with?", ["Nobody", "Bank staff on a call", "A trusted friend", "The shop owner"], 0, "A PIN is personal. No genuine bank or shop will ask for it."),
                ("A message asks you to click a link to claim a prize. What should you do?", ["Click it quickly", "Ignore it and do not share details", "Forward it to members", "Reply with your OTP"], 1, "Unexpected prize messages are a common scam."),
                ("Do you need a UPI PIN to RECEIVE money?", ["Yes, always", "No", "Only above Rs 1,000", "Only at night"], 1, "A PIN is needed only to send money."),
                ("A cloud backup is useful because:", ["It makes the phone faster", "Your files survive if the phone is lost", "It removes viruses", "It saves mobile data"], 1, "Backups keep a second copy of your data.")], 8),
        ],
        "assignment": ("Digitise one register", "Pick one paper register in your society (members, milk collection or sales). Create the first 10 rows in a spreadsheet and share a screenshot or link.", 50),
    },
    {
        "title": "Dairy Cooperative Operations & Quality", "tag": "Dairy Operations", "lang": "English",
        "desc": "From milk collection to chilling and payment: run a village dairy cooperative society with consistent quality and transparent records.",
        "meta": dict(category="Dairy", level="Intermediate", duration_hours=8, instructor="P. Patel", institution_name="RICM Gandhinagar"),
        "lessons": [
            ("Milk collection: the daily flow", "text", None,
             "## From farmer to chilling centre\nMilk is brought to the collection point twice a day. Each lot is weighed, sampled and recorded against the member before it is poured into the can or tank.\n\n"
             "- **Weigh** the milk and record the quantity.\n- **Test** a sample for fat and SNF (solids-not-fat), which decide the price.\n- **Record** the entry on the pass book and the society register.\n- **Chill** promptly so quality does not fall.\n\n**Why it matters:** members trust the society when weight, tests and payment are open to see.", 10),
            ("Checking milk quality", "interactive", None, steps(
                ("Look and smell", "Reject milk that smells sour or looks curdled. Note the reason in the register."),
                ("Take a fair sample", "Mix the milk well before taking a sample so the test represents the whole lot."),
                ("Measure fat and SNF", "Use the milk analyser or lactometer as trained. These readings set the rate for the farmer."),
                ("Run a basic adulteration check", "Follow your institute's approved test kit instructions. If a lot fails, follow the society's rejection procedure."),
                ("Pay and record", "Enter quantity, fat, SNF, rate and amount on the farmer's pass book and the daily register.")), 12),
            ("Dairy terms", "interactive", None, cards(
                ("Fat", "The butterfat content of milk, one of the main factors in the price paid."),
                ("SNF", "Solids-not-fat: proteins, lactose and minerals in milk."),
                ("BMC", "Bulk milk cooler: a tank that chills milk at the village collection point."),
                ("Pass book", "The member's own record of milk supplied and payments received."),
                ("Bonus", "A share of surplus returned to member-suppliers according to their supply.")), 6),
            ("Society operations checklist (PDF)", "pdf", PDF, None, 10),
            ("Module quiz", "quiz", None, [
                ("Which two readings mainly decide the price of milk at collection?", ["Colour and smell", "Fat and SNF", "Can size and time", "Distance and weather"], 1, "Fat and SNF are tested at collection and used for the rate."),
                ("Why mix milk well before sampling?", ["It saves time", "So the sample represents the whole lot", "It lowers fat", "It removes smell"], 1, "An unmixed sample gives an unfair reading."),
                ("What does a pass book help with?", ["Transparency in supply and payment", "Weighing the milk", "Chilling the milk", "Testing SNF"], 0, "It is the member's record, so disputes are easy to settle."),
                ("Prompt chilling is important because:", ["It improves colour", "It slows quality loss", "It raises fat", "It reduces weight"], 1, "Warm milk spoils quickly.")], 8),
        ],
        "assignment": ("Society quality plan", "Describe in one page how your society will test, record and pay for milk each day, and who is responsible for each step.", 100),
    },
    {
        "title": "Financial Management for PACS", "tag": "Financial Management", "lang": "English",
        "desc": "Books of accounts, loan appraisal and recovery basics for staff and committee members of Primary Agricultural Credit Societies.",
        "meta": dict(category="Finance", level="Intermediate", duration_hours=10, instructor="R. Kulkarni", institution_name="VAMNICOM"),
        "lessons": [
            ("Books of accounts in a PACS", "text", None,
             "## The core records\nA PACS keeps a small set of books that together show where money came from and where it went.\n\n- **Cash book:** every receipt and payment, in date order.\n- **Ledger:** accounts for each member, loan and head of income or expense.\n"
             "- **Loan register:** sanction, disbursement, repayment and balance for each borrower.\n- **Trial balance:** a check that the books agree before the final accounts are prepared.\n\n**Tip:** record the same day. Late entries are where mistakes begin.", 12),
            ("Appraising a crop loan", "interactive", None, steps(
                ("Confirm the member", "Check membership, land records and any existing dues."),
                ("Estimate the need", "Use the scale of finance for the crop and area to find the eligible amount."),
                ("Check repayment capacity", "Compare expected income at harvest with the loan and interest."),
                ("Take documents and security", "Collect the papers your society's bye-laws and the bank require."),
                ("Sanction and record", "Record the sanction, disburse as approved and enter the schedule in the loan register.")), 14),
            ("Finance terms", "interactive", None, cards(
                ("Share capital", "Money contributed by members that gives them ownership of the society."),
                ("Overdue", "A loan instalment not paid by its due date."),
                ("NPA", "Non-performing asset: a loan on which dues are unpaid beyond the period set by the regulator. Check the current norms."),
                ("Audit", "An independent check that the society's accounts are accurate and rules are followed."),
                ("Reserve fund", "Surplus set aside by rule to strengthen the society's financial base.")), 8),
            ("Recovery and member communication (slides)", "presentation", PDF, None, 12),
            ("Module quiz", "quiz", None, [
                ("Which record shows every receipt and payment in date order?", ["Loan register", "Cash book", "Minutes book", "Stock register"], 1, "The cash book is the day-to-day record of money."),
                ("Why is a trial balance prepared?", ["To fix interest rates", "To check the books agree", "To print passbooks", "To invite members"], 1, "It highlights errors before final accounts."),
                ("A good first step in loan appraisal is to:", ["Sanction at once", "Confirm membership and existing dues", "Collect interest in advance", "Skip documents"], 1, "Eligibility and dues come first."),
                ("Entries should be made:", ["Weekly", "At year end", "On the same day", "Only when audited"], 2, "Same-day entry keeps records accurate.")], 8),
        ],
        "assignment": ("Appraise a sample loan", "Using the steps from the course, write a short appraisal for a sample crop loan: eligibility, amount, repayment plan and risks.", 100),
    },
    {
        "title": "Women-led Enterprise & SHG Linkages", "tag": "Entrepreneurship", "lang": "English",
        "desc": "Turn a self-help group into a small cooperative enterprise: choosing a product, costing, linking to credit and markets.",
        "meta": dict(category="Entrepreneurship", level="Beginner", duration_hours=5, instructor="S. Shah", institution_name="ICM Mehsana"),
        "lessons": [
            ("Case study: from SHG to enterprise", "text", None,
             "## A group of 20 women and one idea\nA self-help group in a village saved together for two years. They then decided to process and pack local spices instead of selling them loose.\n\n"
             "**What they did**\n- Surveyed three nearby markets to learn what sold.\n- Costed raw material, packing, labour and transport for one month.\n- Applied together for a group loan and kept clear records.\n\n**Discuss:** What would you test first with your own group?", 10),
            ("Plan your enterprise", "interactive", None, steps(
                ("Choose a product or service", "Pick something your group already knows how to make or do, and that people nearby buy."),
                ("Know your customer", "Talk to ten possible buyers. What price do they pay today and what do they complain about?"),
                ("Work out the cost", "List monthly costs. Divide by expected units to see your break-even price."),
                ("Link to finance", "Explore group loans and schemes through your bank or institute. Keep savings and repayment records tidy."),
                ("Start small and review", "Run a one-month pilot, then meet as a group to review sales and costs.")), 12),
            ("Enterprise terms", "interactive", None, cards(
                ("SHG", "Self-help group: a small group that saves and lends among its members."),
                ("Break-even", "The sales level at which revenue equals total costs."),
                ("Working capital", "Money needed for day-to-day costs such as raw material and packing."),
                ("Value addition", "Processing or packing a product so it sells for more than the raw form."),
                ("Market linkage", "A regular route to sell your product, such as a shop, cooperative or institution.")), 6),
            ("Quick check", "quiz", None, [
                ("A first step in planning an enterprise is to:", ["Buy equipment", "Choose something people nearby buy", "Hire staff", "Print banners"], 1, "Start from real demand."),
                ("Break-even means:", ["Maximum profit", "Revenue equals total costs", "No sales", "Highest price"], 1, "At break-even you neither gain nor lose."),
                ("Value addition is:", ["Selling raw produce only", "Processing or packing to earn more", "Borrowing money", "Hiring a guard"], 1, "Processing raises the price you can charge."),
                ("Why run a one-month pilot?", ["To avoid records", "To test costs and sales before scaling", "To close the group", "To skip a loan"], 1, "A pilot reduces risk.")], 6),
        ],
        "assignment": ("One-page enterprise idea", "Describe your product, customers, monthly cost and break-even price, and the first month's plan.", 50),
    },
]

ANNOUNCEMENTS = [
    ("Registrations open: Digital Literacy for Rural Youth", "Hybrid batch for first-time smartphone users. Limited seats; register from the Programmes page.", "Programme", "/programmes", 2),
    ("Four new self-paced courses are live", "Digital literacy, dairy operations, PACS finance and women-led enterprise, each with quizzes and an assignment.", "Platform", "/courses", 5),
    ("Employers: post openings and search skilled trainees", "Cooperative-sector employers can now register, post jobs and shortlist certified trainees.", "Employment", "/jobs", 9),
]


def run_extra_seed():
    db = SessionLocal()
    try:
        # metadata for the earlier demo course
        demo = db.query(models.Course).filter(models.Course.title == "Cooperative Digital Entrepreneurship").first()
        if demo and not db.query(mx.CourseMeta).filter(mx.CourseMeta.course_id == demo.id).first():
            db.add(mx.CourseMeta(course_id=demo.id, category="Entrepreneurship", level="Beginner", duration_hours=4,
                                 instructor="Kavita Joshi", institution_name="RICM Gandhinagar"))
            db.commit()

        for spec in COURSES:
            if db.query(models.Course).filter(models.Course.title == spec["title"]).first():
                continue
            c = models.Course(title=spec["title"], description=spec["desc"], skill_tag=spec["tag"], language=spec["lang"])
            db.add(c)
            db.flush()
            db.add(mx.CourseMeta(course_id=c.id, **spec["meta"]))
            for i, (title, ctype, url, body, mins) in enumerate(spec["lessons"]):
                l = models.Lesson(course_id=c.id, title=title, content_type=ctype, order_index=i)
                db.add(l)
                db.flush()
                if ctype == "quiz":
                    db.add(mx.LessonContent(lesson_id=l.id, duration_min=mins))
                    qz = mx.Quiz(lesson_id=l.id, title=title, pass_percent=60)
                    db.add(qz)
                    db.flush()
                    for qi, (prompt, opts, ci, ex) in enumerate(body):
                        db.add(mx.QuizQuestion(quiz_id=qz.id, prompt=prompt, options=json.dumps(opts), correct_index=ci, explanation=ex, order_index=qi))
                else:
                    db.add(mx.LessonContent(lesson_id=l.id, url=url, body=body, duration_min=mins))
            t, ins, marks = spec["assignment"]
            db.add(mx.Assignment(course_id=c.id, title=t, instructions=ins, max_marks=marks, due_date=date.today() + timedelta(days=14)))
            db.commit()

        if db.query(mx.Announcement).count() == 0:
            for title, body, tag, link, days_ago in ANNOUNCEMENTS:
                db.add(mx.Announcement(title=title, body=body, tag=tag, link=link, created_at=datetime.utcnow() - timedelta(days=days_ago)))
            db.commit()
    finally:
        db.close()
