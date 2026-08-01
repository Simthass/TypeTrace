import { describe, expect, it } from "vitest";

import { cellsToText, reconstructState } from "../lib/replayDocument";
import type { ReplayEvent } from "../types/replay";

function replayEvent(overrides: Partial<ReplayEvent>): ReplayEvent {
  return {
    event_index: 0,
    relative_time_ms: 0,
    type: "keydown",
    key: "a",
    display_key: "a",
    keyCode: 65,
    code: "KeyA",
    timestamp: 1_785_280_000_000,
    down_time: 10,
    up_time: 80,
    dwell_time: 70,
    flight_time: 120,
    cursorPosition: 0,
    documentLength: 0,
    documentLengthBefore: 0,
    documentLengthAfter: 1,
    pastedLength: 0,
    deletedCharacters: 0,
    chars_deleted: 0,
    selection_length_before: 0,
    deltaLength: 1,
    insertedCharacters: 1,
    inserted_text: "a",
    deletion_method: null,
    is_bulk_deletion: false,
    is_paste: false,
    is_deletion: false,
    is_enter: false,
    is_space: false,
    is_pause: false,
    is_cognitive_pause: false,
    ...overrides,
  };
}

describe("replay reconstruction", () => {
  it("deletes selected text before inserting pasted replacement text", () => {
    const state = reconstructState(
      [
        replayEvent({
          inserted_text: "hello world",
          insertedCharacters: 11,
          documentLengthAfter: 11,
          deltaLength: 11,
        }),
        replayEvent({
          event_index: 1,
          relative_time_ms: 100,
          type: "paste",
          key: "__PASTE_EVENT__",
          display_key: "Paste",
          keyCode: 0,
          code: "Paste",
          cursorPosition: 6,
          documentLength: 11,
          documentLengthBefore: 11,
          documentLengthAfter: 11,
          pastedLength: 5,
          is_paste: true,
          is_deletion: true,
          chars_deleted: 5,
          deletedCharacters: 5,
          selection_length_before: 5,
          insertedCharacters: 5,
          inserted_text: "there",
          deltaLength: 0,
          inputType: "insertFromPaste",
          deletion_method: "replacement",
        }),
      ],
      100,
    );

    expect(cellsToText(state.cells)).toBe("hello there");
  });

  it("uses textarea UTF-16 cursor positions for emoji", () => {
    const state = reconstructState(
      [
        replayEvent({
          inserted_text: "😀",
          insertedCharacters: 2,
          documentLengthAfter: 2,
          deltaLength: 2,
          key: "Unidentified",
          display_key: "Unidentified",
        }),
        replayEvent({
          event_index: 1,
          relative_time_ms: 100,
          cursorPosition: 2,
          documentLength: 2,
          documentLengthBefore: 2,
          documentLengthAfter: 3,
          inserted_text: "!",
          insertedCharacters: 1,
          key: "!",
          display_key: "!",
        }),
      ],
      100,
    );

    expect(cellsToText(state.cells)).toBe("😀!");
    expect(state.cursor).toBe(3);
  });

  it("does not replay keyboard shortcuts as inserted text", () => {
    const state = reconstructState(
      [
        replayEvent({
          key: "c",
          display_key: "c",
          inserted_text: null,
          insertedCharacters: 0,
          documentLengthAfter: 0,
          deltaLength: 0,
          ctrlKey: true,
        }),
      ],
      0,
    );

    expect(cellsToText(state.cells)).toBe("");
  });
});
