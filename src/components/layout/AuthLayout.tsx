import { Outlet } from "react-router-dom";
import { colors } from "../../styles/colors";

export default function AuthLayout() {
  return (
    // This wrapper ensures the entire screen gets the solid background color
    // even if the content inside is smaller than the screen height.
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: colors.surface[50],
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* The router will inject LoginPage or RegisterPage here */}
      <Outlet />
    </main>
  );
}
