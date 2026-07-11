import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type {
  DeletionMethod,
  KeystrokeEvent,
  SessionStats,
} from "../types/editor";

interface UseKeystrokeCaptureOptions {
  text: string;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}

interface ActiveKey {
  index: number;
  downTime: number;
  downTimestamp: number;
}

interface TextDelta {
  deletedCharacters: number;
  insertedCharacters: number;
  deltaLength: number;
  start: number;
  deletedTextLength: number;
  insertedTextLength: number;
}

interface PendingInputIntent {
  id: string;
  source: "keydown" | "beforeinput" | "paste" | "cut";
  timestamp: number;
  eventIndex: number | null;
  key?: string;
  inputType?: string;
  selectionStartBefore: number;
  selectionEndBefore: number;
  selectionLengthBefore: number;
  documentLengthBefore: number;
  predictedDeletedCharacters: number;
  predictedInsertedCharacters: number;
  deletionMethod: DeletionMethod;
}

export interface CaptureHydrationPayload {
  events?: KeystrokeEvent[];
  startedAt?: number | null;
  lastActivityAt?: number | null;
  lastKeyDownTimestamp?: number | null;
  /** Active writing/capture time only; paused draft idle time is excluded. */
  activeDurationMs?: number | null;
  pausedAt?: number | null;
}

export interface CaptureSnapshot {
  events: KeystrokeEvent[];
  startedAt: number | null;
  lastActivityAt: number | null;
  lastKeyDownTimestamp: number | null;
  activeDurationMs: number;
  pausedAt: number | null;
}

interface CaptureSnapshotOptions {
  /** Freeze the current active segment and suspend timing for a draft. */
  pause?: boolean;
  timestamp?: number;
}

const INTENT_TTL_MS = 3000;
const BULK_DELETE_THRESHOLD = 2;

// Keys that never mutate a plain textarea's content by themselves. Anything
// NOT in this set is treated as a potential text-mutating candidate — this
// deliberately errs on the side of tracking too much rather than too little,
// since an untracked candidate is exactly how mobile/IME edits silently
// disappeared from replay before.
const NON_MUTATING_KEYS = new Set([
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "CapsLock",
  "Escape",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Insert",
  "ScrollLock",
  "NumLock",
  "Pause",
  "ContextMenu",
  "PrintScreen",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "F11",
  "F12",
]);

// Minimum gap between logged cursor-move events. Mouse drag-selection and
// rapid arrow-key repeats can fire selection-change many times per second;
// this keeps the event stream proportional to actual navigation, not noise.
const CURSOR_EVENT_THROTTLE_MS = 80;

// Long gaps are breaks, not active writing time. Short pauses still remain
// behavioral evidence; long idle/sleep/draft gaps are excluded from duration,
// WPM, and normal flight-time rhythm.
const IDLE_BREAK_THRESHOLD_MS = 30_000;
const MAX_TYPING_FLIGHT_TIME_MS = 2_000;

function countWords(value: string): number {
  const clean = value.trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isPlausibleWallClock(value: number | null): value is number {
  if (value === null) return false;

  const minWallClock = new Date("2020-01-01T00:00:00.000Z").getTime();
  const maxWallClock = Date.now() + 1000 * 60 * 60 * 24;

  return value >= minWallClock && value <= maxWallClock;
}

function sanitizeActiveDurationMs(value: unknown): number | null {
  const n = safeNumber(value);
  if (n === null || n < 0) return null;

  // Guard legacy broken drafts where wall-clock age was accidentally stored as
  // active writing time. One continuous academic editor session should not
  // restore as days/months long.
  return Math.min(Math.round(n), 1000 * 60 * 60 * 24);
}

function estimateActiveDurationMsFromEvents(events: KeystrokeEvent[]): number {
  const timestamps = events
    .map((event) => safeNumber(event.timestamp))
    .filter((value): value is number => isPlausibleWallClock(value))
    .sort((a, b) => a - b);

  if (timestamps.length < 2) return events.length > 0 ? 1000 : 0;

  let activeMs = 0;

  for (let index = 1; index < timestamps.length; index += 1) {
    const gap = Math.max(0, timestamps[index] - timestamps[index - 1]);
    if (gap <= IDLE_BREAK_THRESHOLD_MS) {
      activeMs += gap;
    }
  }

  return Math.max(1000, Math.min(activeMs, 1000 * 60 * 60 * 24));
}

function getLastPlausibleKeyDownTimestamp(
  events: KeystrokeEvent[],
): number | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    const timestamp = safeNumber(event?.timestamp);
    if (event?.type === "keydown" && isPlausibleWallClock(timestamp)) {
      return timestamp;
    }
  }

  return null;
}

function getFirstPlausibleEventTimestamp(
  events: KeystrokeEvent[],
): number | null {
  for (const event of events) {
    const timestamp = safeNumber(event?.timestamp);
    if (isPlausibleWallClock(timestamp)) return timestamp;
  }

  return null;
}

function sanitizeFlightTime(value: unknown): number | null {
  const n = safeNumber(value);
  if (n === null || n <= 0) return null;

  // Ignore corrupted values caused by mixing Date.now() and performance.now()
  // across restored drafts or legacy local-storage records. Real long breaks
  // still remain visible through session duration; avg IKI must stay a typing
  // rhythm metric, not a browser sleep/offline gap metric.
  if (n > IDLE_BREAK_THRESHOLD_MS) return null;

  return n;
}

function normalizeHydratedEvents(events: KeystrokeEvent[]): KeystrokeEvent[] {
  if (!events.length) return [];

  const timestampValues = events
    .map((event) => safeNumber(event.timestamp))
    .filter((value): value is number => value !== null);
  const hasPlausibleWallClock = timestampValues.some((value) =>
    isPlausibleWallClock(value),
  );
  const firstRawTimestamp = timestampValues[0] ?? null;
  const lastRawTimestamp = timestampValues[timestampValues.length - 1] ?? null;
  const fallbackEndAt = Date.now();
  const fallbackBaseAt =
    firstRawTimestamp !== null && lastRawTimestamp !== null
      ? fallbackEndAt - Math.max(0, lastRawTimestamp - firstRawTimestamp)
      : fallbackEndAt;

  let previousTimestamp = fallbackBaseAt;

  return events.map((event) => {
    const rawTimestamp = safeNumber(event.timestamp);
    let timestamp: number;

    if (isPlausibleWallClock(rawTimestamp)) {
      timestamp = rawTimestamp;
    } else if (
      !hasPlausibleWallClock &&
      rawTimestamp !== null &&
      firstRawTimestamp !== null
    ) {
      timestamp =
        fallbackBaseAt + Math.max(0, rawTimestamp - firstRawTimestamp);
    } else {
      timestamp = previousTimestamp;
    }

    previousTimestamp = timestamp;

    return {
      ...event,
      timestamp,
      flight_time: sanitizeFlightTime(event.flight_time),
    };
  });
}

