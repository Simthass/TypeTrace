import { useMemo, useState, type ReactNode } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { colors } from "../../styles/colors";
import { useAuthStore } from "../../store/authStore";

// ─── COMPLETE ICON SET (Merged from both layouts) ──────────────────────────

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
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    review: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="m9 15 2 2 4-5" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1.4.9-1.4 1.7v.5" />
        <path d="M12 17h.01" />
      </>
    ),
    shortcuts: (
      <>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
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
    chevronDown: <path d="m6 9 6 6 6-6" />,
    external: (
      <>
        <path d="M15 3h6v6" />
        <path d="M10 14 21 3" />
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
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

// ─── NAVIGATION CONFIGURATION ──────────────────────────────────────────────

type TeacherNavItem = {
  label: string;
  path: string;
  icon: string;
  end?: boolean;
  externalHint?: boolean;
};

type TeacherNavSection = {
  label: string;
  items: TeacherNavItem[];
};

const navSections: TeacherNavSection[] = [
  {
    label: "Review",
    items: [
      {
        label: "Overview",
        path: ROUTES.TEACHER_DASHBOARD,
        icon: "dashboard",
        end: true,
      },
      {
        label: "Submissions",
        path: ROUTES.TEACHER_SUBMISSIONS,
        icon: "submissions",
      },
    ],
  },
  {
    label: "Academic",
    items: [
      { label: "Courses", path: ROUTES.TEACHER_COURSES, icon: "courses" },
      { label: "Students", path: ROUTES.TEACHER_STUDENTS, icon: "students" },
    ],
  },
  {
    label: "Account",
    items: [
      {
        label: "Settings",
        path: ROUTES.TEACHER_SETTINGS,
        icon: "settings",
        externalHint: true,
      },
    ],
  },
];

type ResourceItem = {
  label: string;
  path: string;
  icon: string;
  externalHint?: boolean;
};

const resourceLinks: ResourceItem[] = [
  {
    label: "Help & Docs",
    path: ROUTES.HELP_DOCS,
    icon: "help",
    externalHint: true,
  },
  {
    label: "Shortcuts",
    path: ROUTES.HELP_DOCS,
    icon: "shortcuts",
    externalHint: true,
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getPageTitle(pathname: string) {
  if (pathname === ROUTES.TEACHER_DASHBOARD) return "Teacher Dashboard";
  if (pathname.startsWith(ROUTES.TEACHER_COURSES.replace(":courseId", ""))) {
    return "Courses";
  }
  if (pathname.startsWith(ROUTES.TEACHER_SUBMISSIONS)) return "Submissions";
  if (pathname.startsWith(ROUTES.TEACHER_STUDENTS)) return "Students";
  if (pathname.startsWith(ROUTES.TEACHER_REVIEW.replace(":sessionId", ""))) {
    return "Review Session";
  }
  if (pathname.startsWith(ROUTES.TEACHER_SETTINGS)) return "Settings";
  return "Teacher Console";
}

// ─── SIDEBAR CONTENT ─────────────────────────────────────────────────────────

function SidebarContent({
  collapsed,
  onClose,
}: {
  collapsed: boolean;
  onClose?: () => void;
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const firstName = user?.first_name || "Teacher";
  const lastName = user?.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const initials = `${firstName[0] || "T"}${lastName[0] || ""}`.toUpperCase();

  const handleLogout = () => {
    logout();
    onClose?.();
    navigate(ROUTES.LOGIN);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-[52px] items-center px-4">
        <Link
          to={ROUTES.TEACHER_DASHBOARD}
          onClick={onClose}
          className={`flex min-w-0 items-center ${collapsed ? "justify-center" : "gap-2"}`}
        >
          {collapsed ? (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-md border"
              style={{
                backgroundColor: colors.surface[50],
                borderColor: colors.surface[200],
              }}
            >
              <img
                src="/QR-Logo.png"
                alt="TypeTrace"
                className="h-6 w-6 object-contain"
              />
            </span>
          ) : (
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
                Teacher
              </span>
            </>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
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
                    end={item.end}
                    title={collapsed ? item.label : undefined}
                    onClick={onClose}
                    className="relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors duration-200 hover:bg-surface-100"
                    style={({ isActive }) => ({
                      backgroundColor: isActive
                        ? colors.brandSoft
                        : "transparent",
                      color: isActive ? colors.brand : colors.text.secondary,
                      fontWeight: isActive ? 700 : 500,
                      justifyContent: collapsed ? "center" : "flex-start",
                    })}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      <Icon type={item.icon} size={16} />
                    </span>
                    {!collapsed && (
                      <>
                        <span className="min-w-0 flex-1 truncate">
                          {item.label}
                        </span>
                        {item.externalHint && (
                          <span
                            className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center opacity-70"
                            aria-hidden="true"
                          >
                            <Icon type="external" size={13} />
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}

          {/* Resources */}
          <div>
            {!collapsed && (
              <p
                className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: colors.text.muted }}
              >
                Resources
              </p>
            )}
            <div className="space-y-1">
              {resourceLinks.map((item) => (
                <Link
                  key={item.label}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  onClick={onClose}
                  className="flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors duration-200 hover:bg-surface-100"
                  style={{
                    color: colors.text.secondary,
                    justifyContent: collapsed ? "center" : "flex-start",
                  }}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    <Icon type={item.icon} size={16} />
                  </span>
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1 truncate">
                        {item.label}
                      </span>
                      {item.externalHint && (
                        <span
                          className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center opacity-70"
                          aria-hidden="true"
                        >
                          <Icon type="external" size={13} />
                        </span>
                      )}
                    </>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* User footer */}
      <div
        className="space-y-3 border-t p-3"
        style={{ borderColor: colors.surface[200] }}
      >
        {!collapsed ? (
          <div
            className="rounded-md border p-3"
            style={{
              backgroundColor: colors.surface[50],
              borderColor: colors.surface[200],
            }}
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
                  {user?.email || "teacher@typetrace.local"}
                </p>
              </div>

              <span
                className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  backgroundColor: colors.brandSoft,
                  color: colors.brand,
                }}
              >
                {user?.role || "TEACHER"}
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 flex h-8 w-full items-center justify-center gap-2 rounded-md border text-[12px] font-semibold transition-colors hover:bg-surface-100"
              style={{
                backgroundColor: colors.surface[50],
                borderColor: colors.surface[200],
                color: colors.text.secondary,
              }}
            >
              <Icon type="logout" size={13} />
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

// ─── MAIN LAYOUT ─────────────────────────────────────────────────────────────

export default function TeacherLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const title = useMemo(
    () => getPageTitle(location.pathname),
    [location.pathname],
  );
  const firstName = user?.first_name || "Teacher";
  const lastName = user?.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const initials = `${firstName[0] || "T"}${lastName[0] || ""}`.toUpperCase();

  const handleLogout = () => {
    setProfileOpen(false);
    logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: colors.surface[100] }}
    >
      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden border-r transition-all duration-200 md:flex md:flex-col ${
          collapsed ? "w-[64px]" : "w-[260px]"
        }`}
        style={{
          backgroundColor: colors.surface[50],
          borderColor: colors.surface[200],
        }}
      >
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="absolute -right-3 top-16 z-50 flex h-5 w-5 items-center justify-center rounded-md border transition-colors duration-200 hover:bg-surface-100"
          style={{
            backgroundColor: colors.surface[50],
            borderColor: colors.surface[200],
            color: colors.text.secondary,
            boxShadow: `0 1px 3px ${colors.shadow}`,
          }}
          aria-label="Toggle sidebar"
        >
          <span
            style={{
              display: "inline-flex",
              transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 200ms",
            }}
          >
            <Icon type="collapse" size={12} />
          </span>
        </button>

        <SidebarContent collapsed={collapsed} />
      </aside>

      {/* Mobile sidebar */}
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
            className="absolute bottom-0 left-0 right-0 max-h-[84dvh] rounded-md border p-3"
            style={{
              backgroundColor: colors.surface[50],
              borderColor: colors.surface[200],
              boxShadow: `0 1px 3px ${colors.shadow}`,
            }}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span
                className="text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: colors.text.muted }}
              >
                Teacher navigation
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md border"
                style={{
                  backgroundColor: colors.surface[50],
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

      {/* Main content area */}
      <div
        className={`min-h-screen transition-all duration-200 ${
          collapsed ? "md:ml-[64px]" : "md:ml-[260px]"
        }`}
      >
        {/* Top header bar */}
        <header
          className="sticky top-0 z-30 h-[56px] border-b"
          style={{
            backgroundColor: colors.surface[50],
            borderColor: colors.surface[200],
          }}
        >
          <div className="flex h-[56px] items-center justify-between gap-4 px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-md border md:hidden"
                style={{
                  backgroundColor: colors.surface[50],
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
                aria-label="Open navigation"
              >
                <Icon type="menu" />
              </button>

              <div className="min-w-0">
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: colors.text.muted }}
                >
                  Teacher Console
                </p>
                <h1
                  className="truncate text-[18px] font-bold tracking-[-0.03em]"
                  style={{ color: colors.text.primary }}
                >
                  {title}
                </h1>
              </div>
            </div>

            {/* Search bar */}
            <div className="hidden min-w-0 flex-1 justify-center md:flex">
              <div
                className="flex h-9 w-full max-w-[440px] items-center gap-2 rounded-md border px-3"
                style={{
                  backgroundColor: colors.surface[100],
                  borderColor: colors.surface[200],
                  color: colors.text.muted,
                }}
              >
                <Icon type="search" size={15} />
                <input
                  type="search"
                  placeholder="Search submissions, students, courses"
                  className="h-full flex-1 bg-transparent text-[13px] outline-none placeholder:text-text-muted"
                  style={{ color: colors.text.primary }}
                />
                <span
                  className="rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{
                    borderColor: colors.surface[200],
                    color: colors.text.muted,
                  }}
                >
                  ⌘K
                </span>
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {/* Notifications */}
              <button
                type="button"
                className="relative flex h-9 w-9 items-center justify-center rounded-md border transition-colors hover:bg-surface-100"
                style={{
                  backgroundColor: colors.surface[50],
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

              {/* New Course CTA */}
              <Link
                to={`${ROUTES.TEACHER_COURSES}?createCourse=1`}
                className="hidden h-9 items-center gap-2 rounded-md px-3 text-[13px] font-semibold transition hover:opacity-90 md:inline-flex"
                style={{
                  backgroundColor: colors.brand,
                  color: colors.text.light,
                }}
              >
                <Icon type="plus" />
                Create course
              </Link>

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileOpen((value) => !value)}
                  className="flex h-9 items-center gap-1.5 rounded-md border pl-1 pr-2 transition-colors hover:bg-surface-100"
                  style={{
                    backgroundColor: colors.surface[50],
                    borderColor: colors.surface[200],
                  }}
                  aria-label="Account menu"
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[12px] font-bold"
                    style={{
                      backgroundColor: colors.brandSoft,
                      color: colors.brand,
                    }}
                  >
                    {initials}
                  </span>
                  <span style={{ color: colors.text.muted }}>
                    <Icon type="chevronDown" size={14} />
                  </span>
                </button>

                {profileOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-30 cursor-default"
                      onClick={() => setProfileOpen(false)}
                      aria-label="Close menu"
                    />
                    <div
                      className="absolute right-0 top-11 z-40 w-56 rounded-md border p-1"
                      style={{
                        backgroundColor: colors.surface[50],
                        borderColor: colors.surface[200],
                        boxShadow: `0 12px 32px ${colors.shadowStrong}`,
                      }}
                    >
                      <div
                        className="border-b px-3 py-2"
                        style={{ borderColor: colors.surface[200] }}
                      >
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
                          {user?.email || "teacher@typetrace.local"}
                        </p>
                      </div>
                      <Link
                        to={ROUTES.TEACHER_SETTINGS}
                        onClick={() => setProfileOpen(false)}
                        className="mt-1 flex h-9 items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors hover:bg-surface-100"
                        style={{ color: colors.text.secondary }}
                      >
                        <Icon type="settings" size={15} />
                        Settings
                        <span className="ml-auto">
                          <Icon type="external" size={13} />
                        </span>
                      </Link>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors hover:bg-surface-100"
                        style={{ color: colors.text.secondary }}
                      >
                        <Icon type="logout" size={15} />
                        Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main
          className="min-h-[calc(100vh-56px)] p-4 md:p-6"
          style={{ backgroundColor: colors.surface[100] }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
