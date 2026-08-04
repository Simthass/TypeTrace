import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import { api, getApiErrorMessage } from "../../lib/api";
import { API_ROUTES } from "../../constants/apiRoutes";
import { ROUTES } from "../../constants/routes";
import { useToast } from "../../components/ui/ToastContext";
import { colors, brand } from "../../styles/colors";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/AsyncState";
import { CardGridSkeleton } from "../../components/ui/Skeleton";
import { ResponsiveDialog } from "../../components/ui/ResponsiveDialog";

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface Course {
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

interface CoursesResponse {
  status: string;
  courses: Course[];
}

// ─── ICONS ───────────────────────────────────────────────────────────────────

function Icon({
  name,
  size = 16,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const paths: Record<string, React.ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    copy: (
      <>
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
    check: <path d="M20 6L9 17l-5-5" />,
    users: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
    alert: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </>
    ),
    arrowRight: <path d="M5 12h14M12 5l7 7-7 7" />,
    x: <path d="M18 6L6 18M6 6l12 12" />,
    bookOpen: (
      <>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function CourseCard({ course, index }: { course: Course; index: number }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(course.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.05,
        duration: 0.3,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="group relative flex flex-col overflow-hidden rounded-md border bg-white transition-all duration-200 hover:-translate-y-0.5"
      style={{
        borderColor: colors.surface[200],
        boxShadow: `0 4px 12px -4px ${colors.shadow}`,
      }}
    >
      {/* Header */}
      <div
        className="flex flex-col items-start gap-3 border-b p-5"
        style={{ borderColor: colors.surface[200] }}
      >
        <span
          className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
          style={{
            background: colors.brandSoft,
            borderColor: colors.surface[200],
            color: colors.brand,
          }}
        >
          {course.course_code}
        </span>
        <h2
          className="text-[17px] font-bold tracking-tight"
          style={{ color: colors.text.primary }}
        >
          {course.course_name}
        </h2>
      </div>

      {/* Metrics Grid */}
      <div
        className="grid grid-cols-2 gap-px"
        style={{ background: colors.surface[200] }}
      >
        <div
          className="flex flex-col p-4"
          style={{ background: colors.surface[50] }}
        >
          <span
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: colors.text.secondary }}
          >
            <Icon name="users" size={12} /> Students
          </span>
          <span
            className="mt-2 text-[20px] font-bold tabular-nums"
            style={{ color: colors.text.primary }}
          >
            {course.student_count}
          </span>
        </div>
        <div
          className="flex flex-col p-4"
          style={{ background: colors.surface[50] }}
        >
          <span
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: colors.text.secondary }}
          >
            <Icon name="activity" size={12} /> Submissions
          </span>
          <span
            className="mt-2 text-[20px] font-bold tabular-nums"
            style={{ color: colors.text.primary }}
          >
            {course.submission_count}
          </span>
        </div>
        <div
          className="flex flex-col p-4"
          style={{ background: colors.surface[50] }}
        >
          <span
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: colors.text.secondary }}
          >
            <Icon name="alert" size={12} /> Pending Review
          </span>
          <span
            className="mt-2 text-[20px] font-bold tabular-nums"
            style={{
              color:
                course.pending_count > 0
                  ? brand.suspiciousText
                  : colors.text.primary,
            }}
          >
            {course.pending_count}
          </span>
        </div>
        <div
          className="flex flex-col p-4"
          style={{ background: colors.surface[50] }}
        >
          <span
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: colors.text.secondary }}
          >
            Avg Confidence
          </span>
          <span
            className="mt-2 text-[20px] font-bold tabular-nums"
            style={{ color: colors.text.primary }}
          >
            {course.submission_count > 0
              ? `${Math.round(course.avg_confidence)}%`
              : "—"}
          </span>
        </div>
      </div>

      {/* Footer / Actions */}
      <div
        className="mt-auto flex flex-col items-stretch gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between"
        style={{
          borderColor: colors.surface[200],
          background: colors.surface[100],
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: colors.text.muted }}
          >
            Invite
          </span>
          <button
            onClick={handleCopy}
            className="group/btn flex min-w-0 max-w-full items-center gap-2 rounded-md border px-2 py-1 text-[12px] font-mono font-bold transition-colors"
            style={{
              borderColor: copied ? brand.humanAccent : colors.surface[200],
              background: copied ? brand.humanBg : colors.surface[50],
              color: copied ? brand.humanText : colors.text.primary,
            }}
            title="Copy invite code"
          >
            <span className="min-w-0 truncate">{course.invite_code}</span>
            <span className="sr-only" aria-live="polite">
              {copied ? "Invite code copied" : ""}
            </span>
            <Icon
              name={copied ? "check" : "copy"}
              size={12}
              className={
                copied
                  ? ""
                  : "opacity-50 transition-opacity group-hover/btn:opacity-100"
              }
            />
          </button>
        </div>

        <Link
          to={ROUTES.TEACHER_COURSE_DETAIL.replace(
            ":courseId",
            String(course.id),
          )}
          className="flex items-center gap-1.5 text-[13px] font-bold transition-colors"
          style={{ color: colors.brand }}
        >
          View{" "}
          <Icon
            name="arrowRight"
            size={14}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </motion.div>
  );
}

