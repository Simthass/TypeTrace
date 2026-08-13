import type { HTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationBell } from "../components/ui/NotificationBell";
import { api } from "../lib/api";
import { useNotificationStore } from "../store/notificationStore";

vi.mock("../lib/api", () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, className, style }: HTMLAttributes<HTMLDivElement>) => (
      <div className={className} style={style}>
        {children}
      </div>
    ),
  },
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

const notifications = [
  {
    id: "n1",
    event_type: "SESSION_SUBMITTED",
    entity_type: "session",
    entity_id: "1",
    title: "Session submitted",
    body: "A session is ready for review.",
    action_url: "/sessions/1",
    is_read: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "n2",
    event_type: "REVIEW_COMPLETED",
    entity_type: "session",
    entity_id: "2",
    title: "Review completed",
    body: "",
    action_url: "/sessions/2",
    is_read: true,
    created_at: new Date(Date.now() - 90 * 60_000).toISOString(),
  },
  {
    id: "n3",
    event_type: "COURSE_JOINED",
    entity_type: "course",
    entity_id: "3",
    title: "Course joined",
    body: "Enrollment confirmed.",
    action_url: "/join-course",
    is_read: true,
    created_at: new Date(Date.now() - 26 * 60 * 60_000).toISOString(),
  },
  {
    id: "n4",
    event_type: "CERTIFICATE_REVOKED",
    entity_type: "certificate",
    entity_id: "4",
    title: "Certificate revoked",
    body: "A certificate was revoked.",
    action_url: "/verify/TT-QUALITY-001",
    is_read: true,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString(),
  },
  {
    id: "n5",
    event_type: "OTHER",
    entity_type: "generic",
    entity_id: "5",
    title: "General update",
    body: "Workspace activity.",
    action_url: "",
    is_read: true,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60_000).toISOString(),
  },
];

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNotificationStore.getState().reset();
    vi.mocked(api.get).mockResolvedValue({
      data: { notifications: [] },
    } as never);
    vi.mocked(api.patch).mockResolvedValue({ data: {} } as never);
    vi.mocked(api.post).mockResolvedValue({ data: {} } as never);
  });

  it("opens the panel and renders the empty state", async () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
    expect(screen.getByText("No new notifications right now.")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it("renders notification types and marks all unread items as read", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { notifications },
    } as never);

    useNotificationStore.setState({
      items: notifications,
      unreadCount: 1,
      isOpen: true,
      hasFetchedOnce: true,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );

    expect(screen.getByText("Notifications (1)")).toBeInTheDocument();
    for (const item of notifications) {
      expect(screen.getByText(item.title)).toBeInTheDocument();
    }

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(1);
      expect(useNotificationStore.getState().isLoading).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(1);
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });
  });

  it("marks an item read, closes the panel, and follows its action URL", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { notifications: [notifications[0]] },
    } as never);

    useNotificationStore.setState({
      items: [notifications[0]],
      unreadCount: 1,
      isOpen: true,
      hasFetchedOnce: true,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <NotificationBell />
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(1);
      expect(useNotificationStore.getState().isLoading).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: /Session submitted/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("location")).toHaveTextContent("/sessions/1");
      expect(useNotificationStore.getState().isOpen).toBe(false);
    });
  });

  it("closes an open panel when clicking outside", () => {
    useNotificationStore.setState({
      isOpen: true,
      hasFetchedOnce: true,
    });

    render(
      <MemoryRouter>
        <div data-testid="outside">Outside</div>
        <NotificationBell />
      </MemoryRouter>,
    );

    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId("outside"));

    expect(useNotificationStore.getState().isOpen).toBe(false);
  });
});
