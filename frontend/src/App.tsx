// src/App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import RootLayout from "./components/layout/RootLayout";
import HomePage from "./pages/HomePage";
import HowItWorksPage from "./pages/HowItWorksPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import FeaturesPage from "./pages/FeaturesPage";
import AboutPage from "./pages/AboutPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyOtpPage from "./pages/VerifyOtpPage";
import DashboardLayout from "./components/layout/DashboardLayout";
import DashboardPage from "./pages/DashboardPage";
import EditorPage from "./pages/EditorPage";
import SessionsPage from "./pages/SessionsPage";
import { ROUTES } from "./constants/routes";
import AuthLayout from "./components/layout/AuthLayout";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import CertificatesPage from "./pages/CertificatesPage";
import AnalyticsPage from "./pages/AnalyticsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC ROUTES (With Header/Footer) */}
        <Route element={<RootLayout />}>
          <Route index element={<HomePage />} />
          <Route path={ROUTES.HOW_IT_WORKS} element={<HowItWorksPage />} />
          <Route path={ROUTES.FEATURES} element={<FeaturesPage />} />
          <Route path={ROUTES.ABOUT} element={<AboutPage />} />
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

        {/* AUTHENTICATED ROUTES (With Sidebar) */}
        <Route element={<DashboardLayout />}>
          <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
          <Route path={ROUTES.EDITOR} element={<SessionsPage />} />

          {/* REPLACE THE PLACEHOLDER WITH OUR NEW PAGE */}
          <Route path="/certificates" element={<CertificatesPage />} />

          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route
            path={ROUTES.SETTINGS}
            element={<PlaceholderPage title="Settings" />}
          />
        </Route>

        {/* AUTHENTICATION FLOW ROUTES */}
        <Route element={<AuthLayout />}>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
          <Route path={ROUTES.VERIFY_OTP} element={<VerifyOtpPage />} />
          <Route
            path={ROUTES.FORGOT_PASSWORD}
            element={<ForgotPasswordPage />}
          />
        </Route>

        {/* ZEN MODE EDITOR (Full Screen, No Navigation) */}
        <Route path={ROUTES.EDITOR_NEW} element={<EditorPage />} />
      </Routes>
    </BrowserRouter>
  );
}
