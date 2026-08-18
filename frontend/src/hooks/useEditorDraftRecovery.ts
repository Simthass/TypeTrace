import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createEditorDraftId,
  deleteEditorDraft,
  deleteEditorDraftByKey,
  deleteEditorDraftLocal,
  listEditorDrafts,
  readEditorDraft,
  saveEditorDraft,
  safeDraftUserId,
  type DraftSaveReason,
  type EditorDraftInput,
  type EditorDraftSnapshot,
} from "../lib/editorDraftStore";

export type { EditorDraftSnapshot } from "../lib/editorDraftStore";

interface UseEditorDraftRecoveryOptions {
  userId?: string | null;
  draftId?: string | null;
}

export function useEditorDraftRecovery({
  userId,
  draftId,
}: UseEditorDraftRecoveryOptions) {
  const safeUser = safeDraftUserId(userId);
  const requestedDraftId = draftId?.trim() || null;

  const [activeDraftId, setActiveDraftId] = useState(
    () => requestedDraftId ?? createEditorDraftId(),
  );
  const [activeCreatedAt, setActiveCreatedAt] = useState<number | null>(null);
  const [recoveredDraft, setRecoveredDraft] =
    useState<EditorDraftSnapshot | null>(null);
  const [hasCheckedDraft, setHasCheckedDraft] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const latestSaveRef = useRef<Promise<EditorDraftSnapshot> | null>(null);
  const saveQueueRef = useRef<Promise<void> | null>(null);
  const pendingSaveCountRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!requestedDraftId) return;

    const timer = window.setTimeout(() => {
      setActiveDraftId(requestedDraftId);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [requestedDraftId]);

  useEffect(() => {
    let mounted = true;

    const timer = window.setTimeout(() => {
      async function loadDraft() {
        try {
          const draft = await readEditorDraft(safeUser, requestedDraftId);
          if (!mounted) return;
          setRecoveredDraft(draft);
          if (draft && requestedDraftId) {
            setActiveCreatedAt(draft.createdAt);
            setActiveDraftId(draft.draftId);
          }
        } catch {
          if (!mounted) return;
          setRecoveredDraft(null);
        } finally {
          if (mounted) setHasCheckedDraft(true);
        }
      }

      void loadDraft();
    }, 0);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [requestedDraftId, safeUser]);

  const saveDraft = useCallback(
    async (
      snapshot: EditorDraftInput,
      options?: { saveReason?: DraftSaveReason },
    ) => {
      pendingSaveCountRef.current += 1;
      setIsSavingDraft(true);

      const previousSave = saveQueueRef.current ?? Promise.resolve();
      const savePromise = previousSave
        .catch(() => undefined)
        .then(() =>
          saveEditorDraft({
            userId: safeUser,
            draftId: activeDraftId,
            snapshot,
            saveReason: options?.saveReason ?? "autosave",
            existingCreatedAt: activeCreatedAt,
          }),
        )
        .finally(() => {
          pendingSaveCountRef.current = Math.max(
            0,
            pendingSaveCountRef.current - 1,
          );
          if (latestSaveRef.current === savePromise) {
            latestSaveRef.current = null;
          }
          if (pendingSaveCountRef.current === 0 && mountedRef.current) {
            setIsSavingDraft(false);
          }
        });

      saveQueueRef.current = savePromise.then(
        () => undefined,
        () => undefined,
      );
      latestSaveRef.current = savePromise;
      const saved = await savePromise;
      if (mountedRef.current) {
        setRecoveredDraft(saved);
        setActiveDraftId(saved.draftId);
        setActiveCreatedAt(saved.createdAt);
      }
      return saved;
    },
    [activeCreatedAt, activeDraftId, safeUser],
  );

  const clearDraft = useCallback(
    async (draftIdToClear?: string | null) => {
      const targetDraftId = draftIdToClear || activeDraftId;
      await deleteEditorDraft(safeUser, targetDraftId);
      setRecoveredDraft((current) =>
        current?.draftId === targetDraftId ? null : current,
      );
      if (targetDraftId === activeDraftId) {
        const nextDraftId = createEditorDraftId();
        setActiveDraftId(nextDraftId);
        setActiveCreatedAt(null);
      }
    },
    [activeDraftId, safeUser],
  );

  const clearLocalDraft = useCallback(
    async (draftIdToClear?: string | null) => {
      const targetDraftId = draftIdToClear || activeDraftId;
      await deleteEditorDraftLocal(safeUser, targetDraftId);
      setRecoveredDraft((current) =>
        current?.draftId === targetDraftId ? null : current,
      );
      if (targetDraftId === activeDraftId) {
        const nextDraftId = createEditorDraftId();
        setActiveDraftId(nextDraftId);
        setActiveCreatedAt(null);
      }
    },
    [activeDraftId, safeUser],
  );

  const deleteDraftByKey = useCallback(async (draftKey: string) => {
    await deleteEditorDraftByKey(draftKey);
    setRecoveredDraft((current) =>
      current?.draftKey === draftKey ? null : current,
    );
  }, []);

  const dismissRecoveredDraft = useCallback(() => {
    setRecoveredDraft(null);
  }, []);

  const resumeRecoveredDraft = useCallback(() => {
    if (!recoveredDraft) return null;

    setActiveDraftId(recoveredDraft.draftId);
    setActiveCreatedAt(recoveredDraft.createdAt);
    return recoveredDraft;
  }, [recoveredDraft]);

  const startNewDraft = useCallback(() => {
    const nextDraftId = createEditorDraftId();
    setActiveDraftId(nextDraftId);
    setActiveCreatedAt(null);
    setRecoveredDraft(null);
    setHasCheckedDraft(true);
    return nextDraftId;
  }, []);

  const refreshDrafts = useCallback(
    () => listEditorDrafts(safeUser),
    [safeUser],
  );

  const status = useMemo(
    () => ({
      activeDraftId,
      hasRecoveredDraft: Boolean(recoveredDraft),
      hasCheckedDraft,
      isSavingDraft,
    }),
    [activeDraftId, hasCheckedDraft, isSavingDraft, recoveredDraft],
  );

  return {
    activeDraftId,
    recoveredDraft,
    hasCheckedDraft,
    isSavingDraft,
    status,
    saveDraft,
    clearDraft,
    clearLocalDraft,
    deleteDraftByKey,
    dismissRecoveredDraft,
    resumeRecoveredDraft,
    startNewDraft,
    refreshDrafts,
  };
}
