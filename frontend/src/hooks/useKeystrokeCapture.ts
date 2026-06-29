import { useCallback, useMemo, useRef, useState } from "react";
import type { KeystrokeEvent, SessionStats } from "../types/editor";

interface UseKeystrokeCaptureOptions {
  text: string;
}

interface ActiveKey {
  index: number;
  downTime: number;
  downTimestamp: number;
}

export interface CaptureHydrationPayload {
  events?: KeystrokeEvent[];
  startedAt?: number | null;
  lastActivityAt?: number | null;
  lastKeyDownTimestamp?: number | null;
}

export interface CaptureSnapshot {
  events: KeystrokeEvent[];
  startedAt: number | null;
  lastActivityAt: number | null;
  lastKeyDownTimestamp: number | null;
}

function countWords(value: string): number {
  const clean = value.trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

function safeNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getLastKeyDownTimestamp(events: KeystrokeEvent[]): number | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.type === "keydown" && typeof event.timestamp === "number") {
      return event.timestamp;
    }
  }
  return null;
}

export function useKeystrokeCapture({ text }: UseKeystrokeCaptureOptions) {
  // Wall-clock timestamps are used for session duration and resume safety.
  // performance.now() resets after reload, so it must not be used for persisted duration.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [lastActivityAt, setLastActivityAt] = useState<number | null>(null);

  const logRef = useRef<KeystrokeEvent[]>([]);
  const activeKeysRef = useRef<Record<string, ActiveKey>>({});
  const lastKeyDownTimestampRef = useRef<number | null>(null);

  const ensureStarted = useCallback((timestamp: number) => {
    setStartedAt((current) => current ?? timestamp);
    setLastActivityAt(timestamp);
  }, []);

  const getCursorPosition = useCallback(
    (target: EventTarget | null) => {
      const textarea = target as HTMLTextAreaElement | null;
      return typeof textarea?.selectionStart === "number"
        ? textarea.selectionStart
        : text.length;
    },
    [text.length],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.repeat) return;

      const wallNow = Date.now();
      const perfNow = performance.now();
      ensureStarted(wallNow);

      const keyId = `${event.code || event.key}-${event.keyCode}`;
      const previousKeyDownAt = lastKeyDownTimestampRef.current;
      const flightTime =
        previousKeyDownAt === null
          ? null
          : Math.max(0, Math.round(wallNow - previousKeyDownAt));

      lastKeyDownTimestampRef.current = wallNow;

      const entry: KeystrokeEvent = {
        key: event.key,
        keyCode: event.keyCode,
        code: event.code,
        type: "keydown",
        timestamp: wallNow,
        down_time: Math.round(perfNow),
        up_time: null,
        dwell_time: null,
        flight_time: flightTime,
        documentLength: text.length,
        cursorPosition: getCursorPosition(event.currentTarget),
      };

      logRef.current.push(entry);
      activeKeysRef.current[keyId] = {
        index: logRef.current.length - 1,
        downTime: perfNow,
        downTimestamp: wallNow,
      };
    },
    [ensureStarted, getCursorPosition, text.length],
  );

  const handleKeyUp = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const wallNow = Date.now();
      const perfNow = performance.now();
      const keyId = `${event.code || event.key}-${event.keyCode}`;
      const activeKey = activeKeysRef.current[keyId];

      if (!activeKey) return;

      const dwellTime = Math.max(0, Math.round(perfNow - activeKey.downTime));

      const keydownEntry = logRef.current[activeKey.index];
      if (keydownEntry) {
        keydownEntry.up_time = Math.round(perfNow);
        keydownEntry.dwell_time = dwellTime;
      }

      logRef.current.push({
        key: event.key,
        keyCode: event.keyCode,
        code: event.code,
        type: "keyup",
        timestamp: wallNow,
        down_time: Math.round(activeKey.downTime),
        up_time: Math.round(perfNow),
        dwell_time: dwellTime,
        flight_time: null,
        documentLength: text.length,
        cursorPosition: getCursorPosition(event.currentTarget),
      });

      delete activeKeysRef.current[keyId];
      setLastActivityAt(wallNow);
    },
    [getCursorPosition, text.length],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const wallNow = Date.now();
      const perfNow = performance.now();
      ensureStarted(wallNow);

      const pastedText = event.clipboardData.getData("text") || "";

      logRef.current.push({
        key: "__PASTE_EVENT__",
        keyCode: 0,
        code: "Paste",
        type: "paste",
        timestamp: wallNow,
        down_time: Math.round(perfNow),
        up_time: Math.round(perfNow),
        dwell_time: 0,
        flight_time:
          lastKeyDownTimestampRef.current === null
            ? null
            : Math.max(
                0,
                Math.round(wallNow - lastKeyDownTimestampRef.current),
              ),
        documentLength: text.length,
        cursorPosition: getCursorPosition(event.currentTarget),
        pastedLength: pastedText.length,
      });

      lastKeyDownTimestampRef.current = wallNow;
      setLastActivityAt(wallNow);
    },
    [ensureStarted, getCursorPosition, text.length],
  );

  const resetCapture = useCallback(() => {
    logRef.current = [];
    activeKeysRef.current = {};
    lastKeyDownTimestampRef.current = null;
    setStartedAt(null);
    setLastActivityAt(null);
  }, []);

  const hydrateCapture = useCallback((payload: CaptureHydrationPayload) => {
    const events = Array.isArray(payload.events) ? payload.events : [];
    logRef.current = events;
    activeKeysRef.current = {};

    const hydratedStartedAt = safeNumber(payload.startedAt);
    const hydratedLastActivityAt = safeNumber(payload.lastActivityAt);
    const hydratedLastKeyDown =
      safeNumber(payload.lastKeyDownTimestamp) ??
      getLastKeyDownTimestamp(events);

    setStartedAt(hydratedStartedAt);
    setLastActivityAt(hydratedLastActivityAt);
    lastKeyDownTimestampRef.current = hydratedLastKeyDown;
  }, []);

  const getCaptureSnapshot = useCallback((): CaptureSnapshot => {
    return {
      events: logRef.current,
      startedAt,
      lastActivityAt,
      lastKeyDownTimestamp: lastKeyDownTimestampRef.current,
    };
  }, [lastActivityAt, startedAt]);

  const getStats = useCallback((): SessionStats => {
    const keydownEvents = logRef.current.filter(
      (event) => event.type === "keydown",
    );
    const flightTimes = keydownEvents
      .map((event) => event.flight_time)
      .filter(
        (value): value is number => typeof value === "number" && value > 0,
      );

    const deletions = keydownEvents.filter(
      (event) => event.key === "Backspace" || event.key === "Delete",
    ).length;

    const pauses = flightTimes.filter((value) => value > 1000).length;

    const avgIki =
      flightTimes.length > 0
        ? Math.round(
            flightTimes.reduce((sum, value) => sum + value, 0) /
              flightTimes.length,
          )
        : 0;

    const firstTime = startedAt;
    const endTime = lastActivityAt ?? Date.now();

    const sessionSeconds =
      firstTime === null
        ? 0
        : Math.max(1, Math.round((endTime - firstTime) / 1000));

    const wordCount = countWords(text);
    const wpm =
      sessionSeconds > 0 ? Math.round((wordCount / sessionSeconds) * 60) : 0;

    return {
      wpm,
      keystrokes: keydownEvents.length,
      deletions,
      pauses,
      avgIki,
      sessionSeconds,
    };
  }, [lastActivityAt, startedAt, text]);

  const liveStats = useMemo(() => getStats(), [getStats]);

  return {
    keystrokeLogRef: logRef,
    startedAt,
    lastActivityAt,
    liveStats,
    handleKeyDown,
    handleKeyUp,
    handlePaste,
    getStats,
    resetCapture,
    hydrateCapture,
    getCaptureSnapshot,
  };
}
