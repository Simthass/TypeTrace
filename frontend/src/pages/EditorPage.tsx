import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";
import { api } from "../lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

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
    ft_mean?: number;
    ft_entropy?: number;
    ft_autocorr?: number;
    burst_ratio?: number;
    net_wpm?: number;
  };
  kill_switch_triggered?: boolean;
  certificate_id?: string;
  document_hash?: string;
  session_id?: number;
}

interface EnrolledCourse {
  id: number;
  course_name: string;
  course_code: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const FONT_OPTIONS = [
  { label: "Sans", value: "'Inter', system-ui, sans-serif", tag: "Sans" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif", tag: "Serif" },
  {
    label: "Mono",
    value: "'JetBrains Mono', 'Courier New', monospace",
    tag: "Mono",
  },
];
const SIZE_OPTIONS = [
  { label: "14", value: 14 },
  { label: "16", value: 16 },
  { label: "18", value: 18 },
];

// ─────────────────────────────────────────────────────────────────────────────
// ICONS — minimal 15×15
// ─────────────────────────────────────────────────────────────────────────────

const ChevronLeft = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
const PanelRight = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="15" y1="3" x2="15" y2="21" />
  </svg>
);
const TypeIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="9" y1="20" x2="15" y2="20" />
    <line x1="12" y1="4" x2="12" y2="20" />
  </svg>
);
const ClockIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// IKI WAVEFORM — canvas animation, active=typing pulse, idle=flat line
// ─────────────────────────────────────────────────────────────────────────────

