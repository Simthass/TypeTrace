// frontend/src/components/ui/AsyncState.tsx

import type { ReactNode } from "react";

import { colors } from "../../styles/colors";

type Tone = "default" | "error" | "warning" | "success";

function getTone(tone: Tone) {
  if (tone === "error") {
    return {
      bg: "#FEF2F2",
      border: "#FECACA",
      title: "#991B1B",
      text: "#B91C1C",
    };
  }

  if (tone === "warning") {
    return {
      bg: "#FFFBEB",
      border: "#FDE68A",
      title: "#92400E",
      text: "#B45309",
    };
  }

  if (tone === "success") {
    return {
      bg: "#ECFDF5",
      border: "#A7F3D0",
      title: "#065F46",
      text: "#047857",
    };
  }

  return {
    bg: colors.surface[50],
    border: colors.surface[200],
    title: colors.text.primary,
    text: colors.text.secondary,
  };
}

export function LoadingState({
  title = "Loading",
  message = "Please wait while TypeTrace prepares this workspace.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div
      className="rounded-md border p-6"
      style={{
        borderColor: colors.surface[200],
        background: colors.surface[50],
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="h-9 w-9 animate-pulse rounded-md"
          style={{ background: colors.brandSoft }}
        />
        <div>
          <p
            className="text-[14px] font-bold"
            style={{ color: colors.text.primary }}
          >
            {title}
          </p>
          <p
            className="mt-1 text-[13px] leading-6"
            style={{ color: colors.text.secondary }}
          >
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div
      className="rounded-md border p-8 text-center"
      style={{
        borderColor: colors.surface[200],
        background: colors.surface[50],
      }}
    >
      <p
        className="text-[16px] font-bold"
        style={{ color: colors.text.primary }}
      >
        {title}
      </p>
      <p
        className="mx-auto mt-2 max-w-md text-[14px] leading-7"
        style={{ color: colors.text.secondary }}
      >
        {message}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <StatePanel tone="error" title={title} message={message} action={action} />
  );
}

export function StatePanel({
  tone = "default",
  title,
  message,
  action,
}: {
  tone?: Tone;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  const style = getTone(tone);

  return (
    <div
      className="rounded-md border p-5"
      style={{
        borderColor: style.border,
        background: style.bg,
      }}
    >
      <p className="text-[14px] font-bold" style={{ color: style.title }}>
        {title}
      </p>
      <p className="mt-2 text-[13px] leading-6" style={{ color: style.text }}>
        {message}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
