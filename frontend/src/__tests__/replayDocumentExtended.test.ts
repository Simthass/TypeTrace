import { describe, expect, it } from "vitest";

import {
  applyReplayEvent,
  cellsToSegments,
  cellsToText,
  countReconstructedCharacters,
  lineAndColumnAt,
  reconstructState,
} from "../lib/replayDocument";
import type { ReplayEvent, ReplaySegment } from "../types/replay";

function replay(overrides: Partial<ReplayEvent>): ReplayEvent {
  return {
    type: "keydown",
    key: "a",
    relative_time_ms: 0,
    cursorPosition: 0,
    deletedCharacters: 0,
    chars_deleted: 0,
    is_deletion: false,
    is_paste: false,
    pastedLength: 0,
    inserted_text: "",
    selection_length_before: 0,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...overrides,
  } as ReplayEvent;
}

describe("replayDocument extended editing cases", () => {
  it("handles fallback typing, Enter, Tab, shortcut suppression, and keyup", () => {
    const cells: ReplaySegment[] = [];
    expect(applyReplayEvent(cells, replay({ key: "h" }))).toBe(1);
    expect(applyReplayEvent(cells, replay({ key: "Enter", cursorPosition: 1 }))).toBe(2);
    expect(applyReplayEvent(cells, replay({ key: "Tab", cursorPosition: 2 }))).toBe(6);
    expect(
      applyReplayEvent(
        cells,
        replay({ key: "v", ctrlKey: true, cursorPosition: 6 }),
      ),
    ).toBe(6);
    expect(applyReplayEvent(cells, replay({ type: "keyup" }))).toBeNull();
    expect(cellsToText(cells)).toBe("h\n    ");
  });

  it("handles backspace/delete, captured paste text, and privacy-safe paste placeholders", () => {
    const cells: ReplaySegment[] = "abcd".split("").map((text) => ({
      text,
      type: "typed" as const,
    }));

    applyReplayEvent(
      cells,
      replay({ key: "Backspace", cursorPosition: 4, deletedCharacters: 1 }),
    );
    expect(cellsToText(cells)).toBe("abc");

    applyReplayEvent(
      cells,
      replay({ key: "Delete", cursorPosition: 1, deletedCharacters: 1 }),
    );
    expect(cellsToText(cells)).toBe("ac");

    applyReplayEvent(
      cells,
      replay({
        type: "paste",
        is_paste: true,
        cursorPosition: 1,
        inserted_text: "XY",
        pastedLength: 2,
      }),
    );
    expect(cellsToText(cells)).toBe("aXYc");

    const privacyCells: ReplaySegment[] = [];
    applyReplayEvent(
      privacyCells,
      replay({
        type: "paste",
        is_paste: true,
        inserted_text: "",
        pastedLength: 25,
      }),
    );
    expect(privacyCells[0].text).toContain("25 characters");
    expect(countReconstructedCharacters(privacyCells)).toBe(0);
  });

  it("reconstructs only events inside the current replay time and merges segments", () => {
    const state = reconstructState(
      [
        replay({ relative_time_ms: 0, inserted_text: "A" }),
        replay({ relative_time_ms: 50, cursorPosition: 1, inserted_text: "B" }),
        replay({ relative_time_ms: 500, cursorPosition: 2, inserted_text: "C" }),
      ],
      100,
    );
    expect(cellsToText(state.cells)).toBe("AB");
    expect(state.cursor).toBe(2);

    expect(
      cellsToSegments([
        { text: "A", type: "typed" },
        { text: "B", type: "typed" },
        { text: "P", type: "paste" },
      ]),
    ).toEqual([
      { text: "AB", type: "typed" },
      { text: "P", type: "paste" },
    ]);
  });

  it("calculates line and column using the same UTF-16 cell model", () => {
    const cells: ReplaySegment[] = [
      { text: "a", type: "typed" },
      { text: "\n", type: "typed" },
      { text: "b", type: "typed" },
    ];
    expect(lineAndColumnAt(cells, 0)).toEqual({ line: 1, column: 1 });
    expect(lineAndColumnAt(cells, 3)).toEqual({ line: 2, column: 2 });
    expect(countReconstructedCharacters(cells)).toBe(3);
  });
});
