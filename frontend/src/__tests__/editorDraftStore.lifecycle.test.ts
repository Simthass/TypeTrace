import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../lib/api";
import {
  countDraftKeydowns,
  countDraftPasteEvents,
  countDraftWords,
  createEditorDraftKey,
  deleteEditorDraftByKey,
  deleteEditorDraftLocalByKey,
  readEditorDraft,
  safeDraftUserId,
  saveEditorDraft,
  titleForDraft,
  type EditorDraftInput,
} from "../lib/editorDraftStore";
import type { KeystrokeEvent } from "../types/editor";

const USER_ID = "boundary-store-student";

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}


function event(
  type: KeystrokeEvent["type"],
  key: string,
  timestamp: number,
  documentLength: number,
  cursorPosition: number,
): KeystrokeEvent {
  return {
    key,
    keyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0,
    type,
    timestamp,
    down_time: null,
    up_time: null,
    dwell_time: null,
    flight_time: null,
    documentLength,
    cursorPosition,
  };
}

function input(overrides: Partial<EditorDraftInput> = {}): EditorDraftInput {
  return {
    title: "Boundary store draft",
    text: "Evidence content",
    selectedCourseId: null,
    keystrokeLog: [],
    startedAt: null,
    lastActivityAt: null,
    lastKeyDownTimestamp: null,
    activeDurationMs: 2_000,
    pausedAt: null,
    backendDraftId: null,
    serverVersion: null,
    syncStatus: "LOCAL_ONLY",
    lifecycleStatus: "ACTIVE",
    ...overrides,
  };
}

describe("editorDraftStore lifecycle and utility coverage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    setOnline(true);
  });

  it("normalizes identifiers and derives safe human-readable draft titles", () => {
    expect(safeDraftUserId(" student-a ")).toBe("student-a");
    expect(safeDraftUserId("   ")).toBe("anonymous");
    expect(createEditorDraftKey(" student-a ", "draft-1")).toBe(
      "editor:student-a:draft-1",
    );
    expect(titleForDraft({ title: "  Explicit title  ", text: "body" })).toBe(
      "Explicit title",
    );
    expect(
      titleForDraft({ title: "", text: "\n First meaningful line \nSecond" }),
    ).toBe("First meaningful line");
    expect(titleForDraft({ title: "", text: "   " })).toBe("Untitled draft");
  });

  it("counts words, paste evidence, and raw keydowns deterministically", () => {
    const events: KeystrokeEvent[] = [
      event("keydown", "a", 1, 0, 0),
      event("paste", "__PASTE_EVENT__", 2, 1, 1),
      event("cursor", "__CURSOR_MOVE__", 3, 2, 1),
    ];

    expect(countDraftWords(" one\n two   three ")).toBe(3);
    expect(countDraftWords("   ")).toBe(0);
    expect(countDraftPasteEvents(events)).toBe(1);
    expect(countDraftKeydowns(events)).toBe(1);
  });

  it("persists manual saves as paused pending-sync recovery while offline", async () => {
    setOnline(false);
    const postSpy = vi.spyOn(api, "post");
    const draftId = "offline-manual";

    const saved = await saveEditorDraft({
      userId: USER_ID,
      draftId,
      snapshot: input(),
      saveReason: "manual",
    });

    expect(postSpy).not.toHaveBeenCalled();
    expect(saved).toMatchObject({
      draftId,
      syncStatus: "PENDING_SYNC",
      lifecycleStatus: "PAUSED",
      saveReason: "manual",
    });
    expect(saved.pausedAt).toBe(saved.savedAt);
    expect(
      window.localStorage.getItem(`typetrace:draft:${saved.draftKey}`),
    ).not.toBeNull();

    await deleteEditorDraftLocalByKey(saved.draftKey);
  });

  it("does not persist an empty draft snapshot", async () => {
    setOnline(false);
    const saved = await saveEditorDraft({
      userId: USER_ID,
      draftId: "empty-draft",
      snapshot: input({
        title: "",
        text: "",
        keystrokeLog: [],
        activeDurationMs: 0,
      }),
    });

    expect(saved.draftId).toBe("empty-draft");
    await expect(readEditorDraft(USER_ID, "empty-draft")).resolves.toBeNull();
  });

  it("caps restored active duration at one day before saving", async () => {
    setOnline(false);
    const saved = await saveEditorDraft({
      userId: USER_ID,
      draftId: "duration-cap",
      snapshot: input({ activeDurationMs: 1000 * 60 * 60 * 24 * 7 }),
    });

    expect(saved.activeDurationMs).toBe(1000 * 60 * 60 * 24);
    await deleteEditorDraftLocalByKey(saved.draftKey);
  });

  it("refuses authoritative deletion while offline and preserves the local mirror", async () => {
    setOnline(false);
    const saved = await saveEditorDraft({
      userId: USER_ID,
      draftId: "offline-delete",
      snapshot: input(),
    });

    await expect(deleteEditorDraftByKey(saved.draftKey)).rejects.toThrow(
      /cannot be deleted while offline/i,
    );
    expect(
      window.localStorage.getItem(`typetrace:draft:${saved.draftKey}`),
    ).not.toBeNull();

    await deleteEditorDraftLocalByKey(saved.draftKey);
  });
});
