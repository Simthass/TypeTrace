// frontend/src/pages/DashboardPage.tsx

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ROUTES } from "../constants/routes";
import { api, getApiErrorMessage } from "../lib/api";
import { useToast } from "../components/ui/ToastProvider";
import { brand, colors } from "../styles/colors";
import { useAuthStore } from "../store/authStore";
import { API_ROUTES } from "../constants/apiRoutes";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatSeconds(value: number): string {
  const safe = Math.max(0, Math.round(value ?? 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function pct(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function classificationStyle(bucket: string) {
  const b = bucket?.toUpperCase();
  if (b === "HUMAN")
    return {
      bg: brand.humanBg,
      text: brand.humanText,
      border: brand.humanAccent,
      dot: colors.green,
      label: "Human",
    };
  if (b === "SUSPICIOUS")
    return {
      bg: brand.suspiciousBg,
      text: brand.suspiciousText,
      border: brand.suspiciousAccent,
      dot: colors.amber,
      label: "Suspicious",
    };
  return {
    bg: brand.aiBg,
    text: brand.aiText,
    border: brand.aiAccent,
    dot: colors.red,
    label: "High Risk",
  };
}

function reviewStyle(status: string) {
  const s = status?.toUpperCase();
  if (s === "APPROVED")
    return { bg: brand.humanBg, text: brand.humanText, label: "Approved" };
  if (s === "FLAGGED")
    return { bg: brand.aiBg, text: brand.aiText, label: "Flagged" };
  return {
    bg: colors.surface[150],
    text: colors.text.secondary,
    label: "Pending",
  };
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md ${className}`}
      style={{ background: colors.surface[200] }}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      {/* Health bar skeleton */}
      <div
        className="rounded-xl border p-6 space-y-4"
        style={{
          borderColor: colors.surface[200],
          background: colors.surface[50],
        }}
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-8 w-full rounded-full" />
        <div className="flex gap-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>

      {/* Metric cards skeleton */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border p-5 space-y-3"
            style={{
              borderColor: colors.surface[200],
              background: colors.surface[50],
            }}
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Activity + courses skeleton */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <div
          className="rounded-xl border p-5 space-y-4"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[50],
          }}
        >
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2 h-16">
            {Array.from({ length: 14 }).map((_, i) => (
              <Skeleton key={i} className="flex-1" />
            ))}
          </div>
        </div>
        <div
          className="rounded-xl border p-5 space-y-4"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[50],
          }}
        >
          <Skeleton className="h-4 w-28" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  helper,
  accentColor,
  trend,
}: {
  label: string;
  value: string | number;
  helper: string;
  accentColor?: string;
  trend?: { value: string; positive: boolean } | null;
}) {
  return (
    <div
      className="flex flex-col rounded-xl border bg-white p-5 transition-shadow duration-150 hover:shadow-md"
      style={{ borderColor: colors.surface[200] }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-[0.18em]"
        style={{ color: colors.text.muted }}
      >
        {label}
      </p>

      <p
        className="mt-3 text-[2rem] font-bold leading-none tracking-[-0.04em]"
        style={{ color: accentColor ?? colors.text.primary }}
      >
        {value}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <p className="text-[12px]" style={{ color: colors.text.secondary }}>
          {helper}
        </p>
        {trend && (
          <span
            className="text-[11px] font-semibold"
            style={{ color: trend.positive ? colors.green : colors.red }}
          >
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Authorship health bar — signature element ────────────────────────────────
// A single segmented bar that shows human / suspicious / risk split at a glance.
// Far more information-dense and memorable than the blurred gradient hero.

function AuthorshipHealthBar({ summary }: { summary: StudentSummary }) {
  const total = summary.total_sessions;
  const humanPct = pct(summary.human_sessions, total);
  const suspiciousPct = pct(summary.suspicious_sessions, total);
  const riskPct = pct(summary.synthetic_sessions, total);

  const pendingReview =
    (summary.pending_count ?? 0) + (summary.flagged_count ?? 0);

  return (
    <div
      className="rounded-xl border bg-white p-6"
      style={{ borderColor: colors.surface[200] }}
    >
      {/* Header row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ color: colors.brand }}
          >
            Authorship health
          </p>
          <h2
            className="mt-1 text-[1.75rem] font-bold tracking-[-0.04em] leading-none"
            style={{ color: colors.text.primary }}
          >
            {total === 0 ? "—" : `${humanPct}%`}
            <span
              className="ml-2 text-[14px] font-medium tracking-normal"
              style={{ color: colors.text.secondary }}
            >
              {total === 0 ? "No sessions yet" : "classified as human writing"}
            </span>
          </h2>
        </div>

        {/* Review queue pill */}
        {pendingReview > 0 && (
          <div
            className="flex shrink-0 items-center gap-2 self-start rounded-lg border px-3 py-[7px]"
            style={{
              borderColor: brand.suspiciousAccent,
              background: brand.suspiciousBg,
            }}
          >
            <span
              className="h-[7px] w-[7px] animate-pulse rounded-full"
              style={{ background: colors.amber }}
            />
            <span
              className="text-[12px] font-semibold"
              style={{ color: brand.suspiciousText }}
            >
              {pendingReview} pending review
            </span>
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="mt-5">
          <div
            className="flex h-[10px] w-full overflow-hidden rounded-full"
            style={{ background: colors.surface[200] }}
            title={`${humanPct}% human · ${suspiciousPct}% suspicious · ${riskPct}% high risk`}
          >
            {summary.human_sessions > 0 && (
              <div
                className="h-full transition-all duration-700"
                style={{
                  width: `${humanPct}%`,
                  background: colors.green,
                  borderRadius:
                    summary.suspicious_sessions === 0 &&
                    summary.synthetic_sessions === 0
                      ? "999px"
                      : "999px 0 0 999px",
                }}
              />
            )}
            {summary.suspicious_sessions > 0 && (
              <div
                className="h-full transition-all duration-700"
                style={{
                  width: `${suspiciousPct}%`,
                  background: colors.amber,
                  borderRadius:
                    summary.synthetic_sessions === 0 ? "0 999px 999px 0" : "0",
                  marginLeft: summary.human_sessions > 0 ? 2 : 0,
                }}
              />
            )}
            {summary.synthetic_sessions > 0 && (
              <div
                className="h-full transition-all duration-700"
                style={{
                  width: `${riskPct}%`,
                  background: colors.red,
                  borderRadius: "0 999px 999px 0",
                  marginLeft: 2,
                }}
              />
            )}
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            {[
              {
                label: "Human",
                count: summary.human_sessions,
                color: colors.green,
                pct: humanPct,
              },
              {
                label: "Suspicious",
                count: summary.suspicious_sessions,
                color: colors.amber,
                pct: suspiciousPct,
              },
              {
                label: "High risk",
                count: summary.synthetic_sessions,
                color: colors.red,
                pct: riskPct,
              },
            ].map(({ label, count, color, pct: p }) => (
              <div key={label} className="flex items-center gap-[6px]">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: color }}
                />
                <span
                  className="text-[12px] font-medium tabular-nums"
                  style={{ color: colors.text.secondary }}
                >
                  <span style={{ color: colors.text.primary, fontWeight: 600 }}>
                    {count}
                  </span>{" "}
                  {label} ({p}%)
                </span>
              </div>
            ))}
            <div className="flex items-center gap-[6px] ml-auto">
              <span
                className="text-[12px] font-medium"
                style={{ color: colors.text.muted }}
              >
                {summary.certificate_count} certificate
                {summary.certificate_count !== 1 ? "s" : ""} issued
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Getting started checklist ────────────────────────────────────────────────

function GettingStarted({
  totalSessions,
  certificates,
  courses,
}: {
  totalSessions: number;
  certificates: number;
  courses: number;
}) {
  const steps = [
    {
      label: "Write your first session",
      description: "Open the editor and begin typing",
      done: totalSessions > 0,
      to: ROUTES.EDITOR_NEW,
    },
    {
      label: "Generate a certificate",
      description: "Prove your authorship with a verifiable cert",
      done: certificates > 0,
      to: ROUTES.CERTIFICATES,
    },
    {
      label: "Join a course",
      description: "Link sessions to your academic modules",
      done: courses > 0,
      to: ROUTES.JOIN_COURSE,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  return (
    <div
      className="rounded-xl border bg-white"
      style={{ borderColor: colors.surface[200] }}
    >
      <div
        className="flex items-center justify-between border-b px-5 py-4"
        style={{ borderColor: colors.surface[200] }}
      >
        <div>
          <p
            className="text-[13px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Getting started
          </p>
          <p
            className="text-[11px] mt-[2px]"
            style={{ color: colors.text.muted }}
          >
            Complete your evidence workflow setup
          </p>
        </div>
        <span
          className="rounded-md border px-2 py-[3px] text-[11px] font-bold tabular-nums"
          style={{
            borderColor: allDone ? brand.humanAccent : colors.surface[200],
            background: allDone ? brand.humanBg : colors.surface[100],
            color: allDone ? brand.humanText : colors.text.secondary,
          }}
        >
          {doneCount}/{steps.length}
        </span>
      </div>

      <div className="divide-y" style={{ borderColor: colors.surface[200] }}>
        {steps.map((step) => (
          <Link
            key={step.label}
            to={step.to}
            className="flex items-center gap-4 px-5 py-[14px] transition-colors hover:bg-gray-50/60"
          >
            {/* Check circle */}
            <div
              className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border transition-colors"
              style={{
                borderColor: step.done
                  ? brand.humanAccent
                  : colors.surface[300],
                background: step.done ? brand.humanAccent : "transparent",
              }}
            >
              {step.done && (
                <svg
                  width="10"
                  height="8"
                  viewBox="0 0 10 8"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M1 4L3.5 6.5L9 1"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p
                className="text-[13px] font-medium"
                style={{
                  color: step.done
                    ? colors.text.secondary
                    : colors.text.primary,
                  textDecoration: step.done ? "line-through" : "none",
                  textDecorationColor: colors.text.muted,
                }}
              >
                {step.label}
              </p>
              {!step.done && (
                <p
                  className="text-[11px] mt-[1px]"
                  style={{ color: colors.text.muted }}
                >
                  {step.description}
                </p>
              )}
            </div>

            {!step.done && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                style={{ color: colors.text.muted, flexShrink: 0 }}
                aria-hidden
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Activity trend ───────────────────────────────────────────────────────────

function ActivityTrend({ trend }: { trend: TrendPoint[] }) {
  const maxSessions = Math.max(...trend.map((p) => p.session_count), 1);
  const totalInPeriod = trend.reduce((sum, p) => sum + p.session_count, 0);
  const activeDays = trend.filter((p) => p.session_count > 0).length;

  return (
    <div
      className="rounded-xl border bg-white"
      style={{ borderColor: colors.surface[200] }}
    >
      <div
        className="flex items-center justify-between border-b px-5 py-4"
        style={{ borderColor: colors.surface[200] }}
      >
        <div>
          <p
            className="text-[13px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            14-day activity
          </p>
          <p
            className="text-[11px] mt-[2px]"
            style={{ color: colors.text.muted }}
          >
            {activeDays > 0
              ? `${totalInPeriod} sessions across ${activeDays} active days`
              : "No activity yet"}
          </p>
        </div>
        {totalInPeriod > 0 && (
          <span
            className="rounded-md border px-2 py-[3px] text-[11px] font-bold tabular-nums"
            style={{
              borderColor: colors.surface[200],
              background: colors.surface[100],
              color: colors.text.secondary,
            }}
          >
            {totalInPeriod} total
          </span>
        )}
      </div>

      <div className="px-5 py-5">
        {trend.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p
              className="text-[13px] font-medium"
              style={{ color: colors.text.secondary }}
            >
              No activity in the past 14 days
            </p>
            <Link
              to={ROUTES.EDITOR_NEW}
              className="mt-3 text-[12px] font-semibold"
              style={{ color: colors.brand }}
            >
              Start your first session →
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-[5px] h-[72px]">
              {trend.map((point) => {
                // Proper relative height: scaled against actual max, min 4px for empty
                const heightPct =
                  point.session_count > 0
                    ? Math.max(12, (point.session_count / maxSessions) * 100)
                    : 0;

                return (
                  <div
                    key={point.day}
                    className="group relative flex-1"
                    title={`${point.day.slice(5)}: ${point.session_count} session${point.session_count !== 1 ? "s" : ""}`}
                  >
                    {/* Tooltip */}
                    <div
                      className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 z-10"
                      style={{ background: colors.text.primary }}
                    >
                      {point.session_count}
                    </div>

                    {/* Bar */}
                    <div className="flex h-full items-end">
                      <div
                        className="w-full rounded-sm transition-all duration-300 hover:brightness-95"
                        style={{
                          height:
                            point.session_count > 0 ? `${heightPct}%` : "3px",
                          background:
                            point.session_count > 0
                              ? colors.brand
                              : colors.surface[200],
                          minHeight: "3px",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Day labels */}
            <div className="mt-2 flex gap-[5px]">
              {trend.map((point) => (
                <div key={point.day} className="flex-1 text-center">
                  <span
                    className="text-[9px] tabular-nums"
                    style={{ color: colors.text.muted }}
                  >
                    {point.day.slice(8)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Recent session card ───────────────────────────────────────────────────────

function SessionCard({ session }: { session: StudentSession }) {
  const cls = classificationStyle(
    session.classification_bucket || session.classification,
  );
  const rev = reviewStyle(session.review_status);

  return (
    <Link
      to={ROUTES.REPLAY.replace(":sessionId", String(session.id))}
      className="block rounded-xl border bg-white transition-all duration-150 hover:-translate-y-[1px] hover:shadow-md"
      style={{ borderColor: colors.surface[200] }}
    >
      {/* Top: title + badge */}
      <div className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[13px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            {session.title || "Untitled Document"}
          </p>
          <p
            className="mt-[3px] text-[11px]"
            style={{ color: colors.text.muted }}
          >
            {session.course_code ?? "Personal"} · {session.created_at}
          </p>
        </div>

        {/* Classification badge */}
        <span
          className="shrink-0 rounded-md border px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.1em]"
          style={{
            borderColor: cls.border,
            background: cls.bg,
            color: cls.text,
          }}
        >
          {cls.label}
        </span>
      </div>

      {/* Divider */}
      <div style={{ borderTop: `1px solid ${colors.surface[200]}` }} />

      {/* Stats row */}
      <div
        className="grid grid-cols-4 divide-x px-0"
        style={{ borderColor: colors.surface[200] }}
      >
        {[
          { label: "Confidence", value: `${session.confidence}%` },
          { label: "WPM", value: session.wpm },
          { label: "Words", value: session.word_count },
          {
            label: "Review",
            value: rev.label,
            valueStyle: { color: rev.text, background: rev.bg },
          },
        ].map(({ label, value, valueStyle }) => (
          <div key={label} className="flex flex-col items-center py-3 px-2">
            <span
              className="text-[9px] font-bold uppercase tracking-[0.14em]"
              style={{ color: colors.text.muted }}
            >
              {label}
            </span>
            <span
              className="mt-1 text-[12px] font-bold tabular-nums"
              style={valueStyle ?? { color: colors.text.primary }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </Link>
  );
}

// ─── Course breakdown ──────────────────────────────────────────────────────────

function CoursePanel({ courses }: { courses: CourseBreakdown[] }) {
  return (
    <div
      className="rounded-xl border bg-white"
      style={{ borderColor: colors.surface[200] }}
    >
      <div
        className="flex items-center justify-between border-b px-5 py-4"
        style={{ borderColor: colors.surface[200] }}
      >
        <div>
          <p
            className="text-[13px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Course breakdown
          </p>
          <p
            className="text-[11px] mt-[2px]"
            style={{ color: colors.text.muted }}
          >
            Evidence grouped by academic module
          </p>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center py-10 px-5 text-center">
          <p
            className="text-[13px] font-medium"
            style={{ color: colors.text.secondary }}
          >
            No courses linked
          </p>
          <p className="mt-1 text-[11px]" style={{ color: colors.text.muted }}>
            Join a course to submit evidence to your teacher's workspace.
          </p>
          <Link
            to={ROUTES.JOIN_COURSE}
            className="mt-4 rounded-md border px-4 py-2 text-[12px] font-semibold transition-colors hover:brightness-95"
            style={{
              borderColor: colors.brand,
              background: colors.brandSoft,
              color: colors.brand,
            }}
          >
            Join a course
          </Link>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: colors.surface[200] }}>
          {courses.map((course) => {
            const humanPct = pct(course.human_count, course.session_count);
            return (
              <div key={course.course_code} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className="truncate text-[13px] font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      {course.course_name}
                    </p>
                    <p
                      className="mt-[2px] font-mono text-[11px]"
                      style={{ color: colors.text.muted }}
                    >
                      {course.course_code}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-md border px-2 py-[3px] text-[11px] font-bold tabular-nums"
                    style={{
                      borderColor: colors.surface[200],
                      background: colors.surface[100],
                      color: colors.text.secondary,
                    }}
                  >
                    {course.session_count}
                  </span>
                </div>

                {/* Human rate mini-bar — properly uses course.human_count / session_count */}
                <div className="mt-3 flex items-center gap-3">
                  <div
                    className="flex-1 h-[4px] overflow-hidden rounded-full"
                    style={{ background: colors.surface[200] }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${humanPct}%`,
                        background: colors.green,
                      }}
                    />
                  </div>
                  <span
                    className="shrink-0 text-[11px] font-semibold tabular-nums"
                    style={{ color: colors.text.muted }}
                  >
                    {humanPct}% human
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { showToast } = useToast();
  const { user } = useAuthStore();

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setIsLoading(true);
      try {
        const res = await api.get<DashboardResponse>(
          API_ROUTES.student.dashboard,
        );
        if (!mounted) return;
        setData(res.data);
      } catch (error) {
        if (!mounted) return;
        showToast({
          type: "error",
          title: "Dashboard failed to load",
          message: getApiErrorMessage(error),
        });
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [showToast]);

  const summary = data?.summary;

  const humanRate = useMemo(() => {
    if (!summary) return 0;
    return pct(summary.human_sessions, summary.total_sessions);
  }, [summary]);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // ── Error / empty data state ──────────────────────────────────────────────
  if (!data || !summary) {
    return (
      <div
        className="rounded-xl border bg-white px-6 py-14 text-center"
        style={{ borderColor: colors.surface[200] }}
      >
        <p
          className="text-[15px] font-semibold"
          style={{ color: colors.text.primary }}
        >
          Dashboard data unavailable
        </p>
        <p
          className="mt-2 text-[13px]"
          style={{ color: colors.text.secondary }}
        >
          Your writing history could not be loaded. Try refreshing.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 rounded-md px-4 py-2 text-[13px] font-semibold text-white transition hover:brightness-110"
          style={{ background: colors.brand }}
        >
          Reload
        </button>
      </div>
    );
  }

  const hasNoActivity = summary.total_sessions === 0;

  return (
    <div className="space-y-6">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ color: colors.brand }}
          >
            Student workspace
          </p>
          <h1
            className="mt-1 text-[1.75rem] font-bold tracking-[-0.04em]"
            style={{ color: colors.text.primary }}
          >
            {user?.first_name
              ? `Welcome back, ${user.first_name}.`
              : "Your dashboard"}
          </h1>
          <p
            className="mt-1 text-[13px]"
            style={{ color: colors.text.secondary }}
          >
            Track authorship evidence, certificates, and writing analytics.
          </p>
        </div>

        <Link
          to={ROUTES.EDITOR_NEW}
          className="flex shrink-0 items-center gap-2 self-start rounded-md px-4 py-[9px] text-[13px] font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
          style={{ background: colors.brand }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          New writing session
        </Link>
      </div>

      {/* ── Authorship health bar ────────────────────────────────────────── */}
      <AuthorshipHealthBar summary={summary} />

      {/* ── First-run prompt ─────────────────────────────────────────────── */}
      {hasNoActivity && (
        <div
          className="rounded-xl border px-6 py-8 text-center"
          style={{
            borderColor: colors.surface[200],
            background: colors.brandSoft,
          }}
        >
          <p className="text-[15px] font-bold" style={{ color: colors.brand }}>
            Start building your authorship trail
          </p>
          <p
            className="mt-2 text-[13px]"
            style={{ color: colors.text.secondary }}
          >
            Write your first session to generate behavioral evidence that proves
            human authorship — keystroke timing, pauses, and revision patterns
            AI cannot replicate.
          </p>
          <Link
            to={ROUTES.EDITOR_NEW}
            className="mt-5 inline-flex items-center gap-2 rounded-md px-5 py-[10px] text-[13px] font-semibold text-white transition hover:brightness-110"
            style={{ background: colors.brand }}
          >
            Open editor
          </Link>
        </div>
      )}

      {/* ── Metric cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard
          label="Sessions"
          value={summary.total_sessions}
          helper="Captured writing trails"
        />
        <MetricCard
          label="Avg WPM"
          value={summary.avg_wpm}
          helper="Across all sessions"
          accentColor={colors.brand}
        />
        <MetricCard
          label="Avg confidence"
          value={`${summary.avg_confidence}%`}
          helper="ML classification score"
          accentColor={humanRate >= 70 ? colors.green : colors.amber}
        />
        <MetricCard
          label="Writing time"
          value={formatSeconds(summary.total_seconds)}
          helper="Total captured duration"
        />
      </div>

      {/* ── Activity trend + Getting started ────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <ActivityTrend trend={data.trend} />
        <GettingStarted
          totalSessions={summary.total_sessions}
          certificates={summary.certificate_count}
          courses={data.courses.length}
        />
      </div>

      {/* ── Course breakdown ─────────────────────────────────────────────── */}
      <CoursePanel courses={data.courses} />

      {/* ── Recent sessions ──────────────────────────────────────────────── */}
      <div>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ color: colors.brand }}
            >
              Recent evidence
            </p>
            <h2
              className="mt-1 text-[16px] font-bold tracking-[-0.03em]"
              style={{ color: colors.text.primary }}
            >
              Latest writing sessions
            </h2>
          </div>
          <Link
            to={ROUTES.SESSIONS}
            className="rounded-md border px-3 py-[7px] text-[12px] font-semibold transition-colors hover:brightness-95"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.secondary,
              background: colors.surface[50],
            }}
          >
            View all
          </Link>
        </div>

        {data.recent_sessions.length === 0 ? (
          <div
            className="rounded-xl border bg-white px-6 py-12 text-center"
            style={{ borderColor: colors.surface[200] }}
          >
            <p
              className="text-[14px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              No sessions yet
            </p>
            <p
              className="mt-2 text-[13px]"
              style={{ color: colors.text.secondary }}
            >
              Start a writing session to generate your first behavioral
              authorship evidence trail.
            </p>
            <Link
              to={ROUTES.EDITOR_NEW}
              className="mt-5 inline-flex items-center gap-2 rounded-md px-4 py-[9px] text-[13px] font-semibold text-white transition hover:brightness-110"
              style={{ background: colors.brand }}
            >
              Start writing
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {data.recent_sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
