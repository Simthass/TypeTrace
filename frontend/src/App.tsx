import { BrowserRouter, Routes, Route } from "react-router-dom";

// Layouts
import RootLayout from "./components/layout/RootLayout";
import AuthLayout from "./components/layout/AuthLayout";
import DashboardLayout from "./components/layout/DashboardLayout";
import TeacherLayout from "./components/layout/TeacherLayout";

// Guards
import RoleGuard from "./components/guards/RoleGuard";

// Public pages
import HomePage from "./pages/HomePage";
import HowItWorksPage from "./pages/HowItWorksPage";
import FeaturesPage from "./pages/FeaturesPage";
import AboutPage from "./pages/AboutPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import HelpDocsPage from "./pages/HelpDocsPage";
import SettingsPage from "./pages/SettingsPage";

// Auth pages
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyOtpPage from "./pages/VerifyOtpPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";

// Student app pages
import DashboardPage from "./pages/DashboardPage";
import EditorPage from "./pages/EditorPage";
import SessionsPage from "./pages/SessionsPage";
import CertificatesPage from "./pages/CertificatesPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ReplayPage from "./pages/ReplayPage";
import JoinCoursePage from "./pages/student/JoinCoursePage";

// Teacher app pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherCoursesPage from "./pages/teacher/TeacherCoursesPage";
import TeacherSubmissionsPage from "./pages/teacher/TeacherSubmissionsPage";
import TeacherReviewPage from "./pages/teacher/TeacherReviewPage";

import { ROUTES } from "./constants/routes";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── PUBLIC ─────────────────────────────────────────────────────── */}
        <Route element={<RootLayout />}>
          <Route index element={<HomePage />} />
          <Route path={ROUTES.HOW_IT_WORKS} element={<HowItWorksPage />} />
          <Route path={ROUTES.FEATURES} element={<FeaturesPage />} />
          <Route path={ROUTES.ABOUT} element={<AboutPage />} />
          <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
          <Route path={ROUTES.HELP_DOCS} element={<HelpDocsPage />} />
          <Route
            path={ROUTES.PRICING}
            element={<PlaceholderPage title="Pricing" />}
          />
          <Route
            path={ROUTES.NOT_FOUND}
            element={
              <PlaceholderPage
                title="Page not found"
                description="The page you're looking for doesn't exist."
              />
            }
          />
        </Route>

        {/* ── AUTH ───────────────────────────────────────────────────────── */}
        <Route element={<AuthLayout />}>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
          <Route path={ROUTES.VERIFY_OTP} element={<VerifyOtpPage />} />
          <Route
            path={ROUTES.FORGOT_PASSWORD}
            element={<ForgotPasswordPage />}
          />
        </Route>

        {/* ── STUDENT ROUTES ─────────────────────────────────────────────── */}
        <Route element={<RoleGuard allowedRoles={["STUDENT"]} />}>
          {/* Pages with the resizable sidebar */}
          <Route element={<DashboardLayout />}>
            <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
            <Route path={ROUTES.EDITOR} element={<SessionsPage />} />
            <Route path="/certificates" element={<CertificatesPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/join-course" element={<JoinCoursePage />} />
          </Route>

          {/* Full-screen pages (no sidebar) */}
          <Route path={ROUTES.EDITOR_NEW} element={<EditorPage />} />
          <Route path={ROUTES.REPLAY} element={<ReplayPage />} />
        </Route>

        {/* ── TEACHER ROUTES ─────────────────────────────────────────────── */}
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
              path="/teacher/submissions"
              element={<TeacherSubmissionsPage />}
            />
            <Route
              path="/teacher/students"
              element={
                <PlaceholderPage
                  title="Students"
                  description="Students roster view coming soon."
                />
              }
            />
            {/* Dynamic course detail */}
            <Route
              path="/teacher/courses/:courseId"
              element={
                <PlaceholderPage
                  title="Course Detail"
                  description="Detailed per-course view coming soon."
                />
              }
            />
          </Route>

          {/* Full-screen review page (no sidebar — needs full width for metrics) */}
          <Route path={ROUTES.TEACHER_REVIEW} element={<TeacherReviewPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
