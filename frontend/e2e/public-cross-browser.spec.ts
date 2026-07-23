import { expect, test } from "@playwright/test";

test("public home page loads its primary workflow", async ({ page }) => {
  await page.goto("/");

  const main = page.getByRole("main");

  await expect(
    main.getByRole("heading", {
      name: /Capture the Writing Process Behind Every Draft/i,
    }),
  ).toBeVisible();

  await expect(
    main
      .getByRole("link", {
        name: "Start a writing session",
        exact: true,
      })
      .first(),
  ).toBeVisible();

  await expect(page).toHaveTitle(/TypeTrace/i);
});

test("public certificate lookup validates malformed identifiers", async ({
  page,
}) => {
  await page.goto("/verify");

  await page
    .getByRole("textbox", {
      name: "Certificate ID",
      exact: true,
    })
    .fill("bad");

  await page
    .getByRole("button", {
      name: "Verify certificate",
      exact: true,
    })
    .click();

  await expect(page).toHaveURL(/\/verify$/);
  await expect(
    page.getByText(/certificate ID is incomplete/i).first(),
  ).toBeVisible();
});

test("unknown but well-formed certificate returns an invalid result", async ({
  page,
}) => {
  await page.goto("/verify/TT26-E2E-NOT-FOUND");

  await expect(
    page.getByRole("heading", {
      name: "Certificate not found",
      exact: true,
    }),
  ).toBeVisible();
});
