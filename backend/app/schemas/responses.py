from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


CertificatePublicStatus = Literal[
    "NOT_FOUND",
    "VALID",
    "REVIEW_REQUIRED",
    "REVOKED",
    "INVALID_SIGNATURE",
    "LEGACY_UNSIGNED",
]


class StrictResponseModel(BaseModel):
    model_config = ConfigDict(extra="forbid", protected_namespaces=())


class CertificateAuditEvent(StrictResponseModel):
    label: str
    status: str
    timestamp: str | None = None
    description: str


class PublicExposure(StrictResponseModel):
    essay_text_exposed: bool = False
    raw_keystrokes_exposed: bool = False
    student_private_notes_exposed: bool = False


class PublicCertificateResponse(StrictResponseModel):
    record_found: bool
    ledger_verified: bool
    certificate_active: bool
    valid: bool
    status: CertificatePublicStatus
    certificate_id: str
    reason: str | None = None
    verify_url: str | None = None
    title: str | None = None
    student_name: str | None = None
    student_id: str | None = None
    university_name: str | None = None
    course_name: str | None = None
    course_code: str | None = None
    word_count: int | None = None
    wpm: float | None = None
    duration_seconds: float | None = None
    classification: str | None = None
    classification_label: str | None = None
    confidence: float | None = None
    human_evidence_score: float | None = None
    risk_level: str | None = None
    review_status: str | None = None
    review_outcome: str | None = None
    document_hash: str | None = None
    evidence_hash: str | None = None
    created_at: str | None = None
    generated_at: str | None = None
    ledger_status: str | None = None
    signature_algorithm: str | None = None
    signing_key_id: str | None = None
    signed_at: str | None = None
    signed_payload_hash: str | None = None
    signature_status: str | None = None
    signature_valid: bool = False
    payload_hash_matches: bool = False
    ledger_reason: str | None = None
    revoked_at: str | None = None
    revocation_reason: str | None = None
    decision_source: str | None = None
    model_available: bool | None = None
    degraded_analysis: bool | None = None
    audit_timeline: list[CertificateAuditEvent] = Field(default_factory=list)
    public_exposure: PublicExposure = Field(default_factory=PublicExposure)
    privacy_notice: str | None = None
    session_id: int | None = None
    total_keystrokes: int | None = None
    deletions: int | None = None
    pauses: int | None = None
    avg_iki: float | None = None
    department: str | None = None
    verification_notes: str | None = None


class CertificateListItem(StrictResponseModel):
    session_id: int
    title: str
    wpm: float
    duration_seconds: float
    classification: str
    confidence: float
    created_at: str
    certificate_id: str
    document_hash: str | None = None
    risk_level: str
    review_status: str
    review_outcome: str
    course_name: str | None = None
    course_code: str | None = None
    verify_url: str
    status: CertificatePublicStatus
    certificate_active: bool
    degraded_analysis: bool
    decision_source: str | None = None


class CertificateListResponse(StrictResponseModel):
    status: Literal["success"] = "success"
    certificates: list[CertificateListItem]


class CertificateRevocationResponse(StrictResponseModel):
    status: Literal["success"] = "success"
    message: str
    already_revoked: bool
    certificate: PublicCertificateResponse


class MessageResponse(StrictResponseModel):
    status: str = "success"
    message: str


class GenericCollectionResponse(BaseModel):
    """Typed top-level contract for existing heterogeneous dashboard payloads.

    The application is being migrated incrementally from large raw-SQL handlers.
    Unknown top-level keys remain rejected only after each endpoint receives a
    dedicated schema. This model is intentionally not used for security-sensitive
    endpoints.
    """

    model_config = ConfigDict(extra="allow")
    status: str | None = None


class SensitiveExportRequest(StrictResponseModel):
    current_password: str = Field(min_length=8, max_length=128)
    confirmation: Literal["EXPORT"]


class AccountExportResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    exported_at: str
    user: dict[str, Any]
    sessions: list[dict[str, Any]]
    certificates: list[dict[str, Any]]
    enrolled_courses: list[dict[str, Any]]
    owned_courses: list[dict[str, Any]]


class StudentDashboardResponse(StrictResponseModel):
    status: Literal["success"]
    student: dict[str, Any]
    summary: dict[str, Any]
    recent_sessions: list[dict[str, Any]]
    trend: list[dict[str, Any]]
    courses: list[dict[str, Any]]


class StudentSessionsResponse(StrictResponseModel):
    status: Literal["success"]
    total: int
    limit: int
    offset: int
    sessions: list[dict[str, Any]]


class StudentSessionDetailResponse(StrictResponseModel):
    status: Literal["success"]
    session: dict[str, Any]


class StudentAnalyticsResponse(StrictResponseModel):
    status: Literal["success"]
    daily: list[dict[str, Any]]
    courses: list[dict[str, Any]]
    bests: dict[str, Any]


