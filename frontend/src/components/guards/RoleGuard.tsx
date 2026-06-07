// frontend/src/components/guards/RoleGuard.tsx

import { Navigate, Outlet, useLocation } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { useAuthStore, type UserRole } from "../../store/authStore";

interface RoleGuardProps {
  allowedRoles: UserRole[];
}

export default function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return (
      <Navigate to={ROUTES.LOGIN} replace state={{ from: location.pathname }} />
    );
  }

  if (!allowedRoles.includes(user.role)) {
    const redirectTo =
      user.role === "TEACHER" ? ROUTES.TEACHER_DASHBOARD : ROUTES.DASHBOARD;

    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
