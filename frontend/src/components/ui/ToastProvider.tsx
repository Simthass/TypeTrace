// frontend/src/components/ui/ToastProvider.tsx

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  notify,
  subscribeToast,
  type ToastPayload,
  type ToastType,
} from "../../lib/toast";
import { brand, colors } from "../../styles/colors";

interface ToastItem extends ToastPayload {
  id: string;
}

interface ToastContextValue {
  showToast: (toast: ToastPayload) => void;
  dismissToast: (id: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function createToastId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getToastStyle(type: ToastType) {
  if (type === "success") {
    return {
      border: brand.humanAccent,
      bg: brand.humanBg,
      iconBg: brand.humanAccent,
      title: brand.humanText,
      text: brand.humanText,
    };
  }

  if (type === "error") {
    return {
      border: brand.aiAccent,
      bg: brand.aiBg,
      iconBg: brand.aiAccent,
      title: brand.aiText,
      text: brand.aiText,
    };
  }

  if (type === "warning") {
    return {
      border: brand.suspiciousAccent,
      bg: brand.suspiciousBg,
      iconBg: brand.suspiciousAccent,
      title: brand.suspiciousText,
      text: brand.suspiciousText,
    };
  }

  return {
    border: colors.surface[200],
    bg: colors.surface[50],
    iconBg: colors.brand,
    title: colors.text.primary,
    text: colors.text.secondary,
  };
}

function ToastIcon({ type }: { type: ToastType }) {
  if (type === "success") {
    return (
      <svg
        viewBox="0 0 24 24"
        width="15"
        height="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      >
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  if (type === "error") {
    return (
      <svg
        viewBox="0 0 24 24"
        width="15"
        height="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    );
  }

  if (type === "warning") {
    return (
      <svg
        viewBox="0 0 24 24"
        width="15"
        height="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      >
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
    >
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((items) => items.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: ToastPayload) => {
      const id = createToastId();
      const duration = toast.duration ?? 4200;

      const item: ToastItem = {
        id,
        ...toast,
      };

      setToasts((items) => [item, ...items].slice(0, 4));

      window.setTimeout(() => {
        dismissToast(id);
      }, duration);
    },
    [dismissToast],
  );

  useEffect(() => {
    return subscribeToast(showToast);
  }, [showToast]);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      dismissToast,
      success: (title, message) => notify({ type: "success", title, message }),
      error: (title, message) => notify({ type: "error", title, message }),
      warning: (title, message) => notify({ type: "warning", title, message }),
      info: (title, message) => notify({ type: "info", title, message }),
    }),
    [showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-[390px] flex-col gap-3"
      >
        {toasts.map((toast) => {
          const style = getToastStyle(toast.type);

          return (
            <div
              key={toast.id}
              className="overflow-hidden rounded-md border bg-white p-4 transition"
              style={{
                background: style.bg,
                borderColor: style.border,
                boxShadow: `0 18px 60px -36px ${colors.shadowStrong}`,
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                  style={{
                    background: style.iconBg,
                    color: colors.text.light,
                  }}
                >
                  <ToastIcon type={toast.type} />
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className="text-[13px] font-bold leading-5"
                    style={{ color: style.title }}
                  >
                    {toast.title}
                  </p>

                  {toast.message && (
                    <p
                      className="mt-1 text-[12.5px] leading-5"
                      style={{ color: style.text }}
                    >
                      {toast.message}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[16px] font-semibold transition hover:opacity-70"
                  style={{ color: style.text }}
                  aria-label="Dismiss notification"
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider.");
  }

  return context;
}
