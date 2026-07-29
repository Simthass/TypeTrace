import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface PasswordResetSession {
  resetId: string;
  email: string;
  expiresAt: number;
}

interface PasswordResetState {
  session: PasswordResetSession | null;
  setSession: (session: PasswordResetSession) => void;
  updateExpiry: (expiresAt: number) => void;
  clearSession: () => void;
  isValid: () => boolean;
}

export const usePasswordResetStore = create<PasswordResetState>()(
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
      name: "typetrace-password-reset",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ session: state.session }),
    },
  ),
);
