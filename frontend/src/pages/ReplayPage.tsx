import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, getApiErrorMessage } from "../lib/api";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";
import type {
  ReplayEvent,
  ReplayResponse,
  ReplaySegment,
  ReplayTimelineMarker,
} from "../types/replay";
import { API_ROUTES } from "../constants/apiRoutes";

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 5h4v14H6z" />
      <path d="M14 5h4v14h-4z" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v6h6" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function SkipBackIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 18V6l-8.5 6z" />
      <rect x="13" y="6" width="2.5" height="12" />
    </svg>
  );
}

function SkipForwardIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 6v12l8.5-6z" />
      <rect x="8.5" y="6" width="2.5" height="12" />
    </svg>
  );
}

function CursorIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 4v15.5a.5.5 0 0 0 .85.35l4.15-4.1 2.7 5.8a.6.6 0 0 0 1.1-.05l2-5.4 5.4-2a.6.6 0 0 0 .05-1.1l-15.5-6.9A.5.5 0 0 0 4 4Z" />
    </svg>
  );
}

function formatTime(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const totalSeconds = Math.floor(safe / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatLongTime(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const totalSeconds = Math.floor(safe / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function classificationStyle(bucket: string) {
  if (bucket === "HUMAN") {
    return {
      label: "Human",
      bg: brand.humanBg,
      text: brand.humanText,
      border: brand.humanAccent,
    };
  }

  if (bucket === "SUSPICIOUS") {
    return {
      label: "Review Required",
      bg: brand.suspiciousBg,
      text: brand.suspiciousText,
      border: brand.suspiciousAccent,
    };
  }

  if (bucket === "SYNTHETIC") {
    return {
      label: "High Risk",
      bg: brand.aiBg,
      text: brand.aiText,
      border: brand.aiAccent,
    };
  }

  return {
    label: "Unknown",
    bg: colors.surface[100],
    text: colors.text.secondary,
    border: colors.surface[200],
  };
}

function markerColor(type: ReplayTimelineMarker["type"]) {
  if (type === "paste") return brand.suspiciousAccent;
  if (type === "deletion") return brand.aiAccent;
  if (type === "cognitive_pause") return colors.text.primary;
  return colors.steel;
}

function markerLabelForType(type: ReplayTimelineMarker["type"]) {
  if (type === "paste") return "Paste";
  if (type === "deletion") return "Deletion";
  if (type === "cognitive_pause") return "Cognitive pause";
  return "Pause";
}

function metricValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return value;
}

/**
 * Applies a single replay event, mutating `cells` in place, and returns the
 * cursor position immediately after the event (or `null` for events that
 * don't move the cursor, e.g. keyup).
 *
 * This replaces the original "append to end of buffer / remove exactly one
 * character" model, which had no concept of where in the document an edit
 * actually happened. Every event is applied at its recorded
 * `cursorPosition`, using the real deleted/inserted character counts and
 * literal replacement text where available, so edits that go back to an
 * earlier part of the document (fixing a typo, replacing a selection) land
 * in the right place instead of corrupting whatever the buffer's end
 * happened to be at that moment.
 */
function insertCharacters(
  cells: ReplaySegment[],
  at: number,
  text: string,
  cellType: "typed" | "paste" = "typed",
): number {
  if (!text) return at;
  const chars = Array.from(text).map((char) => ({
    text: char,
    type: cellType,
  }));
  cells.splice(at, 0, ...chars);
  return at + chars.length;
}

function fallbackInsertText(event: ReplayEvent): string {
  if (event.type !== "keydown") return "";
  if (event.key === "Enter") return "\n";
  if (event.key === "Tab") return "    ";
  if (event.key && event.key.length === 1) return event.key;
  return "";
}

function applyReplayEvent(
  cells: ReplaySegment[],
  event: ReplayEvent,
): number | null {
  // keyup is only the release half of a key action and never mutates the
  // document or moves the cursor by itself; the matching keydown already
  // carries the effect.
  if (event.type === "keyup") return null;

  const pos = Math.max(
    0,
    Math.min(cells.length, event.cursorPosition ?? cells.length),
  );

  // A pure cursor-movement event (click elsewhere, arrow-key navigation
  // with no text change) — doesn't touch the document, only where the
  // caret is, which is exactly what makes "moved back to paragraph one to
  // fix something" visible in replay.
  if (event.type === "cursor") {
    return pos;
  }

  if (event.is_paste) {
    // Show the real pasted text when it was captured, instead of only a
    // placeholder — a reviewer needs to see what was actually pasted.
    const text = event.inserted_text;
    if (text && text.length > 0) {
      return insertCharacters(cells, pos, text, "paste");
    }

    // Legacy sessions recorded before paste text was captured only have a
    // length to fall back on.
    const label =
      event.pastedLength > 0
        ? `[pasted ${event.pastedLength} characters — original text not captured]`
        : "[pasted content]";
    cells.splice(pos, 0, { text: label, type: "paste" });
    return pos + 1;
  }

  const deletedCount = Math.max(
    0,
    event.deletedCharacters ||
      event.chars_deleted ||
      (event.is_deletion ? 1 : 0),
  );

  if (deletedCount > 0) {
    // Direction depends on how the deletion happened, not just the key:
    // - An explicit selection (selection_length_before > 0) is always
    //   removed starting AT the cursor (forward), regardless of which key
    //   triggered it.
    // - Standalone revision events (spellcheck/autocorrect/IME/anything
    //   that isn't a real keydown) record cursorPosition as the edit's
    //   left edge already, so they are always "forward" from there too.
    // - A plain Backspace/word-back/line-back with no selection removes
    //   backward, ending at the cursor. Delete/word-forward/line-forward
    //   always removes forward.
    const isForwardStyle =
      event.type !== "keydown" ||
      event.key === "Delete" ||
      (event.selection_length_before || 0) > 0;

    const deleteStart = isForwardStyle ? pos : Math.max(0, pos - deletedCount);
    const actualDeleteCount = Math.min(
      deletedCount,
      Math.max(0, cells.length - deleteStart),
    );

    if (actualDeleteCount > 0) {
      cells.splice(deleteStart, actualDeleteCount);
    }

    // The same user action can also insert new content in one step, e.g.
    // typing a replacement character over a selection, or a spellcheck
    // correction that both removes and replaces text at once.
    const insertText = event.inserted_text || fallbackInsertText(event);
    return insertCharacters(cells, deleteStart, insertText);
  }

  // Pure insertion — either a normal keydown character, or a standalone
  // revision event with no matching keydown at all (spellcheck/autocorrect/
  // IME/mobile predictive text that added characters without deleting
  // anything, e.g. "cmputer" -> "computer" is a single inserted "o" with
  // zero deletions).
  const insertText = event.inserted_text || fallbackInsertText(event);
  if (insertText) return insertCharacters(cells, pos, insertText);

  return pos;
}

interface ReconstructionState {
  cells: ReplaySegment[];
  cursor: number;
}

function reconstructState(
  events: ReplayEvent[],
  currentTimeMs: number,
): ReconstructionState {
  const activeEvents = events.filter(
    (event) => event.relative_time_ms <= currentTimeMs,
  );

  const cells: ReplaySegment[] = [];
  let cursor = 0;

  activeEvents.forEach((event) => {
    const next = applyReplayEvent(cells, event);
    if (next !== null) cursor = next;
  });

  return { cells, cursor };
}

function cellsToSegments(cells: ReplaySegment[]): ReplaySegment[] {
  const segments: ReplaySegment[] = [];

  cells.forEach((cell) => {
    const last = segments[segments.length - 1];

    if (last && last.type === cell.type) {
      segments[segments.length - 1] = {
        ...last,
        text: last.text + cell.text,
      };
    } else {
      segments.push({ ...cell });
    }
  });

  return segments;
}

/**
 * Total reconstructed character count. Excludes legacy placeholder labels
 * (a single cell holding a bracketed string like "[pasted 12 characters]"),
 * which aren't real characters; real pasted content (captured as one cell
 * per character) counts normally, same as typed text.
 */
function countReconstructedCharacters(cells: ReplaySegment[]): number {
  return cells.reduce((total, cell) => {
    if (cell.type === "paste" && cell.text.length > 1) return total;
    return total + cell.text.length;
  }, 0);
}

function lineAndColumnAt(cells: ReplaySegment[], cursor: number) {
  let line = 1;
  let column = 1;
  let index = 0;

  for (const cell of cells) {
    if (index >= cursor) break;

    for (const char of cell.text) {
      if (index >= cursor) break;
      if (char === "\n") {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
      index += 1;
    }
  }

  return { line, column };
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div
      className="rounded-md border bg-white px-4 py-3"
      style={{ borderColor: colors.surface[200] }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: colors.text.secondary }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-[17px] font-semibold"
        style={{ color: colors.text.primary }}
      >
        {value}
      </p>
      {sub && (
        <p
          className="mt-1 text-[12px]"
          style={{ color: colors.text.secondary }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function SegmentRenderer({
  segments,
  cursor,
  showCursor,
  isPlaying,
  caretRef,
}: {
  segments: ReplaySegment[];
  cursor: number;
  showCursor: boolean;
  isPlaying: boolean;
  caretRef: React.RefObject<HTMLSpanElement | null>;
}) {
  if (segments.length === 0) {
    return (
      <span style={{ color: colors.text.secondary }}>
        Press play to reconstruct the writing session.
      </span>
    );
  }

  const nodes: React.ReactNode[] = [];
  let consumed = 0;
  let caretPlaced = false;

  const caret = (key: string) => (
    <span
      key={key}
      ref={caretPlaced ? undefined : caretRef}
      className="relative -top-[0.1em] inline-block h-[1.15em] w-[2px] align-middle"
      style={{
        background: colors.brand,
        animation: isPlaying
          ? "replay-caret-blink 1s step-end infinite"
          : undefined,
        opacity: isPlaying ? undefined : 0.6,
      }}
    />
  );

  segments.forEach((segment, index) => {
    const segmentLength = segment.text.length;
    const segmentStart = consumed;
    const segmentEnd = consumed + segmentLength;
    const caretHere =
      showCursor &&
      !caretPlaced &&
      cursor >= segmentStart &&
      cursor <= segmentEnd;

    if (segment.type === "paste") {
      nodes.push(
        <span
          key={`paste-${index}`}
          className="mx-0.5 inline rounded px-1"
          style={{
            background: brand.suspiciousBg,
            boxShadow: `inset 0 0 0 1px ${brand.suspiciousAccent}`,
          }}
        >
          <span
            className="mr-1 inline-flex -translate-y-px items-center gap-1 rounded-full px-1.5 py-[1px] align-middle text-[9px] font-bold uppercase tracking-wide text-white"
            style={{ background: brand.suspiciousAccent }}
          >
            <ClipboardIcon />
            Pasted
          </span>
          <span style={{ color: brand.suspiciousText }}>{segment.text}</span>
        </span>,
      );
    } else if (caretHere) {
      const offset = cursor - segmentStart;
      nodes.push(
        <span key={`typed-${index}-a`}>{segment.text.slice(0, offset)}</span>,
      );
      nodes.push(caret(`caret-${index}`));
      nodes.push(
        <span key={`typed-${index}-b`}>{segment.text.slice(offset)}</span>,
      );
      caretPlaced = true;
    } else {
      nodes.push(<span key={`typed-${index}`}>{segment.text}</span>);
    }

    consumed = segmentEnd;
  });

  if (showCursor && !caretPlaced) {
    nodes.push(caret("caret-end"));
  }

  return <>{nodes}</>;
}

const SEEK_STEP_MS = 5000;

export default function ReplayPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [replay, setReplay] = useState<ReplayResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [viewMode, setViewMode] = useState<"document" | "events">("document");

  const playbackTimerRef = useRef<number | null>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // The running setInterval closure reads speed from this ref every tick
  // (rather than closing over `playbackSpeed` directly), so 0.5x/2x/4x take
  // effect instantly instead of only after pausing and pressing Play again.
  const playbackSpeedRef = useRef(playbackSpeed);

  useEffect(() => {
    playbackSpeedRef.current = playbackSpeed;
  }, [playbackSpeed]);

  const loadReplay = useCallback(async () => {
    const cleanSessionId = sessionId?.trim();

    if (!cleanSessionId) {
      setApiError("Replay session ID is missing.");
      setIsLoading(false);
      return;
    }

    if (!/^\d+$/.test(cleanSessionId)) {
      setApiError("Replay session ID is invalid.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setApiError(null);

    try {
      const response = await api.get<ReplayResponse>(
        API_ROUTES.sessions.replay(cleanSessionId),
      );

      setReplay(response.data);
      setIsPlaying(false);
      setCurrentTimeMs(0);
    } catch (error) {
      setApiError(getApiErrorMessage(error));
      setReplay(null);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReplay();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadReplay]);

  useEffect(() => {
    return () => {
      if (playbackTimerRef.current) {
        window.clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, []);

  const maxTimeMs = useMemo(() => {
    if (!replay) return 1000;

    const lastEventTime =
      replay.events.length > 0
        ? replay.events[replay.events.length - 1].relative_time_ms
        : 0;

    return Math.max(replay.session.duration_ms, lastEventTime, 1000);
  }, [replay]);

  const playbackProgress = useMemo(() => {
    return Math.min(100, Math.max(0, (currentTimeMs / maxTimeMs) * 100));
  }, [currentTimeMs, maxTimeMs]);

  const activeEventIndex = useMemo(() => {
    if (!replay) return 0;
    return replay.events.filter(
      (event) => event.relative_time_ms <= currentTimeMs,
    ).length;
  }, [replay, currentTimeMs]);

  const activeEvent = useMemo(() => {
    if (!replay || activeEventIndex === 0) return null;
    return replay.events[
      Math.min(activeEventIndex - 1, replay.events.length - 1)
    ];
  }, [replay, activeEventIndex]);

  const reconstruction = useMemo(() => {
    if (!replay) return { cells: [], cursor: 0 };
    return reconstructState(replay.events, currentTimeMs);
  }, [replay, currentTimeMs]);

  const visibleSegments = useMemo(
    () => cellsToSegments(reconstruction.cells),
    [reconstruction],
  );

  const cursorLocation = useMemo(
    () => lineAndColumnAt(reconstruction.cells, reconstruction.cursor),
    [reconstruction],
  );

  // Safety net: compares the fully-reconstructed replay against the
  // recorded document length from the last event, so a reconstruction that
  // doesn't add up is surfaced as a visible warning instead of being
  // silently presented as if it were exactly what the student typed.
  const reconstructionIntegrity = useMemo(() => {
    if (!replay || replay.events.length === 0) {
      return { checked: false, isConsistent: true, expected: 0, actual: 0 };
    }

    const final = reconstructState(replay.events, Number.POSITIVE_INFINITY);
    const actual = countReconstructedCharacters(final.cells);

    const lastEventWithLength = [...replay.events]
      .reverse()
      .find((event) => typeof event.documentLength === "number");
    const expected = lastEventWithLength?.documentLength ?? actual;

    return {
      checked: true,
      isConsistent: Math.abs(expected - actual) <= 1,
      expected,
      actual,
    };
  }, [replay]);

  const visibleEvents = useMemo(() => {
    if (!replay) return [];
    return replay.events.filter(
      (event) => event.relative_time_ms <= currentTimeMs,
    );
  }, [replay, currentTimeMs]);

  const seekTo = useCallback(
    (nextMs: number) => {
      setCurrentTimeMs(Math.max(0, Math.min(maxTimeMs, nextMs)));
    },
    [maxTimeMs],
  );

  const togglePlayback = useCallback(() => {
    if (!replay || replay.events.length === 0) return;

    if (isPlaying) {
      if (playbackTimerRef.current) {
        window.clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }

      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);

    setCurrentTimeMs((current) => (current >= maxTimeMs ? 0 : current));

    playbackTimerRef.current = window.setInterval(() => {
      setCurrentTimeMs((current) => {
        const next = current + 16 * playbackSpeedRef.current;

        if (next >= maxTimeMs) {
          if (playbackTimerRef.current) {
            window.clearInterval(playbackTimerRef.current);
            playbackTimerRef.current = null;
          }

          setIsPlaying(false);
          return maxTimeMs;
        }

        return next;
      });
    }, 16);
  }, [isPlaying, maxTimeMs, replay]);

  const handleScrub = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!replay) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const percentage = (event.clientX - rect.left) / rect.width;
    seekTo(percentage * maxTimeMs);
  };

  const resetPlayback = useCallback(() => {
    if (playbackTimerRef.current) {
      window.clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    setIsPlaying(false);
    setCurrentTimeMs(0);
  }, []);

  // Keyboard shortcuts: Space toggles play/pause, Left/Right seek by 5s,
  // Home/End jump to the start/end. Ignored while focus is on an
  // interactive element (a link/button on the page) so shortcuts don't
  // fight with normal keyboard navigation, and while any modifier key is
  // held so browser/OS shortcuts aren't hijacked.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        togglePlayback();
        return;
      }

      if (event.code === "ArrowLeft") {
        event.preventDefault();
        seekTo(currentTimeMs - SEEK_STEP_MS);
        return;
      }

      if (event.code === "ArrowRight") {
        event.preventDefault();
        seekTo(currentTimeMs + SEEK_STEP_MS);
        return;
      }

      if (event.code === "Home") {
        event.preventDefault();
        seekTo(0);
        return;
      }

      if (event.code === "End") {
        event.preventDefault();
        seekTo(maxTimeMs);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlayback, seekTo, currentTimeMs, maxTimeMs]);

  // Keeps the cursor visible as it jumps around the document — going back
  // to an earlier paragraph to fix something scrolls the viewport to that
  // paragraph instead of leaving the caret off-screen.
  useEffect(() => {
    caretRef.current?.scrollIntoView({
      block: "nearest",
      behavior: currentTimeMs === 0 ? "auto" : "smooth",
    });
  }, [reconstruction.cursor, currentTimeMs]);

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: colors.surface[50] }}
      >
        <div
          className="rounded-md border bg-white px-6 py-5 text-center shadow-sm"
          style={{ borderColor: colors.surface[200] }}
        >
          <p
            className="text-[13px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Loading replay audit...
          </p>
          <p
            className="mt-1 text-[12px]"
            style={{ color: colors.text.secondary }}
          >
            Reconstructing keystroke evidence.
          </p>
        </div>
      </div>
    );
  }

  if (apiError || !replay) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-6"
        style={{ background: colors.surface[50] }}
      >
        <div
          className="w-full max-w-md rounded-md border bg-white p-6 text-center shadow-sm"
          style={{ borderColor: colors.surface[200] }}
        >
          <div
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-md"
            style={{ background: brand.aiBg, color: brand.aiText }}
          >
            <AlertIcon />
          </div>
          <h1
            className="mt-4 text-lg font-semibold"
            style={{ color: colors.text.primary }}
          >
            Replay unavailable
          </h1>
          <p
            className="mt-2 text-[13px]"
            style={{ color: colors.text.secondary }}
          >
            {apiError || "This replay could not be loaded."}
          </p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-5 rounded-md px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: colors.brand }}
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const badge = classificationStyle(replay.session.classification_bucket);

  return (
    <div className="min-h-screen" style={{ background: colors.surface[50] }}>
      <style>{`
        @keyframes replay-caret-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>

      <header
        className="sticky top-0 z-20 border-b bg-white px-6 py-4"
        style={{ borderColor: colors.surface[200] }}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-1 rounded-md border p-2"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
              }}
              aria-label="Go back"
            >
              <BackIcon />
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  className="text-[17px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  Replay Audit: {replay.session.title}
                </h1>
                <span
                  className="rounded-md border px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    background: badge.bg,
                    color: badge.text,
                    borderColor: badge.border,
                  }}
                >
                  {badge.label}
                </span>
              </div>

              <p
                className="mt-1 text-[12px]"
                style={{ color: colors.text.secondary }}
              >
                {replay.session.student_name || replay.session.student_id} ·{" "}
                {replay.session.course_name || "Personal session"} ·{" "}
                {replay.session.created_at}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {replay.session.certificate_id && (
              <Link
                to={ROUTES.VERIFY.replace(
                  ":certId",
                  replay.session.certificate_id,
                )}
                className="rounded-md border px-3 py-2 text-[12px] font-semibold"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              >
                Verify Certificate
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 px-6 py-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-5">
          {replay?.audit.is_truncated && (
            <div
              className="rounded-md border p-4"
              style={{
                borderColor: brand.suspiciousAccent,
                background: brand.suspiciousBg,
              }}
            >
              <p
                className="text-[13px] font-bold"
                style={{ color: brand.suspiciousText }}
              >
                Replay truncated for performance
              </p>

              <p
                className="mt-1 text-[12px] leading-5"
                style={{ color: brand.suspiciousText }}
              >
                This session contains more events than the replay viewer can
                safely render at once. The audit summary remains available, but
                only the first {replay.audit.max_events_returned} events are
                shown.
              </p>
            </div>
          )}

          {reconstructionIntegrity.checked &&
            !reconstructionIntegrity.isConsistent && (
              <div
                className="rounded-md border p-4"
                style={{
                  borderColor: brand.aiAccent,
                  background: brand.aiBg,
                }}
              >
                <p
                  className="text-[13px] font-bold"
                  style={{ color: brand.aiText }}
                >
                  Reconstruction may be incomplete
                </p>

                <p
                  className="mt-1 text-[12px] leading-5"
                  style={{ color: brand.aiText }}
                >
                  The replayed text length ({reconstructionIntegrity.actual}{" "}
                  characters) does not match the recorded document length (
                  {reconstructionIntegrity.expected} characters). This session's
                  event stream may predate a data-capture fix, or was typed
                  through an input method (mobile keyboard, voice dictation, an
                  IME) that a later fix improved capture for. Treat this replay
                  as supporting evidence only, not as a verified transcript.
                </p>
              </div>
            )}

          {activeEvent?.is_cognitive_pause && (
            <div
              className="rounded-md border px-4 py-3 text-[13px]"
              style={{
                borderColor: brand.suspiciousAccent,
                background: brand.suspiciousBg,
                color: brand.suspiciousText,
              }}
            >
              Cognitive pause detected:{" "}
              {formatLongTime(activeEvent.flight_time || 0)} gap before this
              event.
            </div>
          )}

          {/* Player card: viewport + attached transport bar, video-player style */}
          <div
            className="overflow-hidden rounded-lg border bg-white shadow-sm"
            style={{ borderColor: colors.surface[200] }}
          >
            <div
              className="flex flex-col justify-between gap-3 border-b px-5 py-4 md:flex-row md:items-center"
              style={{ borderColor: colors.surface[200] }}
            >
              <div>
                <h2
                  className="text-[15px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  Writing reconstruction
                </h2>
                <p
                  className="mt-1 flex items-center gap-1.5 text-[12px]"
                  style={{ color: colors.text.secondary }}
                >
                  <CursorIcon />
                  Line {cursorLocation.line}, column {cursorLocation.column} ·
                  character {reconstruction.cursor}
                </p>
              </div>

              <div
                className="flex rounded-md border bg-white p-1"
                style={{ borderColor: colors.surface[200] }}
              >
                {(["document", "events"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className="rounded-md px-3 py-1.5 text-[12px] font-semibold"
                    style={{
                      background:
                        viewMode === mode ? brand.bgNavActive : "#FFFFFF",
                      color:
                        viewMode === mode
                          ? colors.brand
                          : colors.text.secondary,
                    }}
                  >
                    {mode === "document" ? "Document" : "Event Stream"}
                  </button>
                ))}
              </div>
            </div>

            {replay.events.length === 0 ? (
              <div className="p-5">
                <div
                  className="rounded-md border p-5"
                  style={{
                    borderColor: colors.surface[200],
                    background: colors.surface[100],
                  }}
                >
                  <p
                    className="text-[14px] font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    No replayable keystroke events
                  </p>

                  <p
                    className="mt-2 text-[13px] leading-6"
                    style={{ color: colors.text.secondary }}
                  >
                    This session exists, but TypeTrace could not find replayable
                    event data. The summary metrics and certificate record may
                    still be available, but playback cannot be reconstructed for
                    this session.
                  </p>
                </div>
              </div>
            ) : viewMode === "document" ? (
              <div
                ref={viewportRef}
                className="max-h-[520px] min-h-[440px] overflow-auto whitespace-pre-wrap p-5 font-mono text-[14px] leading-7"
                style={{
                  background: colors.surface[50],
                  color: colors.text.primary,
                }}
              >
                <SegmentRenderer
                  segments={visibleSegments}
                  cursor={reconstruction.cursor}
                  showCursor={activeEventIndex > 0}
                  isPlaying={isPlaying}
                  caretRef={caretRef}
                />
              </div>
            ) : (
              <div className="max-h-[520px] overflow-auto">
                {visibleEvents.length === 0 ? (
                  <p
                    className="px-5 py-6 text-[13px]"
                    style={{ color: colors.text.secondary }}
                  >
                    Press play to see the event stream.
                  </p>
                ) : (
                  visibleEvents
                    .slice()
                    .reverse()
                    .slice(0, 120)
                    .map((event) => (
                      <div
                        key={`${event.event_index}-${event.relative_time_ms}`}
                        className="grid grid-cols-[80px_1fr_90px] gap-3 border-b px-5 py-2 text-[12px] last:border-b-0"
                        style={{ borderColor: colors.surface[200] }}
                      >
                        <span style={{ color: colors.text.secondary }}>
                          {formatTime(event.relative_time_ms)}
                        </span>
                        <span style={{ color: colors.text.primary }}>
                          {event.display_key}
                          {event.is_paste
                            ? ` · ${event.pastedLength} chars pasted`
                            : ""}
                          {event.is_deletion ? " · deletion" : ""}
                          {event.type === "cursor" ? " · cursor moved" : ""}
                          {event.is_cognitive_pause
                            ? ` · ${formatLongTime(event.flight_time || 0)} pause`
                            : ""}
                        </span>
                        <span
                          className="text-right"
                          style={{ color: colors.text.secondary }}
                        >
                          {event.type}
                        </span>
                      </div>
                    ))
                )}
              </div>
            )}

            {/* Transport bar — attached directly under the viewport, video-player style */}
            <div
              className="border-t px-5 py-4"
              style={{ borderColor: colors.surface[200] }}
            >
              <div
                className="relative h-3 cursor-pointer"
                onClick={handleScrub}
              >
                <div
                  className="absolute top-[5px] h-[6px] w-full overflow-hidden rounded-full border"
                  style={{
                    background: colors.surface[100],
                    borderColor: colors.surface[200],
                  }}
                >
                  {replay.timeline_markers.map((marker) => (
                    <span
                      key={`${marker.type}-${marker.event_index}-${marker.relative_time_ms}`}
                      className="absolute top-0 h-full"
                      title={`${markerLabelForType(marker.type)}: ${marker.label} at ${formatTime(marker.relative_time_ms)}`}
                      style={{
                        left: `${Math.min(100, Math.max(0, (marker.relative_time_ms / maxTimeMs) * 100))}%`,
                        width: marker.type === "paste" ? 5 : 2,
                        background: markerColor(marker.type),
                      }}
                    />
                  ))}

                  <div
                    className="h-full"
                    style={{
                      width: `${playbackProgress}%`,
                      background: colors.brand,
                    }}
                  />
                </div>

                <div
                  className="absolute top-[-3px] h-4 w-4 rounded-full shadow-sm"
                  style={{
                    left: `calc(${playbackProgress}% - 8px)`,
                    background: colors.text.primary,
                  }}
                />
              </div>

              <div className="mt-4 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetPlayback}
                    className="rounded-full border p-2"
                    style={{
                      borderColor: colors.surface[200],
                      color: colors.text.primary,
                    }}
                    aria-label="Restart"
                    title="Restart"
                  >
                    <ResetIcon />
                  </button>

                  <button
                    type="button"
                    onClick={() => seekTo(currentTimeMs - SEEK_STEP_MS)}
                    className="rounded-full border p-2"
                    style={{
                      borderColor: colors.surface[200],
                      color: colors.text.primary,
                    }}
                    aria-label="Back 5 seconds"
                    title="Back 5s (Left arrow)"
                  >
                    <SkipBackIcon />
                  </button>

                  <button
                    type="button"
                    onClick={togglePlayback}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-white shadow-sm"
                    style={{ background: colors.brand }}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    title="Play/Pause (Space)"
                  >
                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                  </button>

                  <button
                    type="button"
                    onClick={() => seekTo(currentTimeMs + SEEK_STEP_MS)}
                    className="rounded-full border p-2"
                    style={{
                      borderColor: colors.surface[200],
                      color: colors.text.primary,
                    }}
                    aria-label="Forward 5 seconds"
                    title="Forward 5s (Right arrow)"
                  >
                    <SkipForwardIcon />
                  </button>

                  <span
                    className="ml-1 whitespace-nowrap text-[12px] font-semibold tabular-nums"
                    style={{ color: colors.text.secondary }}
                  >
                    {formatTime(currentTimeMs)} / {formatTime(maxTimeMs)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="flex rounded-md border bg-white p-1"
                    style={{ borderColor: colors.surface[200] }}
                  >
                    {[0.5, 1, 2, 4].map((speed) => (
                      <button
                        key={speed}
                        type="button"
                        onClick={() => setPlaybackSpeed(speed)}
                        className="rounded-md px-2.5 py-1 text-[12px] font-semibold"
                        style={{
                          background:
                            playbackSpeed === speed
                              ? brand.bgNavActive
                              : "#FFFFFF",
                          color:
                            playbackSpeed === speed
                              ? colors.brand
                              : colors.text.secondary,
                        }}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div
                className="mt-3 flex flex-wrap items-center gap-4 text-[11px]"
                style={{ color: colors.text.secondary }}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: brand.suspiciousAccent }}
                  />
                  Paste
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: brand.aiAccent }}
                  />
                  Deletion
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: colors.text.primary }}
                  />
                  Cognitive pause
                </span>
                <span
                  className="ml-auto text-[11px]"
                  style={{ color: colors.text.secondary }}
                >
                  Shortcuts: Space play/pause · ←/→ seek 5s · Home/End jump
                </span>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <div
            className="rounded-md border bg-white p-5 shadow-sm"
            style={{ borderColor: colors.surface[200] }}
          >
            <h2
              className="text-[15px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Audit summary
            </h2>

            <div className="mt-4 grid gap-3">
              <MetricCard
                label="Human Evidence Score"
                value={`${replay.session.confidence}%`}
                sub={replay.session.risk_level}
              />
              <MetricCard
                label="Progress"
                value={`${activeEventIndex}/${replay.events.length}`}
                sub="events replayed"
              />
              <MetricCard
                label="WPM"
                value={replay.metrics.wpm}
                sub={`${replay.session.word_count} words`}
              />
              <MetricCard
                label="Duration"
                value={formatLongTime(replay.session.duration_ms)}
                sub={`${replay.metrics.active_time_pct}% active intervals`}
              />
            </div>
          </div>

          <div
            className="rounded-md border bg-white p-5 shadow-sm"
            style={{ borderColor: colors.surface[200] }}
          >
            <h2
              className="text-[15px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Behavioral metrics
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {[
                ["Avg IKI", `${metricValue(replay.metrics.avg_iki)}ms`],
                ["Mean Dwell", `${metricValue(replay.metrics.dwell_time)}ms`],
                [
                  "Mean Flight",
                  `${metricValue(replay.metrics.mean_flight_ms)}ms`,
                ],
                [
                  "Longest Pause",
                  formatLongTime(replay.metrics.longest_pause_ms),
                ],
                ["Paste Events", replay.metrics.paste_count],
                ["Deletion Count", replay.metrics.deletion_count],
                [
                  "Deletion Ratio",
                  `${Math.round(replay.metrics.deletion_ratio * 100)}%`,
                ],
                ["Cognitive Pauses", replay.metrics.cognitive_pause_count],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b py-2 last:border-b-0"
                  style={{ borderColor: colors.surface[200] }}
                >
                  <span
                    className="text-[12px]"
                    style={{ color: colors.text.secondary }}
                  >
                    {label}
                  </span>
                  <span
                    className="text-[12px] font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div
            className="rounded-md border bg-white p-5 shadow-sm"
            style={{ borderColor: colors.surface[200] }}
          >
            <h2
              className="text-[15px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Timeline markers
            </h2>

            <div className="mt-4 max-h-[300px] space-y-2 overflow-auto">
              {replay.timeline_markers.length ? (
                replay.timeline_markers.map((marker) => (
                  <button
                    key={`${marker.type}-${marker.event_index}`}
                    type="button"
                    onClick={() => seekTo(marker.relative_time_ms)}
                    className="w-full rounded-md border px-3 py-2 text-left"
                    style={{ borderColor: colors.surface[200] }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className="flex items-center gap-1.5 text-[12px] font-semibold"
                        style={{ color: colors.text.primary }}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: markerColor(marker.type) }}
                        />
                        {marker.label}
                      </span>
                      <span
                        className="text-[11px]"
                        style={{ color: colors.text.secondary }}
                      >
                        {formatTime(marker.relative_time_ms)}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <p
                  className="text-[13px]"
                  style={{ color: colors.text.secondary }}
                >
                  No paste, deletion, or pause markers detected.
                </p>
              )}
            </div>
          </div>

          <div
            className="rounded-md border bg-white p-5 shadow-sm"
            style={{ borderColor: colors.surface[200] }}
          >
            <h2
              className="text-[15px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Audit interpretation
            </h2>

            <p
              className="mt-3 text-[14px] leading-7"
              style={{ color: colors.text.secondary }}
            >
              This replay reconstructs the recorded writing-session event stream
              using captured keystroke timing, pause, deletion, cursor movement,
              and paste metadata. It should be interpreted as supporting
              behavioral evidence, not as absolute proof of authorship or
              misconduct.
            </p>
          </div>

          <div
            className="rounded-md border bg-white p-5 shadow-sm"
            style={{ borderColor: colors.surface[200] }}
          >
            <h2
              className="text-[15px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Integrity
            </h2>

            <p
              className="mt-3 break-all font-mono text-[11px]"
              style={{ color: colors.text.secondary }}
            >
              {replay.session.document_hash || "No document hash available."}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {replay.session.certificate_id && (
                <Link
                  to={ROUTES.VERIFY.replace(
                    ":certId",
                    replay.session.certificate_id,
                  )}
                  className="rounded-md px-3 py-2 text-[12px] font-semibold text-white"
                  style={{ background: colors.brand }}
                >
                  Verify
                </Link>
              )}

              <Link
                to={ROUTES.SESSIONS}
                className="rounded-md border px-3 py-2 text-[12px] font-semibold"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              >
                Sessions
              </Link>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
