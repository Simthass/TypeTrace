import { describe, expect, it } from "vitest";

import {
  cloneKeystrokeEvents,
  countWritingKeydowns,
  isWritingKeydownEvent,
} from "../lib/captureEvents";
import type { KeystrokeEvent } from "../types/editor";

function event(overrides: Partial<KeystrokeEvent>): KeystrokeEvent {
  return {
    key: "a",
    keyCode: 65,
    code: "KeyA",
    type: "keydown",
    timestamp: 1_785_280_000_000,
    down_time: 10,
    up_time: 80,
    dwell_time: 70,
    flight_time: 120,
    documentLength: 0,
    cursorPosition: 0,
    ...overrides,
  };
}

describe("capture event integrity", () => {
  it("counts only writing actions toward the evidence threshold", () => {
    const events = [
      event({ key: "Shift", keyCode: 16 }),
      event({ key: "ArrowLeft", keyCode: 37 }),
      event({ key: "c", ctrlKey: true }),
      event({ key: "x", repeat: true }),
      event({ key: "Backspace" }),
      event({ key: "a", insertedCharacters: 1, insertedText: "a" }),
      event({ key: "Backspace", deletedCharacters: 1 }),
    ];

    expect(countWritingKeydowns(events)).toBe(2);
  });

  it("accepts AltGr and confirmed IME insertions as writing", () => {
    expect(
      isWritingKeydownEvent(
        event({ key: "@", ctrlKey: true, altKey: true, insertedCharacters: 1 }),
      ),
    ).toBe(true);
    expect(
      isWritingKeydownEvent(
        event({
          key: "Unidentified",
          isComposing: true,
          insertedCharacters: 2,
          insertedText: "😀",
        }),
      ),
    ).toBe(true);
  });

  it("returns detached event snapshots", () => {
    const source = [event({ insertedCharacters: 1, insertedText: "a" })];
    const snapshot = cloneKeystrokeEvents(source);

    source[0].insertedText = "changed";
    expect(snapshot[0].insertedText).toBe("a");
    expect(snapshot[0]).not.toBe(source[0]);
  });
});
