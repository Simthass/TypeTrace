// src/pages/teacher/TeacherStudentsPage.tsx
// =============================================================================
// Replaces the <PlaceholderPage> at /teacher/students.
// Shows every student enrolled in any of the teacher's courses with their
// aggregated stats and direct links to their submissions.
// =============================================================================

import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { colors } from "../../styles/colors";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Student {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  student_id: string | null;
  course_name: string;
  course_id: number;
  session_count: number;
  avg_confidence: number;
  last_active: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const TEACHER_BLUE = "#0369a1";

function confidenceColor(conf: number): string {
  if (conf >= 85) return "#15803d";
  if (conf >= 60) return "#a16207";
  return "#b91c1c";
}

// ─────────────────────────────────────────────────────────────────────────────
// ICON
// ─────────────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<number | "ALL">("ALL");

  useEffect(() => {
    api
      .get<{ students: Student[] }>("/teacher/students")
      .then((r) => setStudents(r.data.students))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  // Unique courses for the filter dropdown
  const courses = useMemo(() => {
    const seen = new Map<number, string>();
    students.forEach((s) => seen.set(s.course_id, s.course_name));
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [students]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (courseFilter !== "ALL" && s.course_id !== courseFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !s.first_name.toLowerCase().includes(q) &&
          !s.last_name.toLowerCase().includes(q) &&
          !s.email.toLowerCase().includes(q) &&
          !(s.student_id ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [students, courseFilter, search]);

  // Aggregate stats
  const totalStudents = new Set(students.map((s) => s.user_id)).size;
  const totalSubmissions = students.reduce((a, s) => a + s.session_count, 0);
  const avgConf =
    students.length > 0
      ? (
          students
            .filter((s) => s.session_count > 0)
            .reduce((a, s) => a + s.avg_confidence, 0) /
          Math.max(students.filter((s) => s.session_count > 0).length, 1)
        ).toFixed(1)
      : "—";
  const noSubmissions = students.filter((s) => s.session_count === 0).length;

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-[20px] font-semibold"
          style={{ color: colors.text.primary }}
        >
          Students
        </h1>
        <p
          className="text-[13px] mt-0.5"
          style={{ color: colors.text.secondary }}
        >
          All students enrolled in your courses, with their submission activity.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total Students", value: totalStudents },
          { label: "Total Submissions", value: totalSubmissions },
          {
            label: "Avg Confidence",
            value: `${avgConf}%`,
            accent: TEACHER_BLUE,
          },
          {
            label: "No Submissions",
            value: noSubmissions,
            accent: noSubmissions > 0 ? "#a16207" : colors.text.primary,
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

      {/* Filters */}
      <div
        className="flex flex-wrap gap-3 items-center mb-4 p-4 bg-white rounded-xl border"
        style={{ borderColor: colors.surface[200] }}
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <span
            className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: colors.text.secondary }}
          >
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search name, email, student ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-3 rounded-lg text-[13px] outline-none border"
            style={{
              borderColor: colors.surface[200],
              background: colors.surface[50],
              color: colors.text.primary,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = TEACHER_BLUE;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = colors.surface[200];
            }}
          />
        </div>

        {/* Course filter */}
        <select
          value={courseFilter}
          onChange={(e) =>
            setCourseFilter(
              e.target.value === "ALL" ? "ALL" : Number(e.target.value),
            )
          }
          className="h-9 px-3 rounded-lg text-[13px] outline-none border"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[50],
            color: colors.text.primary,
          }}
        >
          <option value="ALL">All Courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <span
          className="text-[12px] ml-auto"
          style={{ color: colors.text.secondary }}
        >
          {filtered.length} student{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div
        className="bg-white rounded-xl border overflow-hidden"
        style={{ borderColor: colors.surface[200] }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <span
              className="text-[13px] font-mono tracking-widest uppercase"
              style={{ color: colors.text.secondary }}
            >
              Loading...
            </span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p
              className="text-[14px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              {students.length === 0
                ? "No students enrolled yet"
                : "No students match your search"}
            </p>
            {students.length === 0 && (
              <p
                className="text-[13px]"
                style={{ color: colors.text.secondary }}
              >
                Share a course invite code to get started.
              </p>
            )}
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
                    "Course",
                    "Submissions",
                    "Avg Confidence",
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
                {filtered.map((s, idx) => (
                  <tr
                    key={`${s.user_id}-${s.course_id}-${idx}`}
                    className="border-b last:border-0 hover:bg-[#fafafa] transition-colors"
                    style={{ borderColor: colors.surface[100] }}
                  >
                    {/* Student name + email */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                          style={{ background: TEACHER_BLUE }}
                        >
                          {s.first_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
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
                        </div>
                      </div>
                    </td>

                    {/* Student ID */}
                    <td
                      className="px-4 py-3 font-mono text-[12px]"
                      style={{ color: colors.text.secondary }}
                    >
                      {s.student_id ?? "—"}
                    </td>

                    {/* Course */}
                    <td className="px-4 py-3">
                      <Link
                        to={`/teacher/courses/${s.course_id}`}
                        className="px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono transition-colors"
                        style={{ background: "#f0f9ff", color: TEACHER_BLUE }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background =
                            "#e0f2fe";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background =
                            "#f0f9ff";
                        }}
                      >
                        {s.course_name}
                      </Link>
                    </td>

                    {/* Submission count */}
                    <td className="px-4 py-3">
                      {s.session_count === 0 ? (
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold border"
                          style={{
                            background: "#fefce8",
                            color: "#a16207",
                            borderColor: "#fef08a",
                          }}
                        >
                          None
                        </span>
                      ) : (
                        <span
                          className="font-semibold"
                          style={{ color: colors.text.primary }}
                        >
                          {s.session_count}
                        </span>
                      )}
                    </td>

                    {/* Avg confidence */}
                    <td className="px-4 py-3 font-mono font-semibold">
                      {s.session_count > 0 ? (
                        <span
                          style={{ color: confidenceColor(s.avg_confidence) }}
                        >
                          {s.avg_confidence}%
                        </span>
                      ) : (
                        <span style={{ color: colors.text.secondary }}>—</span>
                      )}
                    </td>

                    {/* Last active */}
                    <td
                      className="px-4 py-3 text-[12px]"
                      style={{ color: colors.text.secondary }}
                    >
                      {s.last_active}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <Link
                        to={`/teacher/submissions?student=${s.user_id}&course=${s.course_id}`}
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
