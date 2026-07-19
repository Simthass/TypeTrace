import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { API_ROUTES } from "../../constants/apiRoutes";
import { ROUTES } from "../../constants/routes";
import { api, getApiErrorMessage } from "../../lib/api";
import { useSafeRequest } from "../../hooks/useSafeRequest";
import { colors } from "../../styles/colors";
import { classificationDisplayLabel } from "../../lib/edgeCases";
import {
  formatEvidenceScore,
  normalizeEvidenceScore,
} from "../../lib/evidenceScore";

import { ErrorState, LoadingState } from "../../components/ui/AsyncState";
import {
  AppSurface,
  InternalIcon,
} from "../../components/internal/InternalShell";
import { Badge, classificationTone } from "../../components/ui/Badge";

interface TeacherSubmissionDetail {
  id: number;
  title: string;
  student_name: string;
  student_email: string;
  student_id: string;
  course_id: number | null;
  course_name: string | null;
  course_code: string | null;
  classification: string;
  classification_bucket: string;
  confidence: number;
  risk_level: string;
  review_status: string;
  review_notes: string;
  wpm: number;
  duration_seconds: number;
  total_keystrokes: number;
  deletions: number;
  pauses: number;
  avg_iki: number;
  word_count: number;
  certificate_id: string;
  document_hash: string;
  created_at: string;
  text_content: string;
  text_preview: string;
  text_preview_truncated: boolean;
  has_text_content: boolean;
  has_raw_keystroke_data: boolean;
  review_saved_at: string;
}

type TeacherReviewStatus =
  | "PENDING"
  | "APPROVED"
  | "FLAGGED"
  | "NEEDS_DISCUSSION"
  | "NOT_APPLICABLE";

type ReviewOption = {
  status: TeacherReviewStatus;
  title: string;
  description: string;
  tone: "human" | "suspicious" | "danger" | "brand" | "neutral";
};

const reviewOptions: ReviewOption[] = [
  {
    status: "PENDING",
    title: "Keep pending",
    description: "More context or student discussion is still required.",
    tone: "suspicious",
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
    tone: "danger",
  },
];

function safeNumber(value: number | string | null | undefined): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
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

function reviewTone(
  status: string | undefined,
): "human" | "danger" | "brand" | "neutral" | "suspicious" {
  const normalized = String(status || "PENDING").toUpperCase();
  if (normalized === "APPROVED") return "human";
  if (normalized === "FLAGGED") return "danger";
  if (normalized === "NEEDS_DISCUSSION") return "brand";
  if (normalized === "NOT_APPLICABLE") return "neutral";
  return "suspicious";
}

function confidenceColor(tone: string): string {
  if (tone === "human") return colors.green;
  if (tone === "suspicious") return colors.amber;
  if (tone === "danger") return colors.red;
  return colors.steel;
}

function confidenceHint(tone: string): string {
  if (tone === "human") {
    return "Behavioral signals are consistent with an authentic human writing process.";
  }
  if (tone === "suspicious") {
    return "Some behavioral signals are inconclusive and warrant a closer look.";
  }
  if (tone === "danger") {
    return "Behavioral signals suggest a high risk of non-human or assisted generation.";
  }
  return "Not enough signal yet to classify this submission's writing process.";
}

