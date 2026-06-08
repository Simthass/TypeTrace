// frontend/src/pages/teacher/TeacherDashboard.tsx

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  EmptyState,
  LoadingState,
  PageHeader,
} from "../../components/ui/PageState";
import { ROUTES } from "../../constants/routes";
import { api, getApiErrorMessage } from "../../lib/api";
import { brand, colors } from "../../styles/colors";
import type {
  TeacherCourse,
  TeacherDashboardResponse,
  TeacherSubmission,
  TeacherSummary,
} from "../../types/teacher";

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
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  sub: string;
  tone?: "neutral" | "blue" | "green" | "amber" | "red";
}) {
  const accent =
    tone === "green"
      ? brand.humanAccent
      : tone === "amber"
        ? brand.suspiciousAccent
        : tone === "red"
          ? brand.aiAccent
          : colors.brand;

  return (
    <div
      className="relative overflow-hidden rounded-xl border bg-white p-5"
      style={{
        borderColor: colors.surface[200],
        boxShadow: `0 18px 70px -52px ${colors.shadowStrong}`,
      }}
    >
      <div
        className="absolute right-[-26px] top-[-26px] h-20 w-20 rounded-full"
        style={{
          background: `${accent}14`,
        }}
      />

      <p
        className="text-[11px] font-bold uppercase tracking-[0.16em]"
        style={{ color: colors.text.secondary }}
      >
        {label}
      </p>

      <p
        className="mt-3 text-3xl font-bold tracking-[-0.04em]"
        style={{ color: colors.text.primary }}
      >
        {value}
      </p>

      <p className="mt-1 text-[13px]" style={{ color: colors.text.secondary }}>
        {sub}
      </p>

      <div
        className="mt-5 h-1.5 rounded-full"
        style={{ background: colors.surface[200] }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: "62%",
            background: accent,
          }}
        />
      </div>
    </div>
  );
}

function CourseCard({ course }: { course: TeacherCourse }) {
  return (
    <Link
      to={ROUTES.TEACHER_COURSE_DETAIL.replace(":courseId", String(course.id))}
      className="block rounded-xl border bg-white p-5 transition hover:-translate-y-0.5"
      style={{
        borderColor: colors.surface[200],
        boxShadow: `0 18px 70px -52px ${colors.shadowStrong}`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3
            className="text-[15px] font-bold"
            style={{ color: colors.text.primary }}
          >
            {course.course_name}
          </h3>

          <p
            className="mt-1 text-[12px]"
            style={{ color: colors.text.secondary }}
          >
            {course.course_code}
          </p>
        </div>

        <span
          className="rounded-md border px-2 py-1 font-mono text-[11px] font-bold"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[100],
            color: colors.text.primary,
          }}
        >
          {course.invite_code}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          ["Students", course.student_count],
          ["Sessions", course.submission_count],
          ["Pending", course.pending_count],
        ].map(([label, value]) => (
          <div key={label}>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ color: colors.text.secondary }}
            >
              {label}
            </p>
            <p
              className="mt-1 text-[16px] font-bold"
              style={{ color: colors.text.primary }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>
    </Link>
  );
}

function SubmissionRow({ submission }: { submission: TeacherSubmission }) {
  const style = badgeStyle(submission);

  return (
    <div
      className="grid grid-cols-1 gap-4 border-b px-5 py-4 last:border-b-0 md:grid-cols-[1.2fr_0.9fr_0.7fr_0.6fr_auto] md:items-center"
      style={{ borderColor: colors.surface[200] }}
    >
      <div>
        <p
          className="text-[14px] font-semibold"
          style={{ color: colors.text.primary }}
        >
          {submission.title}
        </p>
        <p
          className="mt-1 text-[12px]"
          style={{ color: colors.text.secondary }}
        >
          {submission.created_at}
        </p>
      </div>

      <div>
        <p
          className="text-[13px] font-medium"
          style={{ color: colors.text.primary }}
        >
          {submission.student_name}
        </p>
        <p className="text-[12px]" style={{ color: colors.text.secondary }}>
          {submission.course_code}
        </p>
      </div>

      <span
        className="w-fit rounded-md border px-2.5 py-1.5 text-[11px] font-bold"
        style={{
          borderColor: style.border,
          background: style.bg,
          color: style.text,
        }}
      >
        {style.label}
      </span>

      <p
        className="text-[13px] font-bold"
        style={{ color: colors.text.primary }}
      >
        {submission.confidence}%
      </p>

      <Link
        to={ROUTES.TEACHER_REVIEW.replace(":sessionId", String(submission.id))}
        className="w-fit rounded-md border px-3 py-2 text-[12px] font-semibold"
        style={{
          borderColor: colors.surface[200],
          color: colors.text.primary,
          background: colors.surface[50],
        }}
      >
        Review
      </Link>
    </div>
  );
}

