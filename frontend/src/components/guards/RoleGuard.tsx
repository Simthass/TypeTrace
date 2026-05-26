import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore, type UserRole } from "../../store/authStore";
import { ROUTES } from "../../constants/routes";

interface RoleGuardProps {
  allowedRoles: UserRole[];
}

export default function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const { isAuthenticated, user } = useAuthStore();

  // Not logged in at all
  if (!isAuthenticated || !user) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  // Role may be undefined in old persisted state — treat as STUDENT
  const role: UserRole = user.role ?? "STUDENT";

  // Wrong role for this section
  if (!allowedRoles.includes(role)) {
    const redirectTo =
      role === "TEACHER" ? ROUTES.TEACHER_DASHBOARD : ROUTES.DASHBOARD;
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
