// frontend/src/pages/teacher/TeacherCoursesPage.tsx

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { api, getApiErrorMessage } from "../../lib/api";
import { ROUTES } from "../../constants/routes";
import { colors, brand } from "../../styles/colors";
import type {
  TeacherCourse,
  TeacherCourseDetailResponse,
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
            to={`/teacher/courses/${course.id}`}
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

function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const [data, setData] = useState<TeacherCourseDetailResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadCourse() {
      setIsLoading(true);
      setApiError(null);

      try {
        const response = await api.get<TeacherCourseDetailResponse>(
          API_ROUTES.teacher.courseDetail(courseId),
        );
        if (!mounted) return;
        setData(response.data);
      } catch (error) {
        if (!mounted) return;
        setApiError(getApiErrorMessage(error));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadCourse();

    return () => {
      mounted = false;
    };
  }, [courseId]);

  return (
    <div
      className="min-h-screen px-6 py-8"
      style={{ background: colors.surface[50] }}
    >
      <div className="mx-auto max-w-7xl">
        <Link
          to={ROUTES.TEACHER_COURSES}
          className="text-[13px] font-semibold"
          style={{ color: colors.brand }}
        >
          Back to courses
        </Link>

        {apiError && (
          <div
            className="mt-6 rounded-md border px-4 py-3 text-[13px]"
            style={{
              borderColor: brand.aiAccent,
              background: brand.aiBg,
              color: brand.aiText,
            }}
          >
            {apiError}
          </div>
        )}

        {isLoading ? (
          <div
            className="mt-6 rounded-md border bg-white px-5 py-10 text-center text-[13px]"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.secondary,
            }}
          >
            Loading course...
          </div>
        ) : data ? (
          <>
            <div
              className="mt-4 rounded-md border bg-white p-5 shadow-sm"
              style={{ borderColor: colors.surface[200] }}
            >
              <h1
                className="text-2xl font-semibold"
                style={{ color: colors.text.primary }}
              >
                {data.course.course_name}
              </h1>
              <p
                className="mt-2 text-[14px]"
                style={{ color: colors.text.secondary }}
              >
                {data.course.course_code} · Invite code{" "}
                {data.course.invite_code}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                {[
                  ["Students", data.course.student_count],
                  ["Submissions", data.course.submission_count],
                  ["Pending Reviews", data.course.pending_count],
                  ["Avg Confidence", `${data.course.avg_confidence}%`],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-md border px-3 py-2"
                    style={{ borderColor: colors.surface[200] }}
                  >
                    <p
                      className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                      style={{ color: colors.text.secondary }}
                    >
                      {label}
                    </p>
                    <p
                      className="mt-1 text-[14px] font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div
                className="rounded-md border bg-white p-5 shadow-sm"
                style={{ borderColor: colors.surface[200] }}
              >
                <h2
                  className="text-[15px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  Enrolled students
                </h2>

                <div className="mt-4 space-y-3">
                  {data.students.length ? (
                    data.students.map((student) => (
                      <div
                        key={student.id}
                        className="rounded-md border px-3 py-3"
                        style={{ borderColor: colors.surface[200] }}
                      >
                        <p
                          className="text-[13px] font-semibold"
                          style={{ color: colors.text.primary }}
                        >
                          {student.student_name}
                        </p>
                        <p
                          className="mt-1 text-[12px]"
                          style={{ color: colors.text.secondary }}
                        >
                          {student.student_id} · {student.email}
                        </p>
                        <p
                          className="mt-2 text-[12px]"
                          style={{ color: colors.text.secondary }}
                        >
                          {student.submission_count} submissions ·{" "}
                          {student.avg_confidence}% avg confidence
                        </p>
                      </div>
                    ))
                  ) : (
                    <p
                      className="text-[13px]"
                      style={{ color: colors.text.secondary }}
                    >
                      No students joined yet.
                    </p>
                  )}
                </div>
              </div>

              <div
                className="rounded-md border bg-white p-5 shadow-sm"
                style={{ borderColor: colors.surface[200] }}
              >
                <h2
                  className="text-[15px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  Latest submissions
                </h2>

                <div className="mt-4 space-y-3">
                  {data.submissions.length ? (
                    data.submissions.map((submission) => (
                      <div
                        key={submission.id}
                        className="rounded-md border px-3 py-3"
                        style={{ borderColor: colors.surface[200] }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p
                              className="text-[13px] font-semibold"
                              style={{ color: colors.text.primary }}
                            >
                              {submission.title}
                            </p>
                            <p
                              className="mt-1 text-[12px]"
                              style={{ color: colors.text.secondary }}
                            >
                              {submission.student_name} ·{" "}
                              {submission.created_at}
                            </p>
                          </div>
                          <Link
                            to={`/teacher/review/${submission.id}`}
                            className="text-[12px] font-semibold"
                            style={{ color: colors.brand }}
                          >
                            Review
                          </Link>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p
                      className="text-[13px]"
                      style={{ color: colors.text.secondary }}
                    >
                      No submissions yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function TeacherCoursesPage() {
  const { courseId } = useParams<{ courseId?: string }>();

  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const loadCourses = async () => {
    setIsLoading(true);
    setApiError(null);

    try {
      const response = await api.get<TeacherCoursesResponse>(
        API_ROUTES.teacher.courses,
      );
      setCourses(response.data.courses || []);
    } catch (error) {
      setApiError(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!courseId) loadCourses();
  }, [courseId]);

  if (courseId) {
    return <CourseDetail />;
  }

  const handleCreateCourse = async (event: FormEvent) => {
    event.preventDefault();

    if (!courseName.trim() || !courseCode.trim()) {
      setApiError("Course name and course code are required.");
      return;
    }

    setIsCreating(true);
    setApiError(null);
    setSuccessMsg(null);

    try {
      await api.post(API_ROUTES.teacher.courses, {
        course_name: courseName.trim(),
        course_code: courseCode.trim(),
      });

      setCourseName("");
      setCourseCode("");
      setSuccessMsg("Course created successfully.");
      await loadCourses();
    } catch (error) {
      setApiError(getApiErrorMessage(error));
    } finally {
      setIsCreating(false);
    }
  };

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

        {apiError && (
          <div
            className="mt-4 rounded-md border px-4 py-3 text-[13px]"
            style={{
              borderColor: brand.aiAccent,
              background: brand.aiBg,
              color: brand.aiText,
            }}
          >
            {apiError}
          </div>
        )}

        {successMsg && (
          <div
            className="mt-4 rounded-md border px-4 py-3 text-[13px]"
            style={{
              borderColor: brand.humanAccent,
              background: brand.humanBg,
              color: brand.humanText,
            }}
          >
            {successMsg}
          </div>
        )}

        {isLoading ? (
          <div
            className="mt-6 rounded-md border bg-white px-5 py-10 text-center text-[13px]"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.secondary,
            }}
          >
            Loading courses...
          </div>
        ) : courses.length === 0 ? (
          <div
            className="mt-6 rounded-md border bg-white px-5 py-10 text-center"
            style={{ borderColor: colors.surface[200] }}
          >
            <h2
              className="text-[15px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              No courses yet
            </h2>
            <p
              className="mt-2 text-[13px]"
              style={{ color: colors.text.secondary }}
            >
              Create your first course and share the invite code with students.
            </p>
          </div>
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
