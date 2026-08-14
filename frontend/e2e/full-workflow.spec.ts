import { expect, test } from "@playwright/test";

import {
  STUDENT_AUTH_STATE,
  TEACHER_AUTH_STATE,
  booleanEnv,
  requiredEnv,
} from "./support/env";

const EDITOR_CONSENT_STORAGE_KEY = "typetrace.editorEvidenceConsent.v1";

test.describe.configure({ mode: "serial" });

test("student submits evidence, teacher reviews it, and the certificate verifies", async ({
  browser,
}) => {
  test.skip(
    !booleanEnv("E2E_MUTATING_WORKFLOW"),
    "Set E2E_MUTATING_WORKFLOW=true to run the database-mutating workflow.",
  );

  test.setTimeout(120_000);

  const inviteCode = requiredEnv("E2E_COURSE_INVITE_CODE");
  const uniqueTitle = `E2E evidence ${Date.now()}`;

  const studentContext = await browser.newContext({
    storageState: STUDENT_AUTH_STATE,
  });

  /*
   * Force this workflow to exercise the real consent step deterministically.
   * The init script runs before the editor application reads localStorage.
   */
  await studentContext.addInitScript((storageKey: string) => {
    window.localStorage.removeItem(storageKey);
  }, EDITOR_CONSENT_STORAGE_KEY);

  const teacherContext = await browser.newContext({
    storageState: TEACHER_AUTH_STATE,
  });
  const publicContext = await browser.newContext();

  try {
    const studentPage = await studentContext.newPage();

    await studentPage.goto("/join-course");
    await studentPage.getByPlaceholder("TT-XXXXXXXX").fill(inviteCode);

    const joinResponsePromise = studentPage.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/courses/join") &&
        response.request().method() === "POST",
    );

    await studentPage
      .getByRole("button", {
        name: /Join course/i,
      })
      .click();

    const joinResponse = await joinResponsePromise;
    expect(joinResponse.ok(), await joinResponse.text()).toBeTruthy();

    const joinedCourse = (await joinResponse.json()) as {
      course: {
        id: number;
        course_name: string;
        course_code: string;
      };
    };

    await studentPage.goto("/editor/new");

    const consentDialog = studentPage.getByRole("dialog", {
      name: "TypeTrace writing evidence consent",
      exact: true,
    });

    await expect(consentDialog).toBeVisible();

    await consentDialog
      .getByRole("button", {
        name: "I understand, start capturing",
        exact: true,
      })
      .click();

    await expect(consentDialog).toBeHidden();

    /*
     * A previous interrupted editor run may have left a synced recovery draft.
     * Wait for the asynchronous recovery lookup, then discard that draft before
     * starting this new isolated workflow. This handles both IndexedDB/local
     * mirrors and server-synced drafts through the application's real UI path.
     */
    const recoveryDialog = studentPage.getByRole("dialog", {
      name: "Continue your previous unfinished session?",
      exact: true,
    });

    const recoveryAppeared = await recoveryDialog
      .waitFor({
        state: "visible",
        timeout: 5_000,
      })
      .then(() => true)
      .catch(() => false);

    if (recoveryAppeared) {
      await recoveryDialog
        .getByRole("button", {
          name: "Discard local draft",
          exact: true,
        })
        .click();

      await expect(recoveryDialog).toHaveCount(0);
    }

    const titleInput = studentPage.getByLabel("Document title", {
      exact: true,
    });
    const writingWorkspace = studentPage.getByLabel("Writing workspace", {
      exact: true,
    });

    await expect(titleInput).toBeVisible();
    await expect(writingWorkspace).toBeVisible();

    await titleInput.fill(uniqueTitle);
    await writingWorkspace.click();
    await writingWorkspace.pressSequentially(
      "This controlled browser test records a genuine sequence of keyboard events for the TypeTrace evidence pipeline.",
      { delay: 12 },
    );

    const analyzeButton = studentPage.getByRole("button", {
      name: "Analyze session",
      exact: true,
    });

    await expect(analyzeButton).toBeEnabled();
    await analyzeButton.click();

    await expect(
      studentPage.getByRole("heading", {
        name: "Where does this session belong?",
        exact: true,
      }),
    ).toBeVisible();

    /*
     * A course option's accessible name contains both the visible course name
     * and course code, for example "Computer Security CSJAN2026". Match that
     * complete accessible name rather than only the course name.
     */
    const courseOptionName = `${joinedCourse.course.course_name} ${joinedCourse.course.course_code}`;

    const courseOption = studentPage.getByRole("button", {
      name: courseOptionName,
      exact: true,
    });

    await expect(
      courseOption,
      `Expected the joined course option "${courseOptionName}" to be visible.`,
    ).toBeVisible({ timeout: 15_000 });

    await courseOption.click();

    const analysisResponsePromise = studentPage.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/sessions/analyze") &&
        response.request().method() === "POST",
    );

    await studentPage
      .getByRole("button", {
        name: "Run analysis",
        exact: true,
      })
      .click();

    const analysisResponse = await analysisResponsePromise;
    const analysisResponseText = await analysisResponse.text();

    expect(
      analysisResponse.ok(),
      `Analysis failed: ${analysisResponse.status()} ${analysisResponseText}`,
    ).toBeTruthy();

    const result = JSON.parse(analysisResponseText) as {
      session_id: number;
      certificate_id: string;
    };

    expect(result.session_id).toBeTruthy();
    expect(result.certificate_id).toBeTruthy();

    await expect(
      studentPage.getByRole("heading", {
        name: "Analysis complete",
        exact: true,
      }),
    ).toBeVisible();

    await studentPage
      .getByRole("button", {
        name: "View replay audit",
        exact: true,
      })
      .click();

    await expect(studentPage).toHaveURL(
      new RegExp(`/session/${result.session_id}/replay$`),
    );

    await expect(
      studentPage.getByRole("heading", {
        name: /Replay Audit:/i,
      }),
    ).toBeVisible();

    const teacherPage = await teacherContext.newPage();

    await teacherPage.goto(`/teacher/review/${result.session_id}`);

    await expect(
      teacherPage.getByRole("heading", {
        name: uniqueTitle,
        exact: true,
      }),
    ).toBeVisible();

    await teacherPage
      .getByRole("button", {
        name: /Approve evidence/i,
      })
      .click();

    await teacherPage
      .getByLabel("Review notes", {
        exact: true,
      })
      .fill("Approved by the automated end-to-end workflow.");

    await teacherPage
      .getByRole("button", {
        name: "Save teacher decision",
        exact: true,
      })
      .click();

    await expect(
      teacherPage.getByText("Review saved", {
        exact: true,
      }),
    ).toBeVisible();

    const publicPage = await publicContext.newPage();

    await publicPage.goto(
      `/verify/${encodeURIComponent(result.certificate_id)}`,
    );

    await expect(
      publicPage.getByText("Certificate record verified", {
        exact: true,
      }),
    ).toBeVisible();

    await expect(
      publicPage
        .getByText(result.certificate_id, {
          exact: true,
        })
        .first(),
    ).toBeVisible();
  } finally {
    await Promise.allSettled([
      publicContext.close(),
      teacherContext.close(),
      studentContext.close(),
    ]);
  }
});
