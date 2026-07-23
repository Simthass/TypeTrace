import { expect, test } from "@playwright/test";

import { TEACHER_AUTH_STATE, optionalEnv } from "./support/env";

test.use({ storageState: TEACHER_AUTH_STATE });

test.describe("teacher browser workflows", () => {
  test("teacher dashboard and review navigation load", async ({ page }) => {
    await page.goto("/teacher/dashboard");

    await expect(
      page
        .getByRole("main")
        .getByRole("heading", {
          name: "Review workspace",
          exact: true,
        }),
    ).toBeVisible();

    await page.goto("/teacher/courses");
    await expect(
      page
        .getByRole("main")
        .getByRole("heading", {
          name: "Courses",
          exact: true,
        }),
    ).toBeVisible();

    await page.goto("/teacher/submissions");
    await expect(
      page
        .getByRole("main")
        .getByRole("heading", {
          name: "Submissions",
          exact: true,
        }),
    ).toBeVisible();

    await page.goto("/teacher/students");
    await expect(
      page
        .getByRole("main")
        .getByRole("heading", {
          name: "Students",
          exact: true,
        }),
    ).toBeVisible();
  });

  test("teacher is redirected away from student-only routes", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/teacher\/dashboard$/);
    await expect(
      page
        .getByRole("main")
        .getByRole("heading", {
          name: "Review workspace",
          exact: true,
        }),
    ).toBeVisible();
  });

  test("configured submission opens in the teacher review dossier", async ({
    page,
  }) => {
    const sessionId = optionalEnv("E2E_SESSION_ID");
    test.skip(!sessionId, "E2E_SESSION_ID is not configured.");
    if (!sessionId) return;

    await page.goto(`/teacher/review/${sessionId}`);

    await expect(page.getByText("Submission not found")).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: "Teacher decision",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Save teacher decision",
        exact: true,
      }),
    ).toBeVisible();
  });
});
