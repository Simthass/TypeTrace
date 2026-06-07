// frontend/src/App.tsx

import { BrowserRouter, Routes, Route } from "react-router-dom";

// Layouts
import RootLayout from "./components/layout/RootLayout";
import AuthLayout from "./components/layout/AuthLayout";
import DashboardLayout from "./components/layout/DashboardLayout";
import TeacherLayout from "./components/layout/TeacherLayout";

// Guards
import RoleGuard from "./components/guards/RoleGuard";

// UI providers
import ScrollToTop from "./components/ui/ScrollToTop";
import { ToastProvider } from "./components/ui/ToastProvider";

// Public pages
import HomePage from "./pages/HomePage";
import HowItWorksPage from "./pages/HowItWorksPage";
import FeaturesPage from "./pages/FeaturesPage";
import AboutPage from "./pages/AboutPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import HelpDocsPage from "./pages/HelpDocsPage";

// Auth pages
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyOtpPage from "./pages/VerifyOtpPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";

// Student pages
import DashboardPage from "./pages/DashboardPage";
import EditorPage from "./pages/EditorPage";
import SessionsPage from "./pages/SessionsPage";
import CertificatesPage from "./pages/CertificatesPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ReplayPage from "./pages/ReplayPage";
import JoinCoursePage from "./pages/student/JoinCoursePage";

// Teacher pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherCoursesPage from "./pages/teacher/TeacherCoursesPage";
import TeacherCoursePage from "./pages/teacher/TeacherCoursesPage";
import TeacherSubmissionsPage from "./pages/teacher/TeacherSubmissionsPage";
import TeacherStudentsPage from "./pages/teacher/TeacherStudentsPage";
import TeacherReviewPage from "./pages/teacher/TeacherReviewPage";

// Account / settings
import SettingsPage from "./pages/SettingsPage";

// Verification pages
import VerifyCertificatePage from "./pages/VerifyCertificatePage";
import VerifyLookupPage from "./pages/VerifyLookupPage";

import { ROUTES } from "./constants/routes";

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ScrollToTop />

        <Routes>
          {/* Public routes */}
          <Route element={<RootLayout />}>
            <Route index element={<HomePage />} />
            <Route path={ROUTES.HOW_IT_WORKS} element={<HowItWorksPage />} />
            <Route path={ROUTES.FEATURES} element={<FeaturesPage />} />
            <Route path={ROUTES.ABOUT} element={<AboutPage />} />
            <Route path={ROUTES.HELP_DOCS} element={<HelpDocsPage />} />
            <Route
              path={ROUTES.PRICING}
              element={
                <PlaceholderPage
                  title="Pricing"
                  description="TypeTrace pricing is prepared for academic pilots, course deployments, and institutional demonstrations."
                />
              }
            />
            <Route path={ROUTES.VERIFY_LOOKUP} element={<VerifyLookupPage />} />
            <Route path={ROUTES.VERIFY} element={<VerifyCertificatePage />} />
          </Route>

          {/* Auth routes */}
          <Route element={<AuthLayout />}>
            <Route path={ROUTES.LOGIN} element={<LoginPage />} />
            <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
            <Route path={ROUTES.VERIFY_OTP} element={<VerifyOtpPage />} />
            <Route
              path={ROUTES.FORGOT_PASSWORD}
              element={<ForgotPasswordPage />}
            />
          </Route>

          {/* Shared authenticated routes for students and teachers */}
          <Route element={<RoleGuard allowedRoles={["STUDENT", "TEACHER"]} />}>
            <Route path={ROUTES.REPLAY} element={<ReplayPage />} />
            <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
          </Route>

          {/* Student routes */}
          <Route element={<RoleGuard allowedRoles={["STUDENT"]} />}>
            <Route element={<DashboardLayout />}>
              <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
              <Route path={ROUTES.EDITOR_NEW} element={<EditorPage />} />
              <Route path={ROUTES.EDITOR} element={<EditorPage />} />
              <Route path={ROUTES.SESSIONS} element={<SessionsPage />} />
              <Route
                path={ROUTES.CERTIFICATES}
                element={<CertificatesPage />}
              />
              <Route path={ROUTES.ANALYTICS} element={<AnalyticsPage />} />
              <Route path={ROUTES.JOIN_COURSE} element={<JoinCoursePage />} />
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
                element={<TeacherCoursePage />}
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

          {/* Global fallback */}
          <Route
            path={ROUTES.NOT_FOUND}
            element={
              <PlaceholderPage
                title="Page not found"
                description="The page you are looking for does not exist or has moved."
              />
            }
          />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
