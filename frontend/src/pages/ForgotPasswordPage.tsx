import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";
import { api, getApiErrorMessage } from "../lib/api";

// --- Validations ---
const emailSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
});

const otpSchema = z.object({
  otp: z
    .string()
    .min(6, "Enter the 6-digit code")
    .max(6, "Enter the 6-digit code")
    .regex(/^\d+$/, "OTP must contain only numbers"),
});

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Minimum 8 characters")
      .regex(/\d/, "Must contain at least one number")
      .regex(/[^a-zA-Z0-9]/, "Must contain at least one special character"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type EmailFormValues = z.infer<typeof emailSchema>;
type OtpFormValues = z.infer<typeof otpSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

// --- Icons ---
function KeyIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
    </svg>
  );
}

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"email" | "otp" | "password">("email");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // OTP State
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  });

  // ─── STEP 1: Request Reset ───────────────────────────────────────────────
  const handleEmailSubmit = async (data: EmailFormValues) => {
    setIsLoading(true);
    setApiError(null);
    setSuccessMessage(null);

    try {
      await api.post("/auth/password-reset/request", {
        email: data.email,
      });

      setEmail(data.email);
      setStep("otp");
      setSuccessMessage("If that email exists, a reset code has been sent.");
    } catch (error) {
      setApiError(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  // ─── STEP 2: Verify OTP ──────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;

    const newOtp = [...otpDigits];
    newOtp[index] = value;
    setOtpDigits(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpSubmit = async () => {
    const fullOtp = otpDigits.join("");

    if (fullOtp.length < 6) {
      setApiError("Enter all 6 digits.");
      return;
    }

    setIsLoading(true);
    setApiError(null);
    setSuccessMessage(null);

    try {
      const response = await api.post("/auth/password-reset/verify", {
        email,
        otp: fullOtp,
      });

      setResetToken(response.data.reset_token);
      setStep("password");
      setSuccessMessage("Code verified. Please set your new password.");
    } catch (error) {
      setApiError(getApiErrorMessage(error));
      setOtpDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  // ─── STEP 3: Submit New Password ─────────────────────────────────────────
  const handlePasswordSubmit = async (data: PasswordFormValues) => {
    setIsLoading(true);
    setApiError(null);
    setSuccessMessage(null);

    try {
      await api.post("/auth/password-reset/confirm", {
        email,
        reset_token: resetToken,
        new_password: data.password,
      });

      setSuccessMessage("Password updated successfully. You can now log in.");
      setStep("email");
    } catch (error) {
      setApiError(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  // Using strictly our colors.ts tokens mapped to custom CSS vars
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
      className="min-h-screen flex items-start justify-center bg-[var(--bg-main)] pt-[10vh] px-6 pb-6 font-sans overflow-hidden"
    >
      <div className="w-full max-w-[380px] relative">
        <div className="flex flex-col items-center mb-8">
          <Link
            to={ROUTES.LOGIN}
            className="mb-8 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-action)] rounded-md"
            aria-label="Back to Login"
          >
            <img src="/Logo.png" alt="TypeTrace" className="h-[45px] w-auto" />
          </Link>
        </div>

        {/* AnimatePresence allows smooth switching between the 3 steps */}
        <div className="relative">
          <AnimatePresence mode="wait">
            {/* ─── RENDER STEP 1: EMAIL ─── */}
            {step === "email" && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight mb-2 text-center">
                  Reset your password
                </h1>
                <p className="text-[15px] text-[var(--text-secondary)] text-center mb-8">
                  Enter your university email and we'll send you a secure reset
                  code.
                </p>

                {apiError && (
                  <div
                    className="mb-4 px-4 py-3 rounded-lg text-[13px] font-medium"
                    style={{
                      backgroundColor: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#b91c1c",
                    }}
                  >
                    {apiError}
                  </div>
                )}

                {successMessage && (
                  <div
                    className="mb-4 px-4 py-3 rounded-lg text-[13px] font-medium"
                    style={{
                      backgroundColor: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      color: "#166534",
                    }}
                  >
                    {successMessage}
                  </div>
                )}

                <form
                  onSubmit={emailForm.handleSubmit(handleEmailSubmit)}
                  className="flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-medium text-[var(--text-primary)]">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="student@uni.ac.uk"
                      {...emailForm.register("email")}
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => setFocusedField(null)}
                      className="w-full px-3.5 py-3 bg-[var(--surface-50)] rounded-lg text-sm text-[var(--text-primary)] outline-none transition-all"
                      style={{
                        border: `1px solid ${emailForm.formState.errors.email ? "var(--error-color)" : focusedField === "email" ? "var(--brand-action)" : "var(--surface-200)"}`,
                        boxShadow:
                          focusedField === "email" &&
                          !emailForm.formState.errors.email
                            ? "0 0 0 1px var(--brand-action)"
                            : "none",
                      }}
                    />
                    {emailForm.formState.errors.email && (
                      <span className="text-xs font-medium text-[var(--error-color)]">
                        {emailForm.formState.errors.email.message}
                      </span>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 p-3 text-white rounded-lg text-sm font-medium transition-all"
                    style={{
                      backgroundColor: "var(--brand-action)",
                      opacity: isLoading ? 0.8 : 1,
                    }}
                  >
                    {isLoading ? "Sending..." : "Send Reset Code"}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ─── RENDER STEP 2: OTP ─── */}
            {step === "otp" && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight mb-2 text-center">
                  Enter verification code
                </h1>
                <p className="text-[15px] text-[var(--text-secondary)] text-center mb-8">
                  We sent a 6-digit code to{" "}
                  <strong className="text-[var(--text-primary)]">
                    {email}
                  </strong>
                </p>

                {apiError && (
                  <div
                    className="mb-4 px-4 py-3 rounded-lg text-[13px] font-medium"
                    style={{
                      backgroundColor: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#b91c1c",
                    }}
                  >
                    {apiError}
                  </div>
                )}

                {successMessage && (
                  <div
                    className="mb-4 px-4 py-3 rounded-lg text-[13px] font-medium"
                    style={{
                      backgroundColor: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      color: "#166534",
                    }}
                  >
                    {successMessage}
                  </div>
                )}

                <div className="flex flex-col gap-6">
                  <div className="flex justify-between gap-2">
                    {otpDigits.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => (inputRefs.current[index] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        disabled={isLoading}
                        className="w-[50px] h-[56px] text-center text-xl font-bold bg-[var(--surface-50)] rounded-lg text-[var(--text-primary)] outline-none transition-all"
                        style={{
                          border: `1px solid ${apiError ? "var(--error-color)" : digit ? "var(--brand-action)" : "var(--surface-200)"}`,
                        }}
                      />
                    ))}
                  </div>

                  <button
                    onClick={handleOtpSubmit}
                    disabled={isLoading || otpDigits.join("").length < 6}
                    className="w-full p-3 text-white rounded-lg text-sm font-medium transition-all"
                    style={{
                      backgroundColor: "var(--brand-action)",
                      opacity:
                        isLoading || otpDigits.join("").length < 6 ? 0.6 : 1,
                    }}
                  >
                    {isLoading ? "Verifying..." : "Verify Code"}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── RENDER STEP 3: NEW PASSWORD ─── */}
            {step === "password" && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <h1 className="text-2xl font-semibold text-[var(--text-primary)] tracking-tight mb-2 text-center">
                  Set new password
                </h1>
                <p className="text-[15px] text-[var(--text-secondary)] text-center mb-8">
                  Your new password must be at least 8 characters.
                </p>

                {apiError && (
                  <div
                    className="mb-4 px-4 py-3 rounded-lg text-[13px] font-medium"
                    style={{
                      backgroundColor: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#b91c1c",
                    }}
                  >
                    {apiError}
                  </div>
                )}

                {successMessage && (
                  <div
                    className="mb-4 px-4 py-3 rounded-lg text-[13px] font-medium"
                    style={{
                      backgroundColor: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      color: "#166534",
                    }}
                  >
                    {successMessage}
                  </div>
                )}

                <form
                  onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}
                  className="flex flex-col gap-4"
                >
                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-medium text-[var(--text-primary)]">
                      New Password
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      {...passwordForm.register("password")}
                      onFocus={() => setFocusedField("password")}
                      onBlur={() => setFocusedField(null)}
                      className="w-full px-3.5 py-3 bg-[var(--surface-50)] rounded-lg text-sm text-[var(--text-primary)] outline-none transition-all"
                      style={{
                        border: `1px solid ${passwordForm.formState.errors.password ? "var(--error-color)" : focusedField === "password" ? "var(--brand-action)" : "var(--surface-200)"}`,
                      }}
                    />
                    {passwordForm.formState.errors.password && (
                      <span className="text-xs font-medium text-[var(--error-color)]">
                        {passwordForm.formState.errors.password.message}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-medium text-[var(--text-primary)]">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      {...passwordForm.register("confirmPassword")}
                      onFocus={() => setFocusedField("confirmPassword")}
                      onBlur={() => setFocusedField(null)}
                      className="w-full px-3.5 py-3 bg-[var(--surface-50)] rounded-lg text-sm text-[var(--text-primary)] outline-none transition-all"
                      style={{
                        border: `1px solid ${passwordForm.formState.errors.confirmPassword ? "var(--error-color)" : focusedField === "confirmPassword" ? "var(--brand-action)" : "var(--surface-200)"}`,
                      }}
                    />
                    {passwordForm.formState.errors.confirmPassword && (
                      <span className="text-xs font-medium text-[var(--error-color)]">
                        {passwordForm.formState.errors.confirmPassword.message}
                      </span>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 p-3 text-white rounded-lg text-sm font-medium transition-all"
                    style={{
                      backgroundColor: "var(--brand-action)",
                      opacity: isLoading ? 0.8 : 1,
                    }}
                  >
                    {isLoading ? "Updating..." : "Reset Password"}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-sm text-[var(--text-secondary)] text-center mt-8 relative z-10">
          Remembered your password?{" "}
          <Link
            to={ROUTES.LOGIN}
            className="text-[var(--text-primary)] font-medium hover:underline transition-all"
          >
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
}
