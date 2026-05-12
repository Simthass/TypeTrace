import React, { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import { useAuthStore } from "../../store/authStore";

// ─── sidebar icons ────────────────────────────────────────────────────────────
function HomeIcon() {
  return (
    <svg
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function SessionsIcon() {
  return (
    <svg
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function CertIcon() {
  return (
    <svg
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M3 3v18h18" />
      <path d="M18 9l-5 5-4-4-5 5" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
      strokeWidth="2"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      viewBox="0 0 24 24"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

// ─── types ────────────────────────────────────────────────────────────────────
interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: string | number;
}

// ─── reusable nav component (Vercel style hover) ──────────────────────────────
function SideNavItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      to={item.path}
      // using rounded-md here like vercel sidebar
      className={`group flex items-center justify-between gap-2.5 px-3 py-2 rounded-md text-[13.5px] font-medium transition-all duration-150 outline-none
        ${isActive ? "bg-surface-100 text-text-primary" : "text-text-secondary hover:bg-surface-50 hover:text-text-primary"}
      `}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className={`shrink-0 transition-colors ${isActive ? "text-brand" : "text-text-secondary group-hover:text-text-primary"}`}
        >
          {item.icon}
        </span>
        <span className="truncate tracking-tight">{item.label}</span>
      </div>

      {item.badge !== undefined && (
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${isActive ? "bg-brand text-white" : "bg-surface-200 text-text-secondary"}`}
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}

// ─── section label divider ────────────────────────────────────────────────────
function NavSection({ label }: { label: string }) {
  return (
    <div className="px-3 pt-5 pb-2">
      <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN LAYOUT
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // iam grabbing the real user from zustand now instead of hardcoding
  const { user, logout } = useAuthStore();

  // security check: if no user in memory, kick back to login
  useEffect(() => {
    if (!user) {
      navigate(ROUTES.LOGIN);
    }
  }, [user, navigate]);

  const primaryNav: NavItem[] = [
    { label: "Overview", path: ROUTES.DASHBOARD, icon: <HomeIcon /> },
    {
      label: "My Sessions",
      path: ROUTES.EDITOR,
      icon: <SessionsIcon />,
      badge: 4,
    },
    {
      label: "Certificates",
      path: ROUTES.REPORTS,
      icon: <CertIcon />,
      badge: 2,
    },
    { label: "Analytics", path: "/analytics", icon: <AnalyticsIcon /> },
  ];

  const secondaryNav: NavItem[] = [
    { label: "Settings", path: ROUTES.SETTINGS, icon: <SettingsIcon /> },
  ];

  // Helper to get initials
  const getInitials = () => {
    if (!user) return "U";
    const first = user.first_name ? user.first_name.charAt(0) : "";
    const last = user.last_name ? user.last_name.charAt(0) : "";
    return `${first}${last}`.toUpperCase();
  };

  if (!user) return null; // prevent flicker before redirect

  return (
    // changed bg to surface-50 so the whole app has that smooth light gray vercel background
    <div className="flex h-screen overflow-hidden font-sans bg-[#fafafa] selection:bg-brand selection:text-white">
      {/* ─── SIDEBAR (White background to contrast with main area) ─── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex flex-col
          w-[250px] shrink-0
          "bg-[#fafafa] border-r border-surface-200
          transition-transform duration-300
          md:static md:translate-x-0
          ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo Area */}
        <div className="flex items-center justify-center px-6 shrink-0 h-[64px] border-b border-surface-200">
          <Link to={ROUTES.HOME} className="flex items-center outline-none">
            <img
              src="/Logo.png"
              alt="TypeTrace"
              className="h-9 w-auto object-contain"
            />
          </Link>
        </div>

        {/* Action Button */}
        <div className="px-4 pt-5 pb-2 shrink-0">
          <Link
            to={ROUTES.EDITOR_NEW}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-md text-[13px] font-semibold bg-text-primary text-white transition-all hover:bg-black active:scale-[0.98] shadow-sm"
          >
            <PlusIcon />
            New Session
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <NavSection label="Workspace" />
          <div className="flex flex-col gap-0.5">
            {primaryNav.map((item) => (
              <SideNavItem
                key={item.path}
                item={item}
                isActive={location.pathname === item.path}
              />
            ))}
          </div>

          <NavSection label="Account" />
          <div className="flex flex-col gap-0.5">
            {secondaryNav.map((item) => (
              <SideNavItem
                key={item.path}
                item={item}
                isActive={location.pathname === item.path}
              />
            ))}
          </div>
        </nav>

        {/* ── Real User Profile Area (Vercel Style) ── */}
        <div className="shrink-0 border-t border-surface-200 p-4">
          <Link
            to={ROUTES.SETTINGS}
            className="flex items-center gap-3 p-2 -mx-2 rounded-md hover:bg-surface-50 transition-colors group"
          >
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 bg-brand-light text-brand">
              {getInitials()}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[13px] font-semibold text-text-primary truncate leading-tight group-hover:text-brand transition-colors">
                {user.first_name} {user.last_name}
              </span>
              <span className="text-[11.5px] text-text-secondary truncate mt-0.5">
                {user.email}{" "}
                {/* now showing real email instead of hardcoded text */}
              </span>
            </div>
            <span className="text-text-secondary group-hover:text-text-primary transition-colors">
              <ChevronIcon />
            </span>
          </Link>
        </div>
      </aside>

      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-text-primary/20 md:hidden backdrop-blur-sm"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* ─── MAIN CONTENT ─── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Mobile Top Bar */}
        <div className="md:hidden shrink-0 flex items-center justify-between px-4 h-[60px] border-b border-surface-200 bg-white">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="p-2 -ml-2 text-text-secondary rounded-md hover:bg-surface-50"
          >
            <svg
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <img src="/Logo.png" alt="TypeTrace" className="h-6 w-auto" />
          <div className="w-8" /> {/* spacer for center alignment */}
        </div>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
