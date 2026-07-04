// frontend/src/lib/toast.ts

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastPayload {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  id?: string;
}

type ToastListener = (toast: ToastPayload) => void;

const listeners = new Set<ToastListener>();

export function subscribeToast(listener: ToastListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function notify(toast: ToastPayload) {
  listeners.forEach((listener) => listener(toast));
}

export const toast = {
  success(title: string, message?: string, duration?: number) {
    notify({ type: "success", title, message, duration });
  },

  error(title: string, message?: string, duration?: number) {
    notify({ type: "error", title, message, duration });
  },

  warning(title: string, message?: string, duration?: number) {
    notify({ type: "warning", title, message, duration });
  },

  info(title: string, message?: string, duration?: number) {
    notify({ type: "info", title, message, duration });
  },
};
