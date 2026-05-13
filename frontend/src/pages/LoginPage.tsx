import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="currentColor"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="currentColor"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="currentColor"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="currentColor"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="11" width="14" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const response = await api.post("/auth/login", {
        email: data.email,
        password: data.password,
      });
      const { user, access_token } = response.data;
      useAuthStore.getState().login(user, access_token);
      navigate(ROUTES.DASHBOARD);
    } catch (error: any) {
      alert(error.response?.data?.detail || "Invalid credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const authStyles = {
    "--bg-main": colors.text.light,
    "--surface-50": colors.surface[50],
    "--surface-200": colors.surface[200],
    "--text-primary": colors.text.primary,
    "--text-secondary": colors.text.secondary,
    "--brand-action": brand.action,
    "--brand-hover": brand.actionHover,
    "--error-color": brand.aiAccent,
  } as React.CSSProperties;

  return (
    <div
      style={authStyles}
      className="min-h-screen flex flex-col bg-[var(--bg-main)] font-sans"
    >
      {/* ── top bar: logo left, sign up right — same layout as vercel login ── */}
      <header
        className="w-full flex items-center justify-between px-12 shrink-0 "
        style={{ height: 64, borderColor: colors.surface[200] }}
      >
        <Link
          to={ROUTES.HOME}
          className="outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-action)] rounded-md"
          aria-label="Back to Home"
        >
          <img
            src="/Logo.png"
            alt="TypeTrace"
            className="h-[30px] w-auto object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </Link>

        {/* sign in link — users who already have an account can bail out quickly */}
        <div className="flex items-center gap-3">
          <Link
            to={ROUTES.REGISTER}
            className="px-6 py-2 rounded-md text-[13px] font-semibold border transition-colors hover:bg-[var(--surface-50)]"
            style={{
              color: colors.text.primary,
              borderColor: colors.surface[200],
            }}
          >
            Sign Up
          </Link>
        </div>
      </header>

      {/* ── main content: centred form, no logo here anymore ── */}
      <div className="flex-1 flex items-start justify-center pt-[8vh] px-6 pb-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full max-w-[380px]"
        >
          {/* page heading — logo removed from here, now in the header */}
          <div className="flex flex-col items-center mb-10">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight mb-2 text-center">
              Sign in to TypeTrace
            </h1>
            <p className="text-[15px] text-[var(--text-secondary)] text-center">
              Welcome back to your secure session.
            </p>
          </div>

          <button
            type="button"
            className="w-full flex items-center justify-center gap-2.5 p-3 bg-[var(--bg-main)] border border-[var(--surface-200)] rounded-lg text-sm font-medium text-[var(--text-primary)] cursor-pointer transition-colors hover:bg-[var(--surface-50)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-action)]"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-[1px] bg-[var(--surface-200)] opacity-60" />
            <span className="text-xs text-[var(--text-secondary)] uppercase tracking-widest">
              Or
            </span>
            <div className="flex-1 h-[1px] bg-[var(--surface-200)] opacity-60" />
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium text-[var(--text-primary)]">
                Email Address
              </label>
              <input
                type="email"
                placeholder="student@uni.ac.uk"
                {...register("email")}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                className="w-full px-3.5 py-3 bg-[var(--surface-50)] rounded-lg text-sm text-[var(--text-primary)] outline-none transition-all"
                style={{
                  border: `1px solid ${errors.email ? "var(--error-color)" : focusedField === "email" ? "var(--brand-action)" : "var(--surface-200)"}`,
                  boxShadow:
                    focusedField === "email" && !errors.email
                      ? "0 0 0 1px var(--brand-action)"
                      : "none",
                }}
              />
              {errors.email && (
                <span className="text-xs font-medium text-[var(--error-color)]">
                  {errors.email.message}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-[13px] font-medium text-[var(--text-primary)]">
                  Password
                </label>
                <Link
                  to={ROUTES.FORGOT_PASSWORD}
                  className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors outline-none focus-visible:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                {...register("password")}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                className="w-full px-3.5 py-3 bg-[var(--surface-50)] rounded-lg text-sm text-[var(--text-primary)] outline-none transition-all"
                style={{
                  border: `1px solid ${errors.password ? "var(--error-color)" : focusedField === "password" ? "var(--brand-action)" : "var(--surface-200)"}`,
                  boxShadow:
                    focusedField === "password" && !errors.password
                      ? "0 0 0 1px var(--brand-action)"
                      : "none",
                }}
              />
              {errors.password && (
                <span className="text-xs font-medium text-[var(--error-color)]">
                  {errors.password.message}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 p-3 text-white rounded-lg text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--brand-action)]"
              style={{
                backgroundColor: "var(--brand-action)",
                opacity: isLoading ? 0.8 : 1,
                cursor: isLoading ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) =>
                !isLoading &&
                (e.currentTarget.style.backgroundColor = "var(--brand-hover)")
              }
              onMouseLeave={(e) =>
                !isLoading &&
                (e.currentTarget.style.backgroundColor = "var(--brand-action)")
              }
            >
              {isLoading ? "Authenticating..." : "Sign In"}
            </button>
          </form>

          <p className="text-sm text-[var(--text-secondary)] text-center mt-8">
            Don't have an account?{" "}
            <Link
              to={ROUTES.REGISTER}
              className="text-[var(--text-primary)] font-medium hover:underline transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-action)] rounded-sm"
            >
              Sign up
            </Link>
          </p>

          <div className="flex items-center justify-center gap-1.5 mt-10 text-[var(--text-secondary)] opacity-70">
            <LockIcon />
            <span className="text-xs">End-to-end encrypted</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
