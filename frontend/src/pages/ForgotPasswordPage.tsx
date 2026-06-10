// frontend/src/pages/ForgotPasswordPage.tsx

import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  AuthButton,
  AuthField,
  AuthForm,
  AuthMessage,
  AuthPanel,
} from "../components/auth/AuthPanel";
import { ROUTES } from "../constants/routes";
import { api, getApiErrorMessage } from "../lib/api";
import { colors } from "../styles/colors";
import { API_ROUTES } from "../constants/apiRoutes";

type Step = "request" | "verify" | "reset";

interface ResetVerifyResponse {
  message: string;
  reset_token: string;
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [apiError, setApiError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cleanEmail = email.trim().toLowerCase();

  const requestCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setApiError(null);
    setSuccessMsg(null);

    if (!cleanEmail) {
      setApiError("Email address is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post(API_ROUTES.auth.passwordResetRequest, {
        email: cleanEmail,
      });
      setSuccessMsg("If that account exists, a reset code has been sent.");
      setStep("verify");
    } catch (error) {
      setApiError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setApiError(null);
    setSuccessMsg(null);

    const cleanOtp = otp.trim();

    if (!cleanEmail || cleanOtp.length !== 6) {
      setApiError("Enter your email and 6-digit reset code.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.post<ResetVerifyResponse>(
        API_ROUTES.auth.passwordResetVerify,
        {
          email: cleanEmail,
          otp: cleanOtp,
        },
      );

      setResetToken(response.data.reset_token);
      setSuccessMsg("Code verified. Create your new password.");
      setStep("reset");
    } catch (error) {
      setApiError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setApiError(null);
    setSuccessMsg(null);

    if (newPassword.length < 8) {
      setApiError("Password must be at least 8 characters.");
      return;
    }

    if (!/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      setApiError(
        "Password must contain at least one number and one special character.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setApiError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post(API_ROUTES.auth.passwordResetConfirm, {
        email: cleanEmail,
        reset_token: resetToken,
        new_password: newPassword,
      });

      navigate(ROUTES.LOGIN, { replace: true });
    } catch (error) {
      setApiError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPanel
      eyebrow="Account recovery"
      title="Recover access without losing your workspace."
      description="Reset your password using a secure email code and return to your TypeTrace authorship dashboard."
      sideTitle="Security is part of the verification workflow."
      sideDescription="Password reset uses a short-lived reset session so the account recovery flow stays controlled and role-aware."
    >
      {step === "request" && (
        <AuthForm onSubmit={requestCode}>
          {apiError && <AuthMessage type="error">{apiError}</AuthMessage>}
          {successMsg && <AuthMessage type="success">{successMsg}</AuthMessage>}

          <AuthField
            label="Email address"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@university.edu"
          />

          <AuthButton isLoading={isSubmitting}>Send reset code</AuthButton>

          <Link
            to={ROUTES.LOGIN}
            className="text-center text-[13px] font-semibold"
            style={{ color: colors.brand }}
          >
            Return to sign in
          </Link>
        </AuthForm>
      )}

      {step === "verify" && (
        <AuthForm onSubmit={verifyCode}>
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
            label="Reset code"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
            placeholder="000000"
          />

          <AuthButton isLoading={isSubmitting}>Verify code</AuthButton>
        </AuthForm>
      )}

      {step === "reset" && (
        <AuthForm onSubmit={resetPassword}>
          {apiError && <AuthMessage type="error">{apiError}</AuthMessage>}
          {successMsg && <AuthMessage type="success">{successMsg}</AuthMessage>}

          <AuthField
            label="New password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Minimum 8 characters"
          />

          <AuthField
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeat password"
          />

          <AuthButton isLoading={isSubmitting}>Update password</AuthButton>
        </AuthForm>
      )}
    </AuthPanel>
  );
}
