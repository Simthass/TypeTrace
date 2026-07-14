import { create } from "zustand";

import { API_ROUTES } from "../constants/apiRoutes";
import { api } from "../lib/api";

export interface NotificationItem {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  title: string;
  body: string;
  action_url: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationState {
  items: NotificationItem[];
  unreadCount: number;
  isOpen: boolean;
  isLoading: boolean;
  hasFetchedOnce: boolean;
  setIsOpen: (isOpen: boolean) => void;
  togglePanel: () => void;
  fetchUnreadCount: () => Promise<number>;
  fetchList: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  unreadCount: 0,
  isOpen: false,
  isLoading: false,
  hasFetchedOnce: false,

  setIsOpen: (isOpen) => set({ isOpen }),

  togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),

  fetchUnreadCount: async () => {
    try {
      // Justification: Extending AxiosRequestConfig locally for custom interceptor flags.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await api.get(API_ROUTES.notifications.unreadCount, {
        skipGlobalToast: true,
        skipAuthRedirect: true,
      } as any);

      const count = res.data.unread_count ?? 0;
      set({ unreadCount: count });
      return count;
    } catch {
      return get().unreadCount;
    }
  },

  fetchList: async () => {
    set({ isLoading: true });
    try {
      // Justification: Extending AxiosRequestConfig locally for custom interceptor flags.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await api.get(API_ROUTES.notifications.list, {
        skipGlobalToast: true,
        skipAuthRedirect: true,
      } as any);

      set({ items: res.data.notifications || [], hasFetchedOnce: true });
    } finally {
      set({ isLoading: false });
    }
  },

  markRead: async (id) => {
    try {
      // Optimistic update
      set((state) => ({
        items: state.items.map((n) =>
          n.id === id ? { ...n, is_read: true } : n,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));

      // Justification: Extending AxiosRequestConfig locally for custom interceptor flags.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await api.patch(API_ROUTES.notifications.markRead(id), {}, {
        skipGlobalToast: true,
      } as any);
    } catch {
      // Revert optimism if failed
      get().fetchUnreadCount();
      get().fetchList();
    }
  },

  markAllRead: async () => {
    try {
      set((state) => ({
        items: state.items.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }));

      // Justification: Extending AxiosRequestConfig locally for custom interceptor flags.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await api.post(API_ROUTES.notifications.markAllRead, {}, {
        skipGlobalToast: true,
      } as any);
    } catch {
      get().fetchUnreadCount();
      get().fetchList();
    }
  },

  reset: () =>
    set({
      items: [],
      unreadCount: 0,
      isOpen: false,
      hasFetchedOnce: false,
      isLoading: false,
    }),
}));
