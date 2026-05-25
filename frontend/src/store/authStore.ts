// src/store/authStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

// =============================================================================
// TYPES
// =============================================================================

export type UserRole = "STUDENT" | "TEACHER";

export interface AuthUser {
  id: string;
  first_name: string;
  email: string;
  role: UserRole;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;

  // Actions
  login: (user: AuthUser, token: string) => void;
  logout: () => void;

  // Helpers — use these instead of reading user.role directly everywhere
  isStudent: () => boolean;
  isTeacher: () => boolean;
}

// =============================================================================
// STORE
// Persisted to localStorage so the user stays logged in on page refresh.
// =============================================================================

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user: AuthUser, token: string) => {
        set({ user, token, isAuthenticated: true });
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },

      // Convenience helpers — prevents scattered `user?.role === "TEACHER"` checks
      isStudent: () => get().user?.role === "STUDENT",
      isTeacher: () => get().user?.role === "TEACHER",
    }),
    {
      name: "typetrace-auth",
      // Only persist what we actually need. Never persist sensitive data beyond the token.
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
