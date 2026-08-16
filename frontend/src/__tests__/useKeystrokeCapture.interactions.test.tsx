import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useKeystrokeCapture } from "../hooks/useKeystrokeCapture";

function textarea(value: string, start: number, end = start) {
  const node = document.createElement("textarea");
  node.value = value;
  node.selectionStart = start;
  node.selectionEnd = end;
  return node;
}

function keyboardEvent(
  node: HTMLTextAreaElement,
  overrides: Partial<React.KeyboardEvent<HTMLTextAreaElement>> & {
    key: string;
  },
): React.KeyboardEvent<HTMLTextAreaElement> {
  const { key, ...eventOverrides } = overrides;
  const keyCode =
    typeof eventOverrides.keyCode === "number"
      ? eventOverrides.keyCode
      : key.length === 1
        ? key.toUpperCase().charCodeAt(0)
        : key === "Backspace"
          ? 8
          : key === "Delete"
            ? 46
            : 0;

  return {
    key,
    keyCode,
    code: eventOverrides.code ?? (key.length === 1 ? `Key${key.toUpperCase()}` : key),
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    shiftKey: false,
    repeat: false,
    currentTarget: node,
    target: node,
    nativeEvent: { isComposing: false },
    ...eventOverrides,
  } as React.KeyboardEvent<HTMLTextAreaElement>;
}

function clipboardEvent(
  node: HTMLTextAreaElement,
  text: string,
): React.ClipboardEvent<HTMLTextAreaElement> {
  return {
    currentTarget: node,
    target: node,
    clipboardData: {
      getData: () => text,
    },
  } as unknown as React.ClipboardEvent<HTMLTextAreaElement>;
}

function beforeInputEvent(
  node: HTMLTextAreaElement,
  inputType: string,
  data: string | null = null,
): React.FormEvent<HTMLTextAreaElement> {
  return {
    currentTarget: node,
    target: node,
    nativeEvent: { inputType, data },
  } as unknown as React.FormEvent<HTMLTextAreaElement>;
}

