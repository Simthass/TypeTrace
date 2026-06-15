// frontend/src/pages/teacher/TeacherCoursesPage.tsx

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { api, getApiErrorMessage } from "../../lib/api";
import { ROUTES } from "../../constants/routes";
import { colors } from "../../styles/colors";
import {
  LoadingState,
  ErrorState,
  EmptyState,
} from "../../components/ui/AsyncState";
import { useToast } from "../../components/ui/ToastProvider";
import type {
  TeacherCourse,
  TeacherCoursesResponse,
} from "../../types/teacher";
import { API_ROUTES } from "../../constants/apiRoutes";

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CourseCard({ course }: { course: TeacherCourse }) {
  const [copied, setCopied] = useState(false);

  const copyInvite = async () => {
    await navigator.clipboard.writeText(course.invite_code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className="rounded-md border bg-white shadow-sm"
      style={{ borderColor: colors.surface[200] }}
    >
      <div
        className="border-b px-5 py-4"
        style={{ borderColor: colors.surface[200] }}
      >
        <h2
          className="text-[15px] font-semibold"
          style={{ color: colors.text.primary }}
        >
          {course.course_name}
        </h2>
        <p
          className="mt-1 text-[12px]"
          style={{ color: colors.text.secondary }}
        >
          {course.course_code} · Created {course.created_at}
        </p>
      </div>

      <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
        {[
          ["Students", course.student_count],
          ["Submissions", course.submission_count],
          ["Pending", course.pending_count],
          ["Avg WPM", course.avg_wpm],
          ["Confidence", `${course.avg_confidence}%`],
          ["Flagged", course.flagged_count],
        ].map(([label, value]) => (
          <div key={label}>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: colors.text.secondary }}
            >
              {label}
            </p>
            <p
              className="mt-1 text-[13px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      <div
        className="border-t px-5 py-4"
        style={{ borderColor: colors.surface[200] }}
      >
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: colors.text.secondary }}
        >
          Invite Code
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className="rounded-md border px-3 py-2 font-mono text-[13px] font-semibold"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          >
            {course.invite_code}
          </span>
          <button
            type="button"
            onClick={copyInvite}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[12px] font-semibold"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          >
            <CopyIcon />
            {copied ? "Copied" : "Copy"}
          </button>
          <Link
            to={ROUTES.TEACHER_COURSE_DETAIL.replace(
              ":courseId",
              String(course.id),
            )}
            className="rounded-md px-3 py-2 text-[12px] font-semibold text-white"
            style={{ background: colors.brand }}
          >
            Open Course
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function TeacherCoursesPage() {
  const { showToast } = useToast();
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

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

  const handleCreateCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanCourseName = courseName.trim();
    const cleanCourseCode = courseCode.trim().toUpperCase();

    if (!cleanCourseName || !cleanCourseCode) {
      showToast({
        type: "warning",
        title: "Missing information",
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

  if (isLoading && courses.length === 0) {
    return (
      <LoadingState
        title="Loading courses"
        message="Retrieving your course list."
      />
    );
  }

  if (apiError && courses.length === 0) {
    return (
      <ErrorState
        title="Could not load courses"
        message={apiError}
        action={
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: colors.brand }}
          >
            Retry
          </button>
        }
      />
    );
  }

  return (
    <div
      className="min-h-screen px-6 py-8"
      style={{ background: colors.surface[50] }}
    >
      <div className="mx-auto max-w-7xl">
        <div>
          <p
            className="text-[12px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: colors.text.secondary }}
          >
            Course management
          </p>
          <h1
            className="mt-2 text-2xl font-semibold"
            style={{ color: colors.text.primary }}
          >
            Courses
          </h1>
          <p
            className="mt-2 max-w-2xl text-[14px]"
            style={{ color: colors.text.secondary }}
          >
            Create courses, share invite codes, and monitor student submissions.
          </p>
        </div>

        <form
          onSubmit={handleCreateCourse}
          className="mt-6 rounded-md border bg-white p-5 shadow-sm"
          style={{ borderColor: colors.surface[200] }}
        >
          <h2
            className="text-[15px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Create new course
          </h2>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <input
              value={courseName}
              onChange={(event) => setCourseName(event.target.value)}
              placeholder="Course name"
              className="rounded-md border px-3 py-2 text-[13px] outline-none"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
              }}
            />
            <input
              value={courseCode}
              onChange={(event) => setCourseCode(event.target.value)}
              placeholder="Course code"
              className="rounded-md border px-3 py-2 text-[13px] outline-none"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
              }}
            />
            <button
              type="submit"
              disabled={isCreating}
              className="rounded-md px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
              style={{ background: colors.brand }}
            >
              {isCreating ? "Creating..." : "Create"}
            </button>
          </div>
        </form>

        {courses.length === 0 ? (
          <EmptyState
            title="No courses yet"
            message="Create your first course and share the invite code with students."
          />
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
