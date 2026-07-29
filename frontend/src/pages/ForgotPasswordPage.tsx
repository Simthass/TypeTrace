import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  AuthButton,
  AuthField,
  AuthForm,
  AuthMessage,
  AuthPanel,
} from "../components/auth/AuthPanel";
import { useToast } from "../components/ui/ToastContext";
import { API_ROUTES } from "../constants/apiRoutes";
import { ROUTES } from "../constants/routes";
import {
  api,
  getApiErrorMessage,
  getApiStatusCode,
} from "../lib/api";
import {
  isStrongEnoughPassword,
  isValidEmail,
  isValidOtp,
  normalizeEmail,
} from "../lib/edgeCases";
import { usePasswordResetStore } from "../store/passwordResetStore";
import { colors } from "../styles/colors";

interface ResetRequestResponse {
  message: string;
  reset_id: string;
  expires_in_seconds: number;
}

interface ResetVerifyResponse {
  message: string;
  reset_token: string;
}

interface ResetStatusResponse {
  reset_id: string;
  email: string;
  state: "OTP_PENDING" | "TOKEN_ISSUED" | "CLAIMED" | "LOCKED" | "COMPLETED";
  expires_in_seconds: number;
  attempts_remaining: number;
}

type Step = "request" | "verify" | "reset";

const RESET_ID_PATTERN = /^rst_[A-Za-z0-9_-]{32,160}$/;

function readRecoveryResetId(hash: string): string | null {
  if (!hash.startsWith("#")) return null;
  const value = new URLSearchParams(hash.slice(1)).get("reset_id");
  if (!value || !RESET_ID_PATTERN.test(value)) return null;
  return value;
}

