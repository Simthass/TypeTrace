import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";
import { config as loadEnvironment } from "dotenv";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

loadEnvironment({
  path: path.resolve(configDirectory, ".env.e2e"),
});

const frontendUrl =
  process.env.E2E_FRONTEND_URL || "http://127.0.0.1:5174";
const backendUrl =
  process.env.E2E_BACKEND_URL || "http://127.0.0.1:8010";

const startServers =
  String(process.env.E2E_START_SERVERS || "true").toLowerCase() !== "false";
const reuseExistingServers =
  String(process.env.E2E_REUSE_EXISTING_SERVERS || "false").toLowerCase() ===
  "true";

const frontendAddress = new URL(frontendUrl);
const backendAddress = new URL(backendUrl);

const frontendPort =
  frontendAddress.port ||
  (frontendAddress.protocol === "https:" ? "443" : "80");
const backendPort =
  backendAddress.port ||
  (backendAddress.protocol === "https:" ? "443" : "80");

const backendPython =
  process.platform === "win32"
    ? ".\\venv\\Scripts\\python.exe"
    : "./venv/bin/python";

function inheritedEnvironment(
  overrides: Record<string, string>,
): Record<string, string> {
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

  return {
    ...inherited,
    ...overrides,
  };
}

const allowedOrigins = Array.from(
  new Set([
    frontendUrl,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]),
).join(",");

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results/e2e-artifacts",
  timeout: 60_000,
  expect: {
    timeout: 12_000,
  },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL: frontendUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium-e2e",
      testIgnore: [
        /auth\.setup\.ts/,
        /public-cross-browser\.spec\.ts/,
        /responsive-public\.spec\.ts/,
        /responsive-student\.spec\.ts/,
        /responsive-teacher\.spec\.ts/,
        /accessibility\.spec\.ts/,
      ],
      dependencies: ["auth-setup"],
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "chromium-public",
      testMatch: /public-cross-browser\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "firefox-public",
      testMatch: /public-cross-browser\.spec\.ts/,
      use: {
        ...devices["Desktop Firefox"],
      },
    },
    {
      name: "webkit-public",
      testMatch: /public-cross-browser\.spec\.ts/,
      use: {
        ...devices["Desktop Safari"],
      },
    },
    {
      name: "chromium-mobile-responsive",
      testMatch: [
        /responsive-public\.spec\.ts/,
        /responsive-student\.spec\.ts/,
        /responsive-teacher\.spec\.ts/,
      ],
      dependencies: ["auth-setup"],
      use: {
        ...devices["Pixel 5"],
      },
    },
    {
      name: "chromium-tablet-responsive",
      testMatch: [
        /responsive-public\.spec\.ts/,
        /responsive-student\.spec\.ts/,
        /responsive-teacher\.spec\.ts/,
      ],
      dependencies: ["auth-setup"],
      use: {
        ...devices["iPad Mini"],
      },
    },
    {
      name: "chromium-accessibility",
      testMatch: /accessibility\.spec\.ts/,
      dependencies: ["auth-setup"],
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: startServers
    ? [
        {
          name: "TypeTrace API",
          command:
            `${backendPython} -m uvicorn app.main:app ` +
            `--host ${backendAddress.hostname} --port ${backendPort}`,
          cwd: path.resolve(configDirectory, "../backend"),
          url: `${backendUrl}/api/v1/health`,
          reuseExistingServer: reuseExistingServers,
          timeout: 120_000,
          stdout: "pipe",
          stderr: "pipe",
          env: inheritedEnvironment({
            FRONTEND_URL: frontendUrl,
            ALLOWED_ORIGINS: allowedOrigins,
            RATE_LIMIT_STORAGE_URI: "memory://",
          }),
        },
        {
          name: "TypeTrace frontend",
          command:
            "npm run dev -- " +
            `--host ${frontendAddress.hostname} ` +
            `--port ${frontendPort} --strictPort`,
          cwd: configDirectory,
          url: frontendUrl,
          reuseExistingServer: reuseExistingServers,
          timeout: 120_000,
          stdout: "pipe",
          stderr: "pipe",
          env: inheritedEnvironment({
            VITE_API_BASE_URL: `${backendUrl}/api/v1`,
          }),
        },
      ]
    : undefined,
});
