import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePasswordResetStore } from "../store/passwordResetStore";
import { useRegistrationStore } from "../store/registrationStore";

describe("persisted registration/password-reset session stores", () => {
  beforeEach(() => {
    useRegistrationStore.setState({ session: null });
    usePasswordResetStore.setState({ session: null });
  });

  it("sets, updates, validates, and clears a registration session", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    useRegistrationStore.getState().setSession({
      registrationId: `reg_${"a".repeat(32)}`,
      email: "student@example.com",
      role: "STUDENT",
      expiresAt: 2_000,
    });
    expect(useRegistrationStore.getState().isValid()).toBe(true);

    useRegistrationStore.getState().updateExpiry(900);
    expect(useRegistrationStore.getState().isValid()).toBe(false);
    expect(useRegistrationStore.getState().session?.expiresAt).toBe(900);

    useRegistrationStore.getState().clearSession();
    expect(useRegistrationStore.getState().session).toBeNull();
    expect(useRegistrationStore.getState().isValid()).toBe(false);
    useRegistrationStore.getState().updateExpiry(4_000);
    expect(useRegistrationStore.getState().session).toBeNull();
  });

  it("sets, updates, validates, and clears a password reset session", () => {
    vi.spyOn(Date, "now").mockReturnValue(10_000);
    usePasswordResetStore.getState().setSession({
      resetId: "reset-coverage",
      email: "student@example.com",
      expiresAt: 20_000,
    });
    expect(usePasswordResetStore.getState().isValid()).toBe(true);

    usePasswordResetStore.getState().updateExpiry(9_000);
    expect(usePasswordResetStore.getState().isValid()).toBe(false);

    usePasswordResetStore.getState().clearSession();
    expect(usePasswordResetStore.getState().session).toBeNull();
    usePasswordResetStore.getState().updateExpiry(30_000);
    expect(usePasswordResetStore.getState().session).toBeNull();
  });
});
