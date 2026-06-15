import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, getApiErrorMessage } from "../../lib/api";
import { ROUTES } from "../../constants/routes";
import { colors, brand } from "../../styles/colors";
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from "../../components/ui/AsyncState";
import { useToast } from "../../components/ui/ToastProvider";
import type {
  TeacherSubmission,
  TeacherSubmissionsResponse,
} from "../../types/teacher";
import { API_ROUTES } from "../../constants/apiRoutes";

function SearchIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function badgeStyle(submission: TeacherSubmission) {
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

function SubmissionCard({ submission }: { submission: TeacherSubmission }) {
  const style = badgeStyle(submission);

  return (
    <div
      className="rounded-md border bg-white shadow-sm"
      style={{ borderColor: colors.surface[200] }}
    >
      <div
        className="flex flex-col justify-between gap-3 border-b px-5 py-4 md:flex-row md:items-start"
        style={{ borderColor: colors.surface[200] }}
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className="text-[15px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              {submission.title}
            </h2>
            <span
              className="rounded-md border px-2 py-0.5 text-[11px] font-semibold"
              style={{
                background: style.bg,
                color: style.text,
                borderColor: style.border,
              }}
            >
              {style.label}
            </span>
          </div>
          <p
            className="mt-1 text-[12px]"
            style={{ color: colors.text.secondary }}
          >
            {submission.student_name} · {submission.student_id} ·{" "}
            {submission.course_code}
          </p>
        </div>

        <div className="text-left md:text-right">
          <p
            className="text-[15px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            {submission.confidence}%
          </p>
          <p className="text-[11px]" style={{ color: colors.text.secondary }}>
            Confidence
          </p>
        </div>
      </div>

      <div className="grid gap-3 px-5 py-4 sm:grid-cols-4">
        {[
          ["WPM", submission.wpm],
          ["Words", submission.word_count],
          ["Risk", submission.risk_level],
          ["Review", submission.review_status],
          ["Keystrokes", submission.total_keystrokes],
          ["Deletions", submission.deletions],
          ["Pauses", submission.pauses],
          ["Date", submission.created_at],
        ].map(([label, value]) => (
          <div key={label}>
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
              {value || "—"}
            </p>
          </div>
        ))}
      </div>

      <div
        className="flex flex-wrap gap-2 border-t px-5 py-4"
        style={{ borderColor: colors.surface[200] }}
      >
        <Link
          to={ROUTES.TEACHER_REVIEW.replace(
            ":sessionId",
            String(submission.id),
          )}
          className="rounded-md px-3 py-2 text-[12px] font-semibold text-white"
          style={{ background: colors.brand }}
        >
          Review Submission
        </Link>

        <Link
          to={ROUTES.REPLAY.replace(":sessionId", String(submission.id))}
          className="rounded-md border px-3 py-2 text-[12px] font-semibold"
          style={{
            borderColor: colors.surface[200],
            color: colors.text.primary,
          }}
        >
          View Replay
        </Link>

        {submission.certificate_id && (
          <Link
            to={ROUTES.VERIFY.replace(":certId", submission.certificate_id)}
            className="rounded-md border px-3 py-2 text-[12px] font-semibold"
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
  );
}

export default function TeacherSubmissionsPage() {
  const { showToast } = useToast();
  const [submissions, setSubmissions] = useState<TeacherSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [reviewStatus, setReviewStatus] = useState("ALL");
  const [riskLevel, setRiskLevel] = useState("ALL");
  const [search, setSearch] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const requestParams = useMemo(() => {
    const params: Record<string, string> = {
      limit: "100",
      offset: "0",
    };

    if (reviewStatus !== "ALL") {
      params.review_status = reviewStatus;
    }

    if (riskLevel !== "ALL") {
      params.risk_level = riskLevel;
    }

    if (search.trim()) {
      params.search = search.trim();
    }

    return params;
  }, [reviewStatus, riskLevel, search]);

  useEffect(() => {
    let mounted = true;

    async function loadSubmissions() {
      setIsLoading(true);
      setApiError(null);

      try {
        const response = await api.get<TeacherSubmissionsResponse>(
          API_ROUTES.teacher.sessions,
          { params: requestParams },
        );
        if (!mounted) return;
        setSubmissions(response.data.sessions || []);
        setTotal(response.data.total || 0);
      } catch (error) {
        if (!mounted) return;
        const message = getApiErrorMessage(error);
        setApiError(message);
        showToast({
          type: "error",
          title: "Failed to load submissions",
          message,
        });
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadSubmissions();

    return () => {
      mounted = false;
    };
  }, [requestParams, showToast]);

  if (isLoading) {
    return (
      <LoadingState
        title="Loading submissions"
        message="Retrieving student submissions."
      />
    );
  }

  if (apiError) {
    return (
      <ErrorState
        title="Could not load submissions"
        message={apiError}
        action={
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: colors.brand }}
          >
            Retry
          </button>
        }
      />
    );
  }

  return (
    <div
      className="min-h-screen px-6 py-8"
      style={{ background: colors.surface[50] }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p
              className="text-[12px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: colors.text.secondary }}
            >
              Review queue
            </p>
            <h1
              className="mt-2 text-2xl font-semibold"
              style={{ color: colors.text.primary }}
            >
              Submissions
            </h1>
            <p
              className="mt-2 max-w-2xl text-[14px]"
              style={{ color: colors.text.secondary }}
            >
              Review student writing evidence, ML classifications, risk signals,
              and certificates.
            </p>
          </div>

          <Link
            to={ROUTES.TEACHER_COURSES}
            className="rounded-md border px-4 py-2 text-[13px] font-semibold"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
              background: "#FFFFFF",
            }}
          >
            Manage courses
          </Link>
        </div>

        <div
          className="mt-6 rounded-md border bg-white p-4"
          style={{ borderColor: colors.surface[200] }}
        >
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <span
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: colors.text.secondary }}
              >
                <SearchIcon />
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, student, course..."
                className="w-full rounded-md border py-2 pl-9 pr-3 text-[13px] outline-none"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              />
            </div>

            <select
              value={reviewStatus}
              onChange={(event) => setReviewStatus(event.target.value)}
              className="rounded-md border px-3 py-2 text-[13px] outline-none"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
              }}
            >
              <option value="ALL">All reviews</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="FLAGGED">Flagged</option>
            </select>

            <select
              value={riskLevel}
              onChange={(event) => setRiskLevel(event.target.value)}
              className="rounded-md border px-3 py-2 text-[13px] outline-none"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
              }}
            >
              <option value="ALL">All risk levels</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>

          <p
            className="mt-3 text-[12px]"
            style={{ color: colors.text.secondary }}
          >
            Showing {submissions.length} of {total} submissions
          </p>
        </div>

        {submissions.length === 0 ? (
          <EmptyState
            title="No submissions found"
            message="Adjust filters or wait for students to submit course-linked writing sessions."
          />
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {submissions.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
