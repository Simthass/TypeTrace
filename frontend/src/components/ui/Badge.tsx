// frontend/src/components/ui/Badge.tsx

import type { ReactNode } from "react";

import { brand, colors } from "../../styles/colors";
import type { BadgeTone } from "./badgeTone";

function getBadgeStyle(tone: BadgeTone) {
  if (tone === "brand") {
    return {
      background: colors.brandSoft,
      borderColor: colors.brand,
      color: colors.brand,
    };
  }

  if (tone === "human" || tone === "verified") {
    return {
      background: brand.humanBg,
      borderColor: brand.humanAccent,
      color: brand.humanText,
    };
  }

  if (tone === "suspicious") {
    return {
      background: brand.suspiciousBg,
      borderColor: brand.suspiciousAccent,
      color: brand.suspiciousText,
    };
  }

  if (tone === "danger") {
    return {
      background: brand.aiBg,
      borderColor: brand.aiAccent,
      color: brand.aiText,
    };
  }

  return {
    background: colors.surface[100],
    borderColor: colors.surface[200],
    color: colors.text.secondary,
  };
}

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  const style = getBadgeStyle(tone);

  return (
    <span
      className={`inline-flex w-fit items-center rounded-md border px-2.5 py-1 text-[11px] font-bold leading-none ${className}`}
      style={style}
    >
      {children}
    </span>
  );
}
