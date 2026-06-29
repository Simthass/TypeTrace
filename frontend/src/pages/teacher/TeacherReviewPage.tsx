import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, getApiErrorMessage } from "../../lib/api";
import { ROUTES } from "../../constants/routes";
import { colors, brand } from "../../styles/colors";
import { LoadingState, ErrorState } from "../../components/ui/AsyncState";
import { useToast } from "../../components/ui/ToastProvider";
import type {
  TeacherSubmission,
  TeacherSubmissionDetailResponse,
  TeacherReviewStatus,
} from "../../types/teacher";
import { API_ROUTES } from "../../constants/apiRoutes";

function getBadge(submission: TeacherSubmission) {
  if (submission.classification_bucket === "HUMAN") {
    return {
      label: "Human",
      bg: brand.humanBg,
      text: brand.humanText,
      border: brand.humanAccent,
    };
  }

  if (submission.classification_bucket === "SUSPICIOUS") {
    return {
      label: "Review",
      bg: brand.suspiciousBg,
      text: brand.suspiciousText,
      border: brand.suspiciousAccent,
    };
  }

  return {
    label: "High Risk",
    bg: brand.aiBg,
    text: brand.aiText,
    border: brand.aiAccent,
  };
}

export default function TeacherReviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [submission, setSubmission] = useState<TeacherSubmission | null>(null);
  const [reviewStatus, setReviewStatus] =
    useState<TeacherReviewStatus>("PENDING");
  const [reviewNotes, setReviewNotes] = useState("");
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

    loadSubmission();

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
        message: "Your review has been recorded.",
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

  if (isLoading) {
    return (
      <LoadingState
        title="Loading submission"
        message="Retrieving student submission details."
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
            className="rounded-md px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: colors.brand }}
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
            className="rounded-md px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: colors.brand }}
          >
            Back to submissions
          </Link>
        }
      />
    );
  }

  const badge = getBadge(submission);

  return (
    <div
      className="min-h-screen px-6 py-8"
      style={{ background: colors.surface[50] }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to={ROUTES.TEACHER_SUBMISSIONS}
            className="text-[13px] font-semibold"
            style={{ color: colors.brand }}
          >
            Back to submissions
          </Link>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border px-3 py-2 text-[12px] font-semibold"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
              background: "#FFFFFF",
            }}
          >
            Go back
          </button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <div
              className="rounded-md border bg-white p-5 shadow-sm"
              style={{ borderColor: colors.surface[200] }}
            >
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <p
                    className="text-[12px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: colors.text.secondary }}
                  >
                    Submission review
                  </p>
                  <h1
                    className="mt-2 text-2xl font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {submission.title}
                  </h1>
                  <p
                    className="mt-2 text-[14px]"
                    style={{ color: colors.text.secondary }}
                  >
                    {submission.student_name} · {submission.student_id} ·{" "}
                    {submission.course_name}
                  </p>
                </div>

                {badge && (
                  <span
                    className="rounded-md border px-3 py-1.5 text-[12px] font-semibold"
                    style={{
                      background: badge.bg,
                      color: badge.text,
                      borderColor: badge.border,
                    }}
                  >
                    {badge.label}
                  </span>
                )}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                {[
                  ["Confidence", `${submission.confidence}%`],
                  ["Risk Level", submission.risk_level],
                  ["WPM", submission.wpm],
                  ["Words", submission.word_count],
                  ["Keystrokes", submission.total_keystrokes],
                  ["Deletions", submission.deletions],
                  ["Pauses", submission.pauses],
                  ["Avg IKI", `${submission.avg_iki}ms`],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-md border px-3 py-2"
                    style={{ borderColor: colors.surface[200] }}
                  >
                    <p
                      className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{ color: colors.text.secondary }}
                    >
                      {label}
                    </p>
                    <p
                      className="mt-1 text-[13px] font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      {value || "-"}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to={ROUTES.REPLAY.replace(
                    ":sessionId",
                    String(submission.id),
                  )}
                  className="rounded-md border px-4 py-2 text-[13px] font-bold transition hover:opacity-80"
                  style={{
                    borderColor: colors.surface[200],
                    color: colors.text.primary,
                    background: colors.surface[50],
                  }}
                >
                  Open replay audit
                </Link>

                {submission.certificate_id && (
                  <Link
                    to={ROUTES.VERIFY.replace(
                      ":certId",
                      submission.certificate_id,
                    )}
                    className="rounded-md px-4 py-2 text-[13px] font-bold transition hover:opacity-90"
                    style={{
                      color: colors.text.light,
                      background: colors.brand,
                    }}
                  >
                    Verify certificate
                  </Link>
                )}
              </div>
            </div>

            <div
              className="rounded-md border bg-white p-5 shadow-sm"
              style={{ borderColor: colors.surface[200] }}
            >
              <h2
                className="text-[15px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                Submitted text
              </h2>
              <div
                className="mt-4 max-h-[520px] overflow-auto rounded-md border p-4"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[50],
                }}
              >
                <pre
                  className="whitespace-pre-wrap text-[13px] leading-6"
                  style={{
                    color: colors.text.primary,
                    fontFamily: "inherit",
                  }}
                >
                  {submission.text_content || "No text content available."}
                </pre>
              </div>
            </div>

            {submission.document_hash && (
              <div
                className="rounded-md border bg-white p-5 shadow-sm"
                style={{ borderColor: colors.surface[200] }}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: colors.text.secondary }}
                >
                  Document Hash
                </p>
                <p
                  className="mt-2 break-all font-mono text-[12px]"
                  style={{ color: colors.text.primary }}
                >
                  {submission.document_hash}
                </p>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div
              className="rounded-md border bg-white p-5 shadow-sm"
              style={{ borderColor: colors.surface[200] }}
            >
              <h2
                className="text-[15px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                Teacher decision
              </h2>
              <p
                className="mt-1 text-[13px]"
                style={{ color: colors.text.secondary }}
              >
                Approve genuine work, flag problematic evidence, or keep it
                pending.
              </p>

              <div className="mt-4 space-y-2">
                {(["PENDING", "APPROVED", "FLAGGED"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setReviewStatus(status)}
                    className="w-full rounded-md border px-3 py-2 text-left text-[13px] font-semibold"
                    style={{
                      borderColor:
                        reviewStatus === status
                          ? colors.brand
                          : colors.surface[200],
                      background:
                        reviewStatus === status ? brand.bgNavActive : "#FFFFFF",
                      color:
                        reviewStatus === status
                          ? colors.brand
                          : colors.text.primary,
                    }}
                  >
                    {status === "PENDING"
                      ? "Keep Pending"
                      : status === "APPROVED"
                        ? "Approve Submission"
                        : "Flag Submission"}
                  </button>
                ))}
              </div>

              <textarea
                value={reviewNotes}
                onChange={(event) => setReviewNotes(event.target.value)}
                placeholder="Add review notes for the student..."
                rows={7}
                className="mt-4 w-full rounded-md border px-3 py-2 text-[13px] outline-none"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              />

              <button
                type="button"
                onClick={() => saveReview(reviewStatus)}
                disabled={isSaving}
                className="mt-4 w-full rounded-md px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
                style={{ background: colors.brand }}
              >
                {isSaving ? "Saving..." : "Save Review"}
              </button>
            </div>

            <div
              className="rounded-md border bg-white p-5 shadow-sm"
              style={{ borderColor: colors.surface[200] }}
            >
              <h2
                className="text-[15px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                Evidence links
              </h2>

              <div className="mt-4 space-y-2">
                <Link
                  to={ROUTES.REPLAY.replace(
                    ":sessionId",
                    String(submission.id),
                  )}
                  className="block rounded-md border px-3 py-2 text-[13px] font-semibold"
                  style={{
                    borderColor: colors.surface[200],
                    color: colors.text.primary,
                  }}
                >
                  Open Replay
                </Link>

                {submission.certificate_id && (
                  <Link
                    to={ROUTES.VERIFY.replace(
                      ":certId",
                      submission.certificate_id,
                    )}
                    className="block rounded-md border px-3 py-2 text-[13px] font-semibold"
                    style={{
                      borderColor: colors.surface[200],
                      color: colors.text.primary,
                    }}
                  >
                    Verify Certificate
                  </Link>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
