import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../lib/api";
import {
  clearEditorDraftsForUser,
  saveEditorDraft,
} from "../lib/editorDraftStore";

function conflictError(serverDraft: Record<string, unknown>) {
  return {
    isAxiosError: true,
    message: "Request failed with status code 409",
    response: {
      status: 409,
      data: {
        detail: "Draft version conflict.",
        error: {
          code: "DRAFT_VERSION_CONFLICT",
          message: "Draft version conflict.",
          status_code: 409,
          details: { server_draft: serverDraft },
        },
      },
    },
    toJSON: () => ({}),
  };
}

describe("draft security and conflict contracts", () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("uses the structured decrypted server snapshot for a version conflict", async () => {
    const serverDraft = {
      id: "server-1",
      backend_draft_id: "server-1",
      draft_id: "draft-1",
      local_draft_id: "draft-1",
      title: "Server title",
      text_content: "server plaintext",
      course_id: null,
      keystroke_array: [],
      active_duration_ms: 1500,
      started_at: null,
      last_activity_at: null,
      paused_at: null,
      version: 4,
      lifecycle_status: "PAUSED",
      sync_status: "SYNCED",
      save_reason: "autosave",
      created_at: 1_785_280_000_000,
      updated_at: 1_785_280_001_000,
    };

    vi.spyOn(api, "post").mockRejectedValue(conflictError(serverDraft));

    const result = await saveEditorDraft({
      userId: "student-a",
      draftId: "draft-1",
      snapshot: {
        title: "Stale title",
        text: "stale text",
        selectedCourseId: null,
        keystrokeLog: [],
        startedAt: null,
        lastActivityAt: null,
        lastKeyDownTimestamp: null,
        activeDurationMs: 1000,
        pausedAt: null,
      },
    });

    expect(result.syncStatus).toBe("CONFLICT");
    expect(result.text).toBe("server plaintext");
    expect(result.serverVersion).toBe(4);
    expect(result.backendDraftId).toBe("server-1");
  });

  it("clears only browser drafts owned by the anonymized account", async () => {
    window.localStorage.setItem(
      "typetrace:draft:editor:student-a:draft-1",
      JSON.stringify({ draftKey: "editor:student-a:draft-1" }),
    );
    window.localStorage.setItem(
      "typetrace:draft:editor:student-b:draft-2",
      JSON.stringify({ draftKey: "editor:student-b:draft-2" }),
    );

    const deleted = await clearEditorDraftsForUser("student-a");

    expect(deleted).toBe(1);
    expect(
      window.localStorage.getItem(
        "typetrace:draft:editor:student-a:draft-1",
      ),
    ).toBeNull();
    expect(
      window.localStorage.getItem(
        "typetrace:draft:editor:student-b:draft-2",
      ),
    ).not.toBeNull();
  });
});
