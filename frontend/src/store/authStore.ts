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
  hasHydrated: boolean;

  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  setUser: (user: AuthUser | null) => void;
  setHydrated: (value: boolean) => void;

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
    last_name: user.last_name ?? "",
    student_id: user.student_id ?? null,
    university_name: user.university_name ?? null,
    department: user.department ?? null,
    is_verified: Boolean(user.is_verified ?? false),
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      hasHydrated: false,

      login: (user: AuthUser, token: string) => {
        const safeUser = normalizeUser(user);

        set({
          user: safeUser,
          token,
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
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

      setHydrated: (value: boolean) => {
        set({ hasHydrated: value });
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
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
