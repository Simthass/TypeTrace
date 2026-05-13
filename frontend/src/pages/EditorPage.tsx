import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";
import { api } from "../lib/api"; // importing the global axios instance

// ─── types ────────────────────────────────────────────────────────────────────
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
}

interface SessionStats {
  wpm: number;
  keystrokes: number;
  deletions: number;
  pauses: number;
  avgIki: number;
  sessionSeconds: number;
}

// ─── font options ─────────────────────────────────────────────────────────────
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

// ─── animated IKI waveform on canvas ──────────────────────────────────────────
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

// ─── stat pill (Inspector Style) ──────────────────────────────────────────────
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
      className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-md border shadow-sm transition-colors"
      style={{
        backgroundColor: brand.bgCard,
        borderColor: colors.surface[200],
      }}
    >
      <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-widest">
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

// ─── toolbar icon button ──────────────────────────────────────────────────────
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

// ─── word goal progress bar ───────────────────────────────────────────
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
        className="h-1 rounded-none overflow-hidden"
        style={{ backgroundColor: colors.surface[200] }}
      >
        <div
          className="h-full rounded-none transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: done ? brand.humanAccent : colors.text.primary,
          }}
        />
      </div>
    </div>
  );
}

// ─── session timer ────────────────────────────────────────────────────────────
function useSessionTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const fmt = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return { seconds, fmt };
}

