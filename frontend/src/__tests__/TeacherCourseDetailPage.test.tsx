import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TeacherCourseDetailPage from "../pages/teacher/TeacherCourseDetailPage";
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

const submission = {
  id: 157,
  title: "Human Authorship Essay",
  student_name: "Grace Hopper",
  student_email: "grace@example.edu",
  student_id: "STU-157",
  course_id: 5,
  course_name: "Secure Systems",
  course_code: "SEC401",
  classification: "HUMAN",
  classification_bucket: "HUMAN",
  confidence: 94,
  risk_level: "LOW",
  review_status: "PENDING",
  review_notes: "",
  review_saved_at: null,
  wpm: 46,
  duration_seconds: 185,
  total_keystrokes: 612,
  deletions: 21,
  pauses: 14,
  avg_iki: 178,
  word_count: 86,
  certificate_id: "TT-CERT-157",
  document_hash: "a".repeat(64),
  created_at: "2026-08-13T08:30:00Z",
};

const student = {
  id: "student-1",
  student_name: "Grace Hopper",
  email: "grace@example.edu",
  student_id: "STU-157",
  joined_at: "2026-08-01T09:00:00Z",
  submission_count: 3,
  avg_confidence: 91,
  avg_wpm: 46,
  last_submission_at: "2026-08-13T08:30:00Z",
};

const courseDetail = {
  status: "ok",
  course,
  students: [student],
  submissions: [submission],
};

function renderCourse() {
  return render(
    <MemoryRouter initialEntries={["/teacher/courses/5"]}>
      <Routes>
        <Route
          path="/teacher/courses/:courseId"
          element={<TeacherCourseDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TeacherCourseDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiErrorMessage).mockReturnValue("Course service unavailable.");
  });

  it("loads the teacher-owned course, operational metrics, and next-review navigation", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: courseDetail } as never);

    renderCourse();

    expect(
      await screen.findByRole("heading", { name: "Secure Systems" }),
    ).toBeVisible();
    expect(screen.getAllByText("SEC401").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Students").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Submissions").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Pending").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Avg confidence")).toBeVisible();
    expect(screen.getByRole("link", { name: /Review next/ })).toHaveAttribute(
      "href",
      "/teacher/review/157",
    );
    expect(screen.getByRole("link", { name: /Back to courses/ })).toHaveAttribute(
      "href",
      "/teacher/courses",
    );
    expect(api.get).toHaveBeenCalledWith(API_ROUTES.teacher.courseDetail("5"));
  });

  it("exposes review, replay, and public verification actions for a submitted evidence record", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: courseDetail } as never);

    renderCourse();

    expect(await screen.findByText("Course submissions")).toBeVisible();
    expect(screen.getByText("Human Authorship Essay")).toBeVisible();
    expect(screen.getAllByText("Grace Hopper").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute(
      "href",
      "/teacher/review/157",
    );
    expect(screen.getByRole("link", { name: "Replay" })).toHaveAttribute(
      "href",
      "/session/157/replay",
    );
    expect(screen.getByRole("link", { name: "Verify" })).toHaveAttribute(
      "href",
      "/verify/TT-CERT-157",
    );
  });

  it("switches from submission review to the enrolled-student roster", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: courseDetail } as never);

    renderCourse();

    const studentsTab = await screen.findByRole("tab", { name: "Students" });
    fireEvent.click(studentsTab);

    expect(screen.getByText("Enrolled students")).toBeVisible();
    expect(screen.getAllByText("Grace Hopper").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("grace@example.edu")).toBeVisible();
    expect(screen.getByText("STU-157")).toBeVisible();
    expect(studentsTab).toHaveAttribute("aria-selected", "true");
  });

  it("surfaces course retrieval failures through the error state and teacher toast contract", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("network down"));

    renderCourse();

    expect(await screen.findByText("Could not load course")).toBeVisible();
    expect(screen.getByText("Course service unavailable.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to courses" })).toHaveAttribute(
      "href",
      "/teacher/courses",
    );
    expect(showToast).toHaveBeenCalledWith({
      type: "error",
      title: "Failed to load course",
      message: "Course service unavailable.",
    });
  });
});
