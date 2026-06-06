// frontend/src/pages/AnalyticsPage.tsx

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, getApiErrorMessage } from "../lib/api";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";
import type { StudentAnalyticsResponse } from "../types/student";

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function StatCard({
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

export default function AnalyticsPage() {
  const [data, setData] = useState<StudentAnalyticsResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadAnalytics() {
      setIsLoading(true);
      setApiError(null);

      try {
        const response =
          await api.get<StudentAnalyticsResponse>("/student/analytics");

        if (!mounted) return;
        setData(response.data);
      } catch (error) {
        if (!mounted) return;
        setApiError(getApiErrorMessage(error));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadAnalytics();

    return () => {
      mounted = false;
    };
  }, []);

  const maxSessions = useMemo(() => {
    if (!data?.daily?.length) return 1;
    return Math.max(...data.daily.map((point) => point.session_count), 1);
  }, [data]);

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
              Behavioral writing analytics
            </p>
            <h1
              className="mt-2 text-2xl font-semibold"
              style={{ color: colors.text.primary }}
            >
              Analytics
            </h1>
            <p
              className="mt-2 max-w-2xl text-[14px]"
              style={{ color: colors.text.secondary }}
            >
              Understand your writing speed, confidence, revision behavior, and
              course-level evidence.
            </p>
          </div>

          <Link
            to={ROUTES.SESSIONS}
            className="rounded-md border px-4 py-2 text-[13px] font-semibold"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
              background: "#FFFFFF",
            }}
          >
            View sessions
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
            Loading analytics...
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Best WPM"
                value={data?.bests.best_wpm ?? 0}
                sub="Fastest captured session"
              />
              <StatCard
                label="Best Confidence"
                value={`${data?.bests.best_confidence ?? 0}%`}
                sub="Highest model confidence"
              />
              <StatCard
                label="Longest Session"
                value={formatDuration(data?.bests.longest_session ?? 0)}
                sub="Longest writing duration"
              />
              <StatCard
                label="Total Time"
                value={formatDuration(data?.bests.total_seconds ?? 0)}
                sub={`${data?.bests.total_sessions ?? 0} sessions`}
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <div
                className="rounded-md border bg-white p-5 shadow-sm lg:col-span-2"
                style={{ borderColor: colors.surface[200] }}
              >
                <h2
                  className="text-[15px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  30-day writing activity
                </h2>
                <p
                  className="mt-1 text-[13px]"
                  style={{ color: colors.text.secondary }}
                >
                  Session count, average WPM, and average confidence by day.
                </p>

                <div className="mt-5 space-y-4">
                  {data?.daily?.length ? (
                    data.daily.map((point) => (
                      <div key={point.day}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-[12px]">
                          <span style={{ color: colors.text.secondary }}>
                            {point.day}
                          </span>
                          <span style={{ color: colors.text.primary }}>
                            {point.session_count} sessions · {point.avg_wpm} WPM
                            · {point.avg_confidence}%
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
                              width: `${Math.max(8, (point.session_count / maxSessions) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div
                      className="rounded-md border px-4 py-8 text-center"
                      style={{ borderColor: colors.surface[200] }}
                    >
                      <p
                        className="text-[13px]"
                        style={{ color: colors.text.secondary }}
                      >
                        No analytics data yet. Create a writing session first.
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
                  Behavior totals
                </h2>
                <div className="mt-4 space-y-3">
                  {[
                    [
                      "Total Keys",
                      data?.daily.reduce(
                        (sum, item) => sum + item.total_keys,
                        0,
                      ) ?? 0,
                    ],
                    [
                      "Deletions",
                      data?.daily.reduce(
                        (sum, item) => sum + item.deletions,
                        0,
                      ) ?? 0,
                    ],
                    [
                      "Pauses",
                      data?.daily.reduce((sum, item) => sum + item.pauses, 0) ??
                        0,
                    ],
                    ["Best IKI", `${data?.bests.best_iki ?? 0}ms`],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                      style={{ borderColor: colors.surface[200] }}
                    >
                      <span
                        className="text-[13px]"
                        style={{ color: colors.text.secondary }}
                      >
                        {label}
                      </span>
                      <span
                        className="text-[13px] font-semibold"
                        style={{ color: colors.text.primary }}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div
              className="mt-6 rounded-md border bg-white p-5 shadow-sm"
              style={{ borderColor: colors.surface[200] }}
            >
              <h2
                className="text-[15px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                Course performance
              </h2>
              <p
                className="mt-1 text-[13px]"
                style={{ color: colors.text.secondary }}
              >
                Compare writing evidence across personal and course-linked
                sessions.
              </p>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {data?.courses?.length ? (
                  data.courses.map((course) => (
                    <div
                      key={`${course.course_name}-${course.course_code}`}
                      className="rounded-md border px-4 py-3"
                      style={{ borderColor: colors.surface[200] }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3
                            className="text-[14px] font-semibold"
                            style={{ color: colors.text.primary }}
                          >
                            {course.course_name}
                          </h3>
                          <p
                            className="mt-1 text-[12px]"
                            style={{ color: colors.text.secondary }}
                          >
                            {course.course_code || "Personal"}
                          </p>
                        </div>
                        <span
                          className="text-[13px] font-semibold"
                          style={{ color: colors.brand }}
                        >
                          {course.session_count} sessions
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-3">
                        {[
                          ["WPM", course.avg_wpm],
                          ["Confidence", `${course.avg_confidence}%`],
                          ["Human", course.human_count],
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
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div
                    className="rounded-md border px-4 py-8 text-center lg:col-span-2"
                    style={{ borderColor: colors.surface[200] }}
                  >
                    <p
                      className="text-[13px]"
                      style={{ color: colors.text.secondary }}
                    >
                      No course-linked analytics yet.
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
