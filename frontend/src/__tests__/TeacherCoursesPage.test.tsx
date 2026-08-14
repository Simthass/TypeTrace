import type { HTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TeacherCoursesPage from "../pages/teacher/TeacherCoursesPage";
import { API_ROUTES } from "../constants/apiRoutes";
import { api, getApiErrorMessage } from "../lib/api";

const { showToast, writeText } = vi.hoisted(() => ({
  showToast: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock("../components/ui/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      get: vi.fn(),
      post: vi.fn(),
    },
    getApiErrorMessage: vi.fn(),
  };
});

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className, style }: HTMLAttributes<HTMLDivElement>) => (
      <div className={className} style={style}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const course = {
  id: 5,
  course_name: "Secure Systems",
  course_code: "SEC401",
  invite_code: "TT-SEC401",
  created_at: "2026-08-01T08:30:00Z",
  student_count: 12,
  submission_count: 8,
  pending_count: 2,
  approved_count: 5,
  flagged_count: 1,
  avg_confidence: 84,
  avg_wpm: 43,
};

function renderCourses(path = "/teacher/courses") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TeacherCoursesPage />
    </MemoryRouter>,
  );
}

describe("TeacherCoursesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiErrorMessage).mockReturnValue("Courses service unavailable.");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("loads an empty course workspace and opens the creation dialog", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { status: "ok", courses: [] } } as never);

    renderCourses();

    expect(await screen.findByRole("heading", { name: "Courses" })).toBeVisible();
    // The page intentionally schedules its initial fetch with setTimeout(0).
    // Wait for the resolved empty state rather than assuming the timer has
    // completed merely because the static page heading is already mounted.
    expect(await screen.findByText("No courses created yet")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Create your first course" }));

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Create New Course" })).toBeVisible();
    expect(screen.getByLabelText("Course Name")).toBeVisible();
    expect(screen.getByLabelText("Course Code")).toBeVisible();
    expect(api.get).toHaveBeenCalledWith(API_ROUTES.teacher.courses);
  });

  it("creates a normalized course, reports success, and refreshes the course grid", async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { status: "ok", courses: [] } } as never)
      .mockResolvedValueOnce({ data: { status: "ok", courses: [course] } } as never);
    vi.mocked(api.post).mockResolvedValue({ data: { status: "ok" } } as never);

    renderCourses();

    fireEvent.click(await screen.findByRole("button", { name: "Create your first course" }));
    fireEvent.change(screen.getByLabelText("Course Name"), {
      target: { value: "  Secure Systems  " },
    });
    fireEvent.change(screen.getByLabelText("Course Code"), {
      target: { value: "sec401" },
    });
    expect(screen.getByLabelText("Course Code")).toHaveValue("SEC401");

    fireEvent.click(screen.getByRole("button", { name: "Create Course" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(API_ROUTES.teacher.courses, {
        course_name: "Secure Systems",
        course_code: "SEC401",
      });
    });
    expect(showToast).toHaveBeenCalledWith({
      type: "success",
      title: "Course Created",
      message: "Your new course is ready for students.",
    });
    expect(await screen.findByText("Secure Systems")).toBeVisible();
  });

  it("renders course metrics, copies the invite code, and links to the course workspace", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { status: "ok", courses: [course] },
    } as never);

    renderCourses();

    expect(await screen.findByText("Secure Systems")).toBeVisible();
    expect(screen.getByText("SEC401")).toBeVisible();
    expect(screen.getByText("Pending Review")).toBeVisible();

    fireEvent.click(screen.getByTitle("Copy invite code"));
    expect(writeText).toHaveBeenCalledWith("TT-SEC401");
    expect(screen.getByText("Invite code copied")).toBeVisible();
    expect(screen.getByRole("link", { name: /View/ })).toHaveAttribute(
      "href",
      "/teacher/courses/5",
    );
  });

  it("recovers from a course-list API failure through the explicit retry action", async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ data: { status: "ok", courses: [course] } } as never);

    renderCourses();

    expect(await screen.findByText("Failed to load courses")).toBeVisible();
    expect(screen.getByText("Courses service unavailable.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));

    expect(await screen.findByText("Secure Systems")).toBeVisible();
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});
