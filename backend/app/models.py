import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Float, DateTime, ForeignKey, Enum, Text, Boolean
)
from sqlalchemy.orm import relationship
from app.database import Base


def gen_id():
    return str(uuid.uuid4())


class RoleEnum(str, enum.Enum):
    super_admin = "super_admin"
    institution_admin = "institution_admin"
    trainer = "trainer"
    trainee = "trainee"
    employer = "employer"
    career_counselor = "career_counselor"


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.trainee)
    location = Column(String, nullable=True)
    education = Column(String, nullable=True)
    career_interests = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    registrations = relationship("Registration", back_populates="user")
    certificates = relationship("Certificate", back_populates="user")
    enrollments = relationship("Enrollment", back_populates="user")
    job_applications = relationship("JobApplication", back_populates="user")
    user_skills = relationship("UserSkill", back_populates="user")


class Institution(Base):
    __tablename__ = "institutions"
    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    type = Column(String, default="RICM")  # VAMNICOM / RICM / ICM
    state = Column(String, nullable=True)

    programmes = relationship("Programme", back_populates="institution")


class Programme(Base):
    __tablename__ = "programmes"
    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    institution_id = Column(String, ForeignKey("institutions.id"))
    trainer_name = Column(String, nullable=True)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    capacity = Column(Integer, default=30)
    location = Column(String, nullable=True)
    mode = Column(String, default="Classroom")  # Classroom / Online / Hybrid
    description = Column(Text, nullable=True)

    institution = relationship("Institution", back_populates="programmes")
    registrations = relationship("Registration", back_populates="programme")


class RegistrationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    completed = "completed"


class Registration(Base):
    __tablename__ = "registrations"
    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"))
    programme_id = Column(String, ForeignKey("programmes.id"))
    status = Column(Enum(RegistrationStatus), default=RegistrationStatus.pending)
    registered_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="registrations")
    programme = relationship("Programme", back_populates="registrations")


class Course(Base):
    __tablename__ = "courses"
    id = Column(String, primary_key=True, default=gen_id)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    skill_tag = Column(String, nullable=True)
    language = Column(String, default="English")

    lessons = relationship("Lesson", back_populates="course")


class Lesson(Base):
    __tablename__ = "lessons"
    id = Column(String, primary_key=True, default=gen_id)
    course_id = Column(String, ForeignKey("courses.id"))
    title = Column(String, nullable=False)
    content_type = Column(String, default="video")  # video / pdf / quiz
    order_index = Column(Integer, default=0)

    course = relationship("Course", back_populates="lessons")


class Enrollment(Base):
    __tablename__ = "enrollments"
    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"))
    course_id = Column(String, ForeignKey("courses.id"))
    progress_percent = Column(Float, default=0.0)
    completed = Column(Boolean, default=False)

    user = relationship("User", back_populates="enrollments")
    course = relationship("Course")


class Certificate(Base):
    __tablename__ = "certificates"
    id = Column(String, primary_key=True, default=gen_id)
    verification_id = Column(String, unique=True, index=True, default=lambda: uuid.uuid4().hex[:10].upper())
    user_id = Column(String, ForeignKey("users.id"))
    programme_name = Column(String, nullable=False)
    institution_name = Column(String, nullable=True)
    skill = Column(String, nullable=True)
    issued_date = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="certificates")


class UserSkill(Base):
    __tablename__ = "user_skills"
    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, ForeignKey("users.id"))
    skill_name = Column(String, nullable=False)
    level_percent = Column(Integer, default=50)

    user = relationship("User", back_populates="user_skills")


class Employer(Base):
    __tablename__ = "employers"
    id = Column(String, primary_key=True, default=gen_id)
    company_name = Column(String, nullable=False)
    sector = Column(String, nullable=True)
    location = Column(String, nullable=True)

    jobs = relationship("Job", back_populates="employer")


class Job(Base):
    __tablename__ = "jobs"
    id = Column(String, primary_key=True, default=gen_id)
    employer_id = Column(String, ForeignKey("employers.id"))
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    required_skills = Column(String, nullable=True)  # comma-separated
    location = Column(String, nullable=True)
    posted_at = Column(DateTime, default=datetime.utcnow)

    employer = relationship("Employer", back_populates="jobs")
    applications = relationship("JobApplication", back_populates="job")


class JobApplication(Base):
    __tablename__ = "job_applications"
    id = Column(String, primary_key=True, default=gen_id)
    job_id = Column(String, ForeignKey("jobs.id"))
    user_id = Column(String, ForeignKey("users.id"))
    status = Column(String, default="applied")  # applied / shortlisted / rejected
    match_score = Column(Integer, default=0)
    applied_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job", back_populates="applications")
    user = relationship("User", back_populates="job_applications")
