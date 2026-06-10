// frontend/src/components/layout/Header.tsx

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { brand, colors } from "../../styles/colors";
import { useAuthStore, type AuthUser } from "../../store/authStore";

export const HEADER_HEIGHT = 60;

// ─── Icon primitives ──────────────────────────────────────────────────────────

const Icon = {
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

  check: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.5 6.5L5.5 9.5L10.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),

  scan: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1.5 4.5V2.5a1 1 0 0 1 1-1h2M12.5 4.5V2.5a1 1 0 0 0-1-1h-2M1.5 9.5v2a1 1 0 0 0 1 1h2M12.5 9.5v2a1 1 0 0 1-1 1h-2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <line
        x1="1.5"
        y1="7"
        x2="12.5"
        y2="7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  ),
};

// ─── Sub-components ────────────────────────────────────────────────────────────

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
        borderRadius: Math.round(size * 0.3),
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

// ─── Product dropdown menu ─────────────────────────────────────────────────────

function ProductDropdown({ onClose }: { onClose: () => void }) {
  const items = [
    {
      icon: (
        <svg
          width="15"
          height="15"
          viewBox="0 0 15 15"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="1"
            y="1"
            width="6"
            height="6"
            rx="1.5"
            stroke={colors.brand}
            strokeWidth="1.3"
          />
          <rect
            x="8"
            y="1"
            width="6"
            height="4"
            rx="1.5"
            stroke={colors.surface[300]}
            strokeWidth="1.3"
          />
          <rect
            x="1"
            y="8"
            width="6"
            height="6"
            rx="1.5"
            stroke={colors.surface[300]}
            strokeWidth="1.3"
          />
          <rect
            x="8"
            y="6.5"
            width="6"
            height="7.5"
            rx="1.5"
            stroke={colors.surface[300]}
            strokeWidth="1.3"
          />
        </svg>
      ),
      label: "Dashboard",
      desc: "Writing evidence & analytics",
      path: ROUTES.DASHBOARD,
      active: true,
    },
    {
      icon: Icon.plus,
      label: "New Session",
      desc: "Start capturing authorship",
      path: ROUTES.EDITOR_NEW,
      active: false,
    },
    {
      icon: Icon.scan,
      label: "Verify Certificate",
      desc: "Public integrity lookup",
      path: ROUTES.VERIFY_LOOKUP,
      active: false,
    },
    {
      icon: Icon.help,
      label: "Documentation",
      desc: "Guides and how-it-works",
      path: ROUTES.HELP_DOCS,
      active: false,
    },
  ];

  return (
    <motion.div
      role="menu"
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "absolute",
        top: "calc(100% + 10px)",
        left: 0,
        width: 280,
        zIndex: 200,
        backgroundColor: colors.surface[50],
        border: `1px solid ${colors.surface[200]}`,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow:
          "0 20px 48px rgba(15,23,42,0.11), 0 1px 0 rgba(15,23,42,0.04)",
      }}
    >
      <div style={{ padding: "6px" }}>
        {items.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "9px 10px",
              borderRadius: 8,
              textDecoration: "none",
              backgroundColor: item.active ? colors.brandSoft : "transparent",
              transition: "background-color 0.1s",
            }}
            onMouseEnter={(e) => {
              if (!item.active)
                e.currentTarget.style.backgroundColor = colors.surface[100];
            }}
            onMouseLeave={(e) => {
              if (!item.active)
                e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 7,
                backgroundColor: item.active
                  ? colors.brandSoft
                  : colors.surface[100],
                border: `1px solid ${item.active ? colors.surface[200] : colors.surface[200]}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                color: item.active ? colors.brand : colors.text.secondary,
              }}
            >
              {item.icon}
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  color: item.active ? colors.brand : colors.text.primary,
                  letterSpacing: "-0.012em",
                }}
              >
                {item.label}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 11.5,
                  color: colors.text.secondary,
                  marginTop: 1,
                }}
              >
                {item.desc}
              </p>
            </div>
          </Link>
        ))}
      </div>
      <div
        style={{
          borderTop: `1px solid ${colors.surface[200]}`,
          padding: "10px 14px",
          backgroundColor: colors.surface[100],
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: colors.text.secondary,
            letterSpacing: "0.02em",
          }}
        >
          <span style={{ color: colors.brand, fontWeight: 600 }}>
            TypeTrace
          </span>{" "}
          — Behavioral authorship verification
        </p>
      </div>
    </motion.div>
  );
}

// ─── Resources dropdown ────────────────────────────────────────────────────────

function ResourcesDropdown({ onClose }: { onClose: () => void }) {
  const sections = [
    {
      heading: "Learn",
      items: [
        {
          label: "How It Works",
          desc: "Keystroke capture explained",
          path: ROUTES.HOW_IT_WORKS,
        },
        {
          label: "Features",
          desc: "Full capability overview",
          path: ROUTES.FEATURES,
        },
      ],
    },
    {
      heading: "Trust",
      items: [
        {
          label: "About TypeTrace",
          desc: "Research & methodology",
          path: ROUTES.ABOUT,
        },
        {
          label: "Help Center",
          desc: "Guides & documentation",
          path: ROUTES.HELP_DOCS,
        },
      ],
    },
  ];

  return (
    <motion.div
      role="menu"
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: "absolute",
        top: "calc(100% + 10px)",
        left: "50%",
        transform: "translateX(-50%)",
        width: 320,
        zIndex: 200,
        backgroundColor: colors.surface[50],
        border: `1px solid ${colors.surface[200]}`,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow:
          "0 20px 48px rgba(15,23,42,0.11), 0 1px 0 rgba(15,23,42,0.04)",
      }}
    >
      <div style={{ padding: "6px" }}>
        {sections.map((section) => (
          <div key={section.heading}>
            <p
              style={{
                margin: "8px 10px 4px",
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: colors.text.muted,
                textTransform: "uppercase",
              }}
            >
              {section.heading}
            </p>
            {section.items.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "9px 10px",
                  borderRadius: 8,
                  textDecoration: "none",
                  transition: "background-color 0.1s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.surface[100];
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      fontWeight: 600,
                      color: colors.text.primary,
                      letterSpacing: "-0.012em",
                    }}
                  >
                    {item.label}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11.5,
                      color: colors.text.secondary,
                      marginTop: 1,
                    }}
                  >
                    {item.desc}
                  </p>
                </div>
                <span style={{ color: colors.surface[300], flexShrink: 0 }}>
                  {Icon.arrow}
                </span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Nav item with optional dropdown ──────────────────────────────────────────

function NavDropdownItem({
  label,
  children,
}: {
  label: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "5px 13px",
          borderRadius: 8,
          fontSize: 13.5,
          fontWeight: open ? 600 : 500,
          letterSpacing: "-0.012em",
          color: open ? colors.text.primary : colors.text.secondary,
          backgroundColor: open ? colors.surface[100] : "transparent",
          border: "1px solid transparent",
          cursor: "pointer",
          transition: "all 0.13s ease",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          if (!open) {
            e.currentTarget.style.color = colors.text.primary;
            e.currentTarget.style.backgroundColor = colors.surface[100];
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.color = colors.text.secondary;
            e.currentTarget.style.backgroundColor = "transparent";
          }
        }}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {label}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18 }}
          style={{
            color: colors.text.secondary,
            display: "flex",
            marginTop: 1,
          }}
        >
          {Icon.chevron}
        </motion.span>
      </button>
      <AnimatePresence>
        {open && children(() => setOpen(false))}
      </AnimatePresence>
    </div>
  );
}

function NavLink({
  item,
  active,
}: {
  item: { path: string; label: string };
  active: boolean;
}) {
  return (
    <Link
      to={item.path}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 13px",
        borderRadius: 8,
        fontSize: 13.5,
        fontWeight: active ? 600 : 500,
        letterSpacing: "-0.012em",
        color: active ? colors.brand : colors.text.secondary,
        backgroundColor: active ? colors.brandSoft : "transparent",
        border: active
          ? `1px solid ${colors.surface[200]}`
          : "1px solid transparent",
        textDecoration: "none",
        transition: "all 0.13s ease",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = colors.text.primary;
          e.currentTarget.style.backgroundColor = colors.surface[100];
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = colors.text.secondary;
          e.currentTarget.style.backgroundColor = "transparent";
        }
      }}
    >
      {item.label}
    </Link>
  );
}

// ─── Profile dropdown ──────────────────────────────────────────────────────────

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
  const bg = hovered
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
    backgroundColor: bg,
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

const ProfileDropdown = React.forwardRef<
  HTMLDivElement,
  {
    open: boolean;
    onToggle: () => void;
    onLogout: () => void;
    initials: string;
    user: Pick<AuthUser, "first_name" | "last_name" | "email" | "role">;
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
            border: `1px solid ${open || hovered ? colors.surface[200] : "transparent"}`,
            backgroundColor:
              open || hovered ? colors.surface[150] : "transparent",
            cursor: "pointer",
            transition: "all 0.13s ease",
          }}
        >
          <Avatar initials={initials} size={28} />
          <span
            className="tt-username"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: colors.text.primary,
              letterSpacing: "-0.01em",
              maxWidth: 100,
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
            {Icon.chevron}
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
                width: 250,
                zIndex: 200,
                backgroundColor: colors.surface[50],
                border: `1px solid ${colors.surface[200]}`,
                borderRadius: 12,
                overflow: "hidden",
                boxShadow:
                  "0 18px 42px rgba(15,23,42,0.10), 0 1px 0 rgba(15,23,42,0.04)",
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
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
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
                          border: `1px solid ${isTeacher ? colors.surface[200] : `${brand.humanAccent}40`}`,
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
                <MenuItem
                  to={dashboardPath}
                  icon={Icon.grid}
                  label="Dashboard"
                />
                <MenuItem
                  to={primaryActionPath}
                  icon={Icon.plus}
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
                  icon={Icon.gear}
                  label="Settings"
                  muted
                />
                <MenuItem
                  to={ROUTES.HELP_DOCS}
                  icon={Icon.help}
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
                  icon={Icon.signout}
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

// ─── Scroll progress bar ───────────────────────────────────────────────────────

function ScrollProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const update = () => {
      const el = document.documentElement;
      const total = el.scrollHeight - el.clientHeight;
      setPct(total > 0 ? el.scrollTop / total : 0);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  if (pct <= 0.01 || pct >= 0.99) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        overflow: "hidden",
      }}
    >
      <motion.div
        style={{
          height: "100%",
          backgroundColor: colors.brand,
          transformOrigin: "left",
        }}
        animate={{ scaleX: pct }}
        transition={{ duration: 0.05 }}
      />
    </div>
  );
}

const BANNER_HEIGHT = 36;

// ─── Announcement banner ───────────────────────────────────────────────────────

function AnnouncementBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      style={{
        width: "100%",
        height: BANNER_HEIGHT,
        backgroundColor: colors.brand,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "0 48px 0 20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: colors.text.light,
          letterSpacing: "-0.01em",
          whiteSpace: "nowrap",
        }}
      >
        TypeTrace v1.0 — Behavioral authorship verification now in early access
      </span>
      <Link
        to={ROUTES.HOW_IT_WORKS}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11.5,
          fontWeight: 700,
          color: colors.brand,
          backgroundColor: colors.text.light,
          borderRadius: 5,
          padding: "2px 9px",
          textDecoration: "none",
          letterSpacing: "-0.01em",
          flexShrink: 0,
        }}
      >
        Get Started {Icon.arrow}
      </Link>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss banner"
        style={{
          position: "absolute",
          right: 14,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: `${colors.text.light}88`,
          padding: 4,
          display: "flex",
          alignItems: "center",
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M2 2l8 8M10 2l-8 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

// ─── Mobile menu ───────────────────────────────────────────────────────────────

function MobileMenu({
  user,
  onLogout,
  pathname,
  dashboardPath,
  primaryActionPath,
  primaryActionLabel,
}: {
  user: Pick<AuthUser, "first_name" | "last_name" | "email" | "role"> | null;
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

  const navGroups = [
    {
      label: "Platform",
      items: [
        { label: "How It Works", path: ROUTES.HOW_IT_WORKS },
        { label: "Features", path: ROUTES.FEATURES },
        { label: "About", path: ROUTES.ABOUT },
        { label: "Verify Certificate", path: ROUTES.VERIFY_LOOKUP },
      ],
    },
    {
      label: "Resources",
      items: [{ label: "Help & Docs", path: ROUTES.HELP_DOCS }],
    },
  ];

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "16px 20px 0" }}>
        {navGroups.map((group, gi) => (
          <div key={group.label} style={{ marginBottom: 20 }}>
            <p
              style={{
                margin: "0 0 6px 4px",
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.09em",
                color: colors.text.muted,
                textTransform: "uppercase",
              }}
            >
              {group.label}
            </p>
            {group.items.map((item, i) => {
              const active =
                pathname === item.path || pathname.startsWith(`${item.path}/`);
              return (
                <motion.div
                  key={item.path}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: (gi * 3 + i) * 0.04,
                    duration: 0.2,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <Link
                    to={item.path}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: 9,
                      fontSize: 15,
                      fontWeight: active ? 600 : 500,
                      letterSpacing: "-0.015em",
                      color: active ? colors.brand : colors.text.primary,
                      backgroundColor: active
                        ? colors.brandSoft
                        : "transparent",
                      textDecoration: "none",
                      marginBottom: 2,
                    }}
                  >
                    {item.label}
                    {active && (
                      <span style={{ color: colors.brand }}>{Icon.check}</span>
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: "auto",
          padding: "20px",
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
                padding: "12px 14px",
                borderRadius: 10,
                backgroundColor: colors.surface[100],
                border: `1px solid ${colors.surface[200]}`,
                marginBottom: 4,
              }}
            >
              <Avatar initials={initials} size={36} />
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.text.primary,
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
                padding: "12px 16px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
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
                padding: "12px 16px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                color: colors.text.light,
                backgroundColor: colors.brand,
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
                padding: "12px 16px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 500,
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
                padding: "12px 16px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
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
                padding: "12px 16px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 500,
                color: colors.text.primary,
                backgroundColor: "transparent",
                border: `1px solid ${colors.surface[200]}`,
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              Sign in
            </Link>
            <Link
              to={ROUTES.REGISTER}
              style={{
                display: "block",
                padding: "12px 16px",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                color: colors.text.light,
                backgroundColor: colors.brand,
                textDecoration: "none",
                textAlign: "center",
              }}
            >
              Start for free
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Header export ────────────────────────────────────────────────────────

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

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
    const update = () => setScrolled(window.scrollY > 6);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (prevPath.current !== null && prevPath.current !== location.pathname) {
      setMobileOpen(false);
      setProfileOpen(false);
    }
    prevPath.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setProfileOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
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

  // Which nav links exist as simple links (not dropdowns)
  const simpleNavItems = [{ label: "Verify", path: ROUTES.VERIFY_LOOKUP }];

  return (
    <>
      {/* ── Announcement banner — only when not logged in and not dismissed ── */}
      <AnimatePresence>
        {!user && showBanner && (
          <motion.div
            key="banner"
            initial={{ height: BANNER_HEIGHT, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 60,
              overflow: "hidden",
            }}
          >
            <AnnouncementBanner onDismiss={() => setShowBanner(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.header
        role="banner"
        animate={{ top: !user && showBanner ? BANNER_HEIGHT : 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          zIndex: 50,
          height: HEADER_HEIGHT,
          backgroundColor: scrolled
            ? `${colors.surface[50]}F5`
            : colors.surface[50],
          backdropFilter: scrolled ? "blur(12px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: `1px solid ${scrolled ? colors.surface[200] : "transparent"}`,
          transition: "border-color 0.25s ease, background-color 0.25s ease",
        }}
      >
        <ScrollProgress />

        <div
          style={{
            height: "100%",
            maxWidth: 1440,
            margin: "0 auto",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            gap: 0,
          }}
        >
          {/* ── Logo ── */}
          <Link
            to={ROUTES.HOME}
            aria-label="TypeTrace Home"
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
              outline: "none",
              marginRight: 8,
            }}
          >
            <img
              src="/Logo.png"
              alt="TypeTrace"
              style={{
                height: 28,
                width: "auto",
                objectFit: "contain",
                display: "block",
              }}
            />
          </Link>

          {/* ── Separator ── */}
          <div
            style={{
              width: 1,
              height: 18,
              backgroundColor: colors.surface[200],
              margin: "0 16px",
              flexShrink: 0,
            }}
            className="tt-nav"
          />

          {/* ── Desktop nav ── */}
          <nav
            aria-label="Main navigation"
            className="tt-nav"
            style={{ display: "flex", alignItems: "center", gap: 2 }}
          >
            {/* Product dropdown */}
            <NavDropdownItem label="Product">
              {(close) => <ProductDropdown onClose={close} />}
            </NavDropdownItem>

            {/* Resources dropdown */}
            <NavDropdownItem label="Resources">
              {(close) => <ResourcesDropdown onClose={close} />}
            </NavDropdownItem>

            {/* Simple nav items */}
            {simpleNavItems.map((item) => {
              const active =
                location.pathname === item.path ||
                location.pathname.startsWith(`${item.path}/`);
              return <NavLink key={item.path} item={item} active={active} />;
            })}
          </nav>

          {/* ── Spacer ── */}
          <div style={{ flex: 1 }} />

          {/* ── Right side ── */}
          <div
            className="tt-auth"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            {user ? (
              <>
                {/* Quick action button */}
                <Link
                  to={primaryActionPath}
                  className="tt-quick-action"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "6px 13px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: "-0.012em",
                    color: colors.text.secondary,
                    backgroundColor: colors.surface[100],
                    border: `1px solid ${colors.surface[200]}`,
                    textDecoration: "none",
                    transition: "all 0.13s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = colors.text.primary;
                    e.currentTarget.style.borderColor = colors.surface[300];
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = colors.text.secondary;
                    e.currentTarget.style.borderColor = colors.surface[200];
                  }}
                >
                  {Icon.plus}
                  {primaryActionLabel}
                </Link>

                {/* Profile */}
                <ProfileDropdown
                  ref={profileRef}
                  open={profileOpen}
                  onToggle={() => setProfileOpen((v) => !v)}
                  onLogout={handleLogout}
                  initials={initials}
                  user={user}
                  dashboardPath={dashboardPath}
                  primaryActionPath={primaryActionPath}
                  primaryActionLabel={primaryActionLabel}
                  roleLabel={roleLabel}
                />
              </>
            ) : (
              <>
                <Link
                  to={ROUTES.LOGIN}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    fontSize: 13.5,
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                    color: colors.text.secondary,
                    backgroundColor: "transparent",
                    textDecoration: "none",
                    transition: "all 0.13s ease",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = colors.text.primary;
                    e.currentTarget.style.backgroundColor = colors.surface[100];
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = colors.text.secondary;
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  Sign in
                </Link>

                <Link
                  to={ROUTES.REGISTER}
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
                    backgroundColor: colors.brand,
                    textDecoration: "none",
                    transition: "background-color 0.13s ease",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.brandHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = colors.brand;
                  }}
                >
                  Start for free
                  <span
                    style={{ color: "rgba(255,255,255,0.72)", display: "flex" }}
                  >
                    {Icon.arrow}
                  </span>
                </Link>
              </>
            )}
          </div>

          {/* ── Hamburger ── */}
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
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
      </motion.header>

      {/* ── Mobile drawer ── */}
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
              top: HEADER_HEIGHT + (!user && showBanner ? BANNER_HEIGHT : 0),
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

      {/* ── Responsive styles ── */}
      <style>{`
        @media (min-width: 768px) {
          .tt-nav { display: flex !important; }
          .tt-auth { display: flex !important; }
          .tt-hamburger { display: none !important; }
        }
        @media (max-width: 767px) {
          .tt-nav { display: none !important; }
          .tt-auth { display: none !important; }
          .tt-hamburger { display: flex !important; }
        }
        @media (max-width: 1100px) {
          .tt-username { display: none !important; }
          .tt-quick-action { display: none !important; }
        }
      `}</style>
    </>
  );
}
