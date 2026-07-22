import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createEditorDraftId,
  deleteEditorDraft,
  deleteEditorDraftByKey,
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
          if (draft) {
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
      setIsSavingDraft(true);

      const savePromise = saveEditorDraft({
        userId: safeUser,
        draftId: activeDraftId,
        snapshot,
        saveReason: options?.saveReason ?? "autosave",
        existingCreatedAt: activeCreatedAt,
      }).finally(() => {
        if (latestSaveRef.current === savePromise) {
          setIsSavingDraft(false);
          latestSaveRef.current = null;
        }
      });

      latestSaveRef.current = savePromise;
      const saved = await savePromise;
      setRecoveredDraft(saved);
      setActiveDraftId(saved.draftId);
      setActiveCreatedAt(saved.createdAt);
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

  const deleteDraftByKey = useCallback(async (draftKey: string) => {
    await deleteEditorDraftByKey(draftKey);
    setRecoveredDraft((current) =>
      current?.draftKey === draftKey ? null : current,
    );
  }, []);

  const dismissRecoveredDraft = useCallback(() => {
    setRecoveredDraft(null);
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
    deleteDraftByKey,
    dismissRecoveredDraft,
    refreshDrafts,
  };
}
