import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { colors, brand } from "../styles/colors";
import { ROUTES } from "../constants/routes";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface DayTrend {
  date: string;
  label: string;
  session_count: number;
  avg_wpm: number;
  avg_confidence: number;
}

interface CourseBreakdown {
  course_name: string;
  session_count: number;
  avg_wpm: number;
  avg_confidence: number;
  human_count: number;
}

interface PersonalBests {
  best_wpm: number;
  best_confidence: number;
  longest_session: number;
  best_iki: number;
  total_sessions: number;
  total_seconds: number;
}

interface AnalyticsData {
  daily_trend: DayTrend[];
  course_breakdown: CourseBreakdown[];
  personal_bests: PersonalBests;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)}h`;
  if (seconds >= 60) return `${Math.round(seconds / 60)}m`;
  return `${seconds}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function BestCard({
  label,
  value,
  unit = "",
  accent,
}: {
  label: string;
  value: string | number;
  unit?: string;
  accent?: string;
}) {
  return (
    <div
      className="bg-white border rounded-xl p-5 shadow-sm flex flex-col gap-2"
      style={{ borderColor: colors.surface[200] }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: colors.text.secondary }}
      >
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span
          className="text-[26px] font-extrabold font-mono tracking-tight"
          style={{ color: accent ?? colors.text.primary }}
        >
          {value}
        </span>
        {unit && (
          <span
            className="text-[13px] font-mono"
            style={{ color: colors.text.secondary }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

// WPM bar chart — same visual pattern as DashboardPage activity chart
function WpmChart({ trend }: { trend: DayTrend[] }) {
  const maxWpm = Math.max(...trend.map((d) => d.avg_wpm), 1);
  // Only render every 5th label to avoid crowding
  const labelEvery = 5;

  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-[14px] font-semibold"
          style={{ color: colors.text.primary }}
        >
          WPM Trend
        </h3>
        <span
          className="text-[12px] px-2 py-1 rounded-md border"
          style={{
            borderColor: colors.surface[200],
            color: colors.text.secondary,
            background: colors.surface[50],
          }}
        >
          Last 30 days
        </span>
      </div>
      <div className="h-[180px] flex items-end justify-between gap-[3px] relative">
        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-full border-t"
              style={{ borderColor: colors.surface[100] }}
            />
          ))}
        </div>

        {trend.map((day, i) => {
          const heightPct = (day.avg_wpm / maxWpm) * 100;
          const isHovered = hovered === i;
          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col items-center gap-1 relative group z-10"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Tooltip */}
              {isHovered && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] py-1 px-2 rounded-md whitespace-nowrap z-20 pointer-events-none">
                  {day.session_count > 0
                    ? `${day.avg_wpm} WPM · ${day.session_count} session${day.session_count !== 1 ? "s" : ""}`
                    : "No sessions"}
                </div>
              )}

              <div
                className="w-full rounded-t-sm transition-all duration-300"
                style={{
                  height: `${Math.max(heightPct, day.session_count > 0 ? 5 : 1)}%`,
                  minHeight: "2px",
                  backgroundColor:
                    day.session_count === 0
                      ? colors.surface[100]
                      : isHovered
                        ? brand.action
                        : colors.text.primary,
                  opacity: isHovered ? 1 : 0.85,
                }}
              />

              {/* X-axis label every 5th day */}
              {i % labelEvery === 0 && (
                <span
                  className="text-[9px] font-mono absolute -bottom-5 whitespace-nowrap"
                  style={{ color: colors.text.secondary }}
                >
                  {day.label.split(" ")[1]}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="h-5" /> {/* space for x-axis labels */}
    </div>
  );
}

// Confidence trend — rendered as a simple SVG polyline
function ConfidenceChart({ trend }: { trend: DayTrend[] }) {
  const activeDays = trend.filter((d) => d.session_count > 0);
  const W = 600;
  const H = 120;
  const PAD = 12;

  const maxConf = 100;
  const toX = (i: number) =>
    PAD + (i / Math.max(activeDays.length - 1, 1)) * (W - PAD * 2);
  const toY = (v: number) => PAD + (1 - v / maxConf) * (H - PAD * 2);

  const points = activeDays
    .map((d, i) => `${toX(i)},${toY(d.avg_confidence)}`)
    .join(" ");
  const area =
    activeDays.length > 0
      ? `M${toX(0)},${H} ` +
        activeDays
          .map((d, i) => `L${toX(i)},${toY(d.avg_confidence)}`)
          .join(" ") +
        ` L${toX(activeDays.length - 1)},${H} Z`
      : "";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-[14px] font-semibold"
          style={{ color: colors.text.primary }}
        >
          Confidence Trend
        </h3>
        <span
          className="text-[12px] px-2 py-1 rounded-md border"
          style={{
            borderColor: colors.surface[200],
            color: colors.text.secondary,
            background: colors.surface[50],
          }}
        >
          Per session
        </span>
      </div>

      {activeDays.length === 0 ? (
        <div className="flex items-center justify-center h-[120px]">
          <p className="text-[12px]" style={{ color: colors.text.secondary }}>
            No sessions yet — confidence trend will appear here.
          </p>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: 120 }}
        >
          {/* 80% and 60% threshold lines */}
          {[80, 60].map((threshold) => (
            <g key={threshold}>
              <line
                x1={PAD}
                y1={toY(threshold)}
                x2={W - PAD}
                y2={toY(threshold)}
                stroke={colors.surface[200]}
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={PAD}
                y={toY(threshold) - 3}
                fontSize="9"
                fill={colors.text.secondary}
              >
                {threshold}%
              </text>
            </g>
          ))}

          {/* Area fill */}
          {area && <path d={area} fill={`${brand.action}15`} />}

          {/* Line */}
          {points && (
            <polyline
              points={points}
              fill="none"
              stroke={brand.action}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Dots */}
          {activeDays.map((d, i) => (
            <circle
              key={d.date}
              cx={toX(i)}
              cy={toY(d.avg_confidence)}
              r="3"
              fill="white"
              stroke={brand.action}
              strokeWidth="2"
            />
          ))}
        </svg>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .get<AnalyticsData>("/student/analytics")
      .then((r) => setData(r.data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span
          className="text-[13px] font-mono tracking-widest uppercase"
          style={{ color: colors.text.secondary }}
        >
          Loading analytics...
        </span>
      </div>
    );
  }

  if (!data || data.personal_bests.total_sessions === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-6">
        <p
          className="text-[15px] font-semibold"
          style={{ color: colors.text.primary }}
        >
          No data yet
        </p>
        <p
          className="text-[13px] text-center"
          style={{ color: colors.text.secondary }}
        >
          Complete at least one session for your analytics to appear here.
        </p>
        <Link
          to={ROUTES.EDITOR_NEW}
          className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white"
          style={{ background: colors.text.primary }}
        >
          Start a Session
        </Link>
      </div>
    );
  }

  const { daily_trend, course_breakdown, personal_bests } = data;
  const totalTime = formatDuration(personal_bests.total_seconds);

  return (
    <div
      className="p-6 md:p-8 max-w-[1200px] mx-auto flex flex-col gap-6 font-sans"
      style={{ background: colors.surface[50] }}
    >
      {/* ── Page header ── */}
      <div>
        <h1
          className="text-[20px] font-semibold"
          style={{ color: colors.text.primary }}
        >
          Analytics
        </h1>
        <p
          className="text-[13px] mt-0.5"
          style={{ color: colors.text.secondary }}
        >
          Your behavioral authorship profile over time.
        </p>
      </div>

      {/* ── Personal bests row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <BestCard
          label="Total Sessions"
          value={personal_bests.total_sessions}
        />
        <BestCard
          label="Best WPM"
          value={personal_bests.best_wpm}
          unit="wpm"
          accent={brand.action}
        />
        <BestCard
          label="Best Confidence"
          value={`${personal_bests.best_confidence}%`}
          accent={brand.humanText}
        />
        <BestCard
          label="Longest Session"
          value={formatDuration(personal_bests.longest_session)}
        />
        <BestCard
          label="Best Avg IKI"
          value={personal_bests.best_iki}
          unit="ms"
        />
        <BestCard label="Total Time" value={totalTime} />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div
          className="bg-white border rounded-xl shadow-sm p-6"
          style={{ borderColor: colors.surface[200] }}
        >
          <WpmChart trend={daily_trend} />
        </div>
        <div
          className="bg-white border rounded-xl shadow-sm p-6"
          style={{ borderColor: colors.surface[200] }}
        >
          <ConfidenceChart trend={daily_trend} />
        </div>
      </div>

      {/* ── Course breakdown ── */}
      {course_breakdown.length > 0 && (
        <div
          className="bg-white border rounded-xl shadow-sm overflow-hidden"
          style={{ borderColor: colors.surface[200] }}
        >
          <div
            className="px-5 py-4 border-b"
            style={{ borderColor: colors.surface[200] }}
          >
            <h3
              className="text-[14px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Performance by Course
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr
                  style={{
                    background: colors.surface[50],
                    borderBottom: `1px solid ${colors.surface[200]}`,
                  }}
                >
                  {[
                    "Course",
                    "Sessions",
                    "Avg WPM",
                    "Avg Confidence",
                    "Human Rate",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: colors.text.secondary }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {course_breakdown.map((c) => {
                  const humanRate =
                    c.session_count > 0
                      ? Math.round((c.human_count / c.session_count) * 100)
                      : 0;
                  const isPersonal = c.course_name === "Personal";
                  return (
                    <tr
                      key={c.course_name}
                      className="border-b last:border-0 hover:bg-[#fafafa] transition-colors"
                      style={{ borderColor: colors.surface[100] }}
                    >
                      <td className="px-5 py-3">
                        <span
                          className="font-semibold"
                          style={{ color: colors.text.primary }}
                        >
                          {c.course_name}
                        </span>
                        {isPersonal && (
                          <span
                            className="ml-2 text-[10px] px-1.5 py-0.5 rounded-md"
                            style={{
                              background: colors.surface[100],
                              color: colors.text.secondary,
                            }}
                          >
                            private
                          </span>
                        )}
                      </td>
                      <td
                        className="px-5 py-3 font-mono font-semibold"
                        style={{ color: colors.text.primary }}
                      >
                        {c.session_count}
                      </td>
                      <td
                        className="px-5 py-3 font-mono font-semibold"
                        style={{ color: colors.text.primary }}
                      >
                        {c.avg_wpm}
                      </td>
                      <td className="px-5 py-3">
                        {/* Mini progress bar for confidence */}
                        <div className="flex items-center gap-2">
                          <div
                            className="w-20 h-1.5 rounded-full overflow-hidden"
                            style={{ background: colors.surface[100] }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${c.avg_confidence}%`,
                                background:
                                  c.avg_confidence >= 80
                                    ? brand.humanText
                                    : c.avg_confidence >= 60
                                      ? "#f59e0b"
                                      : brand.aiAccent,
                              }}
                            />
                          </div>
                          <span
                            className="font-mono text-[12px]"
                            style={{ color: colors.text.secondary }}
                          >
                            {c.avg_confidence}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-16 h-1.5 rounded-full overflow-hidden"
                            style={{ background: colors.surface[100] }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${humanRate}%`,
                                background:
                                  humanRate >= 80 ? brand.humanText : "#f59e0b",
                              }}
                            />
                          </div>
                          <span
                            className="font-mono text-[12px]"
                            style={{ color: colors.text.secondary }}
                          >
                            {humanRate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {!isPersonal && (
                          <Link
                            to={ROUTES.EDITOR}
                            className="text-[12px] font-semibold"
                            style={{ color: brand.action }}
                          >
                            Sessions →
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Activity heatmap hint — 30-day summary ── */}
      <div
        className="bg-white border rounded-xl shadow-sm p-6"
        style={{ borderColor: colors.surface[200] }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3
            className="text-[14px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            30-Day Activity
          </h3>
          <span
            className="text-[12px]"
            style={{ color: colors.text.secondary }}
          >
            {daily_trend.filter((d) => d.session_count > 0).length} active days
          </span>
        </div>

        {/* Calendar-style dot grid */}
        <div className="flex gap-1 flex-wrap">
          {daily_trend.map((day) => {
            const intensity =
              day.session_count === 0
                ? 0
                : day.session_count === 1
                  ? 1
                  : day.session_count <= 3
                    ? 2
                    : 3;
            const bgMap = [
              "#eaeaea",
              `${brand.action}30`,
              `${brand.action}70`,
              brand.action,
            ];
            return (
              <div
                key={day.date}
                className="w-4 h-4 rounded-sm transition-opacity"
                style={{ background: bgMap[intensity] }}
                title={`${day.label}: ${day.session_count} session${day.session_count !== 1 ? "s" : ""}${day.avg_wpm > 0 ? ` · ${day.avg_wpm} WPM` : ""}`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3">
          <span
            className="text-[11px]"
            style={{ color: colors.text.secondary }}
          >
            Less
          </span>
          {[0, 1, 2, 3].map((i) => {
            const bgMap = [
              "#eaeaea",
              `${brand.action}30`,
              `${brand.action}70`,
              brand.action,
            ];
            return (
              <div
                key={i}
                className="w-3.5 h-3.5 rounded-sm"
                style={{ background: bgMap[i] }}
              />
            );
          })}
          <span
            className="text-[11px]"
            style={{ color: colors.text.secondary }}
          >
            More
          </span>
        </div>
      </div>
    </div>
  );
}
