// frontend/src/pages/DashboardPage.tsx

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, getApiErrorMessage } from "../lib/api";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";
import type {
  StudentDashboardResponse,
  StudentSessionItem,
} from "../types/student";

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

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getSessionBadge(session: StudentSessionItem) {
  if (session.classification_bucket === "HUMAN") {
    return {
      label: "Human",
      bg: brand.humanBg,
      text: brand.humanText,
      border: brand.humanAccent,
    };
  }

  if (session.classification_bucket === "SUSPICIOUS") {
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

function RecentSessionRow({ session }: { session: StudentSessionItem }) {
  const badge = getSessionBadge(session);

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
            {session.title}
          </h3>
          <span
            className="rounded-md border px-2 py-0.5 text-[11px] font-semibold"
            style={{
              background: badge.bg,
              color: badge.text,
              borderColor: badge.border,
            }}
          >
            {badge.label}
          </span>
        </div>
        <p
          className="mt-1 text-[12px]"
          style={{ color: colors.text.secondary }}
        >
          {session.created_at}
          {session.course_name ? ` · ${session.course_name}` : " · Personal"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[12px]">
        <span style={{ color: colors.text.secondary }}>{session.wpm} WPM</span>
        <span style={{ color: colors.text.secondary }}>
          {session.confidence}% confidence
        </span>
        <Link
          to={`/session/${session.id}/replay`}
          className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 font-semibold"
          style={{
            borderColor: colors.surface[200],
            color: colors.text.primary,
          }}
        >
          Replay <ArrowIcon />
        </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<StudentDashboardResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setIsLoading(true);
      setApiError(null);

      try {
        const response =
          await api.get<StudentDashboardResponse>("/student/dashboard");
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

  const humanRate = useMemo(() => {
    if (!summary || summary.total_sessions === 0) return 0;
    return Math.round((summary.human_sessions / summary.total_sessions) * 100);
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
              Student workspace
            </p>
            <h1
              className="mt-2 text-2xl font-semibold"
              style={{ color: colors.text.primary }}
            >
              Welcome back
              {data?.student?.first_name ? `, ${data.student.first_name}` : ""}
            </h1>
            <p
              className="mt-2 max-w-2xl text-[14px]"
              style={{ color: colors.text.secondary }}
            >
              Track your writing evidence, certificates, review status, and
              behavioral authorship history.
            </p>
          </div>

          <Link
            to={ROUTES.EDITOR_NEW}
            className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: colors.brand }}
          >
            <PlusIcon />
            New Session
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
            Loading dashboard...
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Total Sessions"
                value={summary?.total_sessions ?? 0}
                sub={`${summary?.certificate_count ?? 0} certificates generated`}
              />
              <MetricCard
                label="Average WPM"
                value={summary?.avg_wpm ?? 0}
                sub={`${formatDuration(summary?.total_seconds ?? 0)} total writing time`}
              />
              <MetricCard
                label="Human Rate"
                value={`${humanRate}%`}
                sub={`${summary?.human_sessions ?? 0} human sessions`}
              />
              <MetricCard
                label="Avg Confidence"
                value={`${summary?.avg_confidence ?? 0}%`}
                sub={`${summary?.pending_count ?? 0} pending reviews`}
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
                      Recent writing sessions
                    </h2>
                    <p
                      className="mt-1 text-[13px]"
                      style={{ color: colors.text.secondary }}
                    >
                      Latest writing evidence captured by TypeTrace.
                    </p>
                  </div>

                  <Link
                    to={ROUTES.SESSIONS}
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
                  {data?.recent_sessions?.length ? (
                    data.recent_sessions.map((session) => (
                      <RecentSessionRow key={session.id} session={session} />
                    ))
                  ) : (
                    <div className="px-5 py-8 text-center">
                      <p
                        className="text-[14px] font-semibold"
                        style={{ color: colors.text.primary }}
                      >
                        No writing sessions yet
                      </p>
                      <p
                        className="mt-1 text-[13px]"
                        style={{ color: colors.text.secondary }}
                      >
                        Start your first session to generate authorship
                        evidence.
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
                  Review status
                </h2>
                <p
                  className="mt-1 text-[13px]"
                  style={{ color: colors.text.secondary }}
                >
                  Teacher review progress across your sessions.
                </p>

                <div className="mt-4 space-y-3">
                  {[
                    [
                      "Approved",
                      summary?.approved_count ?? 0,
                      brand.humanBg,
                      brand.humanText,
                    ],
                    [
                      "Pending",
                      summary?.pending_count ?? 0,
                      brand.suspiciousBg,
                      brand.suspiciousText,
                    ],
                    [
                      "Flagged",
                      summary?.flagged_count ?? 0,
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
                  to={ROUTES.ANALYTICS}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-[13px] font-semibold"
                  style={{
                    borderColor: colors.surface[200],
                    color: colors.text.primary,
                  }}
                >
                  Open analytics <ArrowIcon />
                </Link>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div
                className="rounded-md border bg-white p-5 shadow-sm"
                style={{ borderColor: colors.surface[200] }}
              >
                <h2
                  className="text-[15px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  14-day activity trend
                </h2>
                <div className="mt-4 space-y-3">
                  {data?.trend?.length ? (
                    data.trend.map((point) => (
                      <div key={point.day}>
                        <div className="mb-1 flex items-center justify-between text-[12px]">
                          <span style={{ color: colors.text.secondary }}>
                            {point.day}
                          </span>
                          <span style={{ color: colors.text.primary }}>
                            {point.session_count} sessions
                          </span>
                        </div>
                        <div
                          className="h-2 rounded-full"
                          style={{ background: colors.surface[100] }}
                        >
                          <div
                            className="h-2 rounded-full"
                            style={{
                              background: colors.brand,
                              width: `${Math.min(point.session_count * 20, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p
                      className="text-[13px]"
                      style={{ color: colors.text.secondary }}
                    >
                      No recent trend data yet.
                    </p>
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
                  Course breakdown
                </h2>
                <div className="mt-4 space-y-3">
                  {data?.courses?.length ? (
                    data.courses.map((course) => (
                      <div
                        key={`${course.course_name}-${course.course_code}`}
                        className="rounded-md border px-3 py-3"
                        style={{ borderColor: colors.surface[200] }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p
                              className="text-[13px] font-semibold"
                              style={{ color: colors.text.primary }}
                            >
                              {course.course_name}
                            </p>
                            <p
                              className="text-[12px]"
                              style={{ color: colors.text.secondary }}
                            >
                              {course.course_code || "Personal"}
                            </p>
                          </div>
                          <span
                            className="text-[13px] font-semibold"
                            style={{ color: colors.brand }}
                          >
                            {course.session_count}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p
                      className="text-[13px]"
                      style={{ color: colors.text.secondary }}
                    >
                      No course-linked sessions yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
