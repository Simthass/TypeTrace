import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api, getApiErrorMessage } from "../../lib/api";
import { ROUTES } from "../../constants/routes";
import { brand, colors } from "../../styles/colors";
import { ErrorState } from "../../components/ui/AsyncState";
import { useToast } from "../../components/ui/ToastProvider";
import { useAuthStore } from "../../store/authStore";
import { API_ROUTES } from "../../constants/apiRoutes";

interface TeacherSummary {
  total_courses: number;
  total_students: number;
  total_submissions: number;
  pending_reviews: number;
  approved_reviews: number;
  flagged_reviews: number;
  human_submissions: number;
  suspicious_submissions: number;
  synthetic_submissions: number;
  avg_confidence: number;
  avg_wpm: number;
}

interface TeacherSubmission {
  id: number;
  title: string;
  student_name: string;
  student_email?: string;
  student_id?: string;
  course_id?: number | string | null;
  course_name?: string | null;
  course_code?: string | null;
  classification: string;
  classification_bucket: string;
  confidence: number;
  risk_level: string;
  review_status: string;
  review_notes?: string;
  wpm: number;
  duration_seconds: number;
  total_keystrokes: number;
  deletions: number;
  pauses: number;
  avg_iki: number;
  word_count: number;
  certificate_id?: string | null;
  document_hash?: string | null;
  created_at: string;
}

interface TeacherCourse {
  id: number | string;
  course_name: string;
  course_code: string;
  invite_code?: string;
  created_at?: string;
  student_count: number;
  submission_count: number;
  pending_count: number;
  approved_count: number;
  flagged_count: number;
  avg_confidence: number;
  avg_wpm: number;
}

interface TeacherDashboardData {
  status: string;
  teacher?: {
    id: string;
    first_name: string;
    last_name?: string | null;
    email: string;
    university_name?: string | null;
    department?: string | null;
  };
  summary?: TeacherSummary;
  recent_submissions: TeacherSubmission[];
  courses: TeacherCourse[];

  total_courses?: number;
  total_students?: number;
  total_submissions?: number;
  pending_review?: number;
  approved_count?: number;
  flagged_count?: number;
  avg_confidence?: number;
}

type ChartDatum = Record<string, string | number>;

