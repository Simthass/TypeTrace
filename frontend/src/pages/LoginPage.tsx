// frontend/src/pages/LoginPage.tsx

import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

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

interface LoginResponse {
  message: string;
  access_token: string;
  user: AuthUser;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function getDashboardPath(role?: string): string {
    return role === "TEACHER" ? ROUTES.TEACHER_DASHBOARD : ROUTES.DASHBOARD;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setApiError(null);

    if (!email.trim() || !password.trim()) {
      setApiError("Email and password are required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.post<LoginResponse>(API_ROUTES.auth.login, {
        email: email.trim().toLowerCase(),
        password,
      });

      login(response.data.user, response.data.access_token);

      const state = location.state as { from?: string } | null;
      const redirectTo =
        state?.from || getDashboardPath(response.data.user.role);

      navigate(redirectTo, { replace: true });
    } catch (error) {
      setApiError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthPanel
      eyebrow="Secure sign in"
      title="Welcome back to your authorship workspace."
      description="Access your writing sessions, certificates, replay trails, and academic verification tools."
      sideTitle="A cleaner way to prove original work."
      sideDescription="TypeTrace helps students and teachers move beyond final-text guessing by preserving the writing process itself."
    >
      <AuthForm onSubmit={handleSubmit}>
        {apiError && <AuthMessage type="error">{apiError}</AuthMessage>}

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
