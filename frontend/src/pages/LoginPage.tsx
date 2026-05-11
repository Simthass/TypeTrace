import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";

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
      <rect x="5" y="11" width="14" height="11" rx="2" ry="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
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
    console.log("Login Payload:", data);
    setTimeout(() => {
      setIsLoading(false);
      navigate(ROUTES.DASHBOARD);
    }, 1000);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "flex-start", // changed from center
        justifyContent: "center",
        backgroundColor: colors.text.light, // Pure white/lightest background
        padding: "10vh 24px 24px", // 10vh pushes it down optimally instead of dead center
        fontFamily: "inherit",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
        style={{
          width: "100%",
          maxWidth: "380px", // Slightly tighter width for borderless design
          // NO background color, NO border, NO box-shadow. The card is gone.
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "40px",
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
              fontWeight: 600, // Slightly reduced weight for elegance
              color: colors.text.primary,
              letterSpacing: "-0.03em", // Tighter tracking
              marginBottom: "8px",
              textAlign: "center",
            }}
          >
            Sign in to TypeTrace
          </h1>
          <p
            style={{
              fontSize: "15px",
              color: colors.text.secondary,
              textAlign: "center",
            }}
          >
            Welcome back to your secure session.
          </p>
        </div>

        {/* SSO Button - Vercel style solid border */}
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
            border: `1px solid ${colors.surface[200]}`, // Thinner, crisper border
            borderRadius: "8px", // Reduced border radius for a sharper, technical look
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
          Continue with Google
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
            Or
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
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: colors.text.primary,
              }}
            >
              Email Address
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
                backgroundColor: colors.surface[50], // Subtle contrast against white page
                border: `1px solid ${errors.email ? brand.aiAccent : focusedField === "email" ? brand.action : colors.surface[200]}`,
                borderRadius: "8px",
                fontSize: "14px",
                color: colors.text.primary,
                outline: "none",
                transition: "all 0.2s ease",
                boxShadow:
                  focusedField === "email" && !errors.email
                    ? `0 0 0 1px ${brand.action}`
                    : "none", // Sharp Vercel-style focus ring
              }}
            />
            {errors.email && (
              <span
                style={{
                  fontSize: "12px",
                  color: brand.aiAccent,
                  fontWeight: 500,
                }}
              >
                {errors.email.message}
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <label
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: colors.text.primary,
                }}
              >
                Password
              </label>
              <Link
                to="#"
                style={{
                  fontSize: "13px",
                  color: colors.text.secondary,
                  textDecoration: "none",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = colors.text.primary)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = colors.text.secondary)
                }
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
            {errors.password && (
              <span
                style={{
                  fontSize: "12px",
                  color: brand.aiAccent,
                  fontWeight: 500,
                }}
              >
                {errors.password.message}
              </span>
            )}
          </div>

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
            {isLoading ? "Authenticating..." : "Sign In"}
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
          Don't have an account?{" "}
          <Link
            to={ROUTES.REGISTER}
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
            Sign up
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
          <LockIcon />
          <span style={{ fontSize: "12px" }}>End-to-end encrypted</span>
        </div>
      </motion.div>
    </div>
  );
}
