// frontend/src/components/layout/Header.tsx

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { PUBLIC_NAV, ROUTES } from "../../constants/routes";
import { brand, colors } from "../../styles/colors";
import { useAuthStore } from "../../store/authStore";

export const HEADER_HEIGHT = 60;

const I = {
  grid: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="5.2"
        height="5.2"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <rect
        x="7.8"
        y="1"
        width="5.2"
        height="5.2"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <rect
        x="1"
        y="7.8"
        width="5.2"
        height="5.2"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <rect
        x="7.8"
        y="7.8"
        width="5.2"
        height="5.2"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </svg>
  ),

  plus: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 2.5v9M2.5 7h9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  ),

  gear: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M7 1.5V3M7 11v1.5M1.5 7H3M11 7h1.5M3.4 3.4l1.05 1.05M9.55 9.55l1.05 1.05M10.6 3.4L9.55 4.45M4.45 9.55L3.4 10.6"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  ),

  help: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M5.5 5.4a1.5 1.5 0 0 1 2.9.5c0 1-1.4 1.5-1.4 2.6"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <circle cx="7" cy="10.2" r=".7" fill="currentColor" />
    </svg>
  ),

  signout: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5.5 2H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M9.5 4.5L12 7l-2.5 2.5M12 7H5.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),

  chevron: (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 3.5L5 6.5L8 3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),

  arrow: (
    <svg
      width="11"
      height="11"
      viewBox="0 0 11 11"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 5.5h7M6 2.5l3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

function Hamburger({ open }: { open: boolean }) {
  const bar: React.CSSProperties = {
    display: "block",
    width: "100%",
    height: "1.5px",
    borderRadius: 2,
    backgroundColor: colors.text.primary,
    position: "absolute",
    left: 0,
  };

  return (
    <div style={{ width: 20, height: 15, position: "relative", flexShrink: 0 }}>
      <motion.span
        style={{ ...bar, top: 0, transformOrigin: "2px center" }}
        animate={open ? { rotate: 43, y: 5 } : { rotate: 0, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.span
        style={{ ...bar, top: "50%", marginTop: -0.75 }}
        animate={open ? { opacity: 0, x: 5 } : { opacity: 1, x: 0 }}
        transition={{ duration: 0.14 }}
      />
      <motion.span
        style={{ ...bar, bottom: 0, transformOrigin: "2px center" }}
        animate={open ? { rotate: -43, y: -5 } : { rotate: 0, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

function Avatar({ initials, size = 30 }: { initials: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        backgroundColor: colors.brandSoft,
        color: colors.brand,
        fontSize: size * 0.37,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        letterSpacing: "0.02em",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {initials}
    </div>
  );
}

function NavItem({
  item,
  active,
}: {
  item: { path: string; label: string };
  active: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      to={item.path}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 13px",
        borderRadius: 8,
        fontSize: 13.5,
        fontWeight: active ? 600 : 500,
        letterSpacing: "-0.012em",
        color: active
          ? colors.brand
          : hovered
            ? colors.text.primary
            : colors.text.secondary,
        backgroundColor: active
          ? colors.brandSoft
          : hovered
            ? colors.surface[150]
            : "transparent",
        border: active
          ? `1px solid ${colors.surface[200]}`
          : "1px solid transparent",
        textDecoration: "none",
        transition: "all 0.13s ease",
        whiteSpace: "nowrap",
      }}
    >
      {item.label}
    </Link>
  );
}

function MenuItem({
  to,
  onClick,
  icon,
  label,
  badge,
  danger,
  muted,
}: {
  to?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  danger?: boolean;
  muted?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  const color = danger
    ? hovered
      ? colors.red
      : `${colors.red}bb`
    : hovered
      ? colors.text.primary
      : muted
        ? colors.text.secondary
        : colors.text.primary;

  const backgroundColor = hovered
    ? danger
      ? `${colors.red}09`
      : colors.surface[150]
    : "transparent";

  const iconColor = danger
    ? hovered
      ? colors.red
      : `${colors.red}88`
    : hovered
      ? colors.brand
      : colors.text.secondary;

  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "7px 10px",
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 500,
    color,
    backgroundColor,
    transition: "all 0.1s ease",
    cursor: "pointer",
    border: "none",
    width: "100%",
    textAlign: "left",
    textDecoration: "none",
    letterSpacing: "-0.01em",
  };

  const content = (
    <>
      <span
        style={{
          color: iconColor,
          display: "flex",
          flexShrink: 0,
          transition: "color 0.1s",
        }}
      >
        {icon}
      </span>

      <span style={{ flex: 1 }}>{label}</span>

      {badge && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: colors.green,
            backgroundColor: colors.mintTint,
            border: `1px solid ${colors.green}30`,
            borderRadius: 5,
            padding: "1px 5px",
          }}
        >
          {badge}
        </span>
      )}
    </>
  );

  return to ? (
    <Link
      to={to}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {content}
    </Link>
  ) : (
    <button
      type="button"
      style={style}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {content}
    </button>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        backgroundColor: colors.surface[200],
        margin: "4px 0",
      }}
    />
  );
}

