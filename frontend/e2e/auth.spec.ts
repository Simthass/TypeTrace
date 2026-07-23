import { expect, test } from "@playwright/test";

import { requiredEnv } from "./support/env";

test.describe("browser authentication", () => {
  test("invalid credentials return a controlled error", async ({ page }) => {
    await page.goto("/login");

    const unknownEmail = `missing-user-${Date.now()}@example.com`;

    await page
      .getByLabel("Email address", { exact: true })
      .fill(unknownEmail);
    await page
      .getByLabel("Password", { exact: true })
      .fill("IncorrectPass123!");

    const loginResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/auth/login") &&
        response.request().method() === "POST",
    );

    await page
      .getByRole("button", {
        name: "Sign in",
        exact: true,
      })
      .click();

    const loginResponse = await loginResponsePromise;
    const responseText = await loginResponse.text();

    expect(
      loginResponse.status(),
      `Expected invalid credentials to return HTTP 401, received ` +
        `${loginResponse.status()}: ${responseText}`,
    ).toBe(401);

    expect(responseText).toMatch(/Invalid credentials/i);

    await expect(page).toHaveURL(/\/login$/);

    const statusRegion = page.getByRole("status");

    await expect(
      statusRegion.getByText("Login failed", { exact: true }),
    ).toBeVisible();
    await expect(
      statusRegion.getByText(/Invalid credentials/i),
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Sign in",
        exact: true,
      }),
    ).toBeEnabled();
  });

  test("student can sign in through the visible login form", async ({
    page,
  }) => {
    await page.goto("/login");

    await page
      .getByLabel("Email address", { exact: true })
      .fill(requiredEnv("E2E_STUDENT_EMAIL"));
    await page
      .getByLabel("Password", { exact: true })
      .fill(requiredEnv("E2E_STUDENT_PASSWORD"));
    await page
      .getByRole("button", {
        name: "Sign in",
        exact: true,
      })
      .click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Total sessions", { exact: true })).toBeVisible();
    await expect(page.getByText("Dashboard unavailable")).toHaveCount(0);
  });
});
