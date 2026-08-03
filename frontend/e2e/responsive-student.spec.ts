import { expect, test } from "@playwright/test";

import { STUDENT_AUTH_STATE, optionalEnv } from "./support/env";
import { expectViewportContained } from "./support/responsive";

test.use({ storageState: STUDENT_AUTH_STATE });

test.describe("student responsive workflows", () => {
  test("student navigation and record pages use mobile cards", async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name === "chromium-mobile-responsive") {
      await page.setViewportSize({ width: 320, height: 568 });
    }
    await page.goto("/dashboard");

    await expect(page.getByText("Total sessions", { exact: true })).toBeVisible();
    await expectViewportContained(page);

    const navigationButton = page.getByRole("button", {
      name: "Open navigation",
    });
    if (await navigationButton.isVisible().catch(() => false)) {
      await navigationButton.click();
      await expect(
        page.getByRole("dialog", { name: "Student navigation" }),
      ).toBeVisible();
      await expectViewportContained(page);
      await page.keyboard.press("Escape");
    } else {
      await expect(
        page
          .getByRole("navigation")
          .getByRole("link", { name: "New Session", exact: true }),
      ).toBeVisible();
    }

    for (const route of ["/drafts", "/sessions", "/certificates"]) {
      await page.goto(route);
      await expect(page.getByRole("main")).toBeVisible();
      await expectViewportContained(page);
    }
  });


  test("student analytics, course join, and settings remain contained", async ({
    page,
  }) => {
    for (const route of ["/analytics", "/join-course", "/dashboard/settings"]) {
      await page.goto(route);
      await expect(page.getByRole("main")).toBeVisible();
      await expectViewportContained(page);
    }
  });

  test("editor keeps primary actions and the writing surface accessible", async ({
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
      page.getByRole("button", { name: /Analyze/i }),
    ).toBeVisible();
    await expect(page.getByText("Session evidence", { exact: true })).toBeVisible();

    await expectViewportContained(page);
  });

  test("configured replay remains contained on mobile and tablet", async ({
    page,
  }) => {
    const sessionId = optionalEnv("E2E_SESSION_ID");
    test.skip(!sessionId, "E2E_SESSION_ID is not configured.");
    if (!sessionId) return;

    await page.goto(`/sessions/${encodeURIComponent(sessionId)}`);
    await expect(page.getByRole("main")).toBeVisible();
    await expectViewportContained(page);

    await page.goto(`/session/${encodeURIComponent(sessionId)}/replay`);

    await expect(
      page.getByRole("heading", { name: /Replay Audit:/i }),
    ).toBeVisible();
    await expect(page.getByText("Replay unavailable")).toHaveCount(0);
    await expectViewportContained(page);
  });
});
