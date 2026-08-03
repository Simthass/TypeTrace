import { expect, test } from "@playwright/test";

import { optionalEnv } from "./support/env";
import { expectViewportContained } from "./support/responsive";

test.describe("public responsive workflows", () => {
  test("compact home and navigation remain inside the viewport", async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name === "chromium-mobile-responsive") {
      await page.setViewportSize({ width: 320, height: 568 });
    }
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: /Capture the Writing Process Behind Every Draft/i,
      }),
    ).toBeVisible();

    await expectViewportContained(page);

    const menuButton = page.getByRole("button", { name: "Open menu" });
    if (await menuButton.isVisible().catch(() => false)) {
      await menuButton.click();
      await expect(
        page.getByRole("dialog", { name: "Site navigation" }),
      ).toBeVisible();
      await expectViewportContained(page);

      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("dialog", { name: "Site navigation" }),
      ).toHaveCount(0);
    } else {
      const mainNavigation = page.getByRole("navigation", {
        name: "Main navigation",
      });

      await expect(
        mainNavigation.getByRole("button", { name: "Product" }),
      ).toBeVisible();
      await expect(
        mainNavigation.getByRole("link", { name: "Verify" }),
      ).toBeVisible();
    }
  });


  test("public information pages remain readable without page-level overflow", async ({
    page,
  }) => {
    for (const route of [
      "/features",
      "/how-it-works",
      "/about",
      "/privacy",
      "/help",
    ]) {
      await page.goto(route);
      await expect(page.getByRole("main")).toBeVisible();
      await expectViewportContained(page);
    }
  });

  test("certificate lookup stacks its form without horizontal scrolling", async ({
    page,
  }) => {
    await page.goto("/verify");

    await expect(
      page.getByRole("textbox", { name: "Certificate ID", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Verify certificate", exact: true }),
    ).toBeVisible();

    await expectViewportContained(page);
  });

  test("configured public certificate remains readable on a narrow screen", async ({
    page,
  }) => {
    const certificateId = optionalEnv("E2E_CERTIFICATE_ID");
    test.skip(!certificateId, "E2E_CERTIFICATE_ID is not configured.");
    if (!certificateId) return;

    await page.goto(`/verify/${encodeURIComponent(certificateId)}`);

    await expect(page.getByText("Certificate record verified")).toBeVisible();
    await expect(page.getByRole("link", { name: "Export PDF" })).toBeVisible();
    await expectViewportContained(page);
  });
});
