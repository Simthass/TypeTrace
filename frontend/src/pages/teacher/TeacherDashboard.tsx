// frontend/src/pages/teacher/TeacherDashboard.tsx

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, getApiErrorMessage } from "../../lib/api";
import { ROUTES } from "../../constants/routes";
import { colors, brand } from "../../styles/colors";
import type {
  TeacherDashboardResponse,
  TeacherSubmission,
} from "../../types/teacher";

function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
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

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div
      className="rounded-md border bg-white px-4 py-3 shadow-sm"
      style={{ borderColor: colors.surface[200] }}
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: colors.text.secondary }}
      >
        {label}
      </p>
      <p
        className="mt-2 text-2xl font-semibold"
        style={{ color: colors.text.primary }}
      >
        {value}
      </p>
      {sub && (
        <p
          className="mt-1 text-[12px]"
          style={{ color: colors.text.secondary }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function SubmissionRow({ submission }: { submission: TeacherSubmission }) {
  const style = badgeStyle(submission);

  return (
    <div
      className="flex flex-col gap-3 border-b px-5 py-4 last:border-b-0 md:flex-row md:items-center md:justify-between"
      style={{ borderColor: colors.surface[200] }}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            className="truncate text-[14px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            {submission.title}
          </h3>
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
          {submission.student_name} · {submission.course_code} ·{" "}
          {submission.created_at}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[12px]">
        <span style={{ color: colors.text.secondary }}>
          {submission.confidence}% confidence
        </span>
        <span style={{ color: colors.text.secondary }}>
          {submission.review_status}
        </span>
        <Link
          to={`/teacher/review/${submission.id}`}
          className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 font-semibold"
          style={{
            borderColor: colors.surface[200],
            color: colors.text.primary,
          }}
        >
          Review <ArrowIcon />
        </Link>
      </div>
    </div>
  );
}

export default function TeacherDashboard() {
  const [data, setData] = useState<TeacherDashboardResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setIsLoading(true);
      setApiError(null);

      try {
        const response =
          await api.get<TeacherDashboardResponse>("/teacher/dashboard");
        if (!mounted) return;
        setData(response.data);
      } catch (error) {
        if (!mounted) return;
        setApiError(getApiErrorMessage(error));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const summary = data?.summary;

  const reviewCompletionRate = useMemo(() => {
    if (!summary || summary.total_submissions === 0) return 0;
    return Math.round(
      ((summary.approved_reviews + summary.flagged_reviews) /
        summary.total_submissions) *
        100,
    );
  }, [summary]);

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
              Teacher workspace
            </p>
            <h1
              className="mt-2 text-2xl font-semibold"
              style={{ color: colors.text.primary }}
            >
              Welcome back
              {data?.teacher?.first_name ? `, ${data.teacher.first_name}` : ""}
            </h1>
            <p
              className="mt-2 max-w-2xl text-[14px]"
              style={{ color: colors.text.secondary }}
            >
              Manage courses, review student submissions, and verify behavioral
              authorship evidence.
            </p>
          </div>

          <Link
            to={ROUTES.TEACHER_COURSES}
            className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: colors.brand }}
          >
            <PlusIcon />
            Create Course
          </Link>
        </div>

        {apiError && (
          <div
            className="mt-6 rounded-md border px-4 py-3 text-[13px]"
            style={{
              borderColor: brand.aiAccent,
              background: brand.aiBg,
              color: brand.aiText,
            }}
          >
            {apiError}
          </div>
        )}

        {isLoading ? (
          <div
            className="mt-6 rounded-md border bg-white px-5 py-10 text-center text-[13px]"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.secondary,
            }}
          >
            Loading teacher dashboard...
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Courses"
                value={summary?.total_courses ?? 0}
                sub={`${summary?.total_students ?? 0} enrolled students`}
              />
              <MetricCard
                label="Submissions"
                value={summary?.total_submissions ?? 0}
                sub={`${summary?.pending_reviews ?? 0} pending reviews`}
              />
              <MetricCard
                label="Review Progress"
                value={`${reviewCompletionRate}%`}
                sub={`${summary?.approved_reviews ?? 0} approved · ${summary?.flagged_reviews ?? 0} flagged`}
              />
              <MetricCard
                label="Avg Confidence"
                value={`${summary?.avg_confidence ?? 0}%`}
                sub={`${summary?.avg_wpm ?? 0} average WPM`}
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <div
                className="rounded-md border bg-white p-5 shadow-sm lg:col-span-2"
                style={{ borderColor: colors.surface[200] }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2
                      className="text-[15px] font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      Recent submissions
                    </h2>
                    <p
                      className="mt-1 text-[13px]"
                      style={{ color: colors.text.secondary }}
                    >
                      Latest course-linked writing evidence from your students.
                    </p>
                  </div>

                  <Link
                    to={ROUTES.TEACHER_SUBMISSIONS}
                    className="text-[13px] font-semibold"
                    style={{ color: colors.brand }}
                  >
                    View all
                  </Link>
                </div>

                <div
                  className="mt-4 overflow-hidden rounded-md border"
                  style={{ borderColor: colors.surface[200] }}
                >
                  {data?.recent_submissions?.length ? (
                    data.recent_submissions.map((submission) => (
                      <SubmissionRow
                        key={submission.id}
                        submission={submission}
                      />
                    ))
                  ) : (
                    <div className="px-5 py-8 text-center">
                      <p
                        className="text-[14px] font-semibold"
                        style={{ color: colors.text.primary }}
                      >
                        No submissions yet
                      </p>
                      <p
                        className="mt-1 text-[13px]"
                        style={{ color: colors.text.secondary }}
                      >
                        Share a course invite code so students can submit
                        writing evidence.
                      </p>
                    </div>
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
                  Classification mix
                </h2>
                <p
                  className="mt-1 text-[13px]"
                  style={{ color: colors.text.secondary }}
                >
                  Distribution of student submission outcomes.
                </p>

                <div className="mt-4 space-y-3">
                  {[
                    [
                      "Human",
                      summary?.human_submissions ?? 0,
                      brand.humanBg,
                      brand.humanText,
                    ],
                    [
                      "Review",
                      summary?.suspicious_submissions ?? 0,
                      brand.suspiciousBg,
                      brand.suspiciousText,
                    ],
                    [
                      "High Risk",
                      summary?.synthetic_submissions ?? 0,
                      brand.aiBg,
                      brand.aiText,
                    ],
                  ].map(([label, value, bg, text]) => (
                    <div
                      key={String(label)}
                      className="flex items-center justify-between rounded-md px-3 py-2"
                      style={{ background: String(bg), color: String(text) }}
                    >
                      <span className="text-[13px] font-semibold">{label}</span>
                      <span className="text-[13px] font-bold">{value}</span>
                    </div>
                  ))}
                </div>

                <Link
                  to={ROUTES.TEACHER_STUDENTS}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-[13px] font-semibold"
                  style={{
                    borderColor: colors.surface[200],
                    color: colors.text.primary,
                  }}
                >
                  View students <ArrowIcon />
                </Link>
              </div>
            </div>

            <div
              className="mt-6 rounded-md border bg-white p-5 shadow-sm"
              style={{ borderColor: colors.surface[200] }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2
                    className="text-[15px] font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    Active courses
                  </h2>
                  <p
                    className="mt-1 text-[13px]"
                    style={{ color: colors.text.secondary }}
                  >
                    Your most recent courses and invite codes.
                  </p>
                </div>

                <Link
                  to={ROUTES.TEACHER_COURSES}
                  className="text-[13px] font-semibold"
                  style={{ color: colors.brand }}
                >
                  Manage
                </Link>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {data?.courses?.length ? (
                  data.courses.map((course) => (
                    <Link
                      key={course.id}
                      to={`/teacher/courses/${course.id}`}
                      className="rounded-md border px-4 py-3"
                      style={{
                        borderColor: colors.surface[200],
                        background: "#FFFFFF",
                      }}
                    >
                      <p
                        className="text-[14px] font-semibold"
                        style={{ color: colors.text.primary }}
                      >
                        {course.course_name}
                      </p>
                      <p
                        className="mt-1 text-[12px]"
                        style={{ color: colors.text.secondary }}
                      >
                        {course.course_code} · Invite {course.invite_code}
                      </p>
                      <p
                        className="mt-3 text-[12px]"
                        style={{ color: colors.text.secondary }}
                      >
                        {course.student_count} students ·{" "}
                        {course.submission_count} submissions
                      </p>
                    </Link>
                  ))
                ) : (
                  <div
                    className="rounded-md border px-4 py-8 text-center lg:col-span-3"
                    style={{ borderColor: colors.surface[200] }}
                  >
                    <p
                      className="text-[13px]"
                      style={{ color: colors.text.secondary }}
                    >
                      No courses created yet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
