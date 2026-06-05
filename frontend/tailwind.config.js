/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ─── Surface Colors ──────────────────────────────────
        surface: {
          50: "#FFFFFF",
          100: "#F8FAFC",
          200: "#E2E8F0",
        },

        // ─── Text Colors ─────────────────────────────────────
        text: {
          primary: "#0F172A",
          secondary: "#64748B",
          light: "#FFFFFF",
        },

        // ─── Brand Colors ────────────────────────────────────
        brand: {
          DEFAULT: "#2563EB",
          hover: "#1D4ED8",
          light: "#DBEAFE",
          muted: "#93C5FD",
        },

        // ─── Neutral Supporting Colors ──────────────────────
        steel: {
          DEFAULT: "#64748B",
          light: "#E2E8F0",
        },

        // ─── Success ────────────────────────────────────────
        verify: {
          DEFAULT: "#10B981",
          bg: "#ECFDF5",
          text: "#065F46",
        },

        // ─── Warning ────────────────────────────────────────
        warn: {
          DEFAULT: "#F59E0B",
          bg: "#FFFBEB",
          text: "#92400E",
        },

        // ─── Danger ─────────────────────────────────────────
        danger: {
          DEFAULT: "#EF4444",
          bg: "#FEF2F2",
          text: "#991B1B",
        },
      },

      fontFamily: {
        sans: ["Geist", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "Fira Code", "monospace"],
      },

      maxWidth: {
        container: "1200px",
      },

      boxShadow: {
        // Flattened shadows slightly to match the brutalist aesthetic
        card: "0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.02)",
        "card-md": "0 4px 12px rgba(0,0,0,0.05)",
        modal: "0 8px 30px rgba(0,0,0,0.08)",
        header: "0 1px 2px rgba(0,0,0,0.03)",
      },

      keyframes: {
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },

      animation: {
        "slide-down": "slideDown 150ms ease forwards",
        "fade-in": "fadeIn 150ms ease forwards",
      },
    },
  },
  plugins: [],
};
