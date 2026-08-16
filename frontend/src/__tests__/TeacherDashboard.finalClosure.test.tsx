import { cloneElement, type ReactElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TeacherDashboard from "../pages/teacher/TeacherDashboard";
import { api, getApiErrorMessage } from "../lib/api";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../components/ui/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../store/authStore", () => ({
  useAuthStore: () => ({ user: { first_name: "Ada" } }),
}));

vi.mock("../lib/api", async () => {
  const actual =
    await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    api: { ...actual.api, get: vi.fn() },
    getApiErrorMessage: vi.fn(),
  };
});

vi.mock("recharts", () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const Chart = ({ children }: { children?: ReactNode }) => (
    <svg>{children}</svg>
  );
  const Tooltip = ({
    content,
  }: {
    content?: ReactElement<Record<string, unknown>>;
  }) =>
    content
      ? cloneElement(content, {
          active: true,
          label: "Aug 16",
          payload: [{ name: "Submissions", value: 3, color: "currentColor" }],
        })
      : null;
  return {
    ResponsiveContainer: Container,
    AreaChart: Chart,
    BarChart: Chart,
    PieChart: Chart,
    Area: () => null,
    Bar: () => null,
    CartesianGrid: () => null,
    Cell: () => null,
    Pie: ({ children }: { children?: ReactNode }) => <g>{children}</g>,
    Tooltip,
    XAxis: () => null,
    YAxis: () => null,
  };
});

function renderDashboard() {
  return render(
    <MemoryRouter>
      <TeacherDashboard />
    </MemoryRouter>,
  );
}

function course(id: number, submissions: number, pending: number) {
  return {
    id,
    course_name: id === 6 ? "" : `Course ${id}`,
    course_code: id === 6 ? "" : `C${id}`,
    invite_code: `INV-${id}`,
    created_at: "2026-08-01T08:00:00Z",
    student_count: id + 2,
    submission_count: submissions,
    pending_count: pending,
    approved_count: Math.max(0, submissions - pending),
    flagged_count: 0,
    avg_confidence: 70,
    avg_wpm: 35,
  };
}

function submission(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Evidence ${id}`,
    student_name: `Student ${id}`,
    student_email: `student${id}@example.edu`,
    student_id: `STU-${id}`,
    course_id: 1,
    course_name: "Course 1",
    course_code: "C1",
    classification: "HUMAN",
    classification_bucket: "HUMAN",
    confidence: 80,
    risk_level: "LOW",
    review_status: "PENDING",
    review_notes: "",
    wpm: 40,
    duration_seconds: 180,
    total_keystrokes: 300,
    deletions: 10,
    pauses: 5,
    avg_iki: 180,
    word_count: 70,
    certificate_id: null,
    document_hash: "a".repeat(64),
    created_at: "2026-08-16T08:00:00Z",
    ...overrides,
  };
}

describe("TeacherDashboard final closure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiErrorMessage).mockReturnValue("Controlled teacher error.");
  });

  it("supports the legacy flattened summary contract and diverse review classifications", async () => {
    const courses = [
      course(1, 2, 0),
      course(2, 9, 5),
      course(3, 4, 1),
      course(4, 12, 2),
      course(5, 7, 7),
      course(6, 1, 0),
    ];
    const recent = [
      submission(1, {
        title: "Synthetic review",
        classification: "AI-GENERATED",
        classification_bucket: "AI-GENERATED",
        review_status: "FLAGGED",
        confidence: 12,
      }),
      submission(2, {
        title: "Suspicious review",
        classification: "SUSPICIOUS",
        classification_bucket: "SUSPICIOUS",
        review_status: "PENDING",
        created_at: "not-a-date",
        course_code: "",
        student_name: "",
        student_id: "",
      }),
      submission(3, {
        title: "Unknown review",
        classification: "UNKNOWN_BUCKET",
        classification_bucket: "UNKNOWN_BUCKET",
        review_status: "APPROVED",
      }),
    ];

    vi.mocked(api.get).mockResolvedValue({
      data: {
        status: "ok",
        teacher: { first_name: "Backend" },
        total_courses: 6,
        total_students: 28,
        total_submissions: 35,
        pending_review: 15,
        approved_count: 18,
        flagged_count: 2,
        avg_confidence: 71,
        recent_submissions: recent,
        courses,
      },
    } as never);

    renderDashboard();

    expect(await screen.findByText("Synthetic review")).toBeVisible();
    expect(screen.getByText("High Risk")).toBeVisible();
    expect(screen.getByText("Flagged")).toBeVisible();
    expect(screen.getByText("Suspicious review")).toBeVisible();
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    expect(screen.getByText("Unknown review")).toBeVisible();
    expect(screen.getByText("UNKNOWN BUCKET")).toBeVisible();
    expect(screen.getByText(/not-a-date/)).toBeVisible();
    expect(screen.getAllByText("Submissions").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Aug 16")[0]).toBeVisible();
    expect(screen.getAllByText("Course 5").length).toBeGreaterThan(0);
  });

  it("renders the explicit unavailable state when the API returns no dashboard payload", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: null } as never);

    renderDashboard();

    expect(await screen.findByText("Dashboard unavailable")).toBeVisible();
    expect(
      screen.getByText(
        "Could not load your teacher workspace. Try refreshing.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Reload" })).toBeVisible();
  });
});
