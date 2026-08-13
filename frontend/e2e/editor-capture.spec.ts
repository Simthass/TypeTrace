import { expect, test } from "@playwright/test";

import { STUDENT_AUTH_STATE } from "./support/env";

const EDITOR_CONSENT_STORAGE_KEY = "typetrace.editorEvidenceConsent.v1";

test.use({ storageState: STUDENT_AUTH_STATE });

test("editor captures genuine keyboard evidence before analysis", async ({ page }) => {
  await page.addInitScript((storageKey: string) => {
    window.localStorage.removeItem(storageKey);
  }, EDITOR_CONSENT_STORAGE_KEY);

  await page.goto("/editor/new");

  const consentDialog = page.getByRole("dialog", {
    name: "TypeTrace writing evidence consent",
    exact: true,
  });
  if (await consentDialog.isVisible().catch(() => false)) {
    await consentDialog
      .getByRole("button", {
        name: "I understand, start capturing",
        exact: true,
      })
      .click();
    await expect(consentDialog).toBeHidden();
  }

  const recoveryHeading = page.getByRole("heading", {
    name: "Continue your previous unfinished session?",
    exact: true,
  });
  if (
    await recoveryHeading
      .waitFor({ state: "visible", timeout: 3_000 })
      .then(() => true)
      .catch(() => false)
  ) {
    await page
      .getByRole("button", {
        name: "Discard local draft",
        exact: true,
      })
      .click();
    await expect(recoveryHeading).toBeHidden();
  }

  const title = page.getByLabel("Document title", { exact: true });
  const workspace = page.getByLabel("Writing workspace", { exact: true });
  const analyze = page.getByRole("button", {
    name: "Analyze session",
    exact: true,
  });

  await expect(title).toBeVisible();
  await expect(workspace).toBeVisible();
  await expect(analyze).toBeDisabled();

  await title.fill("Browser evidence contract");
  await workspace.click();
  await workspace.pressSequentially(
    "This browser gate verifies that TypeTrace captures a real keyboard event stream before analysis.",
    { delay: 8 },
  );

  const evidencePanel = page.getByRole("complementary");
  await expect(evidencePanel.getByText("Capture threshold", { exact: true })).toBeVisible();
  await expect(evidencePanel.getByText("Ready", { exact: true })).toBeVisible();
  await expect(analyze).toBeEnabled();

  const textValue = await workspace.inputValue();
  expect(textValue).toContain("TypeTrace captures a real keyboard event stream");
});
