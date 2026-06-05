export const colors = {
  surface: {
    50: "#FFFFFF",
    100: "#F8FAFC",
    200: "#E2E8F0",
  },

  text: {
    primary: "#0F172A",
    secondary: "#64748B",
    light: "#FFFFFF",
  },

  brand: "#2563EB",
  brandHover: "#1D4ED8",

  steel: "#64748B",

  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",

  mintTint: "#ECFDF5",
  amberTint: "#FFFBEB",
  roseTint: "#FEF2F2",
} as const;

export const brand = {
  // Backgrounds
  bgHeader: colors.surface[50],
  bgPage: colors.surface[50],
  bgCard: "#FFFFFF",
  bgNavActive: "#EFF6FF",

  // Text
  textOnLight: colors.text.primary,
  textMuted: colors.text.secondary,
  textOnDark: colors.text.light,

  // Primary Actions
  action: colors.brand,
  actionHover: colors.brandHover,

  // Borders
  borderLight: colors.surface[200],
  borderCard: colors.surface[200],

  // Human
  humanBg: colors.mintTint,
  humanText: "#065F46",
  humanAccent: colors.green,

  // Suspicious
  suspiciousBg: colors.amberTint,
  suspiciousText: "#92400E",
  suspiciousAccent: colors.amber,

  // AI
  aiBg: colors.roseTint,
  aiText: "#991B1B",
  aiAccent: colors.red,

  // Charts
  chartPrimary: colors.brand,
  chartSecondary: colors.green,
} as const;
