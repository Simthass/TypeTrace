import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";

/**
 * RootLayout — wraps every public-facing page.
 * Header is fixed (h-16 = 64px), so main gets padding-top to avoid overlap.
 */
export default function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-50">
      <Header />

      {/* pt-16 offsets the fixed 64px header */}
      <main
        id="main-content"
        role="main"
        className="flex-1 pt-16"
        tabIndex={-1}
      >
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
