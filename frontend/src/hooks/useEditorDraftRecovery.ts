import { useCallback, useEffect, useRef, useState } from "react";
import type { KeystrokeEvent } from "../types/editor";

const DB_NAME = "typetrace-editor-drafts";
const DB_VERSION = 1;
const STORE_NAME = "drafts";
const LOCAL_MIRROR_PREFIX = "typetrace:draft:";
const DRAFT_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

export interface EditorDraftSnapshot {
  version: 1;
  draftKey: string;
  userId: string;
  title: string;
  text: string;
  selectedCourseId: number | null;
  keystrokeLog: KeystrokeEvent[];
  startedAt: number | null;
  lastActivityAt: number | null;
  lastKeyDownTimestamp: number | null;
  savedAt: number;
}

interface UseEditorDraftRecoveryOptions {
  userId?: string | null;
}

function safeUserId(userId?: string | null): string {
  return String(userId || "anonymous").trim() || "anonymous";
}

function createDraftKey(userId?: string | null): string {
  return `editor:${safeUserId(userId)}`;
}

function localMirrorKey(draftKey: string): string {
  return `${LOCAL_MIRROR_PREFIX}${draftKey}`;
}

function isRecoverableDraft(value: unknown): value is EditorDraftSnapshot {
  if (!value || typeof value !== "object") return false;

  const draft = value as EditorDraftSnapshot;
  const hasText =
    typeof draft.text === "string" && draft.text.trim().length > 0;
  const hasEvents =
    Array.isArray(draft.keystrokeLog) && draft.keystrokeLog.length > 0;
  const isFresh =
    typeof draft.savedAt === "number" &&
    Date.now() - draft.savedAt < DRAFT_TTL_MS;

  return (
    draft.version === 1 &&
    Boolean(draft.draftKey) &&
    isFresh &&
    (hasText || hasEvents)
  );
}

function openDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "draftKey" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open draft database."));
  });
}

async function readIndexedDbDraft(
  draftKey: string,
): Promise<EditorDraftSnapshot | null> {
  const db = await openDraftDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(draftKey);

    request.onsuccess = () => {
      const result = request.result;
      resolve(isRecoverableDraft(result) ? result : null);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to read editor draft."));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Failed to read editor draft."));
    };
  });
}

async function writeIndexedDbDraft(
  snapshot: EditorDraftSnapshot,
): Promise<void> {
  const db = await openDraftDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(snapshot);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Failed to save editor draft."));
    };
  });
}

async function deleteIndexedDbDraft(draftKey: string): Promise<void> {
  const db = await openDraftDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(draftKey);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Failed to delete editor draft."));
    };
  });
}

function readLocalMirror(draftKey: string): EditorDraftSnapshot | null {
  try {
    const raw = window.localStorage.getItem(localMirrorKey(draftKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isRecoverableDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocalMirror(snapshot: EditorDraftSnapshot): void {
  try {
    window.localStorage.setItem(
      localMirrorKey(snapshot.draftKey),
      JSON.stringify(snapshot),
    );
  } catch {
    // Local storage can be full/private-mode blocked. IndexedDB is still attempted.
  }
}

function deleteLocalMirror(draftKey: string): void {
  try {
    window.localStorage.removeItem(localMirrorKey(draftKey));
  } catch {
    // Ignore cleanup failure.
  }
}

export function useEditorDraftRecovery({
  userId,
}: UseEditorDraftRecoveryOptions) {
  const draftKey = createDraftKey(userId);
  const [recoveredDraft, setRecoveredDraft] =
    useState<EditorDraftSnapshot | null>(null);
  const [hasCheckedDraft, setHasCheckedDraft] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const latestSaveRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadDraft() {
      setHasCheckedDraft(false);

      const localDraft = readLocalMirror(draftKey);
      if (mounted && localDraft) {
        setRecoveredDraft(localDraft);
      }

      try {
        const indexedDraft = await readIndexedDbDraft(draftKey);
        if (!mounted) return;
        setRecoveredDraft(indexedDraft ?? localDraft ?? null);
      } catch {
        if (!mounted) return;
        setRecoveredDraft(localDraft ?? null);
      } finally {
        if (mounted) setHasCheckedDraft(true);
      }
    }

    void loadDraft();

    return () => {
      mounted = false;
    };
  }, [draftKey]);

  const saveDraft = useCallback(
    async (
      snapshot: Omit<
        EditorDraftSnapshot,
        "version" | "draftKey" | "userId" | "savedAt"
      >,
    ) => {
      const nextSnapshot: EditorDraftSnapshot = {
        version: 1,
        draftKey,
        userId: safeUserId(userId),
        title: snapshot.title,
        text: snapshot.text,
        selectedCourseId: snapshot.selectedCourseId,
        keystrokeLog: snapshot.keystrokeLog,
        startedAt: snapshot.startedAt,
        lastActivityAt: snapshot.lastActivityAt,
        lastKeyDownTimestamp: snapshot.lastKeyDownTimestamp,
        savedAt: Date.now(),
      };

      writeLocalMirror(nextSnapshot);
      setIsSavingDraft(true);

      const savePromise = writeIndexedDbDraft(nextSnapshot)
        .catch(() => {
          // Local mirror is already saved. Do not break typing UX if IndexedDB fails.
        })
        .finally(() => {
          if (latestSaveRef.current === savePromise) {
            setIsSavingDraft(false);
            latestSaveRef.current = null;
          }
        });

      latestSaveRef.current = savePromise;
      await savePromise;
    },
    [draftKey, userId],
  );

  const clearDraft = useCallback(async () => {
    deleteLocalMirror(draftKey);
    setRecoveredDraft(null);
    try {
      await deleteIndexedDbDraft(draftKey);
    } catch {
      // Local mirror is removed; ignore IndexedDB cleanup failure.
    }
  }, [draftKey]);

  const dismissRecoveredDraft = useCallback(() => {
    setRecoveredDraft(null);
  }, []);

  return {
    draftKey,
    recoveredDraft,
    hasCheckedDraft,
    isSavingDraft,
    saveDraft,
    clearDraft,
    dismissRecoveredDraft,
  };
}
