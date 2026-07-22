import { useEffect, useRef } from "react";

import { useToast } from "../components/ui/ToastContext";
import { useAuthStore } from "../store/authStore";
import { useNotificationStore } from "../store/notificationStore";

export function useNotificationPolling(intervalMs = 15000) {
  const fetchUnreadCount = useNotificationStore(
    (state) => state.fetchUnreadCount,
  );
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const { isAuthenticated, user } = useAuthStore();
  const { info } = useToast();

  const prevCountRef = useRef(unreadCount);

  useEffect(() => {
    prevCountRef.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    let isRunning = true;
    let timeoutId: number;

    const checkCount = async () => {
      if (document.visibilityState === "visible") {
        const currentCount = prevCountRef.current;
        const newCount = await fetchUnreadCount();

        if (isRunning && newCount > currentCount) {
          info("New update", "You have new activity in your workspace.");
        }
      }

      if (isRunning) {
        timeoutId = window.setTimeout(checkCount, intervalMs);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(timeoutId);
        checkCount();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    checkCount();

    return () => {
      isRunning = false;
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, user, intervalMs, fetchUnreadCount, info]);
}
