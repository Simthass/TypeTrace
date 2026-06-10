// frontend/src/components/guards/RoleGuard.tsx

import { Navigate, Outlet, useLocation } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { useAuthStore, type UserRole } from "../../store/authStore";

interface RoleGuardProps {
  allowedRoles: UserRole[];
}

function getDashboardPath(role?: UserRole): string {
  return role === "TEACHER" ? ROUTES.TEACHER_DASHBOARD : ROUTES.DASHBOARD;
}

export default function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const location = useLocation();
  const { isAuthenticated, user, hasHydrated } = useAuthStore();

  if (!hasHydrated) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return (
      <Navigate to={ROUTES.LOGIN} replace state={{ from: location.pathname }} />
    );
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  return <Outlet />;
}
