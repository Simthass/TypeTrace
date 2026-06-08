// frontend/src/pages/DashboardPage.tsx

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Badge, classificationTone } from "../components/ui/Badge";
import { ButtonLink } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import {
  EmptyState,
  FirstRunEmptyState,
  LoadingState,
  PageHeader,
} from "../components/ui/PageState";
import { ROUTES } from "../constants/routes";
import { api, getApiErrorMessage } from "../lib/api";
import { useToast } from "../components/ui/ToastProvider";
import { brand, colors } from "../styles/colors";
import { useAuthStore } from "../store/authStore";

interface StudentSummary {
  total_sessions: number;
  avg_wpm: number;
  avg_confidence: number;
  total_seconds: number;
  certificate_count: number;
  human_sessions: number;
  suspicious_sessions: number;
  synthetic_sessions: number;
  approved_count: number;
  flagged_count: number;
  pending_count: number;
}

interface StudentSession {
  id: number;
  title: string;
  classification: string;
  classification_bucket: string;
  confidence: number;
  risk_level: string;
  review_status: string;
  wpm: number;
  duration_seconds: number;
  word_count: number;
  certificate_id?: string | null;
  course_name?: string | null;
  course_code?: string | null;
  created_at: string;
}

interface TrendPoint {
  day: string;
  session_count: number;
  avg_wpm: number;
  avg_confidence: number;
  human_count: number;
  suspicious_count: number;
  synthetic_count: number;
}

interface CourseBreakdown {
  course_name: string;
  course_code: string;
  session_count: number;
  avg_wpm: number;
  avg_confidence: number;
  human_count: number;
}

interface DashboardResponse {
  status: string;
  summary: StudentSummary;
  recent_sessions: StudentSession[];
  trend: TrendPoint[];
  courses: CourseBreakdown[];
}

function formatSeconds(value: number) {
  const safe = Math.max(0, Math.round(value || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function percentage(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function MetricCard({
  label,
  value,
  helper,
  tone = "brand",
}: {
  label: string;
  value: string | number;
  helper: string;
  tone?: "brand" | "human" | "warning" | "danger";
}) {
  const accent =
    tone === "human"
      ? brand.humanAccent
      : tone === "warning"
        ? brand.suspiciousAccent
        : tone === "danger"
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
        {helper}
      </p>
    </Card>
  );
}

function OnboardingChecklist({
  totalSessions,
  certificates,
  courses,
}: {
  totalSessions: number;
  certificates: number;
  courses: number;
}) {
  const items = [
    {
      label: "Write your first session",
      done: totalSessions > 0,
      action: ROUTES.EDITOR_NEW,
    },
    {
      label: "Generate an authorship certificate",
      done: certificates > 0,
      action: ROUTES.CERTIFICATES,
    },
    {
      label: "Join or link a course",
      done: courses > 0,
      action: ROUTES.JOIN_COURSE,
    },
  ];

  const completed = items.filter((item) => item.done).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2
              className="text-[15px] font-bold"
              style={{ color: colors.text.primary }}
            >
              Getting started
            </h2>
            <p
              className="mt-1 text-[12px]"
              style={{ color: colors.text.secondary }}
            >
              Complete these steps to prepare your authorship evidence workflow.
            </p>
          </div>

          <Badge tone={completed === items.length ? "human" : "brand"}>
            {completed}/{items.length}
          </Badge>
        </div>
      </CardHeader>

      <CardBody className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.label}
            to={item.action}
            className="flex items-center justify-between gap-4 rounded-md border p-3 transition hover:-translate-y-0.5"
            style={{
              borderColor: colors.surface[200],
              background: item.done ? brand.humanBg : colors.surface[50],
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-md border"
                style={{
                  borderColor: item.done
                    ? brand.humanAccent
                    : colors.surface[200],
                  background: item.done
                    ? brand.humanAccent
                    : colors.surface[100],
                  color: item.done ? colors.text.light : colors.text.secondary,
                }}
              >
                {item.done ? (
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                  >
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                ) : (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: colors.brand }}
                  />
                )}
              </span>

              <span
                className="text-[13px] font-bold"
                style={{ color: colors.text.primary }}
              >
                {item.label}
              </span>
            </div>

            <span
              className="text-[12px] font-semibold"
              style={{ color: item.done ? brand.humanText : colors.brand }}
            >
              {item.done ? "Done" : "Open"}
            </span>
          </Link>
        ))}
      </CardBody>
    </Card>
  );
}

