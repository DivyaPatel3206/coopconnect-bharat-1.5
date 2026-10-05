from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr


# ---------- Auth ----------
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "trainee"
    location: Optional[str] = None


class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    location: Optional[str] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ---------- Programmes ----------
class ProgrammeOut(BaseModel):
    id: str
    name: str
    category: Optional[str]
    trainer_name: Optional[str]
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    capacity: int
    location: Optional[str]
    mode: str
    description: Optional[str]
    institution_name: Optional[str] = None

    class Config:
        from_attributes = True


class RegistrationOut(BaseModel):
    id: str
    programme_id: str
    status: str
    registered_at: datetime

    class Config:
        from_attributes = True


# ---------- Courses ----------
class LessonOut(BaseModel):
    id: str
    title: str
    content_type: str
    order_index: int

    class Config:
        from_attributes = True


class CourseOut(BaseModel):
    id: str
    title: str
    description: Optional[str]
    skill_tag: Optional[str]
    language: str
    lessons: List[LessonOut] = []

    class Config:
        from_attributes = True


class EnrollmentOut(BaseModel):
    id: str
    course_id: str
    progress_percent: float
    completed: bool

    class Config:
        from_attributes = True


class ProgressUpdate(BaseModel):
    course_id: str
    progress_percent: float


# ---------- Certificates ----------
class CertificateOut(BaseModel):
    id: str
    verification_id: str
    programme_name: str
    institution_name: Optional[str]
    skill: Optional[str]
    issued_date: datetime

    class Config:
        from_attributes = True


class CertificateVerifyResult(BaseModel):
    verified: bool
    programme_name: Optional[str] = None
    institution_name: Optional[str] = None
    skill: Optional[str] = None
    issued_date: Optional[datetime] = None
    holder_name: Optional[str] = None


# ---------- Jobs ----------
class JobOut(BaseModel):
    id: str
    title: str
    description: Optional[str]
    required_skills: Optional[str]
    location: Optional[str]
    company_name: Optional[str] = None
    match_score: Optional[int] = None

    class Config:
        from_attributes = True


class JobApplicationOut(BaseModel):
    id: str
    job_id: str
    status: str
    match_score: int

    class Config:
        from_attributes = True


# ---------- Analytics ----------
class NationalAnalytics(BaseModel):
    total_trainees: int
    total_programmes: int
    total_certificates: int
    total_jobs: int
    completion_rate: float
    employment_linked: int
