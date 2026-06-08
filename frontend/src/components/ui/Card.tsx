// frontend/src/components/ui/Card.tsx

import type { HTMLAttributes, ReactNode } from "react";

import { colors } from "../../styles/colors";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  elevated?: boolean;
}

export function Card({
  children,
  elevated = false,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      {...props}
      className={`rounded-xl border bg-white ${className}`}
      style={{
        borderColor: colors.surface[200],
        boxShadow: elevated
          ? `0 24px 90px -58px ${colors.shadowStrong}`
          : `0 12px 42px -34px ${colors.shadow}`,
        ...props.style,
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border-b px-6 py-4 ${className}`}
      style={{ borderColor: colors.surface[200] }}
    >
      {children}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}