function ActivityTrend({ trend }: { trend: TrendPoint[] }) {
  const maxSessions = Math.max(...trend.map((point) => point.session_count), 1);

  return (
    <Card>
      <CardHeader>
        <h2
          className="text-[15px] font-bold"
          style={{ color: colors.text.primary }}
        >
          14-day writing activity
        </h2>
        <p
          className="mt-1 text-[12px]"
          style={{ color: colors.text.secondary }}
        >
          Activity is scaled against your busiest day, not a fixed fake
          multiplier.
        </p>
      </CardHeader>

      <CardBody>
        {!trend.length ? (
          <EmptyState
            compact
            icon="session"
            title="No activity yet"
            description="Start a writing session to build your activity history and authorship trail."
            action={
              <ButtonLink to={ROUTES.EDITOR_NEW} size="sm">
                Start session
              </ButtonLink>
            }
          />
        ) : (
          <div className="grid grid-cols-7 gap-2 md:grid-cols-14">
            {trend.map((point) => {
              const intensity = Math.max(
                12,
                Math.round((point.session_count / maxSessions) * 100),
              );

              return (
                <div key={point.day} className="space-y-2">
                  <div
                    className="h-16 rounded-md border"
                    title={`${point.day}: ${point.session_count} sessions`}
                    style={{
                      borderColor: colors.surface[200],
                      background:
                        point.session_count > 0
                          ? `linear-gradient(to top, ${colors.brand} ${intensity}%, ${colors.brandSoft} ${intensity}%)`
                          : colors.surface[100],
                    }}
                  />

                  <p
                    className="truncate text-center text-[10px]"
                    style={{ color: colors.text.muted }}
                  >
                    {point.day.slice(5)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function RecentSessionCard({ session }: { session: StudentSession }) {
  const tone = classificationTone(
    session.classification_bucket || session.classification,
  );

  return (
    <Link
      to={ROUTES.REPLAY.replace(":sessionId", String(session.id))}
      className="block rounded-xl border bg-white p-4 transition hover:-translate-y-0.5"
      style={{
        borderColor: colors.surface[200],
        boxShadow: `0 14px 46px -38px ${colors.shadowStrong}`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className="text-[14px] font-bold"
            style={{ color: colors.text.primary }}
          >
            {session.title || "Untitled Document"}
          </p>

          <p
            className="mt-1 text-[12px]"
            style={{ color: colors.text.secondary }}
          >
            {session.course_code || "Personal"} · {session.created_at}
          </p>
        </div>

        <Badge tone={tone}>
          {session.classification_bucket || session.classification}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: colors.text.secondary }}
          >
            Confidence
          </p>
          <p
            className="mt-1 text-[14px] font-bold"
            style={{ color: colors.text.primary }}
          >
            {session.confidence}%
          </p>
        </div>

        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: colors.text.secondary }}
          >
            WPM
          </p>
          <p
            className="mt-1 text-[14px] font-bold"
            style={{ color: colors.text.primary }}
          >
            {session.wpm}
          </p>
        </div>

        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: colors.text.secondary }}
          >
            Words
          </p>
          <p
            className="mt-1 text-[14px] font-bold"
            style={{ color: colors.text.primary }}
          >
            {session.word_count}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const toast = useToast();
  const { user } = useAuthStore();

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setIsLoading(true);

      try {
        const response = await api.get<DashboardResponse>("/student/dashboard");

        if (!mounted) return;
        setData(response.data);
      } catch (error) {
        if (!mounted) return;
        toast.error("Dashboard failed to load", getApiErrorMessage(error));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, [toast]);

  const summary = data?.summary;

  const humanRate = useMemo(() => {
    if (!summary) return 0;
    return percentage(summary.human_sessions, summary.total_sessions);
  }, [summary]);

  if (isLoading) {
    return <LoadingState label="Loading student dashboard..." />;
  }

  if (!data || !summary) {
    return (
      <EmptyState
        icon="session"
        title="Dashboard data is unavailable"
        description="The dashboard could not load your writing history. Try refreshing the page."
        action={
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md px-4 py-2 text-[13px] font-bold"
            style={{ background: colors.brand, color: colors.text.light }}
          >
            Reload dashboard
          </button>
        }
      />
    );
  }

  const hasNoActivity = summary.total_sessions === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Student workspace"
        title={`Welcome back, ${user?.first_name || "student"}.`}
        description="Track your authorship evidence, writing quality, certificates, and course-linked submissions from one workspace."
        action={
          <ButtonLink to={ROUTES.EDITOR_NEW}>New writing session</ButtonLink>
        }
      />

      {hasNoActivity ? <FirstRunEmptyState /> : null}

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
            background: colors.brandSoft,
            filter: "blur(30px)",
          }}
        />

        <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <p
              className="text-[11px] font-bold uppercase tracking-[0.18em]"
              style={{ color: colors.brand }}
            >
              Authorship health
            </p>

            <h2
              className="mt-3 text-[2.6rem] font-bold tracking-[-0.06em]"
              style={{ color: colors.text.primary }}
            >
              {humanRate}% human pattern rate
            </h2>

            <p
              className="mt-3 max-w-2xl text-[14px] leading-6"
              style={{ color: colors.text.secondary }}
            >
              This score summarizes how many of your writing sessions were
              classified as human writing patterns. Use replay and certificates
              to prove your process when needed.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Badge tone="human">{summary.human_sessions} human</Badge>
              <Badge tone="suspicious">
                {summary.suspicious_sessions} review
              </Badge>
              <Badge tone="danger">
                {summary.synthetic_sessions} high risk
              </Badge>
              <Badge tone="brand">
                {summary.certificate_count} certificates
              </Badge>
            </div>
          </div>

          <OnboardingChecklist
            totalSessions={summary.total_sessions}
            certificates={summary.certificate_count}
            courses={data.courses.length}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total sessions"
          value={summary.total_sessions}
          helper="Captured writing trails"
        />
        <MetricCard
          label="Average WPM"
          value={summary.avg_wpm}
          helper="Across completed sessions"
          tone="human"
        />
        <MetricCard
          label="Avg confidence"
          value={`${summary.avg_confidence}%`}
          helper="ML-assisted classification"
        />
        <MetricCard
          label="Writing time"
          value={formatSeconds(summary.total_seconds)}
          helper="Total captured duration"
          tone="warning"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        <ActivityTrend trend={data.trend} />

        <Card>
          <CardHeader>
            <h2
              className="text-[15px] font-bold"
              style={{ color: colors.text.primary }}
            >
              Course breakdown
            </h2>
            <p
              className="mt-1 text-[12px]"
              style={{ color: colors.text.secondary }}
            >
              Evidence grouped by academic context.
            </p>
          </CardHeader>

          <CardBody>
            {!data.courses.length ? (
              <EmptyState
                compact
                icon="course"
                title="No course linked yet"
                description="Join a course to submit evidence directly to a teacher workspace."
                action={
                  <ButtonLink to={ROUTES.JOIN_COURSE} size="sm">
                    Join course
                  </ButtonLink>
                }
              />
            ) : (
              <div className="space-y-3">
                {data.courses.map((course) => (
                  <div
                    key={`${course.course_code}-${course.course_name}`}
                    className="rounded-md border p-3"
                    style={{
                      borderColor: colors.surface[200],
                      background: colors.surface[50],
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p
                          className="text-[13px] font-bold"
                          style={{ color: colors.text.primary }}
                        >
                          {course.course_name}
                        </p>
                        <p
                          className="mt-1 text-[12px]"
                          style={{ color: colors.text.secondary }}
                        >
                          {course.course_code}
                        </p>
                      </div>

                      <Badge tone="brand">
                        {course.session_count} sessions
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              Recent evidence
            </p>
            <h2
              className="mt-2 text-xl font-bold tracking-[-0.04em]"
              style={{ color: colors.text.primary }}
            >
              Latest writing sessions
            </h2>
          </div>

          <ButtonLink to={ROUTES.SESSIONS} variant="secondary" size="sm">
            View all sessions
          </ButtonLink>
        </div>

        {!data.recent_sessions.length ? (
          <EmptyState
            icon="session"
            title="No sessions captured yet"
            description="Start your first writing session to generate behavioral authorship evidence."
            action={
              <ButtonLink to={ROUTES.EDITOR_NEW}>Start writing</ButtonLink>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {data.recent_sessions.map((session) => (
              <RecentSessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
