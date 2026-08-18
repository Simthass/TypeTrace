import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import AuthRedirectGuard from "./components/guards/AuthRedirectGuard";
import AuthSessionGate from "./components/guards/AuthSessionGate";
import RoleGuard from "./components/guards/RoleGuard";
import RegistrationSessionGuard from "./components/guards/RegistrationSessionGuard";

import AuthLayout from "./components/layout/AuthLayout";
import DashboardLayout from "./components/layout/DashboardLayout";
import RootLayout from "./components/layout/RootLayout";
import TeacherLayout from "./components/layout/TeacherLayout";

import ErrorBoundary from "./components/errors/ErrorBoundary";
import PageTitleManager from "./components/seo/PageTitleManager";
import ScrollToTop from "./components/ui/ScrollToTop";
import { ToastProvider } from "./components/ui/ToastProvider";

import { ROUTES } from "./constants/routes";

const AboutPage = lazy(() => import("./pages/AboutPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const CertificatesPage = lazy(() => import("./pages/CertificatesPage"));
const CertificateVerificationResultPage = lazy(
  () => import("./pages/CertificateVerificationResultPage"),
);
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DraftsPage = lazy(() => import("./pages/DraftsPage"));
const EditorPage = lazy(() => import("./pages/EditorPage"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const HelpDocsPage = lazy(() => import("./pages/HelpDocsPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const HowItWorksPage = lazy(() => import("./pages/HowItWorksPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ReplayPage = lazy(() => import("./pages/ReplayPage"));
const SessionsPage = lazy(() => import("./pages/SessionsPage"));
const StudentSessionDetailPage = lazy(
  () => import("./pages/student/StudentSessionDetailPage"),
);
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const SettingsRedirectPage = lazy(
  () => import("./pages/SettingsRedirectPage"),
);
const VerifyLookupPage = lazy(() => import("./pages/VerifyLookupPage"));
const VerifyOtpPage = lazy(() => import("./pages/VerifyOtpPage"));
const JoinCoursePage = lazy(
  () => import("./pages/student/JoinCoursePage"),
);
const StudentCoursesPage = lazy(
  () => import("./pages/student/StudentCoursesPage"),
);
const StudentCourseDetailPage = lazy(
  () => import("./pages/student/StudentCourseDetailPage"),
);
const TeacherCourseDetailPage = lazy(
  () => import("./pages/teacher/TeacherCourseDetailPage"),
);
const TeacherCoursesPage = lazy(
  () => import("./pages/teacher/TeacherCoursesPage"),
);
const TeacherDashboard = lazy(
  () => import("./pages/teacher/TeacherDashboard"),
);
const TeacherReviewPage = lazy(
  () => import("./pages/teacher/TeacherReviewPage"),
);
const TeacherStudentsPage = lazy(
  () => import("./pages/teacher/TeacherStudentsPage"),
);
const TeacherSubmissionsPage = lazy(
  () => import("./pages/teacher/TeacherSubmissionsPage"),
);

function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[40vh] items-center justify-center px-4 py-12"
    >
      <div className="text-center">
        <span
          className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600"
          aria-hidden="true"
        />
        <p className="mt-3 text-sm font-semibold text-slate-600">
          Loading TypeTrace workspace…
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ErrorBoundary>
          <PageTitleManager />
          <AuthSessionGate>
            <ScrollToTop />

            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                {/* Public routes */}
              <Route element={<RootLayout />}>
                <Route index element={<HomePage />} />
                <Route
                  path={ROUTES.HOW_IT_WORKS}
                  element={<HowItWorksPage />}
                />
                <Route path={ROUTES.FEATURES} element={<FeaturesPage />} />
                <Route path={ROUTES.ABOUT} element={<AboutPage />} />
                <Route path={ROUTES.PRIVACY} element={<PrivacyPage />} />
                <Route path={ROUTES.HELP_DOCS} element={<HelpDocsPage />} />
                <Route
                  path={ROUTES.VERIFY_LOOKUP}
                  element={<VerifyLookupPage />}
                />
                <Route
                  path={ROUTES.VERIFY}
                  element={<CertificateVerificationResultPage />}
                />
              </Route>

                {/* Auth routes */}
              <Route element={<AuthRedirectGuard />}>
                <Route element={<AuthLayout />}>
                  <Route path={ROUTES.LOGIN} element={<LoginPage />} />
                  <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
                  <Route
                    path={ROUTES.FORGOT_PASSWORD}
                    element={<ForgotPasswordPage />}
                  />
                  <Route element={<RegistrationSessionGuard />}>
                    <Route
                      path={ROUTES.VERIFY_OTP}
                      element={<VerifyOtpPage />}
                    />
                  </Route>
                </Route>
              </Route>

                {/* Shared authenticated routes */}
              <Route
                element={<RoleGuard allowedRoles={["STUDENT", "TEACHER"]} />}
              >
                <Route element={<RootLayout />}>
                  <Route
                    path={ROUTES.SETTINGS}
                    element={<SettingsRedirectPage />}
                  />
                  <Route
                    path={ROUTES.STUDENT_SETTINGS}
                    element={<SettingsPage />}
                  />
                  <Route
                    path={ROUTES.TEACHER_SETTINGS}
                    element={<SettingsPage />}
                  />
                </Route>

                <Route path={ROUTES.REPLAY} element={<ReplayPage />} />
              </Route>

                {/* Student routes */}
              <Route element={<RoleGuard allowedRoles={["STUDENT"]} />}>
                <Route path={ROUTES.EDITOR} element={<EditorPage />} />
                <Route path={ROUTES.EDITOR_NEW} element={<EditorPage />} />

                <Route element={<DashboardLayout />}>
                  <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
                  <Route path={ROUTES.DRAFTS} element={<DraftsPage />} />
                  <Route path={ROUTES.SESSIONS} element={<SessionsPage />} />
                  <Route
                    path={ROUTES.SESSION_DETAIL}
                    element={<StudentSessionDetailPage />}
                  />
                  <Route
                    path={ROUTES.CERTIFICATES}
                    element={<CertificatesPage />}
                  />
                  <Route path={ROUTES.ANALYTICS} element={<AnalyticsPage />} />
                  <Route
                    path={ROUTES.JOIN_COURSE}
                    element={<JoinCoursePage />}
                  />
                  <Route
                    path={ROUTES.STUDENT_COURSES}
                    element={<StudentCoursesPage />}
                  />
                  <Route
                    path={ROUTES.STUDENT_COURSE_DETAIL}
                    element={<StudentCourseDetailPage />}
                  />
                </Route>
              </Route>

                {/* Teacher routes */}
              <Route element={<RoleGuard allowedRoles={["TEACHER"]} />}>
                <Route element={<TeacherLayout />}>
                  <Route
                    path={ROUTES.TEACHER_DASHBOARD}
                    element={<TeacherDashboard />}
                  />
                  <Route
                    path={ROUTES.TEACHER_COURSES}
                    element={<TeacherCoursesPage />}
                  />
                  <Route
                    path={ROUTES.TEACHER_COURSE_DETAIL}
                    element={<TeacherCourseDetailPage />}
                  />
                  <Route
                    path={ROUTES.TEACHER_SUBMISSIONS}
                    element={<TeacherSubmissionsPage />}
                  />
                  <Route
                    path={ROUTES.TEACHER_STUDENTS}
                    element={<TeacherStudentsPage />}
                  />
                  <Route
                    path={ROUTES.TEACHER_REVIEW}
                    element={<TeacherReviewPage />}
                  />
                </Route>
              </Route>

              <Route path={ROUTES.NOT_FOUND} element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </AuthSessionGate>
        </ErrorBoundary>
      </ToastProvider>
    </BrowserRouter>
  );
}
