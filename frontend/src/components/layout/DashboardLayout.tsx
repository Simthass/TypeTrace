import { useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { brand, colors } from "../../styles/colors";
import { useAuthStore } from "../../store/authStore";

function Icon({ type, size = 16 }: { type: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    editor: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
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
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v6h6" />
        <path d="m9 15 2 2 4-5" />
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
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
    menu: (
      <>
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
      </>
    ),
    close: (
      <>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </>
    ),
    collapse: <path d="m15 18-6-6 6-6" />,
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </>
    ),
    user: (
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[type] ?? null}
    </svg>
  );
}

const navSections = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", path: ROUTES.DASHBOARD, icon: "dashboard" },
      { label: "New Session", path: ROUTES.EDITOR_NEW, icon: "editor" },
    ],
  },
  {
    label: "Evidence",
    items: [
      { label: "Sessions", path: ROUTES.SESSIONS, icon: "sessions" },
      {
        label: "Certificates",
        path: ROUTES.CERTIFICATES,
        icon: "certificates",
      },
      { label: "Analytics", path: ROUTES.ANALYTICS, icon: "analytics" },
    ],
  },
  {
    label: "Academic",
    items: [
      { label: "Join Course", path: ROUTES.JOIN_COURSE, icon: "course" },
      { label: "Settings", path: ROUTES.STUDENT_SETTINGS, icon: "settings" },
    ],
  },
];

function SidebarContent({
  collapsed,
  onClose,
}: {
  collapsed: boolean;
  onClose?: () => void;
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const firstName = user?.first_name || "Student";
  const lastName = user?.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const initials = `${firstName[0] || "S"}${lastName[0] || ""}`.toUpperCase();

  const handleLogout = () => {
    logout();
    onClose?.();
    navigate(ROUTES.LOGIN);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[52px] items-center px-4">
        <Link
          to={ROUTES.DASHBOARD}
          onClick={onClose}
          className="flex min-w-0 items-center gap-2"
        >
          {!collapsed ? (
            <>
              <img
                src="/Logo.png"
                alt="TypeTrace"
                className="h-7 w-auto object-contain"
              />
              <span
                className="rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.muted,
                }}
              >
                v1.0
              </span>
            </>
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-md text-[11px] font-extrabold tracking-tight"
              style={{ backgroundColor: colors.brandSoft, color: colors.brand }}
            >
              TT
            </div>
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-6">
          {navSections.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <p
                  className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: colors.text.muted }}
                >
                  {section.label}
                </p>
              )}

              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={collapsed ? item.label : undefined}
                    onClick={onClose}
                    className="relative flex h-9 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors duration-200 hover:bg-surface-100"
                    style={({ isActive }) => ({
                      backgroundColor: isActive
                        ? brand.bgNavActive
                        : "transparent",
                      color: isActive ? colors.brand : colors.text.secondary,
                      borderLeft: isActive
                        ? `3px solid ${colors.brand}`
                        : `3px solid transparent`,
                      paddingLeft: collapsed ? 7 : 9,
                      fontWeight: isActive ? 700 : 500,
                    })}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      <Icon type={item.icon} size={16} />
                    </span>
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div
        className="border-t p-3"
        style={{ borderColor: colors.surface[200] }}
      >
        {!collapsed ? (
          <div
            className="rounded-md border bg-white p-3"
            style={{ borderColor: colors.surface[200] }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[12px] font-bold"
                style={{
                  backgroundColor: colors.brandSoft,
                  color: colors.brand,
                }}
              >
                {initials}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[13px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  {fullName}
                </p>
                <p
                  className="truncate text-[11px]"
                  style={{ color: colors.text.muted }}
                >
                  {user?.email || "student@typetrace.local"}
                </p>
              </div>

              <span
                className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  backgroundColor: colors.brandSoft,
                  color: colors.brand,
                }}
              >
                {user?.role || "STUDENT"}
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 h-8 w-full rounded-md border bg-white text-[12px] font-semibold transition-colors hover:bg-surface-100"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.secondary,
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-md text-[12px] font-bold"
              style={{ backgroundColor: colors.brandSoft, color: colors.brand }}
            >
              {initials}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md px-1 py-0.5 text-[10px] font-semibold"
              style={{ color: colors.text.muted }}
            >
              Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuthStore();

  const firstName = user?.first_name || "Student";
  const lastName = user?.last_name || "";
  const initials = `${firstName[0] || "S"}${lastName[0] || ""}`.toUpperCase();

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: colors.surface[100] }}
    >
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden border-r bg-white transition-all duration-200 md:flex md:flex-col ${
          collapsed ? "w-[64px]" : "w-[240px]"
        }`}
        style={{ borderColor: colors.surface[200] }}
      >
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="absolute -right-3 top-16 z-50 flex h-5 w-5 items-center justify-center rounded-md border bg-white transition-colors duration-200 hover:bg-surface-100"
          style={{
            borderColor: colors.surface[200],
            color: colors.text.secondary,
            boxShadow: `0 1px 3px ${colors.shadow}`,
          }}
          aria-label="Toggle sidebar"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 200ms",
            }}
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <SidebarContent collapsed={collapsed} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0"
            style={{ backgroundColor: colors.shadowStrong }}
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />

          <aside
            className="absolute bottom-0 left-0 right-0 max-h-[84dvh] rounded-md border bg-white p-3"
            style={{
              borderColor: colors.surface[200],
              boxShadow: `0 1px 3px ${colors.shadow}`,
            }}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: colors.text.muted }}
              >
                Navigation
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md border bg-white"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.secondary,
                }}
                aria-label="Close navigation"
              >
                <Icon type="close" />
              </button>
            </div>
            <div className="max-h-[76dvh] overflow-y-auto">
              <SidebarContent
                collapsed={false}
                onClose={() => setMobileOpen(false)}
              />
            </div>
          </aside>
        </div>
      )}

      <div
        className={`min-h-screen transition-all duration-200 ${
          collapsed ? "md:ml-[64px]" : "md:ml-[240px]"
        }`}
      >
        <header
          className="sticky top-0 z-30 h-[52px] border-b bg-white/95 backdrop-blur-sm"
          style={{ borderColor: colors.surface[200] }}
        >
          <div className="flex h-[52px] items-center justify-between gap-4 px-4 md:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-md border bg-white md:hidden"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
                aria-label="Open navigation"
              >
                <Icon type="menu" />
              </button>

              <div>
                <p
                  className="text-[11px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: colors.text.muted }}
                >
                  Student Console
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="relative flex h-9 w-9 items-center justify-center rounded-md border bg-white transition-colors hover:bg-surface-100"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.secondary,
                }}
                aria-label="Notifications"
              >
                <Icon type="bell" />
                <span
                  className="absolute right-2 top-2 h-1.5 w-1.5 rounded-md"
                  style={{ backgroundColor: colors.amber }}
                />
              </button>

              <Link
                to={ROUTES.EDITOR_NEW}
                className="hidden h-9 items-center gap-2 rounded-md px-3 text-[13px] font-semibold text-white transition md:inline-flex"
                style={{ backgroundColor: colors.brand }}
              >
                <Icon type="plus" />
                New Session
              </Link>

              <div
                className="flex h-9 w-9 items-center justify-center rounded-md text-[12px] font-bold"
                style={{
                  backgroundColor: colors.brandSoft,
                  color: colors.brand,
                }}
                title={`${firstName} ${lastName}`.trim()}
              >
                {initials}
              </div>
            </div>
          </div>
        </header>

        <main
          className="min-h-[calc(100vh-52px)] p-6"
          style={{ backgroundColor: colors.surface[100] }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
