// frontend/src/lib/api.ts

import axios, { AxiosError } from "axios";

import { useAuthStore } from "../store/authStore";
import { toast } from "./toast";

const DEFAULT_API_BASE_URL = "http://localhost:8000/api/v1";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;

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
  (error: AxiosError<{ detail?: unknown; message?: string }>) => {
    const status = error.response?.status;
    const requestHadAuth = Boolean(error.config?.headers?.Authorization);
    const requestUrl = String(error.config?.url || "");

    const isAuthEndpoint =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register") ||
      requestUrl.includes("/auth/verify-otp") ||
      requestUrl.includes("/auth/resend-otp") ||
      requestUrl.includes("/auth/password-reset");

    if (status === 401 && requestHadAuth && !isAuthEndpoint) {
      useAuthStore.getState().logout();

      toast.warning(
        "Session expired",
        "Please sign in again to continue using TypeTrace.",
      );
    }

    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;

    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === "string") return item;

          if (item && typeof item === "object") {
            const record = item as Record<string, unknown>;
            return String(record.msg || record.message || "Validation error");
          }

          return "Validation error";
        })
        .join(", ");
    }

    if (typeof detail === "string") {
      return detail;
    }

    if (detail && typeof detail === "object") {
      const record = detail as Record<string, unknown>;
      return String(record.message || record.error || "Request failed.");
    }

    const message = error.response?.data?.message;

    if (typeof message === "string") {
      return message;
    }

    if (error.message) {
      return error.message;
    }
  }

  return "Something went wrong. Please try again.";
}
