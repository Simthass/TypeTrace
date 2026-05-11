import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";

// Strict validation including biometric consent - crucial for your ethics chapter!
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
        fill={colors.text.primary}
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill={colors.text.primary}
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill={colors.text.primary}
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill={colors.text.primary}
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
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
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
    console.log("Registration Payload (Secure):", data);
    setTimeout(() => {
      setIsLoading(false);
      navigate(ROUTES.DASHBOARD);
    }, 1200);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        backgroundColor: colors.text.light, // Pure white/lightest background
        padding: "8vh 24px 24px", // Slightly less top padding than login to account for longer form
        fontFamily: "inherit",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
        style={{
          width: "100%",
          maxWidth: "420px", // Slightly wider to accommodate side-by-side name fields
          // NO card container
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "32px",
          }}
        >
          <Link
            to={ROUTES.HOME}
            style={{ marginBottom: "32px", outline: "none" }}
            aria-label="Back to Home"
          >
            <img
              src="/Logo.png"
              alt="TypeTrace"
              style={{ height: "45px", width: "auto" }}
            />
          </Link>
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
            Create Student Account
          </h1>
          <p
            style={{
              fontSize: "15px",
              color: colors.text.secondary,
              textAlign: "center",
            }}
          >
            Secure your academic integrity with biometric proof.
          </p>
        </div>

        {/* SSO Button */}
        <button
          type="button"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            padding: "12px",
            backgroundColor: colors.text.light,
            border: `1px solid ${colors.surface[200]}`,
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            color: colors.text.primary,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor =
              colors.surface[50];
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor =
              colors.text.light;
          }}
        >
          <GoogleIcon />
          Sign up with University Google
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            margin: "24px 0",
          }}
        >
          <div
            style={{
              flex: 1,
              height: "1px",
              backgroundColor: colors.surface[200],
              opacity: 0.6,
            }}
          />
          <span
            style={{
              fontSize: "12px",
              color: colors.text.secondary,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Or register manually
          </span>
          <div
            style={{
              flex: 1,
              height: "1px",
              backgroundColor: colors.surface[200],
              opacity: 0.6,
            }}
          />
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          {/* 2-Column Grid for Names */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <label
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: colors.text.primary,
                }}
              >
                First Name
              </label>
              <input
                type="text"
                placeholder="Ada"
                {...register("firstName")}
                onFocus={() => setFocusedField("firstName")}
                onBlur={() => setFocusedField(null)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  backgroundColor: colors.surface[50],
                  border: `1px solid ${errors.firstName ? brand.aiAccent : focusedField === "firstName" ? brand.action : colors.surface[200]}`,
                  borderRadius: "8px",
                  fontSize: "14px",
                  color: colors.text.primary,
                  outline: "none",
                  transition: "all 0.2s ease",
                  boxShadow:
                    focusedField === "firstName" && !errors.firstName
                      ? `0 0 0 1px ${brand.action}`
                      : "none",
                }}
              />
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <label
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: colors.text.primary,
                }}
              >
                Last Name
              </label>
              <input
                type="text"
                placeholder="Lovelace"
                {...register("lastName")}
                onFocus={() => setFocusedField("lastName")}
                onBlur={() => setFocusedField(null)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  backgroundColor: colors.surface[50],
                  border: `1px solid ${errors.lastName ? brand.aiAccent : focusedField === "lastName" ? brand.action : colors.surface[200]}`,
                  borderRadius: "8px",
                  fontSize: "14px",
                  color: colors.text.primary,
                  outline: "none",
                  transition: "all 0.2s ease",
                  boxShadow:
                    focusedField === "lastName" && !errors.lastName
                      ? `0 0 0 1px ${brand.action}`
                      : "none",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: colors.text.primary,
              }}
            >
              Student ID
            </label>
            <input
              type="text"
              placeholder="e.g. 2540927"
              {...register("studentId")}
              onFocus={() => setFocusedField("studentId")}
              onBlur={() => setFocusedField(null)}
              style={{
                width: "100%",
                padding: "12px 14px",
                backgroundColor: colors.surface[50],
                border: `1px solid ${errors.studentId ? brand.aiAccent : focusedField === "studentId" ? brand.action : colors.surface[200]}`,
                borderRadius: "8px",
                fontSize: "14px",
                color: colors.text.primary,
                outline: "none",
                transition: "all 0.2s ease",
                boxShadow:
                  focusedField === "studentId" && !errors.studentId
                    ? `0 0 0 1px ${brand.action}`
                    : "none",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: colors.text.primary,
              }}
            >
              University Email
            </label>
            <input
              type="email"
              placeholder="student@uni.ac.uk"
              {...register("email")}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
              style={{
                width: "100%",
                padding: "12px 14px",
                backgroundColor: colors.surface[50],
                border: `1px solid ${errors.email ? brand.aiAccent : focusedField === "email" ? brand.action : colors.surface[200]}`,
                borderRadius: "8px",
                fontSize: "14px",
                color: colors.text.primary,
                outline: "none",
                transition: "all 0.2s ease",
                boxShadow:
                  focusedField === "email" && !errors.email
                    ? `0 0 0 1px ${brand.action}`
                    : "none",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: colors.text.primary,
              }}
            >
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              {...register("password")}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
              style={{
                width: "100%",
                padding: "12px 14px",
                backgroundColor: colors.surface[50],
                border: `1px solid ${errors.password ? brand.aiAccent : focusedField === "password" ? brand.action : colors.surface[200]}`,
                borderRadius: "8px",
                fontSize: "14px",
                color: colors.text.primary,
                outline: "none",
                transition: "all 0.2s ease",
                boxShadow:
                  focusedField === "password" && !errors.password
                    ? `0 0 0 1px ${brand.action}`
                    : "none",
              }}
            />
          </div>

          {/* Minimalist Biometric Ethics Consent Box */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              padding: "16px",
              backgroundColor: colors.surface[50], // flattened to match inputs
              border: `1px solid ${errors.consent ? brand.aiAccent : colors.surface[200]}`,
              borderRadius: "8px",
              marginTop: "8px",
            }}
          >
            <input
              type="checkbox"
              id="consent"
              {...register("consent")}
              style={{
                marginTop: "2px",
                width: "16px",
                height: "16px",
                accentColor: brand.action,
                cursor: "pointer",
              }}
            />
            <label
              htmlFor="consent"
              style={{
                fontSize: "13px",
                lineHeight: "1.5",
                color: colors.text.secondary,
                cursor: "pointer",
              }}
            >
              <strong
                style={{
                  color: colors.text.primary,
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                Biometric Data Consent
              </strong>
              I agree to allow TypeTrace to securely record my keystroke timings
              (Inter-Key Intervals) solely for cryptographic authorship
              verification.
            </label>
          </div>
          {errors.consent && (
            <span
              style={{
                fontSize: "12px",
                color: brand.aiAccent,
                fontWeight: 500,
              }}
            >
              {errors.consent.message}
            </span>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: "100%",
              marginTop: "8px",
              padding: "12px",
              backgroundColor: brand.action,
              color: colors.text.light,
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: isLoading ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
              opacity: isLoading ? 0.8 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLoading)
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  brand.actionHover;
            }}
            onMouseLeave={(e) => {
              if (!isLoading)
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  brand.action;
            }}
          >
            {isLoading ? "Creating Profile..." : "Create Account"}
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
          Already have an account?{" "}
          <Link
            to={ROUTES.LOGIN}
            style={{
              color: colors.text.primary,
              textDecoration: "none",
              fontWeight: 500,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.textDecoration = "underline")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.textDecoration = "none")
            }
          >
            Sign in
          </Link>
        </p>

        {/* Minimalist Trust Indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            marginTop: "40px",
            color: colors.text.secondary,
            opacity: 0.7,
          }}
        >
          <ShieldIcon />
          <span style={{ fontSize: "12px" }}>
            Data encrypted at rest via AES-256
          </span>
        </div>
      </motion.div>
    </div>
  );
}
