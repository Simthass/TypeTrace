// frontend/src/pages/VerifyOtpPage.tsx

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import {
  AuthButton,
  AuthField,
  AuthForm,
  AuthMessage,
  AuthPanel,
} from "../components/auth/AuthPanel";
import { ROUTES } from "../constants/routes";
import { api, getApiErrorMessage } from "../lib/api";
import { useAuthStore, type AuthUser } from "../store/authStore";
import { colors } from "../styles/colors";
import { API_ROUTES } from "../constants/apiRoutes";

interface VerifyOtpResponse {
  message: string;
  access_token: string;
  user: AuthUser;
}

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const { pendingEmail, login, setPendingEmail } = useAuthStore();

  const [email, setEmail] = useState(pendingEmail || "");
  const [otp, setOtp] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const cleanEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setApiError(null);
    setSuccessMsg(null);

    const cleanOtp = otp.trim();

    if (!cleanEmail || cleanOtp.length !== 6) {
      setApiError("Enter your email and the 6-digit verification code.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.post<VerifyOtpResponse>(
        API_ROUTES.auth.verifyOtp,
        { email: cleanEmail, otp: cleanOtp },
      );

      login(response.data.user, response.data.access_token);
      setPendingEmail(null);

      const next =
        response.data.user.role === "TEACHER"
          ? ROUTES.TEACHER_DASHBOARD
          : ROUTES.DASHBOARD;

      navigate(next, { replace: true });
    } catch (error) {
      setApiError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resend = async () => {
    setApiError(null);
    setSuccessMsg(null);

    if (!cleanEmail) {
      setApiError("Enter your email before requesting a new code.");
      return;
    }

    setIsResending(true);

    try {
      await api.post(API_ROUTES.auth.resendOtp, {
        email: cleanEmail,
      });
      setSuccessMsg("A new verification code has been sent.");
    } catch (error) {
      setApiError(getApiErrorMessage(error));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthPanel
      eyebrow="Verify account"
      title="Confirm your TypeTrace workspace."
      description="Enter the 6-digit verification code sent to your email address to complete registration."
      sideTitle="Verification keeps the authorship trail trusted."
      sideDescription="Every TypeTrace workspace starts with verified identity, role-aware routing, and controlled access to student or teacher tools."
    >
      <AuthForm onSubmit={submit}>
        {apiError && <AuthMessage type="error">{apiError}</AuthMessage>}
        {successMsg && <AuthMessage type="success">{successMsg}</AuthMessage>}

        <AuthField
          label="Email address"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@university.edu"
        />

        <AuthField
          label="Verification code"
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
          placeholder="000000"
        />

        <AuthButton isLoading={isSubmitting}>Verify account</AuthButton>

        <button
          type="button"
          onClick={resend}
          disabled={isResending}
          className="text-center text-[13px] font-semibold disabled:opacity-60"
          style={{ color: colors.brand }}
        >
          {isResending ? "Sending new code..." : "Send a new code"}
        </button>
      </AuthForm>
    </AuthPanel>
  );
}
