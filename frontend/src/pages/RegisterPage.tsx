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

const registerSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  studentId: z.string().min(5, "Valid Student ID required"),
  email: z.string().email("Invalid university email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  consent: z.literal(true, {
    errorMap: () => ({
      message: "You must consent to biometric capture to proceed.",
    }),
  }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

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

function ShieldIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export default function RegisterPage() {
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
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    try {
      // baseURL already includes /api/v1/auth, hit /register directly
      await api.post("/register", {
        first_name: data.firstName,
        last_name: data.lastName,
        student_id: data.studentId,
        email: data.email,
        password: data.password,
        consent: data.consent,
      });

      useAuthStore.getState().setPendingEmail(data.email);
      navigate(ROUTES.VERIFY_OTP);
    } catch (error: any) {
      console.error("Registration failed:", error);
      alert(error.response?.data?.detail || "Registration failed. Try again.");
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
      className="min-h-screen flex items-start justify-center bg-[var(--bg-main)] pt-[8vh] px-6 pb-6 font-sans"
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
        className="w-full max-w-[420px]"
      >
        <div className="flex flex-col items-center mb-8">
          <Link
            to={ROUTES.HOME}
            className="mb-8 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-action)] rounded-md"
            aria-label="Back to Home"
          >
            <img src="/Logo.png" alt="TypeTrace" className="h-[45px] w-auto" />
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight mb-2 text-center">
            Create Student Account
          </h1>
          <p className="text-[15px] text-[var(--text-secondary)] text-center">
            Secure your academic integrity with biometric proof.
          </p>
        </div>

        <button
          type="button"
          className="w-full flex items-center justify-center gap-2.5 p-3 bg-[var(--bg-main)] border border-[var(--surface-200)] rounded-lg text-sm font-medium text-[var(--text-primary)] cursor-pointer transition-colors hover:bg-[var(--surface-50)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-action)]"
        >
          <GoogleIcon />
          Sign up with University Google
        </button>

        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-[1px] bg-[var(--surface-200)] opacity-60" />
          <span className="text-xs text-[var(--text-secondary)] uppercase tracking-widest">
            Or register manually
          </span>
          <div className="flex-1 h-[1px] bg-[var(--surface-200)] opacity-60" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium text-[var(--text-primary)]">
                First Name
              </label>
              <input
                type="text"
                placeholder="Ada"
                {...register("firstName")}
                onFocus={() => setFocusedField("firstName")}
                onBlur={() => setFocusedField(null)}
                className="w-full px-3.5 py-3 bg-[var(--surface-50)] rounded-lg text-sm text-[var(--text-primary)] outline-none transition-all"
                style={{
                  border: `1px solid ${errors.firstName ? "var(--error-color)" : focusedField === "firstName" ? "var(--brand-action)" : "var(--surface-200)"}`,
                  boxShadow:
                    focusedField === "firstName" && !errors.firstName
                      ? "0 0 0 1px var(--brand-action)"
                      : "none",
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium text-[var(--text-primary)]">
                Last Name
              </label>
              <input
                type="text"
                placeholder="Lovelace"
                {...register("lastName")}
                onFocus={() => setFocusedField("lastName")}
                onBlur={() => setFocusedField(null)}
                className="w-full px-3.5 py-3 bg-[var(--surface-50)] rounded-lg text-sm text-[var(--text-primary)] outline-none transition-all"
                style={{
                  border: `1px solid ${errors.lastName ? "var(--error-color)" : focusedField === "lastName" ? "var(--brand-action)" : "var(--surface-200)"}`,
                  boxShadow:
                    focusedField === "lastName" && !errors.lastName
                      ? "0 0 0 1px var(--brand-action)"
                      : "none",
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-medium text-[var(--text-primary)]">
              Student ID
            </label>
            <input
              type="text"
              placeholder="e.g. 2540927"
              {...register("studentId")}
              onFocus={() => setFocusedField("studentId")}
              onBlur={() => setFocusedField(null)}
              className="w-full px-3.5 py-3 bg-[var(--surface-50)] rounded-lg text-sm text-[var(--text-primary)] outline-none transition-all"
              style={{
                border: `1px solid ${errors.studentId ? "var(--error-color)" : focusedField === "studentId" ? "var(--brand-action)" : "var(--surface-200)"}`,
                boxShadow:
                  focusedField === "studentId" && !errors.studentId
                    ? "0 0 0 1px var(--brand-action)"
                    : "none",
              }}
            />
            {errors.studentId && (
              <span className="text-xs font-medium text-[var(--error-color)]">
                {errors.studentId.message}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-medium text-[var(--text-primary)]">
              University Email
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
            <label className="text-[13px] font-medium text-[var(--text-primary)]">
              Password
            </label>
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

          {/* Minimalist Biometric Ethics Consent Box */}
          <div
            className="flex items-start gap-3 p-4 bg-[var(--surface-50)] rounded-lg mt-2"
            style={{
              border: `1px solid ${errors.consent ? "var(--error-color)" : "var(--surface-200)"}`,
            }}
          >
            <input
              type="checkbox"
              id="consent"
              {...register("consent")}
              className="mt-0.5 w-4 h-4 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--brand-action)]"
              style={{ accentColor: "var(--brand-action)" }}
            />
            <label
              htmlFor="consent"
              className="text-[13px] leading-[1.5] text-[var(--text-secondary)] cursor-pointer"
            >
              <strong className="block text-[var(--text-primary)] mb-1">
                Biometric Data Consent
              </strong>
              I agree to allow TypeTrace to securely record my keystroke timings
              (Inter-Key Intervals) solely for cryptographic authorship
              verification.
            </label>
          </div>
          {errors.consent && (
            <span className="text-xs font-medium text-[var(--error-color)]">
              {errors.consent.message}
            </span>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 p-3 text-white rounded-lg text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--brand-action)]"
            style={{
              backgroundColor: isLoading
                ? "var(--brand-action)"
                : "var(--brand-action)",
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
            {isLoading ? "Creating Profile..." : "Create Account"}
          </button>
        </form>

        <p className="text-sm text-[var(--text-secondary)] text-center mt-8">
          Already have an account?{" "}
          <Link
            to={ROUTES.LOGIN}
            className="text-[var(--text-primary)] font-medium hover:underline transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-action)] rounded-sm"
          >
            Sign in
          </Link>
        </p>

        <div className="flex items-center justify-center gap-1.5 mt-10 text-[var(--text-secondary)] opacity-70">
          <ShieldIcon />
          <span className="text-xs">Data encrypted at rest via AES-256</span>
        </div>
      </motion.div>
    </div>
  );
}
