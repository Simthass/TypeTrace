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
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        {eyebrow && (
          <p
            className="text-[12px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: colors.text.secondary }}
          >
            {eyebrow}
          </p>
        )}

        <h1
          className="mt-2 text-2xl font-semibold tracking-[-0.03em]"
          style={{ color: colors.text.primary }}
        >
          {title}
        </h1>

        {description && (
          <p
            className="mt-2 max-w-2xl text-[14px] leading-6"
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
      className="rounded-md border bg-white px-5 py-10 text-center text-[13px]"
      style={{
        borderColor: colors.surface[200],
        color: colors.text.secondary,
      }}
    >
      <div className="skeleton mx-auto mb-4 h-2 w-32" />
      <p>{label}</p>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div
      className="rounded-md border bg-white px-5 py-10 text-center"
      style={{ borderColor: colors.surface[200] }}
    >
      <div
        className="mx-auto flex h-10 w-10 items-center justify-center rounded-md"
        style={{ background: brand.bgNavActive, color: colors.brand }}
      >
        <svg
          width="18"
          height="18"
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
      </div>

      <h2
        className="mt-4 text-[15px] font-semibold"
        style={{ color: colors.text.primary }}
      >
        {title}
      </h2>

      <p
        className="mx-auto mt-2 max-w-sm text-[13px] leading-6"
        style={{ color: colors.text.secondary }}
      >
        {description}
      </p>

      {action && <div className="mt-5">{action}</div>}
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
              bg: colors.surface[50],
              text: colors.text.secondary,
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
