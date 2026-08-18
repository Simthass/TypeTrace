from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_student
from app.db.database import get_db
from app.models.course import Course, CourseStudent
from app.models.user import User
from app.schemas.responses import (
    EnrolledCoursesResponse,
    JoinCourseResponse,
    StudentCourseDetailResponse,
    StudentCourseManagementResponse,
)
from app.services.notifications import dispatch_notification


router = APIRouter()


class JoinCourseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    invite_code: str = Field(min_length=3, max_length=30)

    @field_validator("invite_code")
    @classmethod
    def normalize_invite_code(cls, value: str) -> str:
        return value.strip().upper()


def _format_datetime(value: Any) -> str:
    if value is None:
        return "Unknown"

    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    return str(value)


def _classification_bucket(classification: Optional[str]) -> str:
    normalized = str(classification or "UNKNOWN").upper()

    if normalized == "HUMAN":
        return "HUMAN"
    if normalized == "SUSPICIOUS":
        return "SUSPICIOUS"
    if normalized in {"SYNTHETIC", "AI", "AI-GENERATED"}:
        return "SYNTHETIC"
    return "UNKNOWN"


def _review_outcome(review_status: Optional[str]) -> str:
    normalized = str(review_status or "PENDING").upper()

    if normalized == "APPROVED":
        return "Accepted by teacher"
    if normalized == "FLAGGED":
        return "Flagged for academic review"
    if normalized == "NEEDS_DISCUSSION":
        return "Discussion requested"
    return "Awaiting teacher review"


def _risk_level(classification: Optional[str], risk_level: Optional[str]) -> str:
    if risk_level:
        return str(risk_level).upper()

    bucket = _classification_bucket(classification)
    if bucket == "SYNTHETIC":
        return "HIGH"
    if bucket == "SUSPICIOUS":
        return "MEDIUM"
    return "LOW"


def _course_payload(course: Course) -> Dict[str, Any]:
    return {
        "id": course.id,
        "course_name": course.course_name,
        "course_code": course.course_code,
    }


def _managed_course_payload(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": int(row.get("id") or 0),
        "course_name": row.get("course_name") or "Untitled Course",
        "course_code": row.get("course_code") or "",
        "is_archived": bool(row.get("is_archived")),
        "created_at": _format_datetime(row.get("created_at")),
        "joined_at": _format_datetime(row.get("joined_at")),
        "teacher_name": (
            f"{row.get('teacher_first_name') or ''} {row.get('teacher_last_name') or ''}"
        ).strip()
        or "Instructor",
        "teacher_university_name": row.get("teacher_university_name"),
        "teacher_department": row.get("teacher_department"),
        "submission_count": int(row.get("submission_count") or 0),
        "approved_count": int(row.get("approved_count") or 0),
        "pending_count": int(row.get("pending_count") or 0),
        "flagged_count": int(row.get("flagged_count") or 0),
        "discussion_count": int(row.get("discussion_count") or 0),
        "feedback_count": int(row.get("feedback_count") or 0),
        "certificate_count": int(row.get("certificate_count") or 0),
        "avg_confidence": round(float(row.get("avg_confidence") or 0), 1),
        "avg_wpm": round(float(row.get("avg_wpm") or 0), 1),
        "last_submission_at": _format_datetime(row.get("last_submission_at")),
    }


def _student_course_session_payload(row: Dict[str, Any]) -> Dict[str, Any]:
    classification = row.get("classification") or "UNKNOWN"

    return {
        "id": int(row.get("id") or 0),
        "title": row.get("title") or "Untitled Document",
        "classification": classification,
        "classification_bucket": _classification_bucket(classification),
        "confidence": round(float(row.get("confidence") or 0), 2),
        "risk_level": _risk_level(classification, row.get("risk_level")),
        "review_status": row.get("review_status") or "PENDING",
        "review_outcome": _review_outcome(row.get("review_status")),
        "review_notes": row.get("review_notes") or "",
        "wpm": round(float(row.get("wpm") or 0), 1),
        "duration_seconds": round(float(row.get("duration_seconds") or 0), 1),
        "total_keystrokes": int(row.get("total_keystrokes") or 0),
        "deletions": int(row.get("deletions") or 0),
        "pauses": int(row.get("pauses") or 0),
        "avg_iki": round(float(row.get("avg_iki") or 0), 1),
        "word_count": int(row.get("word_count") or 0),
        "certificate_id": row.get("certificate_id"),
        "document_hash": row.get("document_hash"),
        "created_at": _format_datetime(row.get("created_at")),
        "review_saved_at": _format_datetime(row.get("review_saved_at")),
    }


