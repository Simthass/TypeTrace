// frontend/src/components/guards/AuthRedirectGuard.tsx

import { Navigate, Outlet } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { useAuthStore } from "../../store/authStore";

export default function AuthRedirectGuard() {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated && user) {
    const redirectTo =
      user.role === "TEACHER" ? ROUTES.TEACHER_DASHBOARD : ROUTES.DASHBOARD;

    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
