import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ROUTES } from "../constants/routes";
import { api, getApiErrorMessage } from "../lib/api";
import { useToast } from "../components/ui/ToastContext";
import { brand, colors } from "../styles/colors";
import { API_ROUTES } from "../constants/apiRoutes";
import { ErrorState } from "../components/ui/AsyncState";
import { classificationDisplayLabel } from "../lib/edgeCases";
import {
  formatEvidenceScore,
  normalizeEvidenceScore,
} from "../lib/evidenceScore";

interface StudentSummary {
  total_sessions: number;
  avg_wpm: number;
  avg_confidence: number;
  total_seconds: number;
  total_keystrokes?: number;
  total_deletions?: number;
  total_pauses?: number;
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
  total_keystrokes?: number;
  deletions?: number;
  pauses?: number;
  avg_iki?: number;
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
  weekday: string;
  session_count: number;
  avg_wpm: number;
  avg_confidence: number;
  human_sessions: number;
  suspicious_sessions: number;
  synthetic_sessions: number;
}

type PeriodDays = 7 | 14 | 30;
type StatusTone = "human" | "warning" | "danger" | "neutral";
type TooltipPayload = Array<{
  name?: string;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}>;

function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

function pct(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function formatNumber(value: number | undefined | null): string {
  return new Intl.NumberFormat().format(Math.round(Number(value || 0)));
}

function formatDuration(seconds: number | undefined | null): string {
  const total = Math.max(0, Math.round(Number(seconds || 0)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${total}s`;
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || "Unknown";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDayLabel(day: string): string {
  const parsed = new Date(day);
  if (Number.isNaN(parsed.getTime())) return day.slice(5);
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatWeekday(day: string): string {
  const parsed = new Date(day);
  if (Number.isNaN(parsed.getTime())) return day.slice(5);
  return parsed.toLocaleDateString(undefined, { weekday: "short" });
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

function normalizeTrend(
  points: TrendPoint[] = [],
  days: PeriodDays = 14,
): NormalizedTrendPoint[] {
  const byDay = new Map(points.map((point) => [point.day, point]));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    const day = date.toISOString().slice(0, 10);
    const match = byDay.get(day);

    return {
      day,
      label: formatDayLabel(day),
      weekday: formatWeekday(day),
      session_count: match?.session_count ?? 0,
      avg_wpm: match?.avg_wpm ?? 0,
      avg_confidence: match?.avg_confidence ?? 0,
      human_sessions: match?.human_count ?? 0,
      suspicious_sessions: match?.suspicious_count ?? 0,
      synthetic_sessions: match?.synthetic_count ?? 0,
    };
  });
}

function getToneStyles(tone: StatusTone) {
  if (tone === "human") {
    return {
      background: brand.humanBg,
      color: brand.humanText,
      accent: brand.humanAccent,
      border: withAlpha(colors.green, "33"),
    };
  }

  if (tone === "warning") {
    return {
      background: brand.suspiciousBg,
      color: brand.suspiciousText,
      accent: brand.suspiciousAccent,
      border: withAlpha(colors.amber, "33"),
    };
  }

  if (tone === "danger") {
    return {
      background: brand.aiBg,
      color: brand.aiText,
      accent: brand.aiAccent,
      border: withAlpha(colors.red, "33"),
    };
  }

  return {
    background: colors.surface[100],
    color: colors.text.secondary,
    accent: colors.text.muted,
    border: colors.surface[200],
  };
}

function classificationTone(bucket: string): StatusTone {
  const normalized = String(bucket || "").toUpperCase();
  if (normalized === "HUMAN") return "human";
  if (normalized === "SUSPICIOUS") return "warning";
  if (["SYNTHETIC", "AI", "AI-GENERATED"].includes(normalized)) return "danger";
  return "neutral";
}

function reviewTone(status: string): StatusTone {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "APPROVED") return "human";
  if (normalized === "FLAGGED" || normalized === "REJECTED") return "danger";
  if (normalized === "PENDING" || normalized === "REVIEW_REQUIRED")
    return "warning";
  if (normalized === "NOT_APPLICABLE") return "neutral";
  return "neutral";
}

function Icon({ type, size = 16 }: { type: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    more: (
      <>
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="19" r="1" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    arrowRight: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    certificate: (
      <>
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v6h6" />
        <path d="m9 15 2 2 4-5" />
      </>
    ),
    keyboard: (
      <>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    pulse: <path d="M3 12h4l2-7 4 14 2-7h6" />,
    hash: (
      <>
        <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
    chart: (
      <>
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-7" />
      </>
    ),
    document: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
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

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-md border ${className}`}
      style={{
        background: colors.surface[50],
        borderColor: colors.surface[200],
        boxShadow: `0 1px 3px ${colors.shadow}`,
      }}
    >
      {children}
    </section>
  );
}

function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2
          className="truncate text-[15px] font-bold tracking-[-0.03em]"
          style={{ color: colors.text.primary }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-[11px]" style={{ color: colors.text.muted }}>
            {subtitle}
          </p>
        )}
      </div>
      {action ?? (
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
          style={{
            background: colors.surface[50],
            borderColor: colors.surface[200],
            color: colors.text.secondary,
          }}
          aria-label="More options"
        >
          <Icon type="more" size={15} />
        </button>
      )}
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  const toneStyle = getToneStyles(tone);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
      style={{
        background: toneStyle.background,
        borderColor: toneStyle.border,
        color: toneStyle.color,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-md"
        style={{ background: toneStyle.accent }}
      />
      {label}
    </span>
  );
}

