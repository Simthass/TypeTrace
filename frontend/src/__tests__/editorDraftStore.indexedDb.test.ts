import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearEditorDraftsForUser,
  createEditorDraftKey,
  deleteEditorDraftLocalByKey,
  listEditorDrafts,
  readEditorDraft,
  saveEditorDraft,
  type EditorDraftInput,
} from "../lib/editorDraftStore";

const USER_ID = "indexed-student";

interface RequestLike<T = unknown> {
  result: T;
  error: Error | null;
  onsuccess: null | (() => void);
  onerror: null | (() => void);
  onupgradeneeded?: null | (() => void);
}

interface TransactionLike {
  error: Error | null;
  oncomplete: null | (() => void);
  onerror: null | (() => void);
  objectStore: () => {
    get: (key: string) => RequestLike;
    getAll: () => RequestLike<unknown[]>;
    put: (value: { draftKey: string }) => void;
    delete: (key: string) => void;
  };
}

function installIndexedDb() {
  const values = new Map<string, unknown>();
  let storeCreated = false;

  const database = {
    objectStoreNames: {
      contains: () => storeCreated,
    },
    createObjectStore: () => {
      storeCreated = true;
      return {};
    },
    close: vi.fn(),
    transaction: () => {
      const tx: TransactionLike = {
        error: null,
        oncomplete: null,
        onerror: null,
        objectStore: () => ({
          get: (key: string) => {
            const request: RequestLike = {
              result: values.get(key),
              error: null,
              onsuccess: null,
              onerror: null,
            };
            queueMicrotask(() => {
              request.onsuccess?.();
              queueMicrotask(() => tx.oncomplete?.());
            });
            return request;
          },
          getAll: () => {
            const request: RequestLike<unknown[]> = {
              result: Array.from(values.values()),
              error: null,
              onsuccess: null,
              onerror: null,
            };
            queueMicrotask(() => {
              request.onsuccess?.();
              queueMicrotask(() => tx.oncomplete?.());
            });
            return request;
          },
          put: (value: { draftKey: string }) => {
            values.set(value.draftKey, structuredClone(value));
            queueMicrotask(() => tx.oncomplete?.());
          },
          delete: (key: string) => {
            values.delete(key);
            queueMicrotask(() => tx.oncomplete?.());
          },
        }),
      };
      return tx;
    },
  };

  const indexedDB = {
    open: () => {
      const request: RequestLike<typeof database> = {
        result: database,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };
      queueMicrotask(() => {
        if (!storeCreated) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };

  Object.defineProperty(window, "indexedDB", {
    configurable: true,
    value: indexedDB,
  });

  return { values, database };
}

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

function snapshot(text: string): EditorDraftInput {
  return {
    title: "IndexedDB recovery",
    text,
    selectedCourseId: null,
    keystrokeLog: [
      {
        type: "keydown",
        key: "a",
        keyCode: 65,
        timestamp: Date.now() - 500,
        down_time: Date.now() - 500,
        up_time: Date.now() - 450,
        dwell_time: 50,
        flight_time: null,
        documentLength: text.length,
        cursorPosition: text.length,
      },
    ],
    startedAt: Date.now() - 2_000,
    lastActivityAt: Date.now() - 100,
    lastKeyDownTimestamp: Date.now() - 500,
    activeDurationMs: 1_900,
    pausedAt: null,
    backendDraftId: null,
    serverVersion: null,
    syncStatus: "LOCAL_ONLY",
    lifecycleStatus: "ACTIVE",
  };
}

describe("editorDraftStore IndexedDB durability coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setOnline(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    setOnline(true);
    Reflect.deleteProperty(window, "indexedDB");
  });

  it("creates the IndexedDB store and persists an offline draft in both browser stores", async () => {
    const { values, database } = installIndexedDb();
    const saved = await saveEditorDraft({
      userId: USER_ID,
      draftId: "durable-1",
      snapshot: snapshot("Durable evidence"),
      saveReason: "recovery",
    });

    expect(values.has(saved.draftKey)).toBe(true);
    expect(window.localStorage.getItem(`typetrace:draft:${saved.draftKey}`)).not.toBeNull();
    expect(saved.syncStatus).toBe("PENDING_SYNC");
    expect(saved.lifecycleStatus).toBe("PAUSED");
    expect(database.close).toHaveBeenCalled();
  });

  it("recovers an explicit draft from IndexedDB after the LocalStorage mirror disappears", async () => {
    installIndexedDb();
    const saved = await saveEditorDraft({
      userId: USER_ID,
      draftId: "indexed-only",
      snapshot: snapshot("Indexed only evidence"),
    });
    window.localStorage.removeItem(`typetrace:draft:${saved.draftKey}`);

    const restored = await readEditorDraft(USER_ID, "indexed-only");
    expect(restored).toMatchObject({
      draftId: "indexed-only",
      text: "Indexed only evidence",
      userId: USER_ID,
    });
    expect(window.localStorage.getItem(`typetrace:draft:${saved.draftKey}`)).not.toBeNull();
  });

  it("lists and merges IndexedDB drafts in newest-first order", async () => {
    installIndexedDb();
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_900_000_000_000);

    await saveEditorDraft({
      userId: USER_ID,
      draftId: "older-indexed",
      snapshot: snapshot("Older indexed evidence"),
    });
    clock.mockReturnValue(1_900_000_001_000);
    await saveEditorDraft({
      userId: USER_ID,
      draftId: "newer-indexed",
      snapshot: snapshot("Newer indexed evidence"),
    });
    window.localStorage.clear();

    const drafts = await listEditorDrafts(USER_ID);
    expect(drafts.map((draft) => draft.draftId)).toEqual([
      "newer-indexed",
      "older-indexed",
    ]);
  });

  it("deletes an IndexedDB draft by authoritative key even when no mirror remains", async () => {
    const { values } = installIndexedDb();
    const saved = await saveEditorDraft({
      userId: USER_ID,
      draftId: "delete-indexed",
      snapshot: snapshot("Delete me"),
    });
    window.localStorage.clear();
    expect(values.has(saved.draftKey)).toBe(true);

    await deleteEditorDraftLocalByKey(saved.draftKey);
    expect(values.has(saved.draftKey)).toBe(false);
  });

  it("clears only the selected user's IndexedDB and LocalStorage drafts", async () => {
    const { values } = installIndexedDb();
    const mine = await saveEditorDraft({
      userId: USER_ID,
      draftId: "mine",
      snapshot: snapshot("Mine"),
    });
    const other = await saveEditorDraft({
      userId: "other-student",
      draftId: "theirs",
      snapshot: snapshot("Theirs"),
    });

    const removed = await clearEditorDraftsForUser(USER_ID);
    expect(removed).toBe(1);
    expect(values.has(mine.draftKey)).toBe(false);
    expect(values.has(other.draftKey)).toBe(true);
    expect(window.localStorage.getItem(`typetrace:draft:${mine.draftKey}`)).toBeNull();
    expect(window.localStorage.getItem(`typetrace:draft:${other.draftKey}`)).not.toBeNull();
  });

  it("does not delete unrelated IndexedDB objects during privacy cleanup", async () => {
    const { values } = installIndexedDb();
    const key = createEditorDraftKey(USER_ID, "owned");
    values.set(key, {
      version: 3,
      draftKey: key,
      draftId: "owned",
      userId: USER_ID,
      title: "Owned",
      text: "Evidence",
      keystrokeLog: [],
      activeDurationMs: 0,
      createdAt: Date.now(),
      savedAt: Date.now(),
      saveReason: "recovery",
      syncStatus: "LOCAL_ONLY",
      lifecycleStatus: "PAUSED",
    });
    values.set("unrelated-object", { draftKey: "not-an-editor-key", data: true });

    expect(await clearEditorDraftsForUser(USER_ID)).toBe(1);
    expect(values.has(key)).toBe(false);
    expect(values.has("unrelated-object")).toBe(true);
  });
});
