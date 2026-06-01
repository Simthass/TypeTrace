import React, { useEffect, useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import { colors } from "../../styles/colors";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Session {
  id: number;
  title: string;
  student_name: string;
  student_id: string;
  course_name: string;
  course_id: number;
  classification: string;
  confidence: number;
  risk_level: string;
  review_status: string;
  date: string;
  wpm: number;
  duration: number;
}

interface Course {
  id: number;
  course_name: string;
  course_code: string;
  invite_code: string;
}

type RiskFilter = "ALL" | "HIGH" | "MEDIUM" | "LOW";
type StatusFilter = "ALL" | "PENDING" | "APPROVED" | "FLAGGED" | "UNDER_REVIEW";

// ─────────────────────────────────────────────────────────────────────────────
// BADGE HELPERS (unchanged from Part 2)
// ─────────────────────────────────────────────────────────────────────────────

const RISK_STYLE: Record<string, { bg: string; text: string; border: string }> =
  {
    HIGH: { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
    MEDIUM: { bg: "#fefce8", text: "#a16207", border: "#fef08a" },
    LOW: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  };
const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: "#f8fafc", text: "#64748b" },
  APPROVED: { bg: "#f0fdf4", text: "#15803d" },
  FLAGGED: { bg: "#fef2f2", text: "#b91c1c" },
  UNDER_REVIEW: { bg: "#fefce8", text: "#a16207" },
};

