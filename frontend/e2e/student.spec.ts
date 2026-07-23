import { expect, test } from "@playwright/test";

import { STUDENT_AUTH_STATE, optionalEnv } from "./support/env";

test.use({ storageState: STUDENT_AUTH_STATE });

test.describe("student browser workflows", () => {
  test("student dashboard loads authenticated evidence metrics", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Total sessions", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Certificates issued", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Dashboard unavailable")).toHaveCount(0);
  });

  test("student is redirected away from teacher-only routes", async ({
    page,
  }) => {
    await page.goto("/teacher/dashboard");

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Total sessions", { exact: true })).toBeVisible();
  });

  test("student can open sessions, drafts, certificates and settings", async ({
    page,
  }) => {
    await page.goto("/sessions");
    await expect(
      page
        .getByRole("main")
        .getByRole("heading", {
          name: "Writing Sessions",
          exact: true,
        }),
    ).toBeVisible();

    await page.goto("/drafts");
    await expect(
      page
        .getByRole("main")
        .getByRole("heading", {
          name: "Saved Drafts",
          exact: true,
        }),
    ).toBeVisible();

    await page.goto("/certificates");
    await expect(
      page
        .getByRole("main")
        .getByRole("heading", {
          name: "Certificates",
          exact: true,
        }),
    ).toBeVisible();

    await page.goto("/dashboard/settings");
    await expect(
      page
        .getByRole("main")
        .getByRole("heading", {
          name: "Settings",
          exact: true,
        }),
    ).toBeVisible();
  });

  test("editor starts with capture consent and a disabled analysis action", async ({
    page,
  }) => {
    await page.goto("/editor/new");

    const consentButton = page.getByRole("button", {
      name: "I understand, start capturing",
      exact: true,
    });

    if (await consentButton.isVisible().catch(() => false)) {
      await consentButton.click();
    }

    await expect(
      page.getByLabel("Document title", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Writing workspace", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Analyze session",
        exact: true,
      }),
    ).toBeDisabled();
  });

  test("configured session replay is available to its student owner", async ({
    page,
  }) => {
    const sessionId = optionalEnv("E2E_SESSION_ID");
    test.skip(!sessionId, "E2E_SESSION_ID is not configured.");
    if (!sessionId) return;

    await page.goto(`/session/${sessionId}/replay`);

    await expect(page.getByText("Replay unavailable")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: /Replay Audit:/i }),
    ).toBeVisible();
  });
});
