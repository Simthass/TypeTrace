// frontend/src/lib/api.ts

import axios, { AxiosError } from "axios";
import { useAuthStore } from "../store/authStore";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
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
  (error: AxiosError<{ detail?: string }>) => {
    const status = error.response?.status;

    if (status === 401) {
      useAuthStore.getState().logout();
    }

    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;

    if (Array.isArray(detail)) {
      return detail
        .map((item) => item?.msg || item?.message || "Validation error")
        .join(", ");
    }

    if (typeof detail === "string") {
      return detail;
    }

    if (error.message) {
      return error.message;
    }
  }

  return "Something went wrong. Please try again.";
}