function createRevisionId(timestamp = Date.now()): string {
  return `rev-${timestamp}-${Math.random().toString(36).slice(2, 10)}`;
}

function getSelectionSnapshot(
  textarea: HTMLTextAreaElement | null | undefined,
  fallbackText: string,
) {
  const textValue = textarea?.value ?? fallbackText;
  const rawStart =
    typeof textarea?.selectionStart === "number"
      ? textarea.selectionStart
      : textValue.length;
  const rawEnd =
    typeof textarea?.selectionEnd === "number"
      ? textarea.selectionEnd
      : rawStart;
  const start = Math.max(0, Math.min(rawStart, textValue.length));
  const end = Math.max(start, Math.min(rawEnd, textValue.length));

  return {
    textValue,
    start,
    end,
    selectionLength: Math.max(0, end - start),
    documentLength: textValue.length,
  };
}

function previousWordDeletionLength(value: string, cursor: number): number {
  if (cursor <= 0) return 0;
  const before = value.slice(0, cursor);
  const match = before.match(/\S+\s*$/);
  return match ? match[0].length : Math.min(1, cursor);
}

function nextWordDeletionLength(value: string, cursor: number): number {
  if (cursor >= value.length) return 0;
  const after = value.slice(cursor);
  const match = after.match(/^\s*\S+/);
  return match ? match[0].length : 1;
}

function lineBackwardDeletionLength(value: string, cursor: number): number {
  if (cursor <= 0) return 0;
  const previousBreak = value.lastIndexOf("\n", Math.max(0, cursor - 1));
  return cursor - (previousBreak + 1);
}

function lineForwardDeletionLength(value: string, cursor: number): number {
  if (cursor >= value.length) return 0;
  const nextBreak = value.indexOf("\n", cursor);
  return (nextBreak === -1 ? value.length : nextBreak) - cursor;
}

function computeKeyboardDeletionIntent(
  event: React.KeyboardEvent<HTMLTextAreaElement>,
  textValue: string,
  start: number,
  end: number,
): {
  predictedDeletedCharacters: number;
  deletionMethod: DeletionMethod;
} {
  const isBackspace = event.key === "Backspace";
  const isDelete = event.key === "Delete";
  const selectionLength = Math.max(0, end - start);

  if (!isBackspace && !isDelete) {
    return { predictedDeletedCharacters: 0, deletionMethod: "unknown" };
  }

  if (selectionLength > 0) {
    return {
      predictedDeletedCharacters: selectionLength,
      deletionMethod:
        selectionLength >= Math.max(1, textValue.length * 0.8)
          ? "all"
          : "selection",
    };
  }

  if (event.metaKey && isBackspace) {
    return {
      predictedDeletedCharacters: lineBackwardDeletionLength(textValue, start),
      deletionMethod: "line",
    };
  }

  if (event.metaKey && isDelete) {
    return {
      predictedDeletedCharacters: lineForwardDeletionLength(textValue, start),
      deletionMethod: "line",
    };
  }

  if ((event.ctrlKey || event.altKey) && isBackspace) {
    return {
      predictedDeletedCharacters: previousWordDeletionLength(textValue, start),
      deletionMethod: "word",
    };
  }

  if ((event.ctrlKey || event.altKey) && isDelete) {
    return {
      predictedDeletedCharacters: nextWordDeletionLength(textValue, start),
      deletionMethod: "word",
    };
  }

  if (isBackspace) {
    return {
      predictedDeletedCharacters: start > 0 ? 1 : 0,
      deletionMethod: "single",
    };
  }

  return {
    predictedDeletedCharacters: start < textValue.length ? 1 : 0,
    deletionMethod: "single",
  };
}

function deletionMethodFromInputType(
  inputType: string | undefined,
  fallback: DeletionMethod,
): DeletionMethod {
  switch (inputType) {
    case "deleteWordBackward":
    case "deleteWordForward":
      return "word";
    case "deleteHardLineBackward":
    case "deleteSoftLineBackward":
    case "deleteHardLineForward":
    case "deleteSoftLineForward":
      return "line";
    case "deleteByCut":
      return "cut";
    case "insertReplacementText":
      return "replacement";
    default:
      return fallback;
  }
}

function classifyConfirmedDeletion(params: {
  inputType?: string;
  fallback: DeletionMethod;
  deletedCharacters: number;
  selectionLengthBefore: number;
  documentLengthBefore: number;
  insertedCharacters: number;
}): DeletionMethod {
  const fromInput = deletionMethodFromInputType(
    params.inputType,
    params.fallback,
  );

  if (
    params.deletedCharacters >= Math.max(1, params.documentLengthBefore * 0.8)
  ) {
    return "all";
  }

  if (fromInput !== "unknown") return fromInput;

  if (params.insertedCharacters > 0 && params.deletedCharacters > 0) {
    return "replacement";
  }

  if (params.selectionLengthBefore > 0) return "selection";

  return params.deletedCharacters > 1 ? "word" : "single";
}

