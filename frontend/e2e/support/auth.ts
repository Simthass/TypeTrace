import fs from "node:fs/promises";
import path from "node:path";

import { expect, type APIRequestContext, type Browser } from "@playwright/test";

import { BACKEND_URL, FRONTEND_URL, type AuthRole } from "./env";

interface LoginPayload {
  access_token: string;
  user: {
    id: string | number;
    first_name: string;
    last_name?: string | null;
    email: string;
    role: AuthRole;
    student_id?: string | null;
    university_name?: string | null;
    department?: string | null;
    is_verified?: boolean;
  };
}

export async function authenticateAndSaveState(options: {
  browser: Browser;
  request: APIRequestContext;
  email: string;
  password: string;
  expectedRole: AuthRole;
  storageStatePath: string;
}): Promise<void> {
  const response = await options.request.post(
    `${BACKEND_URL}/api/v1/auth/login`,
    {
      data: {
        email: options.email,
        password: options.password,
      },
    },
  );

  expect(
    response.ok(),
    `Login failed for the configured ${options.expectedRole.toLowerCase()} account: ` +
      `${response.status()} ${await response.text()}`,
  ).toBeTruthy();

  const payload = (await response.json()) as LoginPayload;

  expect(payload.access_token).toBeTruthy();
  expect(payload.user.role).toBe(options.expectedRole);
  expect(payload.user.is_verified ?? true).toBeTruthy();

  const absoluteStatePath = path.resolve(options.storageStatePath);
  await fs.mkdir(path.dirname(absoluteStatePath), { recursive: true });

  const context = await options.browser.newContext({
    baseURL: FRONTEND_URL,
  });
  const page = await context.newPage();

  await page.goto("/");
  await page.evaluate(
    ({ accessToken, user }) => {
      window.localStorage.setItem(
        "typetrace-auth",
        JSON.stringify({
          state: {
            user: {
              ...user,
              id: String(user.id),
              last_name: user.last_name ?? "",
              student_id: user.student_id ?? null,
              university_name: user.university_name ?? null,
              department: user.department ?? null,
              is_verified: Boolean(user.is_verified ?? false),
            },
            token: accessToken,
            isAuthenticated: true,
          },
          version: 0,
        }),
      );
    },
    {
      accessToken: payload.access_token,
      user: payload.user,
    },
  );

  await context.storageState({
    path: absoluteStatePath,
  });
  await context.close();
}
