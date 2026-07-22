import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import { useNotificationStore } from "../../store/notificationStore";
import { colors } from "../../styles/colors";
import { Skeleton } from "./Skeleton";

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getIconForEventType(eventType: string) {
  switch (eventType) {
    case "SESSION_SUBMITTED":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M12 18v-6" />
          <path d="M9 15h6" />
        </svg>
      );
    case "REVIEW_COMPLETED":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case "COURSE_JOINED":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8v6" />
          <path d="M22 11h-6" />
        </svg>
      );
    case "CERTIFICATE_REVOKED":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    default:
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
  }
}

export function NotificationBell() {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    items,
    unreadCount,
    isOpen,
    isLoading,
    hasFetchedOnce,
    setIsOpen,
    togglePanel,
    fetchList,
    markRead,
    markAllRead,
  } = useNotificationStore();

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [setIsOpen]);

  useEffect(() => {
    if (isOpen && (!hasFetchedOnce || unreadCount > 0)) {
      fetchList();
    }
  }, [isOpen, hasFetchedOnce, unreadCount, fetchList]);

  const handleNotificationClick = (id: string, actionUrl: string) => {
    markRead(id);
    setIsOpen(false);
    if (actionUrl) {
      navigate(actionUrl);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={togglePanel}
        className="relative flex h-9 w-9 items-center justify-center rounded-md border transition-colors hover:bg-surface-100"
        style={{
          backgroundColor: isOpen ? colors.surface[150] : colors.surface[50],
          borderColor: colors.surface[200],
          color: colors.text.secondary,
        }}
        aria-label="Notifications"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute right-2 top-2 h-1.5 w-1.5 rounded-md"
            style={{ backgroundColor: colors.red }}
          />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-11 z-50 flex w-[340px] flex-col rounded-xl border bg-white shadow-lg overflow-hidden"
            style={{
              borderColor: colors.surface[200],
              boxShadow: `0 24px 70px ${colors.shadowStrong}`,
              maxHeight: "85vh",
            }}
          >
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{
                borderColor: colors.surface[200],
                backgroundColor: colors.surface[50],
              }}
            >
              <span
                className="text-[13px] font-bold"
                style={{ color: colors.text.primary }}
              >
                Notifications {unreadCount > 0 && `(${unreadCount})`}
              </span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    markAllRead();
                  }}
                  className="text-[11px] font-semibold transition hover:opacity-70"
                  style={{ color: colors.brand }}
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div
              className="flex-1 overflow-y-auto"
              style={{ backgroundColor: colors.surface[50] }}
            >
              {isLoading && !hasFetchedOnce ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-md"
                    style={{
                      background: colors.surface[100],
                      color: colors.text.secondary,
                    }}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                  </div>
                  <p
                    className="mt-3 text-[13px] font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    You're all caught up
                  </p>
                  <p
                    className="mt-1 text-[12px]"
                    style={{ color: colors.text.secondary }}
                  >
                    No new notifications right now.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        handleNotificationClick(item.id, item.action_url)
                      }
                      className="flex items-start gap-3 border-b p-3 text-left transition-colors hover:bg-surface-100"
                      style={{
                        borderColor: colors.surface[200],
                        backgroundColor: item.is_read
                          ? colors.surface[50]
                          : colors.brandSoft,
                      }}
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                        style={{
                          backgroundColor: item.is_read
                            ? colors.surface[100]
                            : colors.brand,
                          color: item.is_read
                            ? colors.text.secondary
                            : colors.text.light,
                        }}
                      >
                        {getIconForEventType(item.event_type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[13px] font-semibold leading-tight"
                          style={{ color: colors.text.primary }}
                        >
                          {item.title}
                        </p>
                        {item.body && (
                          <p
                            className="mt-1 text-[12px] leading-snug line-clamp-2"
                            style={{ color: colors.text.secondary }}
                          >
                            {item.body}
                          </p>
                        )}
                        <p
                          className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider"
                          style={{ color: colors.text.muted }}
                        >
                          {formatRelativeTime(item.created_at)}
                        </p>
                      </div>

                      {!item.is_read && (
                        <div
                          className="mt-1 h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: colors.brand }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
