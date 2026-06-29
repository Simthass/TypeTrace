import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ROUTES } from "../constants/routes";
import { api, getApiErrorMessage } from "../lib/api";
import { useToast } from "../components/ui/ToastProvider";
import { brand, colors } from "../styles/colors";
import { useAuthStore } from "../store/authStore";
import { API_ROUTES } from "../constants/apiRoutes";
import { ErrorState, EmptyState } from "../components/ui/AsyncState";

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
  const b = (bucket ?? "").toUpperCase();
  if (b === "HUMAN")
    return {
      bg: brand.humanBg,
      text: brand.humanText,
      dot: colors.green,
      label: "Human",
    };
  if (b === "SUSPICIOUS")
    return {
      bg: brand.suspiciousBg,
      text: brand.suspiciousText,
      dot: colors.amber,
      label: "Suspicious",
    };
  return {
    bg: brand.aiBg,
    text: brand.aiText,
    dot: colors.red,
    label: "High Risk",
  };
}

function reviewStyle(status: string) {
  const s = (status ?? "").toUpperCase();
  if (s === "APPROVED")
    return { bg: brand.humanBg, text: brand.humanText, label: "Approved" };
  if (s === "FLAGGED")
    return { bg: brand.aiBg, text: brand.aiText, label: "Flagged" };
  return {
    bg: colors.surface[200],
    text: colors.text.secondary,
    label: "Pending",
  };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className}`}
      style={{ background: colors.surface[200] }}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border bg-white p-5 space-y-3"
            style={{ borderColor: colors.surface[200] }}
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  iconPath,
  iconBg,
  iconColor,
  to,
}: {
  label: string;
  value: string | number;
  sub: string;
  iconPath: React.ReactNode;
  iconBg: string;
  iconColor: string;
  to?: string;
}) {
  return (
    <div
      className="relative flex flex-col rounded-xl border bg-white p-5 transition-shadow hover:shadow-md"
      style={{ borderColor: colors.surface[200] }}
    >
      <div className="mb-4 flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: iconBg }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={iconColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            {iconPath}
          </svg>
        </div>
        {to && (
          <Link
            to={to}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-slate-50"
            style={{ color: colors.text.muted }}
            aria-label={`Go to ${label}`}
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
              aria-hidden
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
}

// ─── Activity trend chart ─────────────────────────────────────────────────────

function ActivityChart({ trend }: { trend: TrendPoint[] }) {
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
            className="text-[14px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            14-day activity
          </p>
          <p
            className="mt-0.5 text-[12px]"
            style={{ color: colors.text.muted }}
          >
            {activeDays > 0
              ? `${totalInPeriod} sessions across ${activeDays} active days`
              : "No activity yet"}
          </p>
        </div>
        {totalInPeriod > 0 && (
          <span
            className="rounded-lg border px-2.5 py-1 text-[12px] font-bold tabular-nums"
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
        {trend.length === 0 || totalInPeriod === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <div
              className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: colors.brandSoft }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.brand}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 3v18h18" />
                <path d="M7 15l4-4 3 3 5-7" />
              </svg>
            </div>
            <p
              className="text-[14px] font-semibold"
              style={{ color: colors.text.secondary }}
            >
              No activity yet
            </p>
            <Link
              to={ROUTES.EDITOR_NEW}
              className="mt-2 text-[13px] font-semibold"
              style={{ color: colors.brand }}
            >
              Start your first session →
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-1 h-20">
              {trend.map((point) => {
                const heightPct =
                  point.session_count > 0
                    ? Math.max(14, (point.session_count / maxSessions) * 100)
                    : 0;
                return (
                  <div
                    key={point.day}
                    className="group relative flex-1"
                    title={`${point.day.slice(5)}: ${point.session_count} session${point.session_count !== 1 ? "s" : ""}`}
                  >
                    <div
                      className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                      style={{ background: colors.text.primary }}
                    >
                      {point.session_count}
                    </div>
                    <div className="flex h-full items-end">
                      <div
                        className="w-full rounded-t-sm transition-all duration-300"
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
            <div className="mt-2 flex gap-1">
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

// ─── Authorship health bar ────────────────────────────────────────────────────

function AuthorshipBar({ summary }: { summary: StudentSummary }) {
  const total = summary.total_sessions;
  const humanPct = pct(summary.human_sessions, total);
  const suspiciousPct = pct(summary.suspicious_sessions, total);
  const riskPct = pct(summary.synthetic_sessions, total);
  const pendingReview =
    (summary.pending_count ?? 0) + (summary.flagged_count ?? 0);

  return (
    <div
      className="rounded-xl border bg-white p-5"
      style={{ borderColor: colors.surface[200] }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p
            className="text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: colors.brand }}
          >
            Authorship health
          </p>
          <p
            className="mt-1 text-[1.6rem] font-bold tracking-tight leading-none"
            style={{ color: colors.text.primary }}
          >
            {total === 0 ? "-" : `${humanPct}%`}
            <span
              className="ml-2 text-[14px] font-normal"
              style={{ color: colors.text.secondary }}
            >
              {total === 0
                ? "No sessions recorded yet"
                : "of sessions classified as human writing"}
            </span>
          </p>
        </div>
        {pendingReview > 0 && (
          <div
            className="flex items-center gap-2 rounded-lg border px-3 py-1.5"
            style={{
              borderColor: brand.suspiciousAccent,
              background: brand.suspiciousBg,
            }}
          >
            <span
              className="h-2 w-2 animate-pulse rounded-full"
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
        <div className="mt-4">
          <div
            className="flex h-2.5 w-full overflow-hidden rounded-full"
            style={{ background: colors.surface[200] }}
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
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {[
              {
                label: "Human",
                count: summary.human_sessions,
                color: colors.green,
                p: humanPct,
              },
              {
                label: "Suspicious",
                count: summary.suspicious_sessions,
                color: colors.amber,
                p: suspiciousPct,
              },
              {
                label: "High risk",
                count: summary.synthetic_sessions,
                color: colors.red,
                p: riskPct,
              },
            ].map(({ label, count, color, p }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: color }}
                />
                <span
                  className="text-[12px] tabular-nums"
                  style={{ color: colors.text.secondary }}
                >
                  <span
                    className="font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {count}
                  </span>{" "}
                  {label} ({p}%)
                </span>
              </div>
            ))}
            <div className="ml-auto">
              <span
                className="text-[12px]"
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
      description: "Open the editor and start typing",
      done: totalSessions > 0,
      to: ROUTES.EDITOR_NEW,
    },
    {
      label: "Generate a certificate",
      description: "Prove authorship with a verifiable cert",
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
            className="text-[14px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Getting started
          </p>
          <p
            className="mt-0.5 text-[12px]"
            style={{ color: colors.text.muted }}
          >
            Set up your authorship workflow
          </p>
        </div>
        <span
          className="rounded-lg border px-2.5 py-1 text-[12px] font-bold tabular-nums"
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
            className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-slate-50/60"
          >
            <div
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
              style={{
                borderColor: step.done
                  ? brand.humanAccent
                  : colors.surface[300],
                background: step.done ? brand.humanAccent : "transparent",
              }}
            >
              {step.done && (
                <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
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
                  color: step.done ? colors.text.muted : colors.text.primary,
                  textDecoration: step.done ? "line-through" : "none",
                }}
              >
                {step.label}
              </p>
              {!step.done && (
                <p
                  className="text-[11px] mt-px"
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
                stroke={colors.text.muted}
                strokeWidth="2"
                strokeLinecap="round"
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

// ─── Session row ──────────────────────────────────────────────────────────────

function SessionRow({
  session,
  index,
}: {
  session: StudentSession;
  index: number;
}) {
  const cls = classificationStyle(
    session.classification_bucket || session.classification,
  );
  const rev = reviewStyle(session.review_status);

  return (
    <Link
      to={ROUTES.REPLAY.replace(":sessionId", String(session.id))}
      className="grid grid-cols-[1fr_120px_80px_80px_100px_80px] items-center gap-4 px-5 py-3.5 text-[13px] transition-colors hover:bg-slate-50/60"
      style={{
        borderTop: index === 0 ? "none" : `1px solid ${colors.surface[200]}`,
      }}
    >
      <div className="min-w-0">
        <p
          className="truncate font-semibold"
          style={{ color: colors.text.primary }}
        >
          {session.title || "Untitled Document"}
        </p>
        <p
          className="mt-0.5 truncate text-[11px]"
          style={{ color: colors.text.muted }}
        >
          {session.course_code ?? "Personal"} · {session.created_at}
        </p>
      </div>
      <div>
        <span
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: cls.bg, color: cls.text }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: cls.dot }}
          />
          {cls.label}
        </span>
      </div>
      <p
        className="tabular-nums font-semibold"
        style={{ color: colors.text.primary }}
      >
        {session.confidence}%
      </p>
      <p className="tabular-nums" style={{ color: colors.text.secondary }}>
        {session.wpm}
      </p>
      <div>
        <span
          className="inline-flex rounded-lg px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: rev.bg, color: rev.text }}
        >
          {rev.label}
        </span>
      </div>
      <div className="flex justify-end">
        {session.certificate_id ? (
          <span
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold"
            style={{ background: colors.brandSoft, color: colors.brand }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Cert
          </span>
        ) : (
          <span className="text-[11px]" style={{ color: colors.text.muted }}>
            -
          </span>
        )}
      </div>
    </Link>
  );
}

// ─── Course breakdown panel ───────────────────────────────────────────────────

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
            className="text-[14px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Course breakdown
          </p>
          <p
            className="mt-0.5 text-[12px]"
            style={{ color: colors.text.muted }}
          >
            Evidence grouped by module
          </p>
        </div>
        <Link
          to={ROUTES.JOIN_COURSE}
          className="text-[12px] font-semibold"
          style={{ color: colors.brand }}
        >
          Join course →
        </Link>
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center py-10 px-5 text-center">
          <div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ background: colors.brandSoft }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.brand}
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
            </svg>
          </div>
          <p
            className="text-[13px] font-medium"
            style={{ color: colors.text.secondary }}
          >
            No courses linked
          </p>
          <p className="mt-1 text-[12px]" style={{ color: colors.text.muted }}>
            Join a course to submit evidence to your teacher.
          </p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: colors.surface[200] }}>
          {courses.map((course) => {
            const humanPct = pct(course.human_count, course.session_count);
            return (
              <div key={course.course_code} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className="truncate text-[13px] font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      {course.course_name}
                    </p>
                    <p
                      className="mt-0.5 font-mono text-[11px]"
                      style={{ color: colors.text.muted }}
                    >
                      {course.course_code}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-lg border px-2.5 py-1 text-[12px] font-bold tabular-nums"
                    style={{
                      borderColor: colors.surface[200],
                      background: colors.surface[100],
                      color: colors.text.secondary,
                    }}
                  >
                    {course.session_count}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2.5">
                  <div
                    className="flex-1 h-1.5 overflow-hidden rounded-full"
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
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setIsLoading(true);
      setApiError(null);
      try {
        const res = await api.get<DashboardResponse>(
          API_ROUTES.student.dashboard,
        );
        if (!mounted) return;
        setData(res.data);
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
    load();
    return () => {
      mounted = false;
    };
  }, [showToast]);

  const summary = data?.summary;
  const humanRate = useMemo(
    () => (!summary ? 0 : pct(summary.human_sessions, summary.total_sessions)),
    [summary],
  );

  if (isLoading) return <DashboardSkeleton />;

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

  if (!data || !summary) {
    return (
      <ErrorState
        title="Dashboard unavailable"
        message="Could not load your workspace data. Try refreshing the page."
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

  const hasNoActivity = summary.total_sessions === 0;

  return (
    <div className="space-y-6">
      {/* ── Page header ─────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1
            className="text-[1.9rem] font-bold tracking-tight"
            style={{ color: colors.text.primary }}
          >
            {user?.first_name ? `Welcome, ${user.first_name}.` : "Dashboard"}
          </h1>
          <p
            className="mt-1 text-[14px]"
            style={{ color: colors.text.secondary }}
          >
            Track authorship evidence, certificates, and writing analytics.
          </p>
        </div>
        <Link
          to={ROUTES.EDITOR_NEW}
          className="flex shrink-0 items-center gap-2 self-start rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition hover:brightness-110 active:scale-[0.98]"
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
            aria-hidden
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          New session
        </Link>
      </div>

      {/* Rest of the dashboard content remains unchanged... */}
      {/* ── Metric cards ────────────────────── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard
          label="Total Sessions"
          value={summary.total_sessions}
          sub="Captured writing trails"
          iconBg={colors.brandSoft}
          iconColor={colors.brand}
          iconPath={
            <>
              <path d="M8 6h13" />
              <path d="M8 12h13" />
              <path d="M8 18h13" />
              <path d="M3 6h.01" />
              <path d="M3 12h.01" />
              <path d="M3 18h.01" />
            </>
          }
          to={ROUTES.SESSIONS}
        />
        <MetricCard
          label="Avg Confidence"
          value={`${summary.avg_confidence}%`}
          sub="ML classification score"
          iconBg={humanRate >= 70 ? colors.mintTint : colors.amberTint}
          iconColor={humanRate >= 70 ? colors.green : colors.amber}
          iconPath={
            <>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </>
          }
          to={ROUTES.ANALYTICS}
        />
        <MetricCard
          label="Certificates"
          value={summary.certificate_count}
          sub="Authorship records issued"
          iconBg={colors.brandSoft}
          iconColor={colors.brand}
          iconPath={
            <>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </>
          }
          to={ROUTES.CERTIFICATES}
        />
        <MetricCard
          label="Writing Time"
          value={formatSeconds(summary.total_seconds)}
          sub="Total captured duration"
          iconBg={colors.surface[150]}
          iconColor={colors.text.secondary}
          iconPath={
            <>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </>
          }
        />
      </div>

      {/* ── Authorship health bar ─────────────────────────────────────── */}
      <AuthorshipBar summary={summary} />

      {/* ── First-run prompt ─────────────────────────────────────────── */}
      {hasNoActivity && (
        <div
          className="flex flex-col items-center gap-3 rounded-xl border px-6 py-8 text-center sm:flex-row sm:text-left"
          style={{
            borderColor: `${colors.brand}30`,
            background: colors.brandSoft,
          }}
        >
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{ background: colors.brand }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </div>
          <div className="flex-1">
            <p
              className="text-[15px] font-bold"
              style={{ color: colors.brand }}
            >
              Start building your authorship trail
            </p>
            <p
              className="mt-1 text-[13px]"
              style={{ color: colors.text.secondary }}
            >
              Write your first session to generate behavioral evidence -
              keystroke timing, pauses, and revision patterns AI cannot
              replicate.
            </p>
          </div>
          <Link
            to={ROUTES.EDITOR_NEW}
            className="shrink-0 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition hover:brightness-110"
            style={{ background: colors.brand }}
          >
            Open editor
          </Link>
        </div>
      )}

      {/* ── Main content: chart + getting started ────────────────────── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
        <ActivityChart trend={data.trend} />
        <GettingStarted
          totalSessions={summary.total_sessions}
          certificates={summary.certificate_count}
          courses={data.courses.length}
        />
      </div>

      {/* ── Course breakdown ──────────────────────────────────────────── */}
      <CoursePanel courses={data.courses} />

      {/* ── Recent sessions table ────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <h2
              className="text-[16px] font-bold"
              style={{ color: colors.text.primary }}
            >
              Recent sessions
            </h2>
            <p
              className="mt-0.5 text-[12px]"
              style={{ color: colors.text.muted }}
            >
              Latest captured writing evidence
            </p>
          </div>
          <Link
            to={ROUTES.SESSIONS}
            className="rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition hover:bg-slate-50"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.secondary,
            }}
          >
            View all
          </Link>
        </div>

        <div
          className="overflow-hidden rounded-xl border bg-white"
          style={{ borderColor: colors.surface[200] }}
        >
          {data.recent_sessions.length === 0 ? (
            <EmptyState
              title="No sessions yet"
              message="Start writing to generate your first authorship evidence trail."
              action={
                <Link
                  to={ROUTES.EDITOR_NEW}
                  className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white"
                  style={{ background: colors.brand }}
                >
                  Start writing
                </Link>
              }
            />
          ) : (
            <>
              <div
                className="grid grid-cols-[1fr_120px_80px_80px_100px_80px] gap-4 border-b px-5 py-3"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[100],
                }}
              >
                {[
                  "Document",
                  "Classification",
                  "Confidence",
                  "WPM",
                  "Review",
                  "Cert",
                ].map((h) => (
                  <p
                    key={h}
                    className="text-[10px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: colors.text.muted }}
                  >
                    {h}
                  </p>
                ))}
              </div>
              {data.recent_sessions.map((session, i) => (
                <SessionRow key={session.id} session={session} index={i} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
