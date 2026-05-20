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
  // FIX: dwell_time is patched in by handleKeyUp, so it starts null on keydown
  dwell_time: number | null;
  flight_time: number | null;
  documentLength: number;
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
        ctx.restore();
        frameRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx.beginPath();
      ctx.strokeStyle = colors.surface[200];
      ctx.lineWidth = 1.2;
      for (let x = 0; x <= W; x += 2) {
        const y =
          H / 2 +
          Math.sin((x + offsetRef.current * 0.5) * 0.033) * (H * 0.2) +
          Math.sin((x + offsetRef.current * 0.25) * 0.07) * (H * 0.07);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = colors.text.primary;
      ctx.lineWidth = 1.8;
      for (let x = 0; x <= W; x += 2) {
        const y =
          H / 2 +
          Math.sin((x + offsetRef.current) * 0.04) * (H * 0.32) +
          Math.sin((x + offsetRef.current * 1.4) * 0.09) * (H * 0.1) +
          Math.sin((x + offsetRef.current * 0.6) * 0.02) * (H * 0.06);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.restore();
      offsetRef.current += 0.9;
      frameRef.current = requestAnimationFrame(draw);
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
      aria-label="Live IKI waveform"
    />
  );
}

// ─── UI COMPONENTS ────────────────────────────────────────────────────────────
function StatPill({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-md border shadow-sm"
      style={{
        backgroundColor: brand.bgCard,
        borderColor: colors.surface[200],
      }}
    >
      <span
        className="text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: colors.text.secondary }}
      >
        {label}
      </span>
      <span
        className="text-[18px] font-mono font-bold leading-none tracking-tight"
        style={{
          color: highlight ? colors.text.primary : colors.text.secondary,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ToolBtn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex items-center justify-center h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors"
      style={{
        backgroundColor: active ? colors.surface[200] : "transparent",
        color: active ? colors.text.primary : colors.text.secondary,
      }}
      onMouseEnter={(e) =>
        !active && (e.currentTarget.style.backgroundColor = colors.surface[100])
      }
      onMouseLeave={(e) =>
        !active && (e.currentTarget.style.backgroundColor = "transparent")
      }
    >
      {children}
    </button>
  );
}

function WordGoalBar({ current, goal }: { current: number; goal: number }) {
  const pct = Math.min((current / goal) * 100, 100);
  const done = pct >= 100;
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex justify-between items-center">
        <span
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: colors.text.secondary }}
        >
          Word Goal
        </span>
        <span
          className="text-[11px] font-mono font-bold"
          style={{ color: done ? brand.humanAccent : colors.text.primary }}
        >
          {current} / {goal}
        </span>
      </div>
      <div
        className="h-1 overflow-hidden"
        style={{ backgroundColor: colors.surface[200] }}
      >
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: done ? brand.humanAccent : colors.text.primary,
          }}
        />
      </div>
    </div>
  );
}

