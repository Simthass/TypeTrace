// src/components/layout/DashboardLayout.tsx
// Part 3: Added "Join Course" nav item + page title mapping for /join-course
// This is the complete file — replace your existing DashboardLayout.tsx entirely.

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { colors } from "../../styles/colors";
import { ROUTES } from "../../constants/routes";

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
      <polyline points="10 9 9 9 8 9" />
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
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
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
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
// ← PART 3: Join Course icon
function JoinCourseIcon() {
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
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function SearchIcon() {
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
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
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
    if (location.pathname === "/join-course") return "Join a Course"; // ← PART 3
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

  const initials =
    `${user.first_name?.charAt(0) ?? ""}${user.last_name?.charAt(0) ?? ""}`.toUpperCase();

  const navItems = [
    { name: "Overview", path: ROUTES.DASHBOARD, icon: <OverviewIcon /> },
    { name: "Sessions", path: ROUTES.EDITOR, icon: <SessionsIcon /> },
    { name: "Certificates", path: "/certificates", icon: <CertificatesIcon /> },
    { name: "Analytics", path: "/analytics", icon: <AnalyticsIcon /> },
    { name: "Join Course", path: "/join-course", icon: <JoinCourseIcon /> }, // ← PART 3
  ];

  const secondaryItems = [
    { name: "Settings", path: ROUTES.SETTINGS, icon: <SettingsIcon /> },
    { name: "Help & Docs", path: "/help", icon: <HelpIcon /> },
  ];

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <div
      className="flex h-screen overflow-hidden font-sans"
      style={{ background: colors.surface[50] }}
    >
      {isResizing && (
        <div className="fixed inset-0 z-50 cursor-col-resize select-none" />
      )}

      {/* ══ SIDEBAR ══ */}
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

        {/* Search */}
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

        {/* New Session button */}
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

        {/* Nav */}
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
              </Link>
            );
          })}

          <SidebarSection label="Account" />
          {secondaryItems.map((item) => {
            const isActive = location.pathname === item.path;
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
                <span className="shrink-0">{item.icon}</span>
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

      {/* ══ MAIN CONTENT ══ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
          <div
            className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
            style={{ background: colors.text.primary }}
          >
            {initials}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
