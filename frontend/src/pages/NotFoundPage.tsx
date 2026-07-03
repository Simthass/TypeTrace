import { Link } from "react-router-dom";

import { ROUTES } from "../constants/routes";
import { brand, colors } from "../styles/colors";
import { useAuthStore } from "../store/authStore";

export default function NotFoundPage() {
  const { user, isAuthenticated } = useAuthStore();

  const dashboardPath =
    user?.role === "TEACHER" ? ROUTES.TEACHER_DASHBOARD : ROUTES.DASHBOARD;

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16"
      style={{ background: colors.surface[50] }}
    >
      <div
        className="pointer-events-none absolute left-[-10%] top-[10%] h-[34rem] w-[34rem] rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors.brandSoft} 0%, transparent 70%)`,
          filter: "blur(36px)",
        }}
      />

      <div
        className="pointer-events-none absolute right-[-10%] bottom-[4%] h-[28rem] w-[28rem] rounded-full"
        style={{
          background: `radial-gradient(circle, ${brand.humanBg} 0%, transparent 70%)`,
          filter: "blur(42px)",
        }}
      />

      <section className="relative z-10 mx-auto max-w-[780px] text-center">
        <Link to={ROUTES.HOME} className="inline-flex justify-center">
          <img
            src="/Logo.png"
            alt="TypeTrace"
            className="h-[38px] w-auto object-contain"
          />
        </Link>

        <div
          className="mx-auto mt-12 flex h-20 w-20 items-center justify-center rounded-3xl border"
          style={{
            borderColor: colors.surface[200],
            background: colors.brandSoft,
            color: colors.brand,
          }}
        >
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
        </div>

        <p
          className="mt-8 text-[12px] font-bold uppercase tracking-[0.2em]"
          style={{ color: colors.brand }}
        >
          404 · Route not found
        </p>

        <h1
          className="mt-4 text-[3rem] font-bold leading-[0.98] tracking-[-0.06em] md:text-[4.6rem]"
          style={{ color: colors.text.primary }}
        >
          This authorship trail does not exist.
        </h1>

        <p
          className="mx-auto mt-5 max-w-xl text-[15px] leading-7 md:text-[16px]"
          style={{ color: colors.text.secondary }}
        >
          The page may have moved, the session link may be invalid, or the
          certificate route may no longer be available.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to={isAuthenticated ? dashboardPath : ROUTES.HOME}
            className="rounded-md px-5 py-2.5 text-[14px] font-semibold text-white"
            style={{ background: colors.brand }}
          >
            {isAuthenticated ? "Return to dashboard" : "Return home"}
          </Link>

          <Link
            to={ROUTES.VERIFY_LOOKUP}
            className="rounded-md border px-5 py-2.5 text-[14px] font-semibold"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
              background: colors.surface[50],
            }}
          >
            Verify certificate
          </Link>
        </div>
      </section>
    </main>
  );
}
