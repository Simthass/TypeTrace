import { Navigate } from "react-router-dom";

import { ROUTES } from "../constants/routes";
import { useAuthStore } from "../store/authStore";

export default function SettingsRedirectPage() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  const target =
    user.role === "TEACHER" ? ROUTES.TEACHER_SETTINGS : ROUTES.STUDENT_SETTINGS;

  return <Navigate to={target} replace />;
}
