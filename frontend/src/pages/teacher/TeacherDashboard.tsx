// frontend/src/pages/teacher/TeacherDashboard.tsx

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "../../components/ui/Badge";
import { ButtonLink } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { EmptyState, PageHeader } from "../../components/ui/PageState";
import { DashboardSkeleton } from "../../components/ui/Skeleton";
import { ROUTES } from "../../constants/routes";
import { api, getApiErrorMessage } from "../../lib/api";
import { useToast } from "../../components/ui/ToastProvider";
import { brand, colors } from "../../styles/colors";

interface TeacherSummary {
  total_courses: number;
  total_students: number;
  total_submissions: number;
  pending_reviews: number;
  approved_reviews: number;
  flagged_reviews: number;
  human_submissions: number;
  suspicious_submissions: number;
  synthetic_submissions: number;
  avg_confidence: number;
  avg_wpm: number;
}

interface TeacherCourse {
  id: number;
  course_name: string;
  course_code: string;
  invite_code: string;
  student_count: number;
  submission_count: number;
  pending_count: number;
}

interface TeacherSubmission {
  id: number;
  title: string;
  student_name: string;
  student_id: string;
  course_name: string;
  course_code: string;
  classification: string;
  classification_bucket: "HUMAN" | "SUSPICIOUS" | "SYNTHETIC" | "UNKNOWN";
  confidence: number;
  review_status: string;
  created_at: string;
}

interface TeacherDashboardResponse {
  status: string;
  summary: TeacherSummary;
  courses: TeacherCourse[];
  recent_submissions: TeacherSubmission[];
}

