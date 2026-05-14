import React, { useState, useEffect, useCallback, useRef } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import { useAuthStore } from "../../store/authStore";
import { colors, brand } from "../../styles/colors";

// ─── sidebar icons ────────────────
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
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function SessionsIcon() {
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
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function CertificatesIcon() {
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
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function AnalyticsIcon() {
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
      <path d="M3 3v18h18" />
      <path d="M18 9l-5 5-4-4-5 5" />
    </svg>
  );
}

function SettingsIcon() {
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function HelpIcon() {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

// ─── new icon for outgoing links ─────────────────────────────────────────────
function OutgoingArrowIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
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
export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const pageTitle = (() => {
    if (location.pathname === ROUTES.DASHBOARD) return "Overview";
    if (location.pathname === ROUTES.EDITOR) return "Sessions";
    if (location.pathname === "/certificates") return "Certificates";
    if (location.pathname === "/analytics") return "Analytics";
    return "Dashboard";
  })();

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
        if (w >= 250 && w <= 480) setSidebarWidth(w);
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

  const initials =
    `${user.first_name?.charAt(0) ?? ""}${user.last_name?.charAt(0) ?? ""}`.toUpperCase();

  const navItems = [
    { name: "Overview", path: ROUTES.DASHBOARD, icon: <OverviewIcon /> },
    {
      name: "Sessions",
      path: ROUTES.EDITOR,
      icon: <SessionsIcon />,
      badge: "6",
    },
    {
      name: "Certificates",
      path: "/certificates",
      icon: <CertificatesIcon />,
      badge: "4",
    },
    { name: "Analytics", path: "/analytics", icon: <AnalyticsIcon /> },
  ];

  // linking out of the dashboard layout
  const secondaryItems = [
    { name: "Settings", path: ROUTES.SETTINGS, icon: <SettingsIcon /> },
    { name: "Help & Docs", path: "/help", icon: <HelpIcon /> },
  ];

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
        {/* ── Workspace Identity ── */}
        <div className="pt-4 pb-2 px-3.5 flex items-center shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="h-6 w-6 rounded-md flex items-center justify-center text-[11px] font-bold text-white shrink-0"
              style={{ background: colors.text.primary }}
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
                background: colors.surface[50],
                borderColor: colors.surface[200],
                color: colors.text.secondary,
              }}
            >
              Student
            </span>
          </div>
        </div>

        <div className="px-3 pb-2.5 pt-1">
          <div className="relative flex items-center">
            <span
              className="absolute left-2.5"
              style={{ color: colors.text.secondary }}
            >
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Find session…"
              className="w-full h-8 pl-8 pr-8 rounded-md text-[13px] outline-none border transition-shadow"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
                background: colors.surface[50],
              }}
            />
            <span
              className="absolute right-2 text-[10px] font-mono border rounded px-1"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.secondary,
              }}
            >
              F
            </span>
          </div>
        </div>

        <div className="px-3 pb-2">
          <Link
            to={ROUTES.EDITOR_NEW}
            className="flex items-center justify-center gap-1.5 w-full h-8 rounded-md text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: colors.text.primary }}
          >
            <PlusIcon />
            New Session
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-1 flex flex-col">
          <SidebarSection label="Workspace" />
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-md text-[13.5px] font-medium transition-colors outline-none"
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
                <div className="flex items-center gap-2.5">
                  <span
                    className="shrink-0"
                    style={{
                      color: isActive ? colors.text.primary : "inherit",
                    }}
                  >
                    {item.icon}
                  </span>
                  {item.name}
                </div>
                {item.badge && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                    style={{
                      background: isActive
                        ? colors.surface[200]
                        : colors.surface[100],
                      color: colors.text.secondary,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          <SidebarSection label="Account" />
          {secondaryItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-md text-[13.5px] font-medium transition-colors outline-none group"
              style={{ color: colors.text.secondary }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  colors.surface[50];
                (e.currentTarget as HTMLElement).style.color =
                  colors.text.primary;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
                (e.currentTarget as HTMLElement).style.color =
                  colors.text.secondary;
              }}
            >
              <div className="flex items-center gap-2.5">
                <span className="shrink-0 group-hover:text-text-primary transition-colors">
                  {item.icon}
                </span>
                {item.name}
              </div>
              <span className="opacity-60 group-hover:opacity-100 transition-opacity">
                <OutgoingArrowIcon />
              </span>
            </Link>
          ))}
        </nav>

        <div
          className="shrink-0 border-t p-3"
          style={{ borderColor: colors.surface[200] }}
        >
          <div className="px-1 pb-3">
            <div className="flex justify-between items-center mb-1.5">
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: colors.text.secondary }}
              >
                Sessions this month
              </span>
              <span
                className="text-[10px] font-bold"
                style={{ color: colors.text.primary }}
              >
                6 / 10
              </span>
            </div>
            <div
              className="h-1 rounded-md overflow-hidden"
              style={{ background: colors.surface[200] }}
            >
              <div
                className="h-full rounded-md transition-all duration-500"
                style={{ width: "60%", background: colors.text.primary }}
              />
            </div>
          </div>

          <div
            className="flex items-center gap-2.5 px-2 py-2 rounded-md transition-colors cursor-pointer group"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                colors.surface[50];
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <div
              className="h-7 w-7 rounded-md flex items-center justify-center text-[11px] font-bold text-white shrink-0"
              style={{ background: colors.text.primary }}
            >
              {initials}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span
                className="text-[12.5px] font-semibold truncate leading-tight"
                style={{ color: colors.text.primary }}
              >
                {user.first_name} {user.last_name}
              </span>
              <span
                className="text-[11px] truncate"
                style={{ color: colors.text.secondary }}
              >
                {user.email}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                logout();
                navigate(ROUTES.HOME);
              }}
              title="Sign out"
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-surface-200"
              style={{ color: colors.text.secondary }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        <div
          className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize z-50 transition-colors hover:bg-black/10"
          onMouseDown={startResizing}
        />
      </aside>

      {/* ══════════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
        <header
          className="h-14 border-b flex items-center justify-between px-5 shrink-0 relative"
          style={{ borderColor: colors.surface[200], background: "#fff" }}
        >
          <div
            className="flex items-center gap-1.5 text-[13.5px]"
            style={{ color: colors.text.secondary }}
          >
            <span className="hover:text-black cursor-pointer transition-colors">
              TypeTrace
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            <span style={{ color: colors.text.primary, fontWeight: 500 }}>
              {pageTitle}
            </span>
          </div>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <span
              className="text-[13.5px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              {pageTitle}
            </span>
          </div>

          <Link
            to={ROUTES.EDITOR_NEW}
            className="flex items-center gap-1.5 h-8 px-3.5 rounded-md text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: colors.text.primary }}
          >
            <PlusIcon /> New Session
          </Link>
        </header>

        <main
          className="flex-1 overflow-y-auto"
          style={{ background: colors.surface[50] }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
