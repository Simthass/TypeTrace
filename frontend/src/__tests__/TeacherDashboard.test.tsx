import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TeacherDashboard from "../pages/teacher/TeacherDashboard";
import { API_ROUTES } from "../constants/apiRoutes";
import { api, getApiErrorMessage } from "../lib/api";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../components/ui/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../store/authStore", () => ({
  useAuthStore: () => ({ user: { first_name: "Ada" } }),
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

vi.mock("recharts", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Chart = ({ children }: { children?: ReactNode }) => <svg>{children}</svg>;
  return {
    ResponsiveContainer: Container,
    AreaChart: Chart,
    BarChart: Chart,
    PieChart: Chart,
    Area: () => null,
    Bar: () => null,
    CartesianGrid: () => null,
    Cell: () => null,
    Pie: () => null,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
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

const dashboard = {
  status: "ok",
  teacher: {
    id: "teacher-1",
    first_name: "Backend",
    last_name: "Teacher",
    email: "teacher@example.edu",
  },
  summary: {
    total_courses: 1,
    total_students: 12,
    total_submissions: 8,
    pending_reviews: 2,
    approved_reviews: 5,
    flagged_reviews: 1,
    human_submissions: 5,
    suspicious_submissions: 2,
    synthetic_submissions: 1,
    avg_confidence: 84,
    avg_wpm: 43,
  },
  recent_submissions: [submission],
  courses: [course],
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <TeacherDashboard />
    </MemoryRouter>,
  );
}

describe("TeacherDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiErrorMessage).mockReturnValue("Teacher dashboard unavailable.");
  });

  it("loads the teacher workspace, summary metrics, navigation, and recent review row", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: dashboard } as never);

    renderDashboard();

    expect(
      await screen.findByRole("heading", { name: "Review workspace" }),
    ).toBeVisible();
    expect(screen.getByText(/Welcome, Ada\./)).toBeVisible();
    expect(screen.getByText("Active courses")).toBeVisible();
    expect(screen.getByText("Enrolled students")).toBeVisible();
    expect(screen.getByText("Pending review")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open review queue" })).toHaveAttribute(
      "href",
      "/teacher/submissions",
    );
    expect(screen.getByRole("link", { name: "New Course" })).toHaveAttribute(
      "href",
      "/teacher/courses",
    );
    expect(screen.getByText("Human Authorship Essay")).toBeVisible();
    expect(screen.getByText("Grace Hopper")).toBeVisible();
    expect(screen.getByRole("link", { name: /Human Authorship Essay/ })).toHaveAttribute(
      "href",
      "/teacher/review/157",
    );
    expect(api.get).toHaveBeenCalledWith(API_ROUTES.teacher.dashboard);
  });

  it("renders explicit empty operational states when a teacher has no courses or submissions", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ...dashboard,
        summary: {
          ...dashboard.summary,
          total_courses: 0,
          total_students: 0,
          total_submissions: 0,
          pending_reviews: 0,
          approved_reviews: 0,
          flagged_reviews: 0,
          human_submissions: 0,
          suspicious_submissions: 0,
          synthetic_submissions: 0,
          avg_confidence: 0,
          avg_wpm: 0,
        },
        recent_submissions: [],
        courses: [],
      },
    } as never);

    renderDashboard();

    expect(await screen.findByText("No submission intake yet")).toBeVisible();
    expect(screen.getByText("No classification data")).toBeVisible();
    expect(screen.getByText("No course workload")).toBeVisible();
    expect(screen.getByText("No courses yet")).toBeVisible();
    expect(screen.getByText("No submissions yet")).toBeVisible();
  });

  it("surfaces dashboard retrieval failures through the page state and toast contract", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("network down"));

    renderDashboard();

    expect(await screen.findByText("Could not load dashboard")).toBeVisible();
    expect(screen.getByText("Teacher dashboard unavailable.")).toBeVisible();
    expect(showToast).toHaveBeenCalledWith({
      type: "error",
      title: "Dashboard failed to load",
      message: "Teacher dashboard unavailable.",
    });
  });

  it("keeps review navigation available for a populated submission queue", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: dashboard } as never);

    renderDashboard();

    const viewAll = await screen.findByRole("link", { name: "View all" });
    expect(viewAll).toHaveAttribute("href", "/teacher/submissions");
    expect(screen.getAllByText("SEC401").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Review").length).toBeGreaterThanOrEqual(1);
  });
});
