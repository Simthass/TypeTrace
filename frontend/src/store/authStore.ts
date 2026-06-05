// frontend/src/store/authStore.ts

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "STUDENT" | "TEACHER";

export interface AuthUser {
  id: string;
  first_name: string;
  last_name?: string | null;
  email: string;
  role: UserRole;
  student_id?: string | null;
  university_name?: string | null;
  department?: string | null;
  is_verified?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  pendingEmail: string | null;

  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  setPendingEmail: (email: string | null) => void;
  setUser: (user: AuthUser | null) => void;

  isStudent: () => boolean;
  isTeacher: () => boolean;
}

function normalizeRole(role: unknown): UserRole {
  return role === "TEACHER" ? "TEACHER" : "STUDENT";
}

function normalizeUser(user: AuthUser): AuthUser {
  return {
    ...user,
    id: String(user.id),
    role: normalizeRole(user.role),
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      pendingEmail: null,

      login: (user: AuthUser, token: string) => {
        const safeUser = normalizeUser(user);

        set({
          user: safeUser,
          token,
          isAuthenticated: true,
          pendingEmail: null,
        });
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

      setUser: (user: AuthUser | null) => {
        if (!user) {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          });
          return;
        }

        set({
          user: normalizeUser(user),
          isAuthenticated: Boolean(get().token),
        });
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
