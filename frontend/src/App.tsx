import { BrowserRouter, Route, Routes } from "react-router-dom";

import AuthRedirectGuard from "./components/guards/AuthRedirectGuard";
import AuthSessionGate from "./components/guards/AuthSessionGate";
import RoleGuard from "./components/guards/RoleGuard";

import AuthLayout from "./components/layout/AuthLayout";
import DashboardLayout from "./components/layout/DashboardLayout";
import RootLayout from "./components/layout/RootLayout";
import TeacherLayout from "./components/layout/TeacherLayout";

import ErrorBoundary from "./components/errors/ErrorBoundary";
import PageTitleManager from "./components/seo/PageTitleManager";
import ScrollToTop from "./components/ui/ScrollToTop";
import { ToastProvider } from "./components/ui/ToastProvider";

import { ROUTES } from "./constants/routes";

import AboutPage from "./pages/AboutPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import CertificatesPage from "./pages/CertificatesPage";
import CertificateVerificationResultPage from "./pages/CertificateVerificationResultPage";
import DashboardPage from "./pages/DashboardPage";
import DraftsPage from "./pages/DraftsPage";
import EditorPage from "./pages/EditorPage";
import FeaturesPage from "./pages/FeaturesPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import HelpDocsPage from "./pages/HelpDocsPage";
import HomePage from "./pages/HomePage";
import HowItWorksPage from "./pages/HowItWorksPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import RegisterPage from "./pages/RegisterPage";
import ReplayPage from "./pages/ReplayPage";
import SessionsPage from "./pages/SessionsPage";
import SettingsPage from "./pages/SettingsPage";
import SettingsRedirectPage from "./pages/SettingsRedirectPage";
import VerifyLookupPage from "./pages/VerifyLookupPage";
import VerifyOtpPage from "./pages/VerifyOtpPage";

import JoinCoursePage from "./pages/student/JoinCoursePage";

import TeacherCourseDetailPage from "./pages/teacher/TeacherCourseDetailPage";
import TeacherCoursesPage from "./pages/teacher/TeacherCoursesPage";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherReviewPage from "./pages/teacher/TeacherReviewPage";
import TeacherStudentsPage from "./pages/teacher/TeacherStudentsPage";
import TeacherSubmissionsPage from "./pages/teacher/TeacherSubmissionsPage";

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ErrorBoundary>
          <PageTitleManager />
          <AuthSessionGate>
            <ScrollToTop />

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
                  <Route path={ROUTES.VERIFY_OTP} element={<VerifyOtpPage />} />
                  <Route
                    path={ROUTES.FORGOT_PASSWORD}
                    element={<ForgotPasswordPage />}
                  />
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
                    path={ROUTES.CERTIFICATES}
                    element={<CertificatesPage />}
                  />
                  <Route path={ROUTES.ANALYTICS} element={<AnalyticsPage />} />
                  <Route
                    path={ROUTES.JOIN_COURSE}
                    element={<JoinCoursePage />}
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
          </AuthSessionGate>
        </ErrorBoundary>
      </ToastProvider>
    </BrowserRouter>
  );
}
