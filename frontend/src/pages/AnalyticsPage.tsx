import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import { ErrorState } from "../components/ui/AsyncState";
import { useToast } from "../components/ui/ToastContext";
import { API_ROUTES } from "../constants/apiRoutes";
import { ROUTES } from "../constants/routes";
import { api, getApiErrorMessage } from "../lib/api";
import { brand, colors } from "../styles/colors";
import type {
  StudentAnalyticsResponse,
  StudentCourseSummary,
  StudentDailyAnalytics,
} from "../types/student";

const periods = [7, 14, 30] as const;
type PeriodDays = (typeof periods)[number];

type IconType =
  | "activity"
  | "bolt"
  | "calendar"
  | "chart"
  | "clock"
  | "course"
  | "empty"
  | "keyboard"
  | "link"
  | "shield"
  | "spark"
  | "target";

interface ChartPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

interface NormalizedDay extends StudentDailyAnalytics {
  label: string;
  weekday: string;
  total_keys: number;
  deletions: number;
  pauses: number;
  revision_events: number;
  revision_pressure: number;
}

interface InsightItem {
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "good" | "warning" | "danger";
}

function Icon({ type, size = 16 }: { type: IconType; size?: number }) {
  const paths: Record<IconType, ReactNode> = {
    activity: <path d="M3 12h4l2-7 4 14 2-7h6" />,
    bolt: <path d="M13 2 4 14h7l-1 8 10-12h-7z" />,
    calendar: (
      <>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M3 10h18" />
      </>
    ),
    chart: (
      <>
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-7" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    course: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
      </>
    ),
    empty: (
      <>
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-7" />
      </>
    ),
    keyboard: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 9h.01" />
        <path d="M11 9h.01" />
        <path d="M15 9h.01" />
        <path d="M19 9h.01" />
        <path d="M7 13h.01" />
        <path d="M11 13h6" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    spark: (
      <>
        <path d="M12 3v4" />
        <path d="M12 17v4" />
        <path d="M3 12h4" />
        <path d="M17 12h4" />
        <path d="m5.6 5.6 2.8 2.8" />
        <path d="m15.6 15.6 2.8 2.8" />
        <path d="m5.6 18.4 2.8-2.8" />
        <path d="m15.6 8.4 2.8-2.8" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
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
      {paths[type]}
    </svg>
  );
}

function cardShadow() {
  return `0 1px 3px ${colors.shadow}`;
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatCompact(value: number): string {
  const safe = Number(value || 0);
  if (safe >= 1_000_000) return `${(safe / 1_000_000).toFixed(1)}M`;
  if (safe >= 1_000) return `${(safe / 1_000).toFixed(1)}k`;
  return String(Math.round(safe));
}

function formatDateLabel(day: string, index: number): string {
  if (!day) return `Day ${index + 1}`;
  const parsed = new Date(day);
  if (Number.isNaN(parsed.getTime())) return day;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatWeekday(day: string): string {
  const parsed = new Date(day);
  if (Number.isNaN(parsed.getTime())) return "Day";
  return parsed.toLocaleDateString(undefined, { weekday: "short" });
}

function average(values: number[]): number {
  const usable = values.filter((value) => Number.isFinite(value));
  if (!usable.length) return 0;
  return Math.round(
    usable.reduce((sum, value) => sum + Number(value || 0), 0) / usable.length,
  );
}

function percent(value: number, total: number): number {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function normalizeScore(value: number, max: number): number {
  if (!max) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round((Number(value || 0) / max) * 100)),
  );
}

function trendDelta(values: number[]): number {
  const usable = values.filter((value) => Number.isFinite(value));
  if (usable.length < 2) return 0;
  const midpoint = Math.max(1, Math.floor(usable.length / 2));
  const earlier = average(usable.slice(0, midpoint));
  const later = average(usable.slice(midpoint));
  if (!earlier && later) return 100;
  if (!earlier) return 0;
  return Math.round(((later - earlier) / earlier) * 100);
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ChartPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-md border px-3 py-2 text-[12px] shadow-sm"
      style={{
        background: colors.surface[50],
        borderColor: colors.surface[200],
        color: colors.text.primary,
        boxShadow: `0 12px 30px ${colors.shadowStrong}`,
      }}
    >
      {label && (
        <p
          className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{ color: colors.text.muted }}
        >
          {label}
        </p>
      )}
      <div className="space-y-1.5">
        {payload.map((item) => (
          <div
            key={`${item.name}-${item.color}`}
            className="flex min-w-0 items-center justify-between gap-3 sm:min-w-[150px] sm:gap-6"
          >
            <span
              className="inline-flex items-center gap-2"
              style={{ color: colors.text.secondary }}
            >
              <span
                className="h-2 w-2 rounded-md"
                style={{ background: item.color || colors.brand }}
              />
              {item.name}
            </span>
            <span
              className="font-bold tabular-nums"
              style={{ color: colors.text.primary }}
            >
              {typeof item.value === "number"
                ? formatCompact(item.value)
                : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ChartPayloadItem[];
}) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload || {};

  return (
    <div
      className="rounded-md border px-3 py-2 text-[12px] shadow-sm"
      style={{
        background: colors.surface[50],
        borderColor: colors.surface[200],
        color: colors.text.primary,
        boxShadow: `0 12px 30px ${colors.shadowStrong}`,
      }}
    >
      <p
        className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: colors.text.muted }}
      >
        {String(row.label || "Writing day")}
      </p>
      <div className="space-y-1">
        <p style={{ color: colors.text.secondary }}>
          WPM:{" "}
          <strong style={{ color: colors.text.primary }}>
            {Math.round(Number(row.avg_wpm || 0))}
          </strong>
        </p>
        <p style={{ color: colors.text.secondary }}>
          Confidence:{" "}
          <strong style={{ color: colors.text.primary }}>
            {Math.round(Number(row.avg_confidence || 0))}%
          </strong>
        </p>
        <p style={{ color: colors.text.secondary }}>
          Sessions:{" "}
          <strong style={{ color: colors.text.primary }}>
            {Math.round(Number(row.session_count || 0))}
          </strong>
        </p>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  detail,
  icon,
  delta,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: IconType;
  delta?: number;
}) {
  const deltaText =
    delta === undefined ? null : `${delta >= 0 ? "+" : ""}${delta}%`;
  const deltaGood = Number(delta || 0) >= 0;

  return (
    <section
      className="rounded-md border bg-white p-4"
      style={{ borderColor: colors.surface[200], boxShadow: cardShadow() }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: colors.text.muted }}
          >
            {label}
          </p>
          <p
            className="mt-3 text-[28px] font-bold tracking-[-0.05em] tabular-nums"
            style={{ color: colors.text.primary }}
          >
            {value}
          </p>
        </div>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md"
          style={{ background: colors.brandSoft, color: colors.brand }}
        >
          <Icon type={icon} size={16} />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[11px]" style={{ color: colors.text.secondary }}>
          {detail}
        </p>
        {deltaText && (
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
            style={{
              background: deltaGood ? colors.mintTint : colors.roseTint,
              color: deltaGood ? brand.humanText : brand.aiText,
            }}
          >
            {deltaText}
          </span>
        )}
      </div>
    </section>
  );
}

