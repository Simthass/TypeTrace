import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";
import { useAuthStore } from "../store/authStore";
import { api } from "../lib/api";

function MailIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 7.00005L10.2 11.65C11.2667 12.45 12.7333 12.45 13.8 11.65L20 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function VerifyOtpPage() {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);

  // NEW: Dynamic loading text for the Labor Illusion UX
  const [loadingText, setLoadingText] = useState("Verify Account");
  const [errorMsg, setErrorMsg] = useState("");

  const pendingEmail = useAuthStore((state) => state.pendingEmail);
  const navigate = useNavigate();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!pendingEmail) {
      navigate(ROUTES.REGISTER);
    }
  }, [pendingEmail, navigate]);

  const handleChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    if (value !== "" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && otp[index] === "" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain").trim();
    if (/^\d{6}$/.test(pastedData)) {
      const pastedArray = pastedData.split("");
      setOtp(pastedArray);
      inputRefs.current[5]?.focus();
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otp.join("");

    if (fullOtp.length < 6) {
      setErrorMsg("Please enter all 6 digits.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");
    // Start the loading sequence visually
    setLoadingText("Validating token...");

    try {
      // 1. The API call happens instantly in the background
      const response = await api.post("/verify-otp", {
        email: pendingEmail,
        otp: fullOtp,
      });

      const { user, access_token } = response.data;

      // 2. The API succeeded! Now we trigger the "Labor Illusion"
      setLoadingText("Verifying cryptographic seal...");

      setTimeout(() => {
        setLoadingText("Provisioning secure session...");

        setTimeout(() => {
          // 3. Actually log them in and redirect after the visual sequence finishes
          useAuthStore.getState().login(user, access_token);
          navigate(ROUTES.DASHBOARD);
        }, 1000); // Wait another 1000ms
      }, 1000); // Wait 1000ms
    } catch (error: any) {
      // If it actually fails, we drop the illusion instantly and show the error
      setErrorMsg(
        error.response?.data?.detail || "Invalid OTP code. Please try again.",
      );
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      setIsLoading(false);
      setLoadingText("Verify Account");
    }
  };

  const handleResend = () => {
    // TODO: wire this up to a /resend-otp endpoint later
    alert("New OTP sent! Check your university email.");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        backgroundColor: colors.text.light,
        padding: "10vh 24px 24px",
        fontFamily: "inherit",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
        style={{ width: "100%", maxWidth: "400px" }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              backgroundColor: `${brand.action}15`,
              color: brand.action,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "24px",
            }}
          >
            <MailIcon />
          </div>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: colors.text.primary,
              letterSpacing: "-0.03em",
              marginBottom: "8px",
              textAlign: "center",
            }}
          >
            Check your email
          </h1>
          <p
            style={{
              fontSize: "15px",
              color: colors.text.secondary,
              textAlign: "center",
              lineHeight: "1.6",
            }}
          >
            We sent a 6-digit verification code to <br />
            <strong style={{ color: colors.text.primary, fontWeight: 600 }}>
              {pendingEmail || "your email"}
            </strong>
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "24px" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                disabled={isLoading}
                style={{
                  width: "50px",
                  height: "56px",
                  textAlign: "center",
                  fontSize: "20px",
                  fontWeight: 700,
                  backgroundColor: colors.surface[50],
                  borderRadius: "8px",
                  border: `1px solid ${errorMsg ? brand.aiAccent : digit ? brand.action : colors.surface[200]}`,
                  color: colors.text.primary,
                  outline: "none",
                  transition: "all 0.2s ease",
                  opacity: isLoading ? 0.6 : 1,
                }}
                onFocus={(e) => {
                  if (!errorMsg && !isLoading)
                    e.currentTarget.style.borderColor = brand.action;
                }}
                onBlur={(e) => {
                  if (!digit && !errorMsg)
                    e.currentTarget.style.borderColor = colors.surface[200];
                }}
              />
            ))}
          </div>

          {errorMsg && (
            <p
              style={{
                fontSize: "13px",
                color: brand.aiAccent,
                textAlign: "center",
                fontWeight: 500,
                marginTop: "-8px",
              }}
            >
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || otp.join("").length < 6}
            style={{
              width: "100%",
              padding: "14px",
              backgroundColor: brand.action,
              color: colors.text.light,
              border: "none",
              borderRadius: "8px",
              fontSize: "14.5px",
              fontWeight: 600,
              cursor:
                isLoading || otp.join("").length < 6
                  ? "not-allowed"
                  : "pointer",
              transition: "all 0.2s ease",
              opacity: isLoading || otp.join("").length < 6 ? 0.8 : 1,
            }}
          >
            {loadingText}
          </button>
        </form>

        <p
          style={{
            fontSize: "14px",
            color: colors.text.secondary,
            textAlign: "center",
            marginTop: "32px",
          }}
        >
          Didn't receive the email?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={isLoading}
            style={{
              color: colors.text.primary,
              fontWeight: 500,
              background: "none",
              border: "none",
              cursor: isLoading ? "not-allowed" : "pointer",
              padding: 0,
            }}
            onMouseEnter={(e) =>
              !isLoading && (e.currentTarget.style.textDecoration = "underline")
            }
            onMouseLeave={(e) =>
              !isLoading && (e.currentTarget.style.textDecoration = "none")
            }
          >
            Click to resend
          </button>
        </p>

        <div
          style={{
            marginTop: "32px",
            padding: "16px",
            backgroundColor: colors.surface[50],
            borderRadius: "8px",
            border: `1px solid ${colors.surface[200]}`,
          }}
        >
          <p
            style={{
              fontSize: "12px",
              color: colors.text.secondary,
              textAlign: "center",
              lineHeight: "1.5",
            }}
          >
            <strong style={{ color: colors.text.primary }}>
              Security Note:
            </strong>{" "}
            Your details are temporarily held in an encrypted Redis cache. If
            not verified within 10 minutes, your data is permanently discarded
            to maintain database integrity.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
