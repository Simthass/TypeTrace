import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  api,
  getApiErrorCode,
  getApiErrorDetails,
  getApiErrorMessage,
  getApiStatusCode,
  isNetworkError,
  isTimeoutError,
} from "../lib/api";
import { toast } from "../lib/toast";
import { useAuthStore, type AuthUser } from "../store/authStore";

const student: AuthUser = {
  id: "student-coverage",
  first_name: "Coverage",
  email: "student@example.com",
  role: "STUDENT",
  is_verified: true,
};

function axiosLikeError({
  status,
  data,
  message = "Request failed",
  code,
}: {
  status?: number;
  data?: unknown;
  message?: string;
  code?: string;
}) {
  return {
    isAxiosError: true,
    message,
    code,
    response:
      status === undefined
        ? undefined
        : {
            status,
            data,
            headers: {},
            statusText: String(status),
            config: {},
          },
    toJSON: () => ({}),
  };
}

describe("API error contracts and interceptors", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      hasHydrated: true,
    });
  });

  it("extracts structured validation messages, codes, details, and statuses", () => {
    const error = axiosLikeError({
      status: 422,
      data: {
        error: {
          code: "VALIDATION_FAILED",
          details: [
            { loc: ["body", "email"], msg: "Invalid email" },
            "Second validation failure",
          ],
        },
      },
    });

    expect(getApiErrorMessage(error)).toBe(
      "body.email: Invalid email, Second validation failure",
    );
    expect(getApiErrorCode(error)).toBe("VALIDATION_FAILED");
    expect(getApiErrorDetails(error)).toEqual(
      expect.arrayContaining([expect.objectContaining({ msg: "Invalid email" })]),
    );
    expect(getApiStatusCode(error)).toBe(422);
  });

  it("uses safe fallbacks for common HTTP, timeout, network, and unknown failures", () => {
    expect(getApiErrorMessage(new Error("plain"))).toBe(
      "Something went wrong. Please try again.",
    );
    expect(getApiErrorMessage(axiosLikeError({ status: 403 }))).toContain(
      "permission",
    );
    expect(getApiErrorMessage(axiosLikeError({ status: 429 }))).toContain(
      "Too many requests",
    );
    expect(getApiErrorMessage(axiosLikeError({ status: 503 }))).toContain(
      "server had a problem",
    );

    const timeout = axiosLikeError({ code: "ECONNABORTED" });
    const network = axiosLikeError({ message: "Network Error" });
    expect(isTimeoutError(timeout)).toBe(true);
    expect(isNetworkError(network)).toBe(true);
    expect(getApiErrorMessage(timeout)).toContain("timed out");
    expect(getApiErrorMessage(network)).toContain("Cannot connect");
    expect(getApiStatusCode(new Error("plain"))).toBeNull();
    expect(getApiErrorCode(new Error("plain"))).toBeNull();
    expect(getApiErrorDetails(new Error("plain"))).toBeNull();
  });

  it("adds the bearer token to authenticated requests", async () => {
    useAuthStore.getState().login(student, "coverage-token");

    let authorization: unknown;
    await api.get("/coverage-adapter", {
      adapter: async (config) => {
        authorization = config.headers?.Authorization;
        return {
          data: { ok: true },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      },
    });

    expect(authorization).toBe("Bearer coverage-token");
  });

  it("logs out only for an authenticated protected 401", async () => {
    useAuthStore.getState().login(student, "coverage-token");
    const warning = vi.spyOn(toast, "warning");

    await expect(
      api.get("/student/private", {
        adapter: async (config) => {
          throw {
            ...axiosLikeError({ status: 401, data: {} }),
            config,
          };
        },
      }),
    ).rejects.toBeTruthy();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(warning).toHaveBeenCalledWith(
      "Session expired",
      expect.stringContaining("sign in again"),
    );
  });

  it("does not destroy a session for public/auth 401 responses or explicit opt-out", async () => {
    const warning = vi.spyOn(toast, "warning");

    for (const url of ["/auth/login", "/verify/TT-COVERAGE"]) {
      useAuthStore.getState().login(student, "coverage-token");
      await expect(
        api.get(url, {
          adapter: async (config) =>
            Promise.reject({
              ...axiosLikeError({ status: 401, data: {} }),
              config,
            }),
        }),
      ).rejects.toBeTruthy();
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    }

    await expect(
      api.get("/student/private", {
        skipAuthRedirect: true,
        adapter: async (config) =>
          Promise.reject({
            ...axiosLikeError({ status: 401, data: {} }),
            config,
          }),
      }),
    ).rejects.toBeTruthy();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(warning).not.toHaveBeenCalled();
  });

  it("surfaces timeout and network failures unless global toasts are disabled", async () => {
    const errorToast = vi.spyOn(toast, "error");

    for (const [message, code] of [
      ["Request timed out", "ECONNABORTED"],
      ["Network Error", undefined],
    ] as const) {
      await expect(
        api.get("/coverage-network", {
          adapter: async (config) =>
            Promise.reject({
              ...axiosLikeError({ message, code }),
              config,
            }),
        }),
      ).rejects.toBeTruthy();
    }

    expect(errorToast).toHaveBeenCalledTimes(2);

    await expect(
      api.get("/coverage-network", {
        skipGlobalToast: true,
        adapter: async (config) =>
          Promise.reject({
            ...axiosLikeError({ message: "Network Error" }),
            config,
          }),
      }),
    ).rejects.toBeTruthy();

    expect(errorToast).toHaveBeenCalledTimes(2);
    expect(axios.isAxiosError(axiosLikeError({ status: 400 }))).toBe(true);
  });
});
