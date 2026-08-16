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

const REGISTRATION_ID = `reg_${"S".repeat(40)}`;
const registration = {
  registrationId: REGISTRATION_ID,
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

function axiosError(status: number, detail: string) {
  return {
    isAxiosError: true,
    message: "Request failed",
    response: { status, data: { detail } },
  };
}

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

  it("rejects a local registration that does not match the server-bound identity", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { ...pendingStatus, email: "different@example.edu" },
    } as never);

    renderVerification();

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(ROUTES.REGISTER, { replace: true }),
    );
    expect(useRegistrationStore.getState().session).toBeNull();
    expect(showToast).toHaveBeenCalledWith({
      type: "warning",
      title: "Registration session ended",
      message: "The local registration session does not match the server record.",
    });
  });

  it("redirects locked and expired verification sessions back to registration", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { ...pendingStatus, state: "LOCKED" },
    } as never);
    const locked = renderVerification();
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(ROUTES.REGISTER, { replace: true }),
    );
    locked.unmount();

    navigate.mockClear();
    showToast.mockClear();
    useRegistrationStore.getState().setSession(registration);
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockRejectedValueOnce(
      axiosError(410, "Verification session expired."),
    );
    renderVerification();

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(ROUTES.REGISTER, { replace: true }),
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "warning",
        title: "Registration session ended",
      }),
    );
  });

  it("renders a retry surface for transient registration-status failures", async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(axiosError(503, "Verification status unavailable."))
      .mockResolvedValueOnce({ data: pendingStatus } as never);

    renderVerification();

    expect(await screen.findByText("Verification status unavailable.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry session check" }));
    expect(await screen.findByLabelText("Verification code")).toBeVisible();
    expect(api.get).toHaveBeenCalledTimes(2);
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

  it("verifies a valid student OTP, establishes the session, and opens the student dashboard", async () => {
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

  it("routes a verified teacher to the teacher dashboard", async () => {
    const teacherRegistration = { ...registration, role: "TEACHER" as const };
    useRegistrationStore.getState().setSession(teacherRegistration);
    vi.mocked(api.get).mockResolvedValue({
      data: { ...pendingStatus, role: "TEACHER" },
    } as never);
    vi.mocked(api.post).mockResolvedValue({
      data: {
        message: "Account verified",
        access_token: "teacher-token",
        already_completed: false,
        user: {
          id: "teacher-1",
          first_name: "Grace",
          last_name: "Hopper",
          email: "ada@example.edu",
          role: "TEACHER",
          student_id: null,
          is_verified: true,
        },
      },
    } as never);

    renderVerification();
    const otp = await screen.findByLabelText("Verification code");
    fireEvent.change(otp, { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify account" }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(ROUTES.TEACHER_DASHBOARD, {
        replace: true,
      }),
    );
  });

  it("clears an invalid OTP and refreshes the remaining-attempt state", async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: pendingStatus } as never)
      .mockResolvedValueOnce({
        data: { ...pendingStatus, attempts_remaining: 3 },
      } as never);
    vi.mocked(api.post).mockRejectedValueOnce(
      axiosError(401, "Invalid verification code. 3 attempts remaining."),
    );

    renderVerification();
    const otp = await screen.findByLabelText("Verification code");
    fireEvent.change(otp, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify account" }));

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("Verification code")).toHaveValue("");
    expect(showToast).toHaveBeenCalledWith({
      type: "error",
      title: "Verification failed",
      message: "Invalid verification code. 3 attempts remaining.",
    });
  });

  it("redirects immediately when OTP verification reports an expired or locked session", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: pendingStatus } as never);
    vi.mocked(api.post).mockRejectedValueOnce(
      axiosError(423, "Too many invalid attempts."),
    );

    renderVerification();
    const otp = await screen.findByLabelText("Verification code");
    fireEvent.change(otp, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify account" }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(ROUTES.REGISTER, { replace: true }),
    );
    expect(useRegistrationStore.getState().session).toBeNull();
  });

  it("reloads status after a verification conflict without discarding the pending session", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: pendingStatus } as never);
    vi.mocked(api.post).mockRejectedValueOnce(
      axiosError(409, "Verification is already being processed."),
    );

    renderVerification();
    const otp = await screen.findByLabelText("Verification code");
    fireEvent.change(otp, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify account" }));

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(useRegistrationStore.getState().session).not.toBeNull();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", title: "Verification failed" }),
    );
  });

  it("resends a verification code, clears the old OTP, and refreshes server status", async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: pendingStatus } as never)
      .mockResolvedValueOnce({
        data: { ...pendingStatus, resends_remaining: 1, resend_available_in_seconds: 30 },
      } as never);
    vi.mocked(api.post).mockResolvedValueOnce({ data: { message: "Sent" } } as never);

    renderVerification();
    const otp = await screen.findByLabelText("Verification code");
    fireEvent.change(otp, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Send a new code" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(API_ROUTES.auth.resendOtp, {
        registration_id: REGISTRATION_ID,
      }),
    );
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("Verification code")).toHaveValue("");
    expect(showToast).toHaveBeenCalledWith({
      type: "success",
      title: "Code sent",
      message: "A new verification code has been sent.",
    });
  });

  it("keeps the pending registration recoverable when resend fails", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: pendingStatus } as never);
    vi.mocked(api.post).mockRejectedValueOnce(
      axiosError(503, "New code could not be delivered."),
    );

    renderVerification();
    await screen.findByLabelText("Verification code");
    fireEvent.click(screen.getByRole("button", { name: "Send a new code" }));

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(useRegistrationStore.getState().session).not.toBeNull();
    expect(showToast).toHaveBeenCalledWith({
      type: "error",
      title: "Could not resend code",
      message: "New code could not be delivered.",
    });
  });

  it("disables resend while the server cooldown is active or the resend budget is exhausted", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { ...pendingStatus, resend_available_in_seconds: 5 },
    } as never);
    const cooldown = renderVerification();
    expect(
      await screen.findByRole("button", { name: /Send a new code in 5s/ }),
    ).toBeDisabled();
    cooldown.unmount();

    useRegistrationStore.getState().setSession(registration);
    vi.mocked(api.get).mockReset();
    vi.mocked(api.get).mockResolvedValue({
      data: { ...pendingStatus, resends_remaining: 0 },
    } as never);
    renderVerification();
    expect(
      await screen.findByRole("button", { name: "Resend limit reached" }),
    ).toBeDisabled();
  });

  it("cancels a pending registration and returns to registration", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: pendingStatus } as never);
    vi.mocked(api.delete).mockResolvedValue({ data: { message: "Cancelled" } } as never);

    renderVerification();
    await screen.findByLabelText("Verification code");
    fireEvent.click(screen.getByRole("button", { name: "Back to registration" }));

    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith(
        API_ROUTES.auth.cancelRegistration(REGISTRATION_ID),
        { skipGlobalToast: true },
      ),
    );
    expect(useRegistrationStore.getState().session).toBeNull();
    expect(navigate).toHaveBeenCalledWith(ROUTES.REGISTER, { replace: true });
  });

  it("treats an already-expired cancellation as complete but preserves other cancellation errors", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: pendingStatus } as never);
    vi.mocked(api.delete).mockRejectedValueOnce(
      axiosError(410, "Verification session expired."),
    );

    const expired = renderVerification();
    await screen.findByLabelText("Verification code");
    fireEvent.click(screen.getByRole("button", { name: "Back to registration" }));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(ROUTES.REGISTER, { replace: true }),
    );
    expired.unmount();

    navigate.mockClear();
    showToast.mockClear();
    useRegistrationStore.getState().setSession(registration);
    vi.mocked(api.get).mockReset();
    vi.mocked(api.delete).mockReset();
    vi.mocked(api.get).mockResolvedValue({ data: pendingStatus } as never);
    vi.mocked(api.delete).mockRejectedValueOnce(
      axiosError(503, "Cancellation service unavailable."),
    );

    renderVerification();
    await screen.findByLabelText("Verification code");
    fireEvent.click(screen.getByRole("button", { name: "Back to registration" }));
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        type: "error",
        title: "Registration was not cancelled",
        message: "Cancellation service unavailable.",
      }),
    );
    expect(useRegistrationStore.getState().session).not.toBeNull();
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