export default function ForgotPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const session = usePasswordResetStore((state) => state.session);
  const setSession = usePasswordResetStore((state) => state.setSession);
  const updateExpiry = usePasswordResetStore((state) => state.updateExpiry);
  const clearSession = usePasswordResetStore((state) => state.clearSession);
  const recoveryResetId = useMemo(
    () => readRecoveryResetId(location.hash),
    [location.hash],
  );
  const recoveryAttemptedFor = useRef<string | null>(null);

  const [step, setStep] = useState<Step>(
    session && session.expiresAt > Date.now() ? "verify" : "request",
  );
  const [email, setEmail] = useState(session?.email ?? "");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(
    Boolean(session || recoveryResetId),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const resetId = session?.resetId ?? "";
  const sessionEmail = session?.email ?? "";

  const clearLocalReset = useCallback(() => {
    clearSession();
    setStep("request");
    setOtp("");
    setResetToken("");
    setNewPassword("");
    setConfirmPassword("");
    setSessionError(null);
  }, [clearSession]);

  const loadResetStatus = useCallback(async (signal?: AbortSignal) => {
    if (!resetId || !sessionEmail) {
      return;
    }

    setIsCheckingSession(true);
    setSessionError(null);
    try {
      const response = await api.get<ResetStatusResponse>(
        API_ROUTES.auth.passwordResetStatus(resetId),
        { skipGlobalToast: true, signal },
      );

      if (signal?.aborted) return;

      const value = response.data;
      if (
        value.reset_id !== resetId ||
        value.email.toLowerCase() !== sessionEmail.toLowerCase()
      ) {
        clearLocalReset();
        setSessionError("The local reset session does not match the server record.");
        return;
      }
      if (value.state === "LOCKED" || value.state === "COMPLETED") {
        clearLocalReset();
        showToast({
          type: "warning",
          title: "Reset session ended",
          message:
            value.state === "LOCKED"
              ? "Too many invalid codes were entered. Start again."
              : "This password reset has already completed.",
        });
        return;
      }
      updateExpiry(Date.now() + value.expires_in_seconds * 1000);
      setEmail(value.email);
      // Reset JWTs are intentionally not persisted. After a reload, the user
      // re-enters the same OTP and receives a token with the same one-time JTI.
      setStep("verify");
    } catch (error) {
      if (signal?.aborted) return;

      const statusCode = getApiStatusCode(error);
      if (statusCode === 404 || statusCode === 410) {
        clearLocalReset();
        showToast({
          type: "warning",
          title: "Reset session expired",
          message: "Request a new password-reset code.",
        });
        return;
      }
      setSessionError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) {
        setIsCheckingSession(false);
      }
    }
  }, [
    clearLocalReset,
    resetId,
    sessionEmail,
    showToast,
    updateExpiry,
  ]);

  useEffect(() => {
    if (session || !recoveryResetId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (recoveryAttemptedFor.current === recoveryResetId) return;

      recoveryAttemptedFor.current = recoveryResetId;
      setIsCheckingSession(true);

      const recover = async () => {
        try {
          const response = await api.get<ResetStatusResponse>(
            API_ROUTES.auth.passwordResetStatus(recoveryResetId),
            {
              skipGlobalToast: true,
              skipAuthRedirect: true,
              signal: controller.signal,
            },
          );

          if (controller.signal.aborted) return;

          const value = response.data;

          if (
            value.reset_id !== recoveryResetId ||
            value.expires_in_seconds <= 0
          ) {
            throw new Error(
              "Password-reset recovery response was inconsistent.",
            );
          }

          if (value.state === "LOCKED" || value.state === "COMPLETED") {
            clearSession();
            showToast({
              type: "warning",
              title: "Reset session ended",
              message:
                value.state === "LOCKED"
                  ? "Too many invalid codes were entered. Start again."
                  : "This password reset has already completed.",
            });
            navigate(
              value.state === "COMPLETED"
                ? ROUTES.LOGIN
                : ROUTES.FORGOT_PASSWORD,
              { replace: true },
            );
            return;
          }

          setSession({
            resetId: value.reset_id,
            email: value.email,
            expiresAt: Date.now() + value.expires_in_seconds * 1000,
          });
          setEmail(value.email);
          setStep("verify");
          navigate(ROUTES.FORGOT_PASSWORD, { replace: true });
        } catch (error) {
          if (controller.signal.aborted) return;

          clearLocalReset();
          const statusCode = getApiStatusCode(error);
          showToast({
            type: "warning",
            title: "Reset session unavailable",
            message:
              statusCode === 404 || statusCode === 410
                ? "The reset link expired. Request a new password-reset code."
                : getApiErrorMessage(error),
          });
          navigate(ROUTES.FORGOT_PASSWORD, { replace: true });
        } finally {
          if (!controller.signal.aborted) {
            setIsCheckingSession(false);
          }
        }
      };

      void recover();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    clearLocalReset,
    clearSession,
    navigate,
    recoveryResetId,
    session,
    setSession,
    showToast,
  ]);

  useEffect(() => {
    if (!resetId) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadResetStatus(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadResetStatus, resetId]);

  const cleanEmail = normalizeEmail(email);

  const requestCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidEmail(cleanEmail)) {
      showToast({
        type: "warning",
        title: "Invalid email",
        message: "Enter a valid email address.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post<ResetRequestResponse>(
        API_ROUTES.auth.passwordResetRequest,
        { email: cleanEmail },
      );
      setSession({
        resetId: response.data.reset_id,
        email: cleanEmail,
        expiresAt: Date.now() + response.data.expires_in_seconds * 1000,
      });
      setStep("verify");
      setOtp("");
      showToast({
        type: "info",
        title: "Request received",
        message: response.data.message,
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "Request failed",
        message: getApiErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanOtp = otp.trim();
    if (!resetId || !isValidOtp(cleanOtp)) {
      showToast({
        type: "warning",
        title: "Invalid reset code",
        message: "Enter the 6-digit reset code.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post<ResetVerifyResponse>(
        API_ROUTES.auth.passwordResetVerify,
        { reset_id: resetId, otp: cleanOtp },
      );
      setResetToken(response.data.reset_token);
      setStep("reset");
      showToast({
        type: "success",
        title: "Code verified",
        message: response.data.message,
      });
    } catch (error) {
      const statusCode = getApiStatusCode(error);
      if (statusCode === 410 || statusCode === 423) {
        clearLocalReset();
      }
      setOtp("");
      showToast({
        type: "error",
        title: "Verification failed",
        message: getApiErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resetToken) {
      setStep("verify");
      showToast({
        type: "warning",
        title: "Reset token required",
        message: "Verify the reset code again before choosing a password.",
      });
      return;
    }
    if (!isStrongEnoughPassword(newPassword)) {
      showToast({
        type: "warning",
        title: "Weak password",
        message:
          "Use 8–128 characters with at least one letter and one number.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast({
        type: "warning",
        title: "Passwords do not match",
        message: "Enter the same password in both fields.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(API_ROUTES.auth.passwordResetConfirm, {
        reset_token: resetToken,
        new_password: newPassword,
      });
      clearSession();
      showToast({
        type: "success",
        title: "Password updated",
        message:
          "Sign in with your new password. Previous sessions are no longer valid.",
      });
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (error) {
      const statusCode = getApiStatusCode(error);
      if (statusCode === 401 || statusCode === 410) {
        clearLocalReset();
      }
      showToast({
        type: "error",
        title: "Reset failed",
        message: getApiErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelReset = async (navigateToLogin: boolean) => {
    if (!resetId) {
      clearLocalReset();
      if (navigateToLogin) navigate(ROUTES.LOGIN);
      return;
    }

    setIsCancelling(true);
    try {
      await api.delete(API_ROUTES.auth.cancelPasswordReset(resetId), {
        skipGlobalToast: true,
      });
      clearLocalReset();
      if (navigateToLogin) navigate(ROUTES.LOGIN);
    } catch (error) {
      const statusCode = getApiStatusCode(error);
      if (statusCode === 404 || statusCode === 410) {
        clearLocalReset();
        if (navigateToLogin) navigate(ROUTES.LOGIN);
        return;
      }
      showToast({
        type: "error",
        title: "Reset session was not cancelled",
        message: getApiErrorMessage(error),
      });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <AuthPanel
      eyebrow="Account recovery"
      title="Reset your TypeTrace password."
      description="The reset session is locked to the requested account and the final reset token can be used only once."
      sideTitle="Security-sensitive changes invalidate old sessions."
      sideDescription="After a successful password reset, previously issued access tokens are rejected."
    >
      {isCheckingSession ? (
        <AuthMessage type="info">Checking the reset session…</AuthMessage>
      ) : sessionError ? (
        <div className="grid gap-4">
          <AuthMessage type="error">{sessionError}</AuthMessage>
          <button
            type="button"
            onClick={() => void loadResetStatus()}
            className="h-11 rounded-md px-4 text-sm font-semibold text-white"
            style={{ background: colors.brand }}
          >
            Retry session check
          </button>
        </div>
      ) : (
        <>
          {step === "request" && (
            <AuthForm onSubmit={requestCode}>
              <AuthField
                label="Email address"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
              <AuthButton isLoading={isSubmitting}>Send reset code</AuthButton>
            </AuthForm>
          )}

          {step === "verify" && (
            <AuthForm onSubmit={verifyCode}>
              <AuthField
                label="Email address"
                type="email"
                value={sessionEmail || cleanEmail}
                readOnly
                disabled
                aria-describedby="locked-reset-email-help"
              />
              <p
                id="locked-reset-email-help"
                className="-mt-2 text-xs"
                style={{ color: colors.text.muted }}
              >
                This reset session is locked to this address.
              </p>
              <AuthField
                label="Reset code"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(event) =>
                  setOtp(event.target.value.replace(/\D/g, ""))
                }
                autoComplete="one-time-code"
              />
              <AuthButton isLoading={isSubmitting}>
                Verify reset code
              </AuthButton>
            </AuthForm>
          )}

          {step === "reset" && (
            <AuthForm onSubmit={resetPassword}>
              <AuthField
                label="Email address"
                type="email"
                value={sessionEmail || cleanEmail}
                readOnly
                disabled
              />
              <AuthField
                label="New password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
              <AuthField
                label="Confirm new password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
              <AuthButton isLoading={isSubmitting}>Update password</AuthButton>
            </AuthForm>
          )}

          <div className="mt-5 grid gap-2 text-center text-sm">
            {resetId && (
              <button
                type="button"
                onClick={() => void cancelReset(false)}
                disabled={isCancelling || isSubmitting}
                className="font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                style={{ color: colors.text.muted }}
              >
                {isCancelling ? "Cancelling…" : "Cancel and start over"}
              </button>
            )}
            <button
              type="button"
              onClick={() => void cancelReset(true)}
              disabled={isCancelling || isSubmitting}
              className="font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              style={{ color: colors.brand }}
            >
              Back to sign in
            </button>
          </div>
        </>
      )}
    </AuthPanel>
  );
}
