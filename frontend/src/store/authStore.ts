import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "STUDENT" | "TEACHER";

export interface AuthUser {
  id: string;
  first_name: string;
  last_name?: string;
  email: string;
  role: UserRole;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  pendingEmail: string | null;

  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  setPendingEmail: (email: string | null) => void;

  isStudent: () => boolean;
  isTeacher: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      pendingEmail: null,

      login: (user: AuthUser, token: string) => {
        // Ensure role always has a valid value
        const safeUser: AuthUser = {
          ...user,
          role: user.role ?? "STUDENT",
        };
        set({ user: safeUser, token, isAuthenticated: true });
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          pendingEmail: null,
        });
      },

      setPendingEmail: (email: string | null) => {
        set({ pendingEmail: email });
      },

      isStudent: () => get().user?.role === "STUDENT",
      isTeacher: () => get().user?.role === "TEACHER",
    }),
    {
      name: "typetrace-auth",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        pendingEmail: state.pendingEmail,
      }),
    },
  ),
);
