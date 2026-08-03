// frontend/src/components/layout/RootLayout.tsx

import { Outlet } from "react-router-dom";

import Footer from "./Footer";
import Header from "./Header";
import { colors } from "../../styles/colors";

export default function RootLayout() {
  return (
    <div
      className="flex min-h-dvh min-w-0 flex-col antialiased"
      style={{ background: colors.surface[50] }}
    >
      <Header />

      <main
        id="main-content"
        role="main"
        className="min-w-0 flex-1 pt-16"
        tabIndex={-1}
      >
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
