import { beforeEach, describe, expect, it } from "vitest";

import { clearLocalAccountData } from "../lib/accountLocalCleanup";
import { useAuthStore } from "../store/authStore";
import { useNotificationStore } from "../store/notificationStore";
import { usePasswordResetStore } from "../store/passwordResetStore";
import { useRegistrationStore } from "../store/registrationStore";

describe("account anonymization local cleanup", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: "student-a",
        first_name: "Student",
        email: "student@example.com",
        role: "STUDENT",
      },
      token: "token",
      isAuthenticated: true,
      hasHydrated: true,
    });
    useNotificationStore.setState({
      items: [
        {
          id: "notification-1",
          event_type: "REVIEW_COMPLETED",
          entity_type: "typing_session",
          entity_id: "1",
          title: "Review",
          body: "Review complete",
          action_url: "/sessions/1",
          is_read: false,
          created_at: new Date().toISOString(),
        },
      ],
      unreadCount: 1,
      isOpen: true,
      isLoading: false,
      hasFetchedOnce: true,
    });
    useRegistrationStore.getState().setSession({
      registrationId: "reg_12345678901234567890123456789012",
      email: "student@example.com",
      role: "STUDENT",
      expiresAt: Date.now() + 60_000,
    });
    usePasswordResetStore.getState().setSession({
      resetId: "rst_12345678901234567890123456789012",
      email: "student@example.com",
      expiresAt: Date.now() + 60_000,
    });

    window.localStorage.setItem(
      "typetrace:draft:editor:student-a:draft-1",
      JSON.stringify({ draftKey: "editor:student-a:draft-1" }),
    );
    window.localStorage.setItem(
      "typetrace.editorEvidenceConsent.v1",
      "accepted",
    );
  });

  it("removes local evidence, transient auth state, and notification state", async () => {
    const result = await clearLocalAccountData("student-a");

    expect(result.failures).toEqual([]);
    expect(result.deletedDraftCount).toBe(1);
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useNotificationStore.getState().items).toEqual([]);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(useRegistrationStore.getState().session).toBeNull();
    expect(usePasswordResetStore.getState().session).toBeNull();
    expect(
      window.localStorage.getItem(
        "typetrace:draft:editor:student-a:draft-1",
      ),
    ).toBeNull();
    expect(
      window.localStorage.getItem("typetrace.editorEvidenceConsent.v1"),
    ).toBeNull();
  });
});
