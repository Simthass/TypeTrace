// frontend/src/components/guards/AuthSessionGate.tsx

import { useEffect, useState, type ReactNode } from "react";

import { API_ROUTES } from "../../constants/apiRoutes";
import { api } from "../../lib/api";
import { colors } from "../../styles/colors";
import { useAuthStore, type AuthUser } from "../../store/authStore";
import { toast } from "../../lib/toast";

interface VerifyTokenResponse {
  valid: boolean;
  user: AuthUser;
}

export default function AuthSessionGate({ children }: { children: ReactNode }) {
  const { token, user, hasHydrated, isAuthenticated, login, logout } =
    useAuthStore();

  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!hasHydrated) return;

    let cancelled = false;

    async function verifyPersistedSession() {
      if (!token) {
        if (!cancelled) setIsChecking(false);
        return;
      }

      try {
        const response = await api.get<VerifyTokenResponse>(
          API_ROUTES.auth.verifyToken,
          {
            skipGlobalToast: true,
            skipAuthRedirect: true,
          },
        );

        if (cancelled) return;

        if (response.data.valid && response.data.user) {
          login(response.data.user, token);
        } else {
          logout();
        }
      } catch {
        if (!cancelled) {
          logout();

          toast.info(
            "Session check failed",
            "Please sign in again to continue securely.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    }

    void verifyPersistedSession();

    return () => {
      cancelled = true;
    };
  }, [hasHydrated, token, login, logout]);

  if (!hasHydrated || isChecking) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ background: colors.surface[50] }}
      >
        <div
          className="w-full max-w-sm rounded-md border px-5 py-4 text-center"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[100],
            color: colors.text.secondary,
          }}
        >
          <img
            src="/Logo.png"
            alt="TypeTrace"
            className="mx-auto h-10 w-auto object-contain"
            draggable={false}
          />
          <p className="mt-4 text-[13px] font-semibold">
            Preparing secure workspace.
          </p>
        </div>
      </div>
    );
  }

  if (isAuthenticated && !user) {
    logout();
    return null;
  }

  return <>{children}</>;
}
