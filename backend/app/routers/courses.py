from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, security

router = APIRouter(prefix="/api/courses", tags=["courses"])


@router.get("", response_model=List[schemas.CourseOut])
def list_courses(db: Session = Depends(get_db)):
    return db.query(models.Course).all()


@router.get("/{course_id}", response_model=schemas.CourseOut)
def get_course(course_id: str, db: Session = Depends(get_db)):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.get("/mine/enrollments", response_model=List[schemas.EnrollmentOut])
def my_enrollments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    return (
        db.query(models.Enrollment)
        .filter(models.Enrollment.user_id == current_user.id)
        .all()
    )


@router.post("/progress", response_model=schemas.EnrollmentOut)
def update_progress(
    payload: schemas.ProgressUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    course = db.query(models.Course).filter(models.Course.id == payload.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    enrollment = (
        db.query(models.Enrollment)
        .filter(
            models.Enrollment.user_id == current_user.id,
            models.Enrollment.course_id == payload.course_id,
        )
        .first()
    )
    if not enrollment:
        enrollment = models.Enrollment(user_id=current_user.id, course_id=payload.course_id)
        db.add(enrollment)

    enrollment.progress_percent = max(0.0, min(100.0, payload.progress_percent))
    just_completed = enrollment.progress_percent >= 100 and not enrollment.completed
    enrollment.completed = enrollment.progress_percent >= 100
    db.commit()
    db.refresh(enrollment)

    # Auto-issue a certificate the first time a course is completed.
    if just_completed:
        cert = models.Certificate(
            user_id=current_user.id,
            programme_name=course.title,
            institution_name="CoopConnect Bharat Digital Learning",
            skill=course.skill_tag,
        )
        db.add(cert)
        db.commit()

    return enrollment
