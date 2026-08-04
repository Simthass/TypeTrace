import { expect, test } from "@playwright/test";

import {
  STUDENT_AUTH_STATE,
  TEACHER_AUTH_STATE,
} from "./support/env";
import {
  expectBaselineAccessibility,
  expectSkipLinkKeyboardAccess,
} from "./support/accessibility";

test.describe("baseline accessibility gate", () => {
  test("public home and certificate lookup expose named landmarks and controls", async ({
    page,
  }) => {
    for (const route of ["/", "/verify"]) {
      await page.goto(route);
      await expect(page.getByRole("main")).toBeVisible();
      await expectBaselineAccessibility(page);
    }

    await page.goto("/");
    await expectSkipLinkKeyboardAccess(page);
  });

  test("student dashboard exposes keyboard-accessible authenticated content", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: STUDENT_AUTH_STATE,
    });

    try {
      const page = await context.newPage();
      await page.goto("/dashboard");

      await expect(page.getByText("Total sessions", { exact: true })).toBeVisible();
      await expectBaselineAccessibility(page);
      await expectSkipLinkKeyboardAccess(page);
    } finally {
      await context.close();
    }
  });

  test("teacher workspace and course dialog satisfy the baseline gate", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: TEACHER_AUTH_STATE,
    });

    try {
      const page = await context.newPage();

      for (const route of [
        "/teacher/dashboard",
        "/teacher/submissions",
        "/teacher/students",
        "/teacher/courses",
      ]) {
        await page.goto(route);
        await expect(page.getByRole("main")).toBeVisible();
        await expectBaselineAccessibility(page);
      }

      await page.goto("/teacher/courses");
      const createCourseButton = page
        .getByRole("main")
        .getByRole("button", { name: "Create course", exact: true });

      await createCourseButton.click();

      const dialog = page.getByRole("dialog", {
        name: "Create new course",
        exact: true,
      });

      await expect(dialog).toBeVisible();
      await expectBaselineAccessibility(page);

      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(createCourseButton).toBeFocused();
    } finally {
      await context.close();
    }
  });
});
