import axios, { AxiosError, type AxiosRequestConfig } from "axios";

import { useAuthStore } from "../store/authStore";
import { toast } from "./toast";

const DEFAULT_API_BASE_URL = "http://localhost:8000/api/v1";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;

type ApiErrorBody = {
  detail?: unknown;
  message?: unknown;
  error?:
    | unknown
    | {
        code?: string;
        message?: string;
        status_code?: number;
        details?: unknown;
      };
};

type RetryableConfig = AxiosRequestConfig & {
  _retry?: boolean;
  skipAuthRedirect?: boolean;
  skipGlobalToast?: boolean;
};

function isAuthRoute(url?: string): boolean {
  const clean = String(url || "");

  return (
    clean.includes("/auth/login") ||
    clean.includes("/auth/register") ||
    clean.includes("/auth/verify-otp") ||
    clean.includes("/auth/resend-otp") ||
    clean.includes("/auth/password-reset")
  );
}

function isPublicRoute(url?: string): boolean {
  const clean = String(url || "");

  return (
    clean.startsWith("/verify/") ||
    clean.includes("/health") ||
    clean.includes("/model/status") ||
    clean.includes("/model/metrics") ||
    clean.includes("/model/features")
  );
}

function formatValidationDetail(detail: unknown): string | null {
  if (!Array.isArray(detail)) return null;

  const messages = detail
    .map((item) => {
      if (typeof item === "string") return item;

      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const path = Array.isArray(record.loc)
          ? record.loc.filter(Boolean).join(".")
          : "";

        const message = String(
          record.msg || record.message || "Validation error",
        );

        return path ? `${path}: ${message}` : message;
      }

      return "Validation error";
    })
    .filter(Boolean);

  return messages.length ? messages.join(", ") : null;
}

function readErrorString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (typeof record.message === "string") return record.message;
    if (typeof record.error === "string") return record.error;
    if (typeof record.detail === "string") return record.detail;
  }

  return null;
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status;
    const config = (error.config || {}) as RetryableConfig;
    const url = String(config.url || "");
    const requestHadAuth = Boolean(config.headers?.Authorization);
    const shouldSkipToast = Boolean(config.skipGlobalToast);
    const shouldSkipAuthRedirect = Boolean(config.skipAuthRedirect);

    if (
      status === 401 &&
      requestHadAuth &&
      !isAuthRoute(url) &&
      !isPublicRoute(url) &&
      !shouldSkipAuthRedirect
    ) {
      const current = useAuthStore.getState();

      if (current.isAuthenticated || current.token) {
        current.logout();

        toast.warning(
          "Session expired",
          "Please sign in again to continue using TypeTrace.",
        );
      }
    }

    if (!shouldSkipToast && !status && error.code === "ECONNABORTED") {
      toast.error(
        "Request timed out",
        "The server took too long to respond. Please try again.",
      );
    }

    if (!shouldSkipToast && !status && error.message === "Network Error") {
      toast.error(
        "Cannot reach server",
        "Check that the backend is running on the configured API URL.",
      );
    }

    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error: unknown): string {
  if (!axios.isAxiosError<ApiErrorBody>(error)) {
    return "Something went wrong. Please try again.";
  }

  const status = error.response?.status;
  const data = error.response?.data;

  if (
    data?.error &&
    typeof data.error === "object" &&
    "message" in data.error &&
    typeof data.error.message === "string"
  ) {
    return data.error.message;
  }

  if (error.code === "ECONNABORTED") {
    return "The request timed out. Please try again.";
  }

  if (error.message === "Network Error") {
    return "Cannot connect to the server. Make sure the backend is running.";
  }

  const validationMessage = formatValidationDetail(data?.detail);
  if (validationMessage) return validationMessage;

  const detailMessage = readErrorString(data?.detail);
  if (detailMessage) return detailMessage;

  const message = readErrorString(data?.message);
  if (message) return message;

  const bodyError = readErrorString(data?.error);
  if (bodyError) return bodyError;

  if (status === 400) return "The request is invalid. Please check the input.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403)
    return "You do not have permission to perform this action.";
  if (status === 404) return "The requested record was not found.";
  if (status === 409) return "This action conflicts with an existing record.";
  if (status === 422) return "Some fields are invalid. Please check the form.";
  if (status === 429) return "Too many requests. Please wait and try again.";
  if (status && status >= 500) {
    return "The server had a problem processing this request.";
  }

  return error.message || "Something went wrong. Please try again.";
}

export function getApiStatusCode(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null;
  return error.response?.status ?? null;
}

export function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.message === "Network Error";
}

export function isTimeoutError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.code === "ECONNABORTED";
}
