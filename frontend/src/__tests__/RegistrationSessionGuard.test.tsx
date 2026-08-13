import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RegistrationSessionGuard from "../components/guards/RegistrationSessionGuard";
import {
  ToastContext,
  type ToastContextValue,
} from "../components/ui/ToastContext";
import { api } from "../lib/api";
import { useRegistrationStore } from "../store/registrationStore";

const validRegistrationId = `reg_${"a".repeat(32)}`;

function renderGuard(entry = "/verify-otp", showToast = vi.fn()) {
  const toastValue: ToastContextValue = {
    showToast,
    dismissToast: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  };

  render(
    <ToastContext.Provider value={toastValue}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route element={<RegistrationSessionGuard />}>
            <Route path="/verify-otp" element={<div>OTP workspace</div>} />
          </Route>
          <Route path="/register" element={<div>Registration page</div>} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    </ToastContext.Provider>,
  );

  return { showToast };
}

describe("RegistrationSessionGuard", () => {
  beforeEach(() => {
    useRegistrationStore.setState({ session: null });
  });

  it("allows a well-formed unexpired registration session", async () => {
    useRegistrationStore.getState().setSession({
      registrationId: validRegistrationId,
      email: "student@example.com",
      role: "STUDENT",
      expiresAt: Date.now() + 60_000,
    });

    renderGuard();
    expect(screen.getByText(/Checking the secure registration session/)).toBeInTheDocument();
    expect(await screen.findByText("OTP workspace")).toBeInTheDocument();
  });

  it("redirects direct access to registration and emits a controlled warning", async () => {
    const showToast = vi.fn();
    renderGuard("/verify-otp", showToast);

    expect(await screen.findByText("Registration page")).toBeInTheDocument();
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "warning",
          title: "Registration session required",
        }),
      );
    });
  });

  it("recovers a pending registration from a validated hash identifier", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        registration_id: validRegistrationId,
        email: "student@example.com",
        role: "STUDENT",
        state: "PENDING",
        expires_in_seconds: 300,
        attempts_remaining: 4,
        resends_remaining: 2,
        resend_available_in_seconds: 0,
      },
    });

    renderGuard(`/verify-otp#registration_id=${validRegistrationId}`);

    expect(await screen.findByText("OTP workspace")).toBeInTheDocument();
    expect(useRegistrationStore.getState().session).toMatchObject({
      registrationId: validRegistrationId,
      email: "student@example.com",
      role: "STUDENT",
    });
  });

  it("routes a completed recovery to login without recreating a session", async () => {
    const showToast = vi.fn();
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        registration_id: validRegistrationId,
        email: "student@example.com",
        role: "STUDENT",
        state: "COMPLETED",
        expires_in_seconds: 300,
        attempts_remaining: 0,
        resends_remaining: 0,
        resend_available_in_seconds: 0,
      },
    });

    renderGuard(`/verify-otp#registration_id=${validRegistrationId}`, showToast);
    expect(await screen.findByText("Login page")).toBeInTheDocument();
    expect(useRegistrationStore.getState().session).toBeNull();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Account already verified" }),
    );
  });

  it("rejects an expired recovery response", async () => {
    const showToast = vi.fn();
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        registration_id: validRegistrationId,
        email: "student@example.com",
        role: "STUDENT",
        state: "PENDING",
        expires_in_seconds: 0,
        attempts_remaining: 0,
        resends_remaining: 0,
        resend_available_in_seconds: 0,
      },
    });

    renderGuard(`/verify-otp#registration_id=${validRegistrationId}`, showToast);
    expect(await screen.findByText("Registration page")).toBeInTheDocument();
    await act(async () => undefined);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Registration session unavailable" }),
    );
  });
});
