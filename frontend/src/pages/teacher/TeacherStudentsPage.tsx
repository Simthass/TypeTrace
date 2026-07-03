import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { api, getApiErrorMessage } from "../../lib/api";
import { ROUTES } from "../../constants/routes";
import { colors, brand } from "../../styles/colors";
import { ErrorState, EmptyState } from "../../components/ui/AsyncState";
import { useToast } from "../../components/ui/ToastProvider";
import type {
  TeacherStudent,
  TeacherStudentsResponse,
} from "../../types/teacher";
import { API_ROUTES } from "../../constants/apiRoutes";

const PAGE_SIZE = 20;

type StatusFilter =
  | "ALL"
  | "ACTIVE"
  | "NEEDS_REVIEW"
  | "FLAGGED"
  | "NO_SUBMISSIONS";
type SortKey =
  | "name"
  | "course"
  | "submissions"
  | "pending"
  | "flagged"
  | "recent"
  | "confidence";

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
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    course: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
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
    review: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="m9 15 2 2 4-5" />
      </>
    ),
    alert: (
      <>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
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
    filter: (
      <>
        <path d="M3 5h18" />
        <path d="M7 12h10" />
        <path d="M10 19h4" />
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
        <path d="M3 4v6h6" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    id: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 9h5" />
        <path d="M7 13h10" />
        <path d="M7 17h7" />
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

function safeNumber(value: unknown): number {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizePercent(value: unknown): number {
  return Math.max(0, Math.min(100, Math.round(safeNumber(value))));
}

function formatShortDate(value?: string | null): string {
  if (!value) return "Never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function studentKey(student: TeacherStudent): string {
  return String(
    student.id || student.email || student.student_id || student.student_name,
  );
}

function studentStatus(student: TeacherStudent): StatusFilter {
  if (safeNumber(student.flagged_count) > 0) return "FLAGGED";
  if (safeNumber(student.pending_count) > 0) return "NEEDS_REVIEW";
  if (safeNumber(student.submission_count) > 0) return "ACTIVE";
  return "NO_SUBMISSIONS";
}

function statusLabel(value: StatusFilter) {
  if (value === "ACTIVE") return "Active";
  if (value === "NEEDS_REVIEW") return "Needs review";
  if (value === "FLAGGED") return "Flagged";
  if (value === "NO_SUBMISSIONS") return "No submissions";
  return "All students";
}

function statusStyle(value: string) {
  const normalized = String(value || "").toUpperCase();

  if (normalized === "ACTIVE" || normalized === "APPROVED") {
    return {
      background: brand.humanBg,
      color: brand.humanText,
      borderColor: brand.humanAccent,
      label: "Active",
    };
  }

  if (normalized === "NEEDS_REVIEW" || normalized === "PENDING") {
    return {
      background: brand.suspiciousBg,
      color: brand.suspiciousText,
      borderColor: brand.suspiciousAccent,
      label: "Needs review",
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

  if (normalized === "NO_SUBMISSIONS") {
    return {
      background: colors.surface[100],
      color: colors.text.secondary,
      borderColor: colors.surface[200],
      label: "No submissions",
    };
  }

  return {
    background: colors.surface[100],
    color: colors.text.secondary,
    borderColor: colors.surface[200],
    label: normalized || "Unknown",
  };
}

function StatusBadge({ value }: { value: string }) {
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
            className="mt-2 text-[24px] font-bold tracking-[-0.04em] tabular-nums"
            style={{ color: colors.text.primary }}
          >
            {value}
          </p>
        </div>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md"
          style={{ background: colors.brandSoft, color: colors.brand }}
        >
          <Icon type={icon} size={15} />
        </div>
      </div>
      <p
        className="mt-2 text-[11px] leading-5"
        style={{ color: colors.text.secondary }}
      >
        {description}
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
            className="h-7 w-44 animate-pulse rounded-md"
            style={{ background: colors.surface[200] }}
          />
          <div
            className="mt-2 h-4 w-80 animate-pulse rounded-md"
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
            className="h-28 animate-pulse rounded-md border bg-white"
            style={{ borderColor: colors.surface[200] }}
          />
        ))}
      </div>
      <div
        className="h-[420px] animate-pulse rounded-md border bg-white"
        style={{ borderColor: colors.surface[200] }}
      />
    </div>
  );
}

export default function TeacherStudentsPage() {
  const { showToast } = useToast();
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadStudents() {
      setIsLoading(true);
      setApiError(null);

      try {
        const response = await api.get<TeacherStudentsResponse>(
          API_ROUTES.teacher.students,
        );
        if (!mounted) return;
        setStudents(response.data.students || []);
      } catch (error) {
        if (!mounted) return;
        const message = getApiErrorMessage(error);
        setApiError(message);
        showToast({ type: "error", title: "Students failed to load", message });
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadStudents();

    return () => {
      mounted = false;
    };
  }, [showToast]);

  const courses = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    students.forEach((student) => {
      const id = String(student.course_id || "");
      if (!id || map.has(id)) return;
      map.set(id, {
        id,
        name: student.course_name || "Unnamed course",
        code: student.course_code || "COURSE",
      });
    });
    return Array.from(map.values()).sort((a, b) =>
      a.code.localeCompare(b.code),
    );
  }, [students]);

  const stats = useMemo(() => {
    const unique = new Set(students.map(studentKey));
    const activeEnrollments = students.filter(
      (student) => safeNumber(student.submission_count) > 0,
    ).length;
    const pending = students.reduce(
      (sum, student) => sum + safeNumber(student.pending_count),
      0,
    );
    const flagged = students.reduce(
      (sum, student) => sum + safeNumber(student.flagged_count),
      0,
    );
    const submissions = students.reduce(
      (sum, student) => sum + safeNumber(student.submission_count),
      0,
    );
    const avgConfidence = students.length
      ? Math.round(
          students.reduce(
            (sum, student) => sum + safeNumber(student.avg_confidence),
            0,
          ) / students.length,
        )
      : 0;
    const avgWpm = students.length
      ? Math.round(
          students.reduce(
            (sum, student) => sum + safeNumber(student.avg_wpm),
            0,
          ) / students.length,
        )
      : 0;

    return {
      uniqueStudents: unique.size,
      enrollments: students.length,
      activeEnrollments,
      pending,
      flagged,
      submissions,
      avgConfidence,
      avgWpm,
      noSubmission: students.filter(
        (student) => safeNumber(student.submission_count) === 0,
      ).length,
    };
  }, [students]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return students
      .filter((student) => {
        const haystack = [
          student.student_name,
          student.email,
          student.student_id,
          student.course_name,
          student.course_code,
        ]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");

        const matchesSearch = !query || haystack.includes(query);
        const matchesCourse =
          courseFilter === "ALL" || String(student.course_id) === courseFilter;
        const matchesStatus =
          statusFilter === "ALL" || studentStatus(student) === statusFilter;

        return matchesSearch && matchesCourse && matchesStatus;
      })
      .sort((a, b) => {
        if (sortKey === "course")
          return String(a.course_code || "").localeCompare(
            String(b.course_code || ""),
          );
        if (sortKey === "submissions")
          return (
            safeNumber(b.submission_count) - safeNumber(a.submission_count)
          );
        if (sortKey === "pending")
          return safeNumber(b.pending_count) - safeNumber(a.pending_count);
        if (sortKey === "flagged")
          return safeNumber(b.flagged_count) - safeNumber(a.flagged_count);
        if (sortKey === "confidence")
          return safeNumber(b.avg_confidence) - safeNumber(a.avg_confidence);
        if (sortKey === "recent")
          return (
            new Date(b.last_submission_at || 0).getTime() -
            new Date(a.last_submission_at || 0).getTime()
          );
        return String(a.student_name || "").localeCompare(
          String(b.student_name || ""),
        );
      });
  }, [students, search, courseFilter, statusFilter, sortKey]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredStudents.length / PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages - 1);
  const paginatedStudents = filteredStudents.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  useEffect(() => {
    setPage(0);
  }, [search, courseFilter, statusFilter, sortKey]);

  const resetFilters = () => {
    setSearch("");
    setCourseFilter("ALL");
    setStatusFilter("ALL");
    setSortKey("name");
  };

  if (isLoading) return <InlineLoader />;

  if (apiError) {
    return (
      <ErrorState
        title="Could not load students"
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

  const showingStart = filteredStudents.length ? safePage * PAGE_SIZE + 1 : 0;
  const showingEnd = Math.min(
    (safePage + 1) * PAGE_SIZE,
    filteredStudents.length,
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-0">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p
            className="text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: colors.text.muted }}
          >
            Learner management
          </p>
          <h1
            className="mt-1 text-[26px] font-bold tracking-[-0.04em]"
            style={{ color: colors.text.primary }}
          >
            Students
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
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
          <Link
            to={ROUTES.TEACHER_SUBMISSIONS}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-[12px] font-bold"
            style={{ background: colors.brand, color: colors.text.light }}
          >
            <Icon type="submissions" size={14} />
            Open submission queue
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Students"
          value={stats.uniqueStudents}
          description="Unique learners enrolled in your TypeTrace courses"
          icon="users"
        />
        <MetricCard
          label="Enrollments"
          value={stats.enrollments}
          description="Student-course memberships across your teaching spaces"
          icon="course"
        />
        <MetricCard
          label="Submissions"
          value={stats.submissions}
          description="Writing evidence records attached to enrolled students"
          icon="submissions"
        />
        <MetricCard
          label="Needs review"
          value={stats.pending}
          description="Pending review decisions across the roster"
          icon="review"
        />
      </div>

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
                Roster controls
              </h2>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[260px_170px_170px_170px_100px]">
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
                placeholder="Search student, email, ID..."
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
              value={courseFilter}
              onChange={(event) => setCourseFilter(event.target.value)}
              className="h-9 rounded-md border px-3 text-[12px] font-semibold outline-none"
              style={{
                background: colors.surface[50],
                borderColor: colors.surface[200],
                color: colors.text.primary,
              }}
            >
              <option value="ALL">All courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              className="h-9 rounded-md border px-3 text-[12px] font-semibold outline-none"
              style={{
                background: colors.surface[50],
                borderColor: colors.surface[200],
                color: colors.text.primary,
              }}
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="NEEDS_REVIEW">Needs review</option>
              <option value="FLAGGED">Flagged</option>
              <option value="NO_SUBMISSIONS">No submissions</option>
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
              <option value="name">Student name</option>
              <option value="course">Course code</option>
              <option value="submissions">Most submissions</option>
              <option value="pending">Most pending</option>
              <option value="flagged">Most flagged</option>
              <option value="recent">Recent activity</option>
              <option value="confidence">Confidence high</option>
            </select>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-[12px] font-bold"
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

        <p
          className="mt-3 text-[11px]"
          style={{ color: colors.text.secondary }}
        >
          Showing {filteredStudents.length} of {students.length} student-course
          enrollments · {statusLabel(statusFilter)}
        </p>
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
              Student roster
            </h2>
            <p className="text-[11px]" style={{ color: colors.text.secondary }}>
              LMS-style roster view with enrollment context, evidence history,
              performance signals, and review workload.
            </p>
          </div>
          <span
            className="text-[11px] font-semibold tabular-nums"
            style={{ color: colors.text.muted }}
          >
            {showingStart}–{showingEnd} of {filteredStudents.length}
          </span>
        </div>

        {students.length === 0 ? (
          <EmptyState
            title="No students found"
            message="Share course invite codes so students can join your TypeTrace courses."
          />
        ) : paginatedStudents.length === 0 ? (
          <EmptyState
            title="No students match your filters"
            message="Try clearing search, course, or review-state filters."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[1180px]">
                <div
                  className="grid grid-cols-[minmax(250px,1.25fr)_180px_170px_170px_160px_150px_140px_160px] items-center gap-4 border-b px-4 py-2.5"
                  style={{
                    background: colors.surface[100],
                    borderColor: colors.surface[200],
                  }}
                >
                  {[
                    "Student",
                    "Course",
                    "Enrollment",
                    "Evidence",
                    "Review workload",
                    "Performance",
                    "Last activity",
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

                {paginatedStudents.map((student) => {
                  const confidence = normalizePercent(student.avg_confidence);
                  const status = studentStatus(student);
                  return (
                    <div
                      key={`${student.id}-${student.course_id}`}
                      className="grid min-h-[78px] grid-cols-[minmax(250px,1.25fr)_180px_170px_170px_160px_150px_140px_160px] items-center gap-4 border-b px-4 py-3 transition-colors hover:bg-surface-100"
                      style={{ borderColor: colors.surface[200] }}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[12px] font-bold"
                            style={{
                              background: colors.brandSoft,
                              color: colors.brand,
                            }}
                          >
                            {String(student.student_name || "S")
                              .slice(0, 1)
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p
                              className="truncate text-[13px] font-bold"
                              style={{ color: colors.text.primary }}
                            >
                              {student.student_name || "Unknown student"}
                            </p>
                            <p
                              className="mt-0.5 truncate text-[11px]"
                              style={{ color: colors.text.secondary }}
                            >
                              {student.email || "No email"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <p
                          className="truncate text-[12px] font-bold"
                          style={{ color: colors.text.primary }}
                        >
                          {student.course_code || "Course"}
                        </p>
                        <p
                          className="mt-0.5 truncate text-[11px]"
                          style={{ color: colors.text.secondary }}
                        >
                          {student.course_name || "Course workspace"}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p
                          className="font-mono text-[11px] font-bold"
                          style={{ color: colors.text.primary }}
                        >
                          {student.student_id || "No ID"}
                        </p>
                        <p
                          className="mt-0.5 text-[11px]"
                          style={{ color: colors.text.secondary }}
                        >
                          Joined {formatShortDate(student.joined_at)}
                        </p>
                      </div>

                      <div>
                        <p
                          className="font-mono text-[13px] font-bold tabular-nums"
                          style={{ color: colors.text.primary }}
                        >
                          {safeNumber(student.submission_count)} submissions
                        </p>
                        <p
                          className="mt-0.5 text-[11px]"
                          style={{ color: colors.text.secondary }}
                        >
                          {Math.round(safeNumber(student.avg_wpm))} WPM average
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <StatusBadge value={status} />
                        <p
                          className="text-[10px]"
                          style={{ color: colors.text.muted }}
                        >
                          {safeNumber(student.pending_count)} pending ·{" "}
                          {safeNumber(student.flagged_count)} flagged
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="font-mono text-[12px] font-bold tabular-nums"
                            style={{ color: colors.text.primary }}
                          >
                            {confidence}%
                          </span>
                          <span
                            className="text-[10px]"
                            style={{ color: colors.text.secondary }}
                          >
                            confidence
                          </span>
                        </div>
                        <div
                          className="mt-1.5 h-1.5 rounded-md"
                          style={{ background: colors.surface[200] }}
                        >
                          <div
                            className="h-1.5 rounded-md"
                            style={{
                              background: colors.brand,
                              width: `${confidence}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <p
                          className="text-[12px] font-semibold"
                          style={{ color: colors.text.primary }}
                        >
                          {formatShortDate(student.last_submission_at)}
                        </p>
                        <p
                          className="mt-0.5 text-[11px]"
                          style={{ color: colors.text.secondary }}
                        >
                          Last submission
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <Link
                          to={ROUTES.TEACHER_COURSE_DETAIL.replace(
                            ":courseId",
                            String(student.course_id),
                          )}
                          className="inline-flex h-7 items-center justify-center gap-1 rounded-md border px-2.5 text-[11px] font-bold"
                          style={{
                            borderColor: colors.surface[200],
                            color: colors.text.secondary,
                            background: colors.surface[50],
                          }}
                        >
                          Course
                        </Link>
                        <Link
                          to={ROUTES.TEACHER_SUBMISSIONS}
                          className="inline-flex h-7 items-center justify-center gap-1 rounded-md px-2.5 text-[11px] font-bold"
                          style={{
                            background: colors.brand,
                            color: colors.text.light,
                          }}
                        >
                          Queue
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {filteredStudents.length > PAGE_SIZE && (
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
  );
}