function CreateCourseModal({
  onClose,
  onSuccess,
  returnFocusRef,
}: {
  onClose: () => void;
  onSuccess: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!courseName.trim() || !courseCode.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await api.post(API_ROUTES.teacher.courses, {
        course_name: courseName.trim(),
        course_code: courseCode.trim().toUpperCase(),
      });

      showToast({
        type: "success",
        title: "Course Created",
        message: "Your new course is ready for students.",
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title="Create new course"
      returnFocusRef={returnFocusRef}
      panelClassName="max-h-[92dvh] sm:max-w-md"
      closeOnBackdrop={!isSubmitting}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div
          className="flex items-center justify-between border-b px-4 py-4 sm:px-5"
          style={{ borderColor: colors.surface[200] }}
        >
          <div>
            <h2
              className="text-[16px] font-bold tracking-tight"
              style={{ color: colors.text.primary }}
            >
              Create New Course
            </h2>
            <p
              className="mt-1 text-[12px]"
              style={{ color: colors.text.secondary }}
            >
              Add a course and generate a student invite code.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="touch-target flex shrink-0 items-center justify-center rounded-md transition-colors hover:bg-surface-100 disabled:opacity-50"
            style={{ color: colors.text.secondary }}
            aria-label="Close create course dialog"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="scroll-region min-h-0 flex-1 overflow-y-auto p-4 safe-bottom sm:p-5"
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="teacher-course-name"
                className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider"
                style={{ color: colors.text.secondary }}
              >
                Course Name
              </label>
              <input
                id="teacher-course-name"
                type="text"
                value={courseName}
                onChange={(event) => setCourseName(event.target.value)}
                placeholder="e.g. Advanced Software Engineering"
                className="h-11 w-full rounded-md border px-3 text-[14px] outline-none transition-colors focus:ring-2"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[50],
                  color: colors.text.primary,
                }}
                autoFocus
                autoComplete="off"
                disabled={isSubmitting}
                required
              />
            </div>

            <div>
              <label
                htmlFor="teacher-course-code"
                className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wider"
                style={{ color: colors.text.secondary }}
              >
                Course Code
              </label>
              <input
                id="teacher-course-code"
                type="text"
                value={courseCode}
                onChange={(event) =>
                  setCourseCode(event.target.value.toUpperCase())
                }
                placeholder="e.g. CS-401"
                className="h-11 w-full rounded-md border px-3 text-[14px] uppercase outline-none transition-colors focus:ring-2"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[50],
                  color: colors.text.primary,
                }}
                autoComplete="off"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-md border px-3 py-2 text-[13px]"
              style={{
                background: brand.aiBg,
                borderColor: brand.aiAccent,
                color: brand.aiText,
              }}
            >
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!courseName.trim() || !courseCode.trim() || isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Course"}
            </Button>
          </div>
        </form>
      </motion.div>
    </ResponsiveDialog>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────

export default function TeacherCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const createCourseButtonRef = useRef<HTMLButtonElement>(null);

  const fetchCourses = async () => {
    try {
      setApiError(null);
      const response = await api.get<CoursesResponse>(
        API_ROUTES.teacher.courses,
      );
      setCourses(response.data.courses);
    } catch (err) {
      setApiError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchCourses();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (searchParams.get("createCourse") !== "1") return;

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("createCourse");
    setSearchParams(nextSearchParams, { replace: true });

    const timer = window.setTimeout(() => {
      setIsModalOpen(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [searchParams, setSearchParams]);

  return (
    <div className="teacher-page max-w-[1200px] space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p
            className="text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: colors.brand }}
          >
            Academic Organization
          </p>
          <h1
            className="mt-2 text-3xl font-bold tracking-tight"
            style={{ color: colors.text.primary }}
          >
            Courses
          </h1>
          <p
            className="mt-2 max-w-2xl text-[14px] leading-relaxed"
            style={{ color: colors.text.secondary }}
          >
            Manage your academic modules, distribute invite codes to your
            students, and monitor behavioral evidence submissions across
            classes.
          </p>
        </div>
        <div className="w-full shrink-0 sm:w-auto">
          <Button
            ref={createCourseButtonRef}
            variant="primary"
            onClick={() => setIsModalOpen(true)}
            leftIcon={<Icon name="plus" />}
          >
            Create course
          </Button>
        </div>
      </div>

      {/* Content Section */}
      {isLoading ? (
        <CardGridSkeleton cards={6} />
      ) : apiError ? (
        <ErrorState
          title="Failed to load courses"
          message={apiError}
          action={<Button onClick={fetchCourses}>Try Again</Button>}
        />
      ) : courses.length === 0 ? (
        <EmptyState
          title="No courses created yet"
          message="Create your first academic course to generate an invite code. Students will use this code to link their writing sessions to your module."
          action={
            <Button
              variant="primary"
              onClick={() => setIsModalOpen(true)}
              leftIcon={<Icon name="plus" />}
            >
              Create your first course
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 xl:gap-5">
          {courses.map((course, index) => (
            <CourseCard key={course.id} course={course} index={index} />
          ))}
        </div>
      )}

      {/* Creation Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <CreateCourseModal
            onClose={() => setIsModalOpen(false)}
            onSuccess={fetchCourses}
            returnFocusRef={createCourseButtonRef}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
