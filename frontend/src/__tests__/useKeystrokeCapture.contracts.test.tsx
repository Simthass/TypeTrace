import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useKeystrokeCapture } from "../hooks/useKeystrokeCapture";
import type { KeystrokeEvent } from "../types/editor";

function writingEvent(
  text: string,
  timestamp: number,
  documentLengthBefore: number,
): KeystrokeEvent {
  return {
    key: text,
    keyCode: text.charCodeAt(0),
    code: "KeyA",
    type: "keydown",
    timestamp,
    down_time: 10,
    up_time: 80,
    dwell_time: 70,
    flight_time: documentLengthBefore === 0 ? null : 100,
    documentLength: documentLengthBefore,
    cursorPosition: documentLengthBefore,
    documentLengthBefore,
    documentLengthAfter: documentLengthBefore + text.length,
    deltaLength: text.length,
    insertedCharacters: text.length,
    insertedText: text,
    deletedCharacters: 0,
  };
}

describe("useKeystrokeCapture evidence contracts", () => {
  it("captures confirmed pure insertions that have no primary key event", () => {
    const { result } = renderHook(() => useKeystrokeCapture({ text: "" }));

    act(() => {
      result.current.recordTextChange("hello", { inputType: "insertText" });
    });

    const snapshot = result.current.getCaptureSnapshot();
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0]).toMatchObject({
      key: "__TEXT_INSERT__",
      type: "input",
      cursorPosition: 0,
      documentLengthBefore: 0,
      documentLengthAfter: 5,
      deltaLength: 5,
      insertedCharacters: 5,
      insertedText: "hello",
      deletedCharacters: 0,
    });

    const stats = result.current.getStats();
    expect(stats.deletions).toBe(0);
    expect(stats.deletedCharacters).toBe(0);
    expect(stats.sessionSeconds).toBeGreaterThanOrEqual(1);
  });

  it("records confirmed deletion volume without retaining deleted text", () => {
    const { result } = renderHook(() => useKeystrokeCapture({ text: "abc" }));

    act(() => {
      result.current.recordTextChange("ab", {
        inputType: "deleteContentBackward",
      });
    });

    const event = result.current.getCaptureSnapshot().events[0];
    expect(event).toMatchObject({
      key: "__TEXT_REVISION__",
      cursorPosition: 2,
      documentLengthBefore: 3,
      documentLengthAfter: 2,
      deltaLength: -1,
      insertedCharacters: 0,
      insertedText: "",
      deletedCharacters: 1,
      chars_deleted: 1,
    });
    expect(event).not.toHaveProperty("deletedText");

    const stats = result.current.getStats();
    expect(stats.deletions).toBe(1);
    expect(stats.deletedCharacters).toBe(1);
    expect(stats.largestDeletionChars).toBe(1);
  });

  it("hydrates detached evidence, preserves active time, and pauses safely", () => {
    const now = Date.now();
    const events = [
      writingEvent("a", now - 2_000, 0),
      writingEvent("b", now - 1_000, 1),
    ];
    const { result } = renderHook(() => useKeystrokeCapture({ text: "ab" }));

    act(() => {
      result.current.hydrateCapture({
        events,
        startedAt: now - 3_000,
        lastActivityAt: now - 1_000,
        lastKeyDownTimestamp: now - 1_000,
        activeDurationMs: 2_000,
        pausedAt: now - 500,
      });
    });

    const hydrated = result.current.getCaptureSnapshot();
    expect(hydrated.events).toHaveLength(2);
    expect(hydrated.startedAt).toBe(now - 3_000);
    expect(hydrated.lastActivityAt).toBe(now - 1_000);
    expect(hydrated.activeDurationMs).toBe(2_000);
    // Resuming a saved draft starts a new timing segment; no inherited flight gap.
    expect(hydrated.lastKeyDownTimestamp).toBeNull();
    expect(result.current.getStats().keystrokes).toBe(2);

    events[0].insertedText = "changed-after-hydration";
    expect(result.current.getCaptureSnapshot().events[0].insertedText).toBe("a");

    const pauseAt = now + 100;
    let paused = result.current.getCaptureSnapshot();
    act(() => {
      paused = result.current.getCaptureSnapshot({
        pause: true,
        timestamp: pauseAt,
      });
    });
    expect(paused.pausedAt).toBe(pauseAt);
    expect(paused.lastKeyDownTimestamp).toBeNull();
    expect(paused.activeDurationMs).toBe(2_000);
  });

  it("reset clears evidence and derived timing state", () => {
    const { result } = renderHook(() => useKeystrokeCapture({ text: "" }));

    act(() => {
      result.current.recordTextChange("x", { inputType: "insertText" });
    });
    expect(result.current.getCaptureSnapshot().events).toHaveLength(1);

    act(() => {
      result.current.resetCapture();
    });

    expect(result.current.getCaptureSnapshot()).toMatchObject({
      events: [],
      startedAt: null,
      lastKeyDownTimestamp: null,
      activeDurationMs: 0,
      pausedAt: null,
    });
    expect(result.current.getStats()).toMatchObject({
      keystrokes: 0,
      deletions: 0,
      deletedCharacters: 0,
      sessionSeconds: 0,
    });
  });
});
