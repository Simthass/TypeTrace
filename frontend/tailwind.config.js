/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ─── Surface colors ───────────────────────────────
        surface: {
          50: "#FAFAFA",
          100: "#F4F4F5",
          200: "#EAEAEA",
        },

        // ─── Text colors ──────────────────────────────────
        text: {
          primary: "#111827",
          secondary: "#6B7280",
        },

        // ─── Official brand palette (Now Black/White) ─────
        brand: {
          DEFAULT: "#000000",
          hover: "#333333",
          light: "#F4F4F5",
          muted: "#888888",
        },

        steel: {
          DEFAULT: "#4B5563",
          light: "#E5E7EB",
        },

        verify: {
          DEFAULT: "#10B67E",
          bg: "#E6F9F0",
          text: "#0D7A4C",
        },

        warn: {
          DEFAULT: "#D48A00",
          bg: "#FEF4E0",
          text: "#8C5B00",
        },

        danger: {
          DEFAULT: "#E03B30",
          bg: "#FDECEA",
          text: "#9B1C1C",
        },

        lime: {
          DEFAULT: "#C4E26B",
          dark: "#3C6000",
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
