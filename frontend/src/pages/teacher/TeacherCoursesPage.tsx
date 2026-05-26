// src/pages/teacher/TeacherCoursesPage.tsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { api } from "../../lib/api";
import { colors } from "../../styles/colors";
import { ROUTES } from "../../constants/routes";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Course {
  id: number;
  course_name: string;
  course_code: string;
  invite_code: string;
  created_at: string | null;
  student_count: number;
  submission_count: number;
  avg_confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
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
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE COURSE MODAL
// ─────────────────────────────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
  onCreated: (course: Course) => void;
}

function CreateCourseModal({ onClose, onCreated }: CreateModalProps) {
  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Course | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!courseName.trim() || !courseCode.trim()) {
      setError("Both fields are required.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.post<Course>("/courses", {
        course_name: courseName.trim(),
        course_code: courseCode.trim().toUpperCase(),
      });
      setCreated(res.data);
      onCreated(res.data);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string } } };
      setError(ax.response?.data?.detail ?? "Failed to create course.");
    } finally {
      setIsLoading(false);
    }
  };

  const copyInvite = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(created.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const TEACHER_BLUE = "#0369a1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl border shadow-xl w-full max-w-[440px] mx-4"
        style={{ borderColor: colors.surface[200] }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: colors.surface[200] }}
        >
          <h2
            className="text-[15px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            {created ? "Course Created" : "New Course"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: colors.text.secondary }}
          >
            <XIcon />
          </button>
        </div>

        <div className="px-6 py-5">
          {!created ? (
            /* ── Creation form ── */
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-[13px] font-medium"
                  style={{ color: colors.text.primary }}
                >
                  Course Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Advanced Essay Writing"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  className="px-3.5 py-2.5 rounded-lg text-[13px] outline-none transition-all"
                  style={{
                    border: `1px solid ${colors.surface[200]}`,
                    background: colors.surface[50],
                    color: colors.text.primary,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = TEACHER_BLUE;
                    e.currentTarget.style.boxShadow = `0 0 0 1px ${TEACHER_BLUE}`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = colors.surface[200];
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-[13px] font-medium"
                  style={{ color: colors.text.primary }}
                >
                  Course Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. CS4050"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
                  className="px-3.5 py-2.5 rounded-lg text-[13px] font-mono outline-none transition-all"
                  style={{
                    border: `1px solid ${colors.surface[200]}`,
                    background: colors.surface[50],
                    color: colors.text.primary,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = TEACHER_BLUE;
                    e.currentTarget.style.boxShadow = `0 0 0 1px ${TEACHER_BLUE}`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = colors.surface[200];
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              {error && (
                <div
                  className="px-3 py-2.5 rounded-lg text-[12px] font-medium"
                  style={{ background: "#fef2f2", color: "#b91c1c" }}
                >
                  {error}
                </div>
              )}

              <button
                onClick={handleCreate}
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg text-[13px] font-semibold text-white transition-opacity mt-1"
                style={{
                  background: TEACHER_BLUE,
                  opacity: isLoading ? 0.7 : 1,
                }}
              >
                {isLoading ? "Creating..." : "Create Course"}
              </button>
            </div>
          ) : (
            /* ── Success: show invite code ── */
            <div className="flex flex-col gap-5 items-center text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "#f0fdf4" }}
              >
                <CheckIcon />
              </div>
              <div>
                <p
                  className="text-[15px] font-semibold mb-1"
                  style={{ color: colors.text.primary }}
                >
                  {created.course_name}
                </p>
                <p
                  className="text-[12px]"
                  style={{ color: colors.text.secondary }}
                >
                  Share the invite code with your students
                </p>
              </div>

              {/* Invite code block */}
              <div
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border"
                style={{ background: "#f0f9ff", borderColor: "#bae6fd" }}
              >
                <span
                  className="flex-1 font-mono text-[18px] font-bold tracking-widest"
                  style={{ color: TEACHER_BLUE }}
                >
                  {created.invite_code}
                </span>
                <button
                  onClick={copyInvite}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
                  style={{
                    background: copied ? "#f0fdf4" : "white",
                    color: copied ? "#15803d" : TEACHER_BLUE,
                    border: `1px solid ${copied ? "#bbf7d0" : "#bae6fd"}`,
                  }}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-lg text-[13px] font-semibold text-white"
                style={{ background: TEACHER_BLUE }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function TeacherCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const TEACHER_BLUE = "#0369a1";

  useEffect(() => {
    api
      .get<{ courses: Course[] }>("/courses")
      .then((r) => {
        setCourses(r.data.courses);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const handleCopy = async (course: Course) => {
    await navigator.clipboard.writeText(course.invite_code);
    setCopiedId(course.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreated = (course: Course) => {
    setCourses((prev) => [
      { ...course, student_count: 0, submission_count: 0, avg_confidence: 0 },
      ...prev,
    ]);
  };

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-[20px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Courses
          </h1>
          <p
            className="text-[13px] mt-0.5"
            style={{ color: colors.text.secondary }}
          >
            Create courses and share invite codes with students.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold text-white"
          style={{ background: TEACHER_BLUE }}
        >
          <PlusIcon />
          New Course
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <span
            className="text-[13px] font-mono tracking-widest uppercase"
            style={{ color: colors.text.secondary }}
          >
            Loading...
          </span>
        </div>
      ) : courses.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border"
          style={{ borderColor: colors.surface[200] }}
        >
          <p
            className="text-[15px] font-semibold mb-2"
            style={{ color: colors.text.primary }}
          >
            No courses yet
          </p>
          <p
            className="text-[13px] mb-6"
            style={{ color: colors.text.secondary }}
          >
            Create your first course to start reviewing student submissions.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold text-white"
            style={{ background: TEACHER_BLUE }}
          >
            <PlusIcon />
            Create First Course
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {courses.map((course) => (
            <div
              key={course.id}
              className="flex flex-col bg-white rounded-xl border overflow-hidden"
              style={{ borderColor: colors.surface[200] }}
            >
              {/* Card header */}
              <div className="px-5 pt-5 pb-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3
                    className="text-[15px] font-semibold leading-snug"
                    style={{ color: colors.text.primary }}
                  >
                    {course.course_name}
                  </h3>
                  <span
                    className="shrink-0 px-2 py-0.5 rounded-md text-[11px] font-bold font-mono"
                    style={{ background: "#f0f9ff", color: TEACHER_BLUE }}
                  >
                    {course.course_code}
                  </span>
                </div>

                {/* Stats row */}
                <div className="flex gap-4 mt-3">
                  {[
                    { label: "Students", value: course.student_count },
                    { label: "Submissions", value: course.submission_count },
                    { label: "Avg Conf.", value: `${course.avg_confidence}%` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex flex-col">
                      <span
                        className="text-[18px] font-bold"
                        style={{ color: colors.text.primary }}
                      >
                        {value}
                      </span>
                      <span
                        className="text-[10px] uppercase font-bold tracking-wider"
                        style={{ color: colors.text.secondary }}
                      >
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invite code row */}
              <div
                className="mx-4 mb-4 flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: "#f0f9ff", border: "1px solid #bae6fd" }}
              >
                <span
                  className="flex-1 font-mono text-[13px] font-bold tracking-widest truncate"
                  style={{ color: TEACHER_BLUE }}
                >
                  {course.invite_code}
                </span>
                <button
                  onClick={() => handleCopy(course)}
                  className="flex items-center gap-1 text-[11px] font-semibold shrink-0 transition-colors"
                  style={{
                    color: copiedId === course.id ? "#15803d" : TEACHER_BLUE,
                  }}
                >
                  {copiedId === course.id ? <CheckIcon /> : <CopyIcon />}
                  {copiedId === course.id ? "Copied" : "Copy"}
                </button>
              </div>

              {/* Footer actions */}
              <div
                className="flex border-t"
                style={{ borderColor: colors.surface[200] }}
              >
                <Link
                  to={`/teacher/courses/${course.id}`}
                  className="flex-1 py-3 text-center text-[12px] font-semibold transition-colors"
                  style={{ color: TEACHER_BLUE }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "#f0f9ff";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                  }}
                >
                  View Details →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <CreateCourseModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
