export const ROUTES = {
  // ── Public ──────────────────────────────────────────────────────────────────
  HOME: "/",
  HOW_IT_WORKS: "/how-it-works",
  FEATURES: "/features",
  ABOUT: "/about",
  PRICING: "/pricing",

  // ── Auth ────────────────────────────────────────────────────────────────────
  LOGIN: "/login",
  REGISTER: "/register",
  VERIFY_OTP: "/verify-otp",
  FORGOT_PASSWORD: "/forgot-password",

  // ── Student App ─────────────────────────────────────────────────────────────
  DASHBOARD: "/dashboard",
  EDITOR: "/editor",
  EDITOR_NEW: "/editor/new",
  SESSION: "/editor/:sessionId",
  CERTIFICATE: "/certificate/:sessionId",
  REPORTS: "/reports",
  SETTINGS: "/settings",
  HELP_DOCS: "/help",
  REPLAY: "/session/:sessionId/replay",
  JOIN_COURSE: "/join-course",

  // ── Public Certificate Verification (NO AUTH REQUIRED) ───────────────────
  VERIFY_LOOKUP: "/verify",
  VERIFY: "/verify/:certId", // ← PART 6 NEW

  // ── Teacher App ─────────────────────────────────────────────────────────────
  TEACHER_DASHBOARD: "/teacher/dashboard",
  TEACHER_COURSES: "/teacher/courses",
  TEACHER_COURSE: "/teacher/courses/:courseId",
  TEACHER_SUBMISSIONS: "/teacher/submissions",
  TEACHER_STUDENTS: "/teacher/students",
  TEACHER_REVIEW: "/teacher/review/:sessionId",

  NOT_FOUND: "*",
} as const;

export type RouteKey = keyof typeof ROUTES;

export const PUBLIC_NAV = [
  { label: "Home", path: ROUTES.HOME },
  { label: "How It Works", path: ROUTES.HOW_IT_WORKS },
  { label: "Features", path: ROUTES.FEATURES },
  { label: "About", path: ROUTES.ABOUT },
  { label: "Verify", path: ROUTES.VERIFY_LOOKUP },
] as const;

export const AUTH_NAV = [
  { label: "Dashboard", path: ROUTES.DASHBOARD },
  { label: "Sessions", path: ROUTES.EDITOR },
  { label: "Reports", path: ROUTES.REPORTS },
] as const;
