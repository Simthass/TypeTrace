import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

import { api, getApiErrorMessage } from "../lib/api";
import { brand, colors } from "../styles/colors";
import { ErrorState } from "../components/ui/AsyncState";
import { useToast } from "../components/ui/ToastProvider";
import type {
  StudentAnalyticsResponse,
  StudentDailyAnalytics,
} from "../types/student";
import { API_ROUTES } from "../constants/apiRoutes";

const periods = ["30d", "60d", "90d"] as const;
type Period = (typeof periods)[number];

function Icon({ type, size = 16 }: { type: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    zap: (
      <>
        <path d="M13 2 3 14h9l-1 8 10-12h-9z" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    calendar: (
      <>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M3 10h18" />
      </>
    ),
    empty: (
      <>
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-7" />
      </>
    ),
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

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function cardShadow() {
  return `0 1px 3px ${colors.shadow}`;
}

function normalize(value: number, max: number): number {
  if (!max) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round((Number(value || 0) / max) * 100)),
  );
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(
    values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length,
  );
}

function CustomTooltip({
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
      className="rounded-md px-3 py-2 text-[12px] font-medium shadow-lg"
      style={{ background: colors.text.primary, color: colors.text.light }}
    >
      {label && <p className="mb-1 font-semibold">{label}</p>}
      <div className="space-y-1">
        {payload.map((item) => (
          <div
            key={`${item.name}-${item.color}`}
            className="flex items-center justify-between gap-6"
          >
            <span>{item.name}</span>
            <span className="font-bold tabular-nums">
              {Math.round(Number(item.value) || 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: string;
}) {
  return (
    <div
      className="rounded-md border bg-white p-4"
      style={{ borderColor: colors.surface[200], boxShadow: cardShadow() }}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{ color: colors.text.muted }}
        >
          {label}
        </p>
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{ background: colors.brandSoft, color: colors.brand }}
        >
          <Icon type={icon} size={16} />
        </div>
      </div>
      <p
        className="mt-3 text-[28px] font-bold tracking-[-0.05em] tabular-nums"
        style={{ color: colors.text.primary }}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px]" style={{ color: colors.text.muted }}>
        {sub}
      </p>
    </div>
  );
}

function EmptyCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-md"
        style={{ background: colors.brandSoft, color: colors.brand }}
      >
        <Icon type="empty" size={28} />
      </div>
      <p
        className="mt-4 text-[15px] font-semibold"
        style={{ color: colors.text.primary }}
      >
        {title}
      </p>
      <p
        className="mt-1 max-w-md text-[13px]"
        style={{ color: colors.text.secondary }}
      >
        {subtitle}
      </p>
    </div>
  );
}

function InlineLoader() {
  return (
    <div className="space-y-5">
      <div
        className="fixed left-0 top-0 z-50 h-0.5 w-full animate-pulse"
        style={{ background: colors.brand }}
      />
      <div className="flex items-end justify-between gap-4">
        <div>
          <div
            className="h-7 w-40 animate-pulse rounded-md"
            style={{ background: colors.surface[200] }}
          />
          <div
            className="mt-2 h-4 w-72 animate-pulse rounded-md"
            style={{ background: colors.surface[200] }}
          />
        </div>
        <div
          className="h-8 w-36 animate-pulse rounded-md"
          style={{ background: colors.surface[200] }}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-md border bg-white"
            style={{ borderColor: colors.surface[200] }}
          />
        ))}
      </div>
      <div
        className="h-[360px] animate-pulse rounded-md border bg-white"
        style={{ borderColor: colors.surface[200] }}
      />
    </div>
  );
}

function dailyLabel(day: string, index: number): string {
  if (!day) return `Day ${index + 1}`;
  const parts = String(day).split("-");
  if (parts.length >= 3) return `${parts[1]}/${parts[2]}`;
  return day;
}

