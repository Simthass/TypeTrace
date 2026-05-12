/**
 * TypeTrace — Brand Color System
 * Single source of truth for all colors across the application.
 */

export const colors = {
  // ─── Light Backgrounds (Vercel/Linear aesthetic) ──────────────────────
  surface: {
    50: "#FAFAFA", // main page bg, header bg (ultra-light gray)
    100: "#F4F4F5", // slightly darker for hover states/menus
    200: "#EAEAEA", // crisp, thin borders and dividers
  },

  // ─── Text Colors ──────────────────────────────────────────────────────
  text: {
    primary: "#111827", // Almost black for maximum readability
    secondary: "#6B7280", // Sharp slate gray for secondary info
    light: "#FFFFFF", // Pure white for text on black buttons
  },

  // ─── Brand Colors (Monochromatic primary) ─────────────────────────────

  // Black — Primary action: buttons, links, active states
  black: "#000000",

  // Steel — Secondary text, metadata, labels
  steel: "#4B5563",

  // ─── Semantic Colors (Kept for Biometric Badges) ──────────────────────
  green: "#10B67E",
  amber: "#D48A00",
  red: "#E03B30",
  lime: "#C4E26B",

  // Tints — Badge background fills
  mintTint: "#E6F9F0",
  amberTint: "#FEF4E0",
  roseTint: "#FDECEA",
} as const;

/**
 * Semantic aliases — preferred for component usage.
 */
export const brand = {
  // Structure
  bgHeader: colors.surface[50],
  bgPage: colors.surface[50],
  bgCard: "#FFFFFF", // Strict white for cards resting on FAFAFA
  bgNavActive: colors.surface[100],

  // Text
  textOnLight: colors.text.primary,
  textMuted: colors.text.secondary,
  textOnDark: colors.text.light,

  // Actions (Now Monochromatic)
  action: colors.black,
  actionHover: "#333333", // Dark graphite for hover states

  // Borders
  borderLight: colors.surface[200],
  borderCard: colors.surface[200],

  // Classification
  humanBg: colors.mintTint,
  humanText: "#0D7A4C",
  humanAccent: colors.green,

  suspiciousBg: colors.amberTint,
  suspiciousText: "#8C5B00",
  suspiciousAccent: colors.amber,

  aiBg: colors.roseTint,
  aiText: "#9B1C1C",
  aiAccent: colors.red,

  // Data viz
  chartPrimary: colors.black,
  chartSecondary: colors.lime,
} as const;

export type BrandColor = keyof typeof brand;
