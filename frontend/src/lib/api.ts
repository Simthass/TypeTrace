// src/lib/api.ts
import axios from "axios";
import { useAuthStore } from "../store/authStore";

// bro i removed the /auth from the end of these urls so it acts as a true global base
const API_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Attach the JWT token automatically
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor: Handle expired tokens globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isUnauthorized = error.response && error.response.status === 401;

    const requestUrl = error.config?.url || "";
    // updated this to match the new auth paths we are about to fix
    const isAuthEndpoint =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/verify-otp") ||
      requestUrl.includes("/auth/password-reset");

    if (isUnauthorized && !isAuthEndpoint) {
      console.warn("Token expired bro. Auto-logging out.");
      useAuthStore.getState().logout();
      window.location.href = "/login";
    }

    return Promise.reject(error);
  },
);
