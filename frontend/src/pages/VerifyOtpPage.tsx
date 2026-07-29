import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";

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
import { isValidOtp } from "../lib/edgeCases";
import { useAuthStore, type AuthUser, type UserRole } from "../store/authStore";
import { useRegistrationStore } from "../store/registrationStore";
import { colors } from "../styles/colors";

interface VerifyOtpResponse {
  message: string;
  access_token: string;
  user: AuthUser;
  already_completed: boolean;
}

interface RegistrationStatusResponse {
  registration_id: string;
  email: string;
  role: UserRole;
  state: "PENDING" | "CLAIMED" | "LOCKED" | "COMPLETED";
  expires_in_seconds: number;
  attempts_remaining: number;
  resends_remaining: number;
  resend_available_in_seconds: number;
}

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const session = useRegistrationStore((state) => state.session);
  const updateExpiry = useRegistrationStore((state) => state.updateExpiry);
  const clearSession = useRegistrationStore((state) => state.clearSession);
  const { showToast } = useToast();

  const [otp, setOtp] = useState("");
  const [statusInfo, setStatusInfo] =
    useState<RegistrationStatusResponse | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const registrationId = session?.registrationId ?? "";
  const sessionEmail = session?.email ?? "";
  const sessionRole = session?.role ?? "STUDENT";

  const redirectToRegistration = useCallback(
    (message: string) => {
      clearSession();
      showToast({
        type: "warning",
        title: "Registration session ended",
        message,
      });
      navigate(ROUTES.REGISTER, { replace: true });
    },
    [clearSession, navigate, showToast],
  );

  const loadStatus = useCallback(async (signal?: AbortSignal) => {
    if (!registrationId || !sessionEmail) return;

    setIsLoadingSession(true);
    setSessionError(null);
    try {
      const response = await api.get<RegistrationStatusResponse>(
        API_ROUTES.auth.registrationStatus(registrationId),
        { skipGlobalToast: true, signal },
      );

      if (signal?.aborted) return;

      const value = response.data;

      if (
        value.registration_id !== registrationId ||
        value.email.toLowerCase() !== sessionEmail.toLowerCase() ||
        value.role !== sessionRole
      ) {
        redirectToRegistration(
          "The local registration session does not match the server record.",
        );
        return;
      }

      if (value.state === "COMPLETED") {
        clearSession();
        showToast({
          type: "info",
          title: "Account already verified",
          message: "Sign in with the password used during registration.",
        });
        navigate(ROUTES.LOGIN, { replace: true });
        return;
      }

      if (value.state === "LOCKED") {
        redirectToRegistration(
          "Too many invalid codes were entered. Complete registration again.",
        );
        return;
      }

      setStatusInfo(value);
      setCooldownSeconds(value.resend_available_in_seconds);
      updateExpiry(Date.now() + value.expires_in_seconds * 1000);
    } catch (error) {
      if (signal?.aborted) return;

      const statusCode = getApiStatusCode(error);
      if (statusCode === 404 || statusCode === 410) {
        redirectToRegistration(
          "The verification session expired. Complete registration again.",
        );
        return;
      }
      setSessionError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) {
        setIsLoadingSession(false);
      }
    }
  }, [
    clearSession,
    navigate,
    redirectToRegistration,
    registrationId,
    sessionEmail,
    sessionRole,
    showToast,
    updateExpiry,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadStatus(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadStatus]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((current) => Math.max(current - 1, 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  const lockedEmail = useMemo(
    () => statusInfo?.email ?? session?.email ?? "",
    [session?.email, statusInfo?.email],
  );

  if (!session) return null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanOtp = otp.trim();
    if (!isValidOtp(cleanOtp)) {
      showToast({
        type: "warning",
        title: "Invalid code",
        message: "Enter the 6-digit verification code.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post<VerifyOtpResponse>(
        API_ROUTES.auth.verifyOtp,
        {
          registration_id: registrationId,
          otp: cleanOtp,
        },
      );
      login(response.data.user, response.data.access_token);
      clearSession();
      showToast({
        type: "success",
        title: "Account verified",
        message: response.data.message,
      });
      navigate(
        response.data.user.role === "TEACHER"
          ? ROUTES.TEACHER_DASHBOARD
          : ROUTES.DASHBOARD,
        { replace: true },
      );
    } catch (error) {
      const statusCode = getApiStatusCode(error);
      if (statusCode === 410 || statusCode === 423) {
        redirectToRegistration(getApiErrorMessage(error));
        return;
      }
      showToast({
        type: "error",
        title: "Verification failed",
        message: getApiErrorMessage(error),
      });
      if (statusCode === 401) {
        setOtp("");
      }
      if (statusCode === 401 || statusCode === 409) {
        await loadStatus();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resend = async () => {
    if (
      !statusInfo ||
      statusInfo.state !== "PENDING" ||
      statusInfo.resends_remaining <= 0 ||
      cooldownSeconds > 0
    ) {
      return;
    }

    setIsResending(true);
    try {
      await api.post(API_ROUTES.auth.resendOtp, {
        registration_id: registrationId,
      });
      setOtp("");
      showToast({
        type: "success",
        title: "Code sent",
        message: "A new verification code has been sent.",
      });
      await loadStatus();
    } catch (error) {
      showToast({
        type: "error",
        title: "Could not resend code",
        message: getApiErrorMessage(error),
      });
      await loadStatus();
    } finally {
      setIsResending(false);
    }
  };

  const cancel = async () => {
    setIsCancelling(true);
    try {
      await api.delete(API_ROUTES.auth.cancelRegistration(registrationId), {
        skipGlobalToast: true,
      });
      clearSession();
      navigate(ROUTES.REGISTER, { replace: true });
    } catch (error) {
      const statusCode = getApiStatusCode(error);
      if (statusCode === 404 || statusCode === 410) {
        clearSession();
        navigate(ROUTES.REGISTER, { replace: true });
        return;
      }
      showToast({
        type: "error",
        title: "Registration was not cancelled",
        message: getApiErrorMessage(error),
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const resendLabel =
    cooldownSeconds > 0
      ? `Send a new code in ${cooldownSeconds}s`
      : statusInfo?.resends_remaining === 0
        ? "Resend limit reached"
        : "Send a new code";

  return (
    <AuthPanel
      eyebrow="Verify account"
      title="Confirm your TypeTrace workspace."
      description="Enter the 6-digit code sent to the locked registration email."
      sideTitle="Verification protects the account lifecycle."
      sideDescription="The verification session is bound to the original registration and cannot be redirected to another email address."
    >
      {isLoadingSession ? (
        <AuthMessage type="info">Checking the registration session…</AuthMessage>
      ) : sessionError ? (
        <div className="grid gap-4">
          <AuthMessage type="error">{sessionError}</AuthMessage>
          <button
            type="button"
            onClick={() => void loadStatus()}
            className="h-11 rounded-md px-4 text-sm font-semibold text-white"
            style={{ background: colors.brand }}
          >
            Retry session check
          </button>
        </div>
      ) : (
        <AuthForm onSubmit={submit}>
          <AuthField
            label="Email address"
            type="email"
            value={lockedEmail}
            readOnly
            disabled
            aria-describedby="locked-registration-email-help"
          />
          <p
            id="locked-registration-email-help"
            className="-mt-2 text-xs"
            style={{ color: colors.text.muted }}
          >
            This code was sent to this address. It cannot be changed during
            verification.
          </p>

          <AuthField
            label="Verification code"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(event) =>
              setOtp(event.target.value.replace(/\D/g, ""))
            }
            placeholder="000000"
            autoComplete="one-time-code"
          />

          <AuthButton isLoading={isSubmitting}>Verify account</AuthButton>

          <button
            type="button"
            onClick={() => void resend()}
            disabled={
              isResending ||
              isCancelling ||
              statusInfo?.state !== "PENDING" ||
              (statusInfo?.resends_remaining ?? 0) <= 0 ||
              cooldownSeconds > 0
            }
            className="text-center text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            style={{ color: colors.brand }}
          >
            {isResending ? "Sending new code…" : resendLabel}
          </button>

          <button
            type="button"
            onClick={() => void cancel()}
            disabled={isCancelling || isResending || isSubmitting}
            className="text-center text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            style={{ color: colors.text.muted }}
          >
            {isCancelling ? "Cancelling…" : "Back to registration"}
          </button>
        </AuthForm>
      )}
    </AuthPanel>
  );
}
