// src/components/layout/TeacherLayout.tsx
// =============================================================================
// Teacher app shell — resizable sidebar + top header, same pattern as
// DashboardLayout but with teacher-specific nav items and a blue identity chip.
// =============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { ROUTES } from "../../constants/routes";
import { colors } from "../../styles/colors";

// ─────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────

function OverviewIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}
function CoursesIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}
function SubmissionsIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="12" y2="17" />
    </svg>
  );
}
function StudentsIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function SidebarSection({ label }: { label: string }) {
  return (
    <div className="px-3 pt-4 pb-1">
      <span
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: colors.text.secondary }}
      >
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT
// ─────────────────────────────────────────────────────────────────────────────

export default function TeacherLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) navigate(ROUTES.LOGIN);
  }, [user, navigate]);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => setIsResizing(false), []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (isResizing) {
        const w = e.clientX;
        if (w >= 220 && w <= 480) setSidebarWidth(w);
      }
    },
    [isResizing],
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  if (!user) return null;

  const initials = `${user.first_name?.charAt(0) ?? ""}`.toUpperCase();

  // Page title from pathname
  const pageTitle = (() => {
    if (location.pathname === ROUTES.TEACHER_DASHBOARD) return "Overview";
    if (location.pathname.startsWith(ROUTES.TEACHER_COURSES.split("/:")[0]))
      return "Courses";
    if (location.pathname.startsWith("/teacher/students")) return "Students";
    if (location.pathname.startsWith("/teacher/review"))
      return "Session Review";
    return "Teacher Dashboard";
  })();

  const navItems = [
    {
      name: "Overview",
      path: ROUTES.TEACHER_DASHBOARD,
      icon: <OverviewIcon />,
    },
    { name: "Courses", path: ROUTES.TEACHER_COURSES, icon: <CoursesIcon /> },
    {
      name: "Submissions",
      path: "/teacher/submissions",
      icon: <SubmissionsIcon />,
    },
    { name: "Students", path: "/teacher/students", icon: <StudentsIcon /> },
  ];

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  const TEACHER_BLUE = "#0369a1";

  return (
    <div
      className="flex h-screen overflow-hidden font-sans"
      style={{ background: colors.surface[50] }}
    >
      {isResizing && (
        <div className="fixed inset-0 z-50 cursor-col-resize select-none" />
      )}

      {/* ══════════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════════ */}
      <aside
        ref={sidebarRef}
        style={{
          width: sidebarWidth,
          background: "#fff",
          borderColor: colors.surface[200],
        }}
        className="shrink-0 flex flex-col border-r relative z-40 transition-none"
      >
        {/* Identity chip */}
        <div className="pt-4 pb-2 px-3.5 flex items-center shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="h-6 w-6 rounded-md flex items-center justify-center text-[11px] font-bold text-white shrink-0"
              style={{ background: TEACHER_BLUE }}
            >
              {initials}
            </div>
            <span
              className="text-[13.5px] font-semibold truncate"
              style={{ color: colors.text.primary }}
            >
              {user.first_name}'s Workspace
            </span>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0"
              style={{
                background: "#f0f9ff",
                borderColor: "#bae6fd",
                color: TEACHER_BLUE,
              }}
            >
              Teacher
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-1 flex flex-col">
          <SidebarSection label="Oversight" />
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== ROUTES.TEACHER_DASHBOARD &&
                location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.name}
                to={item.path}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13.5px] font-medium transition-colors outline-none"
                style={{
                  background: isActive ? colors.surface[100] : "transparent",
                  color: isActive ? colors.text.primary : colors.text.secondary,
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.background =
                      colors.surface[50];
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                }}
              >
                <span
                  className="shrink-0"
                  style={{ color: isActive ? TEACHER_BLUE : "inherit" }}
                >
                  {item.icon}
                </span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div
          className="px-2 pb-4 pt-2 border-t"
          style={{ borderColor: colors.surface[200] }}
        >
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13.5px] font-medium transition-colors"
            style={{ color: colors.text.secondary }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                colors.surface[50];
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <LogoutIcon />
            Sign Out
          </button>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={startResizing}
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-100 transition-colors z-50"
        />
      </aside>

      {/* ══════════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="shrink-0 h-12 flex items-center justify-between px-6 bg-white border-b"
          style={{ borderColor: colors.surface[200] }}
        >
          <h1
            className="text-[14px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            {pageTitle}
          </h1>
          <div className="flex items-center gap-3">
            <span
              className="text-[12px] px-2 py-0.5 rounded font-medium"
              style={{ background: "#f0f9ff", color: TEACHER_BLUE }}
            >
              Instructor View
            </span>
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
              style={{ background: TEACHER_BLUE }}
            >
              {initials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
