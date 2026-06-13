import { useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { Badge } from "../../components/ui/Badge";
import { ButtonLink } from "../../components/ui/Button";
import { ROUTES } from "../../constants/routes";
import { brand, colors } from "../../styles/colors";
import { useAuthStore } from "../../store/authStore";

// ─── Icon set ─────────────────────────────────────────────────────────────────

function Icon({ type }: { type: string }) {
  const paths: Record<string, ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    courses: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
      </>
    ),
    submissions: (
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </>
    ),
    students: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
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
      aria-hidden="true"
    >
      {paths[type] ?? null}
    </svg>
  );
}

// ─── Nav structure ────────────────────────────────────────────────────────────

type TeacherNavItem = {
  label: string;
  path: string;
  icon: string;
  badge?: string;
};
type TeacherNavSection = { label: string; items: TeacherNavItem[] };

const navSections: TeacherNavSection[] = [
  {
    label: "Review",
    items: [
      { label: "Overview", path: ROUTES.TEACHER_DASHBOARD, icon: "dashboard" },
      {
        label: "Submissions",
        path: ROUTES.TEACHER_SUBMISSIONS,
        icon: "submissions",
        badge: "Queue",
      },
    ],
  },
  {
    label: "Courses",
    items: [
      { label: "Courses", path: ROUTES.TEACHER_COURSES, icon: "courses" },
      { label: "Students", path: ROUTES.TEACHER_STUDENTS, icon: "students" },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Settings", path: ROUTES.TEACHER_SETTINGS, icon: "settings" },
    ],
  },
];

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({
  collapsed,
  onClose,
}: {
  collapsed: boolean;
  onClose?: () => void;
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const fullName =
    `${user?.first_name || "Teacher"} ${user?.last_name || ""}`.trim();
  const initials =
    `${(user?.first_name || "T")[0]}${(user?.last_name || "")[0] || ""}`.toUpperCase();

  const handleLogout = () => {
    logout();
    onClose?.();
    navigate(ROUTES.LOGIN);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center px-2">
        <Link
          to={ROUTES.TEACHER_DASHBOARD}
          onClick={onClose}
          className="flex min-w-0 items-center"
        >
          {!collapsed ? (
            <img
              src="/Logo.png"
              alt="TypeTrace"
              className="h-8 w-auto object-contain"
            />
          ) : (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[12px] font-extrabold"
              style={{ background: colors.brand, color: colors.text.light }}
            >
              TT
            </div>
          )}
        </Link>
      </div>

      <div
        className="mb-4 mt-1 h-px"
        style={{ background: colors.surface[200] }}
      />

      {/* Nav */}
      <nav className="flex-1 space-y-5 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p
                className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.16em]"
                style={{ color: colors.text.muted }}
              >
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  onClick={onClose}
                  className="relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors duration-100"
                  style={({ isActive }) => ({
                    background: isActive ? brand.bgNavActive : "transparent",
                    color: isActive ? colors.brand : colors.text.secondary,
                  })}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span
                          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
                          style={{ background: colors.brand }}
                        />
                      )}
                      <span className="shrink-0">
                        <Icon type={item.icon} />
                      </span>
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && (
                            <span
                              className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                              style={{
                                background: brand.suspiciousBg,
                                color: brand.suspiciousText,
                              }}
                            >
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Profile card */}
      <div
        className="mt-4 border-t pt-4"
        style={{ borderColor: colors.surface[200] }}
      >
        {!collapsed ? (
          <div
            className="rounded-xl border p-3"
            style={{
              borderColor: colors.surface[200],
              background: colors.surface[100],
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                style={{ background: colors.brandSoft, color: colors.brand }}
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
                  {user?.email}
                </p>
              </div>
              <Badge tone="brand">
                <span className="text-[9px]">Teacher</span>
              </Badge>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 w-full rounded-lg border px-3 py-2 text-[12px] font-semibold transition hover:opacity-80"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.secondary,
                background: colors.surface[50],
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold"
              style={{ background: colors.brandSoft, color: colors.brand }}
            >
              {initials}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-[10px] font-semibold"
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

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TeacherLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuthStore();

  const sidebarW = collapsed ? 72 : 256;

  return (
    <div
      className="flex min-h-screen"
      style={{ background: colors.surface[150] }}
    >
      {/* Desktop sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r bg-white px-3 py-4 transition-all duration-200 lg:flex"
        style={{ width: sidebarW, borderColor: colors.surface[200] }}
      >
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3 top-[60px] flex h-6 w-6 items-center justify-center rounded-full border bg-white shadow-sm transition hover:shadow"
          style={{
            borderColor: colors.surface[200],
            color: colors.text.secondary,
          }}
          aria-label="Toggle sidebar"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <SidebarContent collapsed={collapsed} />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0"
            style={{ background: "rgba(15,23,42,0.4)" }}
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <aside
            className="absolute inset-y-0 left-0 w-[280px] border-r bg-white px-3 py-4"
            style={{ borderColor: colors.surface[200] }}
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-lg border"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.secondary,
              }}
            >
              <Icon type="close" />
            </button>
            <SidebarContent
              collapsed={false}
              onClose={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col" style={{ marginLeft: sidebarW }}>
        <header
          className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur-sm"
          style={{ borderColor: colors.surface[200] }}
        >
          <div className="flex h-14 items-center justify-between gap-4 px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border lg:hidden"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
              }}
            >
              <Icon type="menu" />
            </button>

            <p
              className="hidden text-[11px] font-bold uppercase tracking-[0.16em] lg:block"
              style={{ color: colors.text.muted }}
            >
              Teacher console
            </p>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border transition hover:bg-slate-50"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.secondary,
                }}
                aria-label="Notifications"
              >
                <Icon type="bell" />
                <span
                  className="absolute right-2 top-2 h-2 w-2 rounded-full"
                  style={{ background: brand.suspiciousAccent }}
                />
              </button>
              <ButtonLink to={ROUTES.TEACHER_COURSES} size="md">
                Manage Courses
              </ButtonLink>
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold"
                style={{ background: colors.brandSoft, color: colors.brand }}
              >
                {`${(user?.first_name || "T")[0]}${(user?.last_name || "")[0] || ""}`.toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
