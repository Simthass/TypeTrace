// src/store/authStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface AuthState {
  user: any | null;
  token: string | null;
  pendingEmail: string | null;
  setPendingEmail: (email: string) => void;
  login: (user: any, token: string) => void;
  logout: () => void;
}

// Wrapping the store in the persist middleware for enterprise-grade session retention
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      pendingEmail: null,

      setPendingEmail: (email) => set({ pendingEmail: email }),

      login: (user, token) => set({ user, token }),

      logout: () => set({ user: null, token: null, pendingEmail: null }),
    }),
    {
      name: "typetrace-auth-storage", // The key used in localStorage
      storage: createJSONStorage(() => localStorage),
      // We only want to persist the user and token.
      // We DONT want to persist pendingEmail across reloads.
      partialize: (state) => ({ user: state.user, token: state.token }),
    },
  ),
);
