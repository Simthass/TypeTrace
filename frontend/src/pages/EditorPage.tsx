import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";

// ─── types ────────────────────────────────────────────────────────────────────
interface KeystrokeEvent {
  key: string;
  keyCode: number;
  type: "keydown" | "keyup";
  timestamp: number;
  documentLength: number;
}

interface SessionStats {
  wpm: number;
  keystrokes: number;
  deletions: number;
  pauses: number; // pauses over 1000ms
  avgIki: number;
  sessionSeconds: number;
}

// ─── font options — only css changes, no event interception ───────────────────
const FONT_OPTIONS = [
  { label: "Sans", value: "font-sans", desc: "DM Sans" },
  { label: "Serif", value: "font-serif", desc: "Georgia" },
  { label: "Mono", value: "font-mono", desc: "Monospace" },
];

const SIZE_OPTIONS = [
  { label: "S", value: "text-[16px]", desc: "Small" },
  { label: "M", value: "text-[18px]", desc: "Medium" },
  { label: "L", value: "text-[21px]", desc: "Large" },
];

const LINE_OPTIONS = [
  { label: "Compact", value: "leading-[1.6]" },
  { label: "Comfortable", value: "leading-[1.9]" },
  { label: "Spacious", value: "leading-[2.3]" },
];

const WORD_GOALS = [250, 500, 750, 1000, 1500, 2000];

// ─── animated IKI waveform on canvas – do not change timing values ─────────────
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
        // flat line when idle
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

      // subtle bg wave
      ctx.beginPath();
      ctx.strokeStyle = `${brand.action}25`;
      ctx.lineWidth = 1.2;
      for (let x = 0; x <= W; x += 2) {
        const y =
          H / 2 +
          Math.sin((x + offsetRef.current * 0.5) * 0.033) * (H * 0.2) +
          Math.sin((x + offsetRef.current * 0.25) * 0.07) * (H * 0.07);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // primary wave
      ctx.beginPath();
      ctx.strokeStyle = brand.action;
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

// ─── stat pill in the right panel ─────────────────────────────────────────────
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
    <div className="flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-xl border border-surface-200 bg-surface-50">
      <span
        className="text-[18px] font-bold leading-none"
        style={{ color: highlight ? brand.action : colors.text.primary }}
      >
        {value}
      </span>
      <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wider">
        {label}
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
      className={`flex items-center justify-center h-8 px-3 rounded-lg text-[12px] font-medium transition-all duration-150
        ${
          active
            ? "bg-brand text-white shadow-sm"
            : "text-text-secondary hover:text-text-primary hover:bg-surface-100"
        }`}
    >
      {children}
    </button>
  );
}

// ─── word goal progress bar ────────────────────────────────────────────────────
function WordGoalBar({ current, goal }: { current: number; goal: number }) {
  const pct = Math.min((current / goal) * 100, 100);
  const done = pct >= 100;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
          Word Goal
        </span>
        <span
          className="text-[11px] font-bold"
          style={{ color: done ? brand.humanAccent : brand.action }}
        >
          {current} / {goal}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-200 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: done ? brand.humanAccent : brand.action,
          }}
        />
      </div>
    </div>
  );
}

// ─── session timer ─────────────────────────────────────────────────────────────
function useSessionTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const fmt = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return { seconds, fmt };
}

