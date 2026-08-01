import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";

import { API_ROUTES } from "../../constants/apiRoutes";
import { ROUTES } from "../../constants/routes";
import { api, getApiErrorMessage, getApiStatusCode } from "../../lib/api";
import type { UserRole } from "../../store/authStore";
import { useRegistrationStore } from "../../store/registrationStore";
import { useToast } from "../ui/ToastContext";

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

const REGISTRATION_ID_PATTERN = /^reg_[A-Za-z0-9_-]{32,160}$/;

function readRecoveryRegistrationId(hash: string): string | null {
  if (!hash.startsWith("#")) return null;
  const value = new URLSearchParams(hash.slice(1)).get("registration_id");
  if (!value || !REGISTRATION_ID_PATTERN.test(value)) return null;
  return value;
}

export default function RegistrationSessionGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = useRegistrationStore((state) => state.session);
  const setSession = useRegistrationStore((state) => state.setSession);
  const clearSession = useRegistrationStore((state) => state.clearSession);
  const { showToast } = useToast();
  const directAccessNotified = useRef(false);
  const recoveryAttemptedFor = useRef<string | null>(null);
  const [clockNow, setClockNow] = useState<number | null>(null);

  const recoveryRegistrationId = useMemo(
    () => readRecoveryRegistrationId(location.hash),
    [location.hash],
  );

  useEffect(() => {
    let expiryTimer: number | null = null;
    const initialTimer = window.setTimeout(() => {
      const now = Date.now();
      setClockNow(now);

      if (session?.expiresAt && Number.isFinite(session.expiresAt)) {
        const remaining = Math.max(0, session.expiresAt - now + 25);
        expiryTimer = window.setTimeout(() => {
          setClockNow(Date.now());
        }, Math.min(remaining, 2_147_483_647));
      }
    }, 0);

    return () => {
      window.clearTimeout(initialTimer);
      if (expiryTimer !== null) window.clearTimeout(expiryTimer);
    };
  }, [session?.expiresAt]);

  const hasValidShape = Boolean(
    session &&
      REGISTRATION_ID_PATTERN.test(session.registrationId) &&
      session.email.trim().length > 0 &&
      (session.role === "STUDENT" || session.role === "TEACHER") &&
      Number.isFinite(session.expiresAt),
  );
  const isExpired = Boolean(
    hasValidShape &&
      clockNow !== null &&
      session &&
      session.expiresAt <= clockNow,
  );
  const isValid = Boolean(hasValidShape && clockNow !== null && !isExpired);

  useEffect(() => {
    if (clockNow === null || isValid || !recoveryRegistrationId) return;
    if (recoveryAttemptedFor.current === recoveryRegistrationId) return;

    recoveryAttemptedFor.current = recoveryRegistrationId;
    const controller = new AbortController();

    const recover = async () => {
      try {
        const response = await api.get<RegistrationStatusResponse>(
          API_ROUTES.auth.registrationStatus(recoveryRegistrationId),
          {
            skipGlobalToast: true,
            skipAuthRedirect: true,
            signal: controller.signal,
          },
        );
        if (controller.signal.aborted) return;

        const value = response.data;
        if (
          value.registration_id !== recoveryRegistrationId ||
          value.expires_in_seconds <= 0
        ) {
          throw new Error("Registration recovery response was inconsistent.");
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
          clearSession();
          showToast({
            type: "warning",
            title: "Registration session locked",
            message: "Start registration again to receive a new code.",
          });
          navigate(ROUTES.REGISTER, { replace: true });
          return;
        }

        setSession({
          registrationId: value.registration_id,
          email: value.email,
          role: value.role,
          expiresAt: Date.now() + value.expires_in_seconds * 1000,
        });
        navigate(ROUTES.VERIFY_OTP, { replace: true });
      } catch (error) {
        if (controller.signal.aborted) return;
        clearSession();
        const statusCode = getApiStatusCode(error);
        showToast({
          type: "warning",
          title: "Registration session unavailable",
          message:
            statusCode === 404 || statusCode === 410
              ? "The verification link expired. Complete registration again."
              : getApiErrorMessage(error),
        });
        navigate(ROUTES.REGISTER, { replace: true });
      }
    };

    void recover();
    return () => controller.abort();
  }, [
    clearSession,
    clockNow,
    isValid,
    navigate,
    recoveryRegistrationId,
    setSession,
    showToast,
  ]);

  useEffect(() => {
    if (
      clockNow === null ||
      isValid ||
      recoveryRegistrationId ||
      directAccessNotified.current
    ) {
      return;
    }

    directAccessNotified.current = true;
    clearSession();
    showToast({
      type: "warning",
      title: isExpired
        ? "Registration session expired"
        : "Registration session required",
      message: isExpired
        ? "Start registration again to receive a new verification code."
        : "Start registration before entering a verification code.",
    });
  }, [
    clearSession,
    clockNow,
    isExpired,
    isValid,
    recoveryRegistrationId,
    showToast,
  ]);

  if (clockNow === null) {
    return (
      <div className="flex min-h-[240px] items-center justify-center px-6 text-sm">
        <p role="status" aria-live="polite">
          Checking the secure registration session…
        </p>
      </div>
    );
  }

  if (isValid) return <Outlet />;

  if (recoveryRegistrationId) {
    return (
      <div className="flex min-h-[240px] items-center justify-center px-6 text-sm">
        <p role="status" aria-live="polite">
          Recovering the secure registration session…
        </p>
      </div>
    );
  }

  return <Navigate to={ROUTES.REGISTER} replace />;
}
