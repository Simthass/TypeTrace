import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { api, getApiErrorMessage } from "../../lib/api";
import { ROUTES } from "../../constants/routes";
import { brand, colors } from "../../styles/colors";
import { ErrorState, EmptyState } from "../../components/ui/AsyncState";
import { useToast } from "../../components/ui/ToastProvider";
import type {
  TeacherCourse,
  TeacherCoursesResponse,
} from "../../types/teacher";
import { API_ROUTES } from "../../constants/apiRoutes";

type CourseFilter = "ALL" | "ACTIVE" | "NEEDS_REVIEW" | "EMPTY";
type SortKey = "recent" | "students" | "pending" | "submissions" | "name";

function Icon({ type, size = 16 }: { type: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    copy: (
      <>
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
    course: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
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
    review: (
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </>
    ),
    alert: (
      <>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
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
    arrowRight: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    submissions: (
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
    filter: (
      <>
        <path d="M4 5h16" />
        <path d="M7 12h10" />
        <path d="M10 19h4" />
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

function safeNumber(value: number | string | null | undefined): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function progress(value: number, total: number): number {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
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

function CourseStatusBadge({ course }: { course: TeacherCourse }) {
  const hasSubmissions = safeNumber(course.submission_count) > 0;
  const hasStudents = safeNumber(course.student_count) > 0;
  const hasPending = safeNumber(course.pending_count) > 0;

  let label = "Ready";
  let background: string = brand.humanBg;
  let color: string = brand.humanText;
  let borderColor: string = brand.humanAccent;

  if (hasPending) {
    label = "Needs review";
    background = brand.suspiciousBg;
    color = brand.suspiciousText;
    borderColor = brand.suspiciousAccent;
  } else if (!hasStudents && !hasSubmissions) {
    label = "Setup";
    background = colors.surface[100];
    color = colors.text.secondary;
    borderColor = colors.surface[200];
  }

  return (
    <span
      className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
      style={{ background, color, borderColor }}
    >
      {label}
    </span>
  );
}

function CourseRow({ course }: { course: TeacherCourse }) {
  const [copied, setCopied] = useState(false);
  const reviewTotal = safeNumber(course.submission_count);
  const pendingShare = progress(
    safeNumber(course.pending_count),
    Math.max(reviewTotal, 1),
  );
  const approvedShare = progress(
    safeNumber(course.approved_count),
    Math.max(reviewTotal, 1),
  );
  const flaggedShare = progress(
    safeNumber(course.flagged_count),
    Math.max(reviewTotal, 1),
  );

  const copyInvite = async () => {
    await navigator.clipboard.writeText(course.invite_code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className="grid min-h-[92px] grid-cols-[minmax(300px,1.25fr)_150px_210px_170px_220px] items-center gap-4 border-b px-4 py-3 transition-colors hover:bg-surface-100"
      style={{ borderColor: colors.surface[200] }}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <CourseStatusBadge course={course} />
          <span
            className="font-mono text-[11px] font-bold"
            style={{ color: colors.text.muted }}
          >
            {course.course_code}
          </span>
        </div>
        <Link
          to={ROUTES.TEACHER_COURSE_DETAIL.replace(
            ":courseId",
            String(course.id),
          )}
          className="mt-2 block truncate text-[14px] font-bold hover:underline"
          style={{ color: colors.text.primary }}
        >
          {course.course_name}
        </Link>
        <p
          className="mt-1 text-[11px]"
          style={{ color: colors.text.secondary }}
        >
          Created {formatShortDate(course.created_at)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ color: colors.text.muted }}
          >
            Students
          </p>
          <p
            className="mt-1 text-[15px] font-bold tabular-nums"
            style={{ color: colors.text.primary }}
          >
            {course.student_count}
          </p>
        </div>
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ color: colors.text.muted }}
          >
            Submits
          </p>
          <p
            className="mt-1 text-[15px] font-bold tabular-nums"
            style={{ color: colors.text.primary }}
          >
            {course.submission_count}
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-[11px]">
          <span
            className="font-semibold"
            style={{ color: colors.text.secondary }}
          >
            Review progress
          </span>
          <span
            className="font-mono font-bold tabular-nums"
            style={{ color: colors.text.primary }}
          >
            {course.pending_count} pending
          </span>
        </div>
        <div
          className="mt-2 flex h-2 overflow-hidden rounded-md"
          style={{ background: colors.surface[200] }}
        >
          <div
            style={{ width: `${approvedShare}%`, background: brand.humanText }}
          />
          <div
            style={{
              width: `${pendingShare}%`,
              background: brand.suspiciousText,
            }}
          />
          <div
            style={{ width: `${flaggedShare}%`, background: brand.aiText }}
          />
        </div>
        <div
          className="mt-1.5 flex gap-3 text-[10px]"
          style={{ color: colors.text.muted }}
        >
          <span>{course.approved_count} approved</span>
          <span>{course.flagged_count} flagged</span>
        </div>
      </div>

      <div>
        <p
          className="text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{ color: colors.text.muted }}
        >
          Invite code
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <span
            className="truncate rounded-md border px-2 py-1.5 font-mono text-[11px] font-bold"
            style={{
              background: colors.surface[100],
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          >
            {course.invite_code}
          </span>
          <button
            type="button"
            onClick={copyInvite}
            className="flex h-7 w-7 items-center justify-center rounded-md border"
            style={{
              background: colors.surface[50],
              borderColor: colors.surface[200],
              color: colors.text.secondary,
            }}
            aria-label="Copy invite code"
          >
            <Icon type="copy" size={13} />
          </button>
        </div>
        {copied && (
          <p
            className="mt-1 text-[10px] font-bold"
            style={{ color: colors.brand }}
          >
            Invite copied
          </p>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-1.5">
        <Link
          to={ROUTES.TEACHER_COURSE_DETAIL.replace(
            ":courseId",
            String(course.id),
          )}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[11px] font-bold"
          style={{ background: colors.brand, color: colors.text.light }}
        >
          Open course
          <Icon type="arrowRight" size={12} />
        </Link>
        <Link
          to={`${ROUTES.TEACHER_SUBMISSIONS}?course_id=${course.id}`}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-[11px] font-bold"
          style={{
            background: colors.surface[50],
            borderColor: colors.surface[200],
            color: colors.text.secondary,
          }}
        >
          Queue
        </Link>
      </div>
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
      <div>
        <div
          className="h-7 w-56 animate-pulse rounded-md"
          style={{ background: colors.surface[200] }}
        />
        <div
          className="mt-2 h-4 w-96 animate-pulse rounded-md"
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

export default function TeacherCoursesPage() {
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CourseFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Initialize modal state directly from URL on first render
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("createCourse") === "1";
  });

  const loadCourses = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);

    try {
      const response = await api.get<TeacherCoursesResponse>(
        API_ROUTES.teacher.courses,
      );
      setCourses(response.data.courses ?? []);
    } catch (error) {
      const message = getApiErrorMessage(error);
      setApiError(message);
      showToast({
        type: "error",
        title: "Failed to load courses",
        message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let mounted = true;

    async function loadInitialCourses() {
      if (!mounted) return;
      await loadCourses();
    }

    void loadInitialCourses();

    return () => {
      mounted = false;
    };
  }, [loadCourses]);

  // Clean up URL param if it exists
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("createCourse") === "1") {
      params.delete("createCourse");
      const newSearch = params.toString();
      navigate(
        {
          pathname: location.pathname,
          search: newSearch ? `?${newSearch}` : "",
        },
        { replace: true },
      );
    }
  }, []); // Only run once on mount

  const handleCreateCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanCourseName = courseName.trim();
    const cleanCourseCode = courseCode.trim().toUpperCase();

    if (!cleanCourseName || !cleanCourseCode) {
      showToast({
        type: "warning",
        title: "Missing course details",
        message: "Course name and course code are required.",
      });
      return;
    }

    if (isCreating) return;

    setIsCreating(true);
    setApiError(null);

    try {
      await api.post(API_ROUTES.teacher.courses, {
        course_name: cleanCourseName,
        course_code: cleanCourseCode,
      });

      setCourseName("");
      setCourseCode("");
      setIsCreateModalOpen(false);

      showToast({
        type: "success",
        title: "Course created",
        message: `${cleanCourseName} is ready for student enrollment.`,
      });

      await loadCourses();
    } catch (error) {
      const message = getApiErrorMessage(error);
      showToast({
        type: "error",
        title: "Failed to create course",
        message,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const stats = useMemo(() => {
    const totalCourses = courses.length;
    const totalStudents = courses.reduce(
      (sum, course) => sum + safeNumber(course.student_count),
      0,
    );
    const totalSubmissions = courses.reduce(
      (sum, course) => sum + safeNumber(course.submission_count),
      0,
    );
    const pending = courses.reduce(
      (sum, course) => sum + safeNumber(course.pending_count),
      0,
    );
    const empty = courses.filter(
      (course) =>
        safeNumber(course.student_count) === 0 &&
        safeNumber(course.submission_count) === 0,
    ).length;
    const active = courses.filter(
      (course) =>
        safeNumber(course.student_count) > 0 ||
        safeNumber(course.submission_count) > 0,
    ).length;

    return {
      totalCourses,
      totalStudents,
      totalSubmissions,
      pending,
      empty,
      active,
    };
  }, [courses]);

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return courses
      .filter((course) => {
        const matchesSearch =
          !query ||
          String(course.course_name || "")
            .toLowerCase()
            .includes(query) ||
          String(course.course_code || "")
            .toLowerCase()
            .includes(query) ||
          String(course.invite_code || "")
            .toLowerCase()
            .includes(query);

        const matchesFilter =
          filter === "ALL" ||
          (filter === "ACTIVE" &&
            (safeNumber(course.student_count) > 0 ||
              safeNumber(course.submission_count) > 0)) ||
          (filter === "NEEDS_REVIEW" && safeNumber(course.pending_count) > 0) ||
          (filter === "EMPTY" &&
            safeNumber(course.student_count) === 0 &&
            safeNumber(course.submission_count) === 0);

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        if (sortKey === "students")
          return safeNumber(b.student_count) - safeNumber(a.student_count);
        if (sortKey === "pending")
          return safeNumber(b.pending_count) - safeNumber(a.pending_count);
        if (sortKey === "submissions")
          return (
            safeNumber(b.submission_count) - safeNumber(a.submission_count)
          );
        if (sortKey === "name")
          return String(a.course_name || "").localeCompare(
            String(b.course_name || ""),
          );
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
  }, [courses, filter, search, sortKey]);

  if (isLoading && courses.length === 0) return <InlineLoader />;

  if (apiError && courses.length === 0) {
    return (
      <ErrorState
        title="Could not load courses"
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

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p
            className="text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: colors.text.muted }}
          >
            Course management
          </p>
          <h1
            className="mt-1 text-[26px] font-bold tracking-[-0.04em]"
            style={{ color: colors.text.primary }}
          >
            Courses
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={ROUTES.TEACHER_SUBMISSIONS}
            className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md border px-3 text-[12px] font-bold"
            style={{
              background: colors.surface[50],
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          >
            <Icon type="submissions" size={14} />
            Open submission queue
          </Link>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md px-3 text-[12px] font-bold"
            style={{ background: colors.brand, color: colors.text.light }}
          >
            <Icon type="plus" size={14} />
            Create course
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Courses"
          value={stats.totalCourses}
          description="Active and draft teaching spaces"
          icon="course"
        />
        <MetricCard
          label="Students"
          value={stats.totalStudents}
          description="Total enrolled students across courses"
          icon="users"
        />
        <MetricCard
          label="Submissions"
          value={stats.totalSubmissions}
          description="Course-linked writing evidence records"
          icon="submissions"
        />
        <MetricCard
          label="Pending reviews"
          value={stats.pending}
          description="Teacher decisions still required"
          icon="review"
        />
      </div>

      <div className="space-y-5">
        <Card className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
                  Course directory controls
                </h2>
                <p
                  className="text-[11px]"
                  style={{ color: colors.text.secondary }}
                >
                  Search courses and filter by setup, active, or review
                  workload.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[260px_160px_170px]">
              <div className="relative">
                <span
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: colors.text.muted }}
                >
                  <Icon type="search" size={14} />
                </span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search course, code, invite..."
                  className="h-9 w-full rounded-md border pl-9 pr-9 text-[12px] font-medium outline-none"
                  style={{
                    background: colors.surface[50],
                    borderColor: colors.surface[200],
                    color: colors.text.primary,
                  }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md"
                    style={{ color: colors.text.secondary }}
                    aria-label="Clear search"
                  >
                    <Icon type="close" size={13} />
                  </button>
                )}
              </div>

              <select
                value={filter}
                onChange={(event) =>
                  setFilter(event.target.value as CourseFilter)
                }
                className="h-9 rounded-md border px-3 text-[12px] font-semibold outline-none"
                style={{
                  background: colors.surface[50],
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              >
                <option value="ALL">All courses</option>
                <option value="ACTIVE">Active courses</option>
                <option value="NEEDS_REVIEW">Needs review</option>
                <option value="EMPTY">Setup needed</option>
              </select>

              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                className="h-9 rounded-md border px-3 text-[12px] font-semibold outline-none"
                style={{
                  background: colors.surface[50],
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              >
                <option value="recent">Recently created</option>
                <option value="students">Most students</option>
                <option value="pending">Most pending</option>
                <option value="submissions">Most submissions</option>
                <option value="name">Course name</option>
              </select>
            </div>
          </div>
        </Card>

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
                Course catalogue
              </h2>
              <p
                className="text-[11px]"
                style={{ color: colors.text.secondary }}
              >
                LMS-style list of teaching spaces, enrollment codes, and review
                workload.
              </p>
            </div>
            <span
              className="text-[11px] font-semibold tabular-nums"
              style={{ color: colors.text.muted }}
            >
              {filteredCourses.length} shown
            </span>
          </div>

          {filteredCourses.length === 0 ? (
            courses.length === 0 ? (
              <EmptyState
                title="No courses yet"
                message="Create your first course and share the invite code with students."
              />
            ) : (
              <EmptyState
                title="No courses match your filters"
                message="Try clearing search or changing the course state filter."
              />
            )
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1080px]">
                <div
                  className="grid grid-cols-[minmax(300px,1.25fr)_150px_210px_170px_220px] items-center gap-4 border-b px-4 py-2.5"
                  style={{
                    background: colors.surface[100],
                    borderColor: colors.surface[200],
                  }}
                >
                  {[
                    "Course",
                    "Class size",
                    "Review state",
                    "Enrollment",
                    "Actions",
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

                {filteredCourses.map((course) => (
                  <CourseRow key={course.id} course={course} />
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0"
            style={{ background: colors.shadowStrong }}
            onClick={() => {
              if (!isCreating) setIsCreateModalOpen(false);
            }}
            aria-label="Close create course modal"
          />

          <section
            className="relative z-10 w-full max-w-[520px] overflow-hidden rounded-md border"
            style={{
              background: colors.surface[50],
              borderColor: colors.surface[200],
              boxShadow: `0 18px 54px ${colors.shadowStrong}`,
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-course-title"
          >
            <div
              className="flex items-start justify-between gap-4 border-b p-5"
              style={{ borderColor: colors.surface[200] }}
            >
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.16em]"
                  style={{ color: colors.text.muted }}
                >
                  Course setup
                </p>
                <h2
                  id="create-course-title"
                  className="mt-1 text-[19px] font-bold tracking-[-0.04em]"
                  style={{ color: colors.text.primary }}
                >
                  Create course
                </h2>
                <p
                  className="mt-1 text-[12px] leading-5"
                  style={{ color: colors.text.secondary }}
                >
                  Add the course name and code. TypeTrace will create the class
                  space and generate an invite code for students.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isCreating}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: colors.surface[50],
                  borderColor: colors.surface[200],
                  color: colors.text.secondary,
                }}
                aria-label="Close modal"
              >
                <Icon type="close" size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: colors.text.muted }}
                  >
                    Course name
                  </span>
                  <input
                    value={courseName}
                    onChange={(event) => setCourseName(event.target.value)}
                    placeholder="Human Computer Interaction"
                    className="mt-1.5 h-11 w-full rounded-md border px-3 text-[13px] font-medium outline-none"
                    style={{
                      background: colors.surface[50],
                      borderColor: colors.surface[200],
                      color: colors.text.primary,
                    }}
                    autoFocus
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: colors.text.muted }}
                  >
                    Course code
                  </span>
                  <input
                    value={courseCode}
                    onChange={(event) =>
                      setCourseCode(event.target.value.toUpperCase())
                    }
                    placeholder="HCI-501"
                    className="mt-1.5 h-11 w-full rounded-md border px-3 font-mono text-[13px] font-bold outline-none"
                    style={{
                      background: colors.surface[50],
                      borderColor: colors.surface[200],
                      color: colors.text.primary,
                    }}
                  />
                </label>
              </div>

              <div
                className="mt-5 rounded-md border p-3"
                style={{
                  background: colors.surface[100],
                  borderColor: colors.surface[200],
                }}
              >
                <p
                  className="text-[12px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  After creation
                </p>
                <p
                  className="mt-1 text-[11px] leading-5"
                  style={{ color: colors.text.secondary }}
                >
                  Students join using the generated invite code. Submissions
                  from this course will appear in the teacher submission queue
                  and course workspace.
                </p>
              </div>

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isCreating}
                  className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-[13px] font-bold disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background: colors.surface[50],
                    borderColor: colors.surface[200],
                    color: colors.text.primary,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-[13px] font-bold disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: colors.brand, color: colors.text.light }}
                >
                  <Icon type="plus" size={14} />
                  {isCreating ? "Creating course..." : "Create course"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
