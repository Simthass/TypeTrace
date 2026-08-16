import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../lib/api";
import {
  clearEditorDraftsForUser,
  createEditorDraftId,
  createEditorDraftKey,
  deleteEditorDraftByKey,
  listEditorDrafts,
  readEditorDraft,
  saveEditorDraft,
  type EditorDraftInput,
} from "../lib/editorDraftStore";
import type { KeystrokeEvent } from "../types/editor";

const USER_ID = "resilience-student";

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

function input(overrides: Partial<EditorDraftInput> = {}): EditorDraftInput {
  return {
    title: "Resilient draft",
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

function serverDraft(
  draftId: string,
  overrides: Record<string, unknown> = {},
) {
  const now = Date.now();
  return {
    id: `server-${draftId}`,
    backend_draft_id: `server-${draftId}`,
    draft_id: draftId,
    local_draft_id: draftId,
    title: "Server draft",
    text_content: "Server evidence",
    course_id: 5,
    keystroke_array: [],
    active_duration_ms: 2_000,
    started_at: null,
    last_activity_at: null,
    paused_at: null,
    version: 2,
    lifecycle_status: "PAUSED",
    sync_status: "SYNCED",
    save_reason: "manual",
    created_at: now - 1_000,
    updated_at: now,
    ...overrides,
  };
}

function axiosError(
  status: number,
  data: Record<string, unknown> = {},
): Error & { isAxiosError: true; response: { status: number; data: unknown } } {
  return Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true as const,
    response: { status, data },
  });
}

function relativeEvent(
  type: KeystrokeEvent["type"],
  timestamp: number,
  flightTime: number | null,
): KeystrokeEvent {
  return {
    key: type === "keydown" ? "a" : "__CURSOR_MOVE__",
    keyCode: type === "keydown" ? 65 : 0,
    type,
    timestamp,
    down_time: null,
    up_time: null,
    dwell_time: null,
    flight_time: flightTime,
    documentLength: 1,
    cursorPosition: 1,
  };
}