function ScrollProgress() {
  const [percentage, setPercentage] = useState(0);

  useEffect(() => {
    const update = () => {
      const documentElement = document.documentElement;
      const total = documentElement.scrollHeight - documentElement.clientHeight;
      setPercentage(total > 0 ? documentElement.scrollTop / total : 0);
    };

    update();

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  if (percentage <= 0.01 || percentage >= 0.99) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: "transparent",
        overflow: "hidden",
      }}
    >
      <motion.div
        style={{
          height: "100%",
          backgroundColor: colors.brand,
          transformOrigin: "left",
        }}
        animate={{ scaleX: percentage }}
        transition={{ duration: 0.05 }}
      />
    </div>
  );
}

const ProfileDropdown = React.forwardRef<
  HTMLDivElement,
  {
    open: boolean;
    onToggle: () => void;
    onLogout: () => void;
    initials: string;
    user: {
      first_name: string;
      last_name?: string;
      email: string;
      role?: string;
    };
    dashboardPath: string;
    primaryActionPath: string;
    primaryActionLabel: string;
    roleLabel: string;
  }
>(
  (
    {
      open,
      onToggle,
      onLogout,
      initials,
      user,
      dashboardPath,
      primaryActionPath,
      primaryActionLabel,
      roleLabel,
    },
    ref,
  ) => {
    const [hovered, setHovered] = useState(false);
    const isTeacher = user.role === "TEACHER";

    return (
      <div ref={ref} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={onToggle}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          aria-expanded={open}
          aria-haspopup="true"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "4px 8px 4px 5px",
            borderRadius: 9,
            border: `1px solid ${
              open || hovered ? colors.surface[200] : "transparent"
            }`,
            backgroundColor:
              open || hovered ? colors.surface[150] : "transparent",
            cursor: "pointer",
            transition: "all 0.13s ease",
          }}
        >
          <Avatar initials={initials} size={30} />

          <span
            className="tt-username"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: colors.text.primary,
              letterSpacing: "-0.01em",
              maxWidth: 110,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user.first_name}
          </span>

          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{ color: colors.text.secondary, display: "flex" }}
          >
            {I.chevron}
          </motion.span>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: 246,
                zIndex: 200,
                backgroundColor: colors.surface[50],
                border: `1px solid ${colors.surface[200]}`,
                borderRadius: 12,
                overflow: "hidden",
                boxShadow:
                  "0 18px 42px rgba(15, 23, 42, 0.10), 0 1px 0 rgba(15, 23, 42, 0.04)",
              }}
            >
              <div
                style={{
                  padding: "13px 14px 12px",
                  backgroundColor: colors.surface[100],
                  borderBottom: `1px solid ${colors.surface[200]}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar initials={initials} size={34} />

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          fontWeight: 600,
                          color: colors.text.primary,
                          letterSpacing: "-0.015em",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {user.first_name} {user.last_name ?? ""}
                      </p>

                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          color: isTeacher ? colors.brand : brand.humanText,
                          backgroundColor: isTeacher
                            ? colors.brandSoft
                            : brand.humanBg,
                          border: `1px solid ${
                            isTeacher
                              ? colors.surface[200]
                              : `${brand.humanAccent}40`
                          }`,
                          borderRadius: 4,
                          padding: "1px 5px",
                          textTransform: "uppercase",
                          flexShrink: 0,
                        }}
                      >
                        {roleLabel}
                      </span>
                    </div>

                    <p
                      style={{
                        margin: 0,
                        fontSize: 11.5,
                        color: colors.text.secondary,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginTop: 1,
                      }}
                    >
                      {user.email}
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ padding: "6px 6px 0" }}>
                <MenuItem to={dashboardPath} icon={I.grid} label="Dashboard" />

                <MenuItem
                  to={primaryActionPath}
                  icon={I.plus}
                  label={primaryActionLabel}
                  badge={isTeacher ? "Class" : "Free"}
                />
              </div>

              <div style={{ padding: "4px 6px" }}>
                <Divider />
              </div>

              <div style={{ padding: "0 6px" }}>
                <MenuItem
                  to={ROUTES.SETTINGS}
                  icon={I.gear}
                  label="Settings"
                  muted
                />

                <MenuItem
                  to={ROUTES.HELP_DOCS}
                  icon={I.help}
                  label="Help & Docs"
                  muted
                />
              </div>

              <div style={{ padding: "4px 6px" }}>
                <Divider />
              </div>

              <div style={{ padding: "0 6px 6px" }}>
                <MenuItem
                  onClick={onLogout}
                  icon={I.signout}
                  label="Sign out"
                  danger
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

ProfileDropdown.displayName = "ProfileDropdown";

function CTAButton() {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      to={ROUTES.REGISTER}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 15px",
        borderRadius: 8,
        fontSize: 13.5,
        fontWeight: 600,
        letterSpacing: "-0.015em",
        color: colors.text.light,
        backgroundColor: hovered ? colors.brandHover : colors.brand,
        textDecoration: "none",
        transition: "background-color 0.13s ease",
        whiteSpace: "nowrap",
      }}
    >
      Start for free
      <motion.span
        animate={{ x: hovered ? 2 : 0 }}
        transition={{ duration: 0.13 }}
        style={{ display: "flex", color: "rgba(255,255,255,0.75)" }}
      >
        {I.arrow}
      </motion.span>
    </Link>
  );
}

function GhostLink({ to, label }: { to: string; label: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      to={to}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "7px 14px",
        borderRadius: 8,
        fontSize: 13.5,
        fontWeight: 500,
        letterSpacing: "-0.01em",
        color: hovered ? colors.text.primary : colors.text.secondary,
        backgroundColor: hovered ? colors.surface[150] : "transparent",
        textDecoration: "none",
        transition: "all 0.13s ease",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Link>
  );
}

function MobileMenu({
  user,
  onLogout,
  pathname,
  dashboardPath,
  primaryActionPath,
  primaryActionLabel,
}: {
  user: {
    first_name: string;
    last_name?: string;
    email: string;
    role?: string;
  } | null;
  onLogout: () => void;
  pathname: string;
  dashboardPath: string;
  primaryActionPath: string;
  primaryActionLabel: string;
}) {
  const initials = user
    ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() ||
      "U"
    : "";

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        padding: "24px 20px 48px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {PUBLIC_NAV.map((item, index) => {
          const active =
            pathname === item.path ||
            (item.path !== "/" && pathname.startsWith(item.path));

          return (
            <motion.div
              key={item.path}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: index * 0.035,
                duration: 0.2,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <Link
                to={item.path}
                style={{
                  display: "block",
                  padding: "11px 14px",
                  borderRadius: 10,
                  fontSize: 17,
                  fontWeight: active ? 600 : 500,
                  letterSpacing: "-0.02em",
                  color: active ? colors.brand : colors.text.primary,
                  backgroundColor: active ? colors.brandSoft : "transparent",
                  textDecoration: "none",
                  transition: "all 0.12s",
                }}
              >
                {item.label}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.16 }}
        style={{
          marginTop: "auto",
          paddingTop: 28,
          borderTop: `1px solid ${colors.surface[200]}`,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {user ? (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 14px",
                borderRadius: 10,
                backgroundColor: colors.surface[100],
                border: `1px solid ${colors.surface[200]}`,
                marginBottom: 4,
              }}
            >
              <Avatar initials={initials} size={38} />

              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.text.primary,
                    letterSpacing: "-0.015em",
                  }}
                >
                  {user.first_name} {user.last_name ?? ""}
                </p>

                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: colors.text.secondary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user.email}
                </p>
              </div>
            </div>

            <Link
              to={dashboardPath}
              style={{
                display: "block",
                padding: "13px 16px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: colors.text.primary,
                backgroundColor: colors.surface[100],
                border: `1px solid ${colors.surface[200]}`,
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              Dashboard
            </Link>

            <Link
              to={primaryActionPath}
              style={{
                display: "block",
                padding: "13px 16px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: colors.text.primary,
                backgroundColor: colors.surface[100],
                border: `1px solid ${colors.surface[200]}`,
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              {primaryActionLabel}
            </Link>

            <Link
              to={ROUTES.SETTINGS}
              style={{
                display: "block",
                padding: "13px 16px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: "-0.01em",
                color: colors.text.secondary,
                backgroundColor: "transparent",
                border: `1px solid ${colors.surface[200]}`,
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              Settings
            </Link>

            <button
              type="button"
              onClick={onLogout}
              style={{
                padding: "13px 16px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: colors.red,
                backgroundColor: `${colors.red}08`,
                border: `1px solid ${colors.red}22`,
                cursor: "pointer",
                textAlign: "center",
                marginTop: 4,
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link
              to={ROUTES.LOGIN}
              style={{
                display: "block",
                padding: "13px 16px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 500,
                color: colors.text.primary,
                backgroundColor: "transparent",
                border: `1px solid ${colors.surface[200]}`,
                textDecoration: "none",
                textAlign: "center",
                letterSpacing: "-0.01em",
              }}
            >
              Sign in
            </Link>

            <Link
              to={ROUTES.REGISTER}
              style={{
                display: "block",
                padding: "13px 16px",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                color: colors.text.light,
                backgroundColor: colors.brand,
                textDecoration: "none",
                textAlign: "center",
                letterSpacing: "-0.02em",
              }}
            >
              Start for free
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const prevPath = useRef<string | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const { user, logout } = useAuthStore();

  const isTeacher = user?.role === "TEACHER";

  const dashboardPath = isTeacher ? ROUTES.TEACHER_DASHBOARD : ROUTES.DASHBOARD;

  const primaryActionPath = isTeacher
    ? ROUTES.TEACHER_COURSES
    : ROUTES.EDITOR_NEW;

  const primaryActionLabel = isTeacher ? "Create Course" : "New Session";
  const roleLabel = isTeacher ? "Teacher" : "Student";

  useEffect(() => {
    const updateScrolled = () => setScrolled(window.scrollY > 6);
    updateScrolled();

    window.addEventListener("scroll", updateScrolled, { passive: true });

    return () => window.removeEventListener("scroll", updateScrolled);
  }, []);

  useEffect(() => {
    if (prevPath.current !== null && prevPath.current !== location.pathname) {
      setMobileOpen(false);
      setProfileOpen(false);
    }

    prevPath.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    const closeProfileOnOutsideClick = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", closeProfileOnOutsideClick);

    return () =>
      document.removeEventListener("mousedown", closeProfileOnOutsideClick);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const handleLogout = useCallback(() => {
    logout();
    setProfileOpen(false);
    setMobileOpen(false);
    navigate(ROUTES.HOME);
  }, [logout, navigate]);

  const initials = user
    ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() ||
      "U"
    : "U";

  return (
    <>
      <header
        role="banner"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: HEADER_HEIGHT,
          backgroundColor: colors.surface[50],
          borderBottom: `1px solid ${
            scrolled ? colors.surface[200] : "transparent"
          }`,
          transition: "border-color 0.25s ease",
        }}
      >
        <ScrollProgress />

        <div
          style={{
            height: "100%",
            maxWidth: 1440,
            margin: "0 auto",
            padding: "0 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link
            to={ROUTES.HOME}
            aria-label="TypeTrace Home"
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
              outline: "none",
            }}
          >
            <img
              src="/Logo.png"
              alt="TypeTrace"
              style={{
                height: 30,
                minHeight: 30,
                width: "auto",
                objectFit: "contain",
                display: "block",
              }}
            />
          </Link>

          <nav
            aria-label="Main navigation"
            className="tt-nav"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            {PUBLIC_NAV.map((item) => {
              const active =
                location.pathname === item.path ||
                (item.path !== "/" && location.pathname.startsWith(item.path));

              return <NavItem key={item.path} item={item} active={active} />;
            })}
          </nav>

          <div
            className="tt-auth"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            {user ? (
              <ProfileDropdown
                ref={profileRef}
                open={profileOpen}
                onToggle={() => setProfileOpen((value) => !value)}
                onLogout={handleLogout}
                initials={initials}
                user={user}
                dashboardPath={dashboardPath}
                primaryActionPath={primaryActionPath}
                primaryActionLabel={primaryActionLabel}
                roleLabel={roleLabel}
              />
            ) : (
              <>
                <GhostLink to={ROUTES.LOGIN} label="Sign in" />
                <CTAButton />
              </>
            )}
          </div>

          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
            className="tt-hamburger"
            style={{
              display: "none",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              borderRadius: 9,
              border: "none",
              backgroundColor: "transparent",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Hamburger open={mobileOpen} />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="drawer"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "fixed",
              inset: 0,
              top: HEADER_HEIGHT,
              zIndex: 40,
              backgroundColor: colors.surface[50],
            }}
          >
            <MobileMenu
              user={user}
              onLogout={handleLogout}
              pathname={location.pathname}
              dashboardPath={dashboardPath}
              primaryActionPath={primaryActionPath}
              primaryActionLabel={primaryActionLabel}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (min-width: 768px) {
          .tt-nav {
            display: flex !important;
          }

          .tt-auth {
            display: flex !important;
          }

          .tt-hamburger {
            display: none !important;
          }
        }

        @media (max-width: 767px) {
          .tt-nav {
            display: none !important;
          }

          .tt-auth {
            display: none !important;
          }

          .tt-hamburger {
            display: flex !important;
          }
        }

        @media (max-width: 1060px) {
          .tt-username {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
