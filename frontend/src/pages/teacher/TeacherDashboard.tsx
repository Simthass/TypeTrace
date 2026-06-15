import { useEffect, useState } from "react";
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
import { useAuthStore } from "../../store/authStore";
import { API_ROUTES } from "../../constants/apiRoutes";

interface TeacherDashboardData {
  status: string;
  total_courses: number;
  total_students: number;
  total_submissions: number;
  pending_review: number;
  approved_count: number;
  flagged_count: number;
  avg_confidence: number;
  recent_submissions: {
    id: number;
    title: string;
    student_name: string;
    course_code: string;
    classification_bucket: string;
    confidence: number;
    review_status: string;
    created_at: string;
  }[];
}

function classificationBadge(bucket: string) {
  const b = (bucket ?? "").toUpperCase();
  if (b === "HUMAN")
    return {
      bg: brand.humanBg,
      text: brand.humanText,
      border: brand.humanAccent,
      label: "Human",
    };
  if (b === "SUSPICIOUS")
    return {
      bg: brand.suspiciousBg,
      text: brand.suspiciousText,
      border: brand.suspiciousAccent,
      label: "Review",
    };
  return {
    bg: brand.aiBg,
    text: brand.aiText,
    border: brand.aiAccent,
    label: "High Risk",
  };
}