function summaryFallback(): TeacherSummary {
  return {
    total_courses: 0,
    total_students: 0,
    total_submissions: 0,
    pending_reviews: 0,
    approved_reviews: 0,
    flagged_reviews: 0,
    human_submissions: 0,
    suspicious_submissions: 0,
    synthetic_submissions: 0,
    avg_confidence: 0,
    avg_wpm: 0,
  };
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

  const summary = data?.summary || summaryFallback();

  const reviewRate = useMemo(() => {
    if (!summary.total_submissions) return 0;
    return Math.round(
      ((summary.approved_reviews + summary.flagged_reviews) /
        summary.total_submissions) *
        100,
    );
  }, [summary]);

  if (isLoading) {
    return <LoadingState label="Loading teacher console..." />;
  }

  if (apiError) {
    return (
      <EmptyState
        title="Teacher dashboard could not be loaded"
        description={apiError}
        action={
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: colors.brand }}
          >
            Reload dashboard
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Teacher console"
        title="Review authorship evidence with clarity."
        description="Monitor courses, students, pending reviews, and high-risk writing sessions from one academic integrity workspace."
        action={
          <Link
            to={ROUTES.TEACHER_COURSES}
            className="rounded-md px-4 py-2.5 text-[13px] font-semibold text-white"
            style={{ background: colors.brand }}
          >
            Manage courses
          </Link>
        }
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Courses"
          value={summary.total_courses}
          sub="Active academic modules"
          tone="blue"
        />
        <MetricCard
          label="Students"
          value={summary.total_students}
          sub="Enrolled across courses"
          tone="green"
        />
        <MetricCard
          label="Pending reviews"
          value={summary.pending_reviews}
          sub="Need teacher decision"
          tone="amber"
        />
        <MetricCard
          label="Review completion"
          value={`${reviewRate}%`}
          sub="Approved or flagged"
          tone="blue"
        />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <div
          className="rounded-xl border bg-white"
          style={{
            borderColor: colors.surface[200],
            boxShadow: `0 18px 70px -52px ${colors.shadowStrong}`,
          }}
        >
          <div
            className="flex items-center justify-between border-b px-5 py-4"
            style={{ borderColor: colors.surface[200] }}
          >
            <div>
              <h2
                className="text-[15px] font-bold"
                style={{ color: colors.text.primary }}
              >
                Recent submissions
              </h2>
              <p
                className="mt-1 text-[12px]"
                style={{ color: colors.text.secondary }}
              >
                Latest writing sessions requiring review or audit.
              </p>
            </div>

            <Link
              to={ROUTES.TEACHER_SUBMISSIONS}
              className="rounded-md border px-3 py-2 text-[12px] font-semibold"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
              }}
            >
              View all
            </Link>
          </div>

          {!data?.recent_submissions?.length ? (
            <div className="p-5">
              <EmptyState
                compact
                title="No submissions yet"
                description="When students submit writing sessions, review-ready evidence will appear here."
                action={
                  <Link
                    to={ROUTES.TEACHER_COURSES}
                    className="rounded-md px-4 py-2 text-[13px] font-semibold text-white"
                    style={{ background: colors.brand }}
                  >
                    Create or manage courses
                  </Link>
                }
              />
            </div>
          ) : (
            data.recent_submissions.map((submission) => (
              <SubmissionRow key={submission.id} submission={submission} />
            ))
          )}
        </div>

        <aside
          className="rounded-xl border bg-white p-5"
          style={{
            borderColor: colors.surface[200],
            boxShadow: `0 18px 70px -52px ${colors.shadowStrong}`,
          }}
        >
          <p
            className="text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: colors.brand }}
          >
            Risk distribution
          </p>

          <h2
            className="mt-2 text-xl font-bold tracking-[-0.04em]"
            style={{ color: colors.text.primary }}
          >
            Submission quality
          </h2>

          <div className="mt-5 grid gap-4">
            {[
              ["Human", summary.human_submissions, brand.humanAccent],
              [
                "Review",
                summary.suspicious_submissions,
                brand.suspiciousAccent,
              ],
              ["High Risk", summary.synthetic_submissions, brand.aiAccent],
            ].map(([label, value, accent]) => {
              const total = Math.max(summary.total_submissions, 1);
              const pct = Math.round((Number(value) / total) * 100);

              return (
                <div key={label as string}>
                  <div className="flex justify-between text-[12px]">
                    <span
                      className="font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      {label}
                    </span>
                    <span style={{ color: colors.text.secondary }}>{pct}%</span>
                  </div>

                  <div
                    className="mt-2 h-2 rounded-full"
                    style={{ background: colors.surface[200] }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: accent as string,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p
              className="text-[11px] font-bold uppercase tracking-[0.16em]"
              style={{ color: colors.brand }}
            >
              Courses
            </p>
            <h2
              className="mt-2 text-xl font-bold tracking-[-0.04em]"
              style={{ color: colors.text.primary }}
            >
              Active course workspaces
            </h2>
          </div>

          <Link
            to={ROUTES.TEACHER_COURSES}
            className="rounded-md border px-3 py-2 text-[12px] font-semibold"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          >
            View courses
          </Link>
        </div>

        {!data?.courses?.length ? (
          <EmptyState
            title="No courses created yet"
            description="Create a course workspace and share the invite code with students to start collecting writing evidence."
            action={
              <Link
                to={ROUTES.TEACHER_COURSES}
                className="rounded-md px-4 py-2 text-[13px] font-semibold text-white"
                style={{ background: colors.brand }}
              >
                Create course
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {data.courses.slice(0, 3).map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
