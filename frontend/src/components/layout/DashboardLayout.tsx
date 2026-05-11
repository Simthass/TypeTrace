import React, { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import { brand, colors } from "../../styles/colors";

// ─── sidebar icons, kept these lightweight instead of importing a whole library ─
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

function HelpIcon() {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5" />
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

// ─── nav item types ───────────────────────────────────────────────────────────
interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: string | number;
}

// ─── reusable nav link component ─────────────────────────────────────────────
function SideNavItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      to={item.path}
      className="group flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 outline-none focus-visible:ring-2"
      style={{
        backgroundColor: isActive ? colors.surface[100] : "transparent",
        color: isActive ? colors.text.primary : colors.text.secondary,
        // focus ring color cant be done in tailwind with dynamic brand value
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.backgroundColor =
            colors.surface[50];
          (e.currentTarget as HTMLElement).style.color = colors.text.primary;
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.backgroundColor =
            "transparent";
          (e.currentTarget as HTMLElement).style.color = colors.text.secondary;
        }
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          style={{ color: isActive ? brand.action : "inherit" }}
          className="shrink-0 transition-colors"
        >
          {item.icon}
        </span>
        <span className="truncate">{item.label}</span>
      </div>

      {/* badge for things like session count */}
      {item.badge !== undefined && (
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
          style={{
            background: isActive ? brand.action : colors.surface[200],
            color: isActive ? "#fff" : colors.text.secondary,
          }}
        >
          {item.badge}
        </span>
      )}

      {/* chevron shows on hover, makes it feel more interactive */}
      {!item.badge && (
        <span
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: colors.text.secondary }}
        >
          <ChevronIcon />
        </span>
      )}
    </Link>
  );
}

// ─── section label divider ────────────────────────────────────────────────────
function NavSection({ label }: { label: string }) {
  return (
    <div className="px-3 pt-5 pb-1.5">
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
// MAIN LAYOUT
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardLayout() {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
    { label: "Help & Docs", path: "/#faq", icon: <HelpIcon /> },
  ];

  return (
    <div
      className="flex h-screen overflow-hidden font-sans"
      style={{ background: colors.surface[50] }}
    >
      {/* ══════════════════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════════════════ */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex flex-col
          w-[240px] shrink-0
          border-r border-surface-200 bg-white
          transition-transform duration-300
          md:static md:translate-x-0
          ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* ── Logo area ── */}
        <div
          className="flex items-center justify-center px-5 shrink-0 border-b border-surface-200"
          style={{ height: 60 }}
        >
          <Link
            to={ROUTES.HOME}
            className="flex items-center outline-none "
            aria-label="TypeTrace Home"
          >
            <img
              src="/Logo.png"
              alt="TypeTrace"
              className="h-9 w-auto object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </Link>
        </div>

        {/* ── New session button ── */}
        <div className="px-3 pt-4 pb-2 shrink-0">
          <Link
            to={ROUTES.EDITOR_NEW}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-[13px] font-semibold text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
            style={{
              background: brand.action,
              boxShadow: `0 2px 8px -2px ${brand.action}55`,
            }}
          >
            <PlusIcon />
            New Session
          </Link>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
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

        {/* ── User profile area — at the bottom like Vercel ── */}
        <div className="shrink-0 border-t border-surface-200 p-3">
          {/* usage bar — looks very SaaS, shows session limit */}
          <div className="px-2 pb-3">
            <div className="flex justify-between items-center mb-1.5">
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: colors.text.secondary }}
              >
                Sessions Used
              </span>
              <span
                className="text-[10px] font-bold"
                style={{ color: brand.action }}
              >
                4 / 10
              </span>
            </div>
            <div
              className="h-1 rounded-full overflow-hidden"
              style={{ background: colors.surface[200] }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: "40%", background: brand.action }}
              />
            </div>
          </div>

          <Link
            to={ROUTES.SETTINGS}
            className="flex items-center gap-3 px-2 py-2 rounded-lg transition-colors"
            style={{ color: colors.text.primary }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                colors.surface[50];
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            {/* avatar circle — using initials */}
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
              style={{ background: `${brand.action}18`, color: brand.action }}
            >
              SM
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span
                className="text-[12.5px] font-semibold truncate leading-tight"
                style={{ color: colors.text.primary }}
              >
                Simthass MYM
              </span>
              <span
                className="text-[11px] truncate"
                style={{ color: colors.text.secondary }}
              >
                Student Account
              </span>
            </div>
            {/* settings chevron */}
            <span style={{ color: colors.text.secondary }}>
              <ChevronIcon />
            </span>
          </Link>
        </div>
      </aside>

      {/* mobile overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* ══════════════════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* mobile top bar — only shows on small screens */}
        <div
          className="md:hidden shrink-0 flex items-center justify-between px-4 border-b border-surface-200 bg-white"
          style={{ height: 56 }}
        >
          <button
            onClick={() => setMobileNavOpen(true)}
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-surface-200 text-text-secondary"
          >
            <svg
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <img src="/Logo.png" alt="TypeTrace" className="h-6 w-auto" />
          <Link
            to={ROUTES.EDITOR_NEW}
            className="flex items-center justify-center h-8 w-8 rounded-lg text-white"
            style={{ background: brand.action }}
          >
            <PlusIcon />
          </Link>
        </div>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
