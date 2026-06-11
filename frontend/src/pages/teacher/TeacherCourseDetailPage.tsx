// frontend/src/pages/teacher/TeacherCourseDetailPage.tsx

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { api, getApiErrorMessage } from "../../lib/api";
import { brand, colors } from "../../styles/colors";
import { API_ROUTES } from "../../constants/apiRoutes";

interface TeacherCourse {
  id: number;
  course_name: string;
  course_code: string;
  invite_code: string;
  created_at: string;
  student_count: number;
  submission_count: number;
  pending_count: number;
  approved_count: number;
  flagged_count: number;
  avg_confidence: number;
  avg_wpm: number;
}

interface CourseStudent {
  id: string;
  student_name: string;
  email: string;
  student_id: string;
  joined_at: string;
  submission_count: number;
  avg_confidence: number;
  avg_wpm: number;
  last_submission_at: string;
}

interface CourseSubmission {
  id: number;
  title: string;
  student_name: string;
  student_id: string;
  classification_bucket: "HUMAN" | "SUSPICIOUS" | "SYNTHETIC" | "UNKNOWN";
  confidence: number;
  risk_level: string;
  review_status: string;
  created_at: string;
}

interface CourseDetailResponse {
  status: string;
  course: TeacherCourse;
  students: CourseStudent[];
  submissions: CourseSubmission[];
}

function badgeStyle(bucket: CourseSubmission["classification_bucket"]) {
  if (bucket === "HUMAN") {
    return {
      bg: brand.humanBg,
      text: brand.humanText,
      border: brand.humanAccent,
      label: "Human",
    };
  }

  if (bucket === "SUSPICIOUS") {
    return {
      bg: brand.suspiciousBg,
      text: brand.suspiciousText,
      border: brand.suspiciousAccent,
      label: "Review",
    };
  }

  if (bucket === "SYNTHETIC") {
    return {
      bg: brand.aiBg,
      text: brand.aiText,
      border: brand.aiAccent,
      label: "High Risk",
    };
  }

  return {
    bg: colors.surface[100],
    text: colors.text.secondary,
    border: colors.surface[200],
    label: "Unknown",
  };
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <div
      className="rounded-md border bg-white p-5"
      style={{ borderColor: colors.surface[200] }}
    >
      <p
        className="text-[11px] font-bold uppercase tracking-[0.16em]"
        style={{ color: colors.text.secondary }}
      >
        {label}
      </p>

      <p
        className="mt-3 text-3xl font-bold tracking-tight"
        style={{ color: colors.text.primary }}
      >
        {value}
      </p>

      <p className="mt-1 text-[13px]" style={{ color: colors.text.secondary }}>
        {description}
      </p>
    </div>
  );
}