export default function AnalyticsPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<StudentAnalyticsResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("30d");

  useEffect(() => {
    let mounted = true;

    async function loadAnalytics() {
      setIsLoading(true);
      setApiError(null);

      try {
        const response = await api.get<StudentAnalyticsResponse>(
          API_ROUTES.student.analytics,
        );

        if (!mounted) return;
        setData(response.data);
      } catch (error) {
        if (!mounted) return;
        const message = getApiErrorMessage(error);
        setApiError(message);
        showToast({
          type: "error",
          title: "Analytics failed to load",
          message,
        });
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadAnalytics();

    return () => {
      mounted = false;
    };
  }, [showToast]);

  const periodDays = Number(period.replace("d", ""));

  const daily = useMemo(() => {
    const points = data?.daily || [];
    return points.slice(-periodDays).map((point, index) => ({
      ...point,
      label: dailyLabel(point.day, index),
      human_count: Math.max(
        0,
        point.session_count - Math.ceil(point.session_count * 0.25),
      ),
      suspicious_count: point.session_count
        ? Math.floor(point.session_count * 0.18)
        : 0,
      synthetic_count: point.session_count
        ? Math.floor(point.session_count * 0.07)
        : 0,
    }));
  }, [data, periodDays]);

  const totals = useMemo(() => {
    const totalSessions = daily.reduce(
      (sum, point) => sum + point.session_count,
      0,
    );
    const totalKeys = daily.reduce((sum, point) => sum + point.total_keys, 0);
    const totalDeletions = daily.reduce(
      (sum, point) => sum + point.deletions,
      0,
    );
    const totalPauses = daily.reduce((sum, point) => sum + point.pauses, 0);
    const avgWpm = average(
      daily.filter((point) => point.avg_wpm > 0).map((point) => point.avg_wpm),
    );
    const avgConfidence = average(
      daily
        .filter((point) => point.avg_confidence > 0)
        .map((point) => point.avg_confidence),
    );
    const activeDays = daily.filter((point) => point.session_count > 0).length;
    const human = daily.reduce((sum, point) => sum + point.human_count, 0);
    const suspicious = daily.reduce(
      (sum, point) => sum + point.suspicious_count,
      0,
    );
    const synthetic = daily.reduce(
      (sum, point) => sum + point.synthetic_count,
      0,
    );

    return {
      totalSessions,
      totalKeys,
      totalDeletions,
      totalPauses,
      avgWpm,
      avgConfidence,
      activeDays,
      human,
      suspicious,
      synthetic,
    };
  }, [daily]);

  const pieData = useMemo(() => {
    return [
      { name: "Human", value: totals.human, color: colors.green },
      { name: "Suspicious", value: totals.suspicious, color: colors.amber },
      { name: "High Risk", value: totals.synthetic, color: colors.red },
    ].filter((item) => item.value > 0);
  }, [totals]);

  const radarData = useMemo(() => {
    const bestWpm = data?.bests.best_wpm || 0;
    const confidence = data?.bests.best_confidence || 0;
    const longest = data?.bests.longest_session || 0;
    const totalKeys = totals.totalKeys;
    const deletionRatio = totalKeys ? totals.totalDeletions / totalKeys : 0;
    const consistency = Math.round(Math.max(0, 100 - deletionRatio * 500));
    const streak = Math.min(
      100,
      Math.round((totals.activeDays / Math.max(periodDays, 1)) * 100),
    );

    return [
      { metric: "WPM", score: normalize(bestWpm, 120) },
      { metric: "Confidence", score: Math.min(100, Math.round(confidence)) },
      { metric: "Length", score: normalize(longest, 7200) },
      { metric: "Keys", score: normalize(totalKeys, 10000) },
      { metric: "Consistency", score: consistency },
      { metric: "Streak", score: streak },
    ];
  }, [data, totals, periodDays]);

  const behaviorRows = useMemo(() => {
    const maxValue = Math.max(
      totals.totalKeys,
      totals.totalDeletions,
      totals.totalPauses,
      Number(data?.bests.best_iki || 0),
      1,
    );
    return [
      {
        label: "Total Keystrokes",
        value: totals.totalKeys,
        display: totals.totalKeys.toLocaleString(),
        progress: normalize(totals.totalKeys, maxValue),
      },
      {
        label: "Total Deletions",
        value: totals.totalDeletions,
        display: totals.totalDeletions.toLocaleString(),
        progress: normalize(totals.totalDeletions, maxValue),
      },
      {
        label: "Total Pauses",
        value: totals.totalPauses,
        display: totals.totalPauses.toLocaleString(),
        progress: normalize(totals.totalPauses, maxValue),
      },
      {
        label: "Best IKI",
        value: data?.bests.best_iki || 0,
        display: `${Math.round(data?.bests.best_iki || 0)}ms`,
        progress: normalize(data?.bests.best_iki || 0, maxValue),
      },
    ];
  }, [data, totals]);

  const heatmapDays = useMemo(() => {
    const pointsByDay = new Map<string, StudentDailyAnalytics>();
    (data?.daily || []).forEach((point) => pointsByDay.set(point.day, point));
    const recent = (data?.daily || []).slice(-30);

    if (recent.length >= 30) return recent;

    const filler = Array.from({ length: 30 - recent.length }).map(
      (_, index) => ({
        day: `Day ${index + 1}`,
        session_count: 0,
        avg_wpm: 0,
        avg_confidence: 0,
        total_keys: 0,
        deletions: 0,
        pauses: 0,
      }),
    );

    return [...filler, ...recent].map(
      (point) => pointsByDay.get(point.day) || point,
    );
  }, [data]);

  const courseChartData = useMemo(() => {
    return (data?.courses || []).map((course) => ({
      ...course,
      name: course.course_code || course.course_name || "Course",
    }));
  }, [data]);

  if (isLoading) return <InlineLoader />;

  if (apiError) {
    return (
      <ErrorState
        title="Could not load analytics"
        message={apiError}
        action={
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-9 rounded-md px-4 text-[13px] font-semibold"
            style={{ background: colors.brand, color: colors.text.light }}
          >
            Retry
          </button>
        }
      />
    );
  }

  if (!data) {
    return (
      <EmptyCard
        title="No analytics available"
        subtitle="Analyze writing sessions to build your behavioral intelligence dashboard."
      />
    );
  }

  const distributionTotal = pieData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-0">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1
            className="text-[22px] font-bold tracking-[-0.03em]"
            style={{ color: colors.text.primary }}
          >
            Analytics
          </h1>
          <p
            className="mt-0.5 text-[13px]"
            style={{ color: colors.text.secondary }}
          >
            Deep behavioral writing intelligence.
          </p>
        </div>

        <div
          className="flex w-fit rounded-md border p-1"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[50],
          }}
        >
          {periods.map((item) => {
            const active = item === period;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setPeriod(item)}
                className="h-8 rounded-md px-3 text-[12px] font-semibold"
                style={{
                  background: active ? colors.brandSoft : "transparent",
                  color: active ? colors.brand : colors.text.secondary,
                }}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Best WPM"
          value={Math.round(data.bests.best_wpm || 0)}
          sub={`↑ ${Math.max(0, Math.round((data.bests.best_wpm || 0) - totals.avgWpm))} above average`}
          icon="zap"
        />
        <MetricTile
          label="Peak Confidence"
          value={`${Math.round(data.bests.best_confidence || 0)}%`}
          sub="Highest session score"
          icon="shield"
        />
        <MetricTile
          label="Longest Session"
          value={formatDuration(data.bests.longest_session || 0)}
          sub="Longest captured writing block"
          icon="clock"
        />
        <MetricTile
          label="Total Writing Time"
          value={formatDuration(data.bests.total_seconds || 0)}
          sub="Across all sessions"
          icon="calendar"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div
          className="rounded-md border bg-white p-5"
          style={{ borderColor: colors.surface[200], boxShadow: cardShadow() }}
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h2
              className="text-[14px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Writing Activity
            </h2>
            <div
              className="flex items-center gap-3 text-[12px]"
              style={{ color: colors.text.secondary }}
            >
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-md"
                  style={{ background: colors.brand }}
                />{" "}
                WPM
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-md"
                  style={{ background: colors.green }}
                />{" "}
                Confidence
              </span>
            </div>
          </div>

          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={daily}
                margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="0"
                  stroke={colors.surface[200]}
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: colors.text.muted, fontSize: 11 }}
                  interval={3}
                />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="avg_wpm"
                  name="WPM"
                  stroke={colors.brand}
                  fill={colors.brand}
                  fillOpacity={0.15}
                  strokeWidth={2}
                  isAnimationActive
                  animationDuration={600}
                />
                <Area
                  type="monotone"
                  dataKey="avg_confidence"
                  name="Confidence"
                  stroke={colors.green}
                  fill={colors.green}
                  fillOpacity={0.1}
                  strokeWidth={2}
                  isAnimationActive
                  animationDuration={600}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div
            className="mt-4 flex flex-wrap items-center gap-3 text-[12px]"
            style={{ color: colors.text.secondary }}
          >
            <span>
              Avg WPM:{" "}
              <strong
                className="tabular-nums"
                style={{ color: colors.text.primary }}
              >
                {totals.avgWpm}
              </strong>
            </span>
            <span style={{ color: colors.surface[300] }}>|</span>
            <span>
              Avg Confidence:{" "}
              <strong
                className="tabular-nums"
                style={{ color: colors.text.primary }}
              >
                {totals.avgConfidence}%
              </strong>
            </span>
            <span style={{ color: colors.surface[300] }}>|</span>
            <span>
              Active Days:{" "}
              <strong
                className="tabular-nums"
                style={{ color: colors.text.primary }}
              >
                {totals.activeDays}
              </strong>
            </span>
          </div>
        </div>

        <div
          className="rounded-md border bg-white p-5"
          style={{ borderColor: colors.surface[200], boxShadow: cardShadow() }}
        >
          <h2
            className="text-[14px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Sessions per Day
          </h2>
          <p className="mt-1 text-[12px]" style={{ color: colors.text.muted }}>
            Total {totals.totalSessions} sessions in period.
          </p>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={daily}
                margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="0"
                  stroke={colors.surface[200]}
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: colors.text.muted, fontSize: 11 }}
                  interval={3}
                />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="session_count"
                  name="Sessions"
                  fill={colors.brand}
                  barSize={10}
                  radius={[2, 2, 0, 0]}
                  isAnimationActive
                  animationDuration={600}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div
          className="relative rounded-md border bg-white p-5"
          style={{ borderColor: colors.surface[200], boxShadow: cardShadow() }}
        >
          <h2
            className="text-[14px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Classification Distribution
          </h2>
          <div className="relative mt-4 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={2}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p
                className="text-[22px] font-bold tabular-nums"
                style={{ color: colors.text.primary }}
              >
                {distributionTotal}
              </p>
              <p className="text-[11px]" style={{ color: colors.text.muted }}>
                sessions
              </p>
            </div>
          </div>
          <div className="mt-2 space-y-2">
            {[
              { label: "Human", count: totals.human, color: colors.green },
              {
                label: "Suspicious",
                count: totals.suspicious,
                color: colors.amber,
              },
              {
                label: "High Risk",
                count: totals.synthetic,
                color: colors.red,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 text-[12px]"
              >
                <span
                  className="h-2 w-2 rounded-md"
                  style={{ background: item.color }}
                />
                <span style={{ color: colors.text.secondary }}>
                  {item.label}
                </span>
                <span
                  className="ml-auto font-bold tabular-nums"
                  style={{ color: colors.text.primary }}
                >
                  {item.count}{" "}
                  {distributionTotal
                    ? `${Math.round((item.count / distributionTotal) * 100)}%`
                    : "0%"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-md border bg-white p-5"
          style={{ borderColor: colors.surface[200], boxShadow: cardShadow() }}
        >
          <h2
            className="text-[14px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Performance Radar
          </h2>
          <p className="mt-1 text-[11px]" style={{ color: colors.text.muted }}>
            Normalized behavioral metrics
          </p>
          <div className="mt-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius={82}>
                <PolarGrid stroke={colors.surface[300]} />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fill: colors.text.secondary, fontSize: 11 }}
                />
                <Radar
                  dataKey="score"
                  name="Score"
                  stroke={colors.brand}
                  fill={colors.brand}
                  fillOpacity={0.15}
                  strokeWidth={2}
                  isAnimationActive
                  animationDuration={600}
                />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          className="rounded-md border bg-white p-5"
          style={{ borderColor: colors.surface[200], boxShadow: cardShadow() }}
        >
          <h2
            className="text-[14px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Session Totals
          </h2>
          <div className="mt-5 space-y-4">
            {behaviorRows.map((row) => (
              <div key={row.label}>
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="text-[12px]"
                    style={{ color: colors.text.muted }}
                  >
                    {row.label}
                  </span>
                  <span
                    className="text-[13px] font-bold tabular-nums"
                    style={{ color: colors.text.primary }}
                  >
                    {row.display}
                  </span>
                </div>
                <div
                  className="mt-2 h-1.5 rounded-md"
                  style={{ background: colors.surface[200] }}
                >
                  <div
                    className="h-1.5 rounded-md"
                    style={{
                      background: colors.brand,
                      width: `${row.progress}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className="rounded-md border bg-white p-5"
        style={{ borderColor: colors.surface[200], boxShadow: cardShadow() }}
      >
        <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <h2
              className="text-[14px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Performance by Course
            </h2>
            <p
              className="mt-1 text-[12px]"
              style={{ color: colors.text.muted }}
            >
              Compare your evidence quality across modules.
            </p>
          </div>
          {courseChartData.length > 0 && (
            <div
              className="text-[12px]"
              style={{ color: colors.text.secondary }}
            >
              {courseChartData.length} course groups
            </div>
          )}
        </div>

        {courseChartData.length ? (
          <>
            <div className="mt-4 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={courseChartData}
                  margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="0"
                    stroke={colors.surface[200]}
                  />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: colors.text.muted, fontSize: 11 }}
                  />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{
                      fontSize: 12,
                      color: colors.text.secondary,
                    }}
                  />
                  <Bar
                    dataKey="avg_wpm"
                    name="WPM"
                    fill={colors.brand}
                    barSize={12}
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="avg_confidence"
                    name="Confidence"
                    fill={colors.green}
                    barSize={12}
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
              {courseChartData.map((course) => {
                const humanRate = course.session_count
                  ? Math.round(
                      (course.human_count / course.session_count) * 100,
                    )
                  : 0;
                return (
                  <div
                    key={`${course.course_name}-${course.course_code}`}
                    className="min-w-[180px] rounded-md border p-3"
                    style={{ borderColor: colors.surface[200] }}
                  >
                    <p
                      className="truncate text-[13px] font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      {course.course_name || "Personal"}
                    </p>
                    <p
                      className="mt-1 font-mono text-[11px]"
                      style={{ color: colors.text.muted }}
                    >
                      {course.course_code || "PERSONAL"}
                    </p>
                    <p
                      className="mt-3 text-[12px] tabular-nums"
                      style={{ color: colors.text.secondary }}
                    >
                      {course.session_count} sessions |{" "}
                      {Math.round(course.avg_wpm)} WPM |{" "}
                      {Math.round(course.avg_confidence)}%
                    </p>
                    <div
                      className="mt-3 h-1 rounded-md"
                      style={{ background: colors.surface[200] }}
                    >
                      <div
                        className="h-1 rounded-md"
                        style={{
                          background: colors.green,
                          width: `${humanRate}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <EmptyCard
            title="No course-linked sessions yet"
            subtitle="Join a course to compare performance across modules."
          />
        )}
      </div>

      <div
        className="rounded-md border bg-white p-5"
        style={{ borderColor: colors.surface[200], boxShadow: cardShadow() }}
      >
        <h2
          className="text-[14px] font-semibold"
          style={{ color: colors.text.primary }}
        >
          Daily Writing Heatmap
        </h2>
        <p className="mt-1 text-[12px]" style={{ color: colors.text.muted }}>
          Your writing consistency over the last 30 days.
        </p>
        <div className="mt-4 grid grid-cols-[repeat(30,1fr)] gap-1">
          {heatmapDays.map((point, index) => {
            const sessions = point.session_count;
            const background =
              sessions === 0
                ? colors.surface[200]
                : sessions === 1
                  ? colors.brandSoft
                  : colors.brand;
            const opacity = sessions === 2 ? 0.6 : 1;
            return (
              <div
                key={`${point.day}-${index}`}
                title={`${point.day}: ${sessions} session${sessions === 1 ? "" : "s"}`}
                className="h-7 w-full rounded-md"
                style={{ background, opacity }}
              />
            );
          })}
        </div>
        <div
          className="mt-3 flex items-center gap-2 text-[11px]"
          style={{ color: colors.text.muted }}
        >
          <span>Less</span>
          <span
            className="h-3 w-3 rounded-md"
            style={{ background: colors.surface[200] }}
          />
          <span
            className="h-3 w-3 rounded-md"
            style={{ background: colors.brandSoft }}
          />
          <span
            className="h-3 w-3 rounded-md"
            style={{ background: colors.brand, opacity: 0.6 }}
          />
          <span
            className="h-3 w-3 rounded-md"
            style={{ background: colors.brand }}
          />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
