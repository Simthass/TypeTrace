import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

import {
  AuthButton,
  AuthField,
  AuthForm,
  AuthPanel,
} from "../components/auth/AuthPanel";
import { ROUTES } from "../constants/routes";
import { api, getApiErrorMessage } from "../lib/api";
import { useAuthStore, type AuthUser } from "../store/authStore";
import { useRegistrationStore } from "../store/registrationStore";
import { usePasswordResetStore } from "../store/passwordResetStore";
import { colors } from "../styles/colors";
import { API_ROUTES } from "../constants/apiRoutes";
import { useToast } from "../components/ui/ToastContext";
import { normalizeEmail, isValidEmail } from "../lib/edgeCases";

interface LoginResponse {
  message: string;
  access_token: string;
  user: AuthUser;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();
  const clearRegistration = useRegistrationStore((state) => state.clearSession);
  const clearPasswordReset = usePasswordResetStore(
    (state) => state.clearSession,
  );
  const { showToast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function getDashboardPath(role?: string): string {
    return role === "TEACHER" ? ROUTES.TEACHER_DASHBOARD : ROUTES.DASHBOARD;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanEmail = normalizeEmail(email);

    if (!isValidEmail(cleanEmail)) {
      showToast({
        type: "warning",
        title: "Invalid email",
        message: "Enter a valid email address.",
      });
      return;
    }

    if (!password.trim()) {
      showToast({
        type: "warning",
        title: "Password required",
        message: "Enter your account password.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.post<LoginResponse>(API_ROUTES.auth.login, {
        email: cleanEmail,
        password,
      });

      login(response.data.user, response.data.access_token);
      clearRegistration();
      clearPasswordReset();

      showToast({
        type: "success",
        title: "Login successful",
        message: "Opening your TypeTrace workspace.",
      });

      const state = location.state as { from?: string } | null;
      const redirectTo =
        state?.from || getDashboardPath(response.data.user.role);

      navigate(redirectTo, { replace: true });
    } catch (error) {
      showToast({
        type: "error",
        title: "Login failed",
        message: getApiErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPanel
      eyebrow="Secure sign in"
      title="Welcome back to your authorship workspace."
      description="Access your writing sessions, certificates, replay trails, and academic verification tools."
      sideTitle="A clearer record of how original work was produced."
      sideDescription="TypeTrace helps students and teachers move beyond final-text guessing by preserving the writing process itself."
    >
      <AuthForm onSubmit={handleSubmit}>
        <AuthField
          label="Email address"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@university.edu"
        />

        <AuthField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
        />

        <div className="flex items-center justify-between gap-4">
          <Link
            to={ROUTES.FORGOT_PASSWORD}
            className="text-[13px] font-semibold"
            style={{ color: colors.brand }}
          >
            Forgot password?
          </Link>
        </div>

        <AuthButton isLoading={isSubmitting}>Sign in</AuthButton>

        <p
          className="text-center text-[13px]"
          style={{ color: colors.text.secondary }}
        >
          New to TypeTrace?{" "}
          <Link
            to={ROUTES.REGISTER}
            className="font-semibold"
            style={{ color: colors.brand }}
          >
            Create an account
          </Link>
        </p>
      </AuthForm>
    </AuthPanel>
  );
}
