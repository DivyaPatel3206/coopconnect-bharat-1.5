"""New tables for the six extension modules. Purely additive: no existing table is altered,
so `Base.metadata.create_all` upgrades an already-deployed database safely."""
from datetime import datetime
from sqlalchemy import (Column, String, Integer, Float, DateTime, Date, ForeignKey, Text, Boolean,
                        UniqueConstraint)
from sqlalchemy.orm import relationship
from app.database import Base
from app.models import gen_id


# ---------------- 1. Profiles ----------------
class InstitutionProfile(Base):
    __tablename__ = "institution_profiles"
    id = Column(String, primary_key=True, default=gen_id)
    institution_id = Column(String, ForeignKey("institutions.id"), unique=True, nullable=False)
    address = Column(Text)
    district = Column(String)
    pincode = Column(String)
    contact_person = Column(String)
    email = Column(String)
    phone = Column(String)
    website = Column(String)
    facilities = Column(Text)
    status = Column(String, default="active")  # active / inactive


class Profile(Base):
    __tablename__ = "profiles"
    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    phone = Column(String)
    dob = Column(Date)
    gender = Column(String)  # Male / Female / Other
    address = Column(Text)
    district = Column(String)
    state = Column(String)
    pincode = Column(String)
    institution_id = Column(String, ForeignKey("institutions.id"), nullable=True)
    organisation = Column(String)  # society / PACS / employer the person works with
    designation = Column(String)
    bio = Column(Text)
    preferred_language = Column(String, default="English")
    status = Column(String, default="active")  # active / inactive / suspended
    open_to_work = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TrainingHistory(Base):
    __tablename__ = "training_history"
    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    title = Column(String, nullable=False)
    institution_name = Column(String)
    start_date = Column(Date)
    end_date = Column(Date)
    status = Column(String, default="completed")  # ongoing / completed / dropped
    grade = Column(String)


class ProfileDocument(Base):
    __tablename__ = "profile_documents"
    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    doc_type = Column(String, default="Other")
    title = Column(String, nullable=False)
    file_path = Column(String)   # stored filename (uploaded) ...
    file_url = Column(String)    # ... or an external link
    original_name = Column(String)
    verified = Column(Boolean, default=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)


# ---------------- 2. Attendance ----------------
class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"
    id = Column(String, primary_key=True, default=gen_id)
    programme_id = Column(String, ForeignKey("programmes.id"), index=True, nullable=False)
    title = Column(String, nullable=False)
    session_date = Column(Date, nullable=False, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    is_open = Column(Boolean, default=True)
    closes_at = Column(DateTime)
    created_by = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (UniqueConstraint("session_id", "user_id", name="uq_attendance_session_user"),)
    id = Column(String, primary_key=True, default=gen_id)
    session_id = Column(String, ForeignKey("attendance_sessions.id"), index=True, nullable=False)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    role = Column(String)
    check_in = Column(DateTime)
    check_out = Column(DateTime)
    method = Column(String, default="qr")  # qr / manual


# ---------------- 3. Timetable, hostel, logistics ----------------
class Venue(Base):
    __tablename__ = "venues"
    id = Column(String, primary_key=True, default=gen_id)
    institution_id = Column(String, ForeignKey("institutions.id"))
    name = Column(String, nullable=False)
    venue_type = Column(String, default="Classroom")
    capacity = Column(Integer, default=30)
    location = Column(String)
    facilities = Column(String)


class TimetableEntry(Base):
    __tablename__ = "timetable_entries"
    id = Column(String, primary_key=True, default=gen_id)
    programme_id = Column(String, ForeignKey("programmes.id"), index=True, nullable=False)
    title = Column(String, nullable=False)
    topic = Column(String)
    session_date = Column(Date, nullable=False, index=True)
    start_time = Column(String, nullable=False)  # HH:MM
    end_time = Column(String, nullable=False)
    trainer_name = Column(String)
    venue_id = Column(String, ForeignKey("venues.id"), nullable=True)
    notes = Column(Text)


class Hostel(Base):
    __tablename__ = "hostels"
    id = Column(String, primary_key=True, default=gen_id)
    institution_id = Column(String, ForeignKey("institutions.id"))
    name = Column(String, nullable=False)
    gender_type = Column(String, default="Mixed")  # Male / Female / Mixed
    address = Column(String)
    rooms = relationship("Room", back_populates="hostel", cascade="all, delete-orphan")


class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = (UniqueConstraint("hostel_id", "room_no", name="uq_room_no"),)
    id = Column(String, primary_key=True, default=gen_id)
    hostel_id = Column(String, ForeignKey("hostels.id"), nullable=False, index=True)
    room_no = Column(String, nullable=False)
    floor = Column(Integer, default=0)
    capacity = Column(Integer, default=2)
    status = Column(String, default="available")  # available / maintenance
    hostel = relationship("Hostel", back_populates="rooms")


class HostelAllocation(Base):
    __tablename__ = "hostel_allocations"
    id = Column(String, primary_key=True, default=gen_id)
    room_id = Column(String, ForeignKey("rooms.id"), index=True, nullable=False)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    programme_id = Column(String, ForeignKey("programmes.id"), nullable=True)
    check_in_date = Column(Date, nullable=False)
    check_out_date = Column(Date, nullable=False)
    status = Column(String, default="active")  # active / vacated


class LogisticsItem(Base):
    __tablename__ = "logistics_items"
    id = Column(String, primary_key=True, default=gen_id)
    programme_id = Column(String, ForeignKey("programmes.id"), index=True, nullable=False)
    kind = Column(String, default="other")  # transport / meal / equipment / other
    title = Column(String, nullable=False)
    item_date = Column(Date)
    item_time = Column(String)
    details = Column(Text)
    vendor = Column(String)
    quantity = Column(Integer)
    cost = Column(Float)
    status = Column(String, default="planned")  # planned / confirmed / done / cancelled


# ---------------- 4. Chatbot ----------------
class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    role = Column(String, nullable=False)  # user / assistant
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


# ---------------- 5. Employer ----------------
class EmployerProfile(Base):
    __tablename__ = "employer_profiles"
    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), unique=True, nullable=False)
    employer_id = Column(String, ForeignKey("employers.id"), nullable=False)  # legacy employers table
    company_name = Column(String, nullable=False)
    sector = Column(String)
    location = Column(String)
    website = Column(String)
    description = Column(Text)
    contact_phone = Column(String)
    verified = Column(Boolean, default=False)
    status = Column(String, default="active")  # active / suspended
    created_at = Column(DateTime, default=datetime.utcnow)


