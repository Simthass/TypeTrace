// frontend/src/styles/colors.ts

/**
 * TypeTrace Brand Color System
 * Single source of truth for all UI colors.
 */

export const colors = {
  surface: {
    50: "#FFFFFF",
    100: "#F8FAFC",
    150: "#F1F5F9",
    200: "#E2E8F0",
    300: "#CBD5E1",
  },

  text: {
    primary: "#0F172A",
    secondary: "#64748B",
    muted: "#94A3B8",
    light: "#FFFFFF",
  },

  brand: "#2563EB",
  brandHover: "#1D4ED8",
  brandSoft: "#EFF6FF",

  steel: "#64748B",

  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",

  mintTint: "#ECFDF5",
  amberTint: "#FFFBEB",
  roseTint: "#FEF2F2",

  shadow: "rgba(15, 23, 42, 0.08)",
  shadowStrong: "rgba(15, 23, 42, 0.14)",
} as const;

export const brand = {
  // Backgrounds
  bgHeader: colors.surface[50],
  bgPage: colors.surface[50],
  bgSubtle: colors.surface[100],
  bgCard: "#FFFFFF",
  bgNavActive: colors.brandSoft,

  // Text
  textOnLight: colors.text.primary,
  textMuted: colors.text.secondary,
  textSubtle: colors.text.muted,
  textOnDark: colors.text.light,

  // Primary Actions
  action: colors.brand,
  actionHover: colors.brandHover,

  // Borders
  borderLight: colors.surface[200],
  borderCard: colors.surface[200],
  borderStrong: colors.surface[300],

  // Human
  humanBg: colors.mintTint,
  humanText: "#065F46",
  humanAccent: colors.green,

  // Suspicious
  suspiciousBg: colors.amberTint,
  suspiciousText: "#92400E",
  suspiciousAccent: colors.amber,

  // AI / High Risk
  aiBg: colors.roseTint,
  aiText: "#991B1B",
  aiAccent: colors.red,

  // Charts
  chartPrimary: colors.brand,
  chartSecondary: colors.green,
  chartWarning: colors.amber,
  chartDanger: colors.red,
} as const;
