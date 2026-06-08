// frontend/src/components/ui/Button.tsx

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

import { brand, colors } from "../../styles/colors";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-[12.5px]",
  md: "h-10 px-4 text-[13px]",
  lg: "h-11 px-5 text-[14px]",
};

function getButtonStyle(variant: ButtonVariant) {
  if (variant === "primary") {
    return {
      background: colors.brand,
      borderColor: colors.brand,
      color: colors.text.light,
    };
  }

  if (variant === "danger") {
    return {
      background: brand.aiBg,
      borderColor: brand.aiAccent,
      color: brand.aiText,
    };
  }

  if (variant === "ghost") {
    return {
      background: "transparent",
      borderColor: "transparent",
      color: colors.text.secondary,
    };
  }

  return {
    background: colors.surface[50],
    borderColor: colors.surface[200],
    color: colors.text.primary,
  };
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const style = getButtonStyle(variant);

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${sizeClasses[size]} ${className}`}
      style={{
        ...style,
        boxShadow:
          variant === "primary"
            ? `0 12px 28px -18px ${colors.brand}`
            : undefined,
      }}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  leftIcon,
  rightIcon,
  children,
  className = "",
  ...props
}: ButtonLinkProps) {
  const style = getButtonStyle(variant);

  return (
    <Link
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md border font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${sizeClasses[size]} ${className}`}
      style={{
        ...style,
        boxShadow:
          variant === "primary"
            ? `0 12px 28px -18px ${colors.brand}`
            : undefined,
      }}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  );
}
