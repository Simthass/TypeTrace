// frontend/src/components/internal/InternalShell.tsx

import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { colors } from "../../styles/colors";

type InternalIconName =
  | "dashboard"
  | "editor"
  | "sessions"
  | "certificate"
  | "analytics"
  | "course"
  | "teacher"
  | "student"
  | "review"
  | "replay"
  | "shield"
  | "search"
  | "settings"
  | "logout"
  | "hash"
  | "clock"
  | "keyboard"
  | "document"
  | "trend"
  | "download"
  | "warning"
  | "check";

export function InternalIcon({
  name,
  size = 18,
}: {
  name: InternalIconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<InternalIconName, ReactNode> = {
    dashboard: (
      <>
        <path d="M4 13h6V4H4z" />
        <path d="M14 20h6V4h-6z" />
        <path d="M4 20h6v-3H4z" />
      </>
    ),
    editor: (
      <>
        <path d="M7 3h7l5 5v13H7z" />
        <path d="M14 3v6h5" />
        <path d="M10 13h6M10 17h4" />
      </>
    ),
    sessions: (
      <>
        <path d="M4 5h16" />
        <path d="M4 12h16" />
        <path d="M4 19h16" />
        <path d="M8 3v4M8 10v4M8 17v4" />
      </>
    ),
    certificate: (
      <>
        <path d="M7 3h8l4 4v14H7z" />
        <path d="M15 3v5h5" />
        <path d="M10 13h6M10 17h4" />
        <circle cx="8" cy="20" r="2" />
      </>
    ),
    analytics: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 15v-4" />
        <path d="M12 15V8" />
        <path d="M16 15v-6" />
      </>
    ),
    course: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
      </>
    ),
    teacher: (
      <>
        <path d="M4 6h16v11H4z" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <path d="M8 10h8M8 13h5" />
      </>
    ),
    student: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    review: (
      <>
        <path d="M4 5h16" />
        <path d="M4 12h10" />
        <path d="M4 19h7" />
        <path d="m16 18 2 2 4-5" />
      </>
    ),
    replay: (
      <>
        <path d="M4 12a8 8 0 1 0 2.3-5.7" />
        <path d="M4 4v6h6" />
        <path d="M10 9v6l5-3z" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.8 1.8 0 0 0 .3 2l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.8 1.8 0 0 0-2-.3 1.8 1.8 0 0 0-1 1.7V21a2 2 0 1 1-4 0v-.2a1.8 1.8 0 0 0-1-1.7 1.8 1.8 0 0 0-2 .3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.8 1.8 0 0 0 .3-2 1.8 1.8 0 0 0-1.7-1H3a2 2 0 1 1 0-4h.2a1.8 1.8 0 0 0 1.7-1 1.8 1.8 0 0 0-.3-2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.8 1.8 0 0 0 2 .3h.1a1.8 1.8 0 0 0 1-1.7V3a2 2 0 1 1 4 0v.2a1.8 1.8 0 0 0 1 1.7 1.8 1.8 0 0 0 2-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.8 1.8 0 0 0-.3 2v.1a1.8 1.8 0 0 0 1.7 1H21a2 2 0 1 1 0 4h-.2a1.8 1.8 0 0 0-1.4.5Z" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
        <path d="M21 3v18" />
      </>
    ),
    hash: (
      <>
        <path d="M10 3 8 21M16 3l-2 18M4 9h17M3 15h17" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    keyboard: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M7 9h.01M10 9h.01M13 9h.01M16 9h.01M7 13h.01M10 13h4M17 13h.01" />
      </>
    ),
    document: (
      <>
        <path d="M7 3h7l5 5v13H7z" />
        <path d="M14 3v6h5" />
        <path d="M10 13h6M10 17h4" />
      </>
    ),
    trend: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="m7 15 4-4 3 3 5-7" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 21h14" />
      </>
    ),
    warning: (
      <>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    check: (
      <>
        <path d="m5 13 4 4L19 7" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}

export function AppSurface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md border bg-white ${className}`}
      style={{
        borderColor: colors.surface[200],
        boxShadow: `0 24px 70px ${colors.shadow}`,
      }}
    >
      {children}
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow && (
          <p
            className="text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: colors.brand }}
          >
            {eyebrow}
          </p>
        )}

        <h1
          className="mt-2 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl"
          style={{ color: colors.text.primary }}
        >
          {title}
        </h1>

        {description && (
          <p
            className="mt-3 max-w-2xl text-[14px] leading-7"
            style={{ color: colors.text.secondary }}
          >
            {description}
          </p>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function MetricTile({
  icon,
  label,
  value,
  detail,
}: {
  icon: InternalIconName;
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <AppSurface className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className="text-[11px] font-bold uppercase tracking-[0.13em]"
            style={{ color: colors.text.secondary }}
          >
            {label}
          </p>
          <p
            className="mt-3 text-3xl font-semibold tracking-[-0.05em]"
            style={{ color: colors.text.primary }}
          >
            {value}
          </p>
          {detail && (
            <p
              className="mt-2 text-[12px] leading-5"
              style={{ color: colors.text.secondary }}
            >
              {detail}
            </p>
          )}
        </div>

        <div
          className="flex h-11 w-11 items-center justify-center rounded-md"
          style={{
            background: colors.brandSoft,
            color: colors.brand,
          }}
        >
          <InternalIcon name={icon} />
        </div>
      </div>
    </AppSurface>
  );
}

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "good" | "warning" | "danger" | "brand";
}) {
  const map = {
    neutral: {
      background: colors.surface[100],
      color: colors.text.secondary,
      borderColor: colors.surface[200],
    },
    good: {
      background: "#ECFDF5",
      color: "#047857",
      borderColor: "#A7F3D0",
    },
    warning: {
      background: "#FFFBEB",
      color: "#B45309",
      borderColor: "#FDE68A",
    },
    danger: {
      background: "#FEF2F2",
      color: "#B91C1C",
      borderColor: "#FECACA",
    },
    brand: {
      background: colors.brandSoft,
      color: colors.brand,
      borderColor: colors.surface[200],
    },
  };

  const style = map[tone];

  return (
    <span
      className="inline-flex rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em]"
      style={style}
    >
      {label}
    </span>
  );
}

export function PrimaryAction({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-[13px] font-bold transition hover:opacity-90"
      style={{ background: colors.brand, color: colors.text.light }}
    >
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}

export function SecondaryAction({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-[13px] font-bold transition hover:opacity-80"
      style={{
        borderColor: colors.surface[200],
        background: colors.surface[50],
        color: colors.text.primary,
      }}
    >
      {children}
    </Link>
  );
}

export function EmptyPanel({
  icon,
  title,
  description,
  action,
}: {
  icon: InternalIconName;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <AppSurface className="p-8 text-center">
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-md"
        style={{ background: colors.brandSoft, color: colors.brand }}
      >
        <InternalIcon name={icon} />
      </div>

      <h3
        className="mt-5 text-xl font-semibold tracking-[-0.03em]"
        style={{ color: colors.text.primary }}
      >
        {title}
      </h3>

      <p
        className="mx-auto mt-2 max-w-md text-[14px] leading-7"
        style={{ color: colors.text.secondary }}
      >
        {description}
      </p>

      {action && <div className="mt-5">{action}</div>}
    </AppSurface>
  );
}
