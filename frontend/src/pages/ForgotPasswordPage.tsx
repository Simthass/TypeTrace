import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";
import { api } from "../lib/api";

// --- Validations ---
const emailSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
});

const passwordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type EmailFormValues = z.infer<typeof emailSchema>;
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
  // state machine: 1 = email, 2 = otp, 3 = new password
  // professor said keeping this in one component prevents URL jumping attacks
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Data carried between steps
  const [targetEmail, setTargetEmail] = useState("");
  const [resetToken, setResetToken] = useState(""); // backend gives this after OTP is verified

  // OTP State
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
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
  const onEmailSubmit = async (data: EmailFormValues) => {
    setIsLoading(true);
    try {
      // TODO: build this in FastAPI next
      await api.post("/password-reset/request", { email: data.email });
      setTargetEmail(data.email);
      setStep(2);
    } catch (error: any) {
      // For security, even if email doesn't exist, we often pretend it worked to prevent enumeration
      // but for this dissertation, showing the error is fine.
      alert(error.response?.data?.detail || "Failed to request reset.");
    } finally {
      setIsLoading(false);
    }
  };

  // ─── STEP 2: Verify OTP ──────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);
    if (value !== "" && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && otp[index] === "" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyOtp = async () => {
    const fullOtp = otp.join("");
    if (fullOtp.length < 6) {
      setOtpError("Enter all 6 digits.");
      return;
    }
    setIsLoading(true);
    setOtpError("");
    try {
      // TODO: build this in FastAPI
      // This should return a temporary reset_token so we can authorize the password change
      const response = await api.post("/password-reset/verify", {
        email: targetEmail,
        otp: fullOtp,
      });
      setResetToken(response.data.reset_token);
      setStep(3);
    } catch (error: any) {
      setOtpError(error.response?.data?.detail || "Invalid code.");
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  // ─── STEP 3: Submit New Password ─────────────────────────────────────────
  const onPasswordSubmit = async (data: PasswordFormValues) => {
    setIsLoading(true);
    try {
      // TODO: build this in FastAPI
      await api.post("/password-reset/confirm", {
        email: targetEmail,
        reset_token: resetToken,
        new_password: data.password,
      });
      alert("Password reset successfully. Please log in.");
      navigate(ROUTES.LOGIN);
    } catch (error: any) {
      alert(error.response?.data?.detail || "Failed to reset password.");
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
            {step === 1 && (
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

                <form
                  onSubmit={emailForm.handleSubmit(onEmailSubmit)}
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
            {step === 2 && (
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
                    {targetEmail}
                  </strong>
                </p>

                <div className="flex flex-col gap-6">
                  <div className="flex justify-between gap-2">
                    {otp.map((digit, index) => (
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
                          border: `1px solid ${otpError ? "var(--error-color)" : digit ? "var(--brand-action)" : "var(--surface-200)"}`,
                        }}
                      />
                    ))}
                  </div>
                  {otpError && (
                    <p className="text-[13px] text-[var(--error-color)] text-center font-medium mt-[-8px]">
                      {otpError}
                    </p>
                  )}

                  <button
                    onClick={verifyOtp}
                    disabled={isLoading || otp.join("").length < 6}
                    className="w-full p-3 text-white rounded-lg text-sm font-medium transition-all"
                    style={{
                      backgroundColor: "var(--brand-action)",
                      opacity: isLoading || otp.join("").length < 6 ? 0.6 : 1,
                    }}
                  >
                    {isLoading ? "Verifying..." : "Verify Code"}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ─── RENDER STEP 3: NEW PASSWORD ─── */}
            {step === 3 && (
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

                <form
                  onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
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
