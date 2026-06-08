// frontend/src/components/layout/TeacherLayout.tsx

import { useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { Badge } from "../ui/Badge";
import { ButtonLink } from "../ui/Button";
import { ROUTES } from "../../constants/routes";
import { brand, colors } from "../../styles/colors";
import { useAuthStore } from "../../store/authStore";

function Icon({ type }: { type: string }) {
  const paths: Record<string, ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
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
        <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5z" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.3 7A2 2 0 1 1 7.1 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z" />
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
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
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
      {paths[type]}
    </svg>
  );
}

const navSections = [
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

  const handleLogout = () => {
    logout();
    onClose?.();
    navigate(ROUTES.LOGIN);
  };

  return (
    <div className="flex h-full flex-col">
      <Link
        to={ROUTES.TEACHER_DASHBOARD}
        onClick={onClose}
        className="flex min-w-0 items-center px-1"
      >
        {!collapsed ? (
          <img
            src="/Logo.png"
            alt="TypeTrace"
            className="h-[30px] w-auto object-contain"
          />
        ) : (
          <span
            className="flex h-9 w-9 items-center justify-center rounded-md border text-[13px] font-bold"
            style={{
              borderColor: colors.surface[200],
              color: colors.brand,
              background: colors.brandSoft,
            }}
          >
            TT
          </span>
        )}
      </Link>

      <nav className="mt-7 grid gap-6">
        {navSections.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p
                className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: colors.text.muted }}
              >
                {section.label}
              </p>
            )}

            <div className="grid gap-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  onClick={onClose}
                  className="relative flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-bold transition"
                  style={({ isActive }) => ({
                    background: isActive ? brand.bgNavActive : "transparent",
                    color: isActive ? colors.brand : colors.text.secondary,
                  })}
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
                        style={{
                          background: isActive ? colors.brand : "transparent",
                        }}
                      />
                      <Icon type={item.icon} />
                      {!collapsed && (
                        <span className="flex-1">{item.label}</span>
                      )}
                      {!collapsed && item.badge && (
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
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto pt-6">
        <div
          className="rounded-md border p-3"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[100],
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: colors.text.secondary }}
            >
              {!collapsed ? "Teacher workspace" : "Teacher"}
            </p>

            {!collapsed && <Badge tone="brand">Reviewer</Badge>}
          </div>

          {!collapsed && (
            <>
              <p
                className="mt-2 truncate text-[14px] font-bold"
                style={{ color: colors.text.primary }}
              >
                {fullName}
              </p>
              <p
                className="mt-0.5 truncate text-[12px]"
                style={{ color: colors.text.secondary }}
              >
                {user?.email}
              </p>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 w-full rounded-md border px-4 py-2.5 text-[13px] font-bold transition hover:opacity-80"
          style={{
            borderColor: colors.surface[200],
            color: brand.aiAccent,
            background: colors.surface[50],
          }}
        >
          {collapsed ? "Out" : "Sign out"}
        </button>
      </div>
    </div>
  );
}

export default function TeacherLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarWidth = collapsed ? "lg:w-[88px]" : "lg:w-72";
  const pagePadding = collapsed ? "lg:pl-[88px]" : "lg:pl-72";

  return (
    <div className="min-h-screen" style={{ background: colors.surface[50] }}>
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden border-r bg-white px-4 py-5 transition-all duration-200 lg:block ${sidebarWidth}`}
        style={{ borderColor: colors.surface[200] }}
      >
        <div className="absolute right-3 top-5">
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="flex h-8 w-8 items-center justify-center rounded-md border transition"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.secondary,
              background: colors.surface[50],
              transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
            }}
            aria-label="Toggle sidebar"
          >
            <Icon type="collapse" />
          </button>
        </div>

        <SidebarContent collapsed={collapsed} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0"
            style={{ background: "rgba(15, 23, 42, 0.42)" }}
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />

          <aside
            className="absolute inset-y-0 left-0 w-[84%] max-w-[320px] border-r bg-white px-4 py-5"
            style={{ borderColor: colors.surface[200] }}
          >
            <div className="absolute right-4 top-5">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md border"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.secondary,
                }}
                aria-label="Close navigation"
              >
                <Icon type="close" />
              </button>
            </div>

            <SidebarContent
              collapsed={false}
              onClose={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className={pagePadding}>
        <header
          className="sticky top-0 z-30 border-b bg-white/95 px-4 py-3 backdrop-blur md:px-8"
          style={{ borderColor: colors.surface[200] }}
        >
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-md border lg:hidden"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
                background: colors.surface[50],
              }}
              aria-label="Open navigation"
            >
              <Icon type="menu" />
            </button>

            <div>
              <p
                className="text-[12px] font-bold uppercase tracking-[0.14em]"
                style={{ color: colors.text.secondary }}
              >
                Teacher console
              </p>

              <p
                className="text-[15px] font-bold"
                style={{ color: colors.text.primary }}
              >
                Course review and authorship audit workspace
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="relative hidden h-10 w-10 items-center justify-center rounded-md border md:flex"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                  background: colors.surface[50],
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
            </div>
          </div>
        </header>

        <main className="px-4 py-8 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
