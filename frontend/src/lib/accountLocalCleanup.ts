import { clearEditorDraftsForUser } from "./editorDraftStore";
import { useAuthStore } from "../store/authStore";
import { useNotificationStore } from "../store/notificationStore";
import { usePasswordResetStore } from "../store/passwordResetStore";
import { useRegistrationStore } from "../store/registrationStore";

const EDITOR_CONSENT_STORAGE_KEY = "typetrace.editorEvidenceConsent.v1";

export interface LocalAccountCleanupResult {
  deletedDraftCount: number;
  failures: string[];
}

function clearNamedBrowserStorage(): void {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(EDITOR_CONSENT_STORAGE_KEY);
  window.localStorage.removeItem("typetrace-auth");
  window.sessionStorage.removeItem("typetrace-registration");
  window.sessionStorage.removeItem("typetrace-password-reset");
}

/** Clear private browser state after the server has anonymized an account. */
export async function clearLocalAccountData(
  userId?: string | null,
): Promise<LocalAccountCleanupResult> {
  const failures: string[] = [];
  let deletedDraftCount = 0;

  try {
    deletedDraftCount = await clearEditorDraftsForUser(userId);
  } catch {
    failures.push("editor drafts");
  }

  try {
    useNotificationStore.getState().reset();
    useRegistrationStore.getState().clearSession();
    usePasswordResetStore.getState().clearSession();
    useAuthStore.getState().logout();
    useAuthStore.persist.clearStorage();
    clearNamedBrowserStorage();
  } catch {
    failures.push("account session state");
  }

  return { deletedDraftCount, failures };
}
