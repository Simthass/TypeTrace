// frontend/src/hooks/useKeystrokeCapture.ts

import { useCallback, useMemo, useRef, useState } from "react";
import type { KeystrokeEvent, SessionStats } from "../types/editor";

interface UseKeystrokeCaptureOptions {
  text: string;
}

interface ActiveKey {
  index: number;
  downTime: number;
}

function countWords(value: string): number {
  const clean = value.trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

export function useKeystrokeCapture({ text }: UseKeystrokeCaptureOptions) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [lastActivityAt, setLastActivityAt] = useState<number | null>(null);

  const logRef = useRef<KeystrokeEvent[]>([]);
  const activeKeysRef = useRef<Record<string, ActiveKey>>({});
  const lastKeyDownAtRef = useRef<number | null>(null);

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

      const now = performance.now();
      ensureStarted(now);

      const keyId = `${event.code || event.key}-${event.keyCode}`;
      const previousKeyDownAt = lastKeyDownAtRef.current;
      const flightTime =
        previousKeyDownAt === null
          ? null
          : Math.max(0, Math.round(now - previousKeyDownAt));

      lastKeyDownAtRef.current = now;

      const entry: KeystrokeEvent = {
        key: event.key,
        keyCode: event.keyCode,
        code: event.code,
        type: "keydown",
        timestamp: Date.now(),
        down_time: Math.round(now),
        up_time: null,
        dwell_time: null,
        flight_time: flightTime,
        documentLength: text.length,
        cursorPosition: getCursorPosition(event.currentTarget),
      };

      logRef.current.push(entry);
      activeKeysRef.current[keyId] = {
        index: logRef.current.length - 1,
        downTime: now,
      };
    },
    [ensureStarted, getCursorPosition, text.length],
  );

  const handleKeyUp = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const now = performance.now();
      const keyId = `${event.code || event.key}-${event.keyCode}`;
      const activeKey = activeKeysRef.current[keyId];

      if (!activeKey) return;

      const dwellTime = Math.max(0, Math.round(now - activeKey.downTime));

      const keydownEntry = logRef.current[activeKey.index];
      if (keydownEntry) {
        keydownEntry.up_time = Math.round(now);
        keydownEntry.dwell_time = dwellTime;
      }

      logRef.current.push({
        key: event.key,
        keyCode: event.keyCode,
        code: event.code,
        type: "keyup",
        timestamp: Date.now(),
        down_time: Math.round(activeKey.downTime),
        up_time: Math.round(now),
        dwell_time: dwellTime,
        flight_time: null,
        documentLength: text.length,
        cursorPosition: getCursorPosition(event.currentTarget),
      });

      delete activeKeysRef.current[keyId];
      setLastActivityAt(now);
    },
    [getCursorPosition, text.length],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const now = performance.now();
      ensureStarted(now);

      const pastedText = event.clipboardData.getData("text") || "";

      logRef.current.push({
        key: "__PASTE_EVENT__",
        keyCode: 0,
        code: "Paste",
        type: "paste",
        timestamp: Date.now(),
        down_time: Math.round(now),
        up_time: Math.round(now),
        dwell_time: 0,
        flight_time:
          lastKeyDownAtRef.current === null
            ? null
            : Math.max(0, Math.round(now - lastKeyDownAtRef.current)),
        documentLength: text.length,
        cursorPosition: getCursorPosition(event.currentTarget),
        pastedLength: pastedText.length,
      });

      lastKeyDownAtRef.current = now;
      setLastActivityAt(now);
    },
    [ensureStarted, getCursorPosition, text.length],
  );

  const resetCapture = useCallback(() => {
    logRef.current = [];
    activeKeysRef.current = {};
    lastKeyDownAtRef.current = null;
    setStartedAt(null);
    setLastActivityAt(null);
  }, []);

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
    const endTime = lastActivityAt ?? performance.now();

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
  };
}
