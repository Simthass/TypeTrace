/**
 * TypeTrace — Route Constants
 * All application route paths defined here.
 * Import ROUTES in components instead of hardcoding strings.
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
  NOT_FOUND: "*",
} as const;

export type RouteKey = keyof typeof ROUTES;

/**
 * Navigation items shown in the header.
 * Public nav links (shown to all users).
 */
export const PUBLIC_NAV = [
  { label: "Home", path: ROUTES.HOME },
  { label: "How It Works", path: ROUTES.HOW_IT_WORKS },
  { label: "Features", path: ROUTES.FEATURES },
  { label: "About", path: ROUTES.ABOUT },
] as const;

/**
 * Navigation items shown when user is authenticated.
 */
export const AUTH_NAV = [
  { label: "Dashboard", path: ROUTES.DASHBOARD },
  { label: "Sessions", path: ROUTES.EDITOR },
  { label: "Reports", path: ROUTES.REPORTS },
] as const;
