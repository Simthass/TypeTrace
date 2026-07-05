import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, getApiErrorMessage } from "../../lib/api";
import { ROUTES } from "../../constants/routes";
import { brand, colors } from "../../styles/colors";
import { LoadingState, ErrorState } from "../../components/ui/AsyncState";
import { useToast } from "../../components/ui/ToastProvider";
import type {
  TeacherSubmission,
  TeacherSubmissionDetailResponse,
  TeacherReviewStatus,
} from "../../types/teacher";
import { API_ROUTES } from "../../constants/apiRoutes";

type BadgeTone = "human" | "review" | "risk" | "neutral" | "brand";

type ReviewOption = {
  status: TeacherReviewStatus;
  title: string;
  description: string;
  tone: BadgeTone;
};

const reviewOptions: ReviewOption[] = [
  {
    status: "PENDING",
    title: "Keep pending",
    description: "More context or student discussion is still required.",
    tone: "review",
  },
  {
    status: "APPROVED",
    title: "Approve evidence",
    description: "The captured process is acceptable for this submission.",
    tone: "human",
  },
  {
    status: "NEEDS_DISCUSSION",
    title: "Needs student discussion",
    description:
      "The record should be discussed with the student before a final decision.",
    tone: "brand",
  },
  {
    status: "FLAGGED",
    title: "Flag for academic review",
    description: "The evidence should be escalated for formal review.",
    tone: "risk",
  },
];