export default function TeacherCourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();

  const [data, setData] = useState<CourseDetailResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadCourse() {
      if (!courseId) {
        setApiError("Course ID is missing.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setApiError(null);

      try {
        const response = await api.get<CourseDetailResponse>(
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

  if (isLoading) {
    return (
      <div
        className="rounded-md border bg-white px-5 py-12 text-center text-[13px]"
        style={{
          borderColor: colors.surface[200],
          color: colors.text.secondary,
        }}
      >
        Loading course workspace...
      </div>
    );
  }

  if (apiError || !data) {
    return (
      <div
        className="rounded-md border px-5 py-6"
        style={{
          borderColor: brand.aiAccent,
          background: brand.aiBg,
          color: brand.aiText,
        }}
      >
        {apiError || "Course could not be loaded."}
      </div>
    );
  }

  const { course, students, submissions } = data;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Link
            to={ROUTES.TEACHER_COURSES}
            className="text-[13px] font-semibold"
            style={{ color: colors.brand }}
          >
            Back to courses
          </Link>

          <h1
            className="mt-3 text-3xl font-bold tracking-tight"
            style={{ color: colors.text.primary }}
          >
            {course.course_name}
          </h1>

          <p
            className="mt-2 text-[14px]"
            style={{ color: colors.text.secondary }}
          >
            {course.course_code} · Invite code{" "}
            <span
              className="font-mono font-semibold"
              style={{ color: colors.text.primary }}
            >
              {course.invite_code}
            </span>
          </p>
        </div>

        <Link
          to={`${ROUTES.TEACHER_SUBMISSIONS}?course=${course.id}`}
          className="w-fit rounded-md px-4 py-2 text-[13px] font-semibold text-white"
          style={{ background: colors.brand }}
        >
          Review submissions
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Students"
          value={course.student_count}
          description="Enrolled in this course"
        />
        <MetricCard
          label="Submissions"
          value={course.submission_count}
          description="Writing sessions submitted"
        />
        <MetricCard
          label="Pending"
          value={course.pending_count}
          description="Awaiting teacher review"
        />
        <MetricCard
          label="Avg confidence"
          value={`${course.avg_confidence}%`}
          description="Across submitted sessions"
        />
      </div>

      <section
        className="rounded-md border bg-white"
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
            Recent submissions
          </h2>
        </div>

        {submissions.length === 0 ? (
          <p
            className="px-5 py-8 text-[13px]"
            style={{ color: colors.text.secondary }}
          >
            No submissions have been linked to this course yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left">
              <thead>
                <tr
                  className="border-b text-[11px] uppercase tracking-[0.14em]"
                  style={{
                    borderColor: colors.surface[200],
                    color: colors.text.secondary,
                  }}
                >
                  <th className="px-5 py-3">Document</th>
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">Verdict</th>
                  <th className="px-5 py-3">Confidence</th>
                  <th className="px-5 py-3">Review</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>

              <tbody>
                {submissions.map((submission) => {
                  const style = badgeStyle(submission.classification_bucket);

                  return (
                    <tr
                      key={submission.id}
                      className="border-b last:border-b-0"
                      style={{ borderColor: colors.surface[200] }}
                    >
                      <td className="px-5 py-4">
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
                          {submission.created_at}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p
                          className="text-[13px] font-medium"
                          style={{ color: colors.text.primary }}
                        >
                          {submission.student_name}
                        </p>
                        <p
                          className="text-[12px]"
                          style={{ color: colors.text.secondary }}
                        >
                          {submission.student_id}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className="rounded-md border px-2 py-1 text-[11px] font-bold"
                          style={{
                            background: style.bg,
                            color: style.text,
                            borderColor: style.border,
                          }}
                        >
                          {style.label}
                        </span>
                      </td>

                      <td
                        className="px-5 py-4 text-[13px] font-semibold"
                        style={{ color: colors.text.primary }}
                      >
                        {submission.confidence}%
                      </td>

                      <td
                        className="px-5 py-4 text-[12px] font-semibold"
                        style={{ color: colors.text.secondary }}
                      >
                        {submission.review_status}
                      </td>

                      <td className="px-5 py-4">
                        <Link
                          to={ROUTES.TEACHER_REVIEW.replace(
                            ":sessionId",
                            String(submission.id),
                          )}
                          className="rounded-md border px-3 py-1.5 text-[12px] font-semibold"
                          style={{
                            borderColor: colors.surface[200],
                            color: colors.text.primary,
                          }}
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        className="rounded-md border bg-white"
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
            Enrolled students
          </h2>
        </div>

        {students.length === 0 ? (
          <p
            className="px-5 py-8 text-[13px]"
            style={{ color: colors.text.secondary }}
          >
            No students have joined this course yet.
          </p>
        ) : (
          <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
            {students.map((student) => (
              <div
                key={student.id}
                className="rounded-md border p-4"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[50],
                }}
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
                  {student.email}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p
                      className="text-[11px] font-bold uppercase tracking-[0.14em]"
                      style={{ color: colors.text.secondary }}
                    >
                      Sessions
                    </p>
                    <p
                      className="mt-1 text-[15px] font-bold"
                      style={{ color: colors.text.primary }}
                    >
                      {student.submission_count}
                    </p>
                  </div>

                  <div>
                    <p
                      className="text-[11px] font-bold uppercase tracking-[0.14em]"
                      style={{ color: colors.text.secondary }}
                    >
                      Avg WPM
                    </p>
                    <p
                      className="mt-1 text-[15px] font-bold"
                      style={{ color: colors.text.primary }}
                    >
                      {student.avg_wpm}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
