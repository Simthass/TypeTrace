import type { ReactNode, RefObject } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TeacherLayout from "../components/layout/TeacherLayout";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  logout: vi.fn(),
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
      id: "teacher-1",
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.edu",
      role: "TEACHER",
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

vi.mock("../components/ui/ResponsiveDialog", () => ({
  ResponsiveDialog: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title: string;
    children: ReactNode;
    returnFocusRef?: RefObject<HTMLElement | null>;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

function renderLayout(path = "/teacher/dashboard") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TeacherLayout />
    </MemoryRouter>,
  );
}

describe("TeacherLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders teacher identity, route title, navigation, search, and course creation action", () => {
    renderLayout("/teacher/review/157");

    expect(screen.getByRole("heading", { name: "Review Session" })).toBeVisible();
    expect(screen.getByText("Ada Lovelace")).toBeVisible();
    expect(screen.getByText("ada@example.edu")).toBeVisible();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "href",
      "/teacher/dashboard",
    );
    expect(screen.getByRole("link", { name: "Submissions" })).toHaveAttribute(
      "href",
      "/teacher/submissions",
    );
    expect(screen.getByRole("link", { name: "Courses" })).toHaveAttribute(
      "href",
      "/teacher/courses",
    );
    expect(screen.getByLabelText("Search teacher workspace")).toBeVisible();
    expect(screen.getByRole("link", { name: "Create course" })).toHaveAttribute(
      "href",
      "/teacher/courses?createCourse=1",
    );
    expect(mocks.poll).toHaveBeenCalled();
  });

  it("collapses and expands the teacher sidebar while preserving route destinations", () => {
    renderLayout();

    const collapse = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(collapse);

    const expand = screen.getByRole("button", { name: "Expand sidebar" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTitle("Overview")).toHaveAttribute(
      "href",
      "/teacher/dashboard",
    );

    fireEvent.click(expand);
    expect(screen.getByRole("link", { name: "Students" })).toHaveAttribute(
      "href",
      "/teacher/students",
    );
  });

  it("opens and closes the mobile teacher navigation", () => {
    renderLayout();

    const open = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(open);

    expect(
      screen.getByRole("dialog", { name: "Teacher navigation" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Close navigation" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(
      screen.queryByRole("dialog", { name: "Teacher navigation" }),
    ).not.toBeInTheDocument();
  });

  it("supports account settings and explicit sign out", () => {
    renderLayout();

    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));

    expect(screen.getByRole("menu", { name: "Teacher account" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: /Settings/ })).toHaveAttribute(
      "href",
      "/teacher/settings",
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith("/login");
  });
});
