// src/pages/teacher/TeacherDashboard.tsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { api } from "../../lib/api";
import { colors } from "../../styles/colors";
import { ROUTES } from "../../constants/routes";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface TeacherStats {
  total_students: number;
  total_submissions: number;
  avg_confidence: number;
  suspicious_pct: number;
  pending_reviews: number;
  total_courses: number;
}

interface RecentSession {
  id: number;
  title: string;
  student_name: string;
  student_id: string;
  course_name: string;
  classification: string;
  confidence: number;
  risk_level: string;
  review_status: string;
  date: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
type ReviewStatus = "PENDING" | "APPROVED" | "FLAGGED" | "UNDER_REVIEW";

const RISK_STYLES: Record<
  RiskLevel,
  { bg: string; text: string; border: string }
> = {
  LOW: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  MEDIUM: { bg: "#fefce8", text: "#a16207", border: "#fef08a" },
  HIGH: { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
};

const REVIEW_STYLES: Record<ReviewStatus, { bg: string; text: string }> = {
  PENDING: { bg: "#f8fafc", text: "#64748b" },
  APPROVED: { bg: "#f0fdf4", text: "#15803d" },
  FLAGGED: { bg: "#fef2f2", text: "#b91c1c" },
  UNDER_REVIEW: { bg: "#fefce8", text: "#a16207" },
};

function riskStyle(r: string) {
  return RISK_STYLES[r as RiskLevel] ?? RISK_STYLES.LOW;
}
function reviewStyle(r: string) {
  return REVIEW_STYLES[r as ReviewStatus] ?? REVIEW_STYLES.PENDING;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent = colors.text.primary,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      className="flex flex-col gap-2 p-5 bg-white rounded-xl border"
      style={{ borderColor: colors.surface[200] }}
    >
      <span
        className="text-[11px] font-bold uppercase tracking-widest"
        style={{ color: colors.text.secondary }}
      >
        {label}
      </span>
      <span
        className="text-[28px] font-bold tracking-tight"
        style={{ color: accent }}
      >
        {value}
      </span>
      {sub && (
        <span className="text-[12px]" style={{ color: colors.text.secondary }}>
          {sub}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function TeacherDashboard() {
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [sessions, setSessions] = useState<RecentSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, sessionsRes] = await Promise.all([
          api.get<TeacherStats>("/teacher/stats"),
          api.get<{ sessions: RecentSession[] }>("/teacher/sessions"),
        ]);
        setStats(statsRes.data);
        setSessions(sessionsRes.data.sessions.slice(0, 10));
      } catch (e) {
        console.error("Failed to load teacher dashboard:", e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

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

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <StatCard label="Courses" value={stats?.total_courses ?? 0} />
        <StatCard label="Students" value={stats?.total_students ?? 0} />
        <StatCard label="Submissions" value={stats?.total_submissions ?? 0} />
        <StatCard
          label="Avg Confidence"
          value={`${stats?.avg_confidence ?? 0}%`}
          accent="#0369a1"
        />
        <StatCard
          label="Suspicious"
          value={`${stats?.suspicious_pct ?? 0}%`}
          accent={stats && stats.suspicious_pct > 20 ? "#b91c1c" : "#a16207"}
        />
        <StatCard
          label="Pending Reviews"
          value={stats?.pending_reviews ?? 0}
          accent={
            stats && stats.pending_reviews > 0 ? "#b91c1c" : colors.text.primary
          }
          sub={
            stats && stats.pending_reviews > 0 ? "Needs attention" : "All clear"
          }
        />
      </div>

      {/* ── Recent submissions table ── */}
      <div
        className="bg-white rounded-xl border overflow-hidden"
        style={{ borderColor: colors.surface[200] }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: colors.surface[200] }}
        >
          <h2
            className="text-[14px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Recent Submissions
          </h2>
          <Link
            to="/teacher/submissions"
            className="text-[12px] font-medium"
            style={{ color: "#0369a1" }}
          >
            View all →
          </Link>
        </div>

        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span
              className="text-[13px]"
              style={{ color: colors.text.secondary }}
            >
              No submissions yet. Share a course invite code with your students.
            </span>
            <Link
              to={ROUTES.TEACHER_COURSES}
              className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white"
              style={{ background: "#0369a1" }}
            >
              Manage Courses
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr
                  style={{
                    borderBottom: `1px solid ${colors.surface[200]}`,
                    background: colors.surface[50],
                  }}
                >
                  {[
                    "Student",
                    "Course",
                    "Title",
                    "Classification",
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
                {sessions.map((s) => {
                  const rs = riskStyle(s.risk_level);
                  const rvs = reviewStyle(s.review_status);
                  return (
                    <tr
                      key={s.id}
                      className="border-b last:border-0 hover:bg-[#fafafa] transition-colors"
                      style={{ borderColor: colors.surface[100] }}
                    >
                      <td
                        className="px-4 py-3 font-medium"
                        style={{ color: colors.text.primary }}
                      >
                        <div>{s.student_name}</div>
                        <div
                          className="text-[11px] font-mono"
                          style={{ color: colors.text.secondary }}
                        >
                          {s.student_id}
                        </div>
                      </td>
                      <td
                        className="px-4 py-3"
                        style={{ color: colors.text.secondary }}
                      >
                        {s.course_name}
                      </td>
                      <td
                        className="px-4 py-3 max-w-[180px] truncate"
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
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border"
                          style={{
                            background: rs.bg,
                            color: rs.text,
                            borderColor: rs.border,
                          }}
                        >
                          {s.risk_level}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase"
                          style={{ background: rvs.bg, color: rvs.text }}
                        >
                          {s.review_status}
                        </span>
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
                          className="px-3 py-1.5 rounded-md text-[12px] font-semibold border transition-colors"
                          style={{
                            borderColor: colors.surface[200],
                            color: colors.text.primary,
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor =
                              "#0369a1";
                            (e.currentTarget as HTMLElement).style.color =
                              "#0369a1";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor =
                              colors.surface[200];
                            (e.currentTarget as HTMLElement).style.color =
                              colors.text.primary;
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
      </div>
    </div>
  );
}