function MetricCard({
  label,
  value,
  sub,
  icon,
  to,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  to?: string;
}) {
  const content = (
    <div
      className="rounded-xl border bg-white p-5 transition-shadow hover:shadow-md"
      style={{ borderColor: colors.surface[200] }}
    >
      <div className="mb-4 flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: colors.brandSoft }}
        >
          {icon}
        </div>
        {to && (
          <Link
            to={to}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-slate-50"
            style={{ color: colors.text.muted }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17L17 7" />
              <path d="M7 7h10v10" />
            </svg>
          </Link>
        )}
      </div>
      <p
        className="text-[2.1rem] font-bold leading-none tracking-tight"
        style={{ color: colors.text.primary }}
      >
        {value}
      </p>
      <p
        className="mt-1.5 text-[13px] font-semibold"
        style={{ color: colors.text.primary }}
      >
        {label}
      </p>
      <p className="mt-0.5 text-[12px]" style={{ color: colors.text.muted }}>
        {sub}
      </p>
    </div>
  );

  return content;
}

export default function TeacherDashboard() {
  const { showToast } = useToast();
  const { user } = useAuthStore();
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setIsLoading(true);
      setApiError(null);

      try {
        const response = await api.get<TeacherDashboardData>(
          API_ROUTES.teacher.dashboard,
        );

        if (!mounted) return;
        setData(response.data);
      } catch (error) {
        if (!mounted) return;
        const message = getApiErrorMessage(error);
        setApiError(message);
        showToast({
          type: "error",
          title: "Dashboard failed to load",
          message,
        });
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, [showToast]);

  if (isLoading) {
    return (
      <LoadingState
        title="Loading workspace"
        message="Preparing your teacher dashboard."
      />
    );
  }

  if (apiError) {
    return (
      <ErrorState
        title="Could not load dashboard"
        message={apiError}
        action={
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg px-4 py-2.5 text-[13px] font-bold text-white"
            style={{ background: colors.brand }}
          >
            Retry
          </button>
        }
      />
    );
  }

  if (!data) {
    return (
      <ErrorState
        title="Dashboard unavailable"
        message="Could not load your teacher workspace. Try refreshing."
        action={
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg px-4 py-2.5 text-[13px] font-bold text-white"
            style={{ background: colors.brand }}
          >
            Reload
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1
            className="text-[1.9rem] font-bold tracking-tight"
            style={{ color: colors.text.primary }}
          >
            {user?.first_name
              ? `Welcome, ${user.first_name}.`
              : "Teacher Console"}
          </h1>
          <p
            className="mt-1 text-[14px]"
            style={{ color: colors.text.secondary }}
          >
            Monitor student submissions, review evidence, and manage courses.
          </p>
        </div>
        <Link
          to={ROUTES.TEACHER_COURSES}
          className="flex shrink-0 items-center gap-2 self-start rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition hover:brightness-110"
          style={{
            background: colors.brand,
            boxShadow: `0 8px 24px -12px ${colors.brand}`,
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          New Course
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard
          label="Courses"
          value={data.total_courses}
          sub="Active courses"
          to={ROUTES.TEACHER_COURSES}
          icon={
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.brand}
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
            </svg>
          }
        />
        <MetricCard
          label="Students"
          value={data.total_students}
          sub="Enrolled learners"
          to={ROUTES.TEACHER_STUDENTS}
          icon={
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.brand}
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
          }
        />
        <MetricCard
          label="Submissions"
          value={data.total_submissions}
          sub="Writing sessions submitted"
          to={ROUTES.TEACHER_SUBMISSIONS}
          icon={
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.brand}
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          }
        />
        <MetricCard
          label="Pending Review"
          value={data.pending_review}
          sub="Awaiting your decision"
          to={ROUTES.TEACHER_SUBMISSIONS}
          icon={
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke={data.pending_review > 0 ? colors.amber : colors.brand}
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
      </div>

      {data.pending_review > 0 && (
        <div
          className="flex items-center gap-3 rounded-xl border px-5 py-4"
          style={{
            borderColor: brand.suspiciousAccent,
            background: brand.suspiciousBg,
          }}
        >
          <span
            className="h-3 w-3 animate-pulse rounded-full"
            style={{ background: colors.amber }}
          />
          <p
            className="text-[13px] font-semibold"
            style={{ color: brand.suspiciousText }}
          >
            {data.pending_review} submission
            {data.pending_review !== 1 ? "s" : ""} need
            {data.pending_review === 1 ? "s" : ""} your review
          </p>
          <Link
            to={ROUTES.TEACHER_SUBMISSIONS}
            className="ml-auto rounded-lg border px-3 py-1.5 text-[12px] font-semibold"
            style={{
              borderColor: brand.suspiciousAccent,
              color: brand.suspiciousText,
            }}
          >
            Review now →
          </Link>
        </div>
      )}

      <div
        className="rounded-xl border bg-white"
        style={{ borderColor: colors.surface[200] }}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: colors.surface[200] }}
        >
          <div>
            <h2
              className="text-[15px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Recent submissions
            </h2>
            <p
              className="mt-0.5 text-[12px]"
              style={{ color: colors.text.muted }}
            >
              Latest student writing evidence
            </p>
          </div>
          <Link
            to={ROUTES.TEACHER_SUBMISSIONS}
            className="text-[12px] font-semibold"
            style={{ color: colors.brand }}
          >
            View all →
          </Link>
        </div>

        {data.recent_submissions.length === 0 ? (
          <EmptyState
            title="No submissions yet"
            message="Students haven't submitted any writing sessions to your courses yet."
          />
        ) : (
          <div
            className="divide-y"
            style={{ borderColor: colors.surface[200] }}
          >
            {data.recent_submissions.map((submission) => {
              const badge = classificationBadge(
                submission.classification_bucket,
              );
              return (
                <Link
                  key={submission.id}
                  to={ROUTES.TEACHER_REVIEW.replace(
                    ":sessionId",
                    String(submission.id),
                  )}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-[13px] font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      {submission.title}
                    </p>
                    <p
                      className="mt-0.5 text-[12px]"
                      style={{ color: colors.text.muted }}
                    >
                      {submission.student_name} · {submission.course_code} ·{" "}
                      {submission.created_at}
                    </p>
                  </div>
                  <span
                    className="rounded-md px-2 py-1 text-[11px] font-semibold"
                    style={{
                      background: badge.bg,
                      color: badge.text,
                      border: `1px solid ${badge.border}`,
                    }}
                  >
                    {badge.label}
                  </span>
                  <span
                    className="text-[12px] font-semibold"
                    style={{ color: colors.text.secondary }}
                  >
                    {submission.review_status}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
