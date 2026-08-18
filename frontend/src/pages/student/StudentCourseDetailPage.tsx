import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, getApiErrorMessage } from "../../lib/api";
import { API_ROUTES } from "../../constants/apiRoutes";
import { ROUTES } from "../../constants/routes";
import { colors } from "../../styles/colors";
import { Button, ButtonLink } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { classificationTone } from "../../components/ui/badgeTone";
import { EmptyState, ErrorState } from "../../components/ui/AsyncState";
import { LoadingState, PageHeader } from "../../components/ui/PageState";
import {
  AppSurface,
  InternalIcon,
  MetricTile,
  StatusPill,
} from "../../components/internal/InternalShell";
import { useCertificateDownload } from "../../hooks/useCertificateDownload";
import { formatEvidenceScore } from "../../lib/evidenceScore";
import type {
  StudentCourseDetailResponse,
  StudentCourseSession,
} from "../../types/student";

function formatDate(value: string) {
  if (!value || value === "Unknown") return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDuration(seconds: number) {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function reviewTone(
  status: string,
): "neutral" | "human" | "suspicious" | "danger" {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "APPROVED") return "human";
  if (normalized === "FLAGGED") return "danger";
  if (normalized === "PENDING" || normalized === "NEEDS_DISCUSSION")
    return "suspicious";
  return "neutral";
}

function SubmissionCard({
  session,
  onDownload,
  downloadingId,
}: {
  session: StudentCourseSession;
  onDownload: (certificateId: string) => void;
  downloadingId: string | null;
}) {
  return (
    <AppSurface className="overflow-hidden">
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={classificationTone(session.classification_bucket)}>
              {session.classification_bucket === "SUSPICIOUS"
                ? "REVIEW REQUIRED"
                : session.classification_bucket}
            </Badge>
            <Badge tone={reviewTone(session.review_status)}>
              {session.review_outcome}
            </Badge>
          </div>
          <h3
            className="mt-3 text-[16px] font-bold"
            style={{ color: colors.text.primary }}
          >
            {session.title}
          </h3>
          <p className="mt-1 text-[11px]" style={{ color: colors.text.muted }}>
            Submitted {formatDate(session.created_at)} · {session.word_count}{" "}
            words · {formatDuration(session.duration_seconds)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ButtonLink
            to={ROUTES.SESSION_DETAIL.replace(":sessionId", String(session.id))}
            variant="secondary"
            size="sm"
          >
            Details
          </ButtonLink>
          <ButtonLink
            to={ROUTES.REPLAY.replace(":sessionId", String(session.id))}
            variant="secondary"
            size="sm"
            leftIcon={<InternalIcon name="replay" size={14} />}
          >
            Replay
          </ButtonLink>
          {session.certificate_id && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onDownload(session.certificate_id as string)}
              disabled={downloadingId === session.certificate_id}
              leftIcon={<InternalIcon name="download" size={14} />}
            >
              {downloadingId === session.certificate_id
                ? "Downloading..."
                : "PDF"}
            </Button>
          )}
        </div>
      </div>

      <div
        className="grid grid-cols-2 gap-px border-y sm:grid-cols-4"
        style={{
          background: colors.surface[200],
          borderColor: colors.surface[200],
        }}
      >
        {[
          ["Human evidence", `${formatEvidenceScore(session.confidence)}%`],
          ["WPM", session.wpm],
          ["Keystrokes", session.total_keystrokes],
          ["Risk", session.risk_level],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="p-3"
            style={{ background: colors.surface[50] }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: colors.text.muted }}
            >
              {label}
            </p>
            <p
              className="mt-1 text-[13px] font-bold"
              style={{ color: colors.text.primary }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="p-5">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{ color: colors.text.muted }}
        >
          Teacher feedback
        </p>
        {session.review_notes ? (
          <div
            className="mt-2 rounded-md border px-4 py-3 text-[13px] leading-6"
            style={{
              background: colors.surface[100],
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          >
            {session.review_notes}
          </div>
        ) : (
          <p
            className="mt-2 text-[12px] italic"
            style={{ color: colors.text.muted }}
          >
            No written feedback has been added to this submission yet.
          </p>
        )}
      </div>
    </AppSurface>
  );
}

export default function StudentCourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [data, setData] = useState<StudentCourseDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { downloadCertificate, downloadingId } = useCertificateDownload();

  useEffect(() => {
    let mounted = true;

    async function loadCourse() {
      if (!courseId) {
        if (mounted) {
          setError("Course not found.");
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const response = await api.get<StudentCourseDetailResponse>(
          API_ROUTES.courses.detail(courseId),
        );
        if (mounted) setData(response.data);
      } catch (err) {
        if (mounted) setError(getApiErrorMessage(err));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadCourse();
    return () => {
      mounted = false;
    };
  }, [courseId]);

  if (isLoading) return <LoadingState label="Loading course workspace..." />;

  if (error || !data) {
    return (
      <ErrorState
        title="Could not load course"
        message={error || "Course not found."}
        action={
          <ButtonLink to={ROUTES.STUDENT_COURSES} variant="secondary">
            Back to Course Management
          </ButtonLink>
        }
      />
    );
  }

  const { course, summary, sessions } = data;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8">
      <div>
        <Link
          to={ROUTES.STUDENT_COURSES}
          className="inline-flex items-center gap-2 text-[12px] font-semibold"
          style={{ color: colors.text.secondary }}
        >
          ← Course Management
        </Link>
      </div>

      <PageHeader
        eyebrow={course.course_code}
        title={course.course_name}
        description="Review your enrollment details, every submission linked to this course, certificate status, review outcomes, and written feedback from your instructor."
        action={
          !course.is_archived ? (
            <ButtonLink
              to={ROUTES.EDITOR_NEW}
              leftIcon={<InternalIcon name="editor" size={16} />}
            >
              New writing session
            </ButtonLink>
          ) : (
            <StatusPill label="Archived course" tone="neutral" />
          )
        }
      />

      <AppSurface className="p-5">
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                label={course.is_archived ? "Archived" : "Active"}
                tone={course.is_archived ? "neutral" : "good"}
              />
              <span
                className="text-[11px] font-medium"
                style={{ color: colors.text.muted }}
              >
                Joined {formatDate(course.joined_at)}
              </span>
            </div>
            <h2
              className="mt-4 text-[14px] font-bold"
              style={{ color: colors.text.primary }}
            >
              Instructor
            </h2>
            <p
              className="mt-1 text-[14px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              {course.teacher_name}
            </p>
            <p
              className="mt-1 text-[12px]"
              style={{ color: colors.text.secondary }}
            >
              {[course.teacher_department, course.teacher_university_name]
                .filter(Boolean)
                .join(" · ") || "Instructor details not provided"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-md border p-3"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[100],
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: colors.text.muted }}
              >
                Course created
              </p>
              <p
                className="mt-1 text-[12px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                {formatDate(course.created_at)}
              </p>
            </div>
            <div
              className="rounded-md border p-3"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[100],
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: colors.text.muted }}
              >
                Last submission
              </p>
              <p
                className="mt-1 text-[12px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                {formatDate(course.last_submission_at)}
              </p>
            </div>
          </div>
        </div>
      </AppSurface>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          icon="document"
          label="Submissions"
          value={summary.submission_count}
          detail="Your sessions linked to this course"
        />
        <MetricTile
          icon="review"
          label="Feedback received"
          value={summary.feedback_count}
          detail="Submissions with written teacher notes"
        />
        <MetricTile
          icon="check"
          label="Approved"
          value={summary.approved_count}
          detail={`${summary.pending_count + summary.discussion_count} awaiting follow-up`}
        />
        <MetricTile
          icon="certificate"
          label="Certificates"
          value={summary.certificate_count}
          detail={`${Math.round(summary.avg_confidence)}% avg. evidence score`}
        />
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <h2
            className="text-[18px] font-bold tracking-[-0.025em]"
            style={{ color: colors.text.primary }}
          >
            Submitted sessions
          </h2>
          <p
            className="mt-1 text-[12px]"
            style={{ color: colors.text.secondary }}
          >
            All writing sessions you submitted to this course, including teacher
            review status and feedback.
          </p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          title="No course submissions yet"
          message={
            course.is_archived
              ? "This archived course does not contain any submissions from your account."
              : "Start a writing session and select this course before submitting to create your first course-linked evidence record."
          }
          action={
            !course.is_archived ? (
              <ButtonLink to={ROUTES.EDITOR_NEW}>
                Start a writing session
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <SubmissionCard
              key={session.id}
              session={session}
              onDownload={downloadCertificate}
              downloadingId={downloadingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
