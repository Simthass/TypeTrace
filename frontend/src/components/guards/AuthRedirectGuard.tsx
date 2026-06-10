// frontend/src/components/guards/AuthRedirectGuard.tsx

import { Navigate, Outlet, useLocation } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { useAuthStore } from "../../store/authStore";

function getDashboardPath(role?: string): string {
  return role === "TEACHER" ? ROUTES.TEACHER_DASHBOARD : ROUTES.DASHBOARD;
}

export default function AuthRedirectGuard() {
  const location = useLocation();
  const { isAuthenticated, user, hasHydrated } = useAuthStore();

  if (!hasHydrated) {
    return null;
  }

  if (isAuthenticated && user) {
    const state = location.state as { from?: string } | null;
    const redirectTo = state?.from || getDashboardPath(user.role);

    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