function TrendPill({ value }: { value: number }) {
  const positive = value >= 0;
  const tone = positive ? getToneStyles("human") : getToneStyles("danger");

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
      style={{ background: tone.background, color: tone.color }}
    >
      {positive ? "↑" : "↓"} {Math.abs(value).toFixed(0)}%
    </span>
  );
}

function MetricCard({
  title,
  value,
  meta,
  trend,
  icon,
}: {
  title: string;
  value: string;
  meta: string;
  trend?: number;
  icon: string;
}) {
  return (
    <Panel className="min-h-[112px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
          style={{
            background: colors.surface[100],
            borderColor: colors.surface[200],
            color: colors.brand,
          }}
        >
          <Icon type={icon} size={16} />
        </div>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{ color: colors.text.muted }}
          aria-label="Metric options"
        >
          <Icon type="more" size={14} />
        </button>
      </div>

      <p
        className="mt-4 text-[12px] font-semibold"
        style={{ color: colors.text.secondary }}
      >
        {title}
      </p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p
          className="text-[30px] font-bold leading-none tracking-[-0.05em] tabular-nums"
          style={{ color: colors.text.primary }}
        >
          {value}
        </p>
        {typeof trend === "number" && <TrendPill value={trend} />}
      </div>
      <p className="mt-2 text-[11px]" style={{ color: colors.text.muted }}>
        {meta}
      </p>
    </Panel>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-md border px-3 py-2 text-[12px] shadow-lg"
      style={{
        background: colors.surface[50],
        borderColor: colors.surface[200],
        color: colors.text.primary,
        boxShadow: `0 12px 32px ${colors.shadowStrong}`,
      }}
    >
      <p
        className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em]"
        style={{ color: colors.text.muted }}
      >
        {label}
      </p>
      <div className="space-y-1">
        {payload.map((item) => (
          <div
            key={`${item.name}-${item.value}`}
            className="flex items-center gap-2"
          >
            <span
              className="h-2 w-2 rounded-md"
              style={{ background: item.color || colors.brand }}
            />
            <span style={{ color: colors.text.secondary }}>{item.name}</span>
            <span
              className="ml-3 font-bold tabular-nums"
              style={{ color: colors.text.primary }}
            >
              {item.value ?? 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardLoadingShell() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-28 rounded-md"
            style={{ background: colors.surface[150] }}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.85fr_0.9fr]">
        <div
          className="h-[360px] rounded-md"
          style={{ background: colors.surface[150] }}
        />
        <div
          className="h-[360px] rounded-md"
          style={{ background: colors.surface[150] }}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-[300px] rounded-md"
            style={{ background: colors.surface[150] }}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div
      className="flex h-full min-h-[120px] items-center justify-center rounded-md border border-dashed px-4 text-center text-[12px]"
      style={{ borderColor: colors.surface[200], color: colors.text.muted }}
    >
      {message}
    </div>
  );
}

function EvidenceTrendPanel({
  trend,
  periodDays,
  setPeriodDays,
}: {
  trend: NormalizedTrendPoint[];
  periodDays: PeriodDays;
  setPeriodDays: (days: PeriodDays) => void;
}) {
  const series = [
    {
      label: "Human sessions",
      shortLabel: "Human",
      dataKey: "human_sessions",
      color: colors.green,
      total: trend.reduce((sum, point) => sum + point.human_sessions, 0),
    },
    {
      label: "Review Required sessions",
      shortLabel: "Review Required",
      dataKey: "suspicious_sessions",
      color: colors.amber,
      total: trend.reduce((sum, point) => sum + point.suspicious_sessions, 0),
    },
    {
      label: "AI-like sessions",
      shortLabel: "AI-like",
      dataKey: "synthetic_sessions",
      color: colors.red,
      total: trend.reduce((sum, point) => sum + point.synthetic_sessions, 0),
    },
  ];

  return (
    <Panel className="p-4 md:p-5">
      <PanelHeader
        title="Evidence classification trend"
        subtitle="Daily session count by model outcome. One y-axis, one unit: sessions."
        action={
          <div
            className="flex items-center gap-1 rounded-md border p-1"
            style={{
              background: colors.surface[100],
              borderColor: colors.surface[200],
            }}
          >
            {([7, 14, 30] as PeriodDays[]).map((days) => {
              const active = periodDays === days;
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => setPeriodDays(days)}
                  className="h-7 rounded-md px-2.5 text-[11px] font-bold transition"
                  style={{
                    background: active ? colors.surface[50] : "transparent",
                    color: active ? colors.text.primary : colors.text.secondary,
                    boxShadow: active ? `0 1px 2px ${colors.shadow}` : "none",
                  }}
                >
                  {days}D
                </button>
              );
            })}
          </div>
        }
      />

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={trend}
            margin={{ top: 12, right: 12, bottom: 0, left: -18 }}
          >
            <CartesianGrid
              vertical={false}
              stroke={colors.surface[200]}
              strokeDasharray="4 5"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: colors.text.muted, fontSize: 11 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              tick={{ fill: colors.text.muted, fontSize: 11 }}
              width={34}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: colors.surface[300], strokeDasharray: "3 3" }}
            />
            {series.map((item, index) => (
              <Line
                key={item.dataKey}
                type="monotone"
                dataKey={item.dataKey}
                name={item.label}
                stroke={item.color}
                strokeWidth={2.2}
                strokeDasharray={
                  index === 1 ? "5 4" : index === 2 ? "2 5" : undefined
                }
                dot={{ r: 2.5, strokeWidth: 2 }}
                activeDot={{ r: 4 }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {series.map((item) => (
          <div
            key={item.dataKey}
            className="rounded-md border px-3 py-2"
            style={{
              background: colors.surface[100],
              borderColor: colors.surface[200],
            }}
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-md"
                style={{ background: item.color }}
              />
              <span
                className="text-[11px] font-bold"
                style={{ color: colors.text.primary }}
              >
                {item.shortLabel}
              </span>
            </div>
            <p
              className="mt-1 text-[11px]"
              style={{ color: colors.text.muted }}
            >
              {formatNumber(item.total)} sessions in selected range
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ClassificationPanel({ summary }: { summary: StudentSummary }) {
  const total = Math.max(summary.total_sessions, 1);
  const pieData = [
    {
      name: "Human",
      value: summary.human_sessions,
      color: colors.green,
      tone: "human" as const,
    },
    {
      name: "Review Required",
      value: summary.suspicious_sessions,
      color: colors.amber,
      tone: "warning" as const,
    },
    {
      name: "High Risk",
      value: summary.synthetic_sessions,
      color: colors.red,
      tone: "danger" as const,
    },
  ];

  return (
    <Panel className="p-4 md:p-5">
      <PanelHeader
        title="Authorship mix"
        subtitle="Behavioral classification split"
      />

      <div className="relative mx-auto h-[190px] w-[190px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={88}
              paddingAngle={3}
              stroke={colors.surface[50]}
              strokeWidth={4}
            >
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-[30px] font-bold leading-none tracking-[-0.05em] tabular-nums"
            style={{ color: colors.text.primary }}
          >
            {formatNumber(summary.total_sessions)}
          </span>
          <span
            className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: colors.text.muted }}
          >
            Sessions
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {pieData.map((item) => {
          const share = pct(item.value, total);
          const toneStyle = getToneStyles(item.tone);
          return (
            <div key={item.name}>
              <div className="mb-1 flex items-center justify-between text-[12px]">
                <span
                  className="flex items-center gap-2 font-semibold"
                  style={{ color: colors.text.secondary }}
                >
                  <span
                    className="h-2 w-2 rounded-md"
                    style={{ background: item.color }}
                  />
                  {item.name}
                </span>
                <span
                  className="font-bold tabular-nums"
                  style={{ color: colors.text.primary }}
                >
                  {formatNumber(item.value)} · {share}%
                </span>
              </div>
              <div
                className="h-1.5 rounded-md"
                style={{ background: colors.surface[150] }}
              >
                <div
                  className="h-1.5 rounded-md"
                  style={{
                    width: `${clamp(share)}%`,
                    background: toneStyle.accent,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function ReviewStatusPanel({ summary }: { summary: StudentSummary }) {
  const total = Math.max(summary.total_sessions, 1);
  const rows = [
    {
      label: "Approved",
      value: summary.approved_count,
      tone: "human" as const,
    },
    {
      label: "Pending",
      value: summary.pending_count,
      tone: "warning" as const,
    },
    { label: "Flagged", value: summary.flagged_count, tone: "danger" as const },
  ];

  return (
    <Panel className="p-4 md:p-5">
      <PanelHeader title="Review outcomes" subtitle="Teacher decision status" />
      <div className="space-y-4">
        {rows.map((row) => {
          const tone = getToneStyles(row.tone);
          const share = pct(row.value, total);
          return (
            <div key={row.label}>
              <div className="flex items-center justify-between text-[12px]">
                <span
                  className="font-semibold"
                  style={{ color: colors.text.secondary }}
                >
                  {row.label}
                </span>
                <span
                  className="font-bold tabular-nums"
                  style={{ color: colors.text.primary }}
                >
                  {formatNumber(row.value)} · {share}%
                </span>
              </div>
              <div
                className="mt-2 h-2 rounded-md"
                style={{ background: colors.surface[150] }}
              >
                <div
                  className="h-2 rounded-md"
                  style={{ width: `${clamp(share)}%`, background: tone.accent }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div
        className="mt-5 rounded-md border p-3 text-[12px] leading-5"
        style={{
          background: colors.surface[100],
          borderColor: colors.surface[200],
          color: colors.text.secondary,
        }}
      >
        Review status is based on certificates and sessions submitted to
        courses.
      </div>
    </Panel>
  );
}

function WeeklyBreakdownPanel({ data }: { data: NormalizedTrendPoint[] }) {
  return (
    <Panel className="p-4 md:p-5">
      <PanelHeader
        title="Seven-day signal breakdown"
        subtitle="Human, suspicious, and AI-like sessions"
      />
      <div className="h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
          >
            <CartesianGrid
              vertical={false}
              stroke={colors.surface[200]}
              strokeDasharray="4 5"
            />
            <XAxis
              dataKey="weekday"
              axisLine={false}
              tickLine={false}
              tick={{ fill: colors.text.muted, fontSize: 10 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              tick={{ fill: colors.text.muted, fontSize: 10 }}
              width={28}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: colors.surface[100] }}
            />
            <Bar
              dataKey="human_sessions"
              name="Human"
              stackId="a"
              fill={colors.green}
              radius={[3, 3, 0, 0]}
              barSize={18}
            />
            <Bar
              dataKey="suspicious_sessions"
              name="Suspicious"
              stackId="a"
              fill={colors.amber}
              radius={[3, 3, 0, 0]}
              barSize={18}
            />
            <Bar
              dataKey="synthetic_sessions"
              name="AI-like"
              stackId="a"
              fill={colors.red}
              radius={[3, 3, 0, 0]}
              barSize={18}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function CourseDistributionPanel({
  courses,
  totalSessions,
}: {
  courses: CourseBreakdown[];
  totalSessions: number;
}) {
  return (
    <Panel className="p-4 md:p-5">
      <PanelHeader
        title="Course distribution"
        subtitle="Where evidence is being submitted"
      />
      {courses.length ? (
        <div className="space-y-4">
          {courses.slice(0, 6).map((course, index) => {
            const share = pct(course.session_count, Math.max(totalSessions, 1));
            const accents = [
              colors.brand,
              colors.green,
              colors.amber,
              colors.red,
              colors.steel,
              colors.text.primary,
            ];
            const accent = accents[index % accents.length];
            return (
              <div key={`${course.course_code}-${course.course_name}`}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-[12px]">
                  <div className="min-w-0">
                    <p
                      className="truncate font-bold"
                      style={{ color: colors.text.primary }}
                    >
                      {course.course_name || "Personal"}
                    </p>
                    <p
                      className="mt-0.5 font-mono text-[10px]"
                      style={{ color: colors.text.muted }}
                    >
                      {course.course_code || "PERSONAL"}
                    </p>
                  </div>
                  <span
                    className="font-bold tabular-nums"
                    style={{ color: colors.text.primary }}
                  >
                    {course.session_count} · {share}%
                  </span>
                </div>
                <div
                  className="h-2 rounded-md"
                  style={{ background: colors.surface[150] }}
                >
                  <div
                    className="h-2 rounded-md"
                    style={{ width: `${clamp(share)}%`, background: accent }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyPanel message="No course-linked sessions yet. Join a course to see distribution." />
      )}
    </Panel>
  );
}

function LatestSessionsPanel({ sessions }: { sessions: StudentSession[] }) {
  return (
    <Panel className="overflow-hidden p-4 md:p-5">
      <PanelHeader
        title="Latest evidence sessions"
        subtitle="Recent writing records and certificate status"
        action={
          <Link
            to={ROUTES.SESSIONS}
            className="inline-flex h-8 items-center rounded-md border px-3 text-[12px] font-bold"
            style={{
              background: colors.surface[50],
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          >
            View all
          </Link>
        }
      />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[740px] border-collapse text-left">
          <thead>
            <tr style={{ borderBottom: `1px solid ${colors.surface[200]}` }}>
              {[
                "Document",
                "Classification",
                "Review",
                "Human score",
                "Evidence",
                "Date",
              ].map((heading) => (
                <th
                  key={heading}
                  className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.13em]"
                  style={{ color: colors.text.muted }}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.slice(0, 6).map((session) => {
              const classification = classificationTone(
                session.classification_bucket,
              );
              const review = reviewTone(session.review_status);
              const confidence = normalizeEvidenceScore(session.confidence);
              return (
                <tr
                  key={session.id}
                  className="transition"
                  style={{ borderBottom: `1px solid ${colors.surface[150]}` }}
                >
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border"
                        style={{
                          background: colors.surface[100],
                          borderColor: colors.surface[200],
                          color: colors.brand,
                        }}
                      >
                        <Icon type="document" size={16} />
                      </div>
                      <div className="min-w-0">
                        <Link
                          to={ROUTES.SESSION_DETAIL.replace(
                            ":sessionId",
                            String(session.id),
                          )}
                          className="block max-w-[220px] truncate text-[13px] font-bold"
                          style={{ color: colors.text.primary }}
                        >
                          {session.title}
                        </Link>
                        <p
                          className="mt-0.5 truncate text-[11px]"
                          style={{ color: colors.text.muted }}
                        >
                          {session.course_name || "Personal session"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge
                      label={classificationDisplayLabel(
                        session.classification_bucket,
                      )}
                      tone={classification}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge
                      label={
                        session.review_status === "NOT_APPLICABLE"
                          ? "Personal"
                          : session.review_status || "Pending"
                      }
                      tone={review}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-10 font-mono text-[12px] font-bold tabular-nums"
                        style={{ color: colors.text.primary }}
                      >
                        {formatEvidenceScore(confidence)}%
                      </span>
                      <div
                        className="h-1.5 w-16 rounded-md"
                        style={{ background: colors.surface[150] }}
                      >
                        <div
                          className="h-1.5 rounded-md"
                          style={{
                            width: `${confidence}%`,
                            background: getToneStyles(classification).accent,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div
                      className="flex items-center gap-2 text-[11px]"
                      style={{ color: colors.text.secondary }}
                    >
                      <span>{formatNumber(session.word_count)} words</span>
                      <span style={{ color: colors.surface[300] }}>•</span>
                      <span>{formatDuration(session.duration_seconds)}</span>
                    </div>
                  </td>
                  <td
                    className="px-3 py-3 text-[11px] tabular-nums"
                    style={{ color: colors.text.muted }}
                  >
                    {formatDate(session.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!sessions.length && (
          <div className="py-10">
            <EmptyPanel message="No sessions yet. Start a writing session to populate the dashboard." />
          </div>
        )}
      </div>
    </Panel>
  );
}

function RhythmPanel({ trend }: { trend: NormalizedTrendPoint[] }) {
  const averageWpm =
    trend.reduce((sum, point) => sum + Number(point.avg_wpm || 0), 0) /
    Math.max(trend.length, 1);

  return (
    <Panel className="h-full p-4 md:p-5">
      <PanelHeader
        title="Typing speed trend"
        subtitle="Average words per minute by day. Single unit: WPM."
      />
      <div
        className="mb-3 flex items-center justify-between rounded-md border px-3 py-2"
        style={{
          background: colors.surface[100],
          borderColor: colors.surface[200],
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-md"
            style={{ background: colors.amber }}
          />
          <span
            className="text-[11px] font-bold"
            style={{ color: colors.text.primary }}
          >
            Avg. WPM
          </span>
        </div>
        <span
          className="text-[11px] font-bold tabular-nums"
          style={{ color: colors.text.secondary }}
        >
          {Math.round(averageWpm)} WPM average
        </span>
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={trend}
            margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
          >
            <defs>
              <linearGradient
                id="typetraceRhythmArea"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={colors.amber} stopOpacity={0.18} />
                <stop
                  offset="100%"
                  stopColor={colors.amber}
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke={colors.surface[200]}
              strokeDasharray="4 5"
            />
            <XAxis
              dataKey="weekday"
              axisLine={false}
              tickLine={false}
              tick={{ fill: colors.text.muted, fontSize: 10 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: colors.text.muted, fontSize: 10 }}
              width={28}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="avg_wpm"
              name="Average WPM"
              stroke={colors.amber}
              strokeWidth={2.2}
              fill="url(#typetraceRhythmArea)"
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function IntegrityPanel({ summary }: { summary: StudentSummary }) {
  const totalKeystrokes = summary.total_keystrokes ?? 0;
  const totalDeletions = summary.total_deletions ?? 0;
  const totalPauses = summary.total_pauses ?? 0;
  const certificateRate = pct(
    summary.certificate_count,
    Math.max(summary.total_sessions, 1),
  );

  const rows = [
    {
      label: "Keystrokes",
      value: formatNumber(totalKeystrokes),
      icon: "keyboard",
    },
    { label: "Pauses", value: formatNumber(totalPauses), icon: "clock" },
    { label: "Deletions", value: formatNumber(totalDeletions), icon: "pulse" },
    {
      label: "Certificate rate",
      value: `${certificateRate}%`,
      icon: "certificate",
    },
  ];

  return (
    <Panel className="h-full p-4 md:p-5">
      <PanelHeader
        title="Evidence ledger"
        subtitle="Process data captured across sessions"
      />
      <div className="grid grid-cols-2 gap-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-md border p-3"
            style={{
              background: colors.surface[100],
              borderColor: colors.surface[200],
            }}
          >
            <div
              className="flex items-center gap-2"
              style={{ color: colors.brand }}
            >
              <Icon type={row.icon} size={15} />
              <p
                className="text-[11px] font-semibold"
                style={{ color: colors.text.secondary }}
              >
                {row.label}
              </p>
            </div>
            <p
              className="mt-3 text-[20px] font-bold tracking-[-0.04em] tabular-nums"
              style={{ color: colors.text.primary }}
            >
              {row.value}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export default function DashboardPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [periodDays, setPeriodDays] = useState<PeriodDays>(14);

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
  const trend = useMemo(
    () => normalizeTrend(data?.trend ?? [], periodDays),
    [data?.trend, periodDays],
  );
  const weekTrend = useMemo(
    () => normalizeTrend(data?.trend ?? [], 7),
    [data?.trend],
  );

  const sessionDelta = useMemo(
    () => getTrendDelta(trend, "session_count"),
    [trend],
  );
  const confidenceDelta = useMemo(
    () => getTrendDelta(trend, "avg_confidence"),
    [trend],
  );
  const wpmDelta = useMemo(() => getTrendDelta(trend, "avg_wpm"), [trend]);

  if (isLoading) return <DashboardLoadingShell />;

  if (apiError || !data || !summary) {
    return (
      <ErrorState
        title="Dashboard unavailable"
        message={apiError || "Could not load workspace data."}
        action={
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md px-4 py-2.5 text-[13px] font-bold"
            style={{ background: colors.brand, color: colors.text.light }}
          >
            Retry
          </button>
        }
      />
    );
  }

  const certificateRate = pct(
    summary.certificate_count,
    Math.max(summary.total_sessions, 1),
  );
  const reviewBacklog = summary.pending_count + summary.flagged_count;

  return (
    <div className="space-y-3 pb-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total sessions"
          value={formatNumber(summary.total_sessions)}
          meta="Writing records captured"
          trend={sessionDelta}
          icon="keyboard"
        />
        <MetricCard
          title="Certificates issued"
          value={formatNumber(summary.certificate_count)}
          meta={`${certificateRate}% of sessions sealed`}
          trend={certificateRate}
          icon="certificate"
        />
        <MetricCard
          title="Avg. Human Evidence Score"
          value={`${Math.round(summary.avg_confidence)}%`}
          meta="Behavioral model confidence"
          trend={confidenceDelta}
          icon="shield"
        />
        <MetricCard
          title="Avg. typing speed"
          value={`${Math.round(summary.avg_wpm)}`}
          meta="Words per minute"
          trend={wpmDelta}
          icon="pulse"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.85fr_0.9fr]">
        <EvidenceTrendPanel
          trend={trend}
          periodDays={periodDays}
          setPeriodDays={setPeriodDays}
        />
        <ClassificationPanel summary={summary} />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.05fr_1fr_0.95fr]">
        <WeeklyBreakdownPanel data={weekTrend} />
        <CourseDistributionPanel
          courses={data.courses ?? []}
          totalSessions={summary.total_sessions}
        />
        <ReviewStatusPanel summary={summary} />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.45fr_0.9fr]">
        <RhythmPanel trend={weekTrend} />
        <IntegrityPanel summary={summary} />
      </div>

      <LatestSessionsPanel sessions={data.recent_sessions ?? []} />

      <div
        className="flex flex-col justify-between gap-3 rounded-md border p-4 md:flex-row md:items-center"
        style={{
          background: colors.text.primary,
          borderColor: colors.text.primary,
          boxShadow: `0 14px 32px ${colors.shadowStrong}`,
        }}
      >
        <div>
          <p
            className="text-[11px] font-bold uppercase tracking-[0.14em]"
            style={{ color: colors.surface[300] }}
          >
            Evidence workspace
          </p>
          <h2
            className="mt-1 text-[18px] font-bold tracking-[-0.04em]"
            style={{ color: colors.text.light }}
          >
            {reviewBacklog > 0
              ? `${reviewBacklog} sessions still need review context.`
              : "Your current evidence queue is clean."}
          </h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            to={ROUTES.EDITOR_NEW}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-[13px] font-bold"
            style={{ background: colors.text.light, color: colors.brand }}
          >
            New writing session
            <Icon type="arrowRight" size={14} />
          </Link>
          <Link
            to={ROUTES.CERTIFICATES}
            className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-[13px] font-bold"
            style={{
              borderColor: withAlpha(colors.text.light, "33"),
              color: colors.text.light,
            }}
          >
            View certificates
          </Link>
        </div>
      </div>
    </div>
  );
}
