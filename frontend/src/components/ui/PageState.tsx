// frontend/src/components/ui/PageState.tsx

import type { ReactNode } from "react";

import { ButtonLink } from "./Button";
import { DashboardSkeleton } from "./Skeleton";
import { ROUTES } from "../../constants/routes";
import { brand, colors } from "../../styles/colors";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div>
        {eyebrow && (
          <p
            className="text-[11px] font-bold uppercase tracking-[0.18em]"
            style={{ color: colors.brand }}
          >
            {eyebrow}
          </p>
        )}

        <h1
          className="mt-2 text-[2rem] font-bold tracking-[-0.045em] md:text-[2.4rem]"
          style={{ color: colors.text.primary }}
        >
          {title}
        </h1>

        {description && (
          <p
            className="mt-3 max-w-2xl text-[14px] leading-6"
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

export function LoadingState({
  label = "Loading workspace...",
}: {
  label?: string;
}) {
  return (
    <div className="space-y-4">
      <DashboardSkeleton />

      <p
        className="text-center text-[13px] font-medium"
        style={{ color: colors.text.secondary }}
      >
        {label}
      </p>
    </div>
  );
}

type EmptyIcon =
  | "session"
  | "certificate"
  | "course"
  | "review"
  | "search"
  | "document";

function EmptyStateIcon({ type }: { type: EmptyIcon }) {
  const icon =
    type === "session" ? (
      <>
        <path d="M4 5h16v14H4z" />
        <path d="M8 9h8" />
        <path d="M8 13h5" />
      </>
    ) : type === "certificate" ? (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ) : type === "course" ? (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
      </>
    ) : type === "review" ? (
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </>
    ) : type === "search" ? (
      <>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </>
    ) : (
      <>
        <path d="M4 4h16v16H4z" />
        <path d="M8 9h8" />
        <path d="M8 13h5" />
      </>
    );

  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icon}
    </svg>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: EmptyIcon;
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  action,
  icon = "document",
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-white text-center ${
        compact ? "px-5 py-8" : "px-6 py-14"
      }`}
      style={{
        borderColor: colors.surface[200],
        boxShadow: `0 18px 60px -46px ${colors.shadowStrong}`,
      }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-32 w-64 -translate-x-1/2 rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors.brandSoft} 0%, transparent 70%)`,
          filter: "blur(28px)",
        }}
      />

      <div
        className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border"
        style={{
          background: colors.brandSoft,
          color: colors.brand,
          borderColor: colors.surface[200],
        }}
      >
        <EmptyStateIcon type={icon} />
      </div>

      <h2
        className="relative mt-5 text-[17px] font-bold tracking-[-0.02em]"
        style={{ color: colors.text.primary }}
      >
        {title}
      </h2>

      <p
        className="relative mx-auto mt-2 max-w-md text-[13px] leading-6"
        style={{ color: colors.text.secondary }}
      >
        {description}
      </p>

      {action && <div className="relative mt-6">{action}</div>}
    </div>
  );
}

interface AlertBoxProps {
  type?: "success" | "error" | "warning" | "info";
  children: ReactNode;
}

export function AlertBox({ type = "info", children }: AlertBoxProps) {
  const styles =
    type === "success"
      ? {
          border: brand.humanAccent,
          bg: brand.humanBg,
          text: brand.humanText,
        }
      : type === "error"
        ? {
            border: brand.aiAccent,
            bg: brand.aiBg,
            text: brand.aiText,
          }
        : type === "warning"
          ? {
              border: brand.suspiciousAccent,
              bg: brand.suspiciousBg,
              text: brand.suspiciousText,
            }
          : {
              border: colors.surface[200],
              bg: colors.brandSoft,
              text: colors.brand,
            };

  return (
    <div
      className="rounded-md border px-4 py-3 text-[13px] leading-6"
      style={{
        borderColor: styles.border,
        background: styles.bg,
        color: styles.text,
      }}
    >
      {children}
    </div>
  );
}

export function FirstRunEmptyState() {
  return (
    <EmptyState
      icon="session"
      title="Start your first authorship trail"
      description="Create a writing session, capture your natural writing process, then generate an authorship certificate for review."
      action={
        <ButtonLink to={ROUTES.EDITOR_NEW} size="md">
          Start first session
        </ButtonLink>
      }
    />
  );
}
