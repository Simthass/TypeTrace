import type { KeystrokeEvent } from "../types/editor";

const NON_WRITING_KEYS = new Set([
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
  ...Array.from({ length: 24 }, (_, index) => `F${index + 1}`),
]);

export function isWritingKeydownEvent(event: KeystrokeEvent): boolean {
  if (event.type !== "keydown" || event.repeat === true) return false;

  const inserted = Math.max(0, Number(event.insertedCharacters || 0));
  const deleted = Math.max(
    0,
    Number(event.deletedCharacters ?? event.chars_deleted ?? 0),
  );
  const hasConfirmedMutation =
    event.insertedCharacters !== undefined ||
    event.insertedText !== undefined ||
    event.deletedCharacters !== undefined ||
    event.chars_deleted !== undefined;

  if (inserted > 0 || deleted > 0) return true;
  if (hasConfirmedMutation) return false;
  if (["Enter", "Tab"].includes(event.key)) return true;
  if (["Backspace", "Delete"].includes(event.key)) return false;
  if (NON_WRITING_KEYS.has(event.key)) return false;

  const shortcut = Boolean(event.ctrlKey || event.metaKey) && !event.altKey;
  return event.key.length === 1 && !shortcut;
}

export function countWritingKeydowns(events: KeystrokeEvent[]): number {
  return events.reduce(
    (total, event) => total + (isWritingKeydownEvent(event) ? 1 : 0),
    0,
  );
}

export function cloneKeystrokeEvents(
  events: KeystrokeEvent[],
): KeystrokeEvent[] {
  return events.map((event) => ({ ...event }));
}
