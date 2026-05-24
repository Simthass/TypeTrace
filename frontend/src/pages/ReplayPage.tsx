// src/pages/ReplayPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// TypeTrace — Behavioral Replay Engine
// Now with real pasted text reconstruction instead of [█ PASTED CHUNK █]
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Play,
  Pause,
  RotateCcw,
  Activity,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Clipboard,
} from "lucide-react";
import clsx from "clsx";
import { api } from "../lib/api";
import { ROUTES } from "../constants/routes";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface KeystrokeEvent {
  key: string;
  keyCode: number;
  type: string;
  timestamp: number;
  relative_time_ms?: number;
  down_time: number;
  up_time: number | null;
  dwell_time: number | null;
  flight_time: number | null;
  documentLength: number;
  pastedText?: string; // ← Present on paste events from updated editor
}

interface SessionMetadata {
  title: string;
  classification: "HUMAN" | "SUSPICIOUS" | "AI-GENERATED" | "UNKNOWN";
  confidence: number;
  duration_ms: number;
  word_count: number;
  student_id: string;
}

interface BehavioralMetrics {
  avg_iki: number;
  dwell_time: number;
  deletion_ratio: number;
  paste_count: number;
  longest_pause_ms: number;
  burst_count: number;
  wpm: number;
  active_time_pct: number;
}

