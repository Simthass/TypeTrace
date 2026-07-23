import { test } from "@playwright/test";

import { authenticateAndSaveState } from "./support/auth";
import {
  STUDENT_AUTH_STATE,
  TEACHER_AUTH_STATE,
  requiredEnv,
} from "./support/env";

test.describe.configure({ mode: "serial" });

test("prepare student and teacher browser authentication", async ({
  browser,
  request,
}) => {
  await authenticateAndSaveState({
    browser,
    request,
    email: requiredEnv("E2E_STUDENT_EMAIL"),
    password: requiredEnv("E2E_STUDENT_PASSWORD"),
    expectedRole: "STUDENT",
    storageStatePath: STUDENT_AUTH_STATE,
  });

  await authenticateAndSaveState({
    browser,
    request,
    email: requiredEnv("E2E_TEACHER_EMAIL"),
    password: requiredEnv("E2E_TEACHER_PASSWORD"),
    expectedRole: "TEACHER",
    storageStatePath: TEACHER_AUTH_STATE,
  });
});
