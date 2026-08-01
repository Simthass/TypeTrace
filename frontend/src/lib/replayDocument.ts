import type { ReplayEvent, ReplaySegment } from "../types/replay";

export interface ReconstructionState {
  cells: ReplaySegment[];
  cursor: number;
}

function insertCharacters(
  cells: ReplaySegment[],
  at: number,
  text: string,
  cellType: "typed" | "paste" = "typed",
): number {
  if (!text) return at;

  // Textarea cursor positions use UTF-16 code units. split("") preserves that
  // unit model; Array.from would collapse surrogate pairs and corrupt positions.
  const chars = text.split("").map((char) => ({
    text: char,
    type: cellType,
  }));
  cells.splice(at, 0, ...chars);
  return at + chars.length;
}

function isShortcut(event: ReplayEvent): boolean {
  return Boolean(event.ctrlKey || event.metaKey) && !event.altKey;
}

function fallbackInsertText(event: ReplayEvent): string {
  if (event.type !== "keydown" || isShortcut(event)) return "";
  if (event.key === "Enter") return "\n";
  if (event.key === "Tab") return "    ";
  if (event.key && event.key.length === 1) return event.key;
  return "";
}

export function applyReplayEvent(
  cells: ReplaySegment[],
  event: ReplayEvent,
): number | null {
  if (event.type === "keyup") return null;

  const position = Math.max(
    0,
    Math.min(cells.length, event.cursorPosition ?? cells.length),
  );

  if (event.type === "cursor") return position;

  const deletedCount = Math.max(
    0,
    event.deletedCharacters ||
      event.chars_deleted ||
      (event.is_deletion ? 1 : 0),
  );
  const forwardDelete =
    event.type !== "keydown" ||
    event.key === "Delete" ||
    (event.selection_length_before || 0) > 0 ||
    event.is_paste;
  const deleteStart = forwardDelete
    ? position
    : Math.max(0, position - deletedCount);
  const actualDeleteCount = Math.min(
    deletedCount,
    Math.max(0, cells.length - deleteStart),
  );

  if (actualDeleteCount > 0) {
    cells.splice(deleteStart, actualDeleteCount);
  }

  if (event.is_paste) {
    const pastedText = event.inserted_text;
    if (pastedText && pastedText.length > 0) {
      return insertCharacters(cells, deleteStart, pastedText, "paste");
    }

    const label =
      event.pastedLength > 0
        ? `[pasted ${event.pastedLength} characters — original text not captured]`
        : "[pasted content]";
    cells.splice(deleteStart, 0, { text: label, type: "paste" });
    return deleteStart + 1;
  }

  const insertText = event.inserted_text || fallbackInsertText(event);
  return insertCharacters(cells, deleteStart, insertText);
}

export function reconstructState(
  events: ReplayEvent[],
  currentTimeMs: number,
): ReconstructionState {
  const cells: ReplaySegment[] = [];
  let cursor = 0;

  for (const event of events) {
    if (event.relative_time_ms > currentTimeMs) continue;
    const next = applyReplayEvent(cells, event);
    if (next !== null) cursor = next;
  }

  return { cells, cursor };
}

export function cellsToSegments(cells: ReplaySegment[]): ReplaySegment[] {
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

export function cellsToText(cells: ReplaySegment[]): string {
  return cells.map((cell) => cell.text).join("");
}

export function countReconstructedCharacters(
  cells: ReplaySegment[],
): number {
  return cells.reduce((total, cell) => {
    if (cell.type === "paste" && cell.text.length > 1) return total;
    return total + cell.text.length;
  }, 0);
}

export function lineAndColumnAt(
  cells: ReplaySegment[],
  cursor: number,
): { line: number; column: number } {
  let line = 1;
  let column = 1;
  let index = 0;

  while (index < cursor && index < cells.length) {
    const value = cells[index]?.text ?? "";
    if (value === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
    index += 1;
  }

  return { line, column };
}
