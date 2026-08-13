import { act, renderHook } from "@testing-library/react";
import type { SyntheticEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useKeystrokeCapture } from "../hooks/useKeystrokeCapture";
import type { KeystrokeEvent } from "../types/editor";

function writingEvent(
  text: string,
  timestamp: number,
  documentLengthBefore: number,
  flightTime: number | null = null,
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
    flight_time: flightTime,
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

describe("useKeystrokeCapture branch coverage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records a same-length replacement as one correlated revision", () => {
    const { result } = renderHook(() => useKeystrokeCapture({ text: "hello" }));

    act(() => {
      result.current.recordTextChange("hallo", {
        inputType: "insertReplacementText",
      });
    });

    const snapshot = result.current.getCaptureSnapshot();
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0]).toMatchObject({
      key: "__TEXT_REVISION__",
      type: "input",
      cursorPosition: 1,
      documentLengthBefore: 5,
      documentLengthAfter: 5,
      deltaLength: 0,
      insertedCharacters: 1,
      insertedText: "a",
      deletedCharacters: 1,
      chars_deleted: 1,
      deletion_method: "replacement",
    });

    const stats = result.current.getStats();
    expect(stats.deletions).toBe(1);
    expect(stats.deletedCharacters).toBe(1);
    expect(stats.selectionDeletionEvents).toBe(1);
  });

  it("does not emit evidence when the confirmed text did not change", () => {
    const { result } = renderHook(() => useKeystrokeCapture({ text: "same" }));

    act(() => {
      result.current.recordTextChange("same", { inputType: "insertText" });
    });

    expect(result.current.getCaptureSnapshot().events).toEqual([]);
    expect(result.current.getStats()).toMatchObject({
      keystrokes: 0,
      deletions: 0,
      deletedCharacters: 0,
    });
  });

  it("falls back to event timing when restored clock metadata is invalid", () => {
    const now = Date.now();
    const events = [
      writingEvent("a", now - 2_000, 0),
      writingEvent("b", now - 500, 1, 1_500),
    ];
    const { result } = renderHook(() => useKeystrokeCapture({ text: "ab" }));

    act(() => {
      result.current.hydrateCapture({
        events,
        startedAt: 123,
        lastActivityAt: -1,
        lastKeyDownTimestamp: now - 500,
        activeDurationMs: -50,
        pausedAt: null,
      });
    });

    const snapshot = result.current.getCaptureSnapshot();
    expect(snapshot.startedAt).toBe(now - 2_000);
    expect(snapshot.lastActivityAt).toBe(now - 500);
    expect(snapshot.activeDurationMs).toBe(1_500);
    expect(snapshot.lastKeyDownTimestamp).toBeNull();
  });

  it("logs cursor movement once and throttles an immediate second movement", () => {
    const now = 1_800_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    const textarea = document.createElement("textarea");
    textarea.value = "abcd";
    textarea.setSelectionRange(2, 2);

    const { result } = renderHook(() =>
      useKeystrokeCapture({ text: "abcd" }),
    );

    act(() => {
      result.current.handleSelectionChange({
        currentTarget: textarea,
      } as unknown as SyntheticEvent<HTMLTextAreaElement>);
    });

    textarea.setSelectionRange(3, 3);
    act(() => {
      result.current.handleSelectionChange({
        currentTarget: textarea,
      } as unknown as SyntheticEvent<HTMLTextAreaElement>);
    });

    const events = result.current.getCaptureSnapshot().events;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      key: "__CURSOR_MOVE__",
      type: "cursor",
      cursorPosition: 2,
      documentLength: 4,
      selectionStartBefore: 2,
      selectionEndBefore: 2,
      selection_length_before: 0,
    });
  });

  it("keeps long navigation-only flight values out of typing rhythm statistics", () => {
    const now = Date.now();
    const events: KeystrokeEvent[] = [
      writingEvent("a", now - 2_000, 0, null),
      {
        key: "Shift",
        keyCode: 16,
        code: "ShiftLeft",
        type: "keydown",
        timestamp: now - 1_500,
        down_time: 10,
        up_time: 20,
        dwell_time: 10,
        flight_time: 20_000,
        documentLength: 1,
        cursorPosition: 1,
      },
      writingEvent("b", now - 1_000, 1, 500),
    ];

    const { result } = renderHook(() => useKeystrokeCapture({ text: "ab" }));
    act(() => {
      result.current.hydrateCapture({ events, activeDurationMs: 2_000 });
    });

    expect(result.current.getStats()).toMatchObject({
      keystrokes: 2,
      pauses: 0,
      avgIki: 500,
    });
  });
});
