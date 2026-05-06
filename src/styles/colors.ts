/**
 * TypeTrace — Brand Color System
 * Single source of truth for all colors across the application.
 * Import from here — never hardcode hex values in components.
 * Changing a value here reflects across the entire system.
 */

export const colors = {
  // ─── Light Backgrounds (replaces old dark navy) ───────────────────────
  surface: {
    50: "#F5F7FA", // main page bg, header bg
    100: "#E8ECF1", // slightly darker for cards
    200: "#D1D9E0", // borders, dividers
  },

  // ─── Text Colors ──────────────────────────────────────────────────────
  text: {
    primary: "#1A2332", // main headings, body text
    secondary: "#5A6D80", // menu items, muted text
    light: "#FFFFFF", // text on dark elements (buttons etc)
  },

  // ─── Brand Colors (official palette) ──────────────────────────────────

  // Electric Blue — Primary action: buttons, links, cursor, active states
  blue: "#2A7FE0",

  // Steel Blue — Secondary text, metadata, labels, placeholder text
  steel: "#4A6E96",

  // Verification Green — Human-confirmed badge, positive ML score, certificate seal
  green: "#10B67E",

  // Warm Amber — Suspicious classification badge, warnings, low confidence
  amber: "#D48A00",

  // Alert Red — AI-detected badge, paste detection alert, anomaly flags
  red: "#E03B30",

  // Lime Accent — Secondary data series in charts, IKI graphs, typing speed
  lime: "#C4E26B",

  // Tints — Badge background fills
  mintTint: "#E6F9F0", // Human badge background
  amberTint: "#FEF4E0", // Suspicious badge background
  roseTint: "#FDECEA", // AI-detected badge background
} as const;

/**
 * Semantic aliases — preferred for component usage.
 * Intent-based naming makes components easier to read and maintain.
 */
export const brand = {
  // Structure
  bgHeader: colors.surface[50],
  bgPage: colors.surface[50],
  bgCard: colors.surface[100],
  bgNavActive: colors.surface[200],

  // Text
  textOnLight: colors.text.primary,
  textMuted: colors.text.secondary,
  textOnDark: colors.text.light,

  // Actions
  action: colors.blue,
  actionHover: "#1356A3",

  // Borders
  borderLight: colors.surface[200],
  borderCard: "#D1D9E0",

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
  chartPrimary: colors.blue,
  chartSecondary: colors.lime,
} as const;

export type BrandColor = keyof typeof brand;
