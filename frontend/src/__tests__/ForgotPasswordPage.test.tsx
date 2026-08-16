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

const RESET_ID = `rst_${"R".repeat(40)}`;
const resetSession = {
  resetId: RESET_ID,
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

function axiosError(status: number, detail: string) {
  return {
    isAxiosError: true,
    message: "Request failed",
    response: { status, data: { detail } },
  };
}

function renderRecovery(entry: string = ROUTES.FORGOT_PASSWORD) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );
}

async function enterResetStep() {
  usePasswordResetStore.getState().setSession(resetSession);
  vi.mocked(api.get).mockResolvedValue({ data: pendingResetStatus } as never);
  vi.mocked(api.post).mockResolvedValueOnce({
    data: { message: "Code verified", reset_token: "unit-test-reset-token" },
  } as never);

  renderRecovery();
  const otp = await screen.findByLabelText("Reset code");
  fireEvent.change(otp, { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify reset code" }));
  expect(await screen.findByLabelText("New password")).toBeVisible();
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
  });

  it("surfaces a controlled reset-request API failure and keeps the request form usable", async () => {
    vi.mocked(api.post).mockRejectedValueOnce(
      axiosError(503, "Password-reset service is temporarily unavailable."),
    );
    renderRecovery();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "ada@example.edu" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset code" }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        type: "error",
        title: "Request failed",
        message: "Password-reset service is temporarily unavailable.",
      }),
    );
    expect(screen.getByRole("button", { name: "Send reset code" })).toBeEnabled();
    expect(usePasswordResetStore.getState().session).toBeNull();
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
  });

  it("rejects a persisted reset session that does not match the server record", async () => {
    usePasswordResetStore.getState().setSession(resetSession);
    vi.mocked(api.get).mockResolvedValue({
      data: { ...pendingResetStatus, email: "different@example.edu" },
    } as never);

    renderRecovery();

    expect(
      await screen.findByText(
        "The local reset session does not match the server record.",
      ),
    ).toBeVisible();
    expect(usePasswordResetStore.getState().session).toBeNull();
  });

  it("clears locked and completed persisted reset sessions", async () => {
    for (const state of ["LOCKED", "COMPLETED"] as const) {
      usePasswordResetStore.getState().clearSession();
      usePasswordResetStore.getState().setSession(resetSession);
      vi.mocked(api.get).mockReset();
      vi.mocked(api.get).mockResolvedValue({
        data: { ...pendingResetStatus, state },
      } as never);

      const view = renderRecovery();
      await waitFor(() => expect(usePasswordResetStore.getState().session).toBeNull());
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "warning", title: "Reset session ended" }),
      );
      view.unmount();
      showToast.mockClear();
    }
  });

  it("clears an expired persisted reset and lets the user request a new code", async () => {
    usePasswordResetStore.getState().setSession(resetSession);
    vi.mocked(api.get).mockRejectedValueOnce(
      axiosError(410, "Password-reset session expired."),
    );

    renderRecovery();

    expect(await screen.findByRole("button", { name: "Send reset code" })).toBeEnabled();
    expect(usePasswordResetStore.getState().session).toBeNull();
    expect(showToast).toHaveBeenCalledWith({
      type: "warning",
      title: "Reset session expired",
      message: "Request a new password-reset code.",
    });
  });

  it("renders a retry state for transient status failures and recovers on retry", async () => {
    usePasswordResetStore.getState().setSession(resetSession);
    vi.mocked(api.get)
      .mockRejectedValueOnce(axiosError(503, "Reset status unavailable."))
      .mockResolvedValueOnce({ data: pendingResetStatus } as never);

    renderRecovery();

    expect(await screen.findByText("Reset status unavailable.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry session check" }));
    expect(await screen.findByLabelText("Reset code")).toBeVisible();
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it("recovers a valid reset session from the URL fragment without persisting a token", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: pendingResetStatus } as never);

    renderRecovery(`${ROUTES.FORGOT_PASSWORD}#reset_id=${RESET_ID}`);

    expect(await screen.findByLabelText("Reset code")).toBeVisible();
    expect(usePasswordResetStore.getState().session).toEqual(
      expect.objectContaining({ resetId: RESET_ID, email: "ada@example.edu" }),
    );
    expect(navigate).toHaveBeenCalledWith(ROUTES.FORGOT_PASSWORD, { replace: true });
  });

  it("rejects an inconsistent recovery fragment response and returns to a clean request flow", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { ...pendingResetStatus, reset_id: `rst_${"X".repeat(40)}` },
    } as never);

    renderRecovery(`${ROUTES.FORGOT_PASSWORD}#reset_id=${RESET_ID}`);

    expect(await screen.findByRole("button", { name: "Send reset code" })).toBeEnabled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "warning",
        title: "Reset session unavailable",
      }),
    );
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

  it("clears a locked reset session when OTP verification is rejected", async () => {
    usePasswordResetStore.getState().setSession(resetSession);
    vi.mocked(api.get).mockResolvedValue({ data: pendingResetStatus } as never);
    vi.mocked(api.post).mockRejectedValueOnce(
      axiosError(423, "Too many invalid attempts."),
    );

    renderRecovery();
    const otp = await screen.findByLabelText("Reset code");
    fireEvent.change(otp, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify reset code" }));

    expect(await screen.findByRole("button", { name: "Send reset code" })).toBeEnabled();
    expect(usePasswordResetStore.getState().session).toBeNull();
    expect(showToast).toHaveBeenCalledWith({
      type: "error",
      title: "Verification failed",
      message: "Too many invalid attempts.",
    });
  });

  it("blocks weak and mismatched passwords after a valid reset code", async () => {
    await enterResetStep();

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "warning", title: "Weak password" }),
    );

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "NewPassword123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "DifferentPassword123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "warning", title: "Passwords do not match" }),
    );
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("returns to the request step when the final reset token is rejected", async () => {
    await enterResetStep();
    vi.mocked(api.post).mockRejectedValueOnce(
      axiosError(401, "Invalid or expired reset session."),
    );

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "NewPassword123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "NewPassword123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByRole("button", { name: "Send reset code" })).toBeEnabled();
    expect(usePasswordResetStore.getState().session).toBeNull();
    expect(showToast).toHaveBeenCalledWith({
      type: "error",
      title: "Reset failed",
      message: "Invalid or expired reset session.",
    });
  });

  it("cancels an active reset session and starts over", async () => {
    usePasswordResetStore.getState().setSession(resetSession);
    vi.mocked(api.get).mockResolvedValue({ data: pendingResetStatus } as never);
    vi.mocked(api.delete).mockResolvedValue({ data: { message: "Cancelled" } } as never);

    renderRecovery();
    await screen.findByLabelText("Reset code");
    fireEvent.click(screen.getByRole("button", { name: "Cancel and start over" }));

    expect(await screen.findByRole("button", { name: "Send reset code" })).toBeEnabled();
    expect(api.delete).toHaveBeenCalledWith(
      API_ROUTES.auth.cancelPasswordReset(RESET_ID),
      { skipGlobalToast: true },
    );
    expect(usePasswordResetStore.getState().session).toBeNull();
  });

  it("treats an already-expired cancellation as locally complete and returns to sign in", async () => {
    usePasswordResetStore.getState().setSession(resetSession);
    vi.mocked(api.get).mockResolvedValue({ data: pendingResetStatus } as never);
    vi.mocked(api.delete).mockRejectedValueOnce(
      axiosError(410, "Reset session expired."),
    );

    renderRecovery();
    await screen.findByLabelText("Reset code");
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(ROUTES.LOGIN));
    expect(usePasswordResetStore.getState().session).toBeNull();
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
    expect(navigate).toHaveBeenCalledWith(ROUTES.LOGIN, { replace: true });
  });
});
