// src/lib/api.ts
import axios from "axios";
import { useAuthStore } from "../store/authStore";

const API_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1/auth`
  : "http://localhost:8000/api/v1/auth";

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
    // 1. Check if the error is a 401
    const isUnauthorized = error.response && error.response.status === 401;

    // 2. Check if the request was made to an auth endpoint where 401 is normal
    const requestUrl = error.config?.url || "";
    const isAuthEndpoint =
      requestUrl.includes("/login") || requestUrl.includes("/verify-otp");

    // 3. ONLY trigger the global logout if it's a 401 on a protected route
    if (isUnauthorized && !isAuthEndpoint) {
      console.warn("Token expired or invalid. Auto-logging out.");
      useAuthStore.getState().logout();
      window.location.href = "/login";
    }

    return Promise.reject(error);
  },
);
