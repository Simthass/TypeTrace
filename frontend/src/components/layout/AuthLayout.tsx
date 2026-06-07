// frontend/src/components/layout/AuthLayout.tsx

import { Outlet } from "react-router-dom";

import { colors } from "../../styles/colors";

export default function AuthLayout() {
  return (
    <main
      className="min-h-screen w-full"
      style={{ backgroundColor: colors.surface[50] }}
    >
      <Outlet />
    </main>
  );
}
