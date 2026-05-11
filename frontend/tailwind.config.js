/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ─── Surface colors (light theme) ───────────────────────────────
        surface: {
          50: "#F5F7FA",
          100: "#E8ECF1",
          200: "#D1D9E0",
        },

        // ─── Text colors ────────────────────────────────────────────────
        text: {
          primary: "#1A2332",
          secondary: "#5A6D80",
        },

        // ─── Official brand palette ─────────────────────────────────────
        brand: {
          DEFAULT: "#2A7FE0",
          hover: "#1356A3",
          light: "#EBF4FF",
          muted: "#7BAADB",
        },

        steel: {
          DEFAULT: "#4A6E96",
          light: "#C5D7EE",
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

      // ─── UPDATED: Font Families ─────────────────────────────────────
      fontFamily: {
        // Replaced DM Sans with Geist
        sans: ["Geist", "system-ui", "sans-serif"],
        // Replaced JetBrains Mono with Geist Mono for consistency
        mono: ["Geist Mono", "Fira Code", "monospace"],
      },

      maxWidth: {
        container: "1200px",
      },

      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-md": "0 4px 12px rgba(0,0,0,0.08)",
        modal: "0 8px 30px rgba(0,0,0,0.12)",
        header: "0 1px 3px rgba(0,0,0,0.04)",
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