function fallbackSummary(): TeacherSummary {
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

function submissionBadge(submission: TeacherSubmission) {
  if (submission.classification_bucket === "HUMAN") {
    return {
      label: "Human",
      tone: "human" as const,
    };
  }

  if (submission.classification_bucket === "SUSPICIOUS") {
    return {
      label: "Review",
      tone: "suspicious" as const,
    };
  }

  return {
    label: "High Risk",
    tone: "danger" as const,
  };
}

function MetricCard({
  label,
  value,
  sub,
  tone = "brand",
}: {
  label: string;
  value: string | number;
  sub: string;
  tone?: "brand" | "green" | "amber" | "red";
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
    <Card className="relative overflow-hidden p-6">
      <div
        className="absolute right-[-32px] top-[-32px] h-24 w-24 rounded-full"
        style={{ background: `${accent}16` }}
      />

      <p
        className="text-[11px] font-bold uppercase tracking-[0.16em]"
        style={{ color: colors.text.secondary }}
      >
        {label}
      </p>

      <p
        className="mt-4 text-[2rem] font-bold tracking-[-0.05em]"
        style={{ color: colors.text.primary }}
      >
        {value}
      </p>

      <p className="mt-1 text-[13px]" style={{ color: colors.text.secondary }}>
        {sub}
      </p>
    </Card>
  );
}

function SubmissionRow({ submission }: { submission: TeacherSubmission }) {
  const badge = submissionBadge(submission);

  return (
    <div
      className="rounded-xl border bg-white p-4 transition hover:-translate-y-0.5"
      style={{
        borderColor: colors.surface[200],
        boxShadow: `0 14px 46px -38px ${colors.shadowStrong}`,
      }}
    >
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p
              className="text-[15px] font-bold"
              style={{ color: colors.text.primary }}
            >
              {submission.title || "Untitled Document"}
            </p>

            <Badge tone={badge.tone}>{badge.label}</Badge>
            <Badge tone="neutral">{submission.review_status}</Badge>
          </div>

          <p
            className="mt-2 text-[13px]"
            style={{ color: colors.text.secondary }}
          >
            {submission.student_name} · {submission.course_code} ·{" "}
            {submission.created_at}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ color: colors.text.secondary }}
            >
              Confidence
            </p>

            <p
              className="mt-1 text-[15px] font-bold"
              style={{ color: colors.text.primary }}
            >
              {submission.confidence}%
            </p>
          </div>

          <ButtonLink
            to={ROUTES.TEACHER_REVIEW.replace(
              ":sessionId",
              String(submission.id),
            )}
            size="sm"
          >
            Review
          </ButtonLink>
        </div>
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

        <Badge tone="brand">{course.invite_code}</Badge>
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

export default function TeacherDashboard() {
  const toast = useToast();

  const [data, setData] = useState<TeacherDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setIsLoading(true);

      try {
        const response =
          await api.get<TeacherDashboardResponse>("/teacher/dashboard");

        if (!mounted) return;
        setData(response.data);
      } catch (error) {
        if (!mounted) return;
        toast.error(
          "Teacher dashboard failed to load",
          getApiErrorMessage(error),
        );
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, [toast]);

  const summary = data?.summary || fallbackSummary();

  const reviewRate = useMemo(() => {
    if (!summary.total_submissions) return 0;

    return Math.round(
      ((summary.approved_reviews + summary.flagged_reviews) /
        summary.total_submissions) *
        100,
    );
  }, [summary]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Teacher console"
        title="Review authorship evidence with clarity."
        description="Prioritize high-risk submissions, monitor course activity, and review student writing trails from one workspace."
        action={
          <ButtonLink to={ROUTES.TEACHER_COURSES}>Manage courses</ButtonLink>
        }
      />

      <section
        className="relative overflow-hidden rounded-2xl border bg-white p-6"
        style={{
          borderColor: colors.surface[200],
          boxShadow: `0 24px 90px -58px ${colors.shadowStrong}`,
        }}
      >
        <div
          className="absolute right-[-80px] top-[-120px] h-72 w-72 rounded-full"
          style={{
            background: brand.suspiciousBg,
            filter: "blur(34px)",
          }}
        />

        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <p
              className="text-[11px] font-bold uppercase tracking-[0.18em]"
              style={{ color: colors.brand }}
            >
              Review queue
            </p>

            <h2
              className="mt-3 text-[2.6rem] font-bold tracking-[-0.06em]"
              style={{ color: colors.text.primary }}
            >
              {summary.pending_reviews} pending reviews
            </h2>

            <p
              className="mt-3 max-w-2xl text-[14px] leading-6"
              style={{ color: colors.text.secondary }}
            >
              High-risk and suspicious writing sessions should be reviewed first
              because they affect academic integrity decisions.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="suspicious">
              {summary.suspicious_submissions} suspicious
            </Badge>
            <Badge tone="danger">
              {summary.synthetic_submissions} high risk
            </Badge>
            <Badge tone="human">{summary.approved_reviews} approved</Badge>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Courses"
          value={summary.total_courses}
          sub="Active academic modules"
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
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        <Card elevated>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2
                  className="text-[15px] font-bold"
                  style={{ color: colors.text.primary }}
                >
                  Priority review queue
                </h2>

                <p
                  className="mt-1 text-[12px]"
                  style={{ color: colors.text.secondary }}
                >
                  Latest submissions requiring teacher interpretation.
                </p>
              </div>

              <ButtonLink
                to={ROUTES.TEACHER_SUBMISSIONS}
                variant="secondary"
                size="sm"
              >
                View all
              </ButtonLink>
            </div>
          </CardHeader>

          <CardBody>
            {!data?.recent_submissions?.length ? (
              <EmptyState
                compact
                icon="review"
                title="No submissions yet"
                description="When students submit writing sessions, review-ready evidence will appear here."
                action={
                  <ButtonLink to={ROUTES.TEACHER_COURSES} size="sm">
                    Manage courses
                  </ButtonLink>
                }
              />
            ) : (
              <div className="space-y-3">
                {data.recent_submissions.map((submission) => (
                  <SubmissionRow key={submission.id} submission={submission} />
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card elevated>
          <CardHeader>
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
          </CardHeader>

          <CardBody className="space-y-5">
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
                      className="font-bold"
                      style={{ color: colors.text.primary }}
                    >
                      {label}
                    </span>
                    <span style={{ color: colors.text.secondary }}>
                      {value} · {pct}%
                    </span>
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
          </CardBody>
        </Card>
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

          <ButtonLink to={ROUTES.TEACHER_COURSES} variant="secondary" size="sm">
            View courses
          </ButtonLink>
        </div>

        {!data?.courses?.length ? (
          <EmptyState
            icon="course"
            title="No courses created yet"
            description="Create a course workspace and share the invite code with students."
            action={
              <ButtonLink to={ROUTES.TEACHER_COURSES}>Create course</ButtonLink>
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
