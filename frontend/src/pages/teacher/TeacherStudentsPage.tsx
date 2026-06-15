import { useEffect, useMemo, useState } from "react";
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
  TeacherStudent,
  TeacherStudentsResponse,
} from "../../types/teacher";
import { API_ROUTES } from "../../constants/apiRoutes";

function SearchIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export default function TeacherStudentsPage() {
  const { showToast } = useToast();
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [search, setSearch] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        showToast({
          type: "error",
          title: "Failed to load students",
          message,
        });
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadStudents();

    return () => {
      mounted = false;
    };
  }, [showToast]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return students;

    return students.filter((student) => {
      const haystack = [
        student.student_name,
        student.email,
        student.student_id,
        student.course_name,
        student.course_code,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return haystack.includes(query);
    });
  }, [students, search]);

  if (isLoading) {
    return (
      <LoadingState
        title="Loading students"
        message="Retrieving enrolled students."
      />
    );
  }

  if (apiError) {
    return (
      <ErrorState
        title="Could not load students"
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
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p
              className="text-[12px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: colors.text.secondary }}
            >
              Enrolled learners
            </p>
            <h1
              className="mt-2 text-2xl font-semibold"
              style={{ color: colors.text.primary }}
            >
              Students
            </h1>
            <p
              className="mt-2 max-w-2xl text-[14px]"
              style={{ color: colors.text.secondary }}
            >
              Monitor enrolled students, course participation, submission
              counts, and flagged work.
            </p>
          </div>

          <Link
            to={ROUTES.TEACHER_COURSES}
            className="rounded-md px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: colors.brand }}
          >
            Manage Courses
          </Link>
        </div>

        <div
          className="mt-6 rounded-md border bg-white p-4"
          style={{ borderColor: colors.surface[200] }}
        >
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: colors.text.secondary }}
            >
              <SearchIcon />
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search student, email, ID, or course..."
              className="w-full rounded-md border py-2 pl-9 pr-3 text-[13px] outline-none"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
              }}
            />
          </div>
          <p
            className="mt-3 text-[12px]"
            style={{ color: colors.text.secondary }}
          >
            Showing {filteredStudents.length} of {students.length}{" "}
            student-course enrollments
          </p>
        </div>

        {students.length === 0 ? (
          <EmptyState
            title="No students found"
            message="Share course invite codes so students can join."
          />
        ) : filteredStudents.length === 0 ? (
          <EmptyState
            title="No students match your search"
            message="Try a different search term."
          />
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {filteredStudents.map((student) => (
              <div
                key={`${student.id}-${student.course_id}`}
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
                    {student.student_name}
                  </h2>
                  <p
                    className="mt-1 text-[12px]"
                    style={{ color: colors.text.secondary }}
                  >
                    {student.student_id || "No student ID"} · {student.email}
                  </p>
                </div>

                <div className="grid gap-3 px-5 py-4 sm:grid-cols-4">
                  {[
                    ["Course", student.course_code],
                    ["Submissions", student.submission_count],
                    ["Pending", student.pending_count],
                    ["Flagged", student.flagged_count],
                    ["Avg WPM", student.avg_wpm],
                    ["Confidence", `${student.avg_confidence}%`],
                    ["Joined", student.joined_at],
                    ["Last Submit", student.last_submission_at],
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
                        {value || "—"}
                      </p>
                    </div>
                  ))}
                </div>

                <div
                  className="border-t px-5 py-4"
                  style={{ borderColor: colors.surface[200] }}
                >
                  <Link
                    to={ROUTES.TEACHER_COURSE_DETAIL.replace(
                      ":courseId",
                      String(student.course_id),
                    )}
                    className="rounded-md border px-3 py-2 text-[12px] font-semibold"
                    style={{
                      borderColor: colors.surface[200],
                      color: colors.text.primary,
                    }}
                  >
                    Open Course
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
