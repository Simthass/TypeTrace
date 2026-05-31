// src/pages/EditorPage.tsx
// =============================================================================
// Part 3: Added course selector — when a student ends a session, they are
// shown a modal to choose which enrolled course to submit it to (optional).
// The chosen course_id is sent to /sessions/analyze and stored in the DB,
// making it visible to the teacher of that course.
//
// ALL other logic is unchanged. Only the sections marked ← PART 3 are new.
// =============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";
import { api } from "../lib/api";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface KeystrokeEvent {
  key: string;
  keyCode: number;
  type: "keydown" | "keyup";
  timestamp: number;
  down_time: number;
  up_time: number | null;
  dwell_time: number | null;
  flight_time: number | null;
  documentLength: number;
  pastedText?: string;
}

interface SessionStats {
  wpm: number;
  keystrokes: number;
  deletions: number;
  pauses: number;
  avgIki: number;
  sessionSeconds: number;
}

interface AnalysisResult {
  classification: string;
  confidence: number;
  stats: SessionStats;
  advanced_stats?: {
    ht_mean?: number;
    ft_mean?: number;
    ft_entropy?: number;
    ft_autocorr?: number;
    burst_ratio?: number;
    pause_ratio?: number;
    net_wpm?: number;
  };
  kill_switch_triggered?: boolean;
  kill_switch_reason?: string;
  certificate_id?: string;
  document_hash?: string;
}

// ← PART 3: enrolled course type
interface EnrolledCourse {
  id: number;
  course_name: string;
  course_code: string;
}

// ─── OPTIONS ──────────────────────────────────────────────────────────────────

const FONT_OPTIONS = [
  { label: "Sans", value: "font-sans", desc: "Geist Sans" },
  { label: "Serif", value: "font-serif", desc: "Georgia" },
  { label: "Mono", value: "font-mono", desc: "Geist Mono" },
];

const SIZE_OPTIONS = [
  { label: "S", value: "text-[15px]", desc: "Small" },
  { label: "M", value: "text-[17px]", desc: "Medium" },
  { label: "L", value: "text-[19px]", desc: "Large" },
];

const LINE_OPTIONS = [
  { label: "Compact", value: "leading-[1.6]" },
  { label: "Comfortable", value: "leading-[1.9]" },
  { label: "Spacious", value: "leading-[2.3]" },
];

const WORD_GOALS = [250, 500, 750, 1000, 1500, 2000];

// ─── IKI WAVEFORM ─────────────────────────────────────────────────────────────

function IkiWaveform({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const offsetRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      if (!active) {
        ctx.beginPath();
        ctx.strokeStyle = colors.surface[200];
        ctx.lineWidth = 1.5;
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.strokeStyle = brand.action;
        ctx.lineWidth = 2;
        const freq = 0.04;
        const amp = H * 0.35;
        for (let x = 0; x <= W; x++) {
          const y =
            H / 2 +
            amp * Math.sin((x + offsetRef.current) * freq) +
            amp * 0.35 * Math.sin((x + offsetRef.current) * freq * 2.7);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        offsetRef.current += 2.2;
      }
      ctx.restore();
      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={36}
      style={{ display: "block", width: 80, height: 18 }}
    />
  );
}

// ─── SESSION TIMER ────────────────────────────────────────────────────────────

function useSessionTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const fmt = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return { seconds, fmt };
}

// ─── COURSE SELECTOR MODAL (← PART 3) ────────────────────────────────────────