// ─── ANALYSIS RESULTS MODAL — Professional SaaS standard ─────────────────────
// Design: clean data-dense layout, monospaced metrics, newspaper-style hierarchy.
// No gradients, no glassmorphism, no glow effects.
function AnalysisModal({
  result,
  onClose,
}: {
  result: AnalysisResult;
  onClose: () => void;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const isHuman = result.classification === "HUMAN";
  const conf = result.confidence;

  // Confidence display colour: green ≥ 90, amber 70–89, red < 70
  const confColor = conf >= 90 ? "#16a34a" : conf >= 70 ? "#d97706" : "#dc2626";

  const advStats = result.advanced_stats ?? {};

  const handleDownloadPDF = async () => {
    if (!result.certificate_id) return;
    setIsDownloading(true);
    try {
      const response = await api.get(
        `/certificates/${result.certificate_id}/pdf`,
        {
          responseType: "blob",
        },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `TypeTrace_${result.certificate_id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch {
      alert("PDF generation failed. Try again from the Dashboard.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyHash = () => {
    if (result.document_hash) {
      navigator.clipboard.writeText(result.document_hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(5,5,5,0.55)" }}
    >
      {/* Modal container — fixed width, white, bordered, no shadow blur */}
      <div
        className="w-full max-w-[520px] border overflow-hidden rounded-md"
        style={{
          backgroundColor: "#ffffff",
          borderColor: colors.surface[300] ?? "#d1d5db",
          boxShadow: "0 4px 24px 0 rgba(0,0,0,0.10)",
        }}
      >
        {/* ── Top status bar ── */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{
            backgroundColor: isHuman ? "#f0fdf4" : "#fef2f2",
            borderColor: isHuman ? "#bbf7d0" : "#fecaca",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: isHuman ? "#16a34a" : "#dc2626" }}
            />
            <span
              className="text-[11px] font-bold tracking-[0.12em] uppercase"
              style={{ color: isHuman ? "#15803d" : "#b91c1c" }}
            >
              {isHuman ? "Human Authored" : "Synthetic / AI-Assisted"}
            </span>
          </div>
          <span
            className="text-[10px] font-mono"
            style={{ color: colors.text.secondary }}
          >
            {result.certificate_id ?? "—"}
          </span>
        </div>

        {/* ── Main content ── */}
        <div className="px-5 pt-5 pb-4 flex flex-col gap-0">
          {/* Confidence + kill-switch row */}
          <div
            className="flex items-start justify-between pb-4 border-b mb-4"
            style={{ borderColor: colors.surface[100] ?? "#f3f4f6" }}
          >
            <div>
              <div
                className="text-[11px] font-semibold uppercase tracking-widest mb-1"
                style={{ color: colors.text.secondary }}
              >
                Confidence
              </div>
              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-[44px] font-mono font-bold leading-none tabular-nums"
                  style={{ color: confColor }}
                >
                  {conf.toFixed(1)}
                </span>
                <span
                  className="text-[18px] font-mono"
                  style={{ color: colors.text.secondary }}
                >
                  %
                </span>
              </div>
              {result.kill_switch_triggered && (
                <div
                  className="mt-2 flex items-start gap-1.5 text-[11px] font-medium"
                  style={{ color: "#b45309" }}
                >
                  <span>⚠</span>
                  <span>
                    {result.kill_switch_reason ??
                      "Deterministic rule triggered"}
                  </span>
                </div>
              )}
            </div>

            {/* Typing speed summary */}
            <div className="text-right">
              <div
                className="text-[11px] font-semibold uppercase tracking-widest mb-1"
                style={{ color: colors.text.secondary }}
              >
                Typing Speed
              </div>
              <div
                className="text-[28px] font-mono font-bold leading-none"
                style={{ color: colors.text.primary }}
              >
                {result.stats.wpm}
                <span
                  className="text-[13px] font-normal ml-1"
                  style={{ color: colors.text.secondary }}
                >
                  wpm
                </span>
              </div>
              <div
                className="text-[11px] font-mono mt-1"
                style={{ color: colors.text.secondary }}
              >
                {result.stats.keystrokes} keystrokes · {result.stats.deletions}{" "}
                del
              </div>
            </div>
          </div>

          {/* Biometric feature grid — 6 cells, 3 cols */}
          <div className="mb-4">
            <div
              className="text-[10px] font-bold uppercase tracking-widest mb-2.5"
              style={{ color: colors.text.secondary }}
            >
              Extracted Biometric Features
            </div>
            <div
              className="grid grid-cols-3 gap-px"
              style={{ backgroundColor: colors.surface[200] }}
            >
              {[
                {
                  label: "HT Mean",
                  value:
                    advStats.ht_mean != null ? `${advStats.ht_mean}ms` : "—",
                },
                {
                  label: "FT Mean",
                  value:
                    advStats.ft_mean != null ? `${advStats.ft_mean}ms` : "—",
                },
                {
                  label: "FT Entropy",
                  value:
                    advStats.ft_entropy != null
                      ? advStats.ft_entropy.toFixed(3)
                      : "—",
                },
                {
                  label: "FT Autocorr",
                  value:
                    advStats.ft_autocorr != null
                      ? advStats.ft_autocorr.toFixed(3)
                      : "—",
                },
                {
                  label: "Burst Ratio",
                  value:
                    advStats.burst_ratio != null
                      ? advStats.burst_ratio.toFixed(3)
                      : "—",
                },
                {
                  label: "Pause Ratio",
                  value:
                    advStats.pause_ratio != null
                      ? advStats.pause_ratio.toFixed(3)
                      : "—",
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex flex-col px-3 py-2.5"
                  style={{ backgroundColor: "#ffffff" }}
                >
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider mb-1"
                    style={{ color: colors.text.secondary }}
                  >
                    {label}
                  </span>
                  <span
                    className="text-[14px] font-mono font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* SHA-256 hash row */}
          {result.document_hash && (
            <div
              className="flex items-center justify-between px-3 py-2.5 border mb-4"
              style={{
                backgroundColor: colors.surface[50] ?? "#f9fafb",
                borderColor: colors.surface[200],
              }}
            >
              <div className="flex flex-col gap-0.5 min-w-0 mr-3">
                <span
                  className="text-[9px] font-bold uppercase tracking-wider"
                  style={{ color: colors.text.secondary }}
                >
                  SHA-256 Document Hash
                </span>
                <span
                  className="text-[10.5px] font-mono truncate"
                  style={{ color: colors.text.primary }}
                  title={result.document_hash}
                >
                  {result.document_hash.substring(0, 20)}…
                  {result.document_hash.substring(56)}
                </span>
              </div>
              <button
                onClick={handleCopyHash}
                className="shrink-0 text-[10px] font-semibold px-2.5 py-1.5 border transition-colors"
                style={{
                  backgroundColor: copied ? colors.surface[100] : "#fff",
                  borderColor: colors.surface[200],
                  color: copied ? "#16a34a" : colors.text.secondary,
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}

          {/* Session metadata row */}
          <div
            className="grid grid-cols-3 gap-px mb-5"
            style={{ backgroundColor: colors.surface[200] }}
          >
            {[
              {
                label: "Duration",
                value: `${Math.round(result.stats.sessionSeconds)}s`,
              },
              { label: "Pauses", value: result.stats.pauses },
              { label: "Avg IKI", value: `${result.stats.avgIki}ms` },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="px-3 py-2"
                style={{ backgroundColor: "#ffffff" }}
              >
                <span
                  className="block text-[9px] font-bold uppercase tracking-wider mb-0.5"
                  style={{ color: colors.text.secondary }}
                >
                  {label}
                </span>
                <span
                  className="text-[13px] font-mono font-medium"
                  style={{ color: colors.text.primary }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {result.certificate_id && (
              <button
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="flex items-center justify-center gap-2 w-full py-2.5 border text-[12px] font-semibold transition-colors"
                style={{
                  backgroundColor: isDownloading ? colors.surface[50] : "#fff",
                  borderColor: colors.surface[300] ?? "#d1d5db",
                  color: colors.text.primary,
                  cursor: isDownloading ? "not-allowed" : "pointer",
                }}
              >
                {isDownloading ? (
                  "Generating certificate…"
                ) : (
                  <>
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download Certificate PDF
                  </>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full py-2.5 text-[12px] font-semibold transition-colors"
              style={{
                backgroundColor: colors.text.primary,
                color: "#ffffff",
              }}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SESSION TIMER ─────────────────────────────────────────────────────────────
function useSessionTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const fmt = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return { seconds, fmt };
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

  // ── KEY DOWN: records flight_time, stores down_time in activeKeys ──────────
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
      activeKeys.current[e.code] = now; // store timestamp for dwell calculation

      keystrokeLog.current.push({
        key: e.key,
        keyCode: e.keyCode,
        type: "keydown",
        timestamp: now,
        down_time: now,
        up_time: null,
        dwell_time: null, // FIX: patched by handleKeyUp when the key is released
        flight_time: flightTime,
        documentLength: text.length,
      });

      setIsTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1200);
    },
    [text.length],
  );

  // ── KEY UP: computes dwell_time and patches the matching keydown event ─────
  // FIX: dwell_time is now correctly written back to the keydown event so the
  //      Python extractor (which reads type=="keydown") can find it.
  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const now = Date.now();
      const downTime = activeKeys.current[e.code];

      if (downTime) {
        const dwellTime = now - downTime;
        delete activeKeys.current[e.code];

        // Patch dwell_time back onto the most-recent matching keydown event.
        // Iterate backwards — the matching event is almost always the last entry.
        for (let i = keystrokeLog.current.length - 1; i >= 0; i--) {
          const ev = keystrokeLog.current[i];
          if (
            ev.type === "keydown" &&
            ev.key === e.key &&
            ev.dwell_time === null
          ) {
            ev.dwell_time = dwellTime; // patch in-place
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
      keystrokeLog.current.push({
        key: "__PASTE_EVENT__",
        keyCode: -1,
        type: "keydown",
        timestamp: Date.now(),
        down_time: Date.now(),
        up_time: Date.now(),
        dwell_time: 0,
        flight_time: 0,
        documentLength: text.length,
      });
    }
  };

  const handleEndSession = async () => {
    if (isSubmitting) return;
    if (text.trim().length === 0) {
      alert("Session is empty. Please type some text first.");
      return;
    }

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
      });

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
    } catch (error: any) {
      console.error("Analysis failed:", error);
      alert(
        error.response?.data?.detail ??
          "Analysis failed. Is the server running?",
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

  const signalCount = keystrokeLog.current.length;
  const signalStatus =
    signalCount > 50
      ? { label: "High Confidence Ready", color: brand.humanAccent, pct: 100 }
      : signalCount > 20
        ? {
            label: "Calibrating",
            color: brand.suspiciousAccent,
            pct: (signalCount / 50) * 100,
          }
        : { label: "Insufficient Data", color: colors.surface[400], pct: 15 };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  return (
    <>
      <div
        className="flex flex-col h-screen overflow-hidden font-sans"
        style={{ backgroundColor: brand.bgPage }}
      >
        {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
        <header
          className="shrink-0 flex items-center justify-between px-5 gap-4 border-b z-20"
          style={{
            height: 50,
            backgroundColor: brand.bgCard,
            borderColor: colors.surface[200],
          }}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1 max-w-[400px]">
            <Link
              to={ROUTES.DASHBOARD}
              className="flex items-center justify-center h-7 w-7 rounded-md border transition-colors shrink-0 hover:opacity-80"
              style={{
                borderColor: colors.surface[200],
                backgroundColor: colors.surface[50],
                color: colors.text.secondary,
              }}
              title="Back to Dashboard"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 15 15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 3L5 7.5 9 12" />
              </svg>
            </Link>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-[13px] font-semibold bg-transparent outline-none w-full truncate focus:ring-0 px-2.5 py-1 rounded-md border transition-colors"
              style={{
                color: colors.text.primary,
                caretColor: brand.action,
                borderColor: colors.surface[200],
              }}
              placeholder="Untitled Document"
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = colors.text.secondary)
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = colors.surface[200])
              }
            />
          </div>

          {/* Toolbar */}
          <div
            className="hidden md:flex items-center gap-1 px-1.5 py-1 rounded-md border shadow-sm"
            style={{
              backgroundColor: colors.surface[50],
              borderColor: colors.surface[200],
            }}
          >
            <div
              className="flex items-center gap-0.5 pr-1.5 border-r"
              style={{ borderColor: colors.surface[200] }}
            >
              {FONT_OPTIONS.map((f) => (
                <ToolBtn
                  key={f.value}
                  active={fontClass === f.value}
                  onClick={() => setFontClass(f.value)}
                  title={f.desc}
                >
                  {f.label}
                </ToolBtn>
              ))}
            </div>
            <div
              className="flex items-center gap-0.5 px-1.5 border-r"
              style={{ borderColor: colors.surface[200] }}
            >
              {SIZE_OPTIONS.map((s) => (
                <ToolBtn
                  key={s.value}
                  active={sizeClass === s.value}
                  onClick={() => setSizeClass(s.value)}
                  title={s.desc}
                >
                  {s.label}
                </ToolBtn>
              ))}
            </div>
            <div
              className="flex items-center gap-0.5 px-1.5 border-r"
              style={{ borderColor: colors.surface[200] }}
            >
              {LINE_OPTIONS.map((l) => (
                <ToolBtn
                  key={l.value}
                  active={lineClass === l.value}
                  onClick={() => setLineClass(l.value)}
                  title={l.label}
                >
                  <span className="text-[10px]">{l.label.slice(0, 4)}</span>
                </ToolBtn>
              ))}
            </div>
            <div
              className="flex items-center gap-0.5 px-1.5 border-r"
              style={{ borderColor: colors.surface[200] }}
            >
              <ToolBtn
                active={focusMode}
                onClick={() => setFocusMode((v) => !v)}
                title="Focus Mode"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M3 9V5h4M17 5h4v4M21 15v4h-4M7 19H3v-4" />
                </svg>
              </ToolBtn>
              <ToolBtn
                active={fullscreen}
                onClick={toggleFullscreen}
                title="Fullscreen"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path
                    d={
                      fullscreen
                        ? "M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"
                        : "M3 8V5h3M18 5h3v3M21 16v3h-3M6 19H3v-3"
                    }
                  />
                </svg>
              </ToolBtn>
            </div>
            <div
              className="relative px-1.5 border-r"
              style={{ borderColor: colors.surface[200] }}
            >
              <ToolBtn
                active={showGoalPicker}
                onClick={() => setShowGoalPicker((v) => !v)}
                title="Word goal"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M12 2a10 10 0 1 0 10 10" />
                  <path d="M12 8v4l3 3" />
                </svg>
                <span className="ml-1 text-[10px] font-mono">{wordGoal}w</span>
              </ToolBtn>
              {showGoalPicker && (
                <div
                  className="absolute top-full right-0 mt-2 p-1 border rounded-md shadow-md z-50 flex flex-col min-w-[100px]"
                  style={{
                    backgroundColor: brand.bgCard,
                    borderColor: colors.surface[200],
                  }}
                  onMouseLeave={() => setShowGoalPicker(false)}
                >
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider px-2 py-1.5"
                    style={{ color: colors.text.secondary }}
                  >
                    Goal
                  </span>
                  {WORD_GOALS.map((g) => (
                    <button
                      key={g}
                      onClick={() => {
                        setWordGoal(g);
                        setShowGoalPicker(false);
                      }}
                      className="text-left px-2 py-1.5 rounded-md text-[11px] font-mono transition-colors hover:bg-surface-50"
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2.5 px-2.5">
              <span
                className="text-[10px] font-mono shrink-0 flex items-center gap-1.5"
                style={{ color: colors.text.secondary }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor: lastSaved
                      ? brand.humanAccent
                      : colors.surface[200],
                  }}
                />
                {lastSaved
                  ? `Saved ${lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : "Unsaved"}
              </span>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setRightPanelOpen((v) => !v)}
              className="hidden lg:flex items-center justify-center h-7 w-7 rounded-md border transition-colors hover:opacity-80"
              style={{
                backgroundColor: rightPanelOpen
                  ? colors.text.primary
                  : colors.surface[50],
                borderColor: rightPanelOpen
                  ? colors.text.primary
                  : colors.surface[200],
                color: rightPanelOpen ? "#ffffff" : colors.text.secondary,
              }}
              title="Toggle inspector"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M15 3v18" />
              </svg>
            </button>
            <button
              onClick={handleEndSession}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11.5px] font-semibold transition-all shadow-sm active:scale-95 hover:opacity-90"
              style={{
                backgroundColor: brand.action,
                color: "#ffffff",
                opacity: isSubmitting ? 0.7 : 1,
                cursor: isSubmitting ? "not-allowed" : "pointer",
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className={isSubmitting ? "animate-spin" : ""}
              >
                {isSubmitting ? (
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                ) : (
                  <path
                    d="M5 3l14 9-14 9V3z"
                    fill="currentColor"
                    stroke="none"
                  />
                )}
              </svg>
              {isSubmitting ? "Analysing…" : "End & Analyse"}
            </button>
          </div>
        </header>

        {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          <main
            className="flex-1 overflow-y-auto flex justify-center transition-colors duration-300"
            style={{ backgroundColor: focusMode ? brand.bgPage : brand.bgCard }}
          >
            <div className="w-full max-w-[760px] px-8 md:px-16 py-16 flex flex-col gap-0 mx-auto">
              <div className="mb-10 opacity-60">
                <WordGoalBar current={wordCount} goal={wordGoal} />
              </div>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
                onPaste={handlePaste}
                placeholder="Begin typing to generate your cryptographic proof…"
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                className={`w-full flex-1 min-h-[60vh] bg-transparent border-none outline-none resize-none focus:ring-0 ${fontClass} ${sizeClass} ${lineClass} transition-all duration-200`}
                style={{
                  color: colors.text.primary,
                  caretColor: colors.text.primary,
                  WebkitTextFillColor: focusMode
                    ? colors.text.secondary
                    : undefined,
                }}
              />
              <div
                className="flex items-center justify-between pt-6 border-t mt-12"
                style={{ borderColor: colors.surface[200] }}
              >
                <div
                  className="flex items-center gap-6 text-[11px] font-mono"
                  style={{ color: colors.text.secondary }}
                >
                  <span>{wordCount} w</span>
                  <span>{charCount} c</span>
                  <span>~{readTime}m read</span>
                </div>
              </div>
            </div>
          </main>

          {/* ── RIGHT PANEL ───────────────────────────────────────────────── */}
          <aside
            className={`shrink-0 border-l overflow-y-auto transition-all duration-300 ease-in-out ${rightPanelOpen ? "w-[280px] opacity-100" : "w-0 opacity-0 overflow-hidden"}`}
            style={{
              backgroundColor: brand.bgPage,
              borderColor: colors.surface[200],
            }}
          >
            <div className="p-5 flex flex-col gap-5 min-w-[280px]">
              {/* Signal strength */}
              <div
                className="rounded-md p-4 border shadow-sm"
                style={{
                  backgroundColor: brand.bgCard,
                  borderColor: colors.surface[200],
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: colors.text.secondary }}
                  >
                    Biometric Signal
                  </span>
                  <span
                    className="text-[10px] font-mono font-bold"
                    style={{ color: signalStatus.color }}
                  >
                    {signalCount} pts
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden mb-2"
                  style={{ backgroundColor: colors.surface[100] }}
                >
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${signalStatus.pct}%`,
                      backgroundColor: signalStatus.color,
                    }}
                  />
                </div>
                <div
                  className="text-[10px] font-medium"
                  style={{ color: signalStatus.color }}
                >
                  {signalStatus.label}
                </div>
              </div>

              {/* IKI Waveform */}
              <div
                className="rounded-md border p-4 shadow-sm"
                style={{
                  backgroundColor: brand.bgCard,
                  borderColor: colors.surface[200],
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: colors.text.secondary }}
                  >
                    IKI Waveform
                  </span>
                  <span
                    className="text-[11px] font-mono font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    {stats.avgIki > 0 ? `${stats.avgIki}ms` : "—"}
                  </span>
                </div>
                <div
                  className="h-10 rounded-md overflow-hidden border"
                  style={{
                    backgroundColor: colors.surface[50],
                    borderColor: colors.surface[200],
                  }}
                >
                  <IkiWaveform active={isTyping} />
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2">
                <StatPill label="WPM" value={stats.wpm} highlight />
                <StatPill label="Keystrokes" value={stats.keystrokes} />
                <StatPill label="Deletions" value={stats.deletions} />
                <StatPill label="Pauses" value={stats.pauses} />
              </div>

              {/* Metadata */}
              <div
                className="rounded-md border p-4 flex flex-col gap-2 shadow-sm"
                style={{
                  backgroundColor: brand.bgCard,
                  borderColor: colors.surface[200],
                }}
              >
                <span
                  className="text-[10px] font-bold uppercase tracking-widest mb-1"
                  style={{ color: colors.text.secondary }}
                >
                  Metadata
                </span>
                {[
                  { label: "Duration", value: timerFmt },
                  { label: "Total Words", value: wordCount },
                  {
                    label: "Event Array",
                    value: `${keystrokeLog.current.length} obj`,
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex justify-between items-center border-b last:border-b-0 pb-1.5 last:pb-0"
                    style={{ borderColor: colors.surface[50] }}
                  >
                    <span
                      className="text-[11px]"
                      style={{ color: colors.text.secondary }}
                    >
                      {label}
                    </span>
                    <span
                      className="text-[11.5px] font-mono font-medium"
                      style={{ color: colors.text.primary }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* ── STATUS BAR ────────────────────────────────────────────────────── */}
        <footer
          className="shrink-0 flex items-center justify-between px-4 border-t z-20"
          style={{
            height: 26,
            backgroundColor: brand.action,
            borderColor: brand.action,
          }}
        >
          <div
            className="flex items-center gap-4 text-[10px] font-mono"
            style={{ color: "#ffffff" }}
          >
            <span className="font-semibold uppercase tracking-wider">
              TypeTrace Core
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: isTyping
                    ? brand.humanAccent
                    : "rgba(255,255,255,0.3)",
                }}
              />
              {isTyping ? "Capturing" : "Idle"}
            </span>
          </div>
          <div
            className="flex items-center gap-4 text-[10px] font-mono"
            style={{ color: "#ffffff" }}
          >
            <span>{fontClass.replace("font-", "")}</span>
            <span>Ln 1, Col {text.length}</span>
            <span
              className="font-bold tracking-wider uppercase"
              style={{ color: brand.humanAccent }}
            >
              SHA-256 Enabled
            </span>
          </div>
        </footer>
      </div>

      {/* Analysis modal rendered at root level */}
      {analysisResult && (
        <AnalysisModal
          result={analysisResult}
          onClose={() => navigate(ROUTES.DASHBOARD)}
        />
      )}
    </>
  );
}
