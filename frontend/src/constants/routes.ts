/**
 * TypeTrace — Route Constants
 */

export const ROUTES = {
  HOME: "/",
  HOW_IT_WORKS: "/how-it-works",
  FEATURES: "/features",
  ABOUT: "/about",
  PRICING: "/pricing",
  LOGIN: "/login",
  REGISTER: "/register",
  VERIFY_OTP: "/verify-otp",
  FORGOT_PASSWORD: "/forgot-password",
  DASHBOARD: "/dashboard",
  EDITOR: "/editor",
  EDITOR_NEW: "/editor/new",
  SESSION: "/editor/:sessionId",
  CERTIFICATE: "/certificate/:sessionId",
  REPORTS: "/reports",
  SETTINGS: "/settings",
  HELP_DOCS: "/help",
  NOT_FOUND: "*",

  // FIX: Updated to match the nested structure used in SessionsPage
  REPLAY: "/session/:sessionId/replay",
} as const;

export type RouteKey = keyof typeof ROUTES;

export const PUBLIC_NAV = [
  { label: "Home", path: ROUTES.HOME },
  { label: "How It Works", path: ROUTES.HOW_IT_WORKS },
  { label: "Features", path: ROUTES.FEATURES },
  { label: "About", path: ROUTES.ABOUT },
] as const;

export const AUTH_NAV = [
  { label: "Dashboard", path: ROUTES.DASHBOARD },
  { label: "Sessions", path: ROUTES.EDITOR },
  { label: "Reports", path: ROUTES.REPORTS },
] as const;
