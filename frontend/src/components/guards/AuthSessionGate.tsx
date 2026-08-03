import { useEffect, useState, type ReactNode } from "react";

import { API_ROUTES } from "../../constants/apiRoutes";
import {
  api,
  getApiErrorMessage,
  getApiStatusCode,
} from "../../lib/api";
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
  const [checkError, setCheckError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    if (!hasHydrated) return;

    let cancelled = false;

    async function verifyPersistedSession() {
      setIsChecking(true);
      setCheckError(null);

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
          return;
        }

        logout();
        toast.info(
          "Session ended",
          "The stored session is no longer valid. Please sign in again.",
        );
      } catch (error) {
        if (cancelled) return;

        const statusCode = getApiStatusCode(error);
        if (statusCode === 401 || statusCode === 403) {
          logout();
          toast.info(
            "Session ended",
            "The stored session is no longer valid. Please sign in again.",
          );
          return;
        }

        // Network, rate-limit, and server failures are availability problems,
        // not proof that the persisted token is invalid. Preserve credentials
        // and let the user retry without destroying the local session.
        setCheckError(getApiErrorMessage(error));
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    }

    void verifyPersistedSession();

    return () => {
      cancelled = true;
    };
  }, [hasHydrated, token, login, logout, retryVersion]);

  useEffect(() => {
    if (!hasHydrated || isChecking) return;
    if (isAuthenticated && !user) logout();
  }, [hasHydrated, isAuthenticated, isChecking, logout, user]);

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

  if (checkError && token) {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-4"
        style={{ background: colors.surface[50] }}
      >
        <div
          className="w-full max-w-md rounded-md border p-6 text-center"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[100],
          }}
        >
          <h1
            className="text-xl font-semibold"
            style={{ color: colors.text.primary }}
          >
            Session verification unavailable
          </h1>
          <p
            className="mt-3 text-sm leading-6"
            style={{ color: colors.text.secondary }}
          >
            {checkError} Your saved sign-in has not been removed.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => setRetryVersion((value) => value + 1)}
              className="rounded-md px-4 py-2.5 text-sm font-semibold text-white"
              style={{ background: colors.brand }}
            >
              Retry verification
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-md border px-4 py-2.5 text-sm font-semibold"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
                background: colors.surface[50],
              }}
            >
              Sign out locally
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (isAuthenticated && !user) return null;

  return <>{children}</>;
}