describe("useKeystrokeCapture interaction coverage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("correlates typing over a selection into one replacement revision", () => {
    const node = textarea("hello", 1, 4);
    const { result } = renderHook(() =>
      useKeystrokeCapture({ text: "hello" }),
    );

    act(() => {
      result.current.handleKeyDown(keyboardEvent(node, { key: "x" }));
      result.current.recordTextChange("hxo", { inputType: "insertText" });
    });

    const events = result.current.getCaptureSnapshot().events;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      key: "x",
      type: "keydown",
      documentLengthBefore: 5,
      documentLengthAfter: 3,
      selection_length_before: 3,
      deletedCharacters: 3,
      insertedCharacters: 1,
      insertedText: "x",
      deletion_method: "replacement",
      isBulkDeletion: true,
    });
    expect(result.current.getStats()).toMatchObject({
      deletions: 1,
      deletedCharacters: 3,
      selectionDeletionEvents: 1,
      bulkDeletionEvents: 1,
    });
  });

  it("classifies Ctrl+Backspace as a word deletion after confirmation", () => {
    const node = textarea("hello world", 11);
    const { result } = renderHook(() =>
      useKeystrokeCapture({ text: "hello world" }),
    );

    act(() => {
      result.current.handleKeyDown(
        keyboardEvent(node, { key: "Backspace", ctrlKey: true }),
      );
      result.current.recordTextChange("hello ", {
        inputType: "deleteWordBackward",
      });
    });

    expect(result.current.getCaptureSnapshot().events[0]).toMatchObject({
      key: "Backspace",
      deletedCharacters: 5,
      deletion_method: "word",
      isBulkDeletion: true,
    });
    expect(result.current.getStats()).toMatchObject({
      deletions: 1,
      deletedCharacters: 5,
      wordDeletionEvents: 1,
    });
  });

  it("classifies Meta+Backspace as a line deletion", () => {
    const node = textarea("first\nsecond", 12);
    const { result } = renderHook(() =>
      useKeystrokeCapture({ text: "first\nsecond" }),
    );

    act(() => {
      result.current.handleKeyDown(
        keyboardEvent(node, { key: "Backspace", metaKey: true }),
      );
      result.current.recordTextChange("first\n", {
        inputType: "deleteSoftLineBackward",
      });
    });

    expect(result.current.getCaptureSnapshot().events[0]).toMatchObject({
      deletedCharacters: 6,
      deletion_method: "line",
      isBulkDeletion: true,
    });
  });

  it("records literal paste content and an all-document replacement", () => {
    const node = textarea("abcdef", 0, 6);
    const { result } = renderHook(() =>
      useKeystrokeCapture({ text: "abcdef" }),
    );

    act(() => {
      result.current.handlePaste(clipboardEvent(node, "XY"));
      result.current.recordTextChange("XY", { inputType: "insertFromPaste" });
    });

    const event = result.current.getCaptureSnapshot().events[0];
    expect(event).toMatchObject({
      key: "__PASTE_EVENT__",
      type: "paste",
      pastedLength: 2,
      insertedText: "XY",
      insertedCharacters: 2,
      deletedCharacters: 6,
      selection_length_before: 6,
      deletion_method: "all",
      flight_time: null,
    });
  });

  it("records a cut as one correlated deletion and ignores a cut without selection", () => {
    const node = textarea("abcdef", 1, 4);
    const { result } = renderHook(() =>
      useKeystrokeCapture({ text: "abcdef" }),
    );

    act(() => {
      result.current.handleCut(clipboardEvent(node, "bcd"));
      result.current.recordTextChange("aef", { inputType: "deleteByCut" });
    });

    expect(result.current.getCaptureSnapshot().events[0]).toMatchObject({
      key: "__CUT_EVENT__",
      type: "cut",
      deletedCharacters: 3,
      deletion_method: "cut",
      isBulkDeletion: true,
    });
    expect(result.current.getStats()).toMatchObject({
      deletions: 1,
      deletedCharacters: 3,
      cutEvents: 1,
    });

    node.selectionStart = 2;
    node.selectionEnd = 2;
    act(() => result.current.handleCut(clipboardEvent(node, "")));
    expect(result.current.getCaptureSnapshot().events).toHaveLength(1);
  });

  it("uses beforeinput metadata when a replacement has no keydown event", () => {
    const node = textarea("abc", 1, 2);
    const { result } = renderHook(() => useKeystrokeCapture({ text: "abc" }));

    act(() => {
      result.current.handleBeforeInput(
        beforeInputEvent(node, "insertReplacementText", "Z"),
      );
      result.current.recordTextChange("aZc", {
        inputType: "insertReplacementText",
      });
    });

    expect(result.current.getCaptureSnapshot().events[0]).toMatchObject({
      key: "__TEXT_REVISION__",
      type: "input",
      insertedText: "Z",
      insertedCharacters: 1,
      deletedCharacters: 1,
      deletion_method: "replacement",
      selection_length_before: 1,
    });
  });

  it("patches keydown dwell on keyup and appends the release event", () => {
    const node = textarea("", 0);
    const { result } = renderHook(() => useKeystrokeCapture({ text: "" }));
    let perfNow = 100;
    vi.spyOn(performance, "now").mockImplementation(() => perfNow);

    act(() => {
      result.current.handleKeyDown(
        keyboardEvent(node, { key: "a", code: "KeyA", keyCode: 65 }),
      );
    });

    perfNow = 165;
    act(() => {
      result.current.handleKeyUp(
        keyboardEvent(node, { key: "a", code: "KeyA", keyCode: 65 }),
      );
    });

    const events = result.current.getCaptureSnapshot().events;
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      type: "keydown",
      down_time: 100,
      up_time: 165,
      dwell_time: 65,
    });
    expect(events[1]).toMatchObject({
      type: "keyup",
      down_time: 100,
      up_time: 165,
      dwell_time: 65,
    });
  });

  it("marks a tracked candidate as blocked when the editor rejects the input", () => {
    const node = textarea("safe", 4);
    const { result } = renderHook(() =>
      useKeystrokeCapture({ text: "safe" }),
    );

    act(() => {
      result.current.handleKeyDown(keyboardEvent(node, { key: "x" }));
      result.current.rejectPendingInput();
      result.current.rejectPendingInput();
    });

    expect(result.current.getCaptureSnapshot().events[0]).toMatchObject({
      key: "__BLOCKED_INPUT__",
      code: "BlockedInput",
      inputType: "historyBlockedInput",
      insertedCharacters: 0,
      deletedCharacters: 0,
      deletion_method: "unknown",
    });
  });

  it("does not treat Ctrl+C as text intent but keeps AltGr-style Ctrl+Alt typing trackable", () => {
    const node = textarea("abc", 3);
    const { result } = renderHook(() => useKeystrokeCapture({ text: "abc" }));

    act(() => {
      result.current.handleKeyDown(
        keyboardEvent(node, { key: "c", ctrlKey: true, code: "KeyC" }),
      );
      result.current.rejectPendingInput();
    });
    expect(result.current.getCaptureSnapshot().events[0].key).toBe("c");

    act(() => {
      result.current.handleKeyDown(
        keyboardEvent(node, {
          key: "@",
          ctrlKey: true,
          altKey: true,
          code: "Digit2",
        }),
      );
      result.current.rejectPendingInput();
    });

    expect(result.current.getCaptureSnapshot().events[1]).toMatchObject({
      key: "__BLOCKED_INPUT__",
      code: "BlockedInput",
    });
  });

  it("segments a long idle break instead of treating it as typing flight time", () => {
    const node = textarea("", 0);
    const { result } = renderHook(() => useKeystrokeCapture({ text: "" }));
    const now = 1_800_000_000_000;
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(now)
      .mockReturnValueOnce(now + 31_500);

    act(() => {
      result.current.handleKeyDown(keyboardEvent(node, { key: "a" }));
      result.current.handleKeyDown(keyboardEvent(node, { key: "b" }));
    });

    const events = result.current.getCaptureSnapshot().events;
    expect(events.some((event) => event.key === "__IDLE_BREAK__")).toBe(true);
    expect(events[events.length - 1]).toMatchObject({ key: "b", flight_time: null });
    expect(result.current.getStats().avgIki).toBe(0);
  });
});