function getConfidenceStyle(score: number) {
  if (score >= 80)
    return { color: brand.humanAccent, bg: brand.humanBg, label: "HUMAN" };
  if (score >= 55)
    return {
      color: brand.suspiciousAccent,
      bg: brand.suspiciousBg,
      label: "SUSPICIOUS",
    };
  return { color: brand.aiAccent, bg: brand.aiBg, label: "AI-RISK" };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EDITOR PAGE
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

  // --- SPRINT 1: BIOMETRIC ENGINE REFS ---
  // using refs cos if i put this in state react re-renders on every keystroke and it lags af
  const keystrokeLog = useRef<KeystrokeEvent[]>([]);
  const activeKeys = useRef<{ [key: string]: number }>({}); // tracking physical keys using e.code now so shift doesnt break it
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

  // auto save mock
  useEffect(() => {
    const t = setInterval(() => {
      if (text.length > 0) setLastSaved(new Date());
    }, 30_000);
    return () => clearInterval(t);
  }, [text, title]);

  // UI stats updater (runs every 3 seconds so it doesnt spam re-renders)
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
  }, [seconds, wordCount]);

  // --- ENGINE: KEYDOWN ---
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const now = Date.now();

      // ignore holding down the key auto-repeat otherwise data gets super weird
      if (e.repeat) return;

      // calc flight time from previous key
      let flightTime = null;
      if (lastKeydownTime.current !== null) {
        flightTime = now - lastKeydownTime.current;
        // capping it at 5s cos if they go for lunch we dont want a 30 min IKI ruining the average math
        if (flightTime < 5000) ikiValues.current.push(flightTime);
      }
      lastKeydownTime.current = now;

      // BUG FIX: using e.code (the physical key) instead of e.key so Shift doesn't break the dwell time calculation lol
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

  // --- ENGINE: KEYUP ---
  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const now = Date.now();

      // BUG FIX: pulling the start time using e.code to match the keydown
      const downTime = activeKeys.current[e.code];

      let dwellTime = null;
      if (downTime) {
        dwellTime = now - downTime;
        delete activeKeys.current[e.code];
      }

      keystrokeLog.current.push({
        key: e.key,
        keyCode: e.keyCode,
        type: "keyup",
        timestamp: now,
        down_time: downTime || now,
        up_time: now,
        dwell_time: dwellTime,
        flight_time: null,
        documentLength: text.length,
      });
    },
    [text.length],
  );

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setText(e.target.value);

  // --- ENGINE: PASTE DETECTION ---
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

  // --- ENGINE: SEND DATA TO BACKEND ---
  const handleEndSession = async () => {
    // block double clicks so we dont spam the database
    if (isSubmitting) return;

    // prof said validate before sending to save server costs
    if (keystrokeLog.current.length < 10 || text.trim().length === 0) {
      alert("Session too short bro, type some more words first.");
      return;
    }

    setIsSubmitting(true);

    try {
      // calculating final stats here right before sending so react state delays dont mess up my db payload
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

      const finalStats = {
        wpm: finalWpm,
        keystrokes: keystrokeLog.current.filter((k) => k.type === "keydown")
          .length,
        deletions: finalDeletions,
        pauses: finalPauses,
        avgIki: finalAvgIki,
        sessionSeconds: seconds,
      };

      const payload = {
        title: title || "Untitled Document",
        text_content: text,
        keystroke_array: keystrokeLog.current,
        stats: finalStats,
      };

      console.log("sending this massive blob to fastAPI...", payload);

      // my global axios interceptor automatically attaches the Bearer token here!
      const response = await api.post("/sessions/analyze", payload);

      console.log("Success! DB saved it with ID:", response.data.id);
      navigate(ROUTES.DASHBOARD);
    } catch (error: any) {
      console.error("bruh the api failed:", error);
      alert(
        error.response?.data?.detail ||
          "Failed to analyze session. Is the python server running?",
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

  const liveConfidence = Math.max(
    20,
    Math.min(
      99,
      100 -
        (ikiValues.current.length > 5
          ? Math.max(
              0,
              30 -
                (ikiValues.current.filter((v) => v > 150).length /
                  ikiValues.current.length) *
                  30,
            )
          : 10) -
        (stats.deletions < 2 && wordCount > 50 ? 8 : 0),
    ),
  );
  const confStyle = getConfidenceStyle(liveConfidence);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  return (
    <div
      className="flex flex-col h-screen overflow-hidden font-sans"
      style={{ backgroundColor: brand.bgPage }}
    >
      {/* ══════════════════════════════════════════════════════
          TOP BAR (Monochromatic & Sharp)
      ══════════════════════════════════════════════════════ */}
      <header
        className="shrink-0 flex items-center justify-between px-5 gap-4 border-b z-20"
        style={{
          height: 50,
          backgroundColor: brand.bgCard,
          borderColor: colors.surface[200],
        }}
      >
        {/* ── Left: back + title ── */}
        <div className="flex items-center gap-3 min-w-0 flex-1 max-w-[400px]">
          <Link
            to={ROUTES.DASHBOARD}
            className="flex items-center justify-center h-7 w-7 rounded-md border transition-colors shrink-0"
            style={{
              borderColor: colors.surface[200],
              backgroundColor: colors.surface[50],
              color: colors.text.secondary,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = colors.text.primary)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = colors.text.secondary)
            }
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

        {/* ── Centre: presentation toolbar + Save Status ── */}
        <div
          className="hidden md:flex items-center gap-1 px-1.5 py-1 rounded-md border"
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
              title="Set word goal"
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
                    className="text-left px-2 py-1.5 rounded-md text-[11px] font-mono transition-colors"
                    style={{
                      backgroundColor:
                        wordGoal === g ? colors.surface[100] : "transparent",
                      color: colors.text.primary,
                    }}
                    onMouseEnter={(e) =>
                      wordGoal !== g &&
                      (e.currentTarget.style.backgroundColor =
                        colors.surface[50])
                    }
                    onMouseLeave={(e) =>
                      wordGoal !== g &&
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
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

        {/* ── Right: session controls ── */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setRightPanelOpen((v) => !v)}
            className="hidden lg:flex items-center justify-center h-7 w-7 rounded-md border transition-colors"
            style={{
              backgroundColor: rightPanelOpen
                ? colors.text.primary
                : colors.surface[50],
              borderColor: rightPanelOpen
                ? colors.text.primary
                : colors.surface[200],
              color: rightPanelOpen ? colors.text.light : colors.text.secondary,
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[11.5px] font-semibold transition-all shadow-sm"
            style={{
              backgroundColor: brand.action,
              color: colors.text.light,
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
              className={isSubmitting ? "animate-pulse" : ""}
            >
              <path d="M5 3l14 9-14 9V3z" fill="currentColor" stroke="none" />
            </svg>
            {isSubmitting ? "Analyzing..." : "End & Analyse"}
          </button>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════
          MAIN CONTENT AREA
      ══════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* ── WRITING AREA ── */}
        <main
          className="flex-1 overflow-y-auto flex justify-center transition-colors duration-300"
          style={{ backgroundColor: focusMode ? brand.bgPage : brand.bgCard }}
        >
          <div className="w-full max-w-[1200px] px-8 md:px-16 py-16 flex flex-col gap-0 relative mx-auto">
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
              placeholder="Begin typing to generate your cryptographic proof..."
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

        {/* ── RIGHT ANALYTICS PANEL (Inspector Aesthetic) ── */}
        <aside
          className={`shrink-0 border-l overflow-y-auto transition-all duration-300 ease-in-out ${rightPanelOpen ? "w-[280px] opacity-100" : "w-0 opacity-0 overflow-hidden"}`}
          style={{
            backgroundColor: brand.bgPage,
            borderColor: colors.surface[200],
          }}
        >
          <div className="p-5 flex flex-col gap-5 min-w-[280px]">
            {/* Live Confidence Badge */}
            <div
              className="rounded-md p-4 border"
              style={{
                backgroundColor: confStyle.bg,
                borderColor: `${confStyle.color}40`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: confStyle.color }}
                >
                  Classification
                </span>
                <span
                  className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md border"
                  style={{
                    backgroundColor: brand.bgCard,
                    borderColor: `${confStyle.color}30`,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: confStyle.color }}
                  />
                  <span
                    className="text-[9px] font-bold uppercase tracking-widest"
                    style={{ color: confStyle.color }}
                  >
                    {confStyle.label}
                  </span>
                </span>
              </div>
              <div
                className="text-[32px] font-mono font-bold leading-none tracking-tight"
                style={{ color: confStyle.color }}
              >
                {liveConfidence.toFixed(1)}%
              </div>
            </div>

            {/* IKI Waveform Inspector */}
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

            {/* Grid Metrics */}
            <div className="grid grid-cols-2 gap-2">
              <StatPill label="WPM" value={stats.wpm} highlight />
              <StatPill label="Keystrokes" value={stats.keystrokes} />
              <StatPill label="Corrections" value={stats.deletions} />
              <StatPill label="Pauses" value={stats.pauses} />
            </div>

            {/* Session Metadata */}
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

            {/* Security Notice */}
            <div
              className="rounded-md p-3 border mt-2"
              style={{
                backgroundColor: colors.surface[100],
                borderColor: colors.surface[200],
              }}
            >
              <p
                className="text-[10px] leading-relaxed"
                style={{ color: colors.text.secondary }}
              >
                <strong style={{ color: colors.text.primary }}>
                  Data Sovereignty:
                </strong>{" "}
                Keystroke timing metadata is processed locally. Text content
                never leaves this browser instance.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* ══════════════════════════════════════════════════════
          STATUS BAR (Bottom, VS Code Style)
      ══════════════════════════════════════════════════════ */}
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
          style={{ color: colors.text.light }}
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
                  : colors.surface[200],
              }}
            />
            {isTyping ? "Capturing" : "Idle"}
          </span>
        </div>

        <div
          className="flex items-center gap-4 text-[10px] font-mono"
          style={{ color: colors.text.light }}
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
  );
}
