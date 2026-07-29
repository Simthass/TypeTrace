import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";

import { API_ROUTES } from "../../constants/apiRoutes";
import { ROUTES } from "../../constants/routes";
import {
  api,
  getApiErrorMessage,
  getApiStatusCode,
} from "../../lib/api";
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
  const [isRecovering, setIsRecovering] = useState(false);

  const recoveryRegistrationId = useMemo(
    () => readRecoveryRegistrationId(location.hash),
    [location.hash],
  );

  const isValid = Boolean(
    session &&
      REGISTRATION_ID_PATTERN.test(session.registrationId) &&
      session.email.trim().length > 0 &&
      (session.role === "STUDENT" || session.role === "TEACHER") &&
      Number.isFinite(session.expiresAt) &&
      session.expiresAt > Date.now(),
  );

  useEffect(() => {
    if (isValid || !recoveryRegistrationId) return;
    if (recoveryAttemptedFor.current === recoveryRegistrationId) return;

    recoveryAttemptedFor.current = recoveryRegistrationId;
    setIsRecovering(true);

    const recover = async () => {
      try {
        const response = await api.get<RegistrationStatusResponse>(
          API_ROUTES.auth.registrationStatus(recoveryRegistrationId),
          {
            skipGlobalToast: true,
            skipAuthRedirect: true,
          },
        );
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
      } finally {
        setIsRecovering(false);
      }
    };

    void recover();
  }, [
    clearSession,
    isValid,
    navigate,
    recoveryRegistrationId,
    setSession,
    showToast,
  ]);

  useEffect(() => {
    if (isValid || recoveryRegistrationId || directAccessNotified.current) {
      return;
    }

    directAccessNotified.current = true;
    clearSession();
    showToast({
      type: "warning",
      title: "Registration session required",
      message: "Start registration before entering a verification code.",
    });
  }, [clearSession, isValid, recoveryRegistrationId, showToast]);

  if (isValid) return <Outlet />;

  if (recoveryRegistrationId || isRecovering) {
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
