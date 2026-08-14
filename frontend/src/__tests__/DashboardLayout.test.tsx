import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardLayout from "../components/layout/DashboardLayout";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  logout: vi.fn(),
  bodyScrollLock: vi.fn(),
  poll: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("../store/authStore", () => ({
  useAuthStore: () => ({
    user: {
      id: "student-1",
      first_name: "Grace",
      last_name: "Hopper",
      email: "grace@example.edu",
      role: "STUDENT",
    },
    logout: mocks.logout,
  }),
}));

vi.mock("../components/ui/NotificationBell", () => ({
  NotificationBell: () => <button type="button">Notifications</button>,
}));

vi.mock("../hooks/useNotificationPolling", () => ({
  useNotificationPolling: () => mocks.poll(),
}));

vi.mock("../hooks/useBodyScrollLock", () => ({
  useBodyScrollLock: (locked: boolean) => mocks.bodyScrollLock(locked),
}));

function renderLayout(path = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <DashboardLayout />
    </MemoryRouter>,
  );
}

describe("DashboardLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the student console identity, title, navigation, search, and primary action", () => {
    renderLayout("/sessions/157");

    expect(screen.getByRole("heading", { name: "Sessions" })).toBeVisible();
    expect(screen.getByText("Grace Hopper")).toBeVisible();
    expect(screen.getByText("grace@example.edu")).toBeVisible();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    const newSessionLinks = screen.getAllByRole("link", { name: "New Session" });
    expect(newSessionLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of newSessionLinks) {
      expect(link).toHaveAttribute("href", "/editor/new");
    }
    expect(screen.getByRole("link", { name: "Drafts" })).toHaveAttribute(
      "href",
      "/drafts",
    );
    expect(screen.getByRole("link", { name: "Certificates" })).toHaveAttribute(
      "href",
      "/certificates",
    );
    expect(
      screen.getByLabelText("Search drafts, sessions, and certificates"),
    ).toBeVisible();
    expect(mocks.poll).toHaveBeenCalled();
  });

  it("collapses and expands the desktop sidebar without losing destinations", () => {
    renderLayout();

    const toggle = screen.getByRole("button", { name: "Toggle sidebar" });
    fireEvent.click(toggle);

    expect(screen.getByTitle("Dashboard")).toHaveAttribute("href", "/dashboard");
    expect(screen.getByTitle("New Session")).toHaveAttribute("href", "/editor/new");

    fireEvent.click(toggle);
    expect(screen.getByRole("link", { name: "Join Course" })).toHaveAttribute(
      "href",
      "/join-course",
    );
  });

  it("opens and dismisses the student mobile navigation while locking body scroll", () => {
    renderLayout();

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));

    expect(
      screen.getByRole("dialog", { name: "Student navigation" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Close navigation" })).toBeVisible();
    expect(mocks.bodyScrollLock).toHaveBeenCalledWith(true);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Student navigation" }),
    ).not.toBeInTheDocument();
  });

  it("opens the account menu and signs out through the shared auth store", () => {
    renderLayout();

    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));

    const settingsLinks = screen.getAllByRole("link", { name: "Settings" });
    expect(settingsLinks.at(-1)).toHaveAttribute("href", "/dashboard/settings");
    fireEvent.click(screen.getAllByRole("button", { name: "Sign out" }).at(-1)!);

    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith("/login");
  });
});