class TeacherDashboardResponse(StrictResponseModel):
    status: Literal["success"]
    teacher: dict[str, Any]
    summary: dict[str, Any]
    recent_submissions: list[dict[str, Any]]
    courses: list[dict[str, Any]]


class TeacherSubmissionsResponse(StrictResponseModel):
    status: Literal["success"]
    total: int
    limit: int
    offset: int
    sessions: list[dict[str, Any]]


class TeacherSubmissionDetailResponse(StrictResponseModel):
    status: Literal["success"]
    session: dict[str, Any]
    privacy_notice: str


class ReplayResponse(StrictResponseModel):
    status: Literal["success"]
    session: dict[str, Any]
    metrics: dict[str, Any]
    events: list[dict[str, Any]]
    timeline_markers: list[dict[str, Any]]
    audit: dict[str, Any]


class DraftSnapshotResponse(StrictResponseModel):
    id: str
    backend_draft_id: str
    draft_id: str
    local_draft_id: str
    title: str
    text_content: str
    course_id: int | None = None
    keystroke_array: list[dict[str, Any]]
    active_duration_ms: int
    started_at: int | None = None
    last_activity_at: int | None = None
    paused_at: int | None = None
    version: int
    lifecycle_status: str
    sync_status: str
    save_reason: str
    created_at: int | None = None
    updated_at: int | None = None


class DraftConflictDetails(StrictResponseModel):
    server_draft: DraftSnapshotResponse


class DraftListResponse(StrictResponseModel):
    status: Literal["success"]
    drafts: list[DraftSnapshotResponse]


class DraftResponse(StrictResponseModel):
    status: Literal["success"]
    draft: DraftSnapshotResponse


class NotificationListResponse(StrictResponseModel):
    status: Literal["success"]
    notifications: list[dict[str, Any]]


class UnreadCountResponse(StrictResponseModel):
    status: Literal["success"]
    unread_count: int


class StatusOnlyResponse(StrictResponseModel):
    status: Literal["success"]


class UserDataExportResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["success"]
    exported_at: str
    privacy: dict[str, Any]
    profile: dict[str, Any]
    summary: dict[str, Any]
    sessions: list[dict[str, Any]]
    certificates: list[dict[str, Any]]
    enrolled_courses: list[dict[str, Any]]
    owned_courses: list[dict[str, Any]]

class CourseSummary(StrictResponseModel):
    id: int
    course_name: str
    course_code: str


class JoinCourseResponse(StrictResponseModel):
    status: Literal["success"]
    message: str
    course: CourseSummary


class EnrolledCoursesResponse(StrictResponseModel):
    status: Literal["success"]
    courses: list[CourseSummary]


class StudentCourseManagementResponse(StrictResponseModel):
    status: Literal["success"]
    courses: list[dict[str, Any]]


class StudentCourseDetailResponse(StrictResponseModel):
    status: Literal["success"]
    course: dict[str, Any]
    summary: dict[str, Any]
    sessions: list[dict[str, Any]]


class TeacherCourseCreateResponse(StrictResponseModel):
    status: Literal["success"]
    message: str
    course: dict[str, Any]


class TeacherCourseListResponse(StrictResponseModel):
    status: Literal["success"]
    courses: list[dict[str, Any]]


class TeacherCourseDetailResponse(StrictResponseModel):
    status: Literal["success"]
    course: dict[str, Any]
    students: list[dict[str, Any]]
    submissions: list[dict[str, Any]]


class TeacherStudentsResponse(StrictResponseModel):
    status: Literal["success"]
    students: list[dict[str, Any]]


class TeacherReviewResponse(StrictResponseModel):
    status: Literal["success"]
    message: str
    review_status: str
    review_notes: str
    review_saved_at: str
    review_changed: bool
    notification_created: bool


class UserProfileResponse(StrictResponseModel):
    status: Literal["success"]
    message: str | None = None
    profile: dict[str, Any] | None = None
    summary: dict[str, Any] | None = None
    privacy: dict[str, Any] | None = None


class HealthResponse(StrictResponseModel):
    status: Literal["ok"]
    service: str


class ModelStatusResponse(BaseModel):
    model_config = ConfigDict(extra="allow", protected_namespaces=())
    status: str | None = None
    model_available: bool = False
    model_name: str | None = None
    model_version: str | None = None
    feature_family: str | None = None
    feature_count: int | None = None
    decision_note: str | None = None


class ModelMetricsResponse(ModelStatusResponse):
    trained_at: Any = None
    metrics: dict[str, Any] = Field(default_factory=dict)


class ModelFeaturesResponse(StrictResponseModel):
    status: str | None = None
    model_available: bool = False
    feature_family: str | None = None
    feature_count: int | None = None
    feature_columns: list[str] = Field(default_factory=list)
