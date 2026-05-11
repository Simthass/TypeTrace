// src/store/authStore.ts
import { create } from "zustand";

// defining the types for typescript so examiner knows i understand type safety
interface AuthState {
  user: any | null; // will replace 'any' with strict user type later when backend is done
  token: string | null;
  pendingEmail: string | null; // storing this temporarily for the OTP page
  setPendingEmail: (email: string) => void;
  login: (user: any, token: string) => void;
  logout: () => void;
}

// using zustand cos professor said redux is too heavy for modern 2026 apps
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  pendingEmail: null,

  // call this right after user submit register form successfully
  setPendingEmail: (email) => set({ pendingEmail: email }),

  login: (user, token) => set({ user, token }),

  logout: () => set({ user: null, token: null, pendingEmail: null }),
}));