function computeTextDelta(previousText: string, nextText: string): TextDelta {
  if (previousText === nextText) {
    return {
      deletedCharacters: 0,
      insertedCharacters: 0,
      deltaLength: 0,
      start: 0,
      deletedTextLength: 0,
      insertedTextLength: 0,
    };
  }

  let prefix = 0;
  const minLength = Math.min(previousText.length, nextText.length);
  while (prefix < minLength && previousText[prefix] === nextText[prefix]) {
    prefix += 1;
  }

  let previousSuffix = previousText.length - 1;
  let nextSuffix = nextText.length - 1;
  while (
    previousSuffix >= prefix &&
    nextSuffix >= prefix &&
    previousText[previousSuffix] === nextText[nextSuffix]
  ) {
    previousSuffix -= 1;
    nextSuffix -= 1;
  }

  const deletedTextLength = Math.max(0, previousSuffix - prefix + 1);
  const insertedTextLength = Math.max(0, nextSuffix - prefix + 1);

  return {
    deletedCharacters: deletedTextLength,
    insertedCharacters: insertedTextLength,
    deltaLength: nextText.length - previousText.length,
    start: prefix,
    deletedTextLength,
    insertedTextLength,
  };
}

function isKeyUpEvent(event: KeystrokeEvent): boolean {
  return event.type === "keyup";
}

function isDeleteKeyDownEvent(event: KeystrokeEvent): boolean {
  return (
    event.type === "keydown" &&
    (event.key === "Backspace" || event.key === "Delete")
  );
}

function getDeletedCharacters(event: KeystrokeEvent): number {
  // Keyup is only the release half of a key action. It must never count as a
  // separate deletion/revision event. Without this guard, one Backspace press is
  // counted once on keydown and once again on keyup.
  if (isKeyUpEvent(event)) return 0;

  const explicit = safeNumber(event.chars_deleted ?? event.deletedCharacters);
  if (explicit !== null && explicit > 0) return Math.round(explicit);

  // Legacy fallback: old raw events did not have chars_deleted, so count one
  // removed character only for the keydown event itself.
  if (isDeleteKeyDownEvent(event)) return 1;

  return 0;
}

function isDeletionEvidence(event: KeystrokeEvent): boolean {
  if (isKeyUpEvent(event)) return false;

  return (
    getDeletedCharacters(event) > 0 ||
    isDeleteKeyDownEvent(event) ||
    event.key === "__CUT_EVENT__" ||
    event.key === "__TEXT_REVISION__" ||
    Boolean(event.deletion_method && event.deletion_method !== "unknown")
  );
}

function computeRevisionMetrics(events: KeystrokeEvent[]) {
  const revisions = new Map<
    string,
    {
      deletedCharacters: number;
      method: DeletionMethod;
      selectionLength: number;
      cut: boolean;
      bulk: boolean;
    }
  >();

  events.forEach((event, index) => {
    if (!isDeletionEvidence(event)) return;

    const deletedCharacters = getDeletedCharacters(event);
    const id =
      event.revision_id ||
      `${event.timestamp || 0}-${event.type}-${event.key}-${index}`;
    const existing = revisions.get(id);
    const selectionLength = Math.max(
      0,
      Number(event.selection_length_before ?? 0) || 0,
    );
    const method = event.deletion_method || "unknown";
    const bulk =
      Boolean(event.isBulkDeletion || event.bulk_deletion) ||
      deletedCharacters >= BULK_DELETE_THRESHOLD ||
      selectionLength >= BULK_DELETE_THRESHOLD ||
      method === "word" ||
      method === "line" ||
      method === "selection" ||
      method === "cut" ||
      method === "all";

    if (!existing) {
      revisions.set(id, {
        deletedCharacters,
        method,
        selectionLength,
        cut: method === "cut" || event.type === "cut",
        bulk,
      });
      return;
    }

    existing.deletedCharacters = Math.max(
      existing.deletedCharacters,
      deletedCharacters,
    );
    existing.selectionLength = Math.max(
      existing.selectionLength,
      selectionLength,
    );
    existing.cut = existing.cut || method === "cut" || event.type === "cut";
    existing.bulk = existing.bulk || bulk;
    if (existing.method === "unknown" && method !== "unknown") {
      existing.method = method;
    }
  });

  const values = Array.from(revisions.values());
  const deletedCharacters = values.reduce(
    (sum, revision) => sum + Math.max(0, revision.deletedCharacters),
    0,
  );

  return {
    deleteActions: values.length,
    deletedCharacters,
    bulkDeletionEvents: values.filter((revision) => revision.bulk).length,
    largestDeletionChars: values.reduce(
      (largest, revision) => Math.max(largest, revision.deletedCharacters),
      0,
    ),
    selectionDeletionEvents: values.filter(
      (revision) =>
        revision.selectionLength > 0 ||
        revision.method === "selection" ||
        revision.method === "replacement" ||
        revision.method === "all",
    ).length,
    wordDeletionEvents: values.filter((revision) => revision.method === "word")
      .length,
    cutEvents: values.filter((revision) => revision.cut).length,
  };
}

function createEmptyStats(): SessionStats {
  return {
    wpm: 0,
    keystrokes: 0,
    deletions: 0,
    deletedCharacters: 0,
    bulkDeletionEvents: 0,
    largestDeletionChars: 0,
    selectionDeletionEvents: 0,
    wordDeletionEvents: 0,
    cutEvents: 0,
    pauses: 0,
    avgIki: 0,
    sessionSeconds: 0,
  };
}

