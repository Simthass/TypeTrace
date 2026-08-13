import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNotificationPolling } from "../hooks/useNotificationPolling";
import { useAuthStore } from "../store/authStore";
import { useNotificationStore } from "../store/notificationStore";

const info = vi.fn();

vi.mock("../components/ui/ToastContext", () => ({
  useToast: () => ({
    info,
  }),
}));

const student = {
  id: "student-1",
  first_name: "Student",
  last_name: "Example",
  email: "student@example.test",
  role: "STUDENT" as const,
  is_verified: true,
};

describe("useNotificationPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    info.mockReset();
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      hasHydrated: true,
    });
    useNotificationStore.getState().reset();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("does not poll when there is no authenticated user", async () => {
    const fetchUnreadCount = vi.fn(async () => 0);
    useNotificationStore.setState({ fetchUnreadCount });

    renderHook(() => useNotificationPolling(1000));

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchUnreadCount).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it("polls immediately and notifies only when the unread count increases", async () => {
    const returnedCounts = [3, 3];
    const fetchUnreadCount = vi.fn<() => Promise<number>>(async () => {
      const nextCount = returnedCounts.shift() ?? 3;
      useNotificationStore.setState({ unreadCount: nextCount });
      return nextCount;
    });

    useAuthStore.setState({
      user: student,
      token: "token",
      isAuthenticated: true,
    });
    useNotificationStore.setState({
      unreadCount: 1,
      fetchUnreadCount,
    });

    renderHook(() => useNotificationPolling(1000));

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchUnreadCount).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      "New update",
      "You have new activity in your workspace.",
    );

    info.mockClear();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(fetchUnreadCount).toHaveBeenCalledTimes(2);
    expect(info).not.toHaveBeenCalled();
  });

  it("skips network work while hidden and checks again when the tab becomes visible", async () => {
    const fetchUnreadCount = vi.fn(async () => 0);
    useAuthStore.setState({
      user: student,
      token: "token",
      isAuthenticated: true,
    });
    useNotificationStore.setState({
      unreadCount: 0,
      fetchUnreadCount,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    renderHook(() => useNotificationPolling(1000));

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchUnreadCount).not.toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });

    expect(fetchUnreadCount).toHaveBeenCalledTimes(1);
  });

  it("cleans up scheduled polling after unmount", async () => {
    const fetchUnreadCount = vi.fn(async () => 0);
    useAuthStore.setState({
      user: student,
      token: "token",
      isAuthenticated: true,
    });
    useNotificationStore.setState({
      unreadCount: 0,
      fetchUnreadCount,
    });

    const { unmount } = renderHook(() => useNotificationPolling(1000));

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchUnreadCount).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(fetchUnreadCount).toHaveBeenCalledTimes(1);
  });
});
