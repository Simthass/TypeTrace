
from typing import Any, Dict, List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_student
from app.db.database import get_db
from app.models.course import Course, CourseStudent
from app.models.user import User
from app.services.notifications import dispatch_notification


router = APIRouter()


class JoinCourseRequest(BaseModel):
    invite_code: str = Field(min_length=3, max_length=30)


def _course_payload(course: Course) -> Dict[str, Any]:
    return {
        "id": course.id,
        "course_name": course.course_name,
        "course_code": course.course_code,
        "invite_code": course.invite_code,
    }


@router.post("/courses/join", status_code=status.HTTP_200_OK)
async def join_course(
    payload: JoinCourseRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    """
    Allows a student to join a teacher-created course using an invite code.
    """

    invite_code = payload.invite_code.strip().upper()

    result = await db.execute(
        select(Course).where(Course.invite_code == invite_code)
    )
    course = result.scalars().first()

    if course is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid course invite code.",
        )

    existing = await db.execute(
        select(CourseStudent.id).where(
            CourseStudent.course_id == course.id,
            CourseStudent.student_id == str(current_user.id),
        )
    )

    if existing.scalar_one_or_none() is not None:
        return {
            "status": "success",
            "message": "You are already enrolled in this course.",
            "course": _course_payload(course),
        }

    enrollment = CourseStudent(
        course_id=course.id,
        student_id=str(current_user.id),
    )

    db.add(enrollment)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already enrolled in this course.",
        )

    background_tasks.add_task(
        dispatch_notification,
        recipient_id=course.teacher_id,
        actor_id=str(current_user.id),
        event_type="COURSE_JOINED",
        entity_type="course",
        entity_id=str(course.id),
        title="New Student Joined",
        body=f"{current_user.first_name} {current_user.last_name} joined {course.course_name}.",
        action_url=f"/teacher/courses/{course.id}",
    )

    return {
        "status": "success",
        "message": "Course joined successfully.",
        "course": _course_payload(course),
    }


@router.get("/courses/enrolled")
async def get_enrolled_courses(
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns courses joined by the current student.
    """

    result = await db.execute(
        select(Course)
        .join(CourseStudent, CourseStudent.course_id == Course.id)
        .where(CourseStudent.student_id == str(current_user.id))
        .order_by(Course.created_at.desc())
    )

    courses: List[Course] = list(result.scalars().all())

    return {
        "status": "success",
        "courses": [_course_payload(course) for course in courses],
    }