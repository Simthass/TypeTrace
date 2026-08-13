import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * TypeTrace authoritative frontend test/coverage configuration.
 *
 * Coverage intentionally measures the complete executable production
 * TypeScript/TSX source tree. Only test files, declarations/types and the Vite
 * bootstrap entry are excluded.
 *
 * The authoritative report directory is frontend/coverage.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/types/**",
        "src/main.tsx",
      ],
    },
  },
});
