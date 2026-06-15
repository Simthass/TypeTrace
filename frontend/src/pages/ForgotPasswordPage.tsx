import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  AuthButton,
  AuthField,
  AuthForm,
  AuthPanel,
} from "../components/auth/AuthPanel";
import { ROUTES } from "../constants/routes";
import { api, getApiErrorMessage } from "../lib/api";
import { colors } from "../styles/colors";
import { API_ROUTES } from "../constants/apiRoutes";
import { useToast } from "../components/ui/ToastProvider";
import {
  normalizeEmail,
  isValidEmail,
  isValidOtp,
  isStrongEnoughPassword,
} from "../lib/edgeCases";

type Step = "request" | "verify" | "reset";

interface ResetVerifyResponse {
  message: string;
  reset_token: string;
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

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
      await api.post(API_ROUTES.auth.passwordResetRequest, {
        email: cleanEmail,
      });

      showToast({
        type: "success",
        title: "Reset code sent",
        message: "Check your email for the password reset code.",
      });
      setStep("verify");
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

    if (!isValidEmail(cleanEmail)) {
      showToast({
        type: "warning",
        title: "Invalid email",
        message: "Enter a valid email address.",
      });
      return;
    }

    if (!isValidOtp(cleanOtp)) {
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
        {
          email: cleanEmail,
          otp: cleanOtp,
        },
      );

      setResetToken(response.data.reset_token);

      showToast({
        type: "success",
        title: "Code verified",
        message: "You can now set a new password.",
      });
      setStep("reset");
    } catch (error) {
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

    if (!isStrongEnoughPassword(newPassword)) {
      showToast({
        type: "warning",
        title: "Password too short",
        message: "Use at least 8 characters.",
      });
      return;
    }

    if (!/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      showToast({
        type: "warning",
        title: "Password requirements",
        message:
          "Password must contain at least one number and one special character.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast({
        type: "warning",
        title: "Passwords do not match",
        message: "Confirm password must match the new password.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post(API_ROUTES.auth.passwordResetConfirm, {
        email: cleanEmail,
        reset_token: resetToken,
        new_password: newPassword,
      });

      showToast({
        type: "success",
        title: "Password updated",
        message: "Sign in with your new password.",
      });
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (error) {
      showToast({
        type: "error",
        title: "Reset failed",
        message: getApiErrorMessage(error),
      });
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
