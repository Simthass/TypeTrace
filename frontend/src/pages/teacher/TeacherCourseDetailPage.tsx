import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { api, getApiErrorMessage } from "../../lib/api";
import { brand, colors } from "../../styles/colors";
import { ErrorState, EmptyState } from "../../components/ui/AsyncState";
import { useToast } from "../../components/ui/ToastContext";
import { API_ROUTES } from "../../constants/apiRoutes";
import type {
  TeacherClassificationBucket,
  TeacherCourseDetailResponse,
  TeacherSubmission,
} from "../../types/teacher";
import { formatEvidenceScore } from "../../lib/evidenceScore";

type CourseView = "submissions" | "students";

type CourseStudent = TeacherCourseDetailResponse["students"][number];

function Icon({ type, size = 16 }: { type: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    arrowLeft: (
      <>
        <path d="M19 12H5" />
        <path d="m11 18-6-6 6-6" />
      </>
    ),
    copy: (
      <>
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
    submissions: (
      <>
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M3 6h.01" />
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
        <path d="M16 3.1a4 4 0 0 1 0 7.8" />
      </>
    ),
    review: (
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </>
    ),
    alert: (
      <>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    replay: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
        <path d="M12 7v5l3 3" />
      </>
    ),
    certificate: (
      <>
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v6h6" />
        <path d="m9 15 2 2 4-5" />
      </>
    ),
    course: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
      </>
    ),
    arrowRight: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[type] ?? null}
    </svg>
  );
}

function cardShadow() {
  return `0 1px 3px ${colors.shadow}`;
}

