import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import { API_ROUTES } from "../constants/apiRoutes";
import { ROUTES } from "../constants/routes";
import { api } from "../lib/api";
import { usePasswordResetStore } from "../store/passwordResetStore";

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

const resetSession = {
  resetId: "rst_12345678901234567890123456789012",
  email: "ada@example.edu",
  expiresAt: Date.now() + 600_000,
};

const pendingResetStatus = {
  reset_id: resetSession.resetId,
  email: resetSession.email,
  state: "OTP_PENDING" as const,
  expires_in_seconds: 600,
  attempts_remaining: 4,
};

function renderRecovery() {
  return render(
    <MemoryRouter initialEntries={[ROUTES.FORGOT_PASSWORD]}>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    usePasswordResetStore.getState().clearSession();
  });

  it("rejects an invalid recovery email locally without creating a reset session", () => {
    renderRecovery();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "not-an-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset code" }));

    expect(screen.getByLabelText("Email address")).toBeInvalid();
    expect(api.post).not.toHaveBeenCalled();
    expect(usePasswordResetStore.getState().session).toBeNull();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("normalizes a valid email, stores the reset session, and enters OTP verification", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        message: "Reset code sent",
        reset_id: resetSession.resetId,
        expires_in_seconds: 600,
      },
    } as never);
    vi.mocked(api.get).mockResolvedValue({ data: pendingResetStatus } as never);

    renderRecovery();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "  ADA@EXAMPLE.EDU  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset code" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(API_ROUTES.auth.passwordResetRequest, {
        email: "ada@example.edu",
      }),
    );
    expect(usePasswordResetStore.getState().session).toEqual(
      expect.objectContaining({
        resetId: resetSession.resetId,
        email: "ada@example.edu",
        expiresAt: expect.any(Number),
      }),
    );
    expect(await screen.findByLabelText("Reset code")).toBeVisible();
    expect(showToast).toHaveBeenCalledWith({
      type: "info",
      title: "Request received",
      message: "Reset code sent",
    });
  });

  it("rejects a malformed reset OTP locally after validating the persisted reset session", async () => {
    usePasswordResetStore.getState().setSession(resetSession);
    vi.mocked(api.get).mockResolvedValue({ data: pendingResetStatus } as never);

    renderRecovery();

    const otp = await screen.findByLabelText("Reset code");
    fireEvent.change(otp, { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify reset code" }));

    expect(api.post).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({
      type: "warning",
      title: "Invalid reset code",
      message: "Enter the 6-digit reset code.",
    });
  });

  it("completes OTP verification and a strong password reset, then returns to sign in", async () => {
    usePasswordResetStore.getState().setSession(resetSession);
    vi.mocked(api.get).mockResolvedValue({ data: pendingResetStatus } as never);
    vi.mocked(api.post)
      .mockResolvedValueOnce({
        data: {
          message: "Reset code verified",
          reset_token: "unit-test-reset-token",
        },
      } as never)
      .mockResolvedValueOnce({ data: { message: "Password updated" } } as never);

    renderRecovery();

    const otp = await screen.findByLabelText("Reset code");
    fireEvent.change(otp, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify reset code" }));

    expect(await screen.findByLabelText("New password")).toBeVisible();
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "NewPassword123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "NewPassword123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenNthCalledWith(
        1,
        API_ROUTES.auth.passwordResetVerify,
        { reset_id: resetSession.resetId, otp: "123456" },
      ),
    );
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      API_ROUTES.auth.passwordResetConfirm,
      {
        reset_token: "unit-test-reset-token",
        new_password: "NewPassword123!",
      },
    );
    expect(usePasswordResetStore.getState().session).toBeNull();
    expect(showToast).toHaveBeenCalledWith({
      type: "success",
      title: "Password updated",
      message:
        "Sign in with your new password. Previous sessions are no longer valid.",
    });
    expect(navigate).toHaveBeenCalledWith(ROUTES.LOGIN, { replace: true });
  });
});
