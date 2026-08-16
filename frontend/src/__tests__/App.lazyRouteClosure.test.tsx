import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../components/guards/AuthSessionGate", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("../components/guards/AuthRedirectGuard", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return { default: () => <Outlet /> };
});
vi.mock("../components/guards/RegistrationSessionGuard", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return { default: () => <Outlet /> };
});
vi.mock("../components/guards/RoleGuard", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return { default: () => <Outlet /> };
});

vi.mock("../components/layout/RootLayout", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { default: () => <main><Outlet /></main> };
});
vi.mock("../components/layout/AuthLayout", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { default: () => <main><Outlet /></main> };
});
vi.mock("../components/layout/DashboardLayout", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { default: () => <main><Outlet /></main> };
});
vi.mock("../components/layout/TeacherLayout", async () => {
  const { Outlet } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { default: () => <main><Outlet /></main> };
});
vi.mock("../components/errors/ErrorBoundary", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("../components/seo/PageTitleManager", () => ({ default: () => null }));
vi.mock("../components/ui/ScrollToTop", () => ({ default: () => null }));
vi.mock("../components/ui/ToastProvider", () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("../pages/AboutPage", () => ({ default: () => <div>route-about</div> }));
vi.mock("../pages/AnalyticsPage", () => ({ default: () => <div>route-analytics</div> }));
vi.mock("../pages/CertificatesPage", () => ({ default: () => <div>route-certificates</div> }));
vi.mock("../pages/CertificateVerificationResultPage", () => ({ default: () => <div>route-verify-result</div> }));
vi.mock("../pages/DashboardPage", () => ({ default: () => <div>route-dashboard</div> }));
vi.mock("../pages/DraftsPage", () => ({ default: () => <div>route-drafts</div> }));
vi.mock("../pages/EditorPage", () => ({ default: () => <div>route-editor</div> }));
vi.mock("../pages/FeaturesPage", () => ({ default: () => <div>route-features</div> }));
vi.mock("../pages/ForgotPasswordPage", () => ({ default: () => <div>route-forgot</div> }));
vi.mock("../pages/HelpDocsPage", () => ({ default: () => <div>route-help</div> }));
vi.mock("../pages/HomePage", () => ({ default: () => <div>route-home</div> }));
vi.mock("../pages/HowItWorksPage", () => ({ default: () => <div>route-how</div> }));
vi.mock("../pages/LoginPage", () => ({ default: () => <div>route-login</div> }));
vi.mock("../pages/NotFoundPage", () => ({ default: () => <div>route-not-found</div> }));
vi.mock("../pages/PrivacyPage", () => ({ default: () => <div>route-privacy</div> }));
vi.mock("../pages/RegisterPage", () => ({ default: () => <div>route-register</div> }));
vi.mock("../pages/ReplayPage", () => ({ default: () => <div>route-replay</div> }));
vi.mock("../pages/SessionsPage", () => ({ default: () => <div>route-sessions</div> }));
vi.mock("../pages/student/StudentSessionDetailPage", () => ({ default: () => <div>route-session-detail</div> }));
vi.mock("../pages/SettingsPage", () => ({ default: () => <div>route-settings</div> }));
vi.mock("../pages/SettingsRedirectPage", () => ({ default: () => <div>route-settings-redirect</div> }));
vi.mock("../pages/VerifyLookupPage", () => ({ default: () => <div>route-verify</div> }));
vi.mock("../pages/VerifyOtpPage", () => ({ default: () => <div>route-otp</div> }));
vi.mock("../pages/student/JoinCoursePage", () => ({ default: () => <div>route-join-course</div> }));
vi.mock("../pages/teacher/TeacherCourseDetailPage", () => ({ default: () => <div>route-teacher-course-detail</div> }));
vi.mock("../pages/teacher/TeacherCoursesPage", () => ({ default: () => <div>route-teacher-courses</div> }));
vi.mock("../pages/teacher/TeacherDashboard", () => ({ default: () => <div>route-teacher-dashboard</div> }));
vi.mock("../pages/teacher/TeacherReviewPage", () => ({ default: () => <div>route-teacher-review</div> }));
vi.mock("../pages/teacher/TeacherStudentsPage", () => ({ default: () => <div>route-teacher-students</div> }));
vi.mock("../pages/teacher/TeacherSubmissionsPage", () => ({ default: () => <div>route-teacher-submissions</div> }));

import App from "../App";

const routes = [
  ["/", "route-home"],
  ["/how-it-works", "route-how"],
  ["/features", "route-features"],
  ["/about", "route-about"],
  ["/privacy", "route-privacy"],
  ["/help", "route-help"],
  ["/verify", "route-verify"],
  ["/verify/TT-FINAL", "route-verify-result"],
  ["/login", "route-login"],
  ["/register", "route-register"],
  ["/forgot-password", "route-forgot"],
  ["/verify-otp", "route-otp"],
  ["/settings", "route-settings-redirect"],
  ["/dashboard/settings", "route-settings"],
  ["/teacher/settings", "route-settings"],
  ["/session/44/replay", "route-replay"],
  ["/editor", "route-editor"],
  ["/dashboard", "route-dashboard"],
  ["/drafts", "route-drafts"],
  ["/sessions", "route-sessions"],
  ["/sessions/44", "route-session-detail"],
  ["/certificates", "route-certificates"],
  ["/analytics", "route-analytics"],
  ["/join-course", "route-join-course"],
  ["/teacher/dashboard", "route-teacher-dashboard"],
  ["/teacher/courses", "route-teacher-courses"],
  ["/teacher/courses/7", "route-teacher-course-detail"],
  ["/teacher/submissions", "route-teacher-submissions"],
  ["/teacher/students", "route-teacher-students"],
  ["/teacher/review/44", "route-teacher-review"],
  ["/missing-final-route", "route-not-found"],
] as const;

describe("App lazy route closure", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  it.each(routes)("loads %s through its declared lazy route", async (path, label) => {
    window.history.pushState({}, "", path);
    render(<App />);
    expect(await screen.findByText(label)).toBeVisible();
  });
});
