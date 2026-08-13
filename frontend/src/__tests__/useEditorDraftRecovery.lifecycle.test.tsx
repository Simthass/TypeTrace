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

const USER_ID = "boundary-student";
const DRAFT_ID = "boundary-draft";

function input(overrides: Partial<EditorDraftInput> = {}): EditorDraftInput {
  return {
    title: "Boundary draft",
    text: "Evidence text",
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

function snapshot(
  overrides: Partial<EditorDraftSnapshot> = {},
): EditorDraftSnapshot {
  return {
    version: 3,
    draftKey: `editor:${USER_ID}:${DRAFT_ID}`,
    draftId: DRAFT_ID,
    userId: USER_ID,
    title: "Boundary draft",
    text: "Evidence text",
    selectedCourseId: null,
    keystrokeLog: [],
    startedAt: null,
    lastActivityAt: null,
    lastKeyDownTimestamp: null,
    activeDurationMs: 2_000,
    pausedAt: null,
    createdAt: 1_800_000_000_000,
    savedAt: 1_800_000_001_000,
    saveReason: "autosave",
    backendDraftId: null,
    serverVersion: null,
    syncStatus: "PENDING_SYNC",
    lifecycleStatus: "ACTIVE",
    ...overrides,
  };
}

describe("useEditorDraftRecovery failure/lifecycle coverage", () => {
  beforeEach(() => {
    vi.mocked(createEditorDraftId).mockReset();
    vi.mocked(createEditorDraftId).mockReturnValue("generated-boundary-draft");
    vi.mocked(readEditorDraft).mockReset();
    vi.mocked(saveEditorDraft).mockReset();
    vi.mocked(deleteEditorDraft).mockReset();
    vi.mocked(deleteEditorDraftLocal).mockReset();
    vi.mocked(deleteEditorDraftByKey).mockReset();
    vi.mocked(listEditorDrafts).mockReset();

    vi.mocked(deleteEditorDraft).mockResolvedValue(undefined);
    vi.mocked(deleteEditorDraftLocal).mockResolvedValue(undefined);
    vi.mocked(deleteEditorDraftByKey).mockResolvedValue(undefined);
    vi.mocked(listEditorDrafts).mockResolvedValue([]);
  });

  it("finishes the recovery check cleanly when loading a draft fails", async () => {
    vi.mocked(readEditorDraft).mockRejectedValue(new Error("storage unavailable"));

    const { result } = renderHook(() =>
      useEditorDraftRecovery({ userId: USER_ID, draftId: DRAFT_ID }),
    );

    await waitFor(() => expect(result.current.hasCheckedDraft).toBe(true));

    expect(readEditorDraft).toHaveBeenCalledWith(USER_ID, DRAFT_ID);
    expect(result.current.recoveredDraft).toBeNull();
    expect(result.current.status.hasRecoveredDraft).toBe(false);
  });

  it("normalizes blank user and draft identifiers before recovery", async () => {
    vi.mocked(readEditorDraft).mockResolvedValue(null);

    const { result } = renderHook(() =>
      useEditorDraftRecovery({ userId: "   ", draftId: "   " }),
    );

    await waitFor(() => expect(result.current.hasCheckedDraft).toBe(true));

    expect(readEditorDraft).toHaveBeenCalledWith("anonymous", null);
    expect(result.current.activeDraftId).toBe("generated-boundary-draft");
  });

  it("continues the serialized save queue after an earlier save rejects", async () => {
    vi.mocked(readEditorDraft).mockResolvedValue(snapshot());
    const recovered = snapshot({
      text: "Recovered second save",
      savedAt: 1_800_000_002_000,
    });

    vi.mocked(saveEditorDraft)
      .mockRejectedValueOnce(new Error("first save failed"))
      .mockResolvedValueOnce(recovered);

    const { result } = renderHook(() =>
      useEditorDraftRecovery({ userId: USER_ID, draftId: DRAFT_ID }),
    );
    await waitFor(() => expect(result.current.hasCheckedDraft).toBe(true));

    let outcomes: PromiseSettledResult<EditorDraftSnapshot>[] = [];
    await act(async () => {
      const firstSave = result.current.saveDraft(input({ text: "First" }));
      const secondSave = result.current.saveDraft(input({ text: "Second" }));
      outcomes = await Promise.allSettled([firstSave, secondSave]);
    });

    expect(outcomes[0]).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({ message: "first save failed" }),
    });
    expect(outcomes[1]).toMatchObject({
      status: "fulfilled",
      value: expect.objectContaining({ text: "Recovered second save" }),
    });

    expect(result.current.isSavingDraft).toBe(false);
    expect(saveEditorDraft).toHaveBeenCalledTimes(2);
    expect(result.current.recoveredDraft?.text).toBe("Recovered second save");
  });

  it("does not rotate the active draft when deleting a different draft", async () => {
    vi.mocked(readEditorDraft).mockResolvedValue(snapshot());

    const { result } = renderHook(() =>
      useEditorDraftRecovery({ userId: USER_ID, draftId: DRAFT_ID }),
    );
    await waitFor(() => expect(result.current.hasCheckedDraft).toBe(true));

    const originalActiveId = result.current.activeDraftId;
    await act(async () => {
      await result.current.clearDraft("another-draft");
    });

    expect(deleteEditorDraft).toHaveBeenCalledWith(USER_ID, "another-draft");
    expect(result.current.activeDraftId).toBe(originalActiveId);
    expect(createEditorDraftId).not.toHaveBeenCalled();
  });

  it("rotates to a fresh draft after clearing the active local recovery", async () => {
    vi.mocked(readEditorDraft).mockResolvedValue(snapshot());
    vi.mocked(createEditorDraftId).mockReturnValue("replacement-boundary-draft");

    const { result } = renderHook(() =>
      useEditorDraftRecovery({ userId: USER_ID, draftId: DRAFT_ID }),
    );
    await waitFor(() => expect(result.current.hasCheckedDraft).toBe(true));

    await act(async () => {
      await result.current.clearLocalDraft();
    });

    expect(deleteEditorDraftLocal).toHaveBeenCalledWith(USER_ID, DRAFT_ID);
    expect(result.current.recoveredDraft).toBeNull();
    expect(result.current.activeDraftId).toBe("replacement-boundary-draft");
  });
});
