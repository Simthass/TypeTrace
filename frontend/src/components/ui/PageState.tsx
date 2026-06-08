// frontend/src/components/ui/PageState.tsx

import type { ReactNode } from "react";

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

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div
      className="rounded-xl border bg-white px-6 py-12 text-center"
      style={{
        borderColor: colors.surface[200],
        boxShadow: `0 18px 60px -44px ${colors.shadowStrong}`,
      }}
    >
      <div
        className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-md border"
        style={{
          borderColor: colors.surface[200],
          background: colors.surface[100],
        }}
      >
        <div
          className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: colors.brand, borderTopColor: "transparent" }}
        />
      </div>

      <p
        className="text-[13px] font-medium"
        style={{ color: colors.text.secondary }}
      >
        {label}
      </p>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
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
        className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border"
        style={{
          background: colors.brandSoft,
          color: colors.brand,
          borderColor: colors.surface[200],
        }}
      >
        {icon || (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M4 4h16v16H4z" />
            <path d="M8 9h8" />
            <path d="M8 13h5" />
          </svg>
        )}
      </div>

      <h2
        className="relative mt-5 text-[16px] font-bold tracking-[-0.02em]"
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