class JobMeta(Base):
    __tablename__ = "job_meta"
    id = Column(String, primary_key=True, default=gen_id)
    job_id = Column(String, ForeignKey("jobs.id"), unique=True, nullable=False)
    job_type = Column(String, default="Full-time")  # Full-time / Part-time / Internship / Apprenticeship / Contract
    salary_range = Column(String)
    openings = Column(Integer, default=1)
    experience = Column(String)
    deadline = Column(Date)
    status = Column(String, default="open")  # open / closed


# ---------------- 6. Learning ----------------
class ProgrammeCourse(Base):
    __tablename__ = "programme_courses"
    __table_args__ = (UniqueConstraint("programme_id", "course_id", name="uq_programme_course"),)
    id = Column(String, primary_key=True, default=gen_id)
    programme_id = Column(String, ForeignKey("programmes.id"), nullable=False)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False)


class LessonContent(Base):
    __tablename__ = "lesson_content"
    id = Column(String, primary_key=True, default=gen_id)
    lesson_id = Column(String, ForeignKey("lessons.id"), unique=True, nullable=False)
    url = Column(String)          # video / pdf / presentation link
    body = Column(Text)           # text lessons (markdown-ish) or interactive JSON
    duration_min = Column(Integer, default=5)


class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(String, primary_key=True, default=gen_id)
    lesson_id = Column(String, ForeignKey("lessons.id"), unique=True, nullable=False)
    title = Column(String, default="Quiz")
    pass_percent = Column(Integer, default=60)


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"
    id = Column(String, primary_key=True, default=gen_id)
    quiz_id = Column(String, ForeignKey("quizzes.id"), nullable=False, index=True)
    prompt = Column(Text, nullable=False)
    options = Column(Text, nullable=False)  # JSON list of strings
    correct_index = Column(Integer, nullable=False)
    explanation = Column(Text)
    order_index = Column(Integer, default=0)


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    id = Column(String, primary_key=True, default=gen_id)
    quiz_id = Column(String, ForeignKey("quizzes.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    score_percent = Column(Integer, default=0)
    passed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class LessonProgress(Base):
    __tablename__ = "lesson_progress"
    __table_args__ = (UniqueConstraint("user_id", "lesson_id", name="uq_lesson_progress"),)
    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    lesson_id = Column(String, ForeignKey("lessons.id"), nullable=False)
    completed_at = Column(DateTime, default=datetime.utcnow)


class Assignment(Base):
    __tablename__ = "assignments"
    id = Column(String, primary_key=True, default=gen_id)
    course_id = Column(String, ForeignKey("courses.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    instructions = Column(Text)
    due_date = Column(Date)
    max_marks = Column(Integer, default=100)


class AssignmentSubmission(Base):
    __tablename__ = "assignment_submissions"
    __table_args__ = (UniqueConstraint("assignment_id", "user_id", name="uq_submission"),)
    id = Column(String, primary_key=True, default=gen_id)
    assignment_id = Column(String, ForeignKey("assignments.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text)
    link = Column(String)
    status = Column(String, default="submitted")  # submitted / graded
    marks = Column(Integer)
    feedback = Column(Text)
    submitted_at = Column(DateTime, default=datetime.utcnow)


# ---------------- Calendar & notifications ----------------
class CalendarLink(Base):
    """Maps a timetable entry to the Google Calendar event created for it."""
    __tablename__ = "calendar_links"
    id = Column(String, primary_key=True, default=gen_id)
    entry_id = Column(String, unique=True, index=True, nullable=False)  # deliberately no FK: survives entry deletion
    google_event_id = Column(String, nullable=False)
    synced_at = Column(DateTime, default=datetime.utcnow)


class NotificationLog(Base):
    __tablename__ = "notification_logs"
    id = Column(String, primary_key=True, default=gen_id)
    entry_id = Column(String, index=True)
    kind = Column(String)  # created / updated / cancelled / reminder / test
    recipients = Column(Integer, default=0)
    status = Column(String, default="sent")  # sent / failed / skipped
    detail = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


# ---------------- Catalogue metadata & announcements ----------------
class CourseMeta(Base):
    __tablename__ = "course_meta"
    id = Column(String, primary_key=True, default=gen_id)
    course_id = Column(String, ForeignKey("courses.id"), unique=True, nullable=False)
    category = Column(String)
    level = Column(String, default="Beginner")  # Beginner / Intermediate / Advanced
    duration_hours = Column(Float)
    instructor = Column(String)
    institution_name = Column(String)


class Announcement(Base):
    __tablename__ = "announcements"
    id = Column(String, primary_key=True, default=gen_id)
    title = Column(String, nullable=False)
    body = Column(Text)
    tag = Column(String, default="Update")  # Programme / Platform / Employment / Update
    link = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
