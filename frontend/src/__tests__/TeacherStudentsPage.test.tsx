import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TeacherStudentsPage from "../pages/teacher/TeacherStudentsPage";
import { API_ROUTES } from "../constants/apiRoutes";
import { api, getApiErrorMessage } from "../lib/api";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

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
    },
    getApiErrorMessage: vi.fn(),
  };
});

const students = [
  {
    id: "student-1",
    student_name: "Grace Hopper",
    email: "grace@example.edu",
    student_id: "STU-001",
    university_name: "Example University",
    course_id: 5,
    course_name: "Secure Systems",
    course_code: "SEC401",
    joined_at: "2026-07-01T08:30:00Z",
    submission_count: 4,
    avg_confidence: 92,
    avg_wpm: 47,
    pending_count: 0,
    flagged_count: 0,
    last_submission_at: "2026-08-13T08:30:00Z",
  },
  {
    id: "student-2",
    student_name: "Alan Turing",
    email: "alan@example.edu",
    student_id: "STU-002",
    university_name: "Example University",
    course_id: 7,
    course_name: "Applied AI",
    course_code: "AI402",
    joined_at: "2026-07-02T08:30:00Z",
    submission_count: 2,
    avg_confidence: 58,
    avg_wpm: 36,
    pending_count: 1,
    flagged_count: 1,
    last_submission_at: "2026-08-12T08:30:00Z",
  },
];

function renderStudents() {
  return render(
    <MemoryRouter>
      <TeacherStudentsPage />
    </MemoryRouter>,
  );
}

describe("TeacherStudentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiErrorMessage).mockReturnValue("Student roster unavailable.");
  });

  it("loads roster metrics, student-course records, and management navigation", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { status: "ok", students },
    } as never);

    renderStudents();

    expect(await screen.findByRole("heading", { name: "Students" })).toBeVisible();
    expect(screen.getByText("Grace Hopper")).toBeVisible();
    expect(screen.getByText("Alan Turing")).toBeVisible();
    expect(screen.getAllByText("SEC401").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("AI402").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Needs review", { selector: "p" })).toBeVisible();
    expect(screen.getByText(/1 pending · 1 flagged/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Manage courses" })).toHaveAttribute(
      "href",
      "/teacher/courses",
    );
    expect(screen.getByRole("link", { name: "Open submission queue" })).toHaveAttribute(
      "href",
      "/teacher/submissions",
    );
    expect(api.get).toHaveBeenCalledWith(API_ROUTES.teacher.students);
  });

  it("filters by search, course, and status, then restores the complete roster", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { status: "ok", students },
    } as never);

    renderStudents();

    const search = await screen.findByPlaceholderText("Search student, email, ID...");
    fireEvent.change(search, { target: { value: "Grace" } });
    expect(screen.getByText(/Showing 1 of 2 student-course enrollments/)).toBeVisible();
    expect(screen.queryByText("Alan Turing")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    fireEvent.change(screen.getByLabelText("Filter students by course"), {
      target: { value: "7" },
    });
    fireEvent.change(screen.getByLabelText("Filter students by status"), {
      target: { value: "FLAGGED" },
    });
    expect(screen.getByText("Alan Turing")).toBeVisible();
    expect(screen.queryByText("Grace Hopper")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("Grace Hopper")).toBeVisible();
    expect(screen.getByText("Alan Turing")).toBeVisible();
  });

  it("renders the explicit empty-roster state when no students have enrolled", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { status: "ok", students: [] },
    } as never);

    renderStudents();

    expect(await screen.findByText("No students found")).toBeVisible();
    expect(
      screen.getByText(/Share course invite codes so students can join/),
    ).toBeVisible();
  });

  it("surfaces roster API failures through the page state and toast contract", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("network down"));

    renderStudents();

    expect(await screen.findByText("Could not load students")).toBeVisible();
    expect(screen.getByText("Student roster unavailable.")).toBeVisible();
    expect(showToast).toHaveBeenCalledWith({
      type: "error",
      title: "Students failed to load",
      message: "Student roster unavailable.",
    });
  });
});