function IkiWaveform({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const offsetRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      ctx.save();
      ctx.scale(dpr, dpr);

      if (!active) {
        ctx.beginPath();
        ctx.strokeStyle = colors.surface[200];
        ctx.lineWidth = 1;
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.strokeStyle = colors.text.primary;
        ctx.lineWidth = 1.5;
        const freq = 0.045;
        const amp = H * 0.38;
        for (let x = 0; x <= W; x++) {
          const y =
            H / 2 +
            amp * Math.sin((x + offsetRef.current) * freq) +
            amp * 0.3 * Math.sin((x + offsetRef.current) * freq * 2.5 + 1.2);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        offsetRef.current += 2;
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
      height={28}
      style={{ display: "block", width: 80, height: 14 }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COURSE SELECTOR MODAL
// ─────────────────────────────────────────────────────────────────────────────

interface CourseSelectorModalProps {
  courses: EnrolledCourse[];
  selectedCourseId: number | null;
  onSelect: (id: number | null) => void;
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.25)" }}
    >
      <div
        className="w-full max-w-[400px] mx-4 bg-white border rounded-xl overflow-hidden"
        style={{ borderColor: colors.surface[200] }}
      >
        {/* Header */}
        <div
          className="px-5 py-4 border-b"
          style={{ borderColor: colors.surface[200] }}
        >
          <h2
            className="text-[14px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Submit Session
          </h2>
          <p
            className="text-[12px] mt-0.5"
            style={{ color: colors.text.secondary }}
          >
            Choose a course, or save privately.
          </p>
        </div>

        <div className="px-5 py-4 flex flex-col gap-2">
          {/* Private option */}
          <OptionRow
            label="Save privately"
            sub="Visible only to you"
            selected={selectedCourseId === null}
            onSelect={() => onSelect(null)}
          />
          {courses.length > 0 && (
            <>
              <div className="pt-1 pb-0.5">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: colors.text.secondary }}
                >
                  Submit to course
                </span>
              </div>
              {courses.map((c) => (
                <OptionRow
                  key={c.id}
                  label={c.course_name}
                  sub={c.course_code}
                  selected={selectedCourseId === c.id}
                  onSelect={() => onSelect(c.id)}
                />
              ))}
            </>
          )}
        </div>

        <div
          className="px-5 py-4 flex gap-2.5 border-t"
          style={{ borderColor: colors.surface[200] }}
        >
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 h-9 rounded-md text-[13px] font-semibold border transition-colors"
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
            className="flex-1 h-9 rounded-md text-[13px] font-semibold text-white transition-opacity"
            style={{
              background: colors.text.primary,
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? "Analyzing…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionRow({
  label,
  sub,
  selected,
  onSelect,
}: {
  label: string;
  sub: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border text-left transition-colors"
      style={{
        borderColor: selected ? colors.text.primary : colors.surface[200],
        background: selected ? colors.surface[50] : "#fff",
      }}
    >
      <span
        className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
        style={{
          borderColor: selected ? colors.text.primary : colors.surface[200],
          background: selected ? colors.text.primary : "transparent",
        }}
      >
        {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
      </span>
      <div className="min-w-0">
        <p
          className="text-[13px] font-medium truncate"
          style={{ color: colors.text.primary }}
        >
          {label}
        </p>
        <p
          className="text-[11px] font-mono"
          style={{ color: colors.text.secondary }}
        >
          {sub}
        </p>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYSIS RESULT SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function AnalysisScreen({
  result,
  courseName,
  onNewSession,
}: {
  result: AnalysisResult;
  courseName: string | null;
  onNewSession: () => void;
}) {
  const isHuman = result.classification === "HUMAN";
  const isSuspicious = result.classification === "SUSPICIOUS";
  const resultColor = isHuman
    ? brand.humanText
    : isSuspicious
      ? brand.suspiciousText
      : brand.aiText;
  const resultBg = isHuman
    ? brand.humanBg
    : isSuspicious
      ? brand.suspiciousBg
      : brand.aiBg;
  const resultBorder = isHuman
    ? `${brand.humanAccent}30`
    : isSuspicious
      ? `${brand.suspiciousAccent}30`
      : `${brand.aiAccent}30`;

  return (
    <div
      className="flex flex-col h-screen overflow-auto font-sans"
      style={{ background: colors.surface[50] }}
    >
      {/* Minimal top bar */}
      <header
        className="shrink-0 h-12 flex items-center justify-between px-6 bg-white border-b"
        style={{ borderColor: colors.surface[200] }}
      >
        <div
          className="flex items-center gap-2 text-[13px]"
          style={{ color: colors.text.secondary }}
        >
          <ClockIcon />
          Session complete
        </div>
        <Link
          to={ROUTES.EDITOR}
          className="text-[13px] font-medium"
          style={{ color: colors.text.secondary }}
        >
          View all sessions →
        </Link>
      </header>

      <div className="flex-1 flex items-start justify-center pt-16 px-6 pb-16">
        <div className="w-full max-w-[520px] flex flex-col gap-4">
          {/* Classification result */}
          <div
            className="border rounded-xl p-6 flex items-start gap-5"
            style={{ background: "#fff", borderColor: colors.surface[200] }}
          >
            {/* Result indicator */}
            <div
              className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-[18px] font-bold border"
              style={{
                background: resultBg,
                color: resultColor,
                borderColor: resultBorder,
              }}
            >
              {isHuman ? "✓" : isSuspicious ? "?" : "!"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-1">
                <h1
                  className="text-[22px] font-bold tracking-tight"
                  style={{ color: colors.text.primary }}
                >
                  {result.classification}
                </h1>
                <span
                  className="px-2 py-0.5 rounded-md text-[11px] font-bold border"
                  style={{
                    background: resultBg,
                    color: resultColor,
                    borderColor: resultBorder,
                  }}
                >
                  {result.confidence}% confidence
                </span>
              </div>
              <p
                className="text-[13px]"
                style={{ color: colors.text.secondary }}
              >
                {isHuman
                  ? "Behavioral analysis confirms consistent human typing patterns. Certificate issued."
                  : isSuspicious
                    ? "Some anomalous patterns detected. Manual review recommended."
                    : "Synthetic patterns detected. Session flagged for review."}
              </p>
              {courseName && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span
                    className="text-[11px] font-medium px-2 py-0.5 rounded-md"
                    style={{ background: "#f0f9ff", color: "#0369a1" }}
                  >
                    ✓ Submitted to {courseName}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "Net WPM",
                value:
                  result.advanced_stats?.net_wpm?.toFixed(0) ??
                  result.stats.wpm,
              },
              {
                label: "IKI Mean",
                value: `${result.advanced_stats?.ft_mean?.toFixed(0) ?? 0}ms`,
              },
              {
                label: "Entropy",
                value: result.advanced_stats?.ft_entropy?.toFixed(3) ?? "—",
              },
              {
                label: "Autocorr",
                value: result.advanced_stats?.ft_autocorr?.toFixed(3) ?? "—",
              },
              {
                label: "Burst Ratio",
                value: result.advanced_stats?.burst_ratio?.toFixed(3) ?? "—",
              },
              { label: "Keystrokes", value: result.stats.keystrokes },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="border rounded-xl p-4 flex flex-col gap-1"
                style={{ background: "#fff", borderColor: colors.surface[200] }}
              >
                <span
                  className="text-[9px] font-bold uppercase tracking-widest"
                  style={{ color: colors.text.secondary }}
                >
                  {label}
                </span>
                <span
                  className="text-[17px] font-bold font-mono"
                  style={{ color: colors.text.primary }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Certificate ID */}
          {result.certificate_id && (
            <div
              className="border rounded-xl p-4"
              style={{ background: "#fff", borderColor: colors.surface[200] }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ color: colors.text.secondary }}
              >
                Certificate ID
              </div>
              <div
                className="font-mono text-[13px] font-bold"
                style={{ color: colors.text.primary }}
              >
                {result.certificate_id}
              </div>
              {result.document_hash && (
                <div
                  className="mt-1.5 font-mono text-[10px] truncate"
                  style={{ color: colors.text.secondary }}
                >
                  SHA-256: {result.document_hash}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onNewSession}
              className="flex-1 h-10 rounded-xl border text-[13px] font-semibold transition-colors"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.secondary,
                background: "#fff",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  colors.surface[50];
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#fff";
              }}
            >
              New Session
            </button>
            <Link
              to={ROUTES.EDITOR}
              className="flex-1 h-10 rounded-xl text-[13px] font-semibold text-white flex items-center justify-center"
              style={{ background: colors.text.primary }}
            >
              View Sessions →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EDITOR
// ─────────────────────────────────────────────────────────────────────────────

export default function EditorPage() {
  const navigate = useNavigate();

  // ── Document state ─────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  // ── UI toggles ─────────────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [fontStyle, setFontStyle] = useState(FONT_OPTIONS[0]);
  const [fontSize, setFontSize] = useState(SIZE_OPTIONS[1]);

  // ── Biometric capture ──────────────────────────────────────────────────────
  const keystrokeLog = useRef<KeystrokeEvent[]>([]);
  const activeKeys = useRef<Record<string, number>>({});
  const lastKeydownTime = useRef<number | null>(null);
  const ikiValues = useRef<number[]>([]);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  // ── Session timer ──────────────────────────────────────────────────────────
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const timerFmt = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  // ── Live stats (updated every 3s) ─────────────────────────────────────────
  const [liveStats, setLiveStats] = useState({
    wpm: 0,
    keystrokes: 0,
    deletions: 0,
    avgIki: 0,
  });
  useEffect(() => {
    if (seconds > 0 && seconds % 3 === 0) {
      const allKeys = keystrokeLog.current.filter((k) => k.type === "keydown");
      const deletions = allKeys.filter((k) => k.key === "Backspace").length;
      const ikis = ikiValues.current;
      const avgIki =
        ikis.length > 0
          ? Math.round(ikis.reduce((a, b) => a + b, 0) / ikis.length)
          : 0;
      const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
      const wpm = seconds > 0 ? Math.round((words / seconds) * 60) : 0;
      setLiveStats({ wpm, keystrokes: allKeys.length, deletions, avgIki });
    }
  }, [seconds, text]);

  // ── Derived counts ─────────────────────────────────────────────────────────
  const wordCount = useMemo(
    () => (text.trim() === "" ? 0 : text.trim().split(/\s+/).length),
    [text],
  );
  const charCount = text.length;

  // ── Course selector ────────────────────────────────────────────────────────
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourse[]>([]);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  useEffect(() => {
    api
      .get<{ courses: EnrolledCourse[] }>("/courses/enrolled")
      .then((r) => setEnrolledCourses(r.data.courses))
      .catch(() => {});
  }, []);

  // ── Analysis ───────────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );

  // ── Keyboard handlers ──────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.repeat) return;
      const now = Date.now();
      let flightTime: number | null = null;
      if (lastKeydownTime.current !== null) {
        flightTime = now - lastKeydownTime.current;
        if (flightTime > 0 && flightTime < 5000)
          ikiValues.current.push(flightTime);
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
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => setIsTyping(false), 1500);
    },
    [text.length],
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const now = Date.now();
      const downTime = activeKeys.current[e.code];
      if (downTime !== undefined) {
        const dwell = now - downTime;
        delete activeKeys.current[e.code];
        for (let i = keystrokeLog.current.length - 1; i >= 0; i--) {
          const ev = keystrokeLog.current[i];
          if (
            ev.type === "keydown" &&
            ev.key === e.key &&
            ev.dwell_time === null
          ) {
            ev.dwell_time = dwell;
            ev.up_time = now;
            break;
          }
        }
      }
    },
    [],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
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
          pastedText,
        });
      }
    },
    [text.length],
  );

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleEndSession = () => {
    if (!text.trim()) return;
    setShowCourseModal(true);
  };

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    try {
      const ikis = ikiValues.current;
      const avgIki =
        ikis.length > 0
          ? Math.round(ikis.reduce((a, b) => a + b, 0) / ikis.length)
          : 0;
      const allKeys = keystrokeLog.current.filter((k) => k.type === "keydown");
      const deletions = allKeys.filter((k) => k.key === "Backspace").length;
      const pauses = ikis.filter((v) => v > 1000).length;
      const wpm = seconds > 0 ? Math.round((wordCount / seconds) * 60) : 0;

      const finalStats: SessionStats = {
        wpm,
        keystrokes: allKeys.length,
        deletions,
        pauses,
        avgIki,
        sessionSeconds: seconds,
      };

      const response = await api.post("/sessions/analyze", {
        title: title.trim() || "Untitled Document",
        text_content: text,
        keystroke_array: keystrokeLog.current,
        stats: finalStats,
        course_id: selectedCourseId,
      });

      setShowCourseModal(false);
      setAnalysisResult({
        classification: response.data.classification,
        confidence: response.data.confidence_score,
        stats: finalStats,
        advanced_stats: response.data.advanced_stats,
        kill_switch_triggered: response.data.kill_switch_triggered,
        certificate_id: response.data.certificate_id,
        document_hash: response.data.document_hash,
        session_id: response.data.session_id,
      });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } } };
      alert(
        ax.response?.data?.detail ?? "Analysis failed. Is the server running?",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Analysis result screen ────────────────────────────────────────────────
  if (analysisResult) {
    const courseName = selectedCourseId
      ? (enrolledCourses.find((c) => c.id === selectedCourseId)?.course_name ??
        null)
      : null;
    return (
      <AnalysisScreen
        result={analysisResult}
        courseName={courseName}
        onNewSession={() => {
          setAnalysisResult(null);
          setText("");
          setTitle("");
          setSeconds(0);
          keystrokeLog.current = [];
          ikiValues.current = [];
          setSelectedCourseId(null);
        }}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col h-screen overflow-hidden font-sans"
      style={{ background: focusMode ? "#ffffff" : colors.surface[50] }}
    >
      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <header
        className="shrink-0 h-12 flex items-center px-4 gap-3 bg-white border-b"
        style={{ borderColor: colors.surface[200] }}
      >
        {/* Back */}
        {!focusMode && (
          <Link
            to={ROUTES.EDITOR}
            className="shrink-0 flex items-center gap-1 text-[12px] font-medium transition-colors px-2 py-1 rounded-md"
            style={{ color: colors.text.secondary }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                colors.surface[100];
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <ChevronLeft />
          </Link>
        )}

        {/* Divider */}
        {!focusMode && (
          <div
            className="h-4 w-px"
            style={{ background: colors.surface[200] }}
          />
        )}

        {/* Session title — inline editable */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled Document"
          className="flex-1 min-w-0 text-[13px] font-medium bg-transparent outline-none"
          style={{
            color: colors.text.primary,
            caretColor: colors.text.primary,
          }}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Live readout — timer / wpm / words */}
        <div
          className="hidden sm:flex items-center gap-4 text-[12px] font-mono shrink-0 px-3 h-7 rounded-md border"
          style={{
            color: colors.text.secondary,
            borderColor: colors.surface[200],
            background: colors.surface[50],
          }}
        >
          <span className="flex items-center gap-1">
            <ClockIcon />
            {timerFmt}
          </span>
          <span style={{ color: colors.surface[200] }}>|</span>
          <span>{liveStats.wpm} wpm</span>
          <span style={{ color: colors.surface[200] }}>|</span>
          <span>{wordCount} words</span>
        </div>

        {/* Format menu toggle */}
        {!focusMode && (
          <div className="relative shrink-0">
            <button
              onClick={() => setShowFormatMenu(!showFormatMenu)}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-[12px] font-medium transition-colors"
              style={{
                borderColor: showFormatMenu
                  ? colors.text.primary
                  : colors.surface[200],
                color: colors.text.secondary,
              }}
              title="Format"
            >
              <TypeIcon />
              <span>
                {fontStyle.tag} {fontSize.label}
              </span>
            </button>

            {showFormatMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowFormatMenu(false)}
                />
                <div
                  className="absolute right-0 top-9 z-20 w-44 bg-white border rounded-lg py-1 shadow-sm"
                  style={{ borderColor: colors.surface[200] }}
                >
                  <div className="px-3 py-1.5">
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest mb-2"
                      style={{ color: colors.text.secondary }}
                    >
                      Font
                    </p>
                    {FONT_OPTIONS.map((f) => (
                      <button
                        key={f.tag}
                        onClick={() => {
                          setFontStyle(f);
                          setShowFormatMenu(false);
                        }}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[13px] transition-colors"
                        style={{
                          background:
                            fontStyle.tag === f.tag
                              ? colors.surface[100]
                              : "transparent",
                          color:
                            fontStyle.tag === f.tag
                              ? colors.text.primary
                              : colors.text.secondary,
                          fontFamily: f.value,
                        }}
                      >
                        {f.label}
                        {fontStyle.tag === f.tag && <span>✓</span>}
                      </button>
                    ))}
                  </div>
                  <div
                    className="border-t my-1"
                    style={{ borderColor: colors.surface[200] }}
                  />
                  <div className="px-3 py-1.5">
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest mb-2"
                      style={{ color: colors.text.secondary }}
                    >
                      Size
                    </p>
                    <div className="flex gap-1">
                      {SIZE_OPTIONS.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => {
                            setFontSize(s);
                            setShowFormatMenu(false);
                          }}
                          className="flex-1 py-1 rounded-md text-[12px] font-semibold border transition-colors"
                          style={{
                            borderColor:
                              fontSize.value === s.value
                                ? colors.text.primary
                                : colors.surface[200],
                            background:
                              fontSize.value === s.value
                                ? colors.text.primary
                                : "#fff",
                            color:
                              fontSize.value === s.value
                                ? "#fff"
                                : colors.text.secondary,
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Panel toggle */}
        {!focusMode && (
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="shrink-0 flex items-center justify-center h-7 w-7 rounded-md border transition-colors"
            style={{
              borderColor: panelOpen
                ? colors.text.primary
                : colors.surface[200],
              color: panelOpen ? colors.text.primary : colors.text.secondary,
              background: panelOpen ? colors.surface[100] : "#fff",
            }}
            title="Toggle panel"
          >
            <PanelRight />
          </button>
        )}

        {/* Divider */}
        <div
          className="h-4 w-px shrink-0"
          style={{ background: colors.surface[200] }}
        />

        {/* Focus mode */}
        {!focusMode ? (
          <button
            onClick={() => setFocusMode(true)}
            className="shrink-0 h-7 px-2.5 rounded-md border text-[12px] font-medium transition-colors"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.secondary,
            }}
          >
            Focus
          </button>
        ) : (
          <button
            onClick={() => setFocusMode(false)}
            className="shrink-0 h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors"
            style={{ color: colors.text.secondary }}
          >
            Exit Focus
          </button>
        )}

        {/* End Session — primary CTA */}
        <button
          onClick={handleEndSession}
          disabled={isSubmitting || !text.trim()}
          className="shrink-0 h-7 px-3.5 rounded-md text-[12px] font-semibold text-white transition-opacity"
          style={{
            background: colors.text.primary,
            opacity: !text.trim() ? 0.35 : isSubmitting ? 0.7 : 1,
            cursor: !text.trim() ? "not-allowed" : "pointer",
          }}
        >
          End Session
        </button>
      </header>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document area */}
        <div
          className="flex-1 overflow-auto"
          style={{ background: focusMode ? "#ffffff" : colors.surface[50] }}
        >
          {/* Page wrapper — simulates a document */}
          <div className="max-w-[740px] mx-auto py-12 px-8 md:px-16">
            {/* Document title */}
            <div className="mb-6">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled Document"
                className="w-full text-[26px] font-bold bg-transparent outline-none border-none"
                style={{
                  color: colors.text.primary,
                  fontFamily: fontStyle.value,
                  caretColor: colors.text.primary,
                }}
              />
            </div>

            {/* Textarea */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onPaste={handlePaste}
              placeholder="Start writing here. TypeTrace silently records your behavioral biometrics in the background…"
              autoFocus
              spellCheck
              className="w-full bg-transparent outline-none resize-none border-none leading-[1.85]"
              style={{
                fontFamily: fontStyle.value,
                fontSize: fontSize.value,
                color: colors.text.primary,
                caretColor: colors.text.primary,
                minHeight: "calc(100vh - 240px)",
              }}
            />
          </div>
        </div>

        {/* ── RIGHT METRICS PANEL ────────────────────────────────────── */}
        {panelOpen && !focusMode && (
          <aside
            className="shrink-0 w-[220px] border-l overflow-y-auto bg-white flex flex-col"
            style={{ borderColor: colors.surface[200] }}
          >
            {/* Capture status */}
            <div
              className="px-4 py-3 flex items-center gap-2 border-b"
              style={{ borderColor: colors.surface[200] }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: isTyping ? colors.green : colors.surface[200],
                }}
              />
              <span
                className="text-[11px] font-medium"
                style={{
                  color: isTyping ? colors.text.primary : colors.text.secondary,
                }}
              >
                {isTyping ? "Capturing" : "Idle"}
              </span>
              <div className="ml-auto">
                <IkiWaveform active={isTyping} />
              </div>
            </div>

            {/* Live metrics */}
            <div className="flex flex-col px-4 py-3 gap-0.5">
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-2"
                style={{ color: colors.text.secondary }}
              >
                Session
              </p>
              {[
                { label: "Words", value: wordCount },
                { label: "Characters", value: charCount },
                { label: "WPM", value: liveStats.wpm },
                { label: "Keystrokes", value: liveStats.keystrokes },
                { label: "Deletions", value: liveStats.deletions },
                { label: "Avg IKI", value: `${liveStats.avgIki}ms` },
                { label: "Duration", value: timerFmt },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex justify-between items-center py-1.5 border-b last:border-0"
                  style={{ borderColor: colors.surface[50] }}
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

            {/* Enrolled courses indicator */}
            {enrolledCourses.length > 0 && (
              <div
                className="px-4 py-3 border-t mt-auto"
                style={{ borderColor: colors.surface[200] }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-2"
                  style={{ color: colors.text.secondary }}
                >
                  Courses
                </p>
                {enrolledCourses.slice(0, 3).map((c) => (
                  <div key={c.id} className="flex items-center gap-2 py-1">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: "#0369a1" }}
                    />
                    <span
                      className="text-[11px] font-mono truncate"
                      style={{ color: "#0369a1" }}
                    >
                      {c.course_code}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ── STATUS BAR ───────────────────────────────────────────────────── */}
      {!focusMode && (
        <footer
          className="shrink-0 h-9 flex items-center gap-4 px-5 border-t"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[50],
          }}
        >
          {/* Capture indicator */}
          <div
            className="flex items-center gap-1.5 text-[11px] font-mono"
            style={{ color: colors.text.secondary }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background:
                  keystrokeLog.current.length > 0
                    ? colors.green
                    : colors.surface[200],
                boxShadow:
                  keystrokeLog.current.length > 0
                    ? `0 0 4px ${colors.green}`
                    : "none",
              }}
            />
            {liveStats.keystrokes} keys · {liveStats.deletions} deletions · IKI{" "}
            {liveStats.avgIki}ms
          </div>

          <div className="flex-1" />

          {/* Right side: char count + word goal hint */}
          <span
            className="text-[11px] font-mono"
            style={{ color: colors.text.secondary }}
          >
            {charCount} chars
          </span>
          <span
            className="text-[11px] font-mono"
            style={{ color: colors.text.secondary }}
          >
            ~{Math.max(1, Math.ceil(wordCount / 200))} min read
          </span>
        </footer>
      )}

      {/* Course selector modal */}
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
