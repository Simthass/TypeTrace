// frontend/src/components/ui/ToastProvider.tsx

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { colors, brand } from "../../styles/colors";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, "id">) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function getToastStyle(type: ToastType) {
  if (type === "success") {
    return {
      border: brand.humanAccent,
      bg: brand.humanBg,
      title: brand.humanText,
      text: brand.humanText,
    };
  }

  if (type === "error") {
    return {
      border: brand.aiAccent,
      bg: brand.aiBg,
      title: brand.aiText,
      text: brand.aiText,
    };
  }

  if (type === "warning") {
    return {
      border: brand.suspiciousAccent,
      bg: brand.suspiciousBg,
      title: brand.suspiciousText,
      text: brand.suspiciousText,
    };
  }

  return {
    border: colors.surface[200],
    bg: "#FFFFFF",
    title: colors.text.primary,
    text: colors.text.secondary,
  };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((items) => items.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;

      const item: ToastItem = {
        id,
        ...toast,
      };

      setToasts((items) => [item, ...items].slice(0, 4));

      window.setTimeout(() => {
        dismissToast(id);
      }, 4200);
    },
    [dismissToast],
  );

  const value = useMemo(
    () => ({
      showToast,
      dismissToast,
    }),
    [showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3">
        {toasts.map((toast) => {
          const style = getToastStyle(toast.type);

          return (
            <div
              key={toast.id}
              className="rounded-md border p-4 shadow-saas"
              style={{
                background: style.bg,
                borderColor: style.border,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p
                    className="text-[13px] font-semibold"
                    style={{ color: style.title }}
                  >
                    {toast.title}
                  </p>

                  {toast.message && (
                    <p
                      className="mt-1 text-[12px] leading-5"
                      style={{ color: style.text }}
                    >
                      {toast.message}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="rounded-md p-1 text-[12px]"
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
