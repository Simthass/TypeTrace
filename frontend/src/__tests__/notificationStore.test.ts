import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_ROUTES } from "../constants/apiRoutes";
import { api } from "../lib/api";
import {
  useNotificationStore,
  type NotificationItem,
} from "../store/notificationStore";

const unread: NotificationItem = {
  id: "n-1",
  event_type: "review.updated",
  entity_type: "session",
  entity_id: "11",
  title: "Review updated",
  body: "A review changed.",
  action_url: "/sessions/11",
  is_read: false,
  created_at: "2026-08-12T10:00:00Z",
};

function resetStore() {
  useNotificationStore.setState({
    items: [],
    unreadCount: 0,
    isOpen: false,
    isLoading: false,
    hasFetchedOnce: false,
  });
}

describe("notificationStore", () => {
  beforeEach(resetStore);

  it("toggles the panel and resets all local notification state", () => {
    useNotificationStore.getState().setIsOpen(true);
    expect(useNotificationStore.getState().isOpen).toBe(true);
    useNotificationStore.getState().togglePanel();
    expect(useNotificationStore.getState().isOpen).toBe(false);

    useNotificationStore.setState({
      items: [unread],
      unreadCount: 1,
      isOpen: true,
      isLoading: true,
      hasFetchedOnce: true,
    });
    useNotificationStore.getState().reset();
    expect(useNotificationStore.getState()).toMatchObject({
      items: [],
      unreadCount: 0,
      isOpen: false,
      isLoading: false,
      hasFetchedOnce: false,
    });
  });

  it("loads unread count and preserves the last known count on failure", async () => {
    const get = vi.spyOn(api, "get");
    get.mockResolvedValueOnce({ data: { unread_count: 4 } });

    await expect(
      useNotificationStore.getState().fetchUnreadCount(),
    ).resolves.toBe(4);
    expect(useNotificationStore.getState().unreadCount).toBe(4);
    expect(get).toHaveBeenCalledWith(
      API_ROUTES.notifications.unreadCount,
      expect.objectContaining({ skipGlobalToast: true, skipAuthRedirect: true }),
    );

    get.mockRejectedValueOnce(new Error("offline"));
    await expect(
      useNotificationStore.getState().fetchUnreadCount(),
    ).resolves.toBe(4);
  });

  it("loads the notification list and always clears the loading flag", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: { notifications: [unread] },
    });

    await useNotificationStore.getState().fetchList();
    expect(useNotificationStore.getState()).toMatchObject({
      items: [unread],
      hasFetchedOnce: true,
      isLoading: false,
    });
  });

  it("optimistically marks one or all notifications as read", async () => {
    useNotificationStore.setState({ items: [unread], unreadCount: 1 });
    const patch = vi.spyOn(api, "patch").mockResolvedValue({ data: {} });
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });

    await useNotificationStore.getState().markRead(unread.id);
    expect(useNotificationStore.getState().items[0].is_read).toBe(true);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(patch).toHaveBeenCalledWith(
      API_ROUTES.notifications.markRead(unread.id),
      {},
      { skipGlobalToast: true },
    );

    useNotificationStore.setState({
      items: [{ ...unread, is_read: false }, { ...unread, id: "n-2" }],
      unreadCount: 2,
    });
    await useNotificationStore.getState().markAllRead();
    expect(
      useNotificationStore.getState().items.every((item) => item.is_read),
    ).toBe(true);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
    expect(post).toHaveBeenCalledWith(
      API_ROUTES.notifications.markAllRead,
      {},
      { skipGlobalToast: true },
    );
  });

  it("refreshes authoritative state when an optimistic mutation fails", async () => {
    useNotificationStore.setState({ items: [unread], unreadCount: 1 });
    vi.spyOn(api, "patch").mockRejectedValueOnce(new Error("failure"));

    const fetchUnreadCount = vi.fn().mockResolvedValue(1);
    const fetchList = vi.fn().mockResolvedValue(undefined);
    useNotificationStore.setState({ fetchUnreadCount, fetchList });

    await useNotificationStore.getState().markRead(unread.id);
    expect(fetchUnreadCount).toHaveBeenCalledTimes(1);
    expect(fetchList).toHaveBeenCalledTimes(1);
  });
});
