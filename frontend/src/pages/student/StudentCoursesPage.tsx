import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, getApiErrorMessage } from "../../lib/api";
import { API_ROUTES } from "../../constants/apiRoutes";
import { ROUTES } from "../../constants/routes";
import { colors } from "../../styles/colors";
import { ButtonLink } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/AsyncState";
import { LoadingState, PageHeader } from "../../components/ui/PageState";
import {
  AppSurface,
  InternalIcon,
  MetricTile,
  StatusPill,
} from "../../components/internal/InternalShell";
import type {
  StudentCourseManagementResponse,
  StudentManagedCourse,
} from "../../types/student";

function formatDate(value: string) {
  if (!value || value === "Unknown") return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function CourseCard({ course }: { course: StudentManagedCourse }) {
  return (
    <AppSurface className="flex h-full flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b p-5" style={{ borderColor: colors.surface[200] }}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-md border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{
                background: colors.brandSoft,
                borderColor: colors.surface[200],
                color: colors.brand,
              }}
            >
              {course.course_code}
            </span>
            <StatusPill
              label={course.is_archived ? "Archived" : "Active"}
              tone={course.is_archived ? "neutral" : "good"}
            />
          </div>
          <h2
            className="mt-3 text-[18px] font-bold tracking-[-0.025em]"
            style={{ color: colors.text.primary }}
          >
            {course.course_name}
          </h2>
          <p className="mt-1 text-[12px]" style={{ color: colors.text.secondary }}>
            Instructor: {course.teacher_name}
          </p>
          {(course.teacher_department || course.teacher_university_name) && (
            <p className="mt-1 text-[11px] leading-5" style={{ color: colors.text.muted }}>
              {[course.teacher_department, course.teacher_university_name]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
          style={{ background: colors.brandSoft, color: colors.brand }}
        >
          <InternalIcon name="course" size={19} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px" style={{ background: colors.surface[200] }}>
        {[
          ["Submissions", course.submission_count],
          ["Feedback", course.feedback_count],
          ["Approved", course.approved_count],
          ["Certificates", course.certificate_count],
        ].map(([label, value]) => (
          <div key={String(label)} className="p-4" style={{ background: colors.surface[50] }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: colors.text.muted }}>
              {label}
            </p>
            <p className="mt-2 text-xl font-bold tabular-nums" style={{ color: colors.text.primary }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-2 p-5 text-[12px]" style={{ color: colors.text.secondary }}>
        <div className="flex items-center justify-between gap-3">
          <span>Joined</span>
          <span className="font-semibold" style={{ color: colors.text.primary }}>
            {formatDate(course.joined_at)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Last submission</span>
          <span className="font-semibold" style={{ color: colors.text.primary }}>
            {formatDate(course.last_submission_at)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Review queue</span>
          <span className="font-semibold" style={{ color: colors.text.primary }}>
            {course.pending_count + course.discussion_count} pending · {course.flagged_count} flagged
          </span>
        </div>
      </div>

      <div
        className="mt-auto flex items-center justify-between gap-3 border-t px-5 py-4"
        style={{ borderColor: colors.surface[200], background: colors.surface[100] }}
      >
        <span className="text-[11px] font-medium" style={{ color: colors.text.muted }}>
          {course.submission_count > 0
            ? `${Math.round(course.avg_confidence)}% avg. evidence score`
            : "No submissions yet"}
        </span>
        <Link
          to={ROUTES.STUDENT_COURSE_DETAIL.replace(":courseId", String(course.id))}
          className="inline-flex items-center gap-1.5 text-[13px] font-bold"
          style={{ color: colors.brand }}
        >
          View course <span aria-hidden="true">→</span>
        </Link>
      </div>
    </AppSurface>
  );
}

export default function StudentCoursesPage() {
  const [courses, setCourses] = useState<StudentManagedCourse[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadCourses() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.get<StudentCourseManagementResponse>(
          API_ROUTES.courses.manage,
        );
        if (mounted) setCourses(response.data.courses ?? []);
      } catch (err) {
        if (mounted) setError(getApiErrorMessage(err));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadCourses();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return courses;
    return courses.filter((course) =>
      [course.course_name, course.course_code, course.teacher_name]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [courses, search]);

  const totalSubmissions = courses.reduce((sum, course) => sum + course.submission_count, 0);
  const totalFeedback = courses.reduce((sum, course) => sum + course.feedback_count, 0);
  const activeCourses = courses.filter((course) => !course.is_archived).length;

  if (isLoading) return <LoadingState label="Loading your courses..." />;

  if (error) {
    return (
      <ErrorState
        title="Could not load courses"
        message={error}
        action={
          <ButtonLink to={ROUTES.DASHBOARD} variant="secondary">
            Back to Dashboard
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-8">
      <PageHeader
        eyebrow="Academic workspace"
        title="Course Management"
        description="Manage every course you have joined, review your course-linked submissions, and read teacher feedback without leaving your student workspace."
        action={
          <ButtonLink
            to={ROUTES.JOIN_COURSE}
            leftIcon={<InternalIcon name="course" size={16} />}
          >
            Join another course
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile icon="course" label="Joined courses" value={courses.length} detail="Active and archived enrollments" />
        <MetricTile icon="check" label="Active courses" value={activeCourses} detail="Available for new submissions" />
        <MetricTile icon="document" label="Course submissions" value={totalSubmissions} detail="Sessions submitted to courses" />
        <MetricTile icon="review" label="Feedback received" value={totalFeedback} detail="Teacher notes across submissions" />
      </div>

      {courses.length > 0 && (
        <AppSurface className="p-4">
          <label htmlFor="course-search" className="sr-only">
            Search joined courses
          </label>
          <div className="relative max-w-xl">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: colors.text.muted }}
            >
              <InternalIcon name="search" size={16} />
            </span>
            <input
              id="course-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by course, code, or instructor"
              className="h-10 w-full rounded-md border bg-white pl-10 pr-3 text-[13px] outline-none focus:ring-2"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
              }}
            />
          </div>
        </AppSurface>
      )}

      {courses.length === 0 ? (
        <EmptyState
          icon="course"
          title="You have not joined a course yet"
          description="Join a course using the invite code provided by your instructor. Once enrolled, this page will show course details, submissions, certificates, review status, and teacher feedback."
          action={<ButtonLink to={ROUTES.JOIN_COURSE}>Join a course</ButtonLink>}
        />
      ) : filteredCourses.length === 0 ? (
        <EmptyState
          icon="search"
          title="No matching courses"
          description="Try a different course name, course code, or instructor name."
          compact
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filteredCourses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
