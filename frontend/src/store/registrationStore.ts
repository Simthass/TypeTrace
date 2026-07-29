import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { UserRole } from "./authStore";

export interface RegistrationSession {
  registrationId: string;
  email: string;
  role: UserRole;
  expiresAt: number;
}

interface RegistrationState {
  session: RegistrationSession | null;
  setSession: (session: RegistrationSession) => void;
  updateExpiry: (expiresAt: number) => void;
  clearSession: () => void;
  isValid: () => boolean;
}

export const useRegistrationStore = create<RegistrationState>()(
  persist(
    (set, get) => ({
      session: null,
      setSession: (session) => set({ session }),
      updateExpiry: (expiresAt) =>
        set((state) => ({
          session: state.session ? { ...state.session, expiresAt } : null,
        })),
      clearSession: () => set({ session: null }),
      isValid: () => {
        const session = get().session;
        return Boolean(session && session.expiresAt > Date.now());
      },
    }),
    {
      name: "typetrace-registration",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ session: state.session }),
    },
  ),
);