function getOptionStyle(tone: string, selected: boolean) {
  if (!selected) {
    return {
      bg: colors.surface[50],
      border: colors.surface[200],
      text: colors.text.primary,
      checkBg: colors.surface[50],
      checkBorder: colors.surface[200],
      checkIcon: colors.text.muted,
    };
  }
  if (tone === "human")
    return {
      bg: "#ECFDF5",
      border: "#10B981",
      text: "#065F46",
      checkBg: "#10B981",
      checkBorder: "#10B981",
      checkIcon: "#fff",
    };
  if (tone === "suspicious")
    return {
      bg: "#FFFBEB",
      border: "#F59E0B",
      text: "#92400E",
      checkBg: "#F59E0B",
      checkBorder: "#F59E0B",
      checkIcon: "#fff",
    };
  if (tone === "danger")
    return {
      bg: "#FEF2F2",
      border: "#EF4444",
      text: "#991B1B",
      checkBg: "#EF4444",
      checkBorder: "#EF4444",
      checkIcon: "#fff",
    };
  if (tone === "brand")
    return {
      bg: "#EFF6FF",
      border: "#3B82F6",
      text: "#1E3A8A",
      checkBg: "#3B82F6",
      checkBorder: "#3B82F6",
      checkIcon: "#fff",
    };
  return {
    bg: colors.surface[100],
    border: colors.surface[300],
    text: colors.text.primary,
    checkBg: colors.surface[300],
    checkBorder: colors.surface[300],
    checkIcon: "#fff",
  };
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
  const style = getOptionStyle(option.tone, selected);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-md border p-3 text-left transition-colors hover:bg-surface-100"
      style={{
        backgroundColor: style.bg,
        borderColor: style.border,
        color: style.text,
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors"
          style={{
            backgroundColor: style.checkBg,
            borderColor: style.checkBorder,
            color: style.checkIcon,
          }}
        >
          {selected && <InternalIcon name="check" size={12} />}
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-bold">{option.title}</span>
          <span
            className="mt-0.5 block text-[11px] leading-5"
            style={{ color: selected ? style.text : colors.text.secondary }}
          >
            {option.description}
          </span>
        </span>
      </div>
    </button>
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

function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
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
        {label}
      </p>
      <p
        className="mt-2 text-[16px] font-bold tabular-nums"
        style={{ color: colors.text.primary }}
      >
        {value || "-"}
      </p>
    </div>
  );
}

export default function TeacherReviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState<TeacherSubmissionDetail | null>(
    null,
  );
  const [reviewStatus, setReviewStatus] =
    useState<TeacherReviewStatus>("PENDING");
  const [reviewNotes, setReviewNotes] = useState("");
  const [savedReviewStatus, setSavedReviewStatus] =
    useState<TeacherReviewStatus>("PENDING");
  const [savedReviewNotes, setSavedReviewNotes] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { run: loadSession, isLoading: isFetching } = useSafeRequest();
  const { run: saveReview } = useSafeRequest();

  useEffect(() => {
    if (!sessionId) return;

    loadSession(
      async () => {
        const response = await api.get<{
          status: string;
          session: TeacherSubmissionDetail;
        }>(API_ROUTES.teacher.sessionDetail(sessionId));

        const data = response.data.session;
        setSubmission(data);
        setReviewStatus(
          (data.review_status || "PENDING") as TeacherReviewStatus,
        );
        setReviewNotes(data.review_notes || "");
        setSavedReviewStatus(
          (data.review_status || "PENDING") as TeacherReviewStatus,
        );
        setSavedReviewNotes(data.review_notes || "");
        setLastSavedAt(data.review_saved_at || null);

        return data;
      },
      { showErrorToast: false },
    ).catch((err) => {
      setApiError(getApiErrorMessage(err));
      return null;
    });
  }, [sessionId, loadSession]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!sessionId || isSaving) return;

    setIsSaving(true);
    setApiError(null);

    saveReview(
      async () => {
        const response = await api.patch(
          API_ROUTES.teacher.sessionReview(sessionId),
          {
            status: reviewStatus,
            notes: reviewNotes.trim(),
          },
        );

        const nextStatus = response.data?.review_status || reviewStatus;
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

        return response.data;
      },
      {
        successTitle: "Review saved",
        successMessage: "Your teacher decision has been recorded.",
        showSuccessToast: true,
      },
    ).finally(() => {
      setIsSaving(false);
    });
  };

  if (!submission && isFetching) {
    return (
      <LoadingState
        title="Loading submission"
        message="Retrieving the teacher review dossier."
      />
    );
  }

  if (apiError || !submission) {
    return (
      <ErrorState
        title={apiError ? "Could not load submission" : "Submission not found"}
        message={
          apiError ||
          "This submission could not be found. It may have been removed."
        }
        action={
          <Link
            to={ROUTES.TEACHER_SUBMISSIONS}
            className="rounded-md border px-4 py-2.5 text-[13px] font-semibold transition hover:opacity-80"
            style={{
              borderColor: colors.surface[200],
              background: colors.surface[50],
              color: colors.text.primary,
            }}
          >
            Back to submissions
          </Link>
        }
      />
    );
  }

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

  const classificationLabel = classificationDisplayLabel(
    submission.classification_bucket,
  );
  const confidence = normalizeEvidenceScore(submission.confidence);
  const tone = classificationTone(submission.classification_bucket);
  const accentColor = confidenceColor(tone);

  const durationMins = Math.max(
    1,
    Math.round(submission.duration_seconds / 60),
  );

  const evidenceSummary = [
    ["Keystrokes", submission.total_keystrokes],
    ["Deletions", submission.deletions],
    ["Pauses", submission.pauses],
    ["Average IKI", `${Math.round(safeNumber(submission.avg_iki))}ms`],
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-0 pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-[12px] font-bold hover:underline bg-transparent border-none p-0 cursor-pointer"
            style={{ color: colors.brand }}
          >
            <InternalIcon name="trend" size={14} />
            Back to submission queue
          </button>
          <p
            className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: colors.text.muted }}
          >
            Teacher review dossier
          </p>
          <h1
            className="mt-1 max-w-4xl text-[24px] font-bold tracking-[-0.04em]"
            style={{ color: colors.text.primary }}
          >
            {submission.title || "Untitled submission"}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={reviewTone(reviewStatus)}>
            {String(reviewStatus).replace("_", " ")}
          </Badge>
          <span
            className="rounded-md border px-2.5 py-1 font-mono text-[11px] font-bold"
            style={{
              background: colors.surface[100],
              borderColor: colors.surface[200],
              color: colors.text.secondary,
            }}
          >
            Session #{submission.id}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Decrypted Essay Content (66% space allocation) */}
        <div className="lg:col-span-2 space-y-6">
          <AppSurface className="flex h-full min-h-[600px] flex-col p-0">
            <div
              className="flex items-center justify-between border-b p-5"
              style={{ borderColor: colors.surface[200] }}
            >
              <h2
                className="text-[15px] font-semibold tracking-tight"
                style={{ color: colors.text.primary }}
              >
                Document Text
              </h2>
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: colors.text.muted }}
              >
                {submission.word_count} words
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              {submission.text_content ? (
                <div
                  className="whitespace-pre-wrap font-serif text-[15px] leading-[1.8]"
                  style={{ color: colors.text.primary }}
                >
                  {submission.text_content}
                </div>
              ) : (
                <div
                  className="flex h-40 items-center justify-center rounded-md border border-dashed"
                  style={{
                    borderColor: colors.surface[200],
                    backgroundColor: colors.surface[50],
                  }}
                >
                  <p
                    className="text-[13px] italic"
                    style={{ color: colors.text.secondary }}
                  >
                    No text content was captured for this submission.
                  </p>
                </div>
              )}
            </div>
          </AppSurface>
        </div>

        {/* Action Sidebar Panel (34% space allocation) */}
        <div className="space-y-6">
          <AppSurface className="overflow-hidden p-0">
            <div
              className="border-b p-5"
              style={{ borderColor: colors.surface[200] }}
            >
              <h2
                className="text-[15px] font-semibold tracking-tight"
                style={{ color: colors.text.primary }}
              >
                Teacher decision
              </h2>
              <p
                className="mt-1 text-[12px] leading-5"
                style={{ color: colors.text.secondary }}
              >
                Choose the review outcome and save notes for the record.
              </p>
            </div>

            <div className="p-5">
              <div
                className="mb-4 flex items-center justify-between rounded-md border px-3 py-2 text-[11px] font-semibold"
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
                <span>Status:</span>
                <span>{reviewSaveStateLabel}</span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
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

                <label className="block pt-2">
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
                    rows={4}
                    className="mt-1.5 w-full resize-y rounded-md border px-3 py-2 text-[13px] leading-6 outline-none focus:ring-2"
                    style={{
                      background: colors.surface[50],
                      borderColor: colors.surface[200],
                      color: colors.text.primary,
                    }}
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md px-4 text-[13px] font-bold disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer transition hover:opacity-90"
                  style={{ background: colors.brand, color: colors.text.light }}
                >
                  {isSaving ? "Saving decision..." : "Save teacher decision"}
                </button>
              </form>
            </div>
          </AppSurface>

          <AppSurface className="overflow-hidden p-0">
            <div
              className="border-b p-5"
              style={{ borderColor: colors.surface[200] }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2
                    className="text-[15px] font-semibold tracking-tight"
                    style={{ color: colors.text.primary }}
                  >
                    Evidence overview
                  </h2>
                  <p
                    className="mt-1 text-[12px] leading-5"
                    style={{ color: colors.text.secondary }}
                  >
                    Model confidence and capture behavior for this submission.
                  </p>
                </div>
                <Badge tone={tone}>{classificationLabel}</Badge>
              </div>
            </div>

            <div
              className="border-b p-5"
              style={{ borderColor: colors.surface[200] }}
            >
              <div className="flex items-center justify-between gap-2">
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: colors.text.muted }}
                >
                  Human evidence score
                </p>
                <span style={{ color: accentColor }}>
                  <InternalIcon name="shield" size={16} />
                </span>
              </div>
              <p
                className="mt-2 text-[34px] font-bold leading-none tracking-[-0.04em] tabular-nums"
                style={{ color: accentColor }}
              >
                {formatEvidenceScore(confidence)}%
              </p>
              <div
                className="mt-3 h-2.5 overflow-hidden rounded-md"
                style={{ background: colors.surface[200] }}
              >
                <div
                  className="h-full rounded-md transition-all"
                  style={{ width: `${confidence}%`, background: accentColor }}
                />
              </div>
              <p
                className="mt-3 text-[11px] leading-5"
                style={{ color: colors.text.secondary }}
              >
                {confidenceHint(tone)}
              </p>

              <div
                className="mt-4 grid grid-cols-2 gap-3 border-t pt-4"
                style={{ borderColor: colors.surface[200] }}
              >
                <div>
                  <p
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: colors.text.muted }}
                  >
                    <InternalIcon name="warning" size={11} />
                    Risk level
                  </p>
                  <p
                    className="mt-1 text-[13px] font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    {submission.risk_level || "Unknown"}
                  </p>
                </div>
                <div>
                  <p
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: colors.text.muted }}
                  >
                    <InternalIcon name="keyboard" size={11} />
                    Writing speed
                  </p>
                  <p
                    className="mt-1 text-[13px] font-bold tabular-nums"
                    style={{ color: colors.text.primary }}
                  >
                    {Math.round(safeNumber(submission.wpm))} WPM
                  </p>
                </div>
                <div className="col-span-2 pt-2">
                  <p
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: colors.text.muted }}
                  >
                    <InternalIcon name="clock" size={11} />
                    Active Time
                  </p>
                  <p
                    className="mt-1 text-[13px] font-bold tabular-nums"
                    style={{ color: colors.text.primary }}
                  >
                    {durationMins} minutes
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5">
              <p
                className="text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: colors.text.muted }}
              >
                Behavioral capture metrics
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {evidenceSummary.map(([label, value]) => (
                  <StatTile
                    key={String(label)}
                    label={String(label)}
                    value={value}
                  />
                ))}
              </div>
            </div>
          </AppSurface>

          <AppSurface className="overflow-hidden p-0">
            <div
              className="border-b p-5"
              style={{ borderColor: colors.surface[200] }}
            >
              <h2
                className="text-[15px] font-semibold tracking-tight"
                style={{ color: colors.text.primary }}
              >
                Student & course
              </h2>
              <p
                className="mt-1 text-[12px] leading-5"
                style={{ color: colors.text.secondary }}
              >
                Core LMS metadata for the learner and module.
              </p>
            </div>

            <div className="p-5 space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-md"
                    style={{
                      background: colors.brandSoft,
                      color: colors.brand,
                    }}
                  >
                    <InternalIcon name="student" size={15} />
                  </div>
                  <h3
                    className="text-[13px] font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    Student
                  </h3>
                </div>
                <DataRow label="Name" value={submission.student_name} />
                <DataRow label="Student ID" value={submission.student_id} />
                <DataRow label="Email" value={submission.student_email} />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-md"
                    style={{
                      background: colors.brandSoft,
                      color: colors.brand,
                    }}
                  >
                    <InternalIcon name="course" size={15} />
                  </div>
                  <h3
                    className="text-[13px] font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    Course
                  </h3>
                </div>
                <DataRow
                  label="Module"
                  value={submission.course_name || "Personal"}
                />
                <DataRow label="Code" value={submission.course_code || "-"} />
                <DataRow
                  label="Certificate"
                  value={submission.certificate_id ? "Issued" : "Not issued"}
                />
                <div
                  className="mt-3 text-[11px]"
                  style={{ color: colors.text.muted }}
                >
                  Submitted {formatDate(submission.created_at)}
                </div>
              </div>
            </div>
          </AppSurface>

          <AppSurface className="p-5">
            <h2
              className="text-[15px] font-bold tracking-[-0.03em]"
              style={{ color: colors.text.primary }}
            >
              Evidence actions
            </h2>
            <div className="mt-4 grid gap-2">
              <Link
                to={ROUTES.REPLAY.replace(":sessionId", String(submission.id))}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-[13px] font-bold hover:bg-surface-100 transition-colors"
                style={{
                  background: colors.surface[50],
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              >
                <InternalIcon name="replay" size={14} />
                Open replay audit
              </Link>

              {submission.certificate_id ? (
                <Link
                  to={ROUTES.VERIFY.replace(
                    ":certId",
                    submission.certificate_id,
                  )}
                  target="_blank"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-[13px] font-bold transition hover:opacity-90"
                  style={{ background: colors.brand, color: colors.text.light }}
                >
                  <InternalIcon name="certificate" size={14} />
                  Verify certificate
                </Link>
              ) : (
                <div
                  className="rounded-md border p-3 text-[12px] leading-5 text-center"
                  style={{
                    borderColor: colors.surface[200],
                    color: colors.text.secondary,
                    background: colors.surface[50],
                  }}
                >
                  No certificate has been issued for this submission yet.
                </div>
              )}
            </div>
          </AppSurface>
        </div>
      </div>
    </div>
  );
}