@router.post("/courses/join", status_code=status.HTTP_200_OK, response_model=JoinCourseResponse)
async def join_course(
    payload: JoinCourseRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    """
    Allows a student to join a teacher-created course using an invite code.
    """

    invite_code = payload.invite_code

    result = await db.execute(
        select(Course)
        .where(
            Course.invite_code == invite_code,
            Course.invite_enabled.is_(True),
            Course.is_archived.is_(False),
        )
        .with_for_update()
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


@router.get("/courses/enrolled", response_model=EnrolledCoursesResponse)
async def get_enrolled_courses(
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns active courses joined by the current student for new submissions.
    """

    result = await db.execute(
        select(Course)
        .join(CourseStudent, CourseStudent.course_id == Course.id)
        .where(
            CourseStudent.student_id == str(current_user.id),
            Course.is_archived.is_(False),
        )
        .order_by(Course.created_at.desc())
    )

    courses: List[Course] = list(result.scalars().all())

    return {
        "status": "success",
        "courses": [_course_payload(course) for course in courses],
    }


@router.get("/courses/manage", response_model=StudentCourseManagementResponse)
async def get_student_course_management(
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    """Returns every course enrollment with the student's course-level activity summary."""

    student_id = str(current_user.id)
    rows = (
        await db.execute(
            text(
                """
                SELECT
                    c.id,
                    c.course_name,
                    c.course_code,
                    c.is_archived,
                    c.created_at,
                    cs.joined_at,
                    teacher.first_name AS teacher_first_name,
                    teacher.last_name AS teacher_last_name,
                    teacher.university_name AS teacher_university_name,
                    teacher.department AS teacher_department,
                    COUNT(ts.id) AS submission_count,
                    COUNT(CASE WHEN ts.review_status = 'APPROVED' THEN 1 END) AS approved_count,
                    COUNT(CASE WHEN COALESCE(ts.review_status, 'PENDING') = 'PENDING' THEN 1 END) AS pending_count,
                    COUNT(CASE WHEN ts.review_status = 'FLAGGED' THEN 1 END) AS flagged_count,
                    COUNT(CASE WHEN ts.review_status = 'NEEDS_DISCUSSION' THEN 1 END) AS discussion_count,
                    COUNT(CASE WHEN NULLIF(TRIM(COALESCE(ts.review_notes, '')), '') IS NOT NULL THEN 1 END) AS feedback_count,
                    COUNT(CASE WHEN ts.certificate_id IS NOT NULL THEN 1 END) AS certificate_count,
                    COALESCE(ROUND(AVG(ts.ml_confidence_score)::numeric, 1), 0) AS avg_confidence,
                    COALESCE(ROUND(AVG(ts.wpm)::numeric, 1), 0) AS avg_wpm,
                    MAX(ts.created_at) AS last_submission_at
                FROM course_students cs
                JOIN courses c ON c.id = cs.course_id
                JOIN users teacher ON teacher.id = c.teacher_id
                LEFT JOIN typing_sessions ts
                    ON ts.course_id = c.id
                    AND ts.user_id = cs.student_id
                WHERE cs.student_id = :student_id
                GROUP BY
                    c.id,
                    c.course_name,
                    c.course_code,
                    c.is_archived,
                    c.created_at,
                    cs.joined_at,
                    teacher.first_name,
                    teacher.last_name,
                    teacher.university_name,
                    teacher.department
                ORDER BY c.is_archived ASC, cs.joined_at DESC
                """
            ),
            {"student_id": student_id},
        )
    ).mappings().all()

    return {
        "status": "success",
        "courses": [_managed_course_payload(dict(row)) for row in rows],
    }


@router.get("/courses/manage/{course_id}", response_model=StudentCourseDetailResponse)
async def get_student_course_detail(
    course_id: int,
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    """Returns one enrolled course together with this student's submissions and teacher feedback."""

    student_id = str(current_user.id)
    course_row = (
        await db.execute(
            text(
                """
                SELECT
                    c.id,
                    c.course_name,
                    c.course_code,
                    c.is_archived,
                    c.created_at,
                    cs.joined_at,
                    teacher.first_name AS teacher_first_name,
                    teacher.last_name AS teacher_last_name,
                    teacher.university_name AS teacher_university_name,
                    teacher.department AS teacher_department,
                    COUNT(ts.id) AS submission_count,
                    COUNT(CASE WHEN ts.review_status = 'APPROVED' THEN 1 END) AS approved_count,
                    COUNT(CASE WHEN COALESCE(ts.review_status, 'PENDING') = 'PENDING' THEN 1 END) AS pending_count,
                    COUNT(CASE WHEN ts.review_status = 'FLAGGED' THEN 1 END) AS flagged_count,
                    COUNT(CASE WHEN ts.review_status = 'NEEDS_DISCUSSION' THEN 1 END) AS discussion_count,
                    COUNT(CASE WHEN NULLIF(TRIM(COALESCE(ts.review_notes, '')), '') IS NOT NULL THEN 1 END) AS feedback_count,
                    COUNT(CASE WHEN ts.certificate_id IS NOT NULL THEN 1 END) AS certificate_count,
                    COALESCE(ROUND(AVG(ts.ml_confidence_score)::numeric, 1), 0) AS avg_confidence,
                    COALESCE(ROUND(AVG(ts.wpm)::numeric, 1), 0) AS avg_wpm,
                    MAX(ts.created_at) AS last_submission_at
                FROM course_students cs
                JOIN courses c ON c.id = cs.course_id
                JOIN users teacher ON teacher.id = c.teacher_id
                LEFT JOIN typing_sessions ts
                    ON ts.course_id = c.id
                    AND ts.user_id = cs.student_id
                WHERE cs.student_id = :student_id
                  AND c.id = :course_id
                GROUP BY
                    c.id,
                    c.course_name,
                    c.course_code,
                    c.is_archived,
                    c.created_at,
                    cs.joined_at,
                    teacher.first_name,
                    teacher.last_name,
                    teacher.university_name,
                    teacher.department
                LIMIT 1
                """
            ),
            {"student_id": student_id, "course_id": course_id},
        )
    ).mappings().first()

    if course_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found or you are not enrolled in this course.",
        )

    session_rows = (
        await db.execute(
            text(
                """
                SELECT
                    ts.id,
                    ts.title,
                    ts.classification_result AS classification,
                    ts.ml_confidence_score AS confidence,
                    ts.risk_level,
                    ts.review_status,
                    ts.review_notes,
                    ts.wpm,
                    ts.duration_seconds,
                    ts.total_keystrokes,
                    ts.deletions,
                    ts.pauses,
                    ts.avg_iki,
                    ts.word_count,
                    ts.certificate_id,
                    ts.document_hash,
                    ts.created_at,
                    ts.updated_at AS review_saved_at
                FROM typing_sessions ts
                WHERE ts.user_id = :student_id
                  AND ts.course_id = :course_id
                ORDER BY ts.created_at DESC
                """
            ),
            {"student_id": student_id, "course_id": course_id},
        )
    ).mappings().all()

    course = _managed_course_payload(dict(course_row))

    return {
        "status": "success",
        "course": course,
        "summary": {
            "submission_count": course["submission_count"],
            "approved_count": course["approved_count"],
            "pending_count": course["pending_count"],
            "flagged_count": course["flagged_count"],
            "discussion_count": course["discussion_count"],
            "feedback_count": course["feedback_count"],
            "certificate_count": course["certificate_count"],
            "avg_confidence": course["avg_confidence"],
            "avg_wpm": course["avg_wpm"],
        },
        "sessions": [
            _student_course_session_payload(dict(row)) for row in session_rows
        ],
    }
