import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { api, getApiErrorMessage } from "../../lib/api";
import { ROUTES } from "../../constants/routes";
import { brand, colors } from "../../styles/colors";
import { ErrorState, EmptyState } from "../../components/ui/AsyncState";
import { useToast } from "../../components/ui/ToastContext";
import type {
  TeacherCourse,
  TeacherCoursesResponse,
  TeacherSubmission,
  TeacherSubmissionsResponse,
} from "../../types/teacher";
import { API_ROUTES } from "../../constants/apiRoutes";

const PAGE_SIZE = 12;

type SortKey =
  | "newest"
  | "oldest"
  | "risk"
  | "confidenceHigh"
  | "confidenceLow"
  | "student";

function Icon({ type, size = 16 }: { type: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
    close: (
      <>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </>
    ),
    filter: (
      <>
        <path d="M4 5h16" />
        <path d="M7 12h10" />
        <path d="M10 19h4" />
      </>
    ),
    review: (
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </>
    ),
    replay: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
        <path d="M12 7v5l3 3" />
      </>
    ),
    certificate: (
      <>
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v6h6" />
        <path d="m9 15 2 2 4-5" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    alert: (
      <>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
        <path d="M16 3.1a4 4 0 0 1 0 7.8" />
      </>
    ),
    course: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    arrowRight: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    reset: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
      </>
    ),
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

function getBucket(submission: TeacherSubmission): string {
  return String(
    submission.classification_bucket || submission.classification || "UNKNOWN",
  ).toUpperCase();
}

function isHighRisk(value?: string): boolean {
  return ["SYNTHETIC", "AI", "AI-GENERATED", "HIGH", "HIGH_RISK"].includes(
    String(value || "").toUpperCase(),
  );
}

function safeNumber(value: number | string | null | undefined): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatShortDate(value?: string): string {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusStyle(value?: string) {
  const normalized = String(value || "UNKNOWN").toUpperCase();

  if (
    normalized === "HUMAN" ||
    normalized === "APPROVED" ||
    normalized === "LOW"
  ) {
    return {
      background: brand.humanBg,
      color: brand.humanText,
      borderColor: brand.humanAccent,
      label:
        normalized === "LOW"
          ? "Low risk"
          : normalized === "HUMAN"
            ? "Human"
            : "Approved",
    };
  }

  if (
    normalized === "SUSPICIOUS" ||
    normalized === "PENDING" ||
    normalized === "MEDIUM"
  ) {
    return {
      background: brand.suspiciousBg,
      color: brand.suspiciousText,
      borderColor: brand.suspiciousAccent,
      label:
        normalized === "SUSPICIOUS"
          ? "Review"
          : normalized === "MEDIUM"
            ? "Medium"
            : "Pending",
    };
  }

  if (isHighRisk(normalized) || normalized === "FLAGGED") {
    return {
      background: brand.aiBg,
      color: brand.aiText,
      borderColor: brand.aiAccent,
      label: normalized === "FLAGGED" ? "Flagged" : "High risk",
    };
  }

  return {
    background: colors.surface[100],
    color: colors.text.secondary,
    borderColor: colors.surface[200],
    label: normalized.replaceAll("_", " "),
  };
}

function StatusBadge({ value }: { value?: string }) {
  const style = statusStyle(value);
  return (
    <span
      className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
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

function Card({
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
        boxShadow: cardShadow(),
      }}
    >
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: string | number;
  description: string;
  icon: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ color: colors.text.muted }}
          >
            {label}
          </p>
          <p
            className="mt-2 text-[25px] font-bold tracking-[-0.04em] tabular-nums"
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
      <p
        className="mt-1 text-[11px] leading-5"
        style={{ color: colors.text.secondary }}
      >
        {description}
      </p>
    </Card>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: colors.text.muted }}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border px-3 text-[12px] font-semibold outline-none"
        style={{
          background: colors.surface[50],
          borderColor: colors.surface[200],
          color: colors.text.primary,
        }}
      >
        {children}
      </select>
    </label>
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
            className="h-7 w-64 animate-pulse rounded-md"
            style={{ background: colors.surface[200] }}
          />
          <div
            className="mt-2 h-4 w-96 animate-pulse rounded-md"
            style={{ background: colors.surface[200] }}
          />
        </div>
        <div
          className="h-9 w-32 animate-pulse rounded-md"
          style={{ background: colors.surface[200] }}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-md border"
            style={{
              background: colors.surface[50],
              borderColor: colors.surface[200],
            }}
          />
        ))}
      </div>
      <div
        className="h-[420px] animate-pulse rounded-md border"
        style={{
          background: colors.surface[50],
          borderColor: colors.surface[200],
        }}
      />
    </div>
  );
}

