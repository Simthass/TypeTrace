import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../lib/api";
import {
  clearEditorDraftsForUser,
  createEditorDraftKey,
  deleteEditorDraft,
  deleteEditorDraftLocal,
  readEditorDraft,
  saveEditorDraft,
  type EditorDraftInput,
} from "../lib/editorDraftStore";

const USER_ID = "boundary-cleanup-student";

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

function input(text = "Boundary evidence"): EditorDraftInput {
  return {
    title: "Boundary draft",
    text,
    selectedCourseId: null,
    keystrokeLog: [],
    startedAt: null,
    lastActivityAt: null,
    lastKeyDownTimestamp: null,
    activeDurationMs: 1_000,
    pausedAt: null,
    backendDraftId: null,
    serverVersion: null,
    syncStatus: "LOCAL_ONLY",
    lifecycleStatus: "ACTIVE",
  };
}

describe("editorDraftStore boundary coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setOnline(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    setOnline(true);
  });

  it("fails closed when a mirrored draft contains malformed JSON", async () => {
    setOnline(false);
    const draftId = "malformed-local";
    const draftKey = createEditorDraftKey(USER_ID, draftId);
    window.localStorage.setItem(`typetrace:draft:${draftKey}`, "{not-json");

    await expect(readEditorDraft(USER_ID, draftId)).resolves.toBeNull();
  });

  it("treats server draft-list transport failure as an empty remote source", async () => {
    setOnline(true);
    vi.spyOn(api, "get").mockRejectedValue(new Error("draft list offline"));

    await expect(readEditorDraft(USER_ID)).resolves.toBeNull();
    expect(api.get).toHaveBeenCalled();
  });

  it("recovers the legacy per-user mirror when no explicit draft id is supplied", async () => {
    setOnline(false);
    const now = Date.now();
    window.localStorage.setItem(
      `typetrace:draft:editor:${USER_ID}`,
      JSON.stringify({
        version: 1,
        draftKey: `editor:${USER_ID}`,
        userId: USER_ID,
        title: "Legacy mirror",
        text: "Recovered legacy evidence",
        keystrokeLog: [],
        savedAt: now,
        createdAt: now,
        activeDurationMs: 1_000,
        saveReason: "recovery",
      }),
    );

    const restored = await readEditorDraft(USER_ID);
    expect(restored).toMatchObject({
      userId: USER_ID,
      title: "Legacy mirror",
      text: "Recovered legacy evidence",
    });
  });

  it("deletes the latest browser-only draft when no id is supplied", async () => {
    setOnline(false);
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(1_800_000_000_000)
      .mockReturnValueOnce(1_800_000_001_000)
      .mockReturnValue(1_800_000_002_000);

    const older = await saveEditorDraft({
      userId: USER_ID,
      draftId: "older-local",
      snapshot: input("Older evidence"),
    });
    const newer = await saveEditorDraft({
      userId: USER_ID,
      draftId: "newer-local",
      snapshot: input("Newer evidence"),
    });

    await deleteEditorDraftLocal(USER_ID);

    expect(
      window.localStorage.getItem(`typetrace:draft:${newer.draftKey}`),
    ).toBeNull();
    expect(
      window.localStorage.getItem(`typetrace:draft:${older.draftKey}`),
    ).not.toBeNull();
  });

  it("deletes the latest authoritative draft when no id is supplied", async () => {
    setOnline(false);
    const saved = await saveEditorDraft({
      userId: USER_ID,
      draftId: "latest-authoritative",
      snapshot: input(),
    });

    setOnline(true);
    vi.spyOn(api, "get").mockRejectedValue(new Error("server read unavailable"));
    vi.spyOn(api, "delete").mockResolvedValue({ data: { status: "success" } } as never);

    await deleteEditorDraft(USER_ID);

    expect(api.delete).toHaveBeenCalledWith(
      expect.stringContaining("latest-authoritative"),
      expect.objectContaining({ skipGlobalToast: true, skipAuthRedirect: true }),
    );
    expect(
      window.localStorage.getItem(`typetrace:draft:${saved.draftKey}`),
    ).toBeNull();
  });

  it("reports browser cleanup failure instead of claiming anonymization cleanup succeeded", async () => {
    setOnline(false);
    const saved = await saveEditorDraft({
      userId: USER_ID,
      draftId: "cleanup-failure",
      snapshot: input(),
    });
    const removeSpy = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(() => {
        throw new Error("storage locked");
      });

    await expect(clearEditorDraftsForUser(USER_ID)).rejects.toThrow(
      /could not be cleared/i,
    );
    expect(removeSpy).toHaveBeenCalled();
    expect(
      window.localStorage.getItem(`typetrace:draft:${saved.draftKey}`),
    ).not.toBeNull();
  });
});
