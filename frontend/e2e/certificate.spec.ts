import { expect, test } from "@playwright/test";

import { optionalEnv } from "./support/env";

test("configured certificate is publicly verifiable without authentication", async ({
  page,
}) => {
  const certificateId = optionalEnv("E2E_CERTIFICATE_ID");
  test.skip(!certificateId, "E2E_CERTIFICATE_ID is not configured.");
  if (!certificateId) return;

  await page.goto(`/verify/${encodeURIComponent(certificateId)}`);

  await expect(page.getByText("Certificate verified")).toBeVisible();
  await expect(page.getByText(certificateId).first()).toBeVisible();
  await expect(page.getByText(/raw keystroke data/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Export PDF" })).toBeVisible();
});
