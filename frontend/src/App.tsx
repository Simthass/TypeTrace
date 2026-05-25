// src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import RootLayout from "./components/layout/RootLayout";
import AuthLayout from "./components/layout/AuthLayout";
import DashboardLayout from "./components/layout/DashboardLayout";

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

// Teacher app pages (Part 2 — placeholder until implemented)
// import TeacherDashboard from "./pages/teacher/TeacherDashboard";

import { ROUTES } from "./constants/routes";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── PUBLIC ROUTES ───────────────────────────────────────────────── */}
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

        {/* ── AUTH FLOW ROUTES ─────────────────────────────────────────────── */}
        <Route element={<AuthLayout />}>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
          <Route path={ROUTES.VERIFY_OTP} element={<VerifyOtpPage />} />
          <Route
            path={ROUTES.FORGOT_PASSWORD}
            element={<ForgotPasswordPage />}
          />
        </Route>

        {/* ── STUDENT ROUTES (role-gated) ──────────────────────────────────── */}
        {/*
         * RoleGuard checks:
         *   1. isAuthenticated — redirects to /login if not
         *   2. user.role === "STUDENT" — redirects teachers to /teacher/dashboard
         */}
        <Route element={<RoleGuard allowedRoles={["STUDENT"]} />}>
          <Route element={<DashboardLayout />}>
            <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
            <Route path={ROUTES.EDITOR} element={<SessionsPage />} />
            <Route path="/certificates" element={<CertificatesPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Route>

          {/* Full-screen routes (no sidebar) */}
          <Route path={ROUTES.EDITOR_NEW} element={<EditorPage />} />
          <Route path={ROUTES.REPLAY} element={<ReplayPage />} />
        </Route>

        {/* ── TEACHER ROUTES (role-gated) ──────────────────────────────────── */}
        {/*
         * Part 2 will add real teacher pages here.
         * For now, a placeholder keeps the route from 404-ing if a teacher logs in.
         */}
        <Route element={<RoleGuard allowedRoles={["TEACHER"]} />}>
          <Route
            path={ROUTES.TEACHER_DASHBOARD}
            element={
              <PlaceholderPage
                title="Teacher Dashboard"
                description="The instructor oversight dashboard is coming in Part 2."
              />
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