function Icon({ type, size = 16 }: { type: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    courses: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
      </>
    ),
    students: (
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    submissions: (
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    warning: (
      <>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    arrow: (
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
    empty: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M9 15h6" />
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

function cardShadow() {
  return `0 1px 3px ${colors.shadow}`;
}

function normalizePercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function pct(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function parseDate(value: string): Date | null {
  if (!value || value === "Unknown") return null;
  const parsed = new Date(value.replace(" UTC", "Z"));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatDate(value: string): string {
  const parsed = parseDate(value);
  if (!parsed) return value || "Unknown";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayLabel(day: string): string {
  const parsed = new Date(`${day}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return day;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function normalizeBucket(value?: string): string {
  const normalized = String(value || "UNKNOWN").toUpperCase();
  if (normalized === "HUMAN") return "HUMAN";
  if (normalized === "SUSPICIOUS") return "SUSPICIOUS";
  if (
    ["SYNTHETIC", "AI", "AI-GENERATED", "HIGH_RISK", "HIGH RISK"].includes(
      normalized,
    )
  ) {
    return "SYNTHETIC";
  }
  return "UNKNOWN";
}

function statusStyle(value?: string) {
  const normalized = normalizeBucket(value || "UNKNOWN");

  if (normalized === "HUMAN") {
    return {
      background: brand.humanBg,
      color: brand.humanText,
      borderColor: brand.humanAccent,
      label: "Human",
    };
  }

  if (normalized === "SUSPICIOUS") {
    return {
      background: brand.suspiciousBg,
      color: brand.suspiciousText,
      borderColor: brand.suspiciousAccent,
      label: "Review",
    };
  }

  if (normalized === "SYNTHETIC") {
    return {
      background: brand.aiBg,
      color: brand.aiText,
      borderColor: brand.aiAccent,
      label: "High Risk",
    };
  }

  return {
    background: colors.surface[100],
    color: colors.text.secondary,
    borderColor: colors.surface[200],
    label: String(value || "Unknown").replaceAll("_", " "),
  };
}

function reviewStyle(value?: string) {
  const normalized = String(value || "PENDING").toUpperCase();

  if (normalized === "APPROVED") {
    return {
      background: brand.humanBg,
      color: brand.humanText,
      borderColor: brand.humanAccent,
      label: "Approved",
    };
  }

  if (normalized === "FLAGGED") {
    return {
      background: brand.aiBg,
      color: brand.aiText,
      borderColor: brand.aiAccent,
      label: "Flagged",
    };
  }

  return {
    background: brand.suspiciousBg,
    color: brand.suspiciousText,
    borderColor: brand.suspiciousAccent,
    label: "Pending",
  };
}

function StatusBadge({
  value,
  mode = "classification",
}: {
  value?: string;
  mode?: "classification" | "review";
}) {
  const style = mode === "review" ? reviewStyle(value) : statusStyle(value);

  return (
    <span
      className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{
        background: style.background,
        borderColor: style.borderColor,
        color: style.color,
      }}
    >
      {style.label}
    </span>
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

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-md border bg-white ${className}`}
      style={{ borderColor: colors.surface[200], boxShadow: cardShadow() }}
    >
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon,
  to,
  tone = "brand",
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: string;
  to?: string;
  tone?: "brand" | "warning" | "danger" | "success";
}) {
  const toneColor =
    tone === "warning"
      ? colors.amber
      : tone === "danger"
        ? colors.red
        : tone === "success"
          ? colors.green
          : colors.brand;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md"
          style={{ background: colors.brandSoft, color: toneColor }}
        >
          <Icon type={icon} size={16} />
        </div>
        {to && (
          <Link
            to={to}
            className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-surface-100"
            style={{ color: colors.text.muted }}
            aria-label={`Open ${label}`}
          >
            <Icon type="arrow" size={13} />
          </Link>
        )}
      </div>
      <p
        className="mt-3 text-[26px] font-bold tracking-[-0.04em] tabular-nums"
        style={{ color: colors.text.primary }}
      >
        {value}
      </p>
      <p
        className="mt-1 text-[12px] font-semibold"
        style={{ color: colors.text.primary }}
      >
        {label}
      </p>
      <p className="mt-0.5 text-[11px]" style={{ color: colors.text.muted }}>
        {helper}
      </p>
    </Card>
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
            className="h-7 w-56 animate-pulse rounded-md"
            style={{ background: colors.surface[200] }}
          />
          <div
            className="mt-2 h-4 w-80 animate-pulse rounded-md"
            style={{ background: colors.surface[200] }}
          />
        </div>
        <div
          className="h-9 w-28 animate-pulse rounded-md"
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
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div
          className="h-[330px] animate-pulse rounded-md border bg-white"
          style={{ borderColor: colors.surface[200] }}
        />
        <div
          className="h-[330px] animate-pulse rounded-md border bg-white"
          style={{ borderColor: colors.surface[200] }}
        />
      </div>
    </div>
  );
}

function EmptyCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
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
    </div>
  );
}

function buildSummary(data: TeacherDashboardData): TeacherSummary {
  if (data.summary) return data.summary;

  return {
    total_courses: Number(data.total_courses || 0),
    total_students: Number(data.total_students || 0),
    total_submissions: Number(data.total_submissions || 0),
    pending_reviews: Number(data.pending_review || 0),
    approved_reviews: Number(data.approved_count || 0),
    flagged_reviews: Number(data.flagged_count || 0),
    human_submissions: 0,
    suspicious_submissions: 0,
    synthetic_submissions: 0,
    avg_confidence: Number(data.avg_confidence || 0),
    avg_wpm: 0,
  };
}

function buildDailyIntake(
  submissions: TeacherSubmission[],
  days = 14,
): ChartDatum[] {
  const byDay = new Map<string, number>();

  submissions.forEach((submission) => {
    const parsed = parseDate(submission.created_at);
    if (!parsed) return;
    const key = formatDayKey(parsed);
    byDay.set(key, (byDay.get(key) || 0) + 1);
  });

  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    const day = formatDayKey(date);
    return {
      day,
      label: dayLabel(day),
      submissions: byDay.get(day) || 0,
    };
  });
}

function topCourses(courses: TeacherCourse[]): TeacherCourse[] {
  return [...courses]
    .sort(
      (a, b) =>
        Number(b.submission_count || 0) - Number(a.submission_count || 0),
    )
    .slice(0, 5);
}

export default function TeacherDashboard() {
  const { showToast } = useToast();
  const { user } = useAuthStore();
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setIsLoading(true);
      setApiError(null);

      try {
        const response = await api.get<TeacherDashboardData>(
          API_ROUTES.teacher.dashboard,
        );

        if (!mounted) return;
        setData(response.data);
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

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, [showToast]);

  const summary = useMemo(() => (data ? buildSummary(data) : null), [data]);

  const dailyIntake = useMemo(
    () => buildDailyIntake(data?.recent_submissions || []),
    [data?.recent_submissions],
  );

  const classificationMix = useMemo(
    () => [
      {
        label: "Human",
        value: summary?.human_submissions || 0,
        color: colors.green,
      },
      {
        label: "Review",
        value: summary?.suspicious_submissions || 0,
        color: colors.amber,
      },
      {
        label: "High Risk",
        value: summary?.synthetic_submissions || 0,
        color: colors.red,
      },
    ],
    [summary],
  );

  const courseWorkload = useMemo(
    () =>
      topCourses(data?.courses || []).map((course) => ({
        course: course.course_code || course.course_name || "Course",
        submissions: course.submission_count,
        pending: course.pending_count,
      })),
    [data?.courses],
  );

  const attentionCourses = useMemo(
    () =>
      [...(data?.courses || [])]
        .sort(
          (a, b) => Number(b.pending_count || 0) - Number(a.pending_count || 0),
        )
        .slice(0, 4),
    [data?.courses],
  );

  if (isLoading) return <InlineLoader />;

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
        message="Could not load your teacher workspace. Try refreshing."
        action={
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md px-4 py-2.5 text-[13px] font-bold text-white"
            style={{ background: colors.brand }}
          >
            Reload
          </button>
        }
      />
    );
  }

  const totalClassified =
    summary.human_submissions +
    summary.suspicious_submissions +
    summary.synthetic_submissions;
  const teacherName = user?.first_name || data.teacher?.first_name || "Teacher";

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-0 pb-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1
            className="text-[22px] font-bold tracking-[-0.03em]"
            style={{ color: colors.text.primary }}
          >
            Review workspace
          </h1>
          <p
            className="mt-0.5 text-[13px]"
            style={{ color: colors.text.secondary }}
          >
            Welcome, {teacherName}. Monitor course submissions, review queues,
            and evidence quality.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            to={ROUTES.TEACHER_SUBMISSIONS}
            className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-[13px] font-semibold"
            style={{
              background: colors.surface[50],
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          >
            Open review queue
          </Link>
          <Link
            to={ROUTES.TEACHER_COURSES}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-[13px] font-semibold"
            style={{ background: colors.brand, color: colors.text.light }}
          >
            <Icon type="plus" size={15} />
            New Course
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active courses"
          value={summary.total_courses}
          helper="Courses you currently manage"
          icon="courses"
          to={ROUTES.TEACHER_COURSES}
        />
        <MetricCard
          label="Enrolled students"
          value={summary.total_students}
          helper="Students across your courses"
          icon="students"
          to={ROUTES.TEACHER_STUDENTS}
        />
        <MetricCard
          label="Total submissions"
          value={summary.total_submissions}
          helper="Writing sessions linked to your courses"
          icon="submissions"
          to={ROUTES.TEACHER_SUBMISSIONS}
        />
        <MetricCard
          label="Pending review"
          value={summary.pending_reviews}
          helper="Sessions waiting for teacher decision"
          icon="clock"
          to={ROUTES.TEACHER_SUBMISSIONS}
          tone={summary.pending_reviews > 0 ? "warning" : "success"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card className="p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2
                className="text-[14px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                Latest submission intake
              </h2>
              <p
                className="mt-1 text-[12px]"
                style={{ color: colors.text.muted }}
              >
                Sessions received per day from the latest dashboard submission
                window.
              </p>
            </div>
            <span
              className="rounded-md border px-2 py-1 text-[11px] font-semibold"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.secondary,
              }}
            >
              Unit: submissions/day
            </span>
          </div>

          {data.recent_submissions.length ? (
            <div className="mt-4 h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={dailyIntake}
                  margin={{ top: 10, right: 8, bottom: 0, left: -20 }}
                >
                  <defs>
                    <linearGradient
                      id="teacher-intake-fill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0"
                        stopColor={colors.brand}
                        stopOpacity={0.16}
                      />
                      <stop
                        offset="1"
                        stopColor={colors.brand}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
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
                    interval={2}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: colors.text.muted, fontSize: 11 }}
                    width={28}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="submissions"
                    name="Submissions"
                    stroke={colors.brand}
                    fill="url(#teacher-intake-fill)"
                    strokeWidth={2}
                    isAnimationActive
                    animationDuration={600}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyCard
              title="No submission intake yet"
              subtitle="Students have not submitted writing sessions to your courses yet."
            />
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                className="text-[14px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                Evidence classification mix
              </h2>
              <p
                className="mt-1 text-[12px]"
                style={{ color: colors.text.muted }}
              >
                All classified submissions by outcome.
              </p>
            </div>
            <span
              className="text-[11px] font-semibold tabular-nums"
              style={{ color: colors.text.muted }}
            >
              {totalClassified} total
            </span>
          </div>

          {totalClassified ? (
            <>
              <div className="relative mt-4 h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={classificationMix}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={2}
                      isAnimationActive
                      animationDuration={600}
                    >
                      {classificationMix.map((item) => (
                        <Cell key={item.label} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p
                    className="text-[22px] font-bold tabular-nums"
                    style={{ color: colors.text.primary }}
                  >
                    {totalClassified}
                  </p>
                  <p
                    className="text-[11px]"
                    style={{ color: colors.text.muted }}
                  >
                    classified
                  </p>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {classificationMix.map((item) => (
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
                      {item.value} · {pct(Number(item.value), totalClassified)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyCard
              title="No classification data"
              subtitle="Classification mix appears after students submit analyzed sessions."
            />
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.4fr]">
        <Card className="p-5">
          <div>
            <h2
              className="text-[14px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Course workload
            </h2>
            <p
              className="mt-1 text-[12px]"
              style={{ color: colors.text.muted }}
            >
              Top courses by submission volume and pending work.
            </p>
          </div>

          {courseWorkload.length ? (
            <div className="mt-4 h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={courseWorkload}
                  margin={{ top: 10, right: 8, bottom: 0, left: -20 }}
                >
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="0"
                    stroke={colors.surface[200]}
                  />
                  <XAxis
                    dataKey="course"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: colors.text.muted, fontSize: 11 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: colors.text.muted, fontSize: 11 }}
                    width={28}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar
                    dataKey="submissions"
                    name="Submissions"
                    fill={colors.brand}
                    barSize={16}
                    radius={[2, 2, 0, 0]}
                    isAnimationActive
                    animationDuration={600}
                  />
                  <Bar
                    dataKey="pending"
                    name="Pending"
                    fill={colors.amber}
                    barSize={16}
                    radius={[2, 2, 0, 0]}
                    isAnimationActive
                    animationDuration={600}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyCard
              title="No course workload"
              subtitle="Create a course and invite students to start collecting submissions."
            />
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                className="text-[14px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                Courses needing attention
              </h2>
              <p
                className="mt-1 text-[12px]"
                style={{ color: colors.text.muted }}
              >
                Courses sorted by pending review count.
              </p>
            </div>
            <Link
              to={ROUTES.TEACHER_COURSES}
              className="text-[12px] font-semibold"
              style={{ color: colors.brand }}
            >
              View courses
            </Link>
          </div>

          {attentionCourses.length ? (
            <div className="mt-4 space-y-3">
              {attentionCourses.map((course) => {
                const pendingShare = pct(
                  course.pending_count,
                  Math.max(course.submission_count, 1),
                );
                return (
                  <Link
                    key={course.id}
                    to={ROUTES.TEACHER_COURSE_DETAIL.replace(
                      ":courseId",
                      String(course.id),
                    )}
                    className="block rounded-md border p-3 transition-colors hover:bg-surface-100"
                    style={{ borderColor: colors.surface[200] }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className="truncate text-[13px] font-semibold"
                          style={{ color: colors.text.primary }}
                        >
                          {course.course_name || "Untitled course"}
                        </p>
                        <p
                          className="mt-0.5 font-mono text-[11px]"
                          style={{ color: colors.text.muted }}
                        >
                          {course.course_code || "COURSE"}
                        </p>
                      </div>
                      <span
                        className="text-[12px] font-bold tabular-nums"
                        style={{
                          color: course.pending_count
                            ? colors.amber
                            : colors.green,
                        }}
                      >
                        {course.pending_count} pending
                      </span>
                    </div>
                    <div
                      className="mt-3 h-1.5 rounded-md"
                      style={{ background: colors.surface[200] }}
                    >
                      <div
                        className="h-1.5 rounded-md"
                        style={{
                          background: course.pending_count
                            ? colors.amber
                            : colors.green,
                          width: `${pendingShare}%`,
                        }}
                      />
                    </div>
                    <div
                      className="mt-2 flex items-center justify-between text-[11px]"
                      style={{ color: colors.text.secondary }}
                    >
                      <span className="tabular-nums">
                        {course.student_count} students
                      </span>
                      <span className="tabular-nums">
                        {course.submission_count} submissions
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyCard
              title="No courses yet"
              subtitle="Create a course to start collecting student evidence."
            />
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div
          className="flex items-start justify-between gap-3 border-b px-5 py-4"
          style={{ borderColor: colors.surface[200] }}
        >
          <div>
            <h2
              className="text-[14px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Recent evidence submissions
            </h2>
            <p
              className="mt-1 text-[12px]"
              style={{ color: colors.text.muted }}
            >
              Latest sessions waiting for review or already decided.
            </p>
          </div>
          <Link
            to={ROUTES.TEACHER_SUBMISSIONS}
            className="text-[12px] font-semibold"
            style={{ color: colors.brand }}
          >
            View all
          </Link>
        </div>

        {data.recent_submissions.length ? (
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div
                className="grid grid-cols-[minmax(230px,1fr)_150px_120px_100px_110px_96px] items-center gap-4 border-b px-5 py-3"
                style={{
                  background: colors.surface[100],
                  borderColor: colors.surface[200],
                }}
              >
                {[
                  "Document",
                  "Student",
                  "Classification",
                  "Confidence",
                  "Review",
                  "Action",
                ].map((heading) => (
                  <div
                    key={heading}
                    className="text-[10px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: colors.text.muted }}
                  >
                    {heading}
                  </div>
                ))}
              </div>

              {data.recent_submissions.map((submission) => {
                const confidence = normalizePercent(submission.confidence);
                return (
                  <Link
                    key={submission.id}
                    to={ROUTES.TEACHER_REVIEW.replace(
                      ":sessionId",
                      String(submission.id),
                    )}
                    className="grid h-[64px] grid-cols-[minmax(230px,1fr)_150px_120px_100px_110px_96px] items-center gap-4 border-b px-5 transition-colors duration-100 hover:bg-surface-100"
                    style={{ borderColor: colors.surface[200] }}
                  >
                    <div className="min-w-0">
                      <p
                        className="truncate text-[13px] font-semibold"
                        style={{ color: colors.text.primary }}
                      >
                        {submission.title || "Untitled Document"}
                      </p>
                      <p
                        className="mt-0.5 truncate text-[11px]"
                        style={{ color: colors.text.muted }}
                      >
                        {submission.course_code || "Course"} ·{" "}
                        {formatDate(submission.created_at)} ·{" "}
                        {submission.word_count || 0} words
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p
                        className="truncate text-[12px] font-semibold"
                        style={{ color: colors.text.primary }}
                      >
                        {submission.student_name || "Student"}
                      </p>
                      <p
                        className="mt-0.5 truncate font-mono text-[10px]"
                        style={{ color: colors.text.muted }}
                      >
                        {submission.student_id || "No ID"}
                      </p>
                    </div>

                    <StatusBadge
                      value={
                        submission.classification_bucket ||
                        submission.classification
                      }
                    />

                    <div>
                      <p
                        className="font-mono text-[13px] font-bold tabular-nums"
                        style={{ color: colors.text.primary }}
                      >
                        {confidence}%
                      </p>
                      <div
                        className="mt-1 h-1 rounded-md"
                        style={{ background: colors.surface[200] }}
                      >
                        <div
                          className="h-1 rounded-md"
                          style={{
                            background: colors.brand,
                            width: `${confidence}%`,
                          }}
                        />
                      </div>
                    </div>

                    <StatusBadge
                      value={submission.review_status}
                      mode="review"
                    />

                    <div className="flex items-center justify-end">
                      <span
                        className="inline-flex h-7 items-center justify-center rounded-md border px-2 text-[11px] font-semibold"
                        style={{
                          background: colors.surface[50],
                          borderColor: colors.surface[200],
                          color: colors.text.secondary,
                        }}
                      >
                        Review
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyCard
            title="No submissions yet"
            subtitle="Student writing evidence appears here after they submit sessions to your courses."
          />
        )}
      </Card>
    </div>
  );
}