export default function TeacherSubmissionsPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [submissions, setSubmissions] = useState<TeacherSubmission[]>([]);
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [total, setTotal] = useState(0);
  const [reviewStatus, setReviewStatus] = useState(
    searchParams.get("review_status") || "ALL",
  );
  const [riskLevel, setRiskLevel] = useState(
    searchParams.get("risk_level") || "ALL",
  );
  const [courseId, setCourseId] = useState(
    searchParams.get("course_id") || "ALL",
  );
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [sortKey, setSortKey] = useState<SortKey>("oldest");
  const [page, setPage] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCoursesLoading, setIsCoursesLoading] = useState(true);

  const requestParams = useMemo(() => {
    const params: Record<string, string> = {
      limit: "100",
      offset: "0",
    };

    if (courseId !== "ALL") params.course_id = courseId;
    if (reviewStatus !== "ALL") params.review_status = reviewStatus;
    if (riskLevel !== "ALL") params.risk_level = riskLevel;
    if (search.trim()) params.search = search.trim();

    return params;
  }, [courseId, reviewStatus, riskLevel, search]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (courseId !== "ALL") next.set("course_id", courseId);
    if (reviewStatus !== "ALL") next.set("review_status", reviewStatus);
    if (riskLevel !== "ALL") next.set("risk_level", riskLevel);
    if (search.trim()) next.set("search", search.trim());
    setSearchParams(next, { replace: true });
  }, [courseId, reviewStatus, riskLevel, search, setSearchParams]);

  useEffect(() => {
    let mounted = true;

    async function loadCourses() {
      setIsCoursesLoading(true);
      try {
        const response = await api.get<TeacherCoursesResponse>(
          API_ROUTES.teacher.courses,
        );
        if (!mounted) return;
        setCourses(response.data.courses || []);
      } catch (error) {
        if (!mounted) return;
        showToast({
          type: "error",
          title: "Courses failed to load",
          message: getApiErrorMessage(error),
        });
      } finally {
        if (mounted) setIsCoursesLoading(false);
      }
    }

    loadCourses();

    return () => {
      mounted = false;
    };
  }, [showToast]);

  useEffect(() => {
    let mounted = true;

    async function loadSubmissions() {
      setIsLoading(true);
      setApiError(null);

      try {
        const response = await api.get<TeacherSubmissionsResponse>(
          API_ROUTES.teacher.sessions,
          {
            params: requestParams,
          },
        );

        if (!mounted) return;
        setSubmissions(response.data.sessions || []);
        setTotal(response.data.total || 0);
      } catch (error) {
        if (!mounted) return;
        const message = getApiErrorMessage(error);
        setApiError(message);
        showToast({
          type: "error",
          title: "Failed to load submissions",
          message,
        });
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadSubmissions();

    return () => {
      mounted = false;
    };
  }, [requestParams, showToast]);

  const sortedSubmissions = useMemo(() => {
    const riskRank: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const isPending = (item: TeacherSubmission) =>
      String(item.review_status || "PENDING").toUpperCase() === "PENDING";
    return [...submissions].sort((a, b) => {
      if (sortKey === "oldest") {
        const pendingRank = Number(isPending(b)) - Number(isPending(a));
        if (pendingRank !== 0) return pendingRank;
        return (
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
      if (sortKey === "risk")
        return (
          (riskRank[String(b.risk_level).toUpperCase()] || 0) -
          (riskRank[String(a.risk_level).toUpperCase()] || 0)
        );
      if (sortKey === "confidenceHigh")
        return safeNumber(b.confidence) - safeNumber(a.confidence);
      if (sortKey === "confidenceLow")
        return safeNumber(a.confidence) - safeNumber(b.confidence);
      if (sortKey === "student")
        return String(a.student_name || "").localeCompare(
          String(b.student_name || ""),
        );
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [submissions, sortKey]);

  const stats = useMemo(() => {
    const pending = submissions.filter(
      (item) =>
        String(item.review_status || "PENDING").toUpperCase() === "PENDING",
    ).length;
    const flagged = submissions.filter(
      (item) =>
        String(item.review_status || "").toUpperCase() === "FLAGGED" ||
        isHighRisk(item.risk_level),
    ).length;
    const certified = submissions.filter((item) =>
      Boolean(item.certificate_id),
    ).length;
    const avgConfidence = submissions.length
      ? Math.round(
          submissions.reduce(
            (sum, item) => sum + safeNumber(item.confidence),
            0,
          ) / submissions.length,
        )
      : 0;
    const human = submissions.filter(
      (item) => getBucket(item) === "HUMAN",
    ).length;
    const suspicious = submissions.filter(
      (item) => getBucket(item) === "SUSPICIOUS",
    ).length;
    const synthetic = submissions.filter(
      (item) => getBucket(item) === "SYNTHETIC",
    ).length;
    const lowEvidence = submissions.filter(
      (item) => safeNumber(item.total_keystrokes) < 150,
    ).length;

    return {
      pending,
      flagged,
      certified,
      avgConfidence,
      human,
      suspicious,
      synthetic,
      lowEvidence,
    };
  }, [submissions]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedSubmissions.length / PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages - 1);
  const paginatedSubmissions = sortedSubmissions.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  const nextSubmission = useMemo(() => {
    return (
      sortedSubmissions.find(
        (item) =>
          String(item.review_status || "PENDING").toUpperCase() === "PENDING",
      ) || sortedSubmissions[0]
    );
  }, [sortedSubmissions]);

  const updateSearch = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const updateCourseId = (value: string) => {
    setCourseId(value);
    setPage(0);
  };

  const updateReviewStatus = (value: string) => {
    setReviewStatus(value);
    setPage(0);
  };

  const updateRiskLevel = (value: string) => {
    setRiskLevel(value);
    setPage(0);
  };

  const updateSortKey = (value: string) => {
    setSortKey(value as SortKey);
    setPage(0);
  };

  const resetFilters = () => {
    setCourseId("ALL");
    setReviewStatus("ALL");
    setRiskLevel("ALL");
    setSearch("");
    setSortKey("oldest");
    setPage(0);
  };

  if (isLoading && submissions.length === 0) return <InlineLoader />;

  if (apiError && submissions.length === 0) {
    return (
      <ErrorState
        title="Could not load submissions"
        message={apiError}
        action={
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md px-4 py-2 text-[13px] font-semibold"
            style={{ background: colors.brand, color: colors.text.light }}
          >
            Retry
          </button>
        }
      />
    );
  }

  const showingStart = sortedSubmissions.length ? safePage * PAGE_SIZE + 1 : 0;
  const showingEnd = Math.min(
    (safePage + 1) * PAGE_SIZE,
    sortedSubmissions.length,
  );

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p
            className="text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: colors.text.muted }}
          >
            Review queue
          </p>
          <h1
            className="mt-1 text-[26px] font-bold tracking-[-0.04em]"
            style={{ color: colors.text.primary }}
          >
            Submissions
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={ROUTES.TEACHER_COURSES}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-[12px] font-bold"
            style={{
              background: colors.surface[50],
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          >
            <Icon type="course" size={14} />
            Manage courses
          </Link>
          {nextSubmission && (
            <Link
              to={ROUTES.TEACHER_REVIEW.replace(
                ":sessionId",
                String(nextSubmission.id),
              )}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-[12px] font-bold"
              style={{ background: colors.brand, color: colors.text.light }}
            >
              <Icon type="review" size={14} />
              Review next
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Queue results"
          value={total}
          description="Submissions matching the current filters"
          icon="list"
        />
        <MetricCard
          label="Pending review"
          value={stats.pending}
          description="Needs teacher decision or notes"
          icon="clock"
        />
        <MetricCard
          label="Needs attention"
          value={stats.flagged}
          description="High-risk or already flagged evidence"
          icon="alert"
        />
        <MetricCard
          label="Avg confidence"
          value={`${stats.avgConfidence}%`}
          description="Mean model confidence in this queue"
          icon="shield"
        />
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md"
            style={{ background: colors.brandSoft, color: colors.brand }}
          >
            <Icon type="filter" size={15} />
          </div>
          <div>
            <h2
              className="text-[14px] font-bold"
              style={{ color: colors.text.primary }}
            >
              Queue controls
            </h2>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(260px,1fr)_190px_160px_160px_170px_auto]">
          <div>
            <span
              className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ color: colors.text.muted }}
            >
              Search
            </span>
            <div className="relative">
              <span
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: colors.text.muted }}
              >
                <Icon type="search" size={14} />
              </span>
              <input
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                placeholder="Student, title, email, course..."
                className="h-9 w-full rounded-md border pl-9 pr-9 text-[12px] font-medium outline-none"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                  background: colors.surface[50],
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => updateSearch("")}
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md"
                  style={{ color: colors.text.secondary }}
                  aria-label="Clear search"
                >
                  <Icon type="close" size={13} />
                </button>
              )}
            </div>
          </div>

          <SelectField
            label="Course"
            value={courseId}
            onChange={updateCourseId}
          >
            <option value="ALL">All courses</option>
            {courses.map((course) => (
              <option key={course.id} value={String(course.id)}>
                {course.course_code} · {course.course_name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Review"
            value={reviewStatus}
            onChange={updateReviewStatus}
          >
            <option value="ALL">All states</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="FLAGGED">Flagged</option>
          </SelectField>

          <SelectField
            label="Risk"
            value={riskLevel}
            onChange={updateRiskLevel}
          >
            <option value="ALL">All risk</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </SelectField>

          <SelectField label="Sort" value={sortKey} onChange={updateSortKey}>
            <option value="oldest">Needs review first</option>
            <option value="newest">Newest first</option>
            <option value="risk">Highest risk</option>
            <option value="confidenceHigh">Confidence high</option>
            <option value="confidenceLow">Confidence low</option>
            <option value="student">Student name</option>
          </SelectField>

          <div className="flex items-end">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border px-3 text-[12px] font-bold"
              style={{
                background: colors.surface[50],
                borderColor: colors.surface[200],
                color: colors.text.secondary,
              }}
            >
              <Icon type="reset" size={14} />
              Reset
            </button>
          </div>
        </div>

        <div
          className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]"
          style={{ color: colors.text.secondary }}
        >
          <span>
            Showing {sortedSubmissions.length} loaded rows from {total} matching
            submissions.
          </span>
          <span>
            {isCoursesLoading
              ? "Course filter loading..."
              : `${courses.length} course filters available`}
          </span>
        </div>
      </Card>

      <div className="space-y-5">
        <Card className="overflow-hidden">
          <div
            className="flex items-center justify-between gap-3 border-b px-4 py-3"
            style={{ borderColor: colors.surface[200] }}
          >
            <div>
              <h2
                className="text-[14px] font-bold"
                style={{ color: colors.text.primary }}
              >
                Submission ledger
              </h2>
              <p
                className="text-[11px]"
                style={{ color: colors.text.secondary }}
              >
                Pending submissions surface first. Open a row to review
                evidence, replay, and certificate details.
              </p>
            </div>
            <span
              className="text-[11px] font-semibold tabular-nums"
              style={{ color: colors.text.muted }}
            >
              {showingStart}–{showingEnd} of {sortedSubmissions.length}
            </span>
          </div>

          {paginatedSubmissions.length === 0 ? (
            <EmptyState
              title="No submissions found"
              message="Change filters or wait for students to submit course-linked writing sessions."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <div className="min-w-[1020px]">
                  <div
                    className="grid grid-cols-[minmax(280px,1.4fr)_190px_170px_170px_140px] items-center gap-4 border-b px-4 py-2.5"
                    style={{
                      background: colors.surface[100],
                      borderColor: colors.surface[200],
                    }}
                  >
                    {[
                      "Submission",
                      "Student",
                      "Course",
                      "Status",
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

                  {paginatedSubmissions.map((submission) => {
                    const reviewStatusValue = String(
                      submission.review_status || "PENDING",
                    ).toUpperCase();
                    const isPendingRow = reviewStatusValue === "PENDING";
                    const bucket = getBucket(submission);
                    const riskColor = isHighRisk(submission.risk_level)
                      ? colors.red
                      : String(submission.risk_level || "").toUpperCase() ===
                          "MEDIUM"
                        ? colors.amber
                        : colors.green;
                    return (
                      <div
                        key={submission.id}
                        className="grid min-h-[72px] grid-cols-[minmax(280px,1.4fr)_190px_170px_170px_140px] items-center gap-4 border-b py-3 pl-3 pr-4 transition-colors hover:bg-surface-100"
                        style={{
                          borderColor: colors.surface[200],
                          borderLeft: `3px solid ${
                            isPendingRow ? colors.amber : "transparent"
                          }`,
                        }}
                      >
                        <div className="min-w-0">
                          <p
                            className="truncate text-[13px] font-bold"
                            style={{ color: colors.text.primary }}
                          >
                            {submission.title || "Untitled submission"}
                          </p>
                          <p
                            className="mt-1 text-[11px]"
                            style={{ color: colors.text.secondary }}
                          >
                            Submitted {formatShortDate(submission.created_at)} ·{" "}
                            {submission.word_count || 0} words
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p
                            className="truncate text-[12px] font-semibold"
                            style={{ color: colors.text.primary }}
                          >
                            {submission.student_name || "Unknown student"}
                          </p>
                          <p
                            className="truncate font-mono text-[11px]"
                            style={{ color: colors.text.muted }}
                          >
                            {submission.student_id ||
                              submission.student_email ||
                              "No student ID"}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p
                            className="truncate text-[12px] font-bold"
                            style={{ color: colors.text.primary }}
                          >
                            {submission.course_code || "Course"}
                          </p>
                          <p
                            className="truncate text-[11px]"
                            style={{ color: colors.text.secondary }}
                          >
                            {submission.course_name || "Course submission"}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <StatusBadge value={reviewStatusValue} />
                          <p
                            className="flex items-center gap-1.5 text-[11px]"
                            style={{ color: colors.text.secondary }}
                          >
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-md"
                              style={{ background: riskColor }}
                            />
                            {bucket === "HUMAN"
                              ? "Human"
                              : bucket === "SYNTHETIC"
                                ? "High risk"
                                : "Review"}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            to={ROUTES.TEACHER_REVIEW.replace(
                              ":sessionId",
                              String(submission.id),
                            )}
                            className="inline-flex h-8 items-center justify-center gap-1 rounded-md px-3 text-[11px] font-bold"
                            style={{
                              background: colors.brand,
                              color: colors.text.light,
                            }}
                          >
                            Review
                          </Link>
                          {submission.certificate_id && (
                            <Link
                              to={ROUTES.VERIFY.replace(
                                ":certId",
                                submission.certificate_id,
                              )}
                              aria-label="Verify certificate"
                              title="Verify certificate"
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
                              style={{
                                borderColor: colors.surface[200],
                                color: colors.text.secondary,
                                background: colors.surface[50],
                              }}
                            >
                              <Icon type="certificate" size={13} />
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {sortedSubmissions.length > PAGE_SIZE && (
                <div
                  className="flex items-center justify-between gap-3 border-t px-4 py-3"
                  style={{ borderColor: colors.surface[200] }}
                >
                  <p
                    className="text-[11px]"
                    style={{ color: colors.text.secondary }}
                  >
                    Page {safePage + 1} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={safePage === 0}
                      onClick={() =>
                        setPage((current) => Math.max(0, current - 1))
                      }
                      className="h-8 rounded-md border px-3 text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        background: colors.surface[50],
                        borderColor: colors.surface[200],
                        color: colors.text.primary,
                      }}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={safePage >= totalPages - 1}
                      onClick={() =>
                        setPage((current) =>
                          Math.min(totalPages - 1, current + 1),
                        )
                      }
                      className="h-8 rounded-md border px-3 text-[12px] font-bold disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        background: colors.surface[50],
                        borderColor: colors.surface[200],
                        color: colors.text.primary,
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
