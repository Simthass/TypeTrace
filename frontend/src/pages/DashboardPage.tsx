// src/pages/DashboardPage.tsx
// =============================================================================
// Part 4: All mock/hardcoded data replaced with real API data.
//   - MetricCards pull from live session history
//   - Activity chart built from real session dates (last 7 days)
//   - Review status summary shows teacher feedback at a glance
//   - Anomaly log replaced with real flagged/suspicious sessions
// =============================================================================

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { brand, colors } from "../styles/colors";
import { useAuthStore } from "../store/authStore";
import { api } from "../lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type ClassificationStatus = "HUMAN" | "SUSPICIOUS" | "AI-GENERATED";
type ReviewStatus = "PENDING" | "APPROVED" | "FLAGGED" | "UNDER_REVIEW";

interface Session {
  id: number;
  title: string;
  wpm: number;
  duration: number;
  classification: ClassificationStatus;
  confidence: number;
  date: string;
  certificate_id: string | null;
  review_status: ReviewStatus;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  review_notes: string;
  course_name: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg
      width="13"
      height="13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function ArrowUpIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}
function ArrowDownIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function MetricCard({
  title,
  value,
  change,
  trend,
  accent,
}: {
  title: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
  accent?: string;
}) {
  return (
    <div
      className="bg-white border rounded-md p-5 shadow-sm flex flex-col gap-3"
      style={{ borderColor: colors.surface[200] }}
    >
      <p
        className="text-[11px] font-bold uppercase tracking-widest"
        style={{ color: colors.text.secondary }}
      >
        {title}
      </p>
      <p
        className="text-[28px] font-extrabold leading-none font-mono tracking-tight"
        style={{ color: accent ?? colors.text.primary }}
      >
        {value}
      </p>
      {change && trend && (
        <div
          className="flex items-center gap-1 text-[12px] font-medium"
          style={{
            color:
              trend === "up"
                ? brand.humanText
                : trend === "down"
                  ? brand.aiAccent
                  : colors.text.secondary,
          }}
        >
          {trend === "up" ? (
            <ArrowUpIcon />
          ) : trend === "down" ? (
            <ArrowDownIcon />
          ) : null}
          {change}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Builds a 7-day session count array from real session dates
function buildActivityData(
  sessions: Session[],
): { day: string; sessions: number; avgConf: number }[] {
  const days: { day: string; sessions: number; avgConf: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("en-GB", { weekday: "short" });
    const dateStr = d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    // Match sessions by formatted date — our API returns "May 27, 2026" format
    const daySessions = sessions.filter((s) => s.date === dateStr);
    const avg =
      daySessions.length > 0
        ? Math.round(
            daySessions.reduce((a, s) => a + s.confidence, 0) /
              daySessions.length,
          )
        : 0;
    days.push({ day: label, sessions: daySessions.length, avgConf: avg });
  }
  return days;
}

const FEATURE_IMPORTANCE = [
  { label: "IKI Variance", value: 38, color: brand.action },
  { label: "Paste Event Detection", value: 26, color: brand.aiAccent },
  { label: "Pause Frequency", value: 18, color: colors.surface[200] },
  { label: "Mean IKI", value: 12, color: colors.surface[200] },
  { label: "Deletion Rate", value: 6, color: colors.surface[200] },
];

const REVIEW_CONFIG: Record<
  ReviewStatus,
  { bg: string; text: string; border: string; label: string; icon: string }
> = {
  PENDING: {
    bg: "#f8fafc",
    text: "#64748b",
    border: "#e2e8f0",
    label: "Pending Review",
    icon: "◉",
  },
  APPROVED: {
    bg: "#f0fdf4",
    text: "#15803d",
    border: "#bbf7d0",
    label: "Approved",
    icon: "✓",
  },
  FLAGGED: {
    bg: "#fef2f2",
    text: "#b91c1c",
    border: "#fecaca",
    label: "Flagged",
    icon: "⚑",
  },
  UNDER_REVIEW: {
    bg: "#fefce8",
    text: "#a16207",
    border: "#fef08a",
    label: "Under Review",
    icon: "◎",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api
      .get<{ status: string; sessions: Session[] }>("/sessions/history")
      .then((r) => {
        if (r.data.status === "success") setSessions(r.data.sessions);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  // ── Derived metrics ──────────────────────────────────────────────────────────
  const totalSessions = sessions.length;
  const humanSessions = sessions.filter(
    (s) => s.classification === "HUMAN",
  ).length;
  const avgConfidence =
    totalSessions > 0
      ? (
          sessions.reduce((a, s) => a + s.confidence, 0) / totalSessions
        ).toFixed(1)
      : "0";
  const aiFlags = sessions.filter(
    (s) => s.classification === "AI-GENERATED",
  ).length;
  const avgWpm =
    totalSessions > 0
      ? Math.round(sessions.reduce((a, s) => a + s.wpm, 0) / totalSessions)
      : 0;
  const totalWords = Math.round(
    sessions.reduce((a, s) => a + s.wpm * (s.duration / 60), 0),
  );
  const totalTime = sessions.reduce((a, s) => a + s.duration, 0);
  const formattedTime =
    totalTime > 3600
      ? `${(totalTime / 3600).toFixed(1)}h`
      : `${Math.round(totalTime / 60)}m`;
  const flaggedSessions = sessions.filter((s) => s.review_status === "FLAGGED");

  const activityData = buildActivityData(sessions);
  const maxSessions = Math.max(...activityData.map((d) => d.sessions), 1);

  // Filtered recent sessions for the table
  const filteredRecent = sessions
    .filter(
      (s) => !search || s.title.toLowerCase().includes(search.toLowerCase()),
    )
    .slice(0, 6);

  return (
    <div
      className="p-6 md:p-8 max-w-[1600px] mx-auto w-full flex flex-col gap-6 font-sans min-h-screen"
      style={{ background: colors.surface[50] }}
    >
      {/* ── Welcome header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1
            className="text-[20px] font-semibold tracking-tight"
            style={{ color: colors.text.primary }}
          >
            Welcome back, {user?.first_name ?? "Student"}
          </h1>
          <p
            className="text-[13px] mt-0.5"
            style={{ color: colors.text.secondary }}
          >
            Your behavioral authorship ledger is active.
          </p>
        </div>
        <Link
          to={ROUTES.EDITOR_NEW}
          className="flex items-center gap-1.5 h-9 px-4 rounded-md text-[13px] font-semibold text-white shadow-sm"
          style={{ background: colors.text.primary }}
        >
          <PlusIcon /> New Session
        </Link>
      </div>

      {/* ── Top metric cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Sessions"
          value={totalSessions}
          change={totalSessions > 0 ? "All time" : undefined}
          trend="neutral"
        />
        <MetricCard
          title="Avg. Confidence"
          value={`${avgConfidence}%`}
          change={
            Number(avgConfidence) >= 80 ? "Strong profile" : "Building up"
          }
          trend={Number(avgConfidence) >= 80 ? "up" : "neutral"}
          accent={
            Number(avgConfidence) >= 80 ? brand.humanText : colors.text.primary
          }
        />
        <MetricCard
          title="AI Anomalies"
          value={aiFlags}
          change={aiFlags === 0 ? "None detected" : `${aiFlags} flagged`}
          trend={aiFlags === 0 ? "up" : "down"}
          accent={aiFlags > 0 ? brand.aiAccent : colors.text.primary}
        />
        <MetricCard
          title="Average WPM"
          value={avgWpm}
          change={avgWpm > 0 ? "Across all sessions" : undefined}
          trend="neutral"
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-start">
        {/* Activity chart — built from real data */}
        <div
          className="bg-white border rounded-md shadow-sm p-6 flex flex-col"
          style={{ borderColor: colors.surface[200] }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3
              className="text-[14px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Session Activity
            </h3>
            <span
              className="text-[12px] font-medium px-2 py-1 rounded-md border"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.secondary,
                background: colors.surface[50],
              }}
            >
              Last 7 days
            </span>
          </div>

          <div className="h-[200px] flex items-end justify-between gap-2 md:gap-4 mt-auto relative">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-full border-t"
                  style={{ borderColor: colors.surface[100] }}
                />
              ))}
            </div>

            {activityData.map((data, i) => {
              const heightPct = (data.sessions / maxSessions) * 100;
              const isAnomaly = data.avgConf > 0 && data.avgConf < 70;
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-3 relative group z-10"
                >
                  {/* Tooltip */}
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[11px] py-1 px-2 rounded-md whitespace-nowrap pointer-events-none z-20">
                    {data.sessions} session{data.sessions !== 1 ? "s" : ""}
                    {data.avgConf > 0 ? ` · ${data.avgConf}% avg` : ""}
                  </div>
                  <div
                    className="w-full rounded-t-md transition-all duration-500 ease-out group-hover:opacity-80"
                    style={{
                      height: `${Math.max(heightPct, data.sessions > 0 ? 8 : 2)}%`,
                      minHeight: "3px",
                      backgroundColor:
                        data.sessions === 0
                          ? colors.surface[100]
                          : isAnomaly
                            ? brand.aiAccent
                            : colors.text.primary,
                    }}
                  />
                  <span
                    className="text-[11px] font-mono"
                    style={{ color: colors.text.secondary }}
                  >
                    {data.day}
                  </span>
                </div>
              );
            })}
          </div>

          {totalSessions === 0 && (
            <p
              className="text-center text-[12px] mt-4"
              style={{ color: colors.text.secondary }}
            >
              No sessions yet — start writing to populate this chart.
            </p>
          )}
        </div>

        {/* Feature importance — static ML model weights, always shown */}
        <div
          className="bg-white border rounded-md shadow-sm p-6 flex flex-col gap-5"
          style={{ borderColor: colors.surface[200] }}
        >
          <div>
            <h3
              className="text-[14px] font-semibold mb-1"
              style={{ color: colors.text.primary }}
            >
              ML Feature Weights
            </h3>
            <p className="text-[12px]" style={{ color: colors.text.secondary }}>
              Biometric parameters used for classification.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {FEATURE_IMPORTANCE.map((feat, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[12px]">
                  <span
                    className="font-medium"
                    style={{ color: colors.text.primary }}
                  >
                    {feat.label}
                  </span>
                  <span
                    className="font-mono font-semibold"
                    style={{ color: colors.text.secondary }}
                  >
                    {feat.value}%
                  </span>
                </div>
                <div
                  className="h-1.5 w-full rounded-full overflow-hidden"
                  style={{ backgroundColor: colors.surface[100] }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${feat.value}%`,
                      backgroundColor: feat.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom section: Recent sessions + Flagged alerts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* Recent sessions table */}
        <div
          className="bg-white border rounded-md shadow-sm overflow-hidden"
          style={{ borderColor: colors.surface[200] }}
        >
          <div
            className="px-6 py-4 border-b flex items-center justify-between"
            style={{
              borderColor: colors.surface[200],
              backgroundColor: colors.surface[50],
            }}
          >
            <h3
              className="text-[14px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Recent Sessions
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <span
                  className="absolute left-2.5 top-1/2 -translate-y-1/2"
                  style={{ color: colors.text.secondary }}
                >
                  <SearchIcon />
                </span>
                <input
                  type="text"
                  placeholder="Filter…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-7 pl-8 pr-3 rounded-md text-[12px] border outline-none"
                  style={{
                    borderColor: colors.surface[200],
                    color: colors.text.primary,
                    width: 120,
                  }}
                />
              </div>
              <Link
                to={ROUTES.EDITOR}
                className="text-[12px] font-semibold"
                style={{ color: colors.text.secondary }}
              >
                View all →
              </Link>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <p
                className="text-[13px]"
                style={{ color: colors.text.secondary }}
              >
                Loading...
              </p>
            </div>
          ) : filteredRecent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p
                className="text-[13px]"
                style={{ color: colors.text.secondary }}
              >
                {sessions.length === 0
                  ? "No sessions yet. Start typing to build your profile."
                  : "No sessions match your search."}
              </p>
              {sessions.length === 0 && (
                <Link
                  to={ROUTES.EDITOR_NEW}
                  className="px-4 py-2 rounded-md text-[12px] font-semibold text-white"
                  style={{ background: colors.text.primary }}
                >
                  Start First Session
                </Link>
              )}
            </div>
          ) : (
            <div
              className="flex flex-col divide-y"
              style={{ borderColor: colors.surface[200] }}
            >
              {filteredRecent.map((s) => {
                const rv =
                  REVIEW_CONFIG[s.review_status] ?? REVIEW_CONFIG.PENDING;
                const isAnomaly = s.classification !== "HUMAN";
                return (
                  <div
                    key={s.id}
                    className="grid items-center gap-4 px-6 py-3.5 hover:bg-surface-50 transition-colors"
                    style={{ gridTemplateColumns: "1fr 90px 110px 80px" }}
                  >
                    <div className="min-w-0">
                      <p
                        className="text-[13px] font-medium truncate"
                        style={{ color: colors.text.primary }}
                      >
                        {s.title}
                      </p>
                      <p
                        className="text-[11px] font-mono"
                        style={{ color: colors.text.secondary }}
                      >
                        {s.wpm} WPM · {s.date}
                        {s.course_name && ` · ${s.course_name}`}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md w-fit"
                      style={{
                        background: isAnomaly ? brand.aiBg : brand.humanBg,
                        color: isAnomaly ? brand.aiText : brand.humanText,
                      }}
                    >
                      {s.classification === "AI-GENERATED"
                        ? "AI"
                        : s.classification}
                    </span>
                    <span
                      className="flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold w-fit"
                      style={{
                        background: rv.bg,
                        borderColor: rv.border,
                        color: rv.text,
                      }}
                    >
                      {rv.icon} {rv.label}
                    </span>
                    <span
                      className="text-[12px] font-bold text-right"
                      style={{
                        color: isAnomaly ? brand.aiAccent : brand.humanText,
                      }}
                    >
                      {s.confidence}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: flagged alerts + global metrics */}
        <div className="flex flex-col gap-4">
          {/* Flagged sessions — real data */}
          <div
            className="bg-white border rounded-md shadow-sm overflow-hidden"
            style={{ borderColor: colors.surface[200] }}
          >
            <div
              className="px-5 py-4 border-b"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[50],
              }}
            >
              <h3
                className="text-[14px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                Teacher Alerts
              </h3>
            </div>
            <div className="flex flex-col">
              {flaggedSessions.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <p
                    className="text-[12px]"
                    style={{ color: colors.text.secondary }}
                  >
                    {totalSessions === 0
                      ? "No sessions yet."
                      : "✓ No flags from your instructor."}
                  </p>
                </div>
              ) : (
                flaggedSessions.map((s) => (
                  <div
                    key={s.id}
                    className="px-5 py-3.5 border-b last:border-b-0 flex flex-col gap-1"
                    style={{ borderColor: colors.surface[100] }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className="text-[12px] font-semibold truncate"
                        style={{ color: colors.text.primary }}
                      >
                        {s.title}
                      </p>
                      <span
                        className="px-2 py-0.5 rounded-md text-[9px] font-bold border shrink-0"
                        style={{
                          background: "#fef2f2",
                          color: "#b91c1c",
                          borderColor: "#fecaca",
                        }}
                      >
                        FLAGGED
                      </span>
                    </div>
                    {s.review_notes && (
                      <p
                        className="text-[11px] italic"
                        style={{ color: colors.text.secondary }}
                      >
                        "{s.review_notes}"
                      </p>
                    )}
                    <p
                      className="text-[11px]"
                      style={{ color: colors.text.secondary }}
                    >
                      {s.date} {s.course_name ? `· ${s.course_name}` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Global writing metrics */}
          <div
            className="bg-white border rounded-md shadow-sm p-5"
            style={{ borderColor: colors.surface[200] }}
          >
            <h3
              className="text-[13px] font-semibold mb-4"
              style={{ color: colors.text.primary }}
            >
              Writing Stats
            </h3>
            <div className="flex flex-col gap-3">
              {[
                { label: "Words Written", value: totalWords.toLocaleString() },
                { label: "Time Writing", value: formattedTime },
                {
                  label: "Human Rate",
                  value:
                    totalSessions > 0
                      ? `${Math.round((humanSessions / totalSessions) * 100)}%`
                      : "—",
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex justify-between items-center border-b last:border-b-0 pb-2 last:pb-0"
                  style={{ borderColor: colors.surface[50] }}
                >
                  <span
                    className="text-[12px]"
                    style={{ color: colors.text.secondary }}
                  >
                    {label}
                  </span>
                  <span
                    className="text-[13px] font-mono font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
