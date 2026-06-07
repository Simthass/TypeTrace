// frontend/src/components/layout/DashboardLayout.tsx

import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { colors, brand } from "../../styles/colors";
import { useAuthStore } from "../../store/authStore";

function Icon({ type }: { type: string }) {
  const paths: Record<string, React.ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </>
    ),
    editor: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>
    ),
    sessions: (
      <>
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M3 6h.01" />
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
      </>
    ),
    certificates: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    analytics: (
      <>
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-7" />
      </>
    ),
    course: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
      </>
    ),
    settings: (
      <>
        <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5z" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.3 7A2 2 0 1 1 7.1 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z" />
      </>
    ),
  };

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[type]}
    </svg>
  );
}

const navItems = [
  { label: "Overview", path: ROUTES.DASHBOARD, icon: "dashboard" },
  { label: "New Session", path: ROUTES.EDITOR_NEW, icon: "editor" },
  { label: "Sessions", path: ROUTES.SESSIONS, icon: "sessions" },
  { label: "Certificates", path: ROUTES.CERTIFICATES, icon: "certificates" },
  { label: "Analytics", path: ROUTES.ANALYTICS, icon: "analytics" },
  { label: "Join Course", path: ROUTES.JOIN_COURSE, icon: "course" },
  { label: "Settings", path: ROUTES.SETTINGS, icon: "settings" },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const fullName =
    `${user?.first_name || "Student"} ${user?.last_name || ""}`.trim();

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <div className="min-h-screen" style={{ background: colors.surface[50] }}>
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r bg-white px-4 py-5 lg:block"
        style={{ borderColor: colors.surface[200] }}
      >
        <Link to={ROUTES.DASHBOARD} className="flex items-center gap-3 px-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-md text-[13px] font-bold text-white"
            style={{ background: colors.brand }}
          >
            TT
          </span>
          <div>
            <p
              className="text-[14px] font-bold"
              style={{ color: colors.text.primary }}
            >
              TypeTrace
            </p>
            <p className="text-[11px]" style={{ color: colors.text.secondary }}>
              Student workspace
            </p>
          </div>
        </Link>

        <nav className="mt-7 grid gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-semibold transition"
              style={({ isActive }) => ({
                background: isActive ? brand.bgNavActive : "transparent",
                color: isActive ? colors.brand : colors.text.secondary,
              })}
            >
              <Icon type={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div
          className="absolute bottom-5 left-4 right-4 rounded-md border p-3"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[50],
          }}
        >
          <p
            className="truncate text-[13px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            {fullName}
          </p>
          <p
            className="truncate text-[12px]"
            style={{ color: colors.text.secondary }}
          >
            {user?.email}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 w-full rounded-md border px-3 py-2 text-[12px] font-semibold"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
              background: "#FFFFFF",
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header
          className="sticky top-0 z-30 border-b bg-white/95 px-4 py-3 backdrop-blur lg:px-6"
          style={{ borderColor: colors.surface[200] }}
        >
          <div className="flex items-center justify-between gap-3">
            <Link
              to={ROUTES.DASHBOARD}
              className="flex items-center gap-3 lg:hidden"
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-md text-[12px] font-bold text-white"
                style={{ background: colors.brand }}
              >
                TT
              </span>
              <span
                className="text-[14px] font-bold"
                style={{ color: colors.text.primary }}
              >
                TypeTrace
              </span>
            </Link>

            <div className="hidden lg:block">
              <p
                className="text-[12px]"
                style={{ color: colors.text.secondary }}
              >
                Signed in as
              </p>
              <p
                className="text-[13px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                {fullName}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to={ROUTES.EDITOR_NEW}
                className="rounded-md px-3 py-2 text-[12px] font-semibold text-white"
                style={{ background: colors.brand }}
              >
                New Session
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md border px-3 py-2 text-[12px] font-semibold lg:hidden"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              >
                Logout
              </button>
            </div>
          </div>

          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className="shrink-0 rounded-md border px-3 py-2 text-[12px] font-semibold"
                style={({ isActive }) => ({
                  borderColor: isActive ? colors.brand : colors.surface[200],
                  background: isActive ? brand.bgNavActive : "#FFFFFF",
                  color: isActive ? colors.brand : colors.text.secondary,
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