function Panel({
  title,
  description,
  unit,
  children,
  action,
  className = "",
}: {
  title: string;
  description: string;
  unit?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-md border bg-white p-5 ${className}`}
      style={{ borderColor: colors.surface[200], boxShadow: cardShadow() }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2
            className="text-[14px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            {title}
          </h2>
          <p
            className="mt-1 text-[12px] leading-5"
            style={{ color: colors.text.secondary }}
          >
            {description}
          </p>
          {unit && (
            <p
              className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ color: colors.text.muted }}
            >
              Unit: {unit}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function LegendRow({
  items,
}: {
  items: Array<{ label: string; color: string }>;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 text-[11px]"
      style={{ color: colors.text.secondary }}
    >
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-md"
            style={{ background: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function EmptyCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      className="flex min-h-[220px] flex-col items-center justify-center rounded-md border bg-white p-8 text-center"
      style={{ borderColor: colors.surface[200], boxShadow: cardShadow() }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-md"
        style={{ background: colors.brandSoft, color: colors.brand }}
      >
        <Icon type="empty" size={24} />
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
      <Link
        to={ROUTES.EDITOR_NEW}
        className="mt-4 inline-flex h-9 items-center justify-center rounded-md px-4 text-[13px] font-semibold"
        style={{ background: colors.brand, color: colors.text.light }}
      >
        Start writing session
      </Link>
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
            className="h-7 w-44 animate-pulse rounded-md"
            style={{ background: colors.surface[200] }}
          />
          <div
            className="mt-2 h-4 w-80 animate-pulse rounded-md"
            style={{ background: colors.surface[200] }}
          />
        </div>
        <div
          className="h-9 w-40 animate-pulse rounded-md"
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
      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <div
          className="h-[340px] animate-pulse rounded-md border bg-white"
          style={{ borderColor: colors.surface[200] }}
        />
        <div
          className="h-[340px] animate-pulse rounded-md border bg-white"
          style={{ borderColor: colors.surface[200] }}
        />
      </div>
    </div>
  );
}

function normalizeDaily(
  points: StudentDailyAnalytics[] = [],
  periodDays: PeriodDays,
): NormalizedDay[] {
  return points.slice(-periodDays).map((point, index) => {
    const totalKeys = Math.max(0, Number(point.total_keys || 0));
    const deletions = Math.max(0, Number(point.deletions || 0));
    const pauses = Math.max(0, Number(point.pauses || 0));
    const revisionEvents = deletions + pauses;

    return {
      ...point,
      label: formatDateLabel(point.day, index),
      weekday: formatWeekday(point.day),
      session_count: Math.max(0, Number(point.session_count || 0)),
      avg_wpm: Math.max(0, Number(point.avg_wpm || 0)),
      avg_confidence: Math.max(0, Number(point.avg_confidence || 0)),
      total_keys: totalKeys,
      deletions,
      pauses,
      revision_events: revisionEvents,
      revision_pressure: totalKeys
        ? Math.round((revisionEvents / totalKeys) * 1000)
        : 0,
    };
  });
}

function courseName(course: StudentCourseSummary): string {
  return course.course_code || course.course_name || "Personal";
}

export default function AnalyticsPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<StudentAnalyticsResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [periodDays, setPeriodDays] = useState<PeriodDays>(30);

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

  const daily = useMemo(
    () => normalizeDaily(data?.daily || [], periodDays),
    [data?.daily, periodDays],
  );

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
    const totalRevisionEvents = totalDeletions + totalPauses;
    const avgWpm = average(
      daily.filter((point) => point.avg_wpm > 0).map((point) => point.avg_wpm),
    );
    const avgConfidence = average(
      daily
        .filter((point) => point.avg_confidence > 0)
        .map((point) => point.avg_confidence),
    );
    const activeDays = daily.filter((point) => point.session_count > 0).length;
    const revisionPressure = totalKeys
      ? Math.round((totalRevisionEvents / totalKeys) * 1000)
      : 0;

    return {
      totalSessions,
      totalKeys,
      totalDeletions,
      totalPauses,
      totalRevisionEvents,
      avgWpm,
      avgConfidence,
      activeDays,
      revisionPressure,
    };
  }, [daily]);

  const availableDailyRows = data?.daily?.length || 0;

  const courseRows = useMemo(() => {
    return (data?.courses || [])
      .map((course) => ({
        ...course,
        label: courseName(course),
        session_count: Math.max(0, Number(course.session_count || 0)),
        avg_wpm: Math.max(0, Number(course.avg_wpm || 0)),
        avg_confidence: Math.max(0, Number(course.avg_confidence || 0)),
        human_count: Math.max(0, Number(course.human_count || 0)),
        suspicious_count: Math.max(0, Number(course.suspicious_count || 0)),
        synthetic_count: Math.max(0, Number(course.synthetic_count || 0)),
      }))
      .sort((a, b) => b.session_count - a.session_count);
  }, [data?.courses]);

  const courseVolumeData = useMemo(() => courseRows.slice(0, 8), [courseRows]);
  const courseMixData = useMemo(() => courseRows.slice(0, 6), [courseRows]);

  const outcomeTotals = useMemo(() => {
    const human = courseRows.reduce(
      (sum, course) => sum + course.human_count,
      0,
    );
    const suspicious = courseRows.reduce(
      (sum, course) => sum + (course.suspicious_count || 0),
      0,
    );
    const synthetic = courseRows.reduce(
      (sum, course) => sum + (course.synthetic_count || 0),
      0,
    );
    const total = human + suspicious + synthetic;

    return { human, suspicious, synthetic, total };
  }, [courseRows]);

  const outcomePieData = useMemo(
    () =>
      [
        { name: "Human", value: outcomeTotals.human, color: colors.green },
        {
          name: "Needs review",
          value: outcomeTotals.suspicious,
          color: colors.amber,
        },
        { name: "AI-like", value: outcomeTotals.synthetic, color: colors.red },
      ].filter((item) => item.value > 0),
    [outcomeTotals],
  );

  const scatterData = useMemo(
    () =>
      daily.filter((point) => point.avg_wpm > 0 || point.avg_confidence > 0),
    [daily],
  );

  const heatmapDays = useMemo(() => {
    const recent = normalizeDaily(data?.daily || [], 30);
    const fillerCount = Math.max(0, 30 - recent.length);
    const filler = Array.from({ length: fillerCount }, (_, index) => ({
      day: `No data ${index + 1}`,
      label: "—",
      weekday: "—",
      session_count: 0,
      avg_wpm: 0,
      avg_confidence: 0,
      total_keys: 0,
      deletions: 0,
      pauses: 0,
      revision_events: 0,
      revision_pressure: 0,
    }));

    return [...filler, ...recent];
  }, [data?.daily]);

  const radarData = useMemo(() => {
    const bestWpm = Number(data?.bests.best_wpm || 0);
    const bestConfidence = Number(data?.bests.best_confidence || 0);
    const longestSession = Number(data?.bests.longest_session || 0);
    const totalSeconds = Number(data?.bests.total_seconds || 0);
    const activityCoverage = percent(
      totals.activeDays,
      Math.max(periodDays, 1),
    );
    const keyVolumeScore = normalizeScore(totals.totalKeys, 25000);
    const revisionStability = Math.max(
      0,
      Math.min(100, 100 - totals.revisionPressure),
    );

    return [
      { metric: "Peak WPM", score: normalizeScore(bestWpm, 120) },
      {
        metric: "Confidence",
        score: Math.min(100, Math.round(bestConfidence)),
      },
      { metric: "Session length", score: normalizeScore(longestSession, 7200) },
      { metric: "Writing time", score: normalizeScore(totalSeconds, 36000) },
      { metric: "Key volume", score: keyVolumeScore },
      { metric: "Stability", score: revisionStability },
      { metric: "Coverage", score: activityCoverage },
    ];
  }, [data?.bests, totals, periodDays]);

  const insights: InsightItem[] = useMemo(() => {
    const bestCourse = [...courseRows].sort(
      (a, b) => b.avg_confidence - a.avg_confidence,
    )[0];
    const revisionTone =
      totals.revisionPressure <= 80
        ? "good"
        : totals.revisionPressure <= 160
          ? "warning"
          : "danger";
    const coverageTone =
      totals.activeDays >= Math.ceil(periodDays * 0.5)
        ? "good"
        : totals.activeDays
          ? "warning"
          : "neutral";
    const confidenceTone =
      totals.avgConfidence >= 80
        ? "good"
        : totals.avgConfidence >= 60
          ? "warning"
          : "danger";

    return [
      {
        label: "Activity coverage",
        value: `${totals.activeDays}/${periodDays} days`,
        detail: "Days with at least one analyzed writing session.",
        tone: coverageTone,
      },
      {
        label: "Revision pressure",
        value: `${totals.revisionPressure}/1k keys`,
        detail: "Deletion and pause events per 1,000 captured keystrokes.",
        tone: revisionTone,
      },
      {
        label: "Evidence confidence",
        value: `${totals.avgConfidence}%`,
        detail: "Average ML confidence across active days in this period.",
        tone: confidenceTone,
      },
      {
        label: "Strongest course",
        value: bestCourse ? bestCourse.label : "No course data",
        detail: bestCourse
          ? `${Math.round(bestCourse.avg_confidence)}% average confidence across ${bestCourse.session_count} sessions.`
          : "Join a course to compare module performance.",
        tone: bestCourse ? "good" : "neutral",
      },
    ];
  }, [courseRows, totals, periodDays]);

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

  if (!data || (!data.daily?.length && !data.courses?.length)) {
    return (
      <EmptyCard
        title="No analytics available yet"
        subtitle="Analyze writing sessions to build charts for typing speed, confidence, revision pressure, course performance, and evidence coverage."
      />
    );
  }

  const sessionDelta = trendDelta(daily.map((point) => point.session_count));
  const confidenceDelta = trendDelta(
    daily.map((point) => point.avg_confidence),
  );
  const wpmDelta = trendDelta(daily.map((point) => point.avg_wpm));
  const revisionDelta = trendDelta(
    daily.map((point) => point.revision_pressure),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: colors.text.muted }}
          >
            Behavioral intelligence
          </p>
          <h1
            className="mt-1 text-[24px] font-bold tracking-[-0.04em]"
            style={{ color: colors.text.primary }}
          >
            Analytics
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex rounded-md border p-1"
            style={{
              borderColor: colors.surface[200],
              background: colors.surface[50],
            }}
          >
            {periods.map((item) => {
              const active = item === periodDays;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPeriodDays(item)}
                  className="h-8 rounded-md px-3 text-[12px] font-semibold transition-colors"
                  style={{
                    background: active ? colors.brandSoft : "transparent",
                    color: active ? colors.brand : colors.text.secondary,
                  }}
                >
                  {item}D
                </button>
              );
            })}
          </div>
          <div
            className="rounded-md border px-3 py-2 text-[11px]"
            style={{
              borderColor: colors.surface[200],
              background: colors.surface[50],
              color: colors.text.secondary,
            }}
          >
            API window: {availableDailyRows} daily rows
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Sessions captured"
          value={totals.totalSessions}
          detail={`${totals.activeDays} active days in selected window`}
          icon="calendar"
          delta={sessionDelta}
        />
        <MetricTile
          label="Average confidence"
          value={`${totals.avgConfidence}%`}
          detail="ML confidence on active writing days"
          icon="shield"
          delta={confidenceDelta}
        />
        <MetricTile
          label="Average WPM"
          value={totals.avgWpm}
          detail="Typing speed trend from analyzed sessions"
          icon="bolt"
          delta={wpmDelta}
        />
        <MetricTile
          label="Revision pressure"
          value={totals.revisionPressure}
          detail="Revision events per 1,000 keys"
          icon="target"
          delta={revisionDelta}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Panel
          title="Session volume trend"
          description="How many writing sessions were analyzed each day. This chart only uses session counts, so it is not mixing speed or confidence on the same axis."
          unit="sessions per day"
          action={
            <LegendRow items={[{ label: "Sessions", color: colors.brand }]} />
          }
        >
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={daily}
                margin={{ top: 12, right: 12, bottom: 0, left: -16 }}
              >
                <CartesianGrid vertical={false} stroke={colors.surface[200]} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: colors.text.muted, fontSize: 11 }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: colors.text.muted, fontSize: 11 }}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: colors.surface[100] }}
                />
                <Bar
                  dataKey="session_count"
                  name="Sessions"
                  fill={colors.brand}
                  barSize={16}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Outcome mix"
          description="Classification totals returned by the backend per course group. This is a real distribution, not generated from daily session estimates."
          unit="sessions"
          action={
            <span
              className="text-[11px] font-semibold tabular-nums"
              style={{ color: colors.text.secondary }}
            >
              {outcomeTotals.total} classified
            </span>
          }
        >
          {outcomePieData.length ? (
            <div className="grid gap-4 sm:grid-cols-[180px_1fr] xl:grid-cols-1 2xl:grid-cols-[180px_1fr]">
              <div className="relative h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={outcomePieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={76}
                      paddingAngle={2}
                    >
                      {outcomePieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p
                    className="text-[24px] font-bold tabular-nums"
                    style={{ color: colors.text.primary }}
                  >
                    {outcomeTotals.total}
                  </p>
                  <p
                    className="text-[11px]"
                    style={{ color: colors.text.muted }}
                  >
                    sessions
                  </p>
                </div>
              </div>
              <div className="space-y-3 self-center">
                {[
                  {
                    label: "Human",
                    value: outcomeTotals.human,
                    color: colors.green,
                  },
                  {
                    label: "Needs review",
                    value: outcomeTotals.suspicious,
                    color: colors.amber,
                  },
                  {
                    label: "AI-like",
                    value: outcomeTotals.synthetic,
                    color: colors.red,
                  },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between gap-3 text-[12px]">
                      <span
                        className="inline-flex items-center gap-2"
                        style={{ color: colors.text.secondary }}
                      >
                        <span
                          className="h-2 w-2 rounded-md"
                          style={{ background: item.color }}
                        />
                        {item.label}
                      </span>
                      <span
                        className="font-bold tabular-nums"
                        style={{ color: colors.text.primary }}
                      >
                        {item.value} ·{" "}
                        {percent(item.value, outcomeTotals.total)}%
                      </span>
                    </div>
                    <div
                      className="mt-2 h-1.5 rounded-md"
                      style={{ background: colors.surface[200] }}
                    >
                      <div
                        className="h-1.5 rounded-md"
                        style={{
                          background: item.color,
                          width: `${percent(item.value, outcomeTotals.total)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyCard
              title="No classification mix yet"
              subtitle="Course-level classification counts will appear after analyzed sessions are available."
            />
          )}
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="Typing speed trend"
          description="Average words per minute by day. The y-axis is WPM only, so the chart is instantly readable."
          unit="words per minute"
          action={
            <LegendRow
              items={[{ label: "Average WPM", color: colors.brand }]}
            />
          }
        >
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={daily}
                margin={{ top: 12, right: 12, bottom: 0, left: -10 }}
              >
                <CartesianGrid vertical={false} stroke={colors.surface[200]} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: colors.text.muted, fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: colors.text.muted, fontSize: 11 }}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="avg_wpm"
                  name="Average WPM"
                  stroke={colors.brand}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Human evidence score trend"
          description="Average human evidence score by day. Kept separate from WPM because percentage and speed use different units."
          unit="confidence percentage"
          action={
            <LegendRow
              items={[
                { label: "Average human evidence score", color: colors.green },
              ]}
            />
          }
        >
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={daily}
                margin={{ top: 12, right: 12, bottom: 0, left: -10 }}
              >
                <CartesianGrid vertical={false} stroke={colors.surface[200]} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: colors.text.muted, fontSize: 11 }}
                />
                <YAxis
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: colors.text.muted, fontSize: 11 }}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="avg_confidence"
                  name="Average confidence"
                  stroke={colors.green}
                  fill={colors.green}
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Panel
          title="Revision events trend"
          description="Deletion and pause events are both count-based behavioral signals, so they can be stacked safely on one chart."
          unit="events per day"
          action={
            <LegendRow
              items={[
                { label: "Deletions", color: colors.red },
                { label: "Pauses", color: colors.amber },
              ]}
            />
          }
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={daily}
                margin={{ top: 12, right: 12, bottom: 0, left: -16 }}
              >
                <CartesianGrid vertical={false} stroke={colors.surface[200]} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: colors.text.muted, fontSize: 11 }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: colors.text.muted, fontSize: 11 }}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: colors.surface[100] }}
                />
                <Bar
                  dataKey="deletions"
                  name="Deletions"
                  stackId="events"
                  fill={colors.red}
                  barSize={16}
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="pauses"
                  name="Pauses"
                  stackId="events"
                  fill={colors.amber}
                  barSize={16}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Revision pressure"
          description="Normalizes revision behavior by text input volume so short and long sessions can be compared fairly."
          unit="events per 1,000 keystrokes"
          action={
            <LegendRow items={[{ label: "Pressure", color: colors.red }]} />
          }
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={daily}
                margin={{ top: 12, right: 12, bottom: 0, left: -10 }}
              >
                <CartesianGrid vertical={false} stroke={colors.surface[200]} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: colors.text.muted, fontSize: 11 }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: colors.text.muted, fontSize: 11 }}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="revision_pressure"
                  name="Revision pressure"
                  stroke={colors.red}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="Keystroke volume"
          description="Total keys captured each day. This shows the raw evidence volume behind the behavioral analysis."
          unit="keystrokes per day"
          action={
            <LegendRow items={[{ label: "Keystrokes", color: colors.steel }]} />
          }
        >
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={daily}
                margin={{ top: 12, right: 12, bottom: 0, left: -10 }}
              >
                <CartesianGrid vertical={false} stroke={colors.surface[200]} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: colors.text.muted, fontSize: 11 }}
                />
                <YAxis
                  tickFormatter={formatCompact}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: colors.text.muted, fontSize: 11 }}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="total_keys"
                  name="Keystrokes"
                  stroke={colors.steel}
                  fill={colors.steel}
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Speed and confidence relationship"
          description="Each point is one active writing day. The x-axis is WPM and the y-axis is confidence, so the two units are intentionally separated."
          unit="x: WPM, y: confidence percentage"
          action={
            <LegendRow
              items={[{ label: "Writing day", color: colors.brand }]}
            />
          }
        >
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 12, right: 12, bottom: 0, left: -10 }}
              >
                <CartesianGrid stroke={colors.surface[200]} />
                <XAxis
                  type="number"
                  dataKey="avg_wpm"
                  name="WPM"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: colors.text.muted, fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="avg_confidence"
                  name="Confidence"
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: colors.text.muted, fontSize: 11 }}
                />
                <ZAxis
                  type="number"
                  dataKey="session_count"
                  range={[60, 180]}
                />
                <Tooltip
                  content={<ScatterTooltip />}
                  cursor={{ stroke: colors.surface[300] }}
                />
                <Scatter
                  name="Writing day"
                  data={scatterData}
                  fill={colors.brand}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Panel
          title="Authorship mix by course"
          description="Course-level classification counts. Each bar segment is the same unit: number of sessions."
          unit="sessions"
          action={
            <LegendRow
              items={[
                { label: "Human", color: colors.green },
                { label: "Needs review", color: colors.amber },
                { label: "AI-like", color: colors.red },
              ]}
            />
          }
        >
          {courseMixData.length ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={courseMixData}
                  margin={{ top: 12, right: 12, bottom: 0, left: -16 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke={colors.surface[200]}
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: colors.text.muted, fontSize: 11 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: colors.text.muted, fontSize: 11 }}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: colors.surface[100] }}
                  />
                  <Bar
                    dataKey="human_count"
                    name="Human"
                    stackId="course"
                    fill={colors.green}
                    barSize={18}
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="suspicious_count"
                    name="Needs review"
                    stackId="course"
                    fill={colors.amber}
                    barSize={18}
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="synthetic_count"
                    name="AI-like"
                    stackId="course"
                    fill={colors.red}
                    barSize={18}
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyCard
              title="No course analytics yet"
              subtitle="Join a course or analyze course-linked sessions to populate this chart."
            />
          )}
        </Panel>

        <Panel
          title="Course evidence volume"
          description="Ranking of course groups by analyzed session count. This helps you see where most evidence has been captured."
          unit="sessions"
        >
          {courseVolumeData.length ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={courseVolumeData}
                  layout="vertical"
                  margin={{ top: 4, right: 16, bottom: 0, left: 10 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke={colors.surface[200]}
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: colors.text.muted, fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={88}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: colors.text.secondary, fontSize: 11 }}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: colors.surface[100] }}
                  />
                  <Bar
                    dataKey="session_count"
                    name="Sessions"
                    fill={colors.brand}
                    barSize={14}
                    radius={[0, 2, 2, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyCard
              title="No course volume yet"
              subtitle="Course-linked sessions will appear here after analysis."
            />
          )}
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <Panel
          title="Normalized behavior profile"
          description="Radar scores are normalized to a 0–100 scale so different behavioral signals can be compared without pretending they share raw units."
          unit="normalized score"
          action={
            <LegendRow items={[{ label: "Score", color: colors.brand }]} />
          }
        >
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius={104}>
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
                  fillOpacity={0.14}
                  strokeWidth={2}
                />
                <Tooltip content={<ChartTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Writing consistency heatmap"
          description="Thirty-day activity strip. Darker cells mean more analyzed sessions on that day. Empty cells mean no captured session."
          unit="sessions per day"
        >
          <div className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-1">
            {heatmapDays.map((point, index) => {
              const sessions = point.session_count;
              const background =
                sessions === 0
                  ? colors.surface[200]
                  : sessions === 1
                    ? colors.brandSoft
                    : colors.brand;
              const opacity = sessions <= 1 ? 1 : sessions === 2 ? 0.65 : 1;
              return (
                <div
                  key={`${point.day}-${index}`}
                  title={`${point.day}: ${sessions} session${sessions === 1 ? "" : "s"}`}
                  className="h-8 rounded-md"
                  style={{ background, opacity }}
                />
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div
              className="flex items-center gap-2 text-[11px]"
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
                style={{ background: colors.brand, opacity: 0.65 }}
              />
              <span
                className="h-3 w-3 rounded-md"
                style={{ background: colors.brand }}
              />
              <span>More</span>
            </div>
            <p className="text-[11px]" style={{ color: colors.text.secondary }}>
              {totals.activeDays} active days selected
            </p>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel
          title="Analytics readout"
          description="Plain-language interpretation of the visible charts. This makes the page useful in a viva or product demo without forcing the viewer to decode every graph."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {insights.map((item) => {
              const toneColor =
                item.tone === "good"
                  ? colors.green
                  : item.tone === "warning"
                    ? colors.amber
                    : item.tone === "danger"
                      ? colors.red
                      : colors.steel;
              const toneBg =
                item.tone === "good"
                  ? colors.mintTint
                  : item.tone === "warning"
                    ? colors.amberTint
                    : item.tone === "danger"
                      ? colors.roseTint
                      : colors.surface[100];
              return (
                <div
                  key={item.label}
                  className="rounded-md border p-4"
                  style={{
                    borderColor: colors.surface[200],
                    background: toneBg,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-md"
                      style={{ background: toneColor }}
                    />
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.14em]"
                      style={{ color: colors.text.muted }}
                    >
                      {item.label}
                    </p>
                  </div>
                  <p
                    className="mt-3 text-[18px] font-bold tracking-[-0.03em]"
                    style={{ color: colors.text.primary }}
                  >
                    {item.value}
                  </p>
                  <p
                    className="mt-1 text-[12px] leading-5"
                    style={{ color: colors.text.secondary }}
                  >
                    {item.detail}
                  </p>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="Evidence totals"
          description="The raw account totals behind the visual analytics. These numbers are useful for dissertation reporting and system validation."
        >
          <div className="space-y-3">
            {[
              {
                label: "Total keystrokes",
                value: totals.totalKeys.toLocaleString(),
                icon: "keyboard" as IconType,
              },
              {
                label: "Deletion events",
                value: totals.totalDeletions.toLocaleString(),
                icon: "activity" as IconType,
              },
              {
                label: "Pause events",
                value: totals.totalPauses.toLocaleString(),
                icon: "clock" as IconType,
              },
              {
                label: "Best IKI",
                value: `${Math.round(Number(data.bests.best_iki || 0))}ms`,
                icon: "target" as IconType,
              },
              {
                label: "Total writing time",
                value: formatDuration(Number(data.bests.total_seconds || 0)),
                icon: "calendar" as IconType,
              },
              {
                label: "Course groups",
                value: String(courseRows.length),
                icon: "course" as IconType,
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4 rounded-md border px-3 py-2.5"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[50],
                }}
              >
                <span
                  className="flex items-center gap-2 text-[12px]"
                  style={{ color: colors.text.secondary }}
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-md"
                    style={{
                      background: colors.brandSoft,
                      color: colors.brand,
                    }}
                  >
                    <Icon type={row.icon} size={13} />
                  </span>
                  {row.label}
                </span>
                <span
                  className="text-[13px] font-bold tabular-nums"
                  style={{ color: colors.text.primary }}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