// Represents a segment of the reconstructed document.
// Typed text is one segment; each paste is a separate segment so we can
// style it differently — amber background to visually distinguish it.
interface TextSegment {
  text: string;
  isPaste: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

type BadgeVariant = "default" | "success" | "warning" | "danger";

const Badge: React.FC<{
  children: React.ReactNode;
  variant?: BadgeVariant;
}> = ({ children, variant = "default" }) => {
  const styles: Record<BadgeVariant, string> = {
    default: "bg-gray-100 text-gray-700 border-gray-200",
    success: "bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]",
    warning: "bg-[#fefce8] text-[#a16207] border-[#fef08a]",
    danger: "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
  };
  return (
    <span
      className={clsx(
        "px-2 py-0.5 text-[11px] font-bold tracking-widest uppercase rounded-md border",
        styles[variant],
      )}
    >
      {children}
    </span>
  );
};

const MetricBlock: React.FC<{
  label: string;
  value: string | number;
  unit?: string;
}> = ({ label, value, unit = "" }) => (
  <div className="flex flex-col py-3 border-b border-gray-100 last:border-0">
    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
      {label}
    </span>
    <div className="flex items-baseline gap-1">
      <span className="text-[16px] font-mono font-medium text-gray-900">
        {value}
      </span>
      {unit && (
        <span className="text-[12px] font-mono text-gray-400">{unit}</span>
      )}
    </div>
  </div>
);

// Renders the reconstructed document as a series of segments.
// Typed text renders normally; pasted chunks get an amber highlight with a
// clipboard icon so examiners can immediately spot what was pasted.
const ReconstructedDocument: React.FC<{
  segments: TextSegment[];
  isPlaying: boolean;
}> = ({ segments, isPlaying }) => {
  if (segments.length === 0) {
    return (
      <span className="text-gray-300 select-none">
        {isPlaying
          ? "Replaying keystrokes..."
          : "Press play to begin the reconstruction."}
      </span>
    );
  }

  return (
    <>
      {segments.map((seg, i) =>
        seg.isPaste ? (
          // Pasted chunk — amber highlight, clipboard icon, slightly different font
          <span key={i} className="inline relative" title="Pasted content">
            <span
              className="inline-flex items-baseline gap-0.5 px-[3px] py-[1px] rounded mx-[1px]"
              style={{
                backgroundColor: "#fef9c3", // amber-100
                borderBottom: "2px solid #f59e0b", // amber-400 underline
                color: "#92400e", // amber-800
              }}
            >
              {/* Tiny clipboard icon sits at the start of each paste block */}
              <Clipboard
                size={10}
                className="inline shrink-0 relative top-[-1px]"
                style={{ color: "#f59e0b" }}
              />
              {seg.text}
            </span>
          </span>
        ) : (
          // Normal typed text
          <span key={i}>{seg.text}</span>
        ),
      )}
      {/* Blinking cursor when playing */}
      {isPlaying && (
        <span className="inline-block w-[2px] h-[1em] bg-gray-900 ml-[1px] animate-pulse" />
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN REPLAY ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export default function ReplayPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  // ── API State ───────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ── Replay Data State ───────────────────────────────────────────────────────
  const [metadata, setMetadata] = useState<SessionMetadata | null>(null);
  const [metrics, setMetrics] = useState<BehavioralMetrics | null>(null);
  const [events, setEvents] = useState<KeystrokeEvent[]>([]);
  const [maxTime, setMaxTime] = useState<number>(1000);

  // ── Playback Engine State ───────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [segments, setSegments] = useState<TextSegment[]>([]);
  const [isPausedEvent, setIsPausedEvent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"live" | "stream">("live");

  const animationRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(
    null,
  );
  const lastUpdateRef = useRef<number>(0);

  // ── FETCH FROM BACKEND ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;

    const fetchReplayData = async (): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await api.get<{
          session: SessionMetadata;
          metrics: BehavioralMetrics;
          events: KeystrokeEvent[];
        }>(`/sessions/${sessionId}/replay`);

        const data = response.data;
        setMetadata(data.session);
        setMetrics(data.metrics);

        const rawEvents: KeystrokeEvent[] = data.events || [];
        if (rawEvents.length > 0) {
          const startTime = rawEvents[0].timestamp;
          const normalizedEvents: KeystrokeEvent[] = rawEvents.map((e) => ({
            ...e,
            relative_time_ms: e.timestamp - startTime,
          }));
          setEvents(normalizedEvents);

          const lastEventTime =
            normalizedEvents[normalizedEvents.length - 1].relative_time_ms ??
            1000;
          setMaxTime(Math.max(data.session.duration_ms, lastEventTime, 1000));
        } else {
          setMaxTime(data.session.duration_ms || 1000);
        }
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        console.error("Failed to load replay data:", err);
        setError(
          axiosErr.response?.data?.detail ??
            "Failed to load replay. Access denied or session not found.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchReplayData();
  }, [sessionId]);

  // ── FORMATTING HELPERS ──────────────────────────────────────────────────────
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}m ${String(secs).padStart(2, "0")}s`;
  };

  // ── PLAYBACK LOOP ───────────────────────────────────────────────────────────
  const playLoop = useCallback(
    (timestamp: number): void => {
      if (lastUpdateRef.current === 0) lastUpdateRef.current = timestamp;
      const delta = timestamp - lastUpdateRef.current;
      lastUpdateRef.current = timestamp;

      setCurrentTimeMs((prev) => {
        const nextTime = prev + delta * playbackSpeed;
        if (nextTime >= maxTime) {
          setIsPlaying(false);
          return maxTime;
        }
        return nextTime;
      });

      animationRef.current = requestAnimationFrame(playLoop);
    },
    [playbackSpeed, maxTime],
  );

  useEffect(() => {
    if (isPlaying) {
      lastUpdateRef.current = 0;
      animationRef.current = requestAnimationFrame(playLoop);
    } else {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }
    return () => {
      if (animationRef.current !== null)
        cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, playLoop]);

  // ── BEHAVIORAL TEXT RECONSTRUCTION ENGINE ───────────────────────────────────
  // Rebuilds the document as an array of TextSegments so typed and pasted
  // content can be styled differently in the render phase.
  useEffect(() => {
    if (!events.length) return;

    const currentEventIndex = events.findIndex(
      (e) => (e.relative_time_ms ?? 0) > currentTimeMs,
    );
    const activeEvents =
      currentEventIndex === -1 ? events : events.slice(0, currentEventIndex);

    // Build segments incrementally.
    // We maintain a running "typed" buffer; when we encounter a paste event
    // we flush that buffer as a typed segment, then push the paste as its own
    // segment.  This preserves correct ordering of typed + pasted content.
    const newSegments: TextSegment[] = [];
    let currentTypedBuffer = "";
    let pauseDetected: string | null = null;

    const flushTyped = (): void => {
      if (currentTypedBuffer.length > 0) {
        newSegments.push({ text: currentTypedBuffer, isPaste: false });
        currentTypedBuffer = "";
      }
    };

    activeEvents.forEach((evt) => {
      if (evt.type === "keydown") {
        if (evt.key === "__PASTE_EVENT__") {
          // Flush anything typed before this paste
          flushTyped();

          if (evt.pastedText) {
            // New behavior: show the actual pasted text
            newSegments.push({ text: evt.pastedText, isPaste: true });
          } else {
            // Fallback for old sessions recorded before this fix was applied
            // (they won't have pastedText stored)
            newSegments.push({ text: "[pasted content]", isPaste: true });
          }
        } else if (evt.key === "Backspace") {
          // Backspace removes from the current typed buffer if it has content,
          // otherwise it removes from the last segment.
          if (currentTypedBuffer.length > 0) {
            currentTypedBuffer = currentTypedBuffer.slice(0, -1);
          } else if (newSegments.length > 0) {
            const lastSeg = newSegments[newSegments.length - 1];
            if (lastSeg.text.length > 1) {
              newSegments[newSegments.length - 1] = {
                ...lastSeg,
                text: lastSeg.text.slice(0, -1),
              };
            } else {
              // Segment is now empty — remove it entirely
              newSegments.pop();
            }
          }
        } else if (evt.key === "Enter") {
          currentTypedBuffer += "\n";
        } else if (evt.key.length === 1) {
          currentTypedBuffer += evt.key;
        }
      }

      // Cognitive pause detection (flight_time > 5s)
      if (evt.flight_time !== null && evt.flight_time > 5000) {
        pauseDetected = (evt.flight_time / 1000).toFixed(1);
      }
    });

    // Flush whatever is left in the typed buffer
    flushTyped();

    setSegments(newSegments);
    setIsPausedEvent(isPlaying ? pauseDetected : null);
  }, [currentTimeMs, events, isPlaying]);

  // ── BADGE VARIANT ───────────────────────────────────────────────────────────
  const getVariant = (status: string): BadgeVariant => {
    if (status === "HUMAN") return "success";
    if (status === "SUSPICIOUS") return "warning";
    return "danger";
  };

  // Derive paste count from actual events for the legend
  const pasteEventCount = events.filter(
    (e) => e.key === "__PASTE_EVENT__",
  ).length;

  // ── LOADING STATE ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fafafa]">
        <div className="flex flex-col items-center gap-4 text-gray-400">
          <Activity className="animate-pulse" size={32} />
          <p className="text-[13px] font-mono tracking-widest uppercase">
            Initializing Reconstruction Engine...
          </p>
        </div>
      </div>
    );
  }

  // ── ERROR STATE ─────────────────────────────────────────────────────────────
  if (error || !metadata || !metrics) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fafafa]">
        <div className="bg-white p-8 border border-red-200 rounded-xl max-w-md w-full shadow-sm text-center">
          <AlertTriangle className="text-red-500 mx-auto mb-4" size={32} />
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            Access Denied
          </h2>
          <p className="text-[13px] text-gray-500 mb-6">
            {error ??
              "Session not found or you do not have permission to view it."}
          </p>
          <Link
            to={ROUTES.DASHBOARD}
            className="px-4 py-2 bg-gray-900 text-white rounded-md text-[13px] font-semibold"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-[#fafafa] font-sans text-gray-900">
      {/* ── TOP HEADER ── */}
      <header className="shrink-0 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 z-20">
        <div className="flex items-center gap-4">
          <Link
            to={ROUTES.EDITOR}
            className="p-1.5 text-gray-400 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg"
            title="Back to Sessions"
          >
            <RotateCcw size={16} />
          </Link>
          <div className="flex flex-col">
            <h1 className="text-[14px] font-semibold flex items-center gap-2">
              Behavioral Replay: {metadata.title}
              <Badge variant={getVariant(metadata.classification)}>
                {metadata.classification}
              </Badge>
            </h1>
            <div className="flex gap-3 text-[12px] text-gray-500 font-mono mt-0.5">
              <span>Conf: {metadata.confidence}%</span>
              <span>·</span>
              <span>{metadata.word_count} words</span>
              <span>·</span>
              <span>Student: {metadata.student_id}</span>
            </div>
          </div>
        </div>

        {/* Legend + view toggle */}
        <div className="flex items-center gap-4">
          {/* Paste legend — only shown when session has paste events */}
          {pasteEventCount > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: "#fef9c3",
                  borderBottom: "2px solid #f59e0b",
                  color: "#92400e",
                }}
              >
                <Clipboard size={9} style={{ color: "#f59e0b" }} />
                pasted
              </span>
              <span>
                = {pasteEventCount} paste event
                {pasteEventCount !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white text-[12px] font-semibold">
            {(["live", "stream"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={clsx(
                  "px-3 py-1.5 transition-colors border-r last:border-r-0",
                  viewMode === mode
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:text-gray-800",
                )}
              >
                {mode === "live" ? "Live View" : "Stream"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── LEFT: DOCUMENT RECONSTRUCTION ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Pause banner */}
          {isPausedEvent && (
            <div className="shrink-0 bg-yellow-50 border-b border-yellow-200 px-6 py-2 flex items-center gap-2">
              <Clock size={14} className="text-yellow-600" />
              <span className="text-[12px] text-yellow-800 font-medium">
                Cognitive pause detected — {isPausedEvent}s gap between
                keystrokes
              </span>
            </div>
          )}

          {/* Document area */}
          <div className="flex-1 overflow-auto p-8">
            <div
              className={clsx(
                "max-w-3xl mx-auto bg-white border rounded-xl p-8 shadow-sm min-h-[400px]",
                "font-mono text-[14px] leading-relaxed text-gray-800 whitespace-pre-wrap break-words",
              )}
            >
              <ReconstructedDocument
                segments={segments}
                isPlaying={isPlaying}
              />
            </div>

            {/* Paste legend note at bottom of document area */}
            {pasteEventCount > 0 && (
              <p className="max-w-3xl mx-auto mt-3 text-[11px] text-gray-400 flex items-center gap-1.5">
                <Clipboard size={10} className="text-amber-400" />
                Amber-highlighted text was pasted from clipboard. Typed content
                is shown normally.
              </p>
            )}
          </div>
        </main>

        {/* ── RIGHT: BIOMETRIC METRICS SIDEBAR ── */}
        <aside className="shrink-0 w-[260px] border-l border-gray-200 bg-white overflow-y-auto flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={14} className="text-gray-400" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                Biometric Audit
              </span>
            </div>
          </div>

          <div className="flex-1 px-4">
            <MetricBlock label="Avg IKI" value={metrics.avg_iki} unit="ms" />
            <MetricBlock
              label="Mean Dwell Time"
              value={metrics.dwell_time}
              unit="ms"
            />
            <MetricBlock
              label="Deletion Ratio"
              value={`${(metrics.deletion_ratio * 100).toFixed(1)}%`}
            />
            <MetricBlock label="Paste Events" value={metrics.paste_count} />
            <MetricBlock
              label="Longest Pause"
              value={(metrics.longest_pause_ms / 1000).toFixed(1)}
              unit="s"
            />
            <MetricBlock label="Typing Bursts" value={metrics.burst_count} />
            <MetricBlock label="Net WPM" value={metrics.wpm} unit="wpm" />
            <MetricBlock
              label="Active Time"
              value={`${metrics.active_time_pct}%`}
            />
          </div>

          <div className="p-4 border-t border-gray-100">
            <MetricBlock
              label="Session Duration"
              value={formatTime(metadata.duration_ms)}
            />
          </div>
        </aside>
      </div>

      {/* ── PLAYBACK CONTROLS FOOTER ── */}
      <footer className="shrink-0 flex flex-col gap-3 px-6 py-4 bg-white border-t border-gray-200 z-20">
        {/* Time display */}
        <div className="flex items-center justify-between text-[11px] font-mono text-gray-500">
          <span>{formatTime(currentTimeMs)}</span>
          <span>{formatTime(maxTime)}</span>
        </div>

        {/* Scrubber */}
        <div
          className="relative h-6 flex items-center cursor-pointer"
          onClick={(e: React.MouseEvent<HTMLDivElement>) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            setCurrentTimeMs(Math.max(0, Math.min(percent * maxTime, maxTime)));
          }}
        >
          <div className="absolute w-full h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
            {/* Deletion blips — red */}
            {events
              .filter((e) => e.key === "Backspace")
              .map((e, i) => (
                <div
                  key={`del-${i}`}
                  className="absolute w-[1px] h-full bg-red-400 opacity-70"
                  style={{
                    left: `${((e.relative_time_ms ?? 0) / maxTime) * 100}%`,
                  }}
                />
              ))}
            {/* Paste event blips — amber */}
            {events
              .filter((e) => e.key === "__PASTE_EVENT__")
              .map((e, i) => (
                <div
                  key={`paste-${i}`}
                  className="absolute w-[4px] h-full bg-amber-400 opacity-80"
                  style={{
                    left: `${((e.relative_time_ms ?? 0) / maxTime) * 100}%`,
                  }}
                />
              ))}
            {/* Progress fill */}
            <div
              className="h-full bg-gray-400/50 mix-blend-multiply"
              style={{ width: `${(currentTimeMs / maxTime) * 100}%` }}
            />
          </div>
          {/* Playhead */}
          <div
            className="absolute w-3 h-3 bg-gray-900 rounded-full shadow-sm pointer-events-none"
            style={{
              left: `calc(${Math.min(100, Math.max(0, (currentTimeMs / maxTime) * 100))}% - 6px)`,
            }}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsPlaying(false);
                setCurrentTimeMs(0);
              }}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              title="Rewind to start"
            >
              <RotateCcw size={16} />
            </button>

            <button
              onClick={() => {
                if (currentTimeMs >= maxTime) setCurrentTimeMs(0);
                setIsPlaying((prev) => !prev);
              }}
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors shadow-sm"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
          </div>

          {/* Speed controls */}
          <div className="flex items-center bg-gray-100 rounded-xl border border-gray-200 p-1">
            {([0.5, 1, 2, 4] as const).map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={clsx(
                  "px-2 py-1 text-[11px] font-mono rounded-lg transition-all",
                  playbackSpeed === speed
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-500 hover:text-gray-700",
                )}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
