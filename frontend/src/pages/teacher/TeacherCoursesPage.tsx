// src/pages/teacher/TeacherCoursePage.tsx
// =============================================================================
// Single-course view: shows every enrolled student, their submission count
// for THIS course, avg confidence, and links to their sessions.
// =============================================================================

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../lib/api";
import { colors } from "../../styles/colors";
import { ROUTES } from "../../constants/routes";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface CourseInfo {
  id: number;
  course_name: string;
  course_code: string;
  invite_code: string;
}

interface CourseStudent {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  student_id: string;
  joined_at: string;
  submission_count: number;
  avg_confidence: number;
  last_submission: string;
  suspicious_count: number;
  pending_reviews: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────

function CopyIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

const TEACHER_BLUE = "#0369a1";

export default function TeacherCoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [students, setStudents] = useState<CourseStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!courseId) return;
    api
      .get<{ course: CourseInfo; students: CourseStudent[] }>(
        `/courses/${courseId}/students`,
      )
      .then((r) => {
        setCourse(r.data.course);
        setStudents(r.data.students);
      })
      .catch((e: unknown) => {
        const ax = e as { response?: { data?: { detail?: string } } };
        setError(ax.response?.data?.detail ?? "Failed to load course.");
      })
      .finally(() => setIsLoading(false));
  }, [courseId]);

  const handleCopyInvite = async () => {
    if (!course) return;
    await navigator.clipboard.writeText(course.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span
          className="text-[13px] font-mono tracking-widest uppercase"
          style={{ color: colors.text.secondary }}
        >
          Loading...
        </span>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-[14px]" style={{ color: "#b91c1c" }}>
          {error ?? "Course not found."}
        </p>
        <Link
          to={ROUTES.TEACHER_COURSES}
          className="text-[13px] font-semibold"
          style={{ color: TEACHER_BLUE }}
        >
          ← Back to Courses
        </Link>
      </div>
    );
  }

  const totalSubmissions = students.reduce(
    (sum, s) => sum + s.submission_count,
    0,
  );
  const pendingTotal = students.reduce((sum, s) => sum + s.pending_reviews, 0);
  const suspiciousTotal = students.reduce(
    (sum, s) => sum + s.suspicious_count,
    0,
  );
  const avgConf =
    students.length > 0
      ? (
          students.reduce((sum, s) => sum + s.avg_confidence, 0) /
          students.length
        ).toFixed(1)
      : "—";

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      {/* Breadcrumb */}
      <div
        className="flex items-center gap-2 text-[12px] mb-5"
        style={{ color: colors.text.secondary }}
      >
        <Link to={ROUTES.TEACHER_COURSES} className="hover:underline">
          Courses
        </Link>
        <span>›</span>
        <span style={{ color: colors.text.primary }}>{course.course_name}</span>
      </div>

      {/* Course header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1
              className="text-[20px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              {course.course_name}
            </h1>
            <span
              className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono"
              style={{ background: "#f0f9ff", color: TEACHER_BLUE }}
            >
              {course.course_code}
            </span>
          </div>
          <p
            className="text-[13px] mt-1"
            style={{ color: colors.text.secondary }}
          >
            {students.length} enrolled student{students.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Invite code */}
        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl border shrink-0"
          style={{ background: "#f0f9ff", borderColor: "#bae6fd" }}
        >
          <div>
            <div
              className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
              style={{ color: "#0284c7" }}
            >
              Invite Code
            </div>
            <div
              className="font-mono text-[15px] font-bold tracking-widest"
              style={{ color: TEACHER_BLUE }}
            >
              {course.invite_code}
            </div>
          </div>
          <button
            onClick={handleCopyInvite}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
            style={{
              background: copied ? "#f0fdf4" : "white",
              color: copied ? "#15803d" : TEACHER_BLUE,
              border: `1px solid ${copied ? "#bbf7d0" : "#bae6fd"}`,
            }}
          >
            <CopyIcon />
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Submissions", value: totalSubmissions },
          {
            label: "Avg Confidence",
            value: `${avgConf}%`,
            accent: TEACHER_BLUE,
          },
          {
            label: "Suspicious",
            value: suspiciousTotal,
            accent: suspiciousTotal > 0 ? "#b91c1c" : colors.text.primary,
          },
          {
            label: "Pending Reviews",
            value: pendingTotal,
            accent: pendingTotal > 0 ? "#a16207" : colors.text.primary,
          },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            className="bg-white rounded-xl border p-4"
            style={{ borderColor: colors.surface[200] }}
          >
            <div
              className="text-[10px] font-bold uppercase tracking-widest mb-1"
              style={{ color: colors.text.secondary }}
            >
              {label}
            </div>
            <div
              className="text-[22px] font-bold"
              style={{ color: accent ?? colors.text.primary }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Students table */}
      <div
        className="bg-white rounded-xl border overflow-hidden"
        style={{ borderColor: colors.surface[200] }}
      >
        <div
          className="px-5 py-4 border-b flex items-center justify-between"
          style={{ borderColor: colors.surface[200] }}
        >
          <h2
            className="text-[14px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Enrolled Students
          </h2>
          <Link
            to={`/teacher/submissions?course=${course.id}`}
            className="text-[12px] font-semibold"
            style={{ color: TEACHER_BLUE }}
          >
            View all submissions →
          </Link>
        </div>

        {students.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p
              className="text-[14px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              No students enrolled yet
            </p>
            <p className="text-[13px]" style={{ color: colors.text.secondary }}>
              Share the invite code above with your students.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr
                  style={{
                    background: colors.surface[50],
                    borderBottom: `1px solid ${colors.surface[200]}`,
                  }}
                >
                  {[
                    "Student",
                    "Student ID",
                    "Joined",
                    "Submissions",
                    "Avg Conf.",
                    "Suspicious",
                    "Pending",
                    "Last Active",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest"
                      style={{ color: colors.text.secondary }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr
                    key={s.user_id}
                    className="border-b last:border-0 hover:bg-[#fafafa] transition-colors"
                    style={{ borderColor: colors.surface[100] }}
                  >
                    <td className="px-4 py-3">
                      <div
                        className="font-medium"
                        style={{ color: colors.text.primary }}
                      >
                        {s.first_name} {s.last_name}
                      </div>
                      <div
                        className="text-[11px]"
                        style={{ color: colors.text.secondary }}
                      >
                        {s.email}
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 font-mono text-[12px]"
                      style={{ color: colors.text.secondary }}
                    >
                      {s.student_id ?? "—"}
                    </td>
                    <td
                      className="px-4 py-3 text-[12px]"
                      style={{ color: colors.text.secondary }}
                    >
                      {s.joined_at}
                    </td>
                    <td
                      className="px-4 py-3 font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      {s.submission_count}
                    </td>
                    <td
                      className="px-4 py-3 font-mono font-semibold"
                      style={{
                        color:
                          s.avg_confidence > 80
                            ? "#15803d"
                            : s.avg_confidence > 50
                              ? "#a16207"
                              : colors.text.primary,
                      }}
                    >
                      {s.submission_count > 0 ? `${s.avg_confidence}%` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {s.suspicious_count > 0 ? (
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold border"
                          style={{
                            background: "#fef2f2",
                            color: "#b91c1c",
                            borderColor: "#fecaca",
                          }}
                        >
                          {s.suspicious_count}
                        </span>
                      ) : (
                        <span
                          className="text-[12px]"
                          style={{ color: "#15803d" }}
                        >
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.pending_reviews > 0 ? (
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold border"
                          style={{
                            background: "#fefce8",
                            color: "#a16207",
                            borderColor: "#fef08a",
                          }}
                        >
                          {s.pending_reviews}
                        </span>
                      ) : (
                        <span
                          className="text-[12px]"
                          style={{ color: "#15803d" }}
                        >
                          ✓
                        </span>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 text-[12px]"
                      style={{ color: colors.text.secondary }}
                    >
                      {s.last_submission}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/teacher/submissions?student=${s.user_id}&course=${course.id}`}
                        className="px-3 py-1.5 rounded-md text-[12px] font-semibold border transition-colors whitespace-nowrap"
                        style={{
                          borderColor: colors.surface[200],
                          color: colors.text.primary,
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor =
                            TEACHER_BLUE;
                          (e.currentTarget as HTMLElement).style.color =
                            TEACHER_BLUE;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.borderColor =
                            colors.surface[200];
                          (e.currentTarget as HTMLElement).style.color =
                            colors.text.primary;
                        }}
                      >
                        Sessions →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
