import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../lib/api";
import {
  deleteEditorDraftByKey,
  deleteEditorDraftLocalByKey,
  readEditorDraft,
  saveEditorDraft,
  type EditorDraftInput,
} from "../lib/editorDraftStore";

const USER_ID = "core-store-student";

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

function input(overrides: Partial<EditorDraftInput> = {}): EditorDraftInput {
  return {
    title: "Core store draft",
    text: "Evidence content",
    selectedCourseId: null,
    keystrokeLog: [],
    startedAt: null,
    lastActivityAt: null,
    lastKeyDownTimestamp: null,
    activeDurationMs: 1_500,
    pausedAt: null,
    backendDraftId: null,
    serverVersion: null,
    syncStatus: "LOCAL_ONLY",
    lifecycleStatus: "ACTIVE",
    ...overrides,
  };
}

function serverDraft(draftId: string) {
  const now = Date.now();
  return {
    id: `server-${draftId}`,
    backend_draft_id: `server-${draftId}`,
    draft_id: draftId,
    local_draft_id: draftId,
    title: "Core store draft",
    text_content: "Evidence content",
    course_id: null,
    keystroke_array: [],
    active_duration_ms: 1_500,
    started_at: null,
    last_activity_at: null,
    paused_at: null,
    version: 2,
    lifecycle_status: "ACTIVE",
    sync_status: "SYNCED",
    save_reason: "autosave",
    created_at: now - 1_000,
    updated_at: now,
  };
}

describe("editorDraftStore sync and deletion contracts", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("maps a successful server save back to the local editor snapshot", async () => {
    setOnline(true);
    const draftId = "online-success";
    vi.spyOn(api, "post").mockResolvedValue({
      data: { draft: serverDraft(draftId) },
    } as never);

    const saved = await saveEditorDraft({
      userId: USER_ID,
      draftId,
      snapshot: input(),
    });

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({
      draft_id: draftId,
      title: "Core store draft",
      text_content: "Evidence content",
      active_duration_ms: 1_500,
      lifecycle_status: "ACTIVE",
      sync_status: "SYNCED",
    });
    expect(saved).toMatchObject({
      draftId,
      backendDraftId: `server-${draftId}`,
      serverVersion: 2,
      syncStatus: "SYNCED",
    });

    await deleteEditorDraftLocalByKey(saved.draftKey);
  });

  it("keeps a durable pending-sync draft when online synchronization fails", async () => {
    setOnline(true);
    const draftId = "network-fallback";
    vi.spyOn(api, "post").mockRejectedValue(new Error("network unavailable"));
    vi.spyOn(api, "get").mockRejectedValue(new Error("network unavailable"));

    const saved = await saveEditorDraft({
      userId: USER_ID,
      draftId,
      snapshot: input({ text: "Keep this locally" }),
      saveReason: "manual",
    });

    expect(saved.syncStatus).toBe("PENDING_SYNC");
    expect(saved.lifecycleStatus).toBe("PAUSED");

    const restored = await readEditorDraft(USER_ID, draftId);
    expect(restored).toMatchObject({
      draftId,
      text: "Keep this locally",
      syncStatus: "PENDING_SYNC",
    });

    await deleteEditorDraftLocalByKey(saved.draftKey);
  });

  it("does not erase the local mirror when authoritative server deletion fails", async () => {
    setOnline(false);
    const draftId = "delete-failure";
    const saved = await saveEditorDraft({
      userId: USER_ID,
      draftId,
      snapshot: input({ text: "Must survive failed delete" }),
    });
    expect(saved.syncStatus).toBe("PENDING_SYNC");

    setOnline(true);
    vi.spyOn(api, "delete").mockRejectedValue(new Error("server unavailable"));
    vi.spyOn(api, "get").mockRejectedValue(new Error("server unavailable"));

    await expect(deleteEditorDraftByKey(saved.draftKey)).rejects.toThrow(
      "server unavailable",
    );

    const restored = await readEditorDraft(USER_ID, draftId);
    expect(restored?.text).toBe("Must survive failed delete");

    await deleteEditorDraftLocalByKey(saved.draftKey);
  });

  it("removes local artifacts after a successful authoritative deletion", async () => {
    setOnline(false);
    const draftId = "delete-success";
    const saved = await saveEditorDraft({
      userId: USER_ID,
      draftId,
      snapshot: input(),
    });

    setOnline(true);
    vi.spyOn(api, "delete").mockResolvedValue({
      data: { status: "success" },
    } as never);
    vi.spyOn(api, "get").mockRejectedValue(new Error("not needed"));

    await deleteEditorDraftByKey(saved.draftKey);

    expect(api.delete).toHaveBeenCalledTimes(1);
    expect(await readEditorDraft(USER_ID, draftId)).toBeNull();
  });
});