describe("editorDraftStore resilience coverage", () => {
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

  it("creates stable timestamp-prefixed draft identifiers", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const id = createEditorDraftId(1_800_000_000_000);
    expect(id).toMatch(/^draft-1800000000000-/);
    expect(createEditorDraftKey(" student-a ", "draft-a")).toBe(
      "editor:student-a:draft-a",
    );
  });

  it("repairs legacy relative timestamps and implausible timing fields during recovery", async () => {
    setOnline(false);
    const savedAt = Date.now();
    const draftId = "legacy-relative";
    const draftKey = createEditorDraftKey(USER_ID, draftId);

    window.localStorage.setItem(
      `typetrace:draft:${draftKey}`,
      JSON.stringify({
        version: 1,
        draftKey,
        draftId,
        userId: USER_ID,
        title: "Legacy evidence",
        text: "Recovered",
        selectedCourseId: "not-a-number",
        keystrokeLog: [
          relativeEvent("keydown", 0, 0),
          relativeEvent("keydown", 120, 120),
          relativeEvent("cursor", 60_000, 60_000),
        ],
        activeDurationMs: "invalid",
        startedAt: 50,
        lastActivityAt: 60,
        lastKeyDownTimestamp: 70,
        pausedAt: 80,
        createdAt: null,
        savedAt,
        saveReason: "unknown",
        syncStatus: "UNKNOWN",
        lifecycleStatus: "UNKNOWN",
      }),
    );

    const restored = await readEditorDraft(USER_ID, draftId);

    expect(restored).not.toBeNull();
    expect(restored?.selectedCourseId).toBeNull();
    expect(restored?.saveReason).toBe("autosave");
    expect(restored?.syncStatus).toBe("LOCAL_ONLY");
    expect(restored?.lifecycleStatus).toBe("PAUSED");
    expect(restored?.activeDurationMs).toBeGreaterThanOrEqual(1_000);
    expect(restored?.startedAt).toBeGreaterThan(1_500_000_000_000);
    expect(restored?.lastKeyDownTimestamp).toBeGreaterThanOrEqual(
      restored?.startedAt ?? 0,
    );
    expect(restored?.keystrokeLog[2].flight_time).toBeNull();
  });

  it("converts a server version conflict into an explicit conflict snapshot", async () => {
    const draftId = "conflict-draft";
    vi.spyOn(api, "post")
      .mockResolvedValueOnce({ data: { draft: serverDraft(draftId) } } as never)
      .mockRejectedValueOnce(
        axiosError(409, {
          error: {
            code: "DRAFT_VERSION_CONFLICT",
            details: {
              server_draft: serverDraft(draftId, {
                version: 3,
                text_content: "Authoritative server text",
              }),
            },
          },
        }),
      );

    await saveEditorDraft({
      userId: USER_ID,
      draftId,
      snapshot: input(),
    });

    const conflicted = await saveEditorDraft({
      userId: USER_ID,
      draftId,
      snapshot: input({ text: "Local competing edit" }),
      saveReason: "manual",
    });

    expect(conflicted).toMatchObject({
      draftId,
      serverVersion: 3,
      syncStatus: "CONFLICT",
      text: "Authoritative server text",
    });
    expect(vi.mocked(api.post).mock.calls[1][1]).toMatchObject({
      expected_version: 2,
    });
  });

  it("synchronizes pending local drafts and merges newer server drafts", async () => {
    setOnline(false);
    const pending = await saveEditorDraft({
      userId: USER_ID,
      draftId: "pending-local",
      snapshot: input({ text: "Offline evidence" }),
    });
    expect(pending.syncStatus).toBe("PENDING_SYNC");

    setOnline(true);
    vi.spyOn(api, "post").mockResolvedValue({
      data: {
        draft: serverDraft("pending-local", {
          text_content: "Offline evidence",
          updated_at: Date.now() + 10,
        }),
      },
    } as never);
    vi.spyOn(api, "get").mockResolvedValue({
      data: {
        drafts: [
          serverDraft("server-only", {
            title: "Newest server draft",
            updated_at: Date.now() + 50,
          }),
        ],
      },
    } as never);

    const drafts = await listEditorDrafts(USER_ID);

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(drafts.map((draft) => draft.draftId)).toEqual([
      "server-only",
      "pending-local",
    ]);
    expect(drafts.every((draft) => draft.syncStatus === "SYNCED")).toBe(true);
  });

  it("prefers a newer server snapshot when reading a specific draft", async () => {
    setOnline(false);
    await saveEditorDraft({
      userId: USER_ID,
      draftId: "latest-wins",
      snapshot: input({ text: "Older local text" }),
    });

    setOnline(true);
    vi.spyOn(api, "get").mockResolvedValue({
      data: {
        draft: serverDraft("latest-wins", {
          text_content: "Newer server text",
          updated_at: Date.now() + 5_000,
        }),
      },
    } as never);

    const restored = await readEditorDraft(USER_ID, "latest-wins");
    expect(restored?.text).toBe("Newer server text");
    expect(restored?.backendDraftId).toBe("server-latest-wins");
  });

  it("treats a server 404 during delete as already deleted and clears the mirror", async () => {
    setOnline(false);
    const saved = await saveEditorDraft({
      userId: USER_ID,
      draftId: "already-removed",
      snapshot: input(),
    });

    setOnline(true);
    vi.spyOn(api, "delete").mockRejectedValue(axiosError(404));
    await deleteEditorDraftByKey(saved.draftKey);

    expect(api.delete).toHaveBeenCalledTimes(1);
    expect(
      window.localStorage.getItem(`typetrace:draft:${saved.draftKey}`),
    ).toBeNull();
  });

  it("clears only browser-resident drafts owned by the anonymized account", async () => {
    setOnline(false);
    const first = await saveEditorDraft({
      userId: USER_ID,
      draftId: "first",
      snapshot: input(),
    });
    const second = await saveEditorDraft({
      userId: USER_ID,
      draftId: "second",
      snapshot: input(),
    });
    const other = await saveEditorDraft({
      userId: "other-student",
      draftId: "other",
      snapshot: input(),
    });
    window.localStorage.setItem(
      `typetrace:draft:editor:${USER_ID}`,
      JSON.stringify({
        draftKey: `editor:${USER_ID}`,
        userId: USER_ID,
        title: "Legacy",
        text: "Legacy evidence",
        savedAt: Date.now(),
      }),
    );

    const cleared = await clearEditorDraftsForUser(USER_ID);

    expect(cleared).toBe(3);
    expect(
      window.localStorage.getItem(`typetrace:draft:${first.draftKey}`),
    ).toBeNull();
    expect(
      window.localStorage.getItem(`typetrace:draft:${second.draftKey}`),
    ).toBeNull();
    expect(
      window.localStorage.getItem(`typetrace:draft:${other.draftKey}`),
    ).not.toBeNull();
  });
});
