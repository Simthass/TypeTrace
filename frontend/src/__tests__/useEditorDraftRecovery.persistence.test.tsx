import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEditorDraftId,
  deleteEditorDraft,
  deleteEditorDraftByKey,
  deleteEditorDraftLocal,
  listEditorDrafts,
  readEditorDraft,
  saveEditorDraft,
  type EditorDraftInput,
  type EditorDraftSnapshot,
} from "../lib/editorDraftStore";
import { useEditorDraftRecovery } from "../hooks/useEditorDraftRecovery";

vi.mock("../lib/editorDraftStore", async () => {
  const actual = await vi.importActual<typeof import("../lib/editorDraftStore")>(
    "../lib/editorDraftStore",
  );

  return {
    ...actual,
    createEditorDraftId: vi.fn(actual.createEditorDraftId),
    readEditorDraft: vi.fn(),
    saveEditorDraft: vi.fn(),
    deleteEditorDraft: vi.fn(),
    deleteEditorDraftLocal: vi.fn(),
    deleteEditorDraftByKey: vi.fn(),
    listEditorDrafts: vi.fn(),
  };
});

const USER_ID = "core-student";
const DRAFT_ID = "core-draft";

function input(overrides: Partial<EditorDraftInput> = {}): EditorDraftInput {
  return {
    title: "Core draft",
    text: "Initial evidence text",
    selectedCourseId: null,
    keystrokeLog: [],
    startedAt: null,
    lastActivityAt: null,
    lastKeyDownTimestamp: null,
    activeDurationMs: 1_250,
    pausedAt: null,
    backendDraftId: null,
    serverVersion: null,
    syncStatus: "LOCAL_ONLY",
    lifecycleStatus: "ACTIVE",
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<EditorDraftSnapshot> = {},
): EditorDraftSnapshot {
  return {
    version: 3,
    draftKey: `editor:${USER_ID}:${DRAFT_ID}`,
    draftId: DRAFT_ID,
    userId: USER_ID,
    title: "Core draft",
    text: "Initial evidence text",
    selectedCourseId: null,
    keystrokeLog: [],
    startedAt: null,
    lastActivityAt: null,
    lastKeyDownTimestamp: null,
    activeDurationMs: 1_250,
    pausedAt: null,
    createdAt: 1_786_000_000_000,
    savedAt: 1_786_000_001_000,
    saveReason: "autosave",
    backendDraftId: null,
    serverVersion: null,
    syncStatus: "PENDING_SYNC",
    lifecycleStatus: "ACTIVE",
    ...overrides,
  };
}

describe("useEditorDraftRecovery contracts", () => {
  beforeEach(() => {
    vi.mocked(readEditorDraft).mockReset();
    vi.mocked(saveEditorDraft).mockReset();
    vi.mocked(deleteEditorDraft).mockReset();
    vi.mocked(deleteEditorDraftLocal).mockReset();
    vi.mocked(deleteEditorDraftByKey).mockReset();
    vi.mocked(listEditorDrafts).mockReset();
    vi.mocked(createEditorDraftId).mockClear();

    vi.mocked(readEditorDraft).mockResolvedValue(snapshot());
    vi.mocked(deleteEditorDraft).mockResolvedValue(undefined);
    vi.mocked(deleteEditorDraftLocal).mockResolvedValue(undefined);
    vi.mocked(deleteEditorDraftByKey).mockResolvedValue(undefined);
    vi.mocked(listEditorDrafts).mockResolvedValue([snapshot()]);
  });

  it("loads the requested draft and exposes recovery status", async () => {
    const { result } = renderHook(() =>
      useEditorDraftRecovery({ userId: USER_ID, draftId: DRAFT_ID }),
    );

    await waitFor(() => expect(result.current.hasCheckedDraft).toBe(true));

    expect(readEditorDraft).toHaveBeenCalledWith(USER_ID, DRAFT_ID);
    expect(result.current.recoveredDraft).toMatchObject({
      draftId: DRAFT_ID,
      text: "Initial evidence text",
    });
    expect(result.current.status).toMatchObject({
      activeDraftId: DRAFT_ID,
      hasRecoveredDraft: true,
      hasCheckedDraft: true,
      isSavingDraft: false,
    });
  });

  it("serializes save work and replaces recovery state with the saved snapshot", async () => {
    const firstSaved = snapshot({
      text: "First save",
      savedAt: 1_786_000_002_000,
      saveReason: "manual",
      lifecycleStatus: "PAUSED",
    });
    const secondSaved = snapshot({
      text: "Second save",
      savedAt: 1_786_000_003_000,
      saveReason: "autosave",
    });

    let releaseFirst: ((value: EditorDraftSnapshot) => void) | undefined;
    vi.mocked(saveEditorDraft)
      .mockImplementationOnce(
        () =>
          new Promise<EditorDraftSnapshot>((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(secondSaved);

    const { result } = renderHook(() =>
      useEditorDraftRecovery({ userId: USER_ID, draftId: DRAFT_ID }),
    );
    await waitFor(() => expect(result.current.hasCheckedDraft).toBe(true));

    let firstPromise!: Promise<EditorDraftSnapshot>;
    let secondPromise!: Promise<EditorDraftSnapshot>;
    act(() => {
      firstPromise = result.current.saveDraft(input({ text: "First save" }), {
        saveReason: "manual",
      });
      secondPromise = result.current.saveDraft(input({ text: "Second save" }));
    });

    expect(result.current.isSavingDraft).toBe(true);
    await waitFor(() => expect(saveEditorDraft).toHaveBeenCalledTimes(1));
    expect(releaseFirst).toBeTypeOf("function");

    await act(async () => {
      releaseFirst!(firstSaved);
      await firstPromise;
    });
    await act(async () => {
      await secondPromise;
    });

    expect(saveEditorDraft).toHaveBeenCalledTimes(2);
    expect(vi.mocked(saveEditorDraft).mock.calls[0][0]).toMatchObject({
      userId: USER_ID,
      draftId: DRAFT_ID,
      saveReason: "manual",
      existingCreatedAt: snapshot().createdAt,
    });
    expect(result.current.recoveredDraft?.text).toBe("Second save");
    expect(result.current.isSavingDraft).toBe(false);
  });

  it("clears only local draft artifacts when the caller requests local recovery cleanup", async () => {
    const { result } = renderHook(() =>
      useEditorDraftRecovery({ userId: USER_ID, draftId: DRAFT_ID }),
    );
    await waitFor(() => expect(result.current.recoveredDraft).not.toBeNull());

    const previousActiveId = result.current.activeDraftId;
    await act(async () => {
      await result.current.clearLocalDraft();
    });

    expect(deleteEditorDraftLocal).toHaveBeenCalledWith(USER_ID, DRAFT_ID);
    expect(deleteEditorDraft).not.toHaveBeenCalled();
    expect(result.current.recoveredDraft).toBeNull();
    expect(result.current.activeDraftId).not.toBe(previousActiveId);
  });

  it("supports authoritative delete, delete-by-key, dismiss, and refresh flows", async () => {
    const { result } = renderHook(() =>
      useEditorDraftRecovery({ userId: USER_ID, draftId: DRAFT_ID }),
    );
    await waitFor(() => expect(result.current.recoveredDraft).not.toBeNull());

    act(() => {
      result.current.dismissRecoveredDraft();
    });
    expect(result.current.recoveredDraft).toBeNull();

    const refreshed = await result.current.refreshDrafts();
    expect(listEditorDrafts).toHaveBeenCalledWith(USER_ID);
    expect(refreshed).toHaveLength(1);

    await act(async () => {
      await result.current.clearDraft(DRAFT_ID);
    });
    expect(deleteEditorDraft).toHaveBeenCalledWith(USER_ID, DRAFT_ID);

    await act(async () => {
      await result.current.deleteDraftByKey(`editor:${USER_ID}:${DRAFT_ID}`);
    });
    expect(deleteEditorDraftByKey).toHaveBeenCalledWith(
      `editor:${USER_ID}:${DRAFT_ID}`,
    );
  });
});