interface CourseSelectorModalProps {
  courses: EnrolledCourse[];
  selectedCourseId: number | null;
  onSelect: (courseId: number | null) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

function CourseSelectorModal({
  courses,
  selectedCourseId,
  onSelect,
  onConfirm,
  onCancel,
  isSubmitting,
}: CourseSelectorModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl border shadow-xl w-full max-w-[420px] mx-4 overflow-hidden"
        style={{ borderColor: colors.surface[200] }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 border-b"
          style={{ borderColor: colors.surface[200] }}
        >
          <h2
            className="text-[15px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Submit Session
          </h2>
          <p
            className="text-[13px] mt-1"
            style={{ color: colors.text.secondary }}
          >
            Choose which course to submit this session to, or save it privately.
          </p>
        </div>

        <div className="px-6 py-4 flex flex-col gap-2">
          {/* "No course" option — personal/private session */}
          <button
            onClick={() => onSelect(null)}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 text-left transition-all"
            style={{
              borderColor:
                selectedCourseId === null
                  ? colors.text.primary
                  : colors.surface[200],
              background:
                selectedCourseId === null ? colors.surface[50] : "white",
            }}
          >
            <span
              className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
              style={{
                borderColor:
                  selectedCourseId === null
                    ? colors.text.primary
                    : colors.surface[200],
                background:
                  selectedCourseId === null
                    ? colors.text.primary
                    : "transparent",
              }}
            >
              {selectedCourseId === null && (
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </span>
            <div>
              <div
                className="text-[13px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                Save privately
              </div>
              <div
                className="text-[12px]"
                style={{ color: colors.text.secondary }}
              >
                Only visible to you — not submitted to any teacher
              </div>
            </div>
          </button>

          {/* Enrolled courses */}
          {courses.length > 0 && (
            <>
              <div
                className="text-[10px] font-bold uppercase tracking-widest px-1 pt-2"
                style={{ color: colors.text.secondary }}
              >
                Submit to a course
              </div>
              {courses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => onSelect(course.id)}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 text-left transition-all"
                  style={{
                    borderColor:
                      selectedCourseId === course.id
                        ? "#0369a1"
                        : colors.surface[200],
                    background:
                      selectedCourseId === course.id ? "#f0f9ff" : "white",
                  }}
                >
                  <span
                    className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                    style={{
                      borderColor:
                        selectedCourseId === course.id
                          ? "#0369a1"
                          : colors.surface[200],
                      background:
                        selectedCourseId === course.id
                          ? "#0369a1"
                          : "transparent",
                    }}
                  >
                    {selectedCourseId === course.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <div>
                    <div
                      className="text-[13px] font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      {course.course_name}
                    </div>
                    <div
                      className="text-[11px] font-mono"
                      style={{ color: "#0369a1" }}
                    >
                      {course.course_code}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}

          {courses.length === 0 && (
            <div
              className="px-4 py-3 rounded-xl text-[12px] text-center"
              style={{
                background: colors.surface[50],
                color: colors.text.secondary,
              }}
            >
              You're not enrolled in any courses yet.{" "}
              <Link
                to="/join-course"
                className="font-semibold"
                style={{ color: "#0369a1" }}
              >
                Join a course →
              </Link>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          className="px-6 py-4 flex gap-3 border-t"
          style={{ borderColor: colors.surface[200] }}
        >
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold border transition-colors"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.secondary,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-opacity"
            style={{
              background: colors.text.primary,
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting ? "Analyzing..." : "Submit Session"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EDITOR PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function EditorPage() {
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [fontClass, setFontClass] = useState("font-serif");
  const [sizeClass, setSizeClass] = useState("text-[17px]");
  const [lineClass, setLineClass] = useState("leading-[1.9]");
  const [focusMode, setFocusMode] = useState(false);
  const [wordGoal, setWordGoal] = useState(500);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );

  // ← PART 3: course selector state
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  // Biometric capture
  const keystrokeLog = useRef<KeystrokeEvent[]>([]);
  const activeKeys = useRef<{ [code: string]: number }>({});
  const lastKeydownTime = useRef<number | null>(null);
  const ikiValues = useRef<number[]>([]);

  const [stats, setStats] = useState<SessionStats>({
    wpm: 0,
    keystrokes: 0,
    deletions: 0,
    pauses: 0,
    avgIki: 0,
    sessionSeconds: 0,
  });

  const { seconds, fmt: timerFmt } = useSessionTimer();
  const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  const charCount = text.length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  // ← PART 3: fetch enrolled courses on mount
  useEffect(() => {
    api
      .get<{ courses: EnrolledCourse[] }>("/courses/enrolled")
      .then((r) => setEnrolledCourses(r.data.courses))
      .catch(() => setEnrolledCourses([]));
  }, []);

  // Auto-save indicator
  useEffect(() => {
    const t = setInterval(() => {
      if (text.length > 0) setLastSaved(new Date());
    }, 30_000);
    return () => clearInterval(t);
  }, [text, title]);

  // Stats update every 3 seconds
  useEffect(() => {
    if (seconds > 0 && seconds % 3 === 0) {
      const ikis = ikiValues.current;
      const avgIki =
        ikis.length > 0
          ? Math.round(ikis.reduce((a, b) => a + b, 0) / ikis.length)
          : 0;
      const wpm = seconds > 0 ? Math.round((wordCount / seconds) * 60) : 0;
      const deletions = keystrokeLog.current.filter(
        (k) => k.key === "Backspace" || k.key === "Delete",
      ).length;
      const pauses = ikis.filter((v) => v > 1000).length;
      setStats({
        wpm,
        keystrokes: keystrokeLog.current.filter((k) => k.type === "keydown")
          .length,
        deletions,
        pauses,
        avgIki,
        sessionSeconds: seconds,
      });
    }
  }, [seconds, text.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const now = Date.now();
      if (e.repeat) return;
      let flightTime: number | null = null;
      if (lastKeydownTime.current !== null) {
        flightTime = now - lastKeydownTime.current;
        if (flightTime < 5000) ikiValues.current.push(flightTime);
      }
      lastKeydownTime.current = now;
      activeKeys.current[e.code] = now;
      keystrokeLog.current.push({
        key: e.key,
        keyCode: e.keyCode,
        type: "keydown",
        timestamp: now,
        down_time: now,
        up_time: null,
        dwell_time: null,
        flight_time: flightTime,
        documentLength: text.length,
      });
      setIsTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1200);
    },
    [text.length],
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const now = Date.now();
      const downTime = activeKeys.current[e.code];
      if (downTime) {
        const dwellTime = now - downTime;
        delete activeKeys.current[e.code];
        for (let i = keystrokeLog.current.length - 1; i >= 0; i--) {
          const ev = keystrokeLog.current[i];
          if (
            ev.type === "keydown" &&
            ev.key === e.key &&
            ev.dwell_time === null
          ) {
            ev.dwell_time = dwellTime;
            ev.up_time = now;
            break;
          }
        }
      }
    },
    [],
  );

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setText(e.target.value);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData("text");
    if (pastedText.length > 20) {
      const now = Date.now();
      keystrokeLog.current.push({
        key: "__PASTE_EVENT__",
        keyCode: -1,
        type: "keydown",
        timestamp: now,
        down_time: now,
        up_time: now,
        dwell_time: 0,
        flight_time: 0,
        documentLength: text.length,
        pastedText, // ← store real pasted text for replay
      });
    }
  };

  // ← PART 3: "End Session" now opens the course modal first
  const handleEndSession = () => {
    if (isSubmitting) return;
    if (text.trim().length === 0) {
      alert("Session is empty. Please type some text first.");
      return;
    }
    setShowCourseModal(true);
  };

  // ← PART 3: called when user confirms in the modal
  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    try {
      const finalIkis = ikiValues.current;
      const finalAvgIki =
        finalIkis.length > 0
          ? Math.round(finalIkis.reduce((a, b) => a + b, 0) / finalIkis.length)
          : 0;
      const finalDeletions = keystrokeLog.current.filter(
        (k) => k.key === "Backspace" || k.key === "Delete",
      ).length;
      const finalPauses = finalIkis.filter((v) => v > 1000).length;
      const finalWpm = seconds > 0 ? Math.round((wordCount / seconds) * 60) : 0;

      const finalStats: SessionStats = {
        wpm: finalWpm,
        keystrokes: keystrokeLog.current.filter((k) => k.type === "keydown")
          .length,
        deletions: finalDeletions,
        pauses: finalPauses,
        avgIki: finalAvgIki,
        sessionSeconds: seconds,
      };

      const response = await api.post("/sessions/analyze", {
        title: title || "Untitled Document",
        text_content: text,
        keystroke_array: keystrokeLog.current,
        stats: finalStats,
        course_id: selectedCourseId, // ← PART 3: pass course_id (null = private)
      });

      setShowCourseModal(false);
      setAnalysisResult({
        classification: response.data.classification,
        confidence: response.data.confidence_score,
        stats: finalStats,
        advanced_stats: response.data.advanced_stats,
        kill_switch_triggered: response.data.kill_switch_triggered,
        kill_switch_reason: response.data.kill_switch_reason,
        certificate_id: response.data.certificate_id,
        document_hash: response.data.document_hash,
      });
    } catch (error: unknown) {
      const ax = error as { response?: { data?: { detail?: string } } };
      alert(
        ax.response?.data?.detail ?? "Analysis failed. Is the server running?",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  // ─── ANALYSIS RESULT PANEL ────────────────────────────────────────────────
  if (analysisResult) {
    const isHuman = analysisResult.classification === "HUMAN";
    const isSuspicious = analysisResult.classification === "SUSPICIOUS";
    const isKilled = analysisResult.kill_switch_triggered;

    return (
      <div
        className="min-h-screen flex items-center justify-center px-6 py-12 font-sans"
        style={{ background: colors.surface[50] }}
      >
        <div className="w-full max-w-[520px] flex flex-col gap-5">
          {/* Classification header */}
          <div
            className="bg-white rounded-2xl border p-8 text-center"
            style={{ borderColor: colors.surface[200] }}
          >
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
              style={{
                background: isHuman
                  ? brand.humanBg
                  : isKilled
                    ? "#fef2f2"
                    : "#fefce8",
                color: isHuman
                  ? brand.humanText
                  : isKilled
                    ? "#b91c1c"
                    : "#a16207",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {isHuman ? (
                  <>
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </>
                ) : (
                  <>
                    <path d="M12 9v4" />
                    <circle cx="12" cy="16" r="1" fill="currentColor" />
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </>
                )}
              </svg>
            </div>
            <h2
              className="text-[28px] font-bold tracking-tight mb-1"
              style={{ color: colors.text.primary }}
            >
              {analysisResult.classification}
            </h2>
            <p
              className="text-[14px] mb-2"
              style={{ color: colors.text.secondary }}
            >
              Confidence:{" "}
              <strong style={{ color: colors.text.primary }}>
                {analysisResult.confidence}%
              </strong>
            </p>
            {selectedCourseId && (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold mt-1"
                style={{ background: "#f0f9ff", color: "#0369a1" }}
              >
                ✓ Submitted to{" "}
                {enrolledCourses.find((c) => c.id === selectedCourseId)
                  ?.course_name ?? "course"}
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "WPM",
                value:
                  analysisResult.advanced_stats?.net_wpm?.toFixed(0) ??
                  analysisResult.stats.wpm,
              },
              {
                label: "IKI Mean",
                value: `${analysisResult.advanced_stats?.ft_mean?.toFixed(0) ?? 0}ms`,
              },
              {
                label: "Entropy",
                value:
                  analysisResult.advanced_stats?.ft_entropy?.toFixed(3) ?? "—",
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="bg-white rounded-xl border p-4 text-center"
                style={{ borderColor: colors.surface[200] }}
              >
                <div
                  className="text-[20px] font-bold font-mono"
                  style={{ color: colors.text.primary }}
                >
                  {value}
                </div>
                <div
                  className="text-[10px] font-bold uppercase tracking-widest mt-1"
                  style={{ color: colors.text.secondary }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Certificate ID */}
          {analysisResult.certificate_id && (
            <div
              className="bg-white rounded-xl border p-4"
              style={{ borderColor: colors.surface[200] }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-widest mb-1"
                style={{ color: colors.text.secondary }}
              >
                Certificate ID
              </div>
              <div
                className="font-mono text-[14px] font-bold"
                style={{ color: colors.text.primary }}
              >
                {analysisResult.certificate_id}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setAnalysisResult(null);
                setText("");
                setTitle("");
                keystrokeLog.current = [];
                ikiValues.current = [];
                setSelectedCourseId(null);
              }}
              className="flex-1 py-3 rounded-xl border text-[13px] font-semibold transition-colors"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.secondary,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  colors.surface[50];
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "white";
              }}
            >
              New Session
            </button>
            <Link
              to={ROUTES.EDITOR}
              className="flex-1 py-3 rounded-xl text-[13px] font-semibold text-white text-center"
              style={{ background: colors.text.primary }}
            >
              View Sessions →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── EDITOR ───────────────────────────────────────────────────────────────

  return (
    <div
      className={`flex flex-col h-screen overflow-hidden font-sans ${fullscreen ? "bg-white" : ""}`}
      style={{ background: focusMode ? "#fff" : colors.surface[50] }}
    >
      {/* ── TOP BAR ── */}
      {!focusMode && (
        <header
          className="shrink-0 flex items-center justify-between px-5 h-12 bg-white border-b"
          style={{ borderColor: colors.surface[200] }}
        >
          <div className="flex items-center gap-3">
            <Link
              to={ROUTES.EDITOR}
              className="text-[13px] font-medium"
              style={{ color: colors.text.secondary }}
            >
              ← Sessions
            </Link>
            <input
              type="text"
              placeholder="Untitled Document"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-[13px] font-medium outline-none bg-transparent border-b border-transparent transition-colors"
              style={{ color: colors.text.primary, maxWidth: 240 }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = colors.surface[200];
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "transparent";
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            <IkiWaveform active={isTyping} />
            <span
              className="text-[12px] font-mono"
              style={{ color: colors.text.secondary }}
            >
              {timerFmt}
            </span>
            {lastSaved && (
              <span
                className="text-[11px]"
                style={{ color: colors.text.secondary }}
              >
                Saved{" "}
                {lastSaved.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}

            {/* Font options */}
            <div
              className="flex items-center gap-1 border rounded-md overflow-hidden"
              style={{ borderColor: colors.surface[200] }}
            >
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFontClass(f.value)}
                  className="px-2 py-1 text-[11px] font-semibold transition-colors"
                  style={{
                    background:
                      fontClass === f.value ? colors.surface[100] : "white",
                    color:
                      fontClass === f.value
                        ? colors.text.primary
                        : colors.text.secondary,
                  }}
                  title={f.desc}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Size options */}
            <div
              className="flex items-center gap-1 border rounded-md overflow-hidden"
              style={{ borderColor: colors.surface[200] }}
            >
              {SIZE_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSizeClass(s.value)}
                  className="px-2 py-1 text-[11px] font-semibold transition-colors"
                  style={{
                    background:
                      sizeClass === s.value ? colors.surface[100] : "white",
                    color:
                      sizeClass === s.value
                        ? colors.text.primary
                        : colors.text.secondary,
                  }}
                  title={s.desc}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setFocusMode(true)}
              className="px-3 py-1.5 rounded-md text-[12px] font-medium border transition-colors"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.secondary,
              }}
            >
              Focus
            </button>

            <button
              onClick={handleEndSession}
              disabled={isSubmitting || text.trim().length === 0}
              className="px-4 py-1.5 rounded-md text-[12px] font-semibold text-white transition-all"
              style={{
                background: colors.text.primary,
                opacity: text.trim().length === 0 ? 0.4 : 1,
                cursor: text.trim().length === 0 ? "not-allowed" : "pointer",
              }}
            >
              End Session
            </button>
          </div>
        </header>
      )}

      {/* Focus mode top bar */}
      {focusMode && (
        <header className="shrink-0 flex items-center justify-between px-8 h-10">
          <div className="flex items-center gap-4">
            <IkiWaveform active={isTyping} />
            <span
              className="text-[12px] font-mono"
              style={{ color: colors.surface[200] }}
            >
              {timerFmt}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFocusMode(false)}
              className="text-[12px]"
              style={{ color: colors.surface[200] }}
            >
              Exit Focus
            </button>
            <button
              onClick={handleEndSession}
              disabled={isSubmitting || text.trim().length === 0}
              className="px-4 py-1.5 rounded-md text-[12px] font-semibold text-white"
              style={{
                background: colors.text.primary,
                opacity: text.trim().length === 0 ? 0.4 : 1,
              }}
            >
              End Session
            </button>
          </div>
        </header>
      )}

      {/* ── MAIN EDITING AREA ── */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto flex justify-center py-10 px-6">
          <div className="w-full" style={{ maxWidth: 720 }}>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onPaste={handlePaste}
              placeholder="Begin writing here. Your biometric signature is being captured."
              className={`w-full min-h-[calc(100vh-200px)] resize-none outline-none bg-transparent ${fontClass} ${sizeClass} ${lineClass}`}
              style={{ color: colors.text.primary, caretColor: brand.action }}
              autoFocus
              spellCheck
            />
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        {rightPanelOpen && !focusMode && (
          <aside
            className="shrink-0 w-[220px] border-l overflow-y-auto py-5 px-4 bg-white"
            style={{ borderColor: colors.surface[200] }}
          >
            <div className="flex flex-col gap-5">
              {/* Stats */}
              <div className="flex flex-col gap-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: colors.text.secondary }}
                >
                  Live Metrics
                </span>
                {[
                  { label: "Words", value: wordCount },
                  { label: "Characters", value: charCount },
                  { label: "WPM", value: stats.wpm },
                  { label: "Avg IKI", value: `${stats.avgIki}ms` },
                  { label: "Deletions", value: stats.deletions },
                  { label: "Pauses", value: stats.pauses },
                  { label: "Read time", value: `${readTime}m` },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex justify-between items-baseline"
                  >
                    <span
                      className="text-[12px]"
                      style={{ color: colors.text.secondary }}
                    >
                      {label}
                    </span>
                    <span
                      className="text-[12px] font-mono font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Word goal */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: colors.text.secondary }}
                  >
                    Word Goal
                  </span>
                  <button
                    onClick={() => setShowGoalPicker(!showGoalPicker)}
                    className="text-[11px] font-semibold"
                    style={{ color: brand.action }}
                  >
                    {wordGoal}
                  </button>
                </div>
                <div
                  className="w-full h-1.5 rounded-full overflow-hidden"
                  style={{ background: colors.surface[100] }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (wordCount / wordGoal) * 100)}%`,
                      background:
                        wordCount >= wordGoal ? brand.humanText : brand.action,
                    }}
                  />
                </div>
                <span
                  className="text-[11px] text-right font-mono"
                  style={{ color: colors.text.secondary }}
                >
                  {wordCount}/{wordGoal}
                </span>
                {showGoalPicker && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {WORD_GOALS.map((g) => (
                      <button
                        key={g}
                        onClick={() => {
                          setWordGoal(g);
                          setShowGoalPicker(false);
                        }}
                        className="px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors"
                        style={{
                          borderColor:
                            wordGoal === g ? brand.action : colors.surface[200],
                          background:
                            wordGoal === g ? `${brand.action}10` : "white",
                          color:
                            wordGoal === g
                              ? brand.action
                              : colors.text.secondary,
                        }}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Line height */}
              <div className="flex flex-col gap-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: colors.text.secondary }}
                >
                  Spacing
                </span>
                <div className="flex gap-1">
                  {LINE_OPTIONS.map((l) => (
                    <button
                      key={l.value}
                      onClick={() => setLineClass(l.value)}
                      className="flex-1 py-1 rounded-md text-[10px] font-semibold border transition-colors"
                      style={{
                        borderColor:
                          lineClass === l.value
                            ? brand.action
                            : colors.surface[200],
                        background:
                          lineClass === l.value ? `${brand.action}10` : "white",
                        color:
                          lineClass === l.value
                            ? brand.action
                            : colors.text.secondary,
                      }}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ← PART 3: Course indicator */}
              {enrolledCourses.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: colors.text.secondary }}
                  >
                    Enrolled In
                  </span>
                  {enrolledCourses.map((c) => (
                    <div
                      key={c.id}
                      className="text-[11px] px-2 py-1 rounded-md font-mono"
                      style={{ background: "#f0f9ff", color: "#0369a1" }}
                    >
                      {c.course_code}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ← PART 3: Course selector modal */}
      {showCourseModal && (
        <CourseSelectorModal
          courses={enrolledCourses}
          selectedCourseId={selectedCourseId}
          onSelect={setSelectedCourseId}
          onConfirm={handleConfirmSubmit}
          onCancel={() => setShowCourseModal(false)}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
