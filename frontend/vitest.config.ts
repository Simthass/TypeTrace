import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

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
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: [
        "src/lib/**/*.{ts,tsx}",
        "src/store/**/*.{ts,tsx}",
        "src/components/guards/**/*.{ts,tsx}",
      ],
      exclude: ["src/**/*.d.ts", "src/test/**", "src/**/*.test.{ts,tsx}"],
    },
  },
});
