import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardLayout from "../components/layout/DashboardLayout";
import TeacherLayout from "../components/layout/TeacherLayout";

const mocks = vi.hoisted(() => ({
  role: "STUDENT" as "STUDENT" | "TEACHER",
  navigate: vi.fn(),
  logout: vi.fn(),
  bodyScrollLock: vi.fn(),
  poll: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock("../store/authStore", () => ({
  useAuthStore: () => ({
    user:
      mocks.role === "STUDENT"
        ? {
            id: "student-1",
            first_name: "Grace",
            last_name: "Hopper",
            email: "grace@example.edu",
            role: "STUDENT",
          }
        : {
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

vi.mock("../hooks/useBodyScrollLock", () => ({
  useBodyScrollLock: (locked: boolean) => mocks.bodyScrollLock(locked),
}));

function renderStudent(path: string) {
  mocks.role = "STUDENT";
  return render(
    <MemoryRouter initialEntries={[path]}>
      <DashboardLayout />
    </MemoryRouter>,
  );
}

function renderTeacher(path: string) {
  mocks.role = "TEACHER";
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TeacherLayout />
    </MemoryRouter>,
  );
}

describe("layout route and dismissal closure coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps all remaining student console routes to their contextual page titles", () => {
    const cases: Array<[string, string]> = [
      ["/editor/new", "Writing Session"],
      ["/drafts", "Drafts"],
      ["/certificates", "Certificates"],
      ["/analytics", "Analytics"],
      ["/join-course", "Join Course"],
      ["/dashboard/settings", "Settings"],
      ["/verify", "Verify Certificate"],
      ["/student/unknown", "Student Console"],
    ];

    for (const [path, title] of cases) {
      const view = renderStudent(path);
      expect(screen.getByRole("heading", { name: title })).toBeVisible();
      view.unmount();
    }
  });

  it("closes student mobile navigation from the backdrop and account menu from its overlay", () => {
    renderStudent("/dashboard");

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("dialog", { name: "Student navigation" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("dialog", { name: "Student navigation" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getAllByRole("link", { name: "Settings" }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("button", { name: "Close menu" })).not.toBeInTheDocument();
  });

  it("maps all teacher workspace routes including fallback console title", () => {
    const cases: Array<[string, string]> = [
      ["/teacher/dashboard", "Teacher Dashboard"],
      ["/teacher/courses", "Courses"],
      ["/teacher/courses/5", "Courses"],
      ["/teacher/submissions", "Submissions"],
      ["/teacher/students", "Students"],
      ["/teacher/review/157", "Review Session"],
      ["/teacher/settings", "Settings"],
      ["/teacher/unknown", "Teacher Console"],
    ];

    for (const [path, title] of cases) {
      const view = renderTeacher(path);
      expect(screen.getByRole("heading", { name: title })).toBeVisible();
      view.unmount();
    }
  });

  it("closes teacher account and mobile navigation overlays without signing out", () => {
    renderTeacher("/teacher/dashboard");

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("dialog", { name: "Teacher navigation" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(screen.queryByRole("dialog", { name: "Teacher navigation" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("menu", { name: "Teacher account" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close account menu" }));
    expect(screen.queryByRole("menu", { name: "Teacher account" })).not.toBeInTheDocument();
    expect(mocks.logout).not.toHaveBeenCalled();
  });
});