export function useKeystrokeCapture({
  text,
  textareaRef,
}: UseKeystrokeCaptureOptions) {
  // Wall-clock timestamps identify real events. Active writing duration is
  // tracked separately so saved drafts do not keep aging in the background.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [lastActivityAt, setLastActivityAt] = useState<number | null>(null);
  const [activeDurationMs, setActiveDurationMs] = useState(0);

  const textRef = useRef(text);
  const logRef = useRef<KeystrokeEvent[]>([]);
  const activeKeysRef = useRef<Record<string, ActiveKey>>({});
  const lastKeyDownTimestampRef = useRef<number | null>(null);
  const lastCursorPositionRef = useRef<number>(0);
  const lastCursorEventAtRef = useRef<number>(0);
  const lastTextMutationAtRef = useRef<number>(0);
  const pendingIntentRef = useRef<PendingInputIntent | null>(null);
  const activeDurationMsRef = useRef(0);
  const lastActivityAtRef = useRef<number | null>(null);
  const idleBreakCountRef = useRef(0);
  const idleBreakDurationMsRef = useRef(0);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  const getActiveDurationMs = useCallback(() => {
    return Math.max(0, Math.round(activeDurationMsRef.current));
  }, []);

  const appendIdleBreakEvent = useCallback(
    (timestamp: number, idleBreakMs: number) => {
      if (idleBreakMs <= IDLE_BREAK_THRESHOLD_MS) return;

      logRef.current.push({
        key: "__IDLE_BREAK__",
        keyCode: 0,
        code: "IdleBreak",
        type: "input",
        timestamp,
        down_time: null,
        up_time: null,
        dwell_time: null,
        flight_time: null,
        documentLength: textRef.current.length,
        cursorPosition: textRef.current.length,
        inputType: "historyIdleBreak",
        deltaLength: 0,
        insertedCharacters: 0,
        deletedCharacters: 0,
        chars_deleted: 0,
        deletion_method: "unknown",
        isBulkDeletion: false,
        bulk_deletion: false,
        idleBreakMs: Math.round(idleBreakMs),
        idle_break_ms: Math.round(idleBreakMs),
      });
    },
    [],
  );

  const registerActivity = useCallback(
    (
      timestamp: number,
      options?: {
        logIdleBreak?: boolean;
      },
    ) => {
      setStartedAt((current) => current ?? timestamp);

      const previousActivityAt = lastActivityAtRef.current;
      let activeMs = Math.max(0, activeDurationMsRef.current);
      let resumedAfterIdle = false;
      let idleBreakMs = 0;

      if (previousActivityAt !== null) {
        const gap = Math.max(0, timestamp - previousActivityAt);

        if (gap > IDLE_BREAK_THRESHOLD_MS) {
          resumedAfterIdle = true;
          idleBreakMs = gap;
          idleBreakCountRef.current += 1;
          idleBreakDurationMsRef.current += gap;
          lastKeyDownTimestampRef.current = null;
          activeKeysRef.current = {};

          if (options?.logIdleBreak !== false) {
            appendIdleBreakEvent(timestamp, gap);
          }
        } else {
          activeMs += gap;
        }
      }

      activeDurationMsRef.current = Math.max(0, Math.round(activeMs));
      lastActivityAtRef.current = timestamp;

      setLastActivityAt(timestamp);
      setActiveDurationMs(activeDurationMsRef.current);

      return {
        resumedAfterIdle,
        idleBreakMs,
      };
    },
    [appendIdleBreakEvent],
  );

  const getCursorPosition = useCallback((target: EventTarget | null) => {
    const textarea = target as HTMLTextAreaElement | null;
    return typeof textarea?.selectionStart === "number"
      ? textarea.selectionStart
      : textRef.current.length;
  }, []);

  const setPendingIntent = useCallback((intent: PendingInputIntent) => {
    pendingIntentRef.current = intent;
  }, []);

  const getFreshIntent = useCallback((timestamp: number) => {
    const intent = pendingIntentRef.current;
    if (!intent) return null;
    if (timestamp - intent.timestamp > INTENT_TTL_MS) return null;
    return intent;
  }, []);

  const patchEventWithRevision = useCallback(
    (eventIndex: number | null | undefined, patch: Partial<KeystrokeEvent>) => {
      if (typeof eventIndex !== "number" || eventIndex < 0) return;
      const event = logRef.current[eventIndex];
      if (!event) return;
      logRef.current[eventIndex] = {
        ...event,
        ...patch,
      };
    },
    [],
  );

  const appendRevisionEvent = useCallback((event: KeystrokeEvent) => {
    logRef.current.push(event);
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.repeat) return;

      const wallNow = Date.now();
      const perfNow = performance.now();
      const activity = registerActivity(wallNow);

      const keyId = `${event.code || event.key}-${event.keyCode}`;
      const previousKeyDownAt = activity.resumedAfterIdle
        ? null
        : lastKeyDownTimestampRef.current;
      const flightTime =
        previousKeyDownAt === null
          ? null
          : sanitizeFlightTime(Math.round(wallNow - previousKeyDownAt));

      lastKeyDownTimestampRef.current = wallNow;

      const snapshot = getSelectionSnapshot(
        event.currentTarget ?? textareaRef?.current,
        textRef.current,
      );
      const deletionIntent = computeKeyboardDeletionIntent(
        event,
        snapshot.textValue,
        snapshot.start,
        snapshot.end,
      );
      const isDeletionKey = event.key === "Backspace" || event.key === "Delete";

      // FIX (replace-over-selection correlation bug): typing a printable
      // character while text is selected replaces that selection in one
      // atomic user action (e.g. select a wrong letter, retype the correct
      // one). Previously only Backspace/Delete were treated as "revision"
      // keys, so this case produced TWO disconnected log entries: a plain
      // keydown with the new character but no deletion info, and a separate,
      // uncorrelated "__TEXT_REVISION__" event from recordTextChange holding
      // the real deleted/inserted counts but no literal character. Replay
      // reconstruction only reads keydown events, so the old character was
      // never removed and the new character got misplaced. Treating an
      // active selection the same way as an explicit delete key means this
      // single keydown event carries both the literal character AND gets
      // patched later with the confirmed delete/insert counts.
      // Only a printable character, Enter, or Tab actually replaces a live
      // selection with new content in a plain textarea.
      const isMutatingKeyPress =
        event.key.length === 1 || event.key === "Enter" || event.key === "Tab";
      const hasActiveSelection =
        snapshot.selectionLength > 0 && isMutatingKeyPress;
      const willActuallyDelete = isDeletionKey || hasActiveSelection;

      // FIX (severe capture gaps on mobile/virtual-keyboard/IME typing):
      // many software keyboards, predictive-text engines, and IME
      // composition flows fire keydown with `key === "Unidentified"` (or
      // "Process"/"Dead") instead of the real character — the real text
      // only ever shows up in the resulting onChange. Previously, a
      // revision candidate was only registered for Backspace/Delete/an
      // active selection, so these keydowns were logged with a
      // meaningless key value and recordTextChange had no tracked intent to
      // patch with the confirmed text, silently dropping the edit. Any key
      // that isn't clearly non-mutating (navigation, modifiers, or a
      // Ctrl/Meta/Alt shortcut combo) is now tracked as a candidate, so
      // recordTextChange can always find a primary event to patch with the
      // real, confirmed content — regardless of what the raw key name was.
      const isKnownNonMutatingKey = NON_MUTATING_KEYS.has(event.key);
      // Only Ctrl/Cmd WITHOUT Alt is treated as a shortcut (copy, select-all,
      // undo, etc.). AltGr on many international keyboard layouts reports
      // ctrlKey+altKey together while typing a real character (e.g. "@",
      // "€", accented letters) — excluding it here would leave that
      // character with no tracked candidate, and since every confirmed
      // delta is now always logged (see recordTextChange), it would get
      // inserted a second time as an unmatched standalone event.
      const isShortcutCombo =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.length === 1 &&
        !isDeletionKey;
      const capturesRevision = !isKnownNonMutatingKey && !isShortcutCombo;
      const revisionId = capturesRevision
        ? createRevisionId(wallNow)
        : undefined;

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
        documentLength: snapshot.documentLength,
        cursorPosition: snapshot.start,
        ...(revisionId
          ? {
              revision_id: revisionId,
              documentLengthBefore: snapshot.documentLength,
              selectionStartBefore: snapshot.start,
              selectionEndBefore: snapshot.end,
              selection_length_before: snapshot.selectionLength,
              ...(willActuallyDelete
                ? {
                    chars_deleted:
                      deletionIntent.predictedDeletedCharacters > 0
                        ? deletionIntent.predictedDeletedCharacters
                        : snapshot.selectionLength,
                    deletedCharacters:
                      deletionIntent.predictedDeletedCharacters > 0
                        ? deletionIntent.predictedDeletedCharacters
                        : snapshot.selectionLength,
                    deletion_method: isDeletionKey
                      ? deletionIntent.deletionMethod
                      : "replacement",
                    isBulkDeletion:
                      deletionIntent.predictedDeletedCharacters >=
                        BULK_DELETE_THRESHOLD ||
                      snapshot.selectionLength >= BULK_DELETE_THRESHOLD ||
                      deletionIntent.deletionMethod !== "single",
                    bulk_deletion:
                      deletionIntent.predictedDeletedCharacters >=
                        BULK_DELETE_THRESHOLD ||
                      snapshot.selectionLength >= BULK_DELETE_THRESHOLD ||
                      deletionIntent.deletionMethod !== "single",
                  }
                : {}),
            }
          : {}),
      };

      logRef.current.push(entry);
      const eventIndex = logRef.current.length - 1;
      lastCursorPositionRef.current = snapshot.start;

      if (capturesRevision) {
        setPendingIntent({
          id: revisionId ?? createRevisionId(wallNow),
          source: "keydown",
          timestamp: wallNow,
          eventIndex,
          key: event.key,
          selectionStartBefore: snapshot.start,
          selectionEndBefore: snapshot.end,
          selectionLengthBefore: snapshot.selectionLength,
          documentLengthBefore: snapshot.documentLength,
          predictedDeletedCharacters: isDeletionKey
            ? deletionIntent.predictedDeletedCharacters
            : snapshot.selectionLength,
          predictedInsertedCharacters: isDeletionKey
            ? 0
            : event.key === "Tab"
              ? 4
              : event.key === "Enter" || event.key.length === 1
                ? 1
                : 0,
          deletionMethod: willActuallyDelete
            ? isDeletionKey
              ? deletionIntent.deletionMethod
              : "replacement"
            : "unknown",
        });
      }

      activeKeysRef.current[keyId] = {
        index: eventIndex,
        downTime: perfNow,
        downTimestamp: wallNow,
      };
    },
    [registerActivity, setPendingIntent, textareaRef],
  );

  const handleBeforeInput = useCallback(
    (event: React.FormEvent<HTMLTextAreaElement>) => {
      const native = event.nativeEvent as InputEvent;
      const inputType = native?.inputType || "";

      if (!inputType) return;

      const isDeletionInput = inputType.startsWith("delete");
      const isPasteInput = inputType === "insertFromPaste";
      const hasReplacementSelection =
        inputType.startsWith("insert") &&
        (event.currentTarget.selectionEnd ?? 0) >
          (event.currentTarget.selectionStart ?? 0);
      // Browser/OS spellcheck corrections (right-click "Correct spelling",
      // mobile autocorrect, IME candidate replacement) fire this exact
      // inputType. Relying only on `hasReplacementSelection` is fragile —
      // some browsers don't reliably expose the replaced range as
      // selectionStart/selectionEnd at the moment this event fires — so the
      // inputType itself is treated as sufficient signal on its own.
      const isReplacementInput = inputType === "insertReplacementText";

      if (
        !isDeletionInput &&
        !isPasteInput &&
        !hasReplacementSelection &&
        !isReplacementInput
      )
        return;

      const wallNow = Date.now();
      const snapshot = getSelectionSnapshot(
        event.currentTarget ?? textareaRef?.current,
        textRef.current,
      );
      const fallbackMethod: DeletionMethod = isPasteInput
        ? "unknown"
        : hasReplacementSelection || isReplacementInput
          ? "replacement"
          : snapshot.selectionLength > 0
            ? "selection"
            : "unknown";

      const existingIntent = getFreshIntent(wallNow);

      setPendingIntent({
        id: existingIntent?.id ?? createRevisionId(wallNow),
        source: "beforeinput",
        timestamp: wallNow,
        eventIndex: existingIntent?.eventIndex ?? null,
        inputType,
        key: existingIntent?.key,
        selectionStartBefore:
          existingIntent?.selectionStartBefore ?? snapshot.start,
        selectionEndBefore: existingIntent?.selectionEndBefore ?? snapshot.end,
        selectionLengthBefore: Math.max(
          existingIntent?.selectionLengthBefore ?? 0,
          snapshot.selectionLength,
        ),
        documentLengthBefore:
          existingIntent?.documentLengthBefore ?? snapshot.documentLength,
        predictedDeletedCharacters: Math.max(
          existingIntent?.predictedDeletedCharacters ?? 0,
          snapshot.selectionLength,
        ),
        predictedInsertedCharacters:
          typeof native.data === "string" ? native.data.length : 0,
        deletionMethod: deletionMethodFromInputType(
          inputType,
          existingIntent?.deletionMethod ?? fallbackMethod,
        ),
      });
    },
    [getFreshIntent, setPendingIntent, textareaRef],
  );

  const handleKeyUp = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const wallNow = Date.now();
      const perfNow = performance.now();
      const keyId = `${event.code || event.key}-${event.keyCode}`;
      const activeKey = activeKeysRef.current[keyId];

      if (!activeKey) return;

      registerActivity(wallNow, { logIdleBreak: false });

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
        documentLength: textRef.current.length,
        cursorPosition: getCursorPosition(event.currentTarget),
      });

      delete activeKeysRef.current[keyId];
      setLastActivityAt(wallNow);
    },
    [getCursorPosition, registerActivity],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const wallNow = Date.now();
      const perfNow = performance.now();
      const activity = registerActivity(wallNow);

      const pastedText = event.clipboardData.getData("text") || "";
      const snapshot = getSelectionSnapshot(
        event.currentTarget,
        textRef.current,
      );
      const revisionId = createRevisionId(wallNow);

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
          activity.resumedAfterIdle || lastKeyDownTimestampRef.current === null
            ? null
            : sanitizeFlightTime(
                Math.round(wallNow - lastKeyDownTimestampRef.current),
              ),
        documentLength: snapshot.documentLength,
        cursorPosition: snapshot.start,
        pastedLength: pastedText.length,
        // FIX: previously only the length was ever recorded; the placeholder
        // "[pasted N characters]" was all replay could ever show. A reviewer
        // assessing a flagged session needs to see what was actually pasted
        // (e.g. to judge whether it looks AI-generated), so the literal
        // pasted text is captured here.
        insertedText: pastedText,
        revision_id: revisionId,
        inputType: "insertFromPaste",
        documentLengthBefore: snapshot.documentLength,
        selectionStartBefore: snapshot.start,
        selectionEndBefore: snapshot.end,
        selection_length_before: snapshot.selectionLength,
        insertedCharacters: pastedText.length,
        chars_deleted:
          snapshot.selectionLength > 0 ? snapshot.selectionLength : undefined,
        deletedCharacters:
          snapshot.selectionLength > 0 ? snapshot.selectionLength : undefined,
        deletion_method:
          snapshot.selectionLength > 0
            ? snapshot.selectionLength >=
              Math.max(1, snapshot.documentLength * 0.8)
              ? "all"
              : "replacement"
            : undefined,
        isBulkDeletion: snapshot.selectionLength >= BULK_DELETE_THRESHOLD,
        bulk_deletion: snapshot.selectionLength >= BULK_DELETE_THRESHOLD,
      });

      setPendingIntent({
        id: revisionId,
        source: "paste",
        timestamp: wallNow,
        eventIndex: logRef.current.length - 1,
        inputType: "insertFromPaste",
        selectionStartBefore: snapshot.start,
        selectionEndBefore: snapshot.end,
        selectionLengthBefore: snapshot.selectionLength,
        documentLengthBefore: snapshot.documentLength,
        predictedDeletedCharacters: snapshot.selectionLength,
        predictedInsertedCharacters: pastedText.length,
        deletionMethod:
          snapshot.selectionLength > 0 ? "replacement" : "unknown",
      });

      lastKeyDownTimestampRef.current = null;
      lastCursorPositionRef.current = snapshot.start + pastedText.length;
      lastTextMutationAtRef.current = wallNow;
      setLastActivityAt(wallNow);
    },
    [registerActivity, setPendingIntent],
  );

  const handleCut = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const wallNow = Date.now();
      const perfNow = performance.now();
      const snapshot = getSelectionSnapshot(
        event.currentTarget,
        textRef.current,
      );

      if (snapshot.selectionLength <= 0) return;

      const activity = registerActivity(wallNow);

      const revisionId = createRevisionId(wallNow);
      const method: DeletionMethod =
        snapshot.selectionLength >= Math.max(1, snapshot.documentLength * 0.8)
          ? "all"
          : "cut";

      logRef.current.push({
        key: "__CUT_EVENT__",
        keyCode: 0,
        code: "Cut",
        type: "cut",
        timestamp: wallNow,
        down_time: Math.round(perfNow),
        up_time: Math.round(perfNow),
        dwell_time: 0,
        flight_time:
          activity.resumedAfterIdle || lastKeyDownTimestampRef.current === null
            ? null
            : sanitizeFlightTime(
                Math.round(wallNow - lastKeyDownTimestampRef.current),
              ),
        documentLength: snapshot.documentLength,
        cursorPosition: snapshot.start,
        revision_id: revisionId,
        inputType: "deleteByCut",
        documentLengthBefore: snapshot.documentLength,
        selectionStartBefore: snapshot.start,
        selectionEndBefore: snapshot.end,
        selection_length_before: snapshot.selectionLength,
        chars_deleted: snapshot.selectionLength,
        deletedCharacters: snapshot.selectionLength,
        deletion_method: method,
        isBulkDeletion: snapshot.selectionLength >= BULK_DELETE_THRESHOLD,
        bulk_deletion: snapshot.selectionLength >= BULK_DELETE_THRESHOLD,
      });

      setPendingIntent({
        id: revisionId,
        source: "cut",
        timestamp: wallNow,
        eventIndex: logRef.current.length - 1,
        inputType: "deleteByCut",
        selectionStartBefore: snapshot.start,
        selectionEndBefore: snapshot.end,
        selectionLengthBefore: snapshot.selectionLength,
        documentLengthBefore: snapshot.documentLength,
        predictedDeletedCharacters: snapshot.selectionLength,
        predictedInsertedCharacters: 0,
        deletionMethod: method,
      });

      lastCursorPositionRef.current = snapshot.start;
      lastTextMutationAtRef.current = wallNow;
      setLastActivityAt(wallNow);
    },
    [registerActivity, setPendingIntent],
  );

  const recordTextChange = useCallback(
    (nextText: string, options?: { inputType?: string }) => {
      const previousText = textRef.current;

      if (previousText === nextText) return;

      const wallNow = Date.now();
      const perfNow = performance.now();
      const activity = registerActivity(wallNow);

      const delta = computeTextDelta(previousText, nextText);
      const intent = getFreshIntent(wallNow);
      const inputType = options?.inputType || intent?.inputType;
      const deletedCharacters = delta.deletedCharacters;
      const insertedCharacters = delta.insertedCharacters;
      const documentLengthBefore =
        intent?.documentLengthBefore ?? previousText.length;
      const selectionLengthBefore = intent?.selectionLengthBefore ?? 0;
      const revisionId = intent?.id ?? createRevisionId(wallNow);
      const deletionMethod =
        deletedCharacters > 0
          ? classifyConfirmedDeletion({
              inputType,
              fallback: intent?.deletionMethod ?? "unknown",
              deletedCharacters,
              selectionLengthBefore,
              documentLengthBefore,
              insertedCharacters,
            })
          : undefined;
      const isBulkDeletion =
        deletedCharacters >= BULK_DELETE_THRESHOLD ||
        selectionLengthBefore >= BULK_DELETE_THRESHOLD ||
        deletionMethod === "word" ||
        deletionMethod === "line" ||
        deletionMethod === "selection" ||
        deletionMethod === "replacement" ||
        deletionMethod === "cut" ||
        deletionMethod === "all";

      // FIX (severe capture gaps / spellcheck corrections silently dropped):
      // `previousText !== nextText` (checked above) already guarantees this
      // delta deletes and/or inserts something, so there is never a reason
      // to skip logging it — the old guard here (`deletedCharacters > 0 ||
      // ...`) is what silently dropped pure insertions with zero deletions,
      // e.g. a spellcheck correction like "cmputer" -> "computer" (a single
      // inserted "o", nothing removed), and — far more consequentially —
      // entire runs of mobile/IME-typed text whose keydown events carry a
      // meaningless `key` value. Every confirmed delta is now captured.
      // Captures the literal text for this delta — including paste content,
      // per an explicit product decision to show reviewers what was
      // actually pasted rather than only a character count.
      const insertedText = nextText.slice(
        delta.start,
        delta.start + delta.insertedTextLength,
      );

      const patch: Partial<KeystrokeEvent> = {
        revision_id: revisionId,
        inputType,
        documentLengthBefore,
        documentLengthAfter: nextText.length,
        selectionStartBefore: intent?.selectionStartBefore,
        selectionEndBefore: intent?.selectionEndBefore,
        selection_length_before: selectionLengthBefore,
        deltaLength: delta.deltaLength,
        insertedCharacters,
        insertedText,
        deletedCharacters,
        chars_deleted: deletedCharacters > 0 ? deletedCharacters : undefined,
        deletion_method: deletionMethod,
        isBulkDeletion,
        bulk_deletion: isBulkDeletion,
      };

      const hasPrimaryEvent =
        typeof intent?.eventIndex === "number" && intent.eventIndex >= 0;

      if (hasPrimaryEvent) {
        // A keyboard/paste/cut event already represents this user action.
        // Patch that primary event with the confirmed text delta instead of
        // appending another deletion evidence event. This prevents one
        // Backspace/Delete action from being counted twice in live stats,
        // and is also what corrects a keydown that was logged with a
        // meaningless key value (mobile/IME) into an accurate one.
        patchEventWithRevision(intent.eventIndex, patch);
      } else {
        // Some edits do not have a matching keydown event at all, for
        // example a context-menu spellcheck correction or an IME commit
        // that never fired a trackable keydown. In those cases, create
        // exactly one standalone revision event.
        //
        // A distinct key is used for pure insertions ("__TEXT_INSERT__")
        // instead of reusing "__TEXT_REVISION__", because the backend
        // treats "__TEXT_REVISION__" as always-a-deletion regardless of
        // the recorded count — reusing it here would make replay delete a
        // character that was never actually removed.
        appendRevisionEvent({
          key:
            deletedCharacters > 0
              ? "__TEXT_REVISION__"
              : intent?.source === "paste"
                ? "__PASTE_COMMIT__"
                : "__TEXT_INSERT__",
          keyCode: 0,
          code: inputType || "Input",
          type: "input",
          timestamp: wallNow,
          down_time: Math.round(perfNow),
          up_time: Math.round(perfNow),
          dwell_time: 0,
          flight_time:
            activity.resumedAfterIdle ||
            lastKeyDownTimestampRef.current === null
              ? null
              : sanitizeFlightTime(
                  Math.round(wallNow - lastKeyDownTimestampRef.current),
                ),
          documentLength: nextText.length,
          // Unified contract: cursorPosition always marks the LEFT EDGE
          // where the edit begins (matches how a real keydown records
          // `snapshot.start` before the browser applies the change), not
          // the position after insertion. Replay relies on this being
          // consistent across every event type.
          cursorPosition: delta.start,
          pastedLength:
            intent?.source === "paste" ? insertedCharacters : undefined,
          ...patch,
        });
      }

      lastCursorPositionRef.current = delta.start + insertedCharacters;
      lastTextMutationAtRef.current = wallNow;
      textRef.current = nextText;
      setLastActivityAt(wallNow);
      pendingIntentRef.current = null;
    },
    [
      appendRevisionEvent,
      registerActivity,
      getFreshIntent,
      patchEventWithRevision,
    ],
  );

  const resetCapture = useCallback(() => {
    logRef.current = [];
    activeKeysRef.current = {};
    lastKeyDownTimestampRef.current = null;
    lastCursorPositionRef.current = 0;
    lastCursorEventAtRef.current = 0;
    lastTextMutationAtRef.current = 0;
    pendingIntentRef.current = null;
    activeDurationMsRef.current = 0;
    lastActivityAtRef.current = null;
    idleBreakCountRef.current = 0;
    idleBreakDurationMsRef.current = 0;
    textRef.current = "";
    setStartedAt(null);
    setLastActivityAt(null);
    setActiveDurationMs(0);
  }, []);

  const hydrateCapture = useCallback((payload: CaptureHydrationPayload) => {
    const events = normalizeHydratedEvents(
      Array.isArray(payload.events) ? payload.events : [],
    );
    logRef.current = events;
    activeKeysRef.current = {};
    pendingIntentRef.current = null;

    const rawStartedAt = safeNumber(payload.startedAt);
    const rawLastActivityAt = safeNumber(payload.lastActivityAt);
    const firstEventAt = getFirstPlausibleEventTimestamp(events);
    const lastEventAt = getLastPlausibleKeyDownTimestamp(events);
    const hydratedActiveDurationMs =
      sanitizeActiveDurationMs(payload.activeDurationMs) ??
      estimateActiveDurationMsFromEvents(events);

    const hydratedStartedAt = isPlausibleWallClock(rawStartedAt)
      ? rawStartedAt
      : firstEventAt;
    const hydratedLastActivityAt = isPlausibleWallClock(rawLastActivityAt)
      ? rawLastActivityAt
      : (lastEventAt ?? hydratedStartedAt);

    // Restored drafts resume as a new active editing segment. The first key
    // after resume must not inherit a flight-time gap from the previous sitting.
    activeDurationMsRef.current = hydratedActiveDurationMs;
    lastActivityAtRef.current = hydratedLastActivityAt;
    idleBreakCountRef.current = 0;
    idleBreakDurationMsRef.current = 0;
    lastKeyDownTimestampRef.current = null;

    setStartedAt(hydratedStartedAt);
    setLastActivityAt(hydratedLastActivityAt);
    setActiveDurationMs(hydratedActiveDurationMs);
  }, []);

  const getCaptureSnapshot = useCallback(
    (options?: CaptureSnapshotOptions): CaptureSnapshot => {
      const timestamp = options?.timestamp ?? Date.now();
      const effectiveLastActivityAt =
        lastActivityAtRef.current ?? lastActivityAt ?? startedAt ?? timestamp;
      const snapshotActiveDurationMs = getActiveDurationMs();

      if (options?.pause) {
        activeDurationMsRef.current = snapshotActiveDurationMs;
        activeKeysRef.current = {};
        pendingIntentRef.current = null;
        lastKeyDownTimestampRef.current = null;
        setActiveDurationMs(snapshotActiveDurationMs);
      }

      return {
        events: logRef.current,
        startedAt,
        lastActivityAt: effectiveLastActivityAt,
        lastKeyDownTimestamp: options?.pause
          ? null
          : lastKeyDownTimestampRef.current,
        activeDurationMs: snapshotActiveDurationMs,
        pausedAt: options?.pause ? timestamp : null,
      };
    },
    [getActiveDurationMs, lastActivityAt, startedAt],
  );

  const getStats = useCallback((): SessionStats => {
    const keydownEvents = logRef.current.filter(
      (event) => event.type === "keydown",
    );
    const flightTimes = keydownEvents
      .map((event) => sanitizeFlightTime(event.flight_time))
      .filter((value): value is number => value !== null);
    const typingFlightTimes = flightTimes.filter(
      (value) => value <= MAX_TYPING_FLIGHT_TIME_MS,
    );

    const revisionMetrics = computeRevisionMetrics(logRef.current);

    const pauses = flightTimes.filter((value) => value > 1000).length;

    const avgIki =
      typingFlightTimes.length > 0
        ? Math.round(
            typingFlightTimes.reduce((sum, value) => sum + value, 0) /
              typingFlightTimes.length,
          )
        : 0;

    const wordCount = countWords(textRef.current);
    const activeMs = getActiveDurationMs();
    const hasActivity =
      logRef.current.length > 0 || keydownEvents.length > 0 || wordCount > 0;
    const sessionSeconds =
      activeMs <= 0
        ? hasActivity
          ? 1
          : 0
        : Math.max(1, Math.round(activeMs / 1000));

    const wpm =
      sessionSeconds > 0 ? Math.round((wordCount / sessionSeconds) * 60) : 0;

    return {
      wpm,
      keystrokes: keydownEvents.length,
      deletions: revisionMetrics.deleteActions,
      deletedCharacters: revisionMetrics.deletedCharacters,
      bulkDeletionEvents: revisionMetrics.bulkDeletionEvents,
      largestDeletionChars: revisionMetrics.largestDeletionChars,
      selectionDeletionEvents: revisionMetrics.selectionDeletionEvents,
      wordDeletionEvents: revisionMetrics.wordDeletionEvents,
      cutEvents: revisionMetrics.cutEvents,
      pauses,
      avgIki,
      sessionSeconds,
    };
  }, [activeDurationMs, getActiveDurationMs, lastActivityAt]);

  const [liveStats, setLiveStats] = useState<SessionStats>(() =>
    createEmptyStats(),
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLiveStats(getStats());
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeDurationMs, getStats, text]);

  // Cursor-movement tracking: logs a lightweight, non-mutating event when
  // the caret moves without any text change — clicking elsewhere in the
  // document, or navigating with arrow/Home/End/Page keys. This is what
  // lets replay show the student actually jumping back to an earlier
  // paragraph to make a correction, instead of only ever showing forward
  // progress. Wire this to the textarea's onSelect (fires on click, drag-
  // selection, and keyboard navigation alike).
  const handleSelectionChange = useCallback(
    (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const target = event.currentTarget;
      const start = target.selectionStart ?? 0;
      const end = target.selectionEnd ?? start;
      const wallNow = Date.now();

      // Skip the position this same instant already recorded via a text
      // mutation (keydown/paste/cut/recordTextChange) — onSelect fires
      // again right after those, and would otherwise log a redundant,
      // duplicate "cursor" event for every single keystroke.
      if (wallNow - lastTextMutationAtRef.current < 30) {
        lastCursorPositionRef.current = start;
        return;
      }

      if (start === lastCursorPositionRef.current && end === start) return;
      if (wallNow - lastCursorEventAtRef.current < CURSOR_EVENT_THROTTLE_MS) {
        return;
      }

      lastCursorPositionRef.current = start;
      lastCursorEventAtRef.current = wallNow;

      logRef.current.push({
        key: "__CURSOR_MOVE__",
        keyCode: 0,
        code: "Cursor",
        type: "cursor",
        timestamp: wallNow,
        down_time: null,
        up_time: null,
        dwell_time: null,
        flight_time: null,
        documentLength: target.value.length,
        cursorPosition: start,
        selectionStartBefore: start,
        selectionEndBefore: end,
        selection_length_before: Math.max(0, end - start),
      });
    },
    [],
  );

  return {
    keystrokeLogRef: logRef,
    startedAt,
    lastActivityAt,
    liveStats,
    handleKeyDown,
    handleKeyUp,
    handlePaste,
    handleCut,
    handleBeforeInput,
    handleSelectionChange,
    recordTextChange,
    getStats,
    resetCapture,
    hydrateCapture,
    getCaptureSnapshot,
  };
}
