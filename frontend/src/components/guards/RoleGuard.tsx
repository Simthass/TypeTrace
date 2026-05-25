import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore, type UserRole } from "../../store/authStore";
import { ROUTES } from "../../constants/routes";

interface RoleGuardProps {
  allowedRoles: UserRole[];
}

export default function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const { isAuthenticated, user } = useAuthStore();

  // Not logged in at all — send to login
  if (!isAuthenticated || !user) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  // Logged in but wrong role — redirect to their correct home
  if (!allowedRoles.includes(user.role)) {
    const redirectTo =
      user.role === "TEACHER" ? ROUTES.TEACHER_DASHBOARD : ROUTES.DASHBOARD;
    return <Navigate to={redirectTo} replace />;
  }

  // All checks passed — render the child route
  return <Outlet />;
}
