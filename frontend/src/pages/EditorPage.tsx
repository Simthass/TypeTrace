// frontend/src/pages/EditorPage.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ROUTES } from "../constants/routes";
import { useKeystrokeCapture } from "../hooks/useKeystrokeCapture";
import { api, getApiErrorMessage } from "../lib/api";
import { useToast } from "../components/ui/ToastProvider";
import { useAuthStore } from "../store/authStore";
import { brand, colors } from "../styles/colors";

// ─── Constants ────────────────────────────────────────────────────────────────

const MINIMUM_KEYSTROKES = 30;

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrolledCourse {
  id: number;
  course_name: string;
  course_code: string;
}

interface AnalysisResult {
  classification: string;
  confidence: number;
  certificate_id?: string | null;
  document_hash?: string | null;
  session_id?: number | null;
  kill_switch_triggered?: boolean;
  kill_switch_reason?: string | null;
  stats: {
    keystrokes: number;
    deletions: number;
    pauses: number;
    wpm: number;
    avgIki: number;
    sessionSeconds: number;
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function countWords(value: string): number {
  const clean = value.trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getResultStyle(classification: string) {
  const n = classification.toUpperCase();
  if (n === "HUMAN")
    return {
      label: "Human Writing Pattern",
      sublabel: "Behavioral markers consistent with human authorship",
      bg: brand.humanBg,
      text: brand.humanText,
      accent: brand.humanAccent,
      barColor: colors.green,
    };
  if (n === "SUSPICIOUS")
    return {
      label: "Review Recommended",
      sublabel: "Some behavioral anomalies detected",
      bg: brand.suspiciousBg,
      text: brand.suspiciousText,
      accent: brand.suspiciousAccent,
      barColor: colors.amber,
    };
  return {
    label: "High Risk Pattern",
    sublabel: "Behavioral markers inconsistent with human authorship",
    bg: brand.aiBg,
    text: brand.aiText,
    accent: brand.aiAccent,
    barColor: colors.red,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Single stat row used inside the sidebar telemetry panel */
function StatRow({
  label,
  value,
  highlight = false,
  accent = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between py-[9px]"
      style={{
        borderBottom: `1px solid ${colors.surface[200]}`,
      }}
    >
      <span
        className="text-[12px] font-medium"
        style={{ color: colors.text.secondary }}
      >
        {label}
      </span>
      <span
        className="text-[13px] font-bold tabular-nums"
        style={{
          color: accent
            ? colors.brand
            : highlight
              ? colors.text.primary
              : colors.text.primary,
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** Section divider label used inside sidebar */
function SidebarLabel({ children }: { children: string }) {
  return (
    <p
      className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em]"
      style={{ color: colors.text.muted }}
    >
      {children}
    </p>
  );
}

/** Animated capture bar — the signature element.
 *  A thin bar below the textarea header that grows as keystrokes accumulate
 *  toward the MINIMUM_KEYSTROKES threshold, then pulses green when ready.
 */
function CaptureBar({
  keystrokes,
  ready,
  active,
}: {
  keystrokes: number;
  ready: boolean;
  active: boolean;
}) {
  const pct = Math.min(100, (keystrokes / MINIMUM_KEYSTROKES) * 100);

  return (
    <div
      className="relative h-[3px] w-full overflow-hidden"
      style={{ background: colors.surface[200] }}
      title={
        ready
          ? "Capture threshold reached — ready to analyze"
          : `${keystrokes}/${MINIMUM_KEYSTROKES} keystrokes captured`
      }
    >
      <div
        className="absolute left-0 top-0 h-full transition-all duration-500 ease-out"
        style={{
          width: `${pct}%`,
          background: ready
            ? colors.green
            : active
              ? colors.brand
              : colors.surface[300],
        }}
      />
      {/* Pulse indicator when actively typing */}
      {active && !ready && (
        <div
          className="absolute right-0 top-0 h-full w-[3px] animate-pulse"
          style={{ background: colors.brand, marginLeft: `${pct}%` }}
        />
      )}
    </div>
  );
}

/** Inline save state badge — top of editor */
function SaveIndicator({ state }: { state: "saved" | "saving" | "unsaved" }) {
  const cfg = {
    saved: {
      dot: colors.green,
      label: "Saved",
      text: colors.text.muted,
    },
    saving: {
      dot: colors.amber,
      label: "Saving",
      text: colors.text.muted,
    },
    unsaved: {
      dot: colors.amber,
      label: "Unsaved",
      text: colors.text.muted,
    },
  }[state];

  return (
    <div className="flex items-center gap-[6px]">
      <span
        className="inline-block h-[7px] w-[7px] rounded-full"
        style={{
          background: cfg.dot,
          animation:
            state === "saving" ? "pulse 1s ease-in-out infinite" : "none",
        }}
      />
      <span className="text-[12px] font-medium" style={{ color: cfg.text }}>
        {cfg.label}
      </span>
    </div>
  );
}

/** Course selector modal */
function CourseSelectorModal({
  courses,
  selectedCourseId,
  onSelect,
  onCancel,
  onConfirm,
  isSubmitting,
}: {
  courses: EnrolledCourse[];
  selectedCourseId: number | null;
  onSelect: (id: number | null) => void;
  onCancel: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        style={{ background: "rgba(15, 23, 42, 0.5)" }}
        onClick={onCancel}
        aria-label="Close"
      />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-[520px] rounded-xl border bg-white"
        style={{
          borderColor: colors.surface[200],
          boxShadow: `0 32px 80px -16px rgba(15,23,42,0.22), 0 0 0 1px ${colors.surface[200]}`,
        }}
      >
        {/* Header */}
        <div
          className="border-b px-6 py-5"
          style={{ borderColor: colors.surface[200] }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ color: colors.brand }}
          >
            Link evidence trail
          </p>
          <h2
            className="mt-1 text-[20px] font-bold tracking-[-0.03em]"
            style={{ color: colors.text.primary }}
          >
            Where does this session belong?
          </h2>
          <p
            className="mt-2 text-[13px] leading-[1.6]"
            style={{ color: colors.text.secondary }}
          >
            Linking to a course lets your teacher review this session's
            behavioral evidence if needed.
          </p>
        </div>

        {/* Options */}
        <div className="px-6 py-4 space-y-2">
          {/* Personal option */}
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="group w-full rounded-lg border px-4 py-3 text-left transition-all duration-150 hover:border-[${colors.brand}]"
            style={{
              borderColor:
                selectedCourseId === null ? colors.brand : colors.surface[200],
              background:
                selectedCourseId === null
                  ? colors.brandSoft
                  : colors.surface[50],
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p
                  className="text-[13px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  Personal session
                </p>
                <p
                  className="mt-[2px] text-[12px]"
                  style={{ color: colors.text.secondary }}
                >
                  Stored in your private workspace only
                </p>
              </div>
              {selectedCourseId === null && (
                <div
                  className="flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ background: colors.brand }}
                >
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path
                      d="M1 4L3.5 6.5L9 1"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
          </button>

          {/* Course options */}
          {courses.map((course) => (
            <button
              key={course.id}
              type="button"
              onClick={() => onSelect(course.id)}
              className="w-full rounded-lg border px-4 py-3 text-left transition-all duration-150"
              style={{
                borderColor:
                  selectedCourseId === course.id
                    ? colors.brand
                    : colors.surface[200],
                background:
                  selectedCourseId === course.id
                    ? colors.brandSoft
                    : colors.surface[50],
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p
                    className="text-[13px] font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {course.course_name}
                  </p>
                  <p
                    className="mt-[2px] text-[12px] font-mono"
                    style={{ color: colors.text.muted }}
                  >
                    {course.course_code}
                  </p>
                </div>
                {selectedCourseId === course.id && (
                  <div
                    className="flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ background: colors.brand }}
                  >
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div
          className="flex items-center justify-end gap-3 border-t px-6 py-4"
          style={{ borderColor: colors.surface[200] }}
        >
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border px-4 py-[9px] text-[13px] font-semibold transition-all duration-150 hover:brightness-95"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
              background: colors.surface[100],
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg px-5 py-[9px] text-[13px] font-semibold text-white transition-all duration-150 hover:brightness-110 disabled:opacity-50"
            style={{ background: colors.brand }}
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                >
                  <circle
                    cx="7"
                    cy="7"
                    r="5.5"
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M7 1.5A5.5 5.5 0 0112.5 7"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Analyzing…
              </>
            ) : (
              "Run analysis"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Result panel shown in sidebar after analysis */
function ResultPanel({
  result,
  onNewSession,
}: {
  result: AnalysisResult;
  onNewSession: () => void;
}) {
  const style = getResultStyle(result.classification);
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-0">
      {/* Classification verdict */}
      <div
        className="rounded-lg border p-5"
        style={{
          borderColor: style.accent,
          background: style.bg,
        }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ color: style.text, opacity: 0.7 }}
        >
          Authorship verdict
        </p>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p
              className="text-[3rem] font-extrabold leading-none tracking-[-0.04em]"
              style={{ color: style.text }}
            >
              {Math.round(result.confidence)}%
            </p>
            <p
              className="mt-2 text-[13px] font-bold"
              style={{ color: style.text }}
            >
              {style.label}
            </p>
            <p
              className="mt-1 text-[11px] leading-[1.5]"
              style={{ color: style.text, opacity: 0.75 }}
            >
              {style.sublabel}
            </p>
          </div>

          {/* Confidence arc indicator */}
          <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0">
            <circle
              cx="26"
              cy="26"
              r="22"
              fill="none"
              stroke={style.accent}
              strokeOpacity="0.2"
              strokeWidth="4"
            />
            <circle
              cx="26"
              cy="26"
              r="22"
              fill="none"
              stroke={style.barColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 22}`}
              strokeDashoffset={`${2 * Math.PI * 22 * (1 - result.confidence / 100)}`}
              transform="rotate(-90 26 26)"
            />
          </svg>
        </div>

        {result.kill_switch_triggered && result.kill_switch_reason && (
          <div
            className="mt-3 rounded-md border px-3 py-2 text-[11px] leading-[1.6]"
            style={{
              borderColor: style.accent,
              color: style.text,
              background: "rgba(0,0,0,0.04)",
            }}
          >
            {result.kill_switch_reason}
          </div>
        )}
      </div>

      {/* Behavioral stats */}
      <div className="mt-5">
        <SidebarLabel>Behavioral metrics</SidebarLabel>
        <div className="divide-y" style={{ borderColor: colors.surface[200] }}>
          <StatRow
            label="Words per minute"
            value={result.stats.wpm}
            highlight
          />
          <StatRow
            label="Avg. inter-key interval"
            value={`${result.stats.avgIki} ms`}
          />
          <StatRow label="Total keystrokes" value={result.stats.keystrokes} />
          <StatRow label="Deletions" value={result.stats.deletions} />
          <StatRow label="Detected pauses" value={result.stats.pauses} />
          <StatRow
            label="Session duration"
            value={formatDuration(result.stats.sessionSeconds)}
          />
        </div>
      </div>

      {/* Document hash */}
      {result.document_hash && (
        <div className="mt-5">
          <SidebarLabel>Document fingerprint</SidebarLabel>
          <div
            className="rounded-lg border px-3 py-3"
            style={{
              borderColor: colors.surface[200],
              background: colors.surface[100],
            }}
          >
            <p
              className="break-all font-mono text-[10px] leading-[1.7]"
              style={{ color: colors.text.muted }}
            >
              {result.document_hash}
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-5 flex flex-col gap-2">
        {result.session_id && (
          <button
            type="button"
            onClick={() =>
              navigate(
                ROUTES.REPLAY.replace(":sessionId", String(result.session_id)),
              )
            }
            className="flex w-full items-center justify-between rounded-lg border px-4 py-[11px] text-[13px] font-semibold transition-all duration-150 hover:brightness-95"
            style={{
              borderColor: colors.brand,
              background: colors.brandSoft,
              color: colors.brand,
            }}
          >
            <span>View replay audit</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden
            >
              <path
                d="M3 7h8M7.5 3.5L11 7l-3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {result.certificate_id && (
          <button
            type="button"
            onClick={() => navigate(`/verify/${result.certificate_id}`)}
            className="flex w-full items-center justify-between rounded-lg border px-4 py-[11px] text-[13px] font-semibold transition-all duration-150 hover:brightness-95"
            style={{
              borderColor: colors.surface[200],
              background: colors.surface[50],
              color: colors.text.primary,
            }}
          >
            <span>Verify certificate</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden
            >
              <path
                d="M3 7h8M7.5 3.5L11 7l-3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        <button
          type="button"
          onClick={onNewSession}
          className="w-full rounded-lg border px-4 py-[11px] text-[13px] font-medium transition-all duration-150 hover:brightness-95"
          style={{
            borderColor: colors.surface[200],
            color: colors.text.secondary,
            background: colors.surface[100],
          }}
        >
          Start new session
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function EditorPage() {
  const { showToast } = useToast();
  const { user } = useAuthStore();

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourse[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved">(
    "saved",
  );

  // Track whether user is actively typing (for CaptureBar pulse)
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    keystrokeLogRef,
    liveStats,
    handleKeyDown: baseHandleKeyDown,
    handleKeyUp,
    handlePaste,
    getStats,
    resetCapture,
  } = useKeystrokeCapture({ text });

  const wordCount = useMemo(() => countWords(text), [text]);
  const charCount = text.length;
  const canAnalyze =
    liveStats.keystrokes >= MINIMUM_KEYSTROKES && text.trim().length > 0;
  const keystrokePct = Math.min(
    100,
    Math.round((liveStats.keystrokes / MINIMUM_KEYSTROKES) * 100),
  );

  const fullName =
    `${user?.first_name ?? "Student"} ${user?.last_name ?? ""}`.trim();
  const initials =
    `${user?.first_name?.[0] ?? "S"}${user?.last_name?.[0] ?? ""}`.toUpperCase();

  // Wrap keydown to also set isTyping
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    baseHandleKeyDown(e);
    setIsTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1200);
  };

  // Load enrolled courses
  useEffect(() => {
    let mounted = true;
    api
      .get("/courses/enrolled")
      .then((r) => {
        if (mounted) setEnrolledCourses(r.data?.courses ?? []);
      })
      .catch(() => {
        if (mounted) setEnrolledCourses([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Autosave state
  useEffect(() => {
    if (!text && !title) return;

    const savingTimer = window.setTimeout(() => {
      setSaveState("saving");
    }, 0);

    const savedTimer = window.setTimeout(() => {
      setSaveState("saved");
    }, 800);

    return () => {
      window.clearTimeout(savingTimer);
      window.clearTimeout(savedTimer);
    };
  }, [text, title]);

  // Cleanup typing timeout
  useEffect(
    () => () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    },
    [],
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  const openAnalyzeModal = () => {
    if (!text.trim()) {
      showToast({
        type: "error",
        title: "Nothing to analyze",
        message: "Write something in the editor before running analysis.",
      });
      return;
    }
    if (liveStats.keystrokes < MINIMUM_KEYSTROKES) {
      showToast({
        type: "warning",
        title: "More typing required",
        message: `Need ${MINIMUM_KEYSTROKES} keystrokes minimum. Currently at ${liveStats.keystrokes}.`,
      });
      return;
    }
    setShowCourseModal(true);
  };

  const confirmSubmit = async () => {
    setIsSubmitting(true);
    try {
      const finalStats = getStats();
      const response = await api.post("/sessions/analyze", {
        title: title.trim() || "Untitled Document",
        text_content: text,
        keystroke_array: keystrokeLogRef.current,
        stats: finalStats,
        course_id: selectedCourseId,
      });
      setAnalysisResult({
        classification: response.data.classification,
        confidence: response.data.confidence_score,
        stats: finalStats,
        kill_switch_triggered: response.data.kill_switch_triggered,
        kill_switch_reason: response.data.kill_switch_reason,
        certificate_id: response.data.certificate_id,
        document_hash: response.data.document_hash,
        session_id: response.data.session_id,
      });
      setShowCourseModal(false);
      showToast({
        type: "success",
        title: "Analysis complete",
        message: "Your behavioral evidence trail has been processed.",
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "Analysis failed",
        message: getApiErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const newSession = () => {
    setTitle("");
    setText("");
    setSelectedCourseId(null);
    setAnalysisResult(null);
    resetCapture();
    showToast({
      type: "info",
      title: "New session started",
      message: "Begin writing to build a new behavioral evidence trail.",
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{ background: colors.surface[100] }}
    >
      {/* ── Top Header ─────────────────────────────────────────────────────── */}
      <header
        className="z-40 flex h-[52px] shrink-0 items-center justify-between border-b bg-white px-4"
        style={{ borderColor: colors.surface[200] }}
      >
        {/* Left: Logo + session name */}
        <div className="flex min-w-0 items-center gap-3">
          <Link to={ROUTES.DASHBOARD} className="shrink-0">
            <img
              src="/Logo.png"
              alt="TypeTrace"
              className="h-[26px] w-auto object-contain"
            />
          </Link>

          <div
            className="hidden h-4 w-px shrink-0 sm:block"
            style={{ background: colors.surface[200] }}
          />

          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setSaveState("unsaved");
            }}
            placeholder="Untitled document"
            className="min-w-0 max-w-[280px] border-none bg-transparent text-[14px] font-semibold outline-none placeholder:text-[14px]"
            style={{
              color: colors.text.primary,
            }}
            aria-label="Document title"
          />
        </div>

        {/* Right: status + actions */}
        <div className="flex items-center gap-4">
          <SaveIndicator state={saveState} />

          {/* Capture status pill */}
          <div
            className="hidden items-center gap-[6px] sm:flex"
            title={`${liveStats.keystrokes} of ${MINIMUM_KEYSTROKES} keystrokes captured`}
          >
            <div
              className="h-[6px] w-[48px] overflow-hidden rounded-full"
              style={{ background: colors.surface[200] }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${keystrokePct}%`,
                  background: canAnalyze ? colors.green : colors.brand,
                }}
              />
            </div>
            <span
              className="text-[11px] font-medium tabular-nums"
              style={{ color: colors.text.muted }}
            >
              {canAnalyze
                ? "Ready"
                : `${liveStats.keystrokes}/${MINIMUM_KEYSTROKES}`}
            </span>
          </div>

          <div
            className="h-4 w-px"
            style={{ background: colors.surface[200] }}
          />

          <Link
            to={ROUTES.DASHBOARD}
            className="rounded-md border px-3 py-[6px] text-[12px] font-semibold transition-all duration-150 hover:brightness-95"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.secondary,
              background: colors.surface[50],
            }}
          >
            Dashboard
          </Link>

          <button
            type="button"
            onClick={openAnalyzeModal}
            disabled={!canAnalyze || isSubmitting}
            className="flex items-center gap-2 rounded-md px-4 py-[7px] text-[12px] font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
            style={{ background: colors.brand }}
          >
            {/* Dot pulse when ready */}
            {canAnalyze && (
              <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-white opacity-80" />
            )}
            Analyze session
          </button>
        </div>
      </header>

      {/* ── Body: Editor + Sidebar ──────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Editor column */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Editor toolbar strip */}
          <div
            className="flex h-[40px] shrink-0 items-center justify-between border-b px-5"
            style={{
              borderColor: colors.surface[200],
              background: colors.surface[50],
            }}
          >
            <div className="flex items-center gap-5">
              <span
                className="text-[11px] font-medium tabular-nums"
                style={{ color: colors.text.muted }}
              >
                {wordCount.toLocaleString()} words
              </span>
              <span
                className="text-[11px] tabular-nums"
                style={{ color: colors.text.muted }}
              >
                {charCount.toLocaleString()} chars
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Live typing signal */}
              {isTyping && (
                <div className="flex items-center gap-[5px]">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="inline-block h-[5px] w-[5px] rounded-full"
                      style={{
                        background: colors.brand,
                        animation: `bounce 0.8s ease-in-out ${i * 0.12}s infinite`,
                      }}
                    />
                  ))}
                </div>
              )}
              <span
                className="text-[11px] font-medium tabular-nums"
                style={{
                  color: isTyping ? colors.brand : colors.text.muted,
                }}
              >
                {isTyping ? "Capturing" : "Idle"}
              </span>
            </div>
          </div>

          {/* Capture progress bar — the signature element */}
          <CaptureBar
            keystrokes={liveStats.keystrokes}
            ready={canAnalyze}
            active={isTyping}
          />

          {/* Textarea */}
          <div className="flex-1 overflow-y-auto bg-white px-6 pt-6 pb-24 sm:px-10 md:px-16 lg:px-24">
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setSaveState("unsaved");
              }}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onPaste={handlePaste}
              placeholder="Start writing here. TypeTrace quietly captures your behavioral evidence in the background — timing, pauses, deletions, and rhythm that only a human writer produces."
              className="h-full min-h-[480px] w-full resize-none border-none bg-transparent text-[16px] leading-[1.85] outline-none placeholder:text-[15px]"
              style={{
                color: colors.text.primary,
              }}
              aria-label="Writing workspace"
              spellCheck
            />
          </div>
        </main>

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside
          className="hidden w-[300px] shrink-0 flex-col overflow-y-auto border-l xl:flex"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[50],
          }}
        >
          {analysisResult ? (
            /* Result view */
            <div className="p-5">
              <ResultPanel result={analysisResult} onNewSession={newSession} />
            </div>
          ) : (
            /* Live telemetry view */
            <>
              {/* Session identity */}
              <div
                className="border-b p-5"
                style={{ borderColor: colors.surface[200] }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white"
                    style={{ background: colors.brand }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p
                      className="truncate text-[13px] font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      {fullName}
                    </p>
                    <p
                      className="truncate text-[11px]"
                      style={{ color: colors.text.muted }}
                    >
                      {user?.email}
                    </p>
                  </div>
                </div>

                {/* Capture status */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.16em]"
                      style={{ color: colors.text.muted }}
                    >
                      Capture threshold
                    </span>
                    <span
                      className="text-[11px] font-bold tabular-nums"
                      style={{
                        color: canAnalyze ? colors.green : colors.brand,
                      }}
                    >
                      {canAnalyze
                        ? "Ready"
                        : `${liveStats.keystrokes} / ${MINIMUM_KEYSTROKES}`}
                    </span>
                  </div>
                  <div
                    className="h-[4px] w-full overflow-hidden rounded-full"
                    style={{ background: colors.surface[200] }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${keystrokePct}%`,
                        background: canAnalyze ? colors.green : colors.brand,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Live writing metrics */}
              <div
                className="border-b px-5 pt-5 pb-4"
                style={{ borderColor: colors.surface[200] }}
              >
                <SidebarLabel>Writing</SidebarLabel>
                <StatRow
                  label="Words"
                  value={wordCount.toLocaleString()}
                  highlight
                />
                <StatRow
                  label="Characters"
                  value={charCount.toLocaleString()}
                />
                <StatRow label="WPM" value={liveStats.wpm} accent />
                <StatRow
                  label="Duration"
                  value={formatDuration(liveStats.sessionSeconds)}
                />
              </div>

              {/* Live behavioral metrics */}
              <div
                className="border-b px-5 pt-5 pb-4"
                style={{ borderColor: colors.surface[200] }}
              >
                <SidebarLabel>Behavioral signal</SidebarLabel>
                <StatRow
                  label="Keystrokes"
                  value={liveStats.keystrokes}
                  highlight
                />
                <StatRow label="Deletions" value={liveStats.deletions} />
                <StatRow label="Pauses (>1s)" value={liveStats.pauses} />
                <StatRow
                  label="Avg IKI"
                  value={`${liveStats.avgIki} ms`}
                  accent
                />
              </div>

              {/* Evidence trail info */}
              <div className="p-5">
                <SidebarLabel>What's being captured</SidebarLabel>
                <div className="space-y-3">
                  {[
                    {
                      icon: (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <rect
                            x="1"
                            y="1"
                            width="10"
                            height="10"
                            rx="2"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                          <path
                            d="M4 6h4M6 4v4"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                          />
                        </svg>
                      ),
                      label: "Keystroke timing",
                      detail: "Dwell & flight times per key",
                    },
                    {
                      icon: (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <circle
                            cx="6"
                            cy="6"
                            r="4.5"
                            stroke="currentColor"
                            strokeWidth="1.2"
                          />
                          <path
                            d="M6 3.5V6l1.5 1.5"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                          />
                        </svg>
                      ),
                      label: "Pause detection",
                      detail: "Cognitive breaks >1 second",
                    },
                    {
                      icon: (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <path
                            d="M2 9l2-2 2 2 4-6"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ),
                      label: "Revision patterns",
                      detail: "Deletions and corrections",
                    },
                    {
                      icon: (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <path
                            d="M3 6a3 3 0 016 0"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M1 6h10"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            strokeOpacity="0.4"
                          />
                          <circle cx="6" cy="9" r="1.5" fill="currentColor" />
                        </svg>
                      ),
                      label: "Document hash",
                      detail: "Tamper-proof content fingerprint",
                    },
                  ].map(({ icon, label, detail }) => (
                    <div key={label} className="flex items-start gap-3">
                      <div
                        className="mt-[2px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md"
                        style={{
                          background: colors.brandSoft,
                          color: colors.brand,
                        }}
                      >
                        {icon}
                      </div>
                      <div>
                        <p
                          className="text-[12px] font-semibold"
                          style={{ color: colors.text.primary }}
                        >
                          {label}
                        </p>
                        <p
                          className="text-[11px]"
                          style={{ color: colors.text.muted }}
                        >
                          {detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ── Bottom status bar ────────────────────────────────────────────────── */}
      <div
        className="z-40 flex h-[36px] shrink-0 items-center justify-between border-t bg-white px-5"
        style={{ borderColor: colors.surface[200] }}
      >
        {/* Left: session breadcrumb */}
        <div
          className="flex items-center gap-2 text-[11px]"
          style={{ color: colors.text.muted }}
        >
          <Link
            to={ROUTES.DASHBOARD}
            className="font-medium hover:underline"
            style={{ color: colors.text.muted }}
          >
            Dashboard
          </Link>
          <span>/</span>
          <span style={{ color: colors.text.secondary }}>Editor</span>
          {title && (
            <>
              <span>/</span>
              <span
                className="max-w-[180px] truncate font-medium"
                style={{ color: colors.text.primary }}
              >
                {title}
              </span>
            </>
          )}
        </div>

        {/* Right: live stat chips */}
        <div className="flex items-center gap-[18px]">
          {[
            { label: "Words", value: wordCount },
            { label: "Keys", value: liveStats.keystrokes },
            { label: "WPM", value: liveStats.wpm },
            { label: "Time", value: formatDuration(liveStats.sessionSeconds) },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-[5px]">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: colors.text.muted }}
              >
                {label}
              </span>
              <span
                className="text-[11px] font-bold tabular-nums"
                style={{ color: colors.text.primary }}
              >
                {value}
              </span>
            </div>
          ))}

          {/* Capture state indicator */}
          <div
            className="flex items-center gap-[5px] rounded-md border px-[8px] py-[3px]"
            style={{
              borderColor: canAnalyze ? colors.green : colors.surface[200],
              background: canAnalyze ? colors.mintTint : colors.surface[100],
            }}
          >
            <span
              className="h-[5px] w-[5px] rounded-full"
              style={{
                background: canAnalyze ? colors.green : colors.surface[300],
              }}
            />
            <span
              className="text-[10px] font-bold"
              style={{
                color: canAnalyze ? brand.humanText : colors.text.muted,
              }}
            >
              {canAnalyze ? "Ready to analyze" : "Capturing"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Course selector modal ────────────────────────────────────────────── */}
      {showCourseModal && (
        <CourseSelectorModal
          courses={enrolledCourses}
          selectedCourseId={selectedCourseId}
          onSelect={setSelectedCourseId}
          onCancel={() => setShowCourseModal(false)}
          onConfirm={confirmSubmit}
          isSubmitting={isSubmitting}
        />
      )}

      {/* ── Global keyframe styles ────────────────────────────────────────────── */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-3px); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