function RiskBadge({ level }: { level: string }) {
  const s = RISK_STYLE[level] ?? RISK_STYLE.LOW;
  return (
    <span
      className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border"
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
    >
      {level}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.PENDING;
  return (
    <span
      className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase"
      style={{ background: s.bg, color: s.text }}
    >
      {status.replace("_", " ")}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

const TEACHER_BLUE = "#0369a1";

export default function TeacherSubmissionsPage() {
  const [searchParams] = useSearchParams();

  // ← PART 5 FIX: read URL params on mount for pre-filtering
  const paramCourseId = searchParams.get("course")
    ? Number(searchParams.get("course"))
    : "ALL";
  const paramStudentId = searchParams.get("student") ?? "";

  const [sessions, setSessions] = useState<Session[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters — initialised from URL params
  const [search, setSearch] = useState<string>(paramStudentId ? "" : "");
  const [studentIdFilter] = useState<string>(paramStudentId);
  const [courseFilter, setCourseFilter] = useState<number | "ALL">(
    paramCourseId,
  );
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  useEffect(() => {
    Promise.all([
      api.get<{ sessions: Session[] }>("/teacher/sessions"),
      api.get<{ courses: Course[] }>("/courses"),
    ])
      .then(([sRes, cRes]) => {
        setSessions(sRes.data.sessions);
        setCourses(cRes.data.courses);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      // ← PART 5: student ID filter from URL param
      if (studentIdFilter && s.student_id !== studentIdFilter) return false;
      if (courseFilter !== "ALL" && s.course_id !== courseFilter) return false;
      if (riskFilter !== "ALL" && s.risk_level !== riskFilter) return false;
      if (statusFilter !== "ALL" && s.review_status !== statusFilter)
        return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !s.student_name.toLowerCase().includes(q) &&
          !s.title.toLowerCase().includes(q) &&
          !s.student_id.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [
    sessions,
    courseFilter,
    riskFilter,
    statusFilter,
    search,
    studentIdFilter,
  ]);

  // Derive context label for the active filter
  const contextLabel = useMemo(() => {
    if (studentIdFilter) {
      const student = sessions.find((s) => s.student_id === studentIdFilter);
      return student ? `Showing sessions for ${student.student_name}` : null;
    }
    if (courseFilter !== "ALL") {
      const course = courses.find((c) => c.id === courseFilter);
      return course ? `Filtered to ${course.course_name}` : null;
    }
    return null;
  }, [studentIdFilter, courseFilter, sessions, courses]);

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    cursor: "pointer",
    border: `1px solid ${active ? TEACHER_BLUE : colors.surface[200]}`,
    background: active ? "#f0f9ff" : "white",
    color: active ? TEACHER_BLUE : colors.text.secondary,
    transition: "all 0.15s",
  });

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-[20px] font-semibold"
          style={{ color: colors.text.primary }}
        >
          Submissions
        </h1>
        {contextLabel ? (
          <p
            className="text-[13px] mt-0.5 flex items-center gap-2"
            style={{ color: colors.text.secondary }}
          >
            {contextLabel}
            <button
              onClick={() => (window.location.href = "/teacher/submissions")}
              className="text-[11px] font-semibold underline"
              style={{ color: TEACHER_BLUE }}
            >
              Clear filter
            </button>
          </p>
        ) : (
          <p
            className="text-[13px] mt-0.5"
            style={{ color: colors.text.secondary }}
          >
            All student sessions across your courses.
          </p>
        )}
      </div>

      {/* Filters */}
      <div
        className="flex flex-wrap gap-3 items-center mb-5 p-4 bg-white rounded-xl border"
        style={{ borderColor: colors.surface[200] }}
      >
        <input
          type="text"
          placeholder="Search student, title, ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 rounded-lg text-[13px] outline-none border flex-1 min-w-[180px]"
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

        <select
          value={courseFilter}
          onChange={(e) =>
            setCourseFilter(
              e.target.value === "ALL" ? "ALL" : Number(e.target.value),
            )
          }
          className="px-3 py-2 rounded-lg text-[13px] outline-none border"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[50],
            color: colors.text.primary,
          }}
        >
          <option value="ALL">All Courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.course_name}
            </option>
          ))}
        </select>

        <div className="flex gap-1.5">
          {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map((r) => (
            <button
              key={r}
              style={filterBtnStyle(riskFilter === r)}
              onClick={() => setRiskFilter(r)}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {(
            ["ALL", "PENDING", "FLAGGED", "UNDER_REVIEW", "APPROVED"] as const
          ).map((r) => (
            <button
              key={r}
              style={filterBtnStyle(statusFilter === r)}
              onClick={() => setStatusFilter(r)}
            >
              {r.replace("_", " ")}
            </button>
          ))}
        </div>

        <span
          className="text-[12px] ml-auto"
          style={{ color: colors.text.secondary }}
        >
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
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
          <div className="flex items-center justify-center py-16">
            <span
              className="text-[13px]"
              style={{ color: colors.text.secondary }}
            >
              No submissions match your filters.
            </span>
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
                    "Course",
                    "Essay Title",
                    "Classification",
                    "WPM",
                    "Risk",
                    "Status",
                    "Date",
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
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b last:border-0 hover:bg-[#fafafa] transition-colors"
                    style={{ borderColor: colors.surface[100] }}
                  >
                    <td className="px-4 py-3">
                      <div
                        className="font-medium"
                        style={{ color: colors.text.primary }}
                      >
                        {s.student_name}
                      </div>
                      <div
                        className="text-[11px] font-mono"
                        style={{ color: colors.text.secondary }}
                      >
                        {s.student_id}
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 text-[12px]"
                      style={{ color: colors.text.secondary }}
                    >
                      {s.course_name}
                    </td>
                    <td
                      className="px-4 py-3 max-w-[160px] truncate font-medium"
                      style={{ color: colors.text.primary }}
                    >
                      {s.title}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="font-mono font-semibold text-[12px]"
                        style={{ color: colors.text.primary }}
                      >
                        {s.classification}
                      </span>
                      <span
                        className="ml-1 text-[11px]"
                        style={{ color: colors.text.secondary }}
                      >
                        {s.confidence}%
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 font-mono text-[12px]"
                      style={{ color: colors.text.secondary }}
                    >
                      {s.wpm}
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge level={s.risk_level} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.review_status} />
                    </td>
                    <td
                      className="px-4 py-3 text-[12px]"
                      style={{ color: colors.text.secondary }}
                    >
                      {s.date}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/teacher/review/${s.id}`}
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
                        Review →
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
