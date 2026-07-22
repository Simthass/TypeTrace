import {
  useCallback,
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
import { ToastContext, type ToastContextValue } from "./ToastContext";

interface ToastItem extends ToastPayload {
  id: string;
}

const MAX_TOASTS = 4;
const DEFAULT_DURATION = 4500;
const ERROR_DURATION = 6500;

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
      symbol: "✓",
    };
  }

  if (type === "error") {
    return {
      border: brand.aiAccent,
      bg: brand.aiBg,
      iconBg: brand.aiAccent,
      title: brand.aiText,
      text: brand.aiText,
      symbol: "!",
    };
  }

  if (type === "warning") {
    return {
      border: brand.suspiciousAccent,
      bg: brand.suspiciousBg,
      iconBg: brand.suspiciousAccent,
      title: brand.suspiciousText,
      text: brand.suspiciousText,
      symbol: "!",
    };
  }

  return {
    border: colors.surface[200],
    bg: colors.brandSoft,
    iconBg: colors.brand,
    title: colors.text.primary,
    text: colors.text.secondary,
    symbol: "i",
  };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: ToastPayload) => {
      const id = toast.id || createToastId();

      setToasts((current) => {
        const withoutDuplicate = current.filter(
          (item) =>
            !(
              item.title === toast.title &&
              item.message === toast.message &&
              item.type === toast.type
            ),
        );

        return [{ ...toast, id }, ...withoutDuplicate].slice(0, MAX_TOASTS);
      });

      const duration =
        toast.duration ??
        (toast.type === "error" ? ERROR_DURATION : DEFAULT_DURATION);

      if (duration > 0) {
        window.setTimeout(() => dismissToast(id), duration);
      }
    },
    [dismissToast],
  );

  useEffect(() => {
    return subscribeToast((toast) => {
      showToast(toast);
    });
  }, [showToast]);

  const contextValue = useMemo<ToastContextValue>(
    () => ({
      showToast,
      dismissToast,
      success: (title, message) => {
        notify({ type: "success", title, message });
      },
      error: (title, message) => {
        notify({ type: "error", title, message });
      },
      warning: (title, message) => {
        notify({ type: "warning", title, message });
      },
      info: (title, message) => {
        notify({ type: "info", title, message });
      },
    }),
    [dismissToast, showToast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      <div
        className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-[min(420px,calc(100vw-32px))] flex-col gap-3"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const style = getToastStyle(toast.type);

          return (
            <div
              key={toast.id}
              className="pointer-events-auto rounded-md border p-4"
              style={{
                borderColor: style.border,
                background: style.bg,
                boxShadow: `0 24px 70px ${colors.shadow}`,
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[13px] font-black"
                  style={{
                    background: style.iconBg,
                    color: colors.text.light,
                  }}
                >
                  {style.symbol}
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
