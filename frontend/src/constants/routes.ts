export const ROUTES = {
  // Public
  HOME: "/",
  HOW_IT_WORKS: "/how-it-works",
  FEATURES: "/features",
  ABOUT: "/about",
  SETTINGS: "/settings",
  HELP_DOCS: "/help",
  PRIVACY: "/privacy",

  // Auth
  LOGIN: "/login",
  REGISTER: "/register",
  VERIFY_OTP: "/verify-otp",
  FORGOT_PASSWORD: "/forgot-password",

  // Student App
  DASHBOARD: "/dashboard",
  STUDENT_SETTINGS: "/dashboard/settings",
  EDITOR: "/editor",
  EDITOR_NEW: "/editor/new",
  DRAFTS: "/drafts",
  SESSIONS: "/sessions",
  SESSION_DETAIL: "/sessions/:sessionId",
  CERTIFICATES: "/certificates",
  ANALYTICS: "/analytics",
  REPLAY: "/session/:sessionId/replay",
  JOIN_COURSE: "/join-course",
  STUDENT_COURSES: "/courses",
  STUDENT_COURSE_DETAIL: "/courses/:courseId",

  // Public Certificate Verification
  VERIFY_LOOKUP: "/verify",
  VERIFY: "/verify/:certId",

  // Teacher App
  TEACHER_DASHBOARD: "/teacher/dashboard",
  TEACHER_SETTINGS: "/teacher/settings",
  TEACHER_COURSES: "/teacher/courses",
  TEACHER_COURSE_DETAIL: "/teacher/courses/:courseId",
  TEACHER_SUBMISSIONS: "/teacher/submissions",
  TEACHER_STUDENTS: "/teacher/students",
  TEACHER_REVIEW: "/teacher/review/:sessionId",

  // Fallback
  NOT_FOUND: "*",
} as const;

export type RouteKey = keyof typeof ROUTES;

export const PUBLIC_NAV = [
  { label: "Home", path: ROUTES.HOME },
  { label: "How It Works", path: ROUTES.HOW_IT_WORKS },
  { label: "Features", path: ROUTES.FEATURES },
  { label: "About", path: ROUTES.ABOUT },
  { label: "Privacy", path: ROUTES.PRIVACY },
  { label: "Verify", path: ROUTES.VERIFY_LOOKUP },
] as const;

export const AUTH_NAV = [
  { label: "Dashboard", path: ROUTES.DASHBOARD },
  { label: "Drafts", path: ROUTES.DRAFTS },
  { label: "Sessions", path: ROUTES.SESSIONS },
  { label: "Analytics", path: ROUTES.ANALYTICS },
] as const;
