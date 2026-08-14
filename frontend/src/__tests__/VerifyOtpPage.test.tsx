import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import VerifyOtpPage from "../pages/VerifyOtpPage";
import { API_ROUTES } from "../constants/apiRoutes";
import { ROUTES } from "../constants/routes";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { useRegistrationStore } from "../store/registrationStore";

const { navigate, showToast } = vi.hoisted(() => ({
  navigate: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("../components/ui/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    },
  };
});

const registration = {
  registrationId: "reg_student_100",
  email: "ada@example.edu",
  role: "STUDENT" as const,
  expiresAt: Date.now() + 600_000,
};

const pendingStatus = {
  registration_id: registration.registrationId,
  email: registration.email,
  role: registration.role,
  state: "PENDING" as const,
  expires_in_seconds: 600,
  attempts_remaining: 4,
  resends_remaining: 2,
  resend_available_in_seconds: 0,
};

function renderVerification() {
  return render(
    <MemoryRouter>
      <VerifyOtpPage />
    </MemoryRouter>,
  );
}

describe("VerifyOtpPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    useAuthStore.getState().logout();
    useRegistrationStore.getState().clearSession();
    useRegistrationStore.getState().setSession(registration);
  });

  it("loads and validates the server-bound pending registration before showing OTP controls", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: pendingStatus } as never);

    renderVerification();

    expect(await screen.findByLabelText("Verification code")).toBeVisible();
    expect(screen.getByLabelText("Email address")).toHaveValue("ada@example.edu");
    expect(screen.getByLabelText("Email address")).toBeDisabled();
    expect(api.get).toHaveBeenCalledWith(
      API_ROUTES.auth.registrationStatus(registration.registrationId),
      expect.objectContaining({
        skipGlobalToast: true,
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("rejects a malformed OTP locally without calling the verification endpoint", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: pendingStatus } as never);

    renderVerification();
    const otp = await screen.findByLabelText("Verification code");
    fireEvent.change(otp, { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify account" }));

    expect(api.post).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({
      type: "warning",
      title: "Invalid code",
      message: "Enter the 6-digit verification code.",
    });
  });

  it("verifies a valid OTP, establishes the authenticated session, and routes by role", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: pendingStatus } as never);
    vi.mocked(api.post).mockResolvedValue({
      data: {
        message: "Account verified",
        access_token: "unit-test-access-token",
        already_completed: false,
        user: {
          id: "student-1",
          first_name: "Ada",
          last_name: "Lovelace",
          email: "ada@example.edu",
          role: "STUDENT",
          student_id: "STU-100",
          is_verified: true,
        },
      },
    } as never);

    renderVerification();
    const otp = await screen.findByLabelText("Verification code");
    fireEvent.change(otp, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify account" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(API_ROUTES.auth.verifyOtp, {
        registration_id: registration.registrationId,
        otp: "123456",
      }),
    );
    expect(useAuthStore.getState()).toEqual(
      expect.objectContaining({
        token: "unit-test-access-token",
        isAuthenticated: true,
        user: expect.objectContaining({ id: "student-1", role: "STUDENT" }),
      }),
    );
    expect(useRegistrationStore.getState().session).toBeNull();
    expect(navigate).toHaveBeenCalledWith(ROUTES.DASHBOARD, { replace: true });
  });

  it("clears an already-completed registration and redirects the user to sign in", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { ...pendingStatus, state: "COMPLETED" },
    } as never);

    renderVerification();

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(ROUTES.LOGIN, { replace: true }),
    );
    expect(useRegistrationStore.getState().session).toBeNull();
    expect(showToast).toHaveBeenCalledWith({
      type: "info",
      title: "Account already verified",
      message: "Sign in with the password used during registration.",
    });
  });
});
