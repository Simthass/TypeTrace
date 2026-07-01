import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  Tooltip,
} from "recharts";

import { ROUTES } from "../constants/routes";
import { api, getApiErrorMessage } from "../lib/api";
import { useToast } from "../components/ui/ToastProvider";
import { brand, colors } from "../styles/colors";
import { useAuthStore } from "../store/authStore";
import { API_ROUTES } from "../constants/apiRoutes";
import { ErrorState } from "../components/ui/AsyncState";

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

interface NormalizedTrendPoint {
  day: string;
  label: string;
  session_count: number;
  avg_wpm: number;
  avg_confidence: number;
  human_sessions: number;
  suspicious_sessions: number;
  synthetic_sessions: number;
}

function Icon({ type, size = 16 }: { type: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    list: (
      <>
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M3 6h.01" />
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    award: (
      <>
        <circle cx="12" cy="8" r="5" />
        <path d="M8.5 12.5 7 22l5-3 5 3-1.5-9.5" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    arrowRight: <path d="M5 12h14m-6-6 6 6-6 6" />,
    replay: (
      <>
        <path d="M2 12a10 10 0 1 0 3-7.07" />
        <path d="M2 4v6h6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[type] ?? null}
    </svg>
  );
}

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

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function formatDayLabel(day: string): string {
  const parsed = new Date(day);
  if (Number.isNaN(parsed.getTime())) return day.slice(5);
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function replayRoute(sessionId: string | number): string {
  return ROUTES.REPLAY.replace(":sessionId", String(sessionId));
}

function greetingLabel(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getTrendDelta(
  points: NormalizedTrendPoint[],
  key: keyof Pick<
    NormalizedTrendPoint,
    "session_count" | "avg_confidence" | "avg_wpm"
  >,
): number {
  if (points.length < 2) return 0;

  const midpoint = Math.max(1, Math.floor(points.length / 2));
  const earlier = points.slice(0, midpoint);
  const later = points.slice(midpoint);

  const average = (items: NormalizedTrendPoint[]) =>
    items.reduce((sum, item) => sum + Number(item[key] || 0), 0) /
    Math.max(items.length, 1);

  const previous = average(earlier);
  const current = average(later);

  if (!previous && current) return 100;
  if (!previous) return 0;

  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function normalizeTrend(points: TrendPoint[] = []): NormalizedTrendPoint[] {
  const byDay = new Map(points.map((point) => [point.day, point]));

  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - index));
    const day = date.toISOString().slice(0, 10);
    const match = byDay.get(day);

    return {
      day,
      label: formatDayLabel(day),
      session_count: match?.session_count ?? 0,
      avg_wpm: match?.avg_wpm ?? 0,
      avg_confidence: match?.avg_confidence ?? 0,
      human_sessions: match?.human_count ?? 0,
      suspicious_sessions: match?.suspicious_count ?? 0,
      synthetic_sessions: match?.synthetic_count ?? 0,
    };
  });
}

function classificationStyle(bucket: string) {
  const normalized = String(bucket || "").toUpperCase();

  if (normalized === "HUMAN") {
    return {
      bg: brand.humanBg,
      text: brand.humanText,
      color: colors.green,
      label: "Human",
    };
  }

  if (normalized === "SUSPICIOUS") {
    return {
      bg: brand.suspiciousBg,
      text: brand.suspiciousText,
      color: colors.amber,
      label: "Suspicious",
    };
  }

  return {
    bg: brand.aiBg,
    text: brand.aiText,
    color: colors.red,
    label: "High Risk",
  };
}

function reviewStyle(status: string) {
  const normalized = String(status || "").toUpperCase();

  if (normalized === "APPROVED") {
    return {
      bg: brand.humanBg,
      text: brand.humanText,
      label: "Approved",
    };
  }

  if (normalized === "FLAGGED") {
    return {
      bg: brand.aiBg,
      text: brand.aiText,
      label: "Flagged",
    };
  }

  return {
    bg: colors.surface[200],
    text: colors.text.secondary,
    label: "Pending",
  };
}

function StatusBadge({
  label,
  background,
  color,
}: {
  label: string;
  background: string;
  color: string;
}) {
  return (
    <span
      className="inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: background, color }}
    >
      {label}
    </span>
  );
}

function TrendBadge({ value }: { value: number }) {
  const positive = value >= 0;

  return (
    <span
      className="rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums"
      style={{
        backgroundColor: positive ? colors.mintTint : colors.roseTint,
        color: positive ? brand.humanText : brand.aiText,
      }}
    >
      {positive ? "↑" : "↓"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-md border bg-white shadow-none ${className}`}
      style={{
        borderColor: colors.surface[200],
        boxShadow: `0 1px 3px ${colors.shadow}`,
      }}
    >
      {children}
    </section>
  );
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md ${className}`}
      style={{ backgroundColor: colors.surface[200] }}
    />
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-md px-3 py-2 text-[12px] shadow-lg"
      style={{
        backgroundColor: colors.text.primary,
        color: colors.text.light,
      }}
    >
      <p className="mb-1 font-semibold">{label}</p>
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-md"
              style={{ backgroundColor: item.color || colors.brand }}
            />
            <span>{item.name}</span>
            <span className="ml-2 font-semibold tabular-nums">
              {item.value ?? 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  context,
  trend,
  icon,
  loading,
}: {
  label: string;
  value: string;
  context: string;
  trend: number;
  icon: string;
  loading?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <p
          className="text-[11px] font-bold uppercase tracking-[0.14em]"
          style={{ color: colors.text.muted }}
        >
          {label}
        </p>
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{ backgroundColor: colors.brandSoft, color: colors.brand }}
        >
          <Icon type={icon} />
        </div>
      </div>

      <div className="mt-5">
        {loading ? (
          <SkeletonBlock className="h-9 w-24" />
        ) : (
          <p
            className="text-[32px] font-bold tracking-[-0.05em] tabular-nums"
            style={{ color: colors.text.primary }}
          >
            {value}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        {loading ? (
          <SkeletonBlock className="h-5 w-16" />
        ) : (
          <TrendBadge value={trend} />
        )}
        <span
          className="truncate text-[12px]"
          style={{ color: colors.text.muted }}
        >
          {context}
        </span>
      </div>
    </Card>
  );
}

function DashboardLoadingShell() {
  return (
    <>
      <div
        className="fixed left-0 right-0 top-0 z-50 h-0.5 animate-pulse"
        style={{ backgroundColor: colors.brand }}
      />

      <div className="space-y-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="space-y-2">
            <SkeletonBlock className="h-8 w-64" />
            <SkeletonBlock className="h-4 w-80 max-w-full" />
          </div>
          <div className="flex gap-2">
            <SkeletonBlock className="h-9 w-28" />
            <SkeletonBlock className="h-9 w-32" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <MetricCard
              key={item}
              label="Loading"
              value=""
              context="Loading"
              trend={0}
              icon="list"
              loading
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <Card className="p-5">
              <div className="mb-5 flex items-center justify-between">
                <SkeletonBlock className="h-5 w-40" />
                <SkeletonBlock className="h-7 w-28" />
              </div>
              <SkeletonBlock className="h-72 w-full" />
            </Card>
            <Card className="p-5">
              <SkeletonBlock className="h-64 w-full" />
            </Card>
          </div>
          <div className="space-y-5">
            <Card className="p-5">
              <SkeletonBlock className="h-72 w-full" />
            </Card>
            <Card className="p-5">
              <SkeletonBlock className="h-40 w-full" />
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function EmptyDashboard() {
  return (
    <Card className="p-6">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2
            className="text-[16px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Start your first evidence session
          </h2>
          <p
            className="mt-1 max-w-2xl text-[13px] leading-6"
            style={{ color: colors.text.secondary }}
          >
            Create a writing session to begin collecting keystroke timing, paste
            activity, revision behaviour, and certificate-ready authorship
            evidence.
          </p>
        </div>

        <Link
          to={ROUTES.EDITOR_NEW}
          className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-semibold text-white"
          style={{ backgroundColor: colors.brand }}
        >
          <Icon type="plus" />
          New Session
        </Link>
      </div>
    </Card>
  );
}

function AuthorshipHealthCard({
  trend,
  summary,
}: {
  trend: NormalizedTrendPoint[];
  summary: StudentSummary;
}) {
  return (
    <Card className="p-5">
      <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2
            className="text-[14px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Authorship Health
          </h2>
          <p
            className="mt-1 text-[12px]"
            style={{ color: colors.text.secondary }}
          >
            Human, suspicious, and high-risk evidence distribution across recent
            activity.
          </p>
        </div>

        <div
          className="flex rounded-md border bg-white p-1"
          style={{ borderColor: colors.surface[200] }}
        >
          {["7d", "14d", "30d"].map((period) => (
            <button
              key={period}
              type="button"
              className="h-7 rounded-md px-3 text-[11px] font-semibold transition-colors"
              style={{
                backgroundColor:
                  period === "14d" ? colors.brandSoft : "transparent",
                color: period === "14d" ? colors.brand : colors.text.secondary,
              }}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={trend}
            margin={{ top: 10, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke={colors.surface[200]}
              strokeDasharray="0"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: colors.text.muted, fontSize: 11 }}
              dy={8}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: colors.surface[200] }}
            />
            <Area
              type="monotone"
              dataKey="human_sessions"
              name="Human"
              stackId="1"
              stroke={colors.green}
              fill={colors.green}
              fillOpacity={0.12}
              strokeWidth={2}
              isAnimationActive
              animationDuration={600}
            />
            <Area
              type="monotone"
              dataKey="suspicious_sessions"
              name="Suspicious"
              stackId="1"
              stroke={colors.amber}
              fill={colors.amber}
              fillOpacity={0.12}
              strokeWidth={2}
              isAnimationActive
              animationDuration={600}
            />
            <Area
              type="monotone"
              dataKey="synthetic_sessions"
              name="High Risk"
              stackId="1"
              stroke={colors.red}
              fill={colors.red}
              fillOpacity={0.12}
              strokeWidth={2}
              isAnimationActive
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <LegendPill
          color={colors.green}
          label={`Human ${summary.human_sessions} sessions`}
        />
        <LegendPill
          color={colors.amber}
          label={`Suspicious ${summary.suspicious_sessions}`}
        />
        <LegendPill
          color={colors.red}
          label={`High Risk ${summary.synthetic_sessions}`}
        />
      </div>
    </Card>
  );
}

function LegendPill({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-md border bg-white px-2.5 py-1 text-[12px] font-medium"
      style={{ borderColor: colors.surface[200], color: colors.text.secondary }}
    >
      <span className="h-2 w-2 rounded-md" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function RecentSessionsTable({ sessions }: { sessions: StudentSession[] }) {
  return (
    <Card className="overflow-hidden p-5">
      <div className="mb-2 flex items-center justify-between gap-4">
        <h2
          className="text-[14px] font-semibold"
          style={{ color: colors.text.primary }}
        >
          Recent Sessions
        </h2>
        <Link
          to={ROUTES.SESSIONS}
          className="text-[12px] font-semibold"
          style={{ color: colors.brand }}
        >
          View all →
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr>
              {[
                "Document",
                "Classification",
                "Confidence",
                "WPM",
                "Review",
                "Date",
                "Action",
              ].map((header) => (
                <th
                  key={header}
                  className="border-b py-3 text-left text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{
                    borderColor: colors.surface[200],
                    color: colors.text.muted,
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sessions.slice(0, 5).map((session) => {
              const classification = classificationStyle(
                session.classification_bucket,
              );
              const review = reviewStyle(session.review_status);

              return (
                <tr
                  key={session.id}
                  className="h-14 border-b transition-colors hover:bg-surface-100"
                  style={{ borderColor: colors.surface[200] }}
                >
                  <td className="py-3 pr-4">
                    <p
                      className="max-w-[240px] truncate text-[13px] font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      {session.title}
                    </p>
                    <p
                      className="mt-0.5 max-w-[240px] truncate text-[11px]"
                      style={{ color: colors.text.muted }}
                    >
                      {session.course_name || "Personal workspace"}
                    </p>
                  </td>

                  <td className="py-3 pr-4">
                    <StatusBadge
                      label={classification.label}
                      background={classification.bg}
                      color={classification.text}
                    />
                  </td>

                  <td
                    className="py-3 pr-4 font-mono text-[13px] tabular-nums"
                    style={{ color: colors.text.primary }}
                  >
                    {Math.round(session.confidence)}%
                  </td>

                  <td
                    className="py-3 pr-4 text-[13px] font-semibold tabular-nums"
                    style={{ color: colors.text.primary }}
                  >
                    {session.wpm}
                  </td>

                  <td className="py-3 pr-4">
                    <StatusBadge
                      label={review.label}
                      background={review.bg}
                      color={review.text}
                    />
                  </td>

                  <td
                    className="py-3 pr-4 text-[12px] tabular-nums"
                    style={{ color: colors.text.secondary }}
                  >
                    {session.created_at}
                  </td>

                  <td className="py-3">
                    <Link
                      to={replayRoute(session.id)}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-white px-2 text-[11px] font-semibold transition-colors hover:bg-surface-100"
                      style={{
                        borderColor: colors.surface[200],
                        color: colors.text.secondary,
                      }}
                    >
                      <Icon type="replay" size={13} />
                      Replay
                    </Link>
                  </td>
                </tr>
              );
            })}

            {!sessions.length && (
              <tr>
                <td
                  colSpan={7}
                  className="py-10 text-center text-[13px]"
                  style={{ color: colors.text.muted }}
                >
                  No sessions recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ClassificationBreakdownCard({ summary }: { summary: StudentSummary }) {
  const chartData = [
    { name: "Human", value: summary.human_sessions, color: colors.green },
    {
      name: "Suspicious",
      value: summary.suspicious_sessions,
      color: colors.amber,
    },
    { name: "High Risk", value: summary.synthetic_sessions, color: colors.red },
  ];

  const safeData = summary.total_sessions
    ? chartData
    : chartData.map((item, index) => ({ ...item, value: index === 0 ? 1 : 0 }));

  return (
    <Card className="p-5">
      <h2
        className="text-[14px] font-semibold"
        style={{ color: colors.text.primary }}
      >
        Classification Breakdown
      </h2>

      <div className="relative mt-4 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={safeData}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={summary.total_sessions ? 3 : 0}
              stroke="none"
              isAnimationActive
              animationDuration={600}
            >
              {safeData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={
                    summary.total_sessions ? entry.color : colors.surface[200]
                  }
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p
            className="text-[28px] font-bold tabular-nums"
            style={{ color: colors.text.primary }}
          >
            {summary.total_sessions}
          </p>
          <p className="text-[11px]" style={{ color: colors.text.muted }}>
            Total sessions
          </p>
        </div>
      </div>

      <div className="mt-2 space-y-3">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-md"
              style={{ backgroundColor: item.color }}
            />
            <span
              className="text-[13px] font-medium"
              style={{ color: colors.text.secondary }}
            >
              {item.name}
            </span>
            <span
              className="ml-auto text-[13px] font-bold tabular-nums"
              style={{ color: colors.text.primary }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function WritingVelocityCard({
  trend,
  avgWpm,
  delta,
}: {
  trend: NormalizedTrendPoint[];
  avgWpm: number;
  delta: number;
}) {
  return (
    <Card className="p-5">
      <p className="text-[13px]" style={{ color: colors.text.muted }}>
        Avg WPM this period
      </p>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p
          className="text-[28px] font-bold tracking-[-0.04em] tabular-nums"
          style={{ color: colors.text.primary }}
        >
          {avgWpm.toFixed(1)}
        </p>
        <TrendBadge value={delta} />
      </div>

      <div className="mt-4 h-20">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={trend}
            margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
          >
            <Line
              type="monotone"
              dataKey="avg_wpm"
              stroke={colors.brand}
              strokeWidth={2}
              dot={false}
              isAnimationActive
              animationDuration={600}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function PendingActionsCard({ sessions }: { sessions: StudentSession[] }) {
  const pendingSessions = sessions
    .filter((session) => {
      const status = String(session.review_status || "").toUpperCase();
      return status === "PENDING" || status === "FLAGGED";
    })
    .slice(0, 3);

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2
          className="text-[14px] font-semibold"
          style={{ color: colors.text.primary }}
        >
          Pending Actions
        </h2>
        <span
          className="rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums"
          style={{ backgroundColor: colors.brandSoft, color: colors.brand }}
        >
          {pendingSessions.length}
        </span>
      </div>

      {pendingSessions.length ? (
        <div className="mt-3">
          {pendingSessions.map((session) => {
            const review = reviewStyle(session.review_status);

            return (
              <div
                key={session.id}
                className="border-b py-3"
                style={{ borderColor: colors.surface[200] }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className="truncate text-[13px] font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      {session.title}
                    </p>
                    <div className="mt-1">
                      <StatusBadge
                        label={review.label}
                        background={review.bg}
                        color={review.text}
                      />
                    </div>
                  </div>

                  <Link
                    to={replayRoute(session.id)}
                    className="shrink-0 text-[12px] font-semibold"
                    style={{ color: colors.brand }}
                  >
                    View →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p
          className="py-6 text-center text-[13px]"
          style={{ color: colors.text.muted }}
        >
          All caught up. No pending reviews.
        </p>
      )}
    </Card>
  );
}

function GettingStartedCard({
  totalSessions,
  certificateCount,
  courseCount,
}: {
  totalSessions: number;
  certificateCount: number;
  courseCount: number;
}) {
  const items = [
    { label: "Create your first writing session", done: totalSessions > 0 },
    { label: "Generate an evidence certificate", done: certificateCount > 0 },
    { label: "Join or link a course workspace", done: courseCount > 0 },
  ];

  const complete = items.filter((item) => item.done).length;
  const progress = Math.round((complete / items.length) * 100);

  if (totalSessions >= 3) return null;

  return (
    <Card className="p-5">
      <h2
        className="text-[14px] font-semibold"
        style={{ color: colors.text.primary }}
      >
        Getting Started
      </h2>

      <div className="mt-4 space-y-1">
        {items.map((item) => (
          <div key={item.label} className="flex h-10 items-center gap-3">
            <span
              className="flex h-5 w-5 items-center justify-center rounded-md border"
              style={{
                backgroundColor: item.done ? colors.green : colors.surface[50],
                borderColor: item.done ? colors.green : colors.surface[300],
                color: colors.text.light,
              }}
            >
              {item.done && <Icon type="check" size={13} />}
            </span>
            <span
              className={`text-[13px] ${item.done ? "line-through" : ""}`}
              style={{
                color: item.done ? colors.text.muted : colors.text.primary,
              }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <div
        className="mt-4 h-1 rounded-md"
        style={{ backgroundColor: colors.surface[200] }}
      >
        <div
          className="h-1 rounded-md transition-all duration-500"
          style={{ width: `${progress}%`, backgroundColor: colors.brand }}
        />
      </div>
    </Card>
  );
}

function CourseBreakdownSection({ courses }: { courses: CourseBreakdown[] }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2
          className="text-[14px] font-semibold"
          style={{ color: colors.text.primary }}
        >
          Course Breakdown
        </h2>
        <Link
          to={ROUTES.JOIN_COURSE}
          className="text-[12px] font-semibold"
          style={{ color: colors.brand }}
        >
          Join course →
        </Link>
      </div>

      {courses.length ? (
        <div className="flex gap-4 overflow-x-auto pb-1">
          {courses.map((course) => {
            const humanRatio = pct(course.human_count, course.session_count);

            return (
              <Card
                key={`${course.course_name}-${course.course_code}`}
                className="min-w-[220px] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3
                      className="truncate text-[13px] font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      {course.course_name}
                    </h3>
                    <p
                      className="mt-1 truncate font-mono text-[11px]"
                      style={{ color: colors.text.muted }}
                    >
                      {course.course_code || "PERSONAL"}
                    </p>
                  </div>

                  <span
                    className="rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums"
                    style={{
                      backgroundColor: colors.mintTint,
                      color: brand.humanText,
                    }}
                  >
                    {humanRatio}%
                  </span>
                </div>

                <div
                  className="mt-4 h-1.5 rounded-md"
                  style={{ backgroundColor: colors.surface[200] }}
                >
                  <div
                    className="h-1.5 rounded-md"
                    style={{
                      width: `${clamp(humanRatio)}%`,
                      backgroundColor: colors.green,
                    }}
                  />
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p
                    className="text-[12px] tabular-nums"
                    style={{ color: colors.text.secondary }}
                  >
                    {course.session_count} sessions
                  </p>
                  <p
                    className="text-[12px] font-semibold tabular-nums"
                    style={{ color: colors.text.primary }}
                  >
                    {course.avg_wpm} WPM
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-5">
          <p className="text-[13px]" style={{ color: colors.text.muted }}>
            No course-linked sessions yet. Personal sessions will appear here
            after analysis.
          </p>
        </Card>
      )}
    </section>
  );
}

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

  const trend = useMemo(() => normalizeTrend(data?.trend ?? []), [data?.trend]);

  const sessionDelta = useMemo(
    () => getTrendDelta(trend, "session_count"),
    [trend],
  );

  const confidenceDelta = useMemo(
    () => getTrendDelta(trend, "avg_confidence"),
    [trend],
  );

  const wpmDelta = useMemo(() => getTrendDelta(trend, "avg_wpm"), [trend]);

  const certificateRatio = useMemo(
    () =>
      summary
        ? pct(summary.certificate_count, Math.max(summary.total_sessions, 1))
        : 0,
    [summary],
  );

  const totalHumanRate = useMemo(
    () => (summary ? pct(summary.human_sessions, summary.total_sessions) : 0),
    [summary],
  );

  if (isLoading) return <DashboardLoadingShell />;

  if (apiError) {
    return (
      <ErrorState
        title="Could not load dashboard"
        message={apiError}
        action={
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md px-4 py-2.5 text-[13px] font-bold text-white"
            style={{ backgroundColor: colors.brand }}
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
            className="rounded-md px-4 py-2.5 text-[13px] font-bold text-white"
            style={{ backgroundColor: colors.brand }}
          >
            Reload
          </button>
        }
      />
    );
  }

  const firstName = user?.first_name || "Student";
  const hasNoActivity = summary.total_sessions === 0;

  return (
    <div className="space-y-5">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1
            className="text-[28px] font-bold tracking-[-0.04em]"
            style={{ color: colors.text.primary }}
          >
            {greetingLabel()}, {firstName}.
          </h1>
          <p
            className="mt-1 text-[13px]"
            style={{ color: colors.text.secondary }}
          >
            Here's what's happening with your authorship evidence today.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to={ROUTES.EDITOR_NEW}
            className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-semibold text-white"
            style={{ backgroundColor: colors.brand }}
          >
            <Icon type="plus" />
            New Session
          </Link>
          <Link
            to={ROUTES.SESSIONS}
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-[13px] font-semibold transition-colors hover:bg-surface-100"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          >
            View All Sessions
          </Link>
        </div>
      </section>

      {hasNoActivity && <EmptyDashboard />}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Sessions"
          value={String(summary.total_sessions)}
          context="vs last 30 days"
          trend={sessionDelta}
          icon="list"
        />
        <MetricCard
          label="Avg Confidence"
          value={`${Math.round(summary.avg_confidence)}%`}
          context={`${totalHumanRate}% human evidence`}
          trend={confidenceDelta}
          icon="shield"
        />
        <MetricCard
          label="Certificates Issued"
          value={String(summary.certificate_count)}
          context={`${certificateRatio}% of sessions`}
          trend={certificateRatio}
          icon="award"
        />
        <MetricCard
          label="Total Writing Time"
          value={formatSeconds(summary.total_seconds)}
          context="captured evidence"
          trend={sessionDelta}
          icon="clock"
        />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <AuthorshipHealthCard trend={trend} summary={summary} />
          <RecentSessionsTable sessions={data.recent_sessions} />
        </div>

        <div className="space-y-5">
          <ClassificationBreakdownCard summary={summary} />
          <WritingVelocityCard
            trend={trend}
            avgWpm={summary.avg_wpm}
            delta={wpmDelta}
          />
          <PendingActionsCard sessions={data.recent_sessions} />
          <GettingStartedCard
            totalSessions={summary.total_sessions}
            certificateCount={summary.certificate_count}
            courseCount={data.courses.length}
          />
        </div>
      </section>

      <CourseBreakdownSection courses={data.courses} />
    </div>
  );
}