function Icon({ type, size = 16 }: { type: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    arrowLeft: (
      <>
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </>
    ),
    arrowRight: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    document: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
        <path d="M10 9H8" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    alert: (
      <>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    keyboard: (
      <>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12" />
      </>
    ),
    activity: <path d="M3 12h4l2-7 4 14 2-7h6" />,
    hash: (
      <>
        <path d="M4 9h16" />
        <path d="M4 15h16" />
        <path d="M10 3 8 21" />
        <path d="M16 3l-2 18" />
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
        <circle cx="12" cy="8" r="6" />
        <path d="M9 13.5 7 22l5-3 5 3-2-8.5" />
      </>
    ),
    user: (
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    course: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
      </>
    ),
    check: <path d="M20 6 9 17l-5-5" />,
    save: (
      <>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <path d="M17 21v-8H7v8" />
        <path d="M7 3v5h8" />
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

function formatDuration(seconds: number | string | null | undefined): string {
  const total = Math.max(0, Math.round(safeNumber(seconds)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatDate(value?: string): string {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getBadgeStyle(tone: BadgeTone) {
  if (tone === "human") {
    return {
      background: brand.humanBg,
      color: brand.humanText,
      borderColor: brand.humanAccent,
    };
  }

  if (tone === "review") {
    return {
      background: brand.suspiciousBg,
      color: brand.suspiciousText,
      borderColor: brand.suspiciousAccent,
    };
  }

  if (tone === "risk") {
    return {
      background: brand.aiBg,
      color: brand.aiText,
      borderColor: brand.aiAccent,
    };
  }

  if (tone === "brand") {
    return {
      background: colors.brandSoft,
      color: colors.brand,
      borderColor: colors.brand,
    };
  }

  return {
    background: colors.surface[100],
    color: colors.text.secondary,
    borderColor: colors.surface[200],
  };
}

function classificationTone(submission: TeacherSubmission): BadgeTone {
  if (submission.classification_bucket === "HUMAN") return "human";
  if (submission.classification_bucket === "SUSPICIOUS") return "review";
  if (submission.classification_bucket === "SYNTHETIC") return "risk";
  return "neutral";
}

function reviewTone(status: string | undefined): BadgeTone {
  const normalized = String(status || "PENDING").toUpperCase();
  if (normalized === "APPROVED") return "human";
  if (normalized === "FLAGGED") return "risk";
  if (normalized === "NEEDS_DISCUSSION") return "brand";
  return "review";
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span
      className="inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
      style={getBadgeStyle(tone)}
    >
      {children}
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

function MetricTile({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: colors.text.muted }}
          >
            {label}
          </p>
          <p
            className="mt-2 truncate text-[23px] font-bold tracking-[-0.04em] tabular-nums"
            style={{ color: colors.text.primary }}
          >
            {value || "-"}
          </p>
        </div>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          style={{ background: colors.brandSoft, color: colors.brand }}
        >
          <Icon type={icon} size={16} />
        </div>
      </div>
      <p
        className="mt-1 text-[11px] leading-5"
        style={{ color: colors.text.secondary }}
      >
        {detail}
      </p>
    </Card>
  );
}

function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      className="flex items-start justify-between gap-4 border-b py-3 last:border-b-0"
      style={{ borderColor: colors.surface[200] }}
    >
      <span
        className="text-[11px] font-bold uppercase tracking-[0.12em]"
        style={{ color: colors.text.muted }}
      >
        {label}
      </span>
      <span
        className="max-w-[68%] text-right text-[13px] font-semibold"
        style={{ color: colors.text.primary }}
      >
        {value || "-"}
      </span>
    </div>
  );
}

function ReviewOptionButton({
  option,
  selected,
  onSelect,
}: {
  option: ReviewOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const toneStyle = getBadgeStyle(option.tone);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-md border p-3 text-left transition-colors hover:bg-surface-100"
      style={{
        background: selected ? toneStyle.background : colors.surface[50],
        borderColor: selected ? toneStyle.borderColor : colors.surface[200],
        color: selected ? toneStyle.color : colors.text.primary,
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border"
          style={{
            background: selected ? toneStyle.color : colors.surface[50],
            borderColor: selected ? toneStyle.color : colors.surface[200],
            color: selected ? colors.text.light : colors.text.muted,
          }}
        >
          {selected && <Icon type="check" size={12} />}
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-bold">{option.title}</span>
          <span
            className="mt-0.5 block text-[11px] leading-5"
            style={{
              color: selected ? toneStyle.color : colors.text.secondary,
            }}
          >
            {option.description}
          </span>
        </span>
      </div>
    </button>
  );
}

export default function TeacherReviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [submission, setSubmission] = useState<TeacherSubmission | null>(null);
  const [reviewStatus, setReviewStatus] =
    useState<TeacherReviewStatus>("PENDING");
  const [reviewNotes, setReviewNotes] = useState("");
  const [savedReviewStatus, setSavedReviewStatus] =
    useState<TeacherReviewStatus>("PENDING");
  const [savedReviewNotes, setSavedReviewNotes] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSubmission() {
      if (!sessionId) {
        setApiError("Submission ID is missing.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setApiError(null);

      try {
        const response = await api.get<TeacherSubmissionDetailResponse>(
          API_ROUTES.teacher.sessionDetail(sessionId),
        );
        if (!mounted) return;

        setSubmission(response.data.session);
        setReviewStatus(
          (response.data.session.review_status ||
            "PENDING") as TeacherReviewStatus,
        );
        setReviewNotes(response.data.session.review_notes || "");
        setSavedReviewStatus(
          (response.data.session.review_status ||
            "PENDING") as TeacherReviewStatus,
        );
        setSavedReviewNotes(response.data.session.review_notes || "");
        setLastSavedAt(response.data.session.review_saved_at || null);
      } catch (error) {
        if (!mounted) return;
        const message = getApiErrorMessage(error);
        setApiError(message);
        showToast({
          type: "error",
          title: "Failed to load submission",
          message,
        });
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void loadSubmission();

    return () => {
      mounted = false;
    };
  }, [sessionId, showToast]);

  const saveReview = async (status: TeacherReviewStatus) => {
    if (!sessionId || isSaving) return;

    setIsSaving(true);
    setApiError(null);

    try {
      const response = await api.patch(
        API_ROUTES.teacher.sessionReview(sessionId),
        {
          status,
          notes: reviewNotes.trim(),
        },
      );

      const nextStatus = response.data?.review_status || status;
      const nextNotes = response.data?.review_notes ?? reviewNotes.trim();

      setReviewStatus(nextStatus as TeacherReviewStatus);
      setReviewNotes(nextNotes);
      setSavedReviewStatus(nextStatus as TeacherReviewStatus);
      setSavedReviewNotes(nextNotes);
      setLastSavedAt(
        response.data?.review_saved_at || new Date().toISOString(),
      );

      setSubmission((current) =>
        current
          ? {
              ...current,
              review_status: nextStatus,
              review_notes: nextNotes,
            }
          : current,
      );

      showToast({
        type: "success",
        title: "Review saved",
        message: "Your teacher decision has been recorded.",
      });
    } catch (error) {
      const message = getApiErrorMessage(error);
      showToast({
        type: "error",
        title: "Failed to save review",
        message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasUnsavedReviewChanges =
    reviewStatus !== savedReviewStatus ||
    reviewNotes.trim() !== savedReviewNotes.trim();

  const reviewSaveStateLabel = isSaving
    ? "Saving decision..."
    : hasUnsavedReviewChanges
      ? "Unsaved changes"
      : lastSavedAt
        ? `Saved ${formatDate(lastSavedAt)}`
        : "No saved decision yet";

  const evidenceSummary = useMemo(() => {
    if (!submission) return [];

    return [
      ["Words", submission.word_count],
      ["Keystrokes", submission.total_keystrokes],
      ["Deletions", submission.deletions],
      ["Pauses", submission.pauses],
      ["Average IKI", `${Math.round(safeNumber(submission.avg_iki))}ms`],
      ["Duration", formatDuration(submission.duration_seconds)],
    ];
  }, [submission]);

  if (isLoading) {
    return (
      <LoadingState
        title="Loading submission"
        message="Retrieving the teacher review dossier."
      />
    );
  }

  if (apiError) {
    return (
      <ErrorState
        title="Could not load submission"
        message={apiError}
        action={
          <Link
            to={ROUTES.TEACHER_SUBMISSIONS}
            className="rounded-md px-4 py-2 text-[13px] font-semibold"
            style={{ background: colors.brand, color: colors.text.light }}
          >
            Back to submissions
          </Link>
        }
      />
    );
  }

  if (!submission) {
    return (
      <ErrorState
        title="Submission not found"
        message="This submission could not be found. It may have been removed."
        action={
          <Link
            to={ROUTES.TEACHER_SUBMISSIONS}
            className="rounded-md px-4 py-2 text-[13px] font-semibold"
            style={{ background: colors.brand, color: colors.text.light }}
          >
            Back to submissions
          </Link>
        }
      />
    );
  }

  const classificationLabel =
    submission.classification_bucket === "HUMAN"
      ? "Human pattern"
      : submission.classification_bucket === "SUSPICIOUS"
        ? "Needs review"
        : submission.classification_bucket === "SYNTHETIC"
          ? "High risk"
          : "Unknown";

  const confidence = Math.max(
    0,
    Math.min(100, Math.round(safeNumber(submission.confidence))),
  );
  const selectedReviewOption =
    reviewOptions.find((option) => option.status === reviewStatus) ||
    reviewOptions[0];

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            to={ROUTES.TEACHER_SUBMISSIONS}
            className="inline-flex items-center gap-2 text-[12px] font-bold"
            style={{ color: colors.brand }}
          >
            <Icon type="arrowLeft" size={14} />
            Back to submission queue
          </Link>
          <p
            className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: colors.text.muted }}
          >
            Teacher review dossier
          </p>
          <h1
            className="mt-1 max-w-4xl text-[26px] font-bold tracking-[-0.04em]"
            style={{ color: colors.text.primary }}
          >
            {submission.title || "Untitled submission"}
          </h1>
          <p
            className="mt-1 max-w-3xl text-[13px] leading-6"
            style={{ color: colors.text.secondary }}
          >
            Review the student, course, captured behavior, certificate state,
            and document content before recording a decision.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={classificationTone(submission)}>
            {classificationLabel}
          </Badge>
          <Badge tone={reviewTone(reviewStatus)}>
            {String(reviewStatus).replace("_", " ")}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Confidence"
          value={`${confidence}%`}
          detail="Model confidence for this evidence record"
          icon="shield"
        />
        <MetricTile
          label="Risk level"
          value={submission.risk_level || "Unknown"}
          detail="Risk category saved with the submission"
          icon="alert"
        />
        <MetricTile
          label="Writing speed"
          value={`${Math.round(safeNumber(submission.wpm))} WPM`}
          detail="Average writing speed during capture"
          icon="keyboard"
        />
        <MetricTile
          label="Submitted"
          value={formatDate(submission.created_at)}
          detail="Time the writing session entered review"
          icon="clock"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div
              className="border-b p-5"
              style={{ borderColor: colors.surface[200] }}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2
                    className="text-[16px] font-bold tracking-[-0.03em]"
                    style={{ color: colors.text.primary }}
                  >
                    Submission record
                  </h2>
                  <p
                    className="mt-1 text-[12px] leading-5"
                    style={{ color: colors.text.secondary }}
                  >
                    Core LMS metadata for the learner, module, and review state.
                  </p>
                </div>
                <span
                  className="rounded-md border px-2.5 py-1 font-mono text-[11px] font-bold"
                  style={{
                    background: colors.surface[100],
                    borderColor: colors.surface[200],
                    color: colors.text.primary,
                  }}
                >
                  Session #{submission.id}
                </span>
              </div>
            </div>

            <div className="grid gap-0 lg:grid-cols-3">
              <div
                className="border-b p-5 lg:border-b-0 lg:border-r"
                style={{ borderColor: colors.surface[200] }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-md"
                    style={{
                      background: colors.brandSoft,
                      color: colors.brand,
                    }}
                  >
                    <Icon type="user" size={15} />
                  </div>
                  <h3
                    className="text-[13px] font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    Student
                  </h3>
                </div>
                <div className="mt-3">
                  <DataRow label="Name" value={submission.student_name} />
                  <DataRow label="Student ID" value={submission.student_id} />
                  <DataRow label="Email" value={submission.student_email} />
                </div>
              </div>

              <div
                className="border-b p-5 lg:border-b-0 lg:border-r"
                style={{ borderColor: colors.surface[200] }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-md"
                    style={{
                      background: colors.brandSoft,
                      color: colors.brand,
                    }}
                  >
                    <Icon type="course" size={15} />
                  </div>
                  <h3
                    className="text-[13px] font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    Course
                  </h3>
                </div>
                <div className="mt-3">
                  <DataRow
                    label="Module"
                    value={submission.course_name || "Personal"}
                  />
                  <DataRow label="Code" value={submission.course_code || "-"} />
                  <DataRow
                    label="Course ID"
                    value={submission.course_id || "-"}
                  />
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-md"
                    style={{
                      background: colors.brandSoft,
                      color: colors.brand,
                    }}
                  >
                    <Icon type="document" size={15} />
                  </div>
                  <h3
                    className="text-[13px] font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    Evidence state
                  </h3>
                </div>
                <div className="mt-3">
                  <DataRow
                    label="Classification"
                    value={
                      <Badge tone={classificationTone(submission)}>
                        {classificationLabel}
                      </Badge>
                    }
                  />
                  <DataRow
                    label="Review"
                    value={
                      <Badge tone={reviewTone(reviewStatus)}>
                        {reviewStatus}
                      </Badge>
                    }
                  />
                  <DataRow
                    label="Certificate"
                    value={submission.certificate_id ? "Issued" : "Not issued"}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2
                  className="text-[16px] font-bold tracking-[-0.03em]"
                  style={{ color: colors.text.primary }}
                >
                  Behavioral evidence summary
                </h2>
                <p
                  className="mt-1 text-[12px] leading-5"
                  style={{ color: colors.text.secondary }}
                >
                  Capture metrics recorded while the student wrote. These
                  support review; they do not replace academic judgement.
                </p>
              </div>
              <div
                className="min-w-[220px] rounded-md border p-3"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[100],
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="text-[11px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: colors.text.muted }}
                  >
                    Confidence
                  </span>
                  <span
                    className="font-mono text-[13px] font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    {confidence}%
                  </span>
                </div>
                <div
                  className="mt-2 h-2 overflow-hidden rounded-md"
                  style={{ background: colors.surface[200] }}
                >
                  <div
                    className="h-full rounded-md"
                    style={{
                      width: `${confidence}%`,
                      background: colors.brand,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {evidenceSummary.map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-md border p-3"
                  style={{
                    borderColor: colors.surface[200],
                    background: colors.surface[100],
                  }}
                >
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: colors.text.muted }}
                  >
                    {label}
                  </p>
                  <p
                    className="mt-2 text-[16px] font-bold tabular-nums"
                    style={{ color: colors.text.primary }}
                  >
                    {value || "-"}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div
              className="flex flex-col gap-3 border-b p-5 md:flex-row md:items-center md:justify-between"
              style={{ borderColor: colors.surface[200] }}
            >
              <div>
                <h2
                  className="text-[16px] font-bold tracking-[-0.03em]"
                  style={{ color: colors.text.primary }}
                >
                  Submitted document
                </h2>
                <p
                  className="mt-1 text-[12px] leading-5"
                  style={{ color: colors.text.secondary }}
                >
                  Read-only copy of the submitted text for review context.
                </p>
              </div>
              <span
                className="rounded-md border px-2.5 py-1 text-[11px] font-bold tabular-nums"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.secondary,
                }}
              >
                {safeNumber(submission.word_count)} words
              </span>
            </div>
            <div
              className="max-h-[560px] overflow-auto p-5"
              style={{ background: colors.surface[100] }}
            >
              <pre
                className="whitespace-pre-wrap rounded-md border p-5 text-[13px] leading-7"
                style={{
                  background: colors.surface[50],
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                  fontFamily: "inherit",
                }}
              >
                {submission.text_content ||
                  "No text content is available for this submission."}
              </pre>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-md"
                style={{ background: colors.brandSoft, color: colors.brand }}
              >
                <Icon type="hash" size={15} />
              </div>
              <div>
                <h2
                  className="text-[16px] font-bold tracking-[-0.03em]"
                  style={{ color: colors.text.primary }}
                >
                  Integrity record
                </h2>
                <p
                  className="mt-1 text-[12px] leading-5"
                  style={{ color: colors.text.secondary }}
                >
                  Hash and certificate fields used to verify the submitted
                  evidence record.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div
                className="rounded-md border p-3"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[100],
                }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: colors.text.muted }}
                >
                  Certificate ID
                </p>
                <p
                  className="mt-2 break-all font-mono text-[12px] font-bold"
                  style={{ color: colors.text.primary }}
                >
                  {submission.certificate_id || "Not issued"}
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
                  className="text-[10px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: colors.text.muted }}
                >
                  SHA-256 document hash
                </p>
                <p
                  className="mt-2 break-all font-mono text-[12px] font-bold"
                  style={{ color: colors.text.primary }}
                >
                  {submission.document_hash || "Not available"}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-[76px] xl:self-start">
          <Card className="overflow-hidden">
            <div
              className="border-b p-5"
              style={{ borderColor: colors.surface[200] }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2
                    className="text-[16px] font-bold tracking-[-0.03em]"
                    style={{ color: colors.text.primary }}
                  >
                    Teacher decision
                  </h2>
                  <p
                    className="mt-1 text-[12px] leading-5"
                    style={{ color: colors.text.secondary }}
                  >
                    Choose the current academic review outcome and save notes
                    for the record.
                  </p>
                </div>
                <Badge tone={selectedReviewOption.tone}>{reviewStatus}</Badge>
              </div>
              <p
                className="mt-3 rounded-md border px-3 py-2 text-[11px] font-semibold"
                style={{
                  borderColor: hasUnsavedReviewChanges
                    ? colors.amber
                    : colors.surface[200],
                  background: hasUnsavedReviewChanges
                    ? `${colors.amber}12`
                    : colors.surface[100],
                  color: hasUnsavedReviewChanges
                    ? colors.amber
                    : colors.text.muted,
                }}
              >
                {reviewSaveStateLabel}
              </p>
            </div>

            <div className="p-5">
              <div className="space-y-2">
                {reviewOptions.map((option) => (
                  <ReviewOptionButton
                    key={option.status}
                    option={option}
                    selected={reviewStatus === option.status}
                    onSelect={() => setReviewStatus(option.status)}
                  />
                ))}
              </div>

              <label className="mt-4 block">
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: colors.text.muted }}
                >
                  Review notes
                </span>
                <textarea
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  placeholder="Record what you reviewed, why you chose this decision, and any next action for the student."
                  rows={8}
                  className="mt-1.5 w-full resize-none rounded-md border px-3 py-2 text-[13px] leading-6 outline-none"
                  style={{
                    background: colors.surface[50],
                    borderColor: colors.surface[200],
                    color: colors.text.primary,
                  }}
                />
              </label>

              <button
                type="button"
                onClick={() => saveReview(reviewStatus)}
                disabled={isSaving}
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md px-4 text-[13px] font-bold disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: colors.brand, color: colors.text.light }}
              >
                <Icon type="save" size={14} />
                {isSaving
                  ? "Saving decision..."
                  : hasUnsavedReviewChanges
                    ? "Save teacher decision"
                    : "Decision saved"}
              </button>
            </div>
          </Card>

          <Card className="p-5">
            <h2
              className="text-[15px] font-bold tracking-[-0.03em]"
              style={{ color: colors.text.primary }}
            >
              Review checklist
            </h2>
            <p
              className="mt-1 text-[12px] leading-5"
              style={{ color: colors.text.secondary }}
            >
              Keep the decision grounded in evidence, not a single score.
            </p>
            <div className="mt-4 space-y-2">
              {[
                "Check the replay timeline for typing continuity.",
                "Compare confidence with WPM, pauses, and revision volume.",
                "Use certificate and hash fields only as integrity evidence.",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2 rounded-md border p-3"
                  style={{
                    borderColor: colors.surface[200],
                    background: colors.surface[100],
                  }}
                >
                  <span
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-md"
                    style={{
                      background: colors.brandSoft,
                      color: colors.brand,
                    }}
                  >
                    <Icon type="check" size={10} />
                  </span>
                  <span
                    className="text-[12px] leading-5"
                    style={{ color: colors.text.secondary }}
                  >
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2
              className="text-[15px] font-bold tracking-[-0.03em]"
              style={{ color: colors.text.primary }}
            >
              Evidence actions
            </h2>
            <div className="mt-4 grid gap-2">
              <Link
                to={ROUTES.REPLAY.replace(":sessionId", String(submission.id))}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-[13px] font-bold"
                style={{
                  background: colors.surface[50],
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              >
                <Icon type="replay" size={14} />
                Open replay audit
              </Link>

              {submission.certificate_id ? (
                <Link
                  to={ROUTES.VERIFY.replace(
                    ":certId",
                    submission.certificate_id,
                  )}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-[13px] font-bold"
                  style={{ background: colors.brand, color: colors.text.light }}
                >
                  <Icon type="certificate" size={14} />
                  Verify certificate
                </Link>
              ) : (
                <div
                  className="rounded-md border p-3 text-[12px] leading-5"
                  style={{
                    borderColor: colors.surface[200],
                    color: colors.text.secondary,
                  }}
                >
                  No certificate has been issued for this submission yet.
                </div>
              )}

              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-[13px] font-bold"
                style={{
                  background: colors.surface[50],
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              >
                <Icon type="arrowLeft" size={14} />
                Return to previous page
              </button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
