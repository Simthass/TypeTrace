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
import VerifyOtpPage from "./pages/VerifyOtpPage"; // <-- 1. IMPORT THIS
import DashboardLayout from "./components/layout/DashboardLayout";
import DashboardPage from "./pages/DashboardPage";
import EditorPage from "./pages/EditorPage";
import { ROUTES } from "./constants/routes";
import AuthLayout from "./components/layout/AuthLayout";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";

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
            path={ROUTES.EDITOR}
            element={
              <PlaceholderPage
                title="Sessions"
                description="Session list — coming soon."
              />
            }
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
          {/* ... settings etc ... */}
        </Route>

        {/* AUTHENTICATION FLOW ROUTES */}
        <Route element={<AuthLayout />}>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
          <Route path={ROUTES.VERIFY_OTP} element={<VerifyOtpPage />} />{" "}
          {/* <-- 2. ADD THIS ROUTE */}
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
