import { expect, test } from "@playwright/test";

import { TEACHER_AUTH_STATE, optionalEnv } from "./support/env";
import {
  expectMinimumTouchTargets,
} from "./support/accessibility";
import { expectViewportContained } from "./support/responsive";

test.use({ storageState: TEACHER_AUTH_STATE });

test.describe("teacher responsive workflows", () => {
  test("teacher navigation and primary workspaces remain contained", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    if (testInfo.project.name === "chromium-mobile-responsive") {
      await page.setViewportSize({ width: 320, height: 568 });
    }

    await page.goto("/teacher/dashboard");

    await expect(
      page.getByRole("main").getByRole("heading", {
        name: "Review workspace",
        exact: true,
      }),
    ).toBeVisible();

    await expectViewportContained(page);

    const navigationButton = page.getByRole("button", {
      name: "Open navigation",
      exact: true,
    });

    await expect(navigationButton).toBeVisible();
    await navigationButton.click();

    const navigationDialog = page.getByRole("dialog", {
      name: "Teacher navigation",
      exact: true,
    });

    await expect(navigationDialog).toBeVisible();
    await expectViewportContained(page);

    await page.keyboard.press("Escape");
    await expect(navigationDialog).toHaveCount(0);
    await expect(navigationButton).toBeFocused();

    for (const [route, heading] of [
      ["/teacher/courses", "Courses"],
      ["/teacher/submissions", "Submissions"],
      ["/teacher/students", "Students"],
      ["/teacher/settings", "Settings"],
    ] as const) {
      await page.goto(route, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await expect(
        page.getByRole("main").getByRole("heading", {
          name: heading,
          exact: true,
        }),
      ).toBeVisible();
      await expectViewportContained(page);
    }

    if (testInfo.project.name === "chromium-mobile-responsive") {
      await expectMinimumTouchTargets(page);
    }
  });

  test("course cards and configured course detail reflow without a desktop table", async ({
    page,
  }) => {
    await page.goto("/teacher/courses");

    await expect(
      page.getByRole("main").getByRole("heading", {
        name: "Courses",
        exact: true,
      }),
    ).toBeVisible();
    await expectViewportContained(page);

    const firstCourse = page
      .getByRole("main")
      .getByRole("link", { name: /^View/i })
      .first();

    if ((await firstCourse.count()) === 0) {
      test.skip(true, "The configured teacher account has no course fixture.");
      return;
    }

    await firstCourse.click();
    await expect(page).toHaveURL(/\/teacher\/courses\/[^/]+$/);
    await expectViewportContained(page);

    const submissionsTab = page.getByRole("tab", {
      name: "Submissions",
      exact: true,
    });
    const studentsTab = page.getByRole("tab", {
      name: "Students",
      exact: true,
    });

    await expect(submissionsTab).toBeVisible();
    await studentsTab.click();
    await expect(studentsTab).toHaveAttribute("aria-selected", "true");
    await expectViewportContained(page);
  });

  test("configured teacher review dossier remains usable on mobile and tablet", async ({
    page,
  }) => {
    const sessionId = optionalEnv("E2E_SESSION_ID");
    test.skip(!sessionId, "E2E_SESSION_ID is not configured.");
    if (!sessionId) return;

    await page.goto(`/teacher/review/${encodeURIComponent(sessionId)}`);

    await expect(
      page.getByRole("heading", {
        name: "Teacher decision",
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      page.getByLabel("Review notes", {
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Save teacher decision",
        exact: true,
      }),
    ).toBeVisible();

    await expectViewportContained(page);
  });
});