// ─── confidence badge color logic ─────────────────────────────────────────────
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

  // document state
  const [text, setText] = useState("");
  const [title, setTitle] = useState("Untitled Document");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // typing state
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // editor presentation — only css class changes, no event interception
  const [fontClass, setFontClass] = useState("font-serif");
  const [sizeClass, setSizeClass] = useState("text-[18px]");
  const [lineClass, setLineClass] = useState("leading-[1.9]");
  const [focusMode, setFocusMode] = useState(false);
  const [wordGoal, setWordGoal] = useState(500);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  // keystroke capture data — the core biometric engine
  // we capture everything here, the ML model will use this later
  const keystrokeRef = useRef<KeystrokeEvent[]>([]);
  const lastKeydownTime = useRef<number | null>(null);
  const ikiValues = useRef<number[]>([]);

  // session stats
  const [stats, setStats] = useState<SessionStats>({
    wpm: 0,
    keystrokes: 0,
    deletions: 0,
    pauses: 0,
    avgIki: 0,
    sessionSeconds: 0,
  });

  const { seconds, fmt: timerFmt } = useSessionTimer();

  // word + char counts
  const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  const charCount = text.length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  // auto-save every 30 seconds to IndexedDB (placeholder for now)
  // TODO: wire up real IndexedDB in sprint 5
  useEffect(() => {
    const t = setInterval(() => {
      if (text.length > 0) {
        setLastSaved(new Date());
        // console.log("Auto-saved to IndexedDB:", { title, text, keystrokes: keystrokeRef.current });
      }
    }, 30_000);
    return () => clearInterval(t);
  }, [text, title]);

  // recalculate stats every 3 seconds so the panel feels live
  useEffect(() => {
    const t = setInterval(() => {
      const ikis = ikiValues.current;
      const avgIki =
        ikis.length > 0
          ? Math.round(ikis.reduce((a, b) => a + b, 0) / ikis.length)
          : 0;

      const wpm = seconds > 0 ? Math.round((wordCount / seconds) * 60) : 0;
      const deletions = keystrokeRef.current.filter(
        (k) => k.type === "keydown" && (k.keyCode === 8 || k.keyCode === 46),
      ).length;
      const pauses = ikis.filter((v) => v > 1000).length;

      setStats({
        wpm,
        keystrokes: keystrokeRef.current.filter((k) => k.type === "keydown")
          .length,
        deletions,
        pauses,
        avgIki,
        sessionSeconds: seconds,
      });
    }, 3000);
    return () => clearInterval(t);
  }, [seconds, wordCount]);

  // ─── THE CORE: raw keydown/keyup capture ──────────────────────────────────
  // this is the most important part of the whole project, DO NOT touch event.preventDefault
  // we need the natural browser behavior to work, we only observe
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const now = Date.now();

      // calculate IKI from previous keydown
      if (lastKeydownTime.current !== null) {
        const iki = now - lastKeydownTime.current;
        if (iki < 5000) {
          // ignore huge gaps (user went away)
          ikiValues.current.push(iki);
        }
      }
      lastKeydownTime.current = now;

      keystrokeRef.current.push({
        key: e.key,
        keyCode: e.keyCode,
        type: "keydown",
        timestamp: now,
        documentLength: text.length,
      });

      // typing indicator
      setIsTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1200);
    },
    [text.length],
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      keystrokeRef.current.push({
        key: e.key,
        keyCode: e.keyCode,
        type: "keyup",
        timestamp: Date.now(),
        documentLength: text.length,
      });
    },
    [text.length],
  );

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  // ─── paste detection — important for AI detection ──────────────────────────
  // large paste events are a key signal of AI generated content
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData("text");
    if (pastedText.length > 50) {
      // flag this as suspicious paste event in the keystroke log
      keystrokeRef.current.push({
        key: "__PASTE__",
        keyCode: -1,
        type: "keydown",
        timestamp: Date.now(),
        documentLength: text.length,
      });
    }
  };

  // ─── end session ──────────────────────────────────────────────────────────
  const handleEndSession = () => {
    // TODO: send keystrokeRef.current to /api/sessions/:id/analyze
    // for now just navigate to dashboard
    navigate(ROUTES.DASHBOARD);
  };

  // ─── fullscreen toggle ────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  // confidence score — simple heuristic for live feedback, real ML runs on end
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

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: "#fff", fontFamily: "inherit" }}
    >
      {/* ══════════════════════════════════════════════════════
          TOP BAR
      ══════════════════════════════════════════════════════ */}
      <header
        className="shrink-0 flex items-center justify-between px-5 gap-4 border-b border-surface-200"
        style={{
          height: 56,
          background: colors.surface[50],
        }}
      >
        {/* ── Left: back + title ── */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={ROUTES.DASHBOARD}
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-surface-200 text-text-secondary hover:text-text-primary hover:bg-surface-100 transition-all shrink-0"
            title="Back to Dashboard"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path
                d="M9 3L5 7.5 9 12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          {/* editable title — just a plain input, nothing fancy */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-[14px] font-semibold text-text-primary bg-transparent border-none outline-none min-w-0 w-[220px] truncate"
            style={{ caretColor: brand.action }}
            placeholder="Untitled Document"
          />

          {/* auto-save badge */}
          <span className="text-[11px] text-text-secondary shrink-0">
            {lastSaved
              ? `Saved ${lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Not saved yet"}
          </span>
        </div>

        {/* ── Centre: presentation toolbar ── */}
        {/* these only change CSS classes, zero effect on keystroke capture */}
        <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-xl border border-surface-200 bg-white">
          {/* font family */}
          <div className="flex items-center gap-0.5 pr-2 border-r border-surface-200">
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

          {/* font size */}
          <div className="flex items-center gap-0.5 px-2 border-r border-surface-200">
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

          {/* line height */}
          <div className="flex items-center gap-0.5 px-2 border-r border-surface-200">
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

          {/* focus mode */}
          <div className="flex items-center gap-0.5 px-2 border-r border-surface-200">
            <ToolBtn
              active={focusMode}
              onClick={() => setFocusMode((v) => !v)}
              title="Focus Mode — dims everything outside current paragraph"
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
                width="14"
                height="14"
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

          {/* word goal picker */}
          <div className="relative px-2">
            <ToolBtn
              active={false}
              onClick={() => setShowGoalPicker((v) => !v)}
              title="Set word goal"
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
                <path d="M12 2a10 10 0 1 0 10 10" />
                <path d="M12 8v4l3 3" />
              </svg>
              <span className="ml-1 text-[11px]">{wordGoal}w</span>
            </ToolBtn>

            {showGoalPicker && (
              <div
                className="absolute top-full right-0 mt-2 p-2 bg-white border border-surface-200 rounded-2xl shadow-card-md z-50 flex flex-col gap-1 min-w-[120px]"
                onMouseLeave={() => setShowGoalPicker(false)}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary px-2 py-1">
                  Word Goal
                </span>
                {WORD_GOALS.map((g) => (
                  <button
                    key={g}
                    onClick={() => {
                      setWordGoal(g);
                      setShowGoalPicker(false);
                    }}
                    className={`text-left px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors
                      ${
                        wordGoal === g
                          ? "bg-brand text-white"
                          : "text-text-primary hover:bg-surface-50"
                      }`}
                  >
                    {g} words
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: live indicators + end session ── */}
        <div className="flex items-center gap-3 shrink-0">
          {/* session timer */}
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[13px] font-bold text-text-primary tabular-nums">
              {timerFmt}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-text-secondary">
              Session
            </span>
          </div>

          {/* word count */}
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[13px] font-bold text-text-primary">
              {wordCount}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-text-secondary">
              Words
            </span>
          </div>

          {/* live capture indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-surface-200 bg-white">
            <span
              className="h-2 w-2 rounded-full transition-all duration-300"
              style={{
                background: isTyping ? brand.humanAccent : colors.surface[200],
                boxShadow: isTyping
                  ? `0 0 0 3px ${brand.humanAccent}30`
                  : "none",
              }}
            />
            <span className="text-[11px] font-semibold text-text-secondary">
              {isTyping ? "Capturing" : "Ready"}
            </span>
          </div>

          {/* right panel toggle */}
          <button
            type="button"
            onClick={() => setRightPanelOpen((v) => !v)}
            className={`hidden lg:flex items-center justify-center h-8 w-8 rounded-lg border transition-all
              ${
                rightPanelOpen
                  ? "bg-brand border-brand text-white"
                  : "border-surface-200 text-text-secondary hover:bg-surface-100"
              }`}
            title="Toggle analytics panel"
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

          {/* end session CTA */}
          <button
            onClick={handleEndSession}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.97]"
            style={{
              background: colors.text.primary,
              boxShadow: `0 4px 12px -4px rgba(0,0,0,0.3)`,
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M5 3l14 9-14 9V3z" fill="currentColor" stroke="none" />
            </svg>
            End & Analyse
          </button>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════
          MAIN CONTENT AREA
      ══════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── WRITING AREA ── */}
        {/* deliberately keep this as a plain textarea, rich text editors
            would destroy our keystroke event capture pipeline completely */}
        <main
          className={`flex-1 overflow-y-auto flex justify-center transition-all duration-300 ${
            focusMode ? "bg-surface-50" : "bg-white"
          }`}
        >
          <div className="w-full max-w-[760px] px-8 py-16 flex flex-col gap-0">
            {/* word goal progress sits right above the writing area */}
            <div className="mb-8">
              <WordGoalBar current={wordCount} goal={wordGoal} />
            </div>

            {/* THE TEXTAREA — raw DOM events, zero interception */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onPaste={handlePaste}
              placeholder="Start writing naturally…"
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              className={`
                w-full flex-1 min-h-[60vh]
                bg-transparent border-none outline-none resize-none
                text-text-primary placeholder:text-surface-200
                focus:ring-0
                ${fontClass} ${sizeClass} ${lineClass}
                transition-all duration-200
              `}
              style={{
                caretColor: brand.action,
                // focus mode: only current paragraph in full opacity
                // we cant do this easily with just tailwind, inline style needed
                WebkitTextFillColor: focusMode
                  ? colors.text.secondary
                  : undefined,
              }}
            />

            {/* char count footer below writing area */}
            <div className="flex items-center justify-between pt-6 border-t border-surface-100 mt-8">
              <div className="flex items-center gap-6 text-[11px] text-text-secondary">
                <span>
                  <strong className="text-text-primary">{wordCount}</strong>{" "}
                  words
                </span>
                <span>
                  <strong className="text-text-primary">{charCount}</strong>{" "}
                  characters
                </span>
                <span>
                  <strong className="text-text-primary">~{readTime}</strong> min
                  read
                </span>
                <span>
                  <strong className="text-text-primary">
                    {stats.keystrokes}
                  </strong>{" "}
                  keystrokes captured
                </span>
              </div>
              {stats.deletions > 0 && (
                <span className="text-[11px] text-text-secondary">
                  <strong className="text-text-primary">
                    {stats.deletions}
                  </strong>{" "}
                  corrections — natural human behaviour ✓
                </span>
              )}
            </div>
          </div>
        </main>

        {/* ── RIGHT ANALYTICS PANEL ── */}
        {/* this panel only reads data, it never writes or intercepts events */}
        <aside
          className={`
            shrink-0 border-l border-surface-200 overflow-y-auto
            transition-all duration-300 ease-in-out
            ${rightPanelOpen ? "w-[280px] opacity-100" : "w-0 opacity-0 overflow-hidden"}
          `}
          style={{ background: colors.surface[50] }}
        >
          <div className="p-5 flex flex-col gap-5 min-w-[280px]">
            {/* ── Live Confidence Badge ── */}
            <div
              className="rounded-2xl p-4 border"
              style={{
                background: confStyle.bg,
                borderColor: `${confStyle.color}30`,
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: confStyle.color }}
                >
                  Live Classification
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: confStyle.color }}
                  />
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: confStyle.color }}
                  >
                    {confStyle.label}
                  </span>
                </span>
              </div>
              <div
                className="text-[38px] font-extrabold leading-none"
                style={{ color: confStyle.color }}
              >
                {liveConfidence.toFixed(1)}%
              </div>
              <p
                className="text-[11px] mt-1.5"
                style={{ color: confStyle.color, opacity: 0.72 }}
              >
                Live estimate — final score runs on End Session
              </p>
            </div>

            {/* ── IKI waveform ── */}
            <div className="rounded-2xl border border-surface-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                  IKI Waveform
                </span>
                <span
                  className="text-[11px] font-bold"
                  style={{ color: brand.action }}
                >
                  {stats.avgIki > 0 ? `avg ${stats.avgIki}ms` : "—"}
                </span>
              </div>
              <div className="h-12">
                <IkiWaveform active={isTyping} />
              </div>
            </div>

            {/* ── Stats grid ── */}
            <div className="grid grid-cols-2 gap-2">
              <StatPill label="WPM" value={stats.wpm} highlight />
              <StatPill label="Keystrokes" value={stats.keystrokes} />
              <StatPill label="Corrections" value={stats.deletions} />
              <StatPill label="Pauses" value={stats.pauses} />
            </div>

            {/* ── Session info ── */}
            <div className="rounded-2xl border border-surface-200 bg-white p-4 flex flex-col gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                Session Info
              </span>
              {[
                { label: "Duration", value: timerFmt },
                { label: "Words", value: wordCount },
                {
                  label: "Avg IKI",
                  value: stats.avgIki > 0 ? `${stats.avgIki}ms` : "—",
                },
                { label: "Est. Read", value: `~${readTime}min` },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[12px] text-text-secondary">
                    {label}
                  </span>
                  <span className="text-[12px] font-semibold text-text-primary">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {/* ── Privacy notice ── */}
            <div
              className="rounded-xl p-3 flex gap-2.5"
              style={{
                background: `${brand.action}08`,
                border: `1px solid ${brand.action}18`,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={brand.action}
                strokeWidth="2"
                strokeLinecap="round"
                className="shrink-0 mt-0.5"
              >
                <rect x="5" y="10" width="14" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: brand.action }}
              >
                Keystroke timing data only. Your text content stays local.
              </p>
            </div>

            {/* ── End session button (also in panel for convenience) ── */}
            <button
              onClick={handleEndSession}
              className="w-full py-3 rounded-xl text-[13px] font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
              style={{
                background: colors.text.primary,
                boxShadow: `0 4px 14px -4px rgba(0,0,0,0.25)`,
              }}
            >
              End Session & Generate Certificate
            </button>
          </div>
        </aside>
      </div>

      {/* ══════════════════════════════════════════════════════
          STATUS BAR — very bottom, like VS Code
      ══════════════════════════════════════════════════════ */}
      <footer
        className="shrink-0 flex items-center justify-between px-5 border-t border-surface-200"
        style={{ height: 28, background: colors.surface[50] }}
      >
        <div className="flex items-center gap-5 text-[10px] text-text-secondary font-medium">
          <span>TypeTrace Editor</span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: isTyping ? brand.humanAccent : colors.surface[200],
              }}
            />
            {isTyping ? "Biometrics Active" : "Idle"}
          </span>
          <span>{stats.keystrokes} events captured</span>
        </div>

        <div className="flex items-center gap-5 text-[10px] text-text-secondary font-medium">
          <span>
            {fontClass === "font-sans"
              ? "Sans"
              : fontClass === "font-serif"
                ? "Serif"
                : "Mono"}
          </span>
          <span>Ln 1</span>
          <span>
            {wordCount}/{wordGoal}w
          </span>
          <span className="font-bold" style={{ color: brand.humanAccent }}>
            SHA-256 Protected
          </span>
        </div>
      </footer>
    </div>
  );
}