function safeNumber(value: number | string | null | undefined): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function progress(value: number, total: number): number {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function formatShortDate(value?: string): string {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusStyle(value?: string) {
  const normalized = String(value || "UNKNOWN").toUpperCase();

  if (
    normalized === "HUMAN" ||
    normalized === "APPROVED" ||
    normalized === "LOW"
  ) {
    return {
      background: brand.humanBg,
      color: brand.humanText,
      borderColor: brand.humanAccent,
      label:
        normalized === "HUMAN"
          ? "Human"
          : normalized === "LOW"
            ? "Low risk"
            : "Approved",
    };
  }

  if (
    normalized === "SUSPICIOUS" ||
    normalized === "PENDING" ||
    normalized === "MEDIUM"
  ) {
    return {
      background: brand.suspiciousBg,
      color: brand.suspiciousText,
      borderColor: brand.suspiciousAccent,
      label:
        normalized === "SUSPICIOUS"
          ? "Review"
          : normalized === "MEDIUM"
            ? "Medium"
            : "Pending",
    };
  }

  if (
    ["SYNTHETIC", "AI", "AI-GENERATED", "HIGH", "FLAGGED"].includes(normalized)
  ) {
    return {
      background: brand.aiBg,
      color: brand.aiText,
      borderColor: brand.aiAccent,
      label: normalized === "FLAGGED" ? "Flagged" : "High risk",
    };
  }

  return {
    background: colors.surface[100],
    color: colors.text.secondary,
    borderColor: colors.surface[200],
    label: normalized.replaceAll("_", " "),
  };
}

function StatusBadge({ value }: { value?: string }) {
  const style = statusStyle(value);
  return (
    <span
      className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
      style={{
        background: style.background,
        color: style.color,
        borderColor: style.borderColor,
      }}
    >
      {style.label}
    </span>
  );
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-md border ${className}`}
      style={{
        background: colors.surface[50],
        borderColor: colors.surface[200],
        boxShadow: cardShadow(),
      }}
    >
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: string | number;
  description: string;
  icon: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: colors.text.muted }}
          >
            {label}
          </p>
          <p
            className="mt-2 text-[25px] font-bold tracking-[-0.04em] tabular-nums"
            style={{ color: colors.text.primary }}
          >
            {value}
          </p>
        </div>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md"
          style={{ background: colors.brandSoft, color: colors.brand }}
        >
          <Icon type={icon} size={16} />
        </div>
      </div>
      <p
        className="mt-1 text-[11px] leading-5"
        style={{ color: colors.text.secondary }}
      >
        {description}
      </p>
    </Card>
  );
}

function InlineLoader() {
  return (
    <div className="space-y-5">
      <div
        className="fixed left-0 top-0 z-50 h-0.5 w-full animate-pulse"
        style={{ background: colors.brand }}
      />
      <div
        className="h-7 w-72 animate-pulse rounded-md"
        style={{ background: colors.surface[200] }}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-md border"
            style={{
              background: colors.surface[50],
              borderColor: colors.surface[200],
            }}
          />
        ))}
      </div>
      <div
        className="h-[440px] animate-pulse rounded-md border"
        style={{
          background: colors.surface[50],
          borderColor: colors.surface[200],
        }}
      />
    </div>
  );
}

function classificationBucket(
  value: TeacherClassificationBucket | string,
): string {
  return String(value || "UNKNOWN").toUpperCase();
}

export default function TeacherCourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { showToast } = useToast();

  const [data, setData] = useState<TeacherCourseDetailResponse | null>(null);
  const [view, setView] = useState<CourseView>("submissions");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadCourse() {
      if (!courseId) {
        setApiError("Course ID is missing.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setApiError(null);

      try {
        const response = await api.get<TeacherCourseDetailResponse>(
          API_ROUTES.teacher.courseDetail(courseId),
        );
        if (!mounted) return;
        setData(response.data);
      } catch (error) {
        if (!mounted) return;
        const message = getApiErrorMessage(error);
        setApiError(message);
        showToast({
          type: "error",
          title: "Failed to load course",
          message,
        });
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadCourse();

    return () => {
      mounted = false;
    };
  }, [courseId, showToast]);

  const stats = useMemo(() => {
    const course = data?.course;
    const submissions = data?.submissions || [];
    const human = submissions.filter(
      (item) => classificationBucket(item.classification_bucket) === "HUMAN",
    ).length;
    const review = submissions.filter(
      (item) =>
        classificationBucket(item.classification_bucket) === "SUSPICIOUS",
    ).length;
    const highRisk = submissions.filter(
      (item) =>
        classificationBucket(item.classification_bucket) === "SYNTHETIC",
    ).length;
    const certified = submissions.filter((item) =>
      Boolean(item.certificate_id),
    ).length;
    const reviewCompletion = course?.submission_count
      ? progress(
          safeNumber(course.approved_count) + safeNumber(course.flagged_count),
          safeNumber(course.submission_count),
        )
      : 0;

    return { human, review, highRisk, certified, reviewCompletion };
  }, [data]);

  const nextSubmission = useMemo(() => {
    const submissions = data?.submissions || [];
    return (
      submissions.find(
        (item) =>
          String(item.review_status || "PENDING").toUpperCase() === "PENDING",
      ) || submissions[0]
    );
  }, [data]);

  const copyInvite = async () => {
    if (!data?.course.invite_code) return;
    await navigator.clipboard.writeText(data.course.invite_code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  if (isLoading) return <InlineLoader />;

  if (apiError || !data) {
    return (
      <ErrorState
        title="Could not load course"
        message={apiError || "Course data was not available."}
        action={
          <Link
            to={ROUTES.TEACHER_COURSES}
            className="rounded-md px-4 py-2 text-[13px] font-semibold"
            style={{ background: colors.brand, color: colors.text.light }}
          >
            Back to courses
          </Link>
        }
      />
    );
  }

  const { course, students, submissions } = data;

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            to={ROUTES.TEACHER_COURSES}
            className="inline-flex items-center gap-2 text-[12px] font-bold"
            style={{ color: colors.text.secondary }}
          >
            <Icon type="arrowLeft" size={14} />
            Back to courses
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="rounded-md border px-2 py-1 font-mono text-[11px] font-bold"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.secondary,
              }}
            >
              {course.course_code}
            </span>
            <StatusBadge
              value={course.pending_count > 0 ? "PENDING" : "APPROVED"}
            />
          </div>
          <h1
            className="mt-2 text-[28px] font-bold tracking-[-0.04em]"
            style={{ color: colors.text.primary }}
          >
            {course.course_name}
          </h1>
          <p
            className="mt-1 max-w-3xl text-[13px] leading-6"
            style={{ color: colors.text.secondary }}
          >
            Course workspace for enrollment, roster inspection, submission
            review, and behavioral evidence decisions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyInvite}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-[12px] font-bold"
            style={{
              background: colors.surface[50],
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          >
            <Icon type="copy" size={14} />
            {copied ? "Copied" : course.invite_code}
          </button>
          {nextSubmission && (
            <Link
              to={ROUTES.TEACHER_REVIEW.replace(
                ":sessionId",
                String(nextSubmission.id),
              )}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-[12px] font-bold"
              style={{ background: colors.brand, color: colors.text.light }}
            >
              Review next
              <Icon type="arrowRight" size={13} />
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Students"
          value={course.student_count}
          description="Students enrolled through the invite code"
          icon="users"
        />
        <MetricCard
          label="Submissions"
          value={course.submission_count}
          description="Writing evidence records linked to this course"
          icon="submissions"
        />
        <MetricCard
          label="Pending"
          value={course.pending_count}
          description="Sessions awaiting teacher decision"
          icon="review"
        />
        <MetricCard
          label="Avg confidence"
          value={`${Math.round(course.avg_confidence || 0)}%`}
          description="Mean model confidence for this course"
          icon="shield"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2
                  className="text-[14px] font-bold"
                  style={{ color: colors.text.primary }}
                >
                  Course workspace
                </h2>
                <p
                  className="text-[11px]"
                  style={{ color: colors.text.secondary }}
                >
                  Switch between submission review and enrolled student roster.
                </p>
              </div>
              <div
                className="flex w-fit rounded-md border p-1"
                style={{
                  background: colors.surface[100],
                  borderColor: colors.surface[200],
                }}
              >
                {[
                  ["submissions", "Submissions"],
                  ["students", "Students"],
                ].map(([value, label]) => {
                  const active = view === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setView(value as CourseView)}
                      className="h-8 rounded-md px-3 text-[12px] font-bold"
                      style={{
                        background: active ? colors.surface[50] : "transparent",
                        color: active
                          ? colors.text.primary
                          : colors.text.secondary,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {view === "submissions" ? (
            <Card className="overflow-hidden">
              <div
                className="flex items-center justify-between gap-3 border-b px-4 py-3"
                style={{ borderColor: colors.surface[200] }}
              >
                <div>
                  <h2
                    className="text-[14px] font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    Course submissions
                  </h2>
                  <p
                    className="text-[11px]"
                    style={{ color: colors.text.secondary }}
                  >
                    Student writing evidence records submitted to this course.
                  </p>
                </div>
                <span
                  className="text-[11px] font-semibold tabular-nums"
                  style={{ color: colors.text.muted }}
                >
                  {submissions.length} records
                </span>
              </div>

              {submissions.length === 0 ? (
                <EmptyState
                  title="No submissions yet"
                  message="Students will appear here after they attach a writing session to this course."
                />
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[980px]">
                    <div
                      className="grid grid-cols-[minmax(260px,1.2fr)_170px_130px_160px_190px] items-center gap-4 border-b px-4 py-2.5"
                      style={{
                        background: colors.surface[100],
                        borderColor: colors.surface[200],
                      }}
                    >
                      {[
                        "Submission",
                        "Student",
                        "Outcome",
                        "Review",
                        "Actions",
                      ].map((heading) => (
                        <div
                          key={heading}
                          className="text-[10px] font-bold uppercase tracking-[0.14em]"
                          style={{ color: colors.text.muted }}
                        >
                          {heading}
                        </div>
                      ))}
                    </div>

                    {submissions.map((submission: TeacherSubmission) => (
                      <div
                        key={submission.id}
                        className="grid min-h-[72px] grid-cols-[minmax(260px,1.2fr)_170px_130px_160px_190px] items-center gap-4 border-b px-4 py-3 hover:bg-surface-100"
                        style={{ borderColor: colors.surface[200] }}
                      >
                        <div className="min-w-0">
                          <p
                            className="truncate text-[13px] font-bold"
                            style={{ color: colors.text.primary }}
                          >
                            {submission.title || "Untitled submission"}
                          </p>
                          <p
                            className="mt-1 text-[11px]"
                            style={{ color: colors.text.secondary }}
                          >
                            {formatShortDate(submission.created_at)} ·{" "}
                            {submission.word_count || 0} words ·{" "}
                            {Math.round(safeNumber(submission.wpm))} WPM
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p
                            className="truncate text-[12px] font-semibold"
                            style={{ color: colors.text.primary }}
                          >
                            {submission.student_name}
                          </p>
                          <p
                            className="truncate font-mono text-[11px]"
                            style={{ color: colors.text.muted }}
                          >
                            {submission.student_id}
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <StatusBadge
                            value={submission.classification_bucket}
                          />
                          <span
                            className="block font-mono text-[11px] font-bold"
                            style={{ color: colors.text.secondary }}
                          >
                            {formatEvidenceScore(submission.confidence)}%
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <StatusBadge
                            value={submission.review_status || "PENDING"}
                          />
                          <p
                            className="text-[10px]"
                            style={{ color: colors.text.muted }}
                          >
                            {submission.certificate_id
                              ? "Certificate ready"
                              : "No certificate"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Link
                            to={ROUTES.TEACHER_REVIEW.replace(
                              ":sessionId",
                              String(submission.id),
                            )}
                            className="inline-flex h-7 items-center justify-center rounded-md px-2.5 text-[11px] font-bold"
                            style={{
                              background: colors.brand,
                              color: colors.text.light,
                            }}
                          >
                            Review
                          </Link>
                          <Link
                            to={ROUTES.REPLAY.replace(
                              ":sessionId",
                              String(submission.id),
                            )}
                            className="inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-[11px] font-bold"
                            style={{
                              background: colors.surface[50],
                              borderColor: colors.surface[200],
                              color: colors.text.secondary,
                            }}
                          >
                            Replay
                          </Link>
                          {submission.certificate_id && (
                            <Link
                              to={ROUTES.VERIFY.replace(
                                ":certId",
                                submission.certificate_id,
                              )}
                              className="inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-[11px] font-bold"
                              style={{
                                background: colors.surface[50],
                                borderColor: colors.surface[200],
                                color: colors.text.secondary,
                              }}
                            >
                              Verify
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div
                className="flex items-center justify-between gap-3 border-b px-4 py-3"
                style={{ borderColor: colors.surface[200] }}
              >
                <div>
                  <h2
                    className="text-[14px] font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    Enrolled students
                  </h2>
                  <p
                    className="text-[11px]"
                    style={{ color: colors.text.secondary }}
                  >
                    Roster with submission activity and writing evidence
                    quality.
                  </p>
                </div>
                <span
                  className="text-[11px] font-semibold tabular-nums"
                  style={{ color: colors.text.muted }}
                >
                  {students.length} students
                </span>
              </div>

              {students.length === 0 ? (
                <EmptyState
                  title="No enrolled students"
                  message="Share the invite code so students can join this course."
                />
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[900px]">
                    <div
                      className="grid grid-cols-[minmax(260px,1.2fr)_130px_140px_140px_170px] items-center gap-4 border-b px-4 py-2.5"
                      style={{
                        background: colors.surface[100],
                        borderColor: colors.surface[200],
                      }}
                    >
                      {[
                        "Student",
                        "Submissions",
                        "Avg WPM",
                        "Human score",
                        "Last activity",
                      ].map((heading) => (
                        <div
                          key={heading}
                          className="text-[10px] font-bold uppercase tracking-[0.14em]"
                          style={{ color: colors.text.muted }}
                        >
                          {heading}
                        </div>
                      ))}
                    </div>

                    {students.map((student: CourseStudent) => (
                      <div
                        key={student.id}
                        className="grid min-h-[68px] grid-cols-[minmax(260px,1.2fr)_130px_140px_140px_170px] items-center gap-4 border-b px-4 py-3 hover:bg-surface-100"
                        style={{ borderColor: colors.surface[200] }}
                      >
                        <div className="min-w-0">
                          <p
                            className="truncate text-[13px] font-bold"
                            style={{ color: colors.text.primary }}
                          >
                            {student.student_name}
                          </p>
                          <p
                            className="truncate text-[11px]"
                            style={{ color: colors.text.secondary }}
                          >
                            {student.email}
                          </p>
                          <p
                            className="truncate font-mono text-[10px]"
                            style={{ color: colors.text.muted }}
                          >
                            {student.student_id || "No student ID"}
                          </p>
                        </div>
                        <p
                          className="font-mono text-[13px] font-bold tabular-nums"
                          style={{ color: colors.text.primary }}
                        >
                          {student.submission_count}
                        </p>
                        <p
                          className="font-mono text-[13px] font-bold tabular-nums"
                          style={{ color: colors.text.primary }}
                        >
                          {Math.round(safeNumber(student.avg_wpm))}
                        </p>
                        <p
                          className="font-mono text-[13px] font-bold tabular-nums"
                          style={{ color: colors.text.primary }}
                        >
                          {Math.round(safeNumber(student.avg_confidence))}%
                        </p>
                        <p
                          className="text-[12px]"
                          style={{ color: colors.text.secondary }}
                        >
                          {student.last_submission_at || "No submission"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card className="p-4">
            <h2
              className="text-[14px] font-bold"
              style={{ color: colors.text.primary }}
            >
              Enrollment setup
            </h2>
            <p
              className="mt-1 text-[11px] leading-5"
              style={{ color: colors.text.secondary }}
            >
              Share this course invite code with students. Only enrolled
              students can attach sessions to this course.
            </p>
            <div
              className="mt-4 rounded-md border p-3"
              style={{
                background: colors.surface[100],
                borderColor: colors.surface[200],
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: colors.text.muted }}
              >
                Invite code
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className="flex-1 rounded-md border px-3 py-2 font-mono text-[14px] font-bold"
                  style={{
                    background: colors.surface[50],
                    borderColor: colors.surface[200],
                    color: colors.text.primary,
                  }}
                >
                  {course.invite_code}
                </span>
                <button
                  type="button"
                  onClick={copyInvite}
                  className="flex h-9 w-9 items-center justify-center rounded-md border"
                  style={{
                    background: colors.surface[50],
                    borderColor: colors.surface[200],
                    color: colors.text.secondary,
                  }}
                >
                  <Icon type="copy" size={14} />
                </button>
              </div>
              {copied && (
                <p
                  className="mt-2 text-[11px] font-bold"
                  style={{ color: colors.brand }}
                >
                  Invite code copied
                </p>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h2
              className="text-[14px] font-bold"
              style={{ color: colors.text.primary }}
            >
              Review workflow
            </h2>
            <div className="mt-4 space-y-3">
              {[
                ["Approved", course.approved_count, brand.humanText],
                ["Pending", course.pending_count, brand.suspiciousText],
                ["Flagged", course.flagged_count, brand.aiText],
              ].map(([label, value, color]) => {
                const share = progress(
                  Number(value),
                  Math.max(course.submission_count, 1),
                );
                return (
                  <div key={String(label)}>
                    <div className="flex items-center justify-between text-[12px]">
                      <span
                        className="font-semibold"
                        style={{ color: String(color) }}
                      >
                        {label}
                      </span>
                      <span
                        className="font-bold tabular-nums"
                        style={{ color: colors.text.primary }}
                      >
                        {value} · {share}%
                      </span>
                    </div>
                    <div
                      className="mt-1.5 h-1.5 rounded-md"
                      style={{ background: colors.surface[200] }}
                    >
                      <div
                        className="h-1.5 rounded-md"
                        style={{
                          background: String(color),
                          width: `${share}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              className="mt-4 rounded-md border p-3"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[100],
              }}
            >
              <p
                className="text-[11px]"
                style={{ color: colors.text.secondary }}
              >
                Review completion
              </p>
              <p
                className="mt-1 text-[22px] font-bold tabular-nums"
                style={{ color: colors.text.primary }}
              >
                {stats.reviewCompletion}%
              </p>
            </div>
          </Card>

          <Card className="p-4">
            <h2
              className="text-[14px] font-bold"
              style={{ color: colors.text.primary }}
            >
              Evidence outcomes
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ["Human", stats.human, "shield"],
                ["Review", stats.review, "review"],
                ["High risk", stats.highRisk, "alert"],
                ["Certified", stats.certified, "certificate"],
              ].map(([label, value, icon]) => (
                <div
                  key={String(label)}
                  className="rounded-md border p-3"
                  style={{ borderColor: colors.surface[200] }}
                >
                  <div className="flex items-center gap-2">
                    <Icon type={String(icon)} size={13} />
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: colors.text.secondary }}
                    >
                      {label}
                    </span>
                  </div>
                  <p
                    className="mt-2 font-mono text-[16px] font-bold tabular-nums"
                    style={{ color: colors.text.primary }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
