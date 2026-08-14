import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TeacherSubmissionsPage from "../pages/teacher/TeacherSubmissionsPage";
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

const courses = [
  {
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
  },
];

const submissions = [
  {
    id: 157,
    title: "Human Authorship Essay",
    student_name: "Grace Hopper",
    student_email: "grace@example.edu",
    student_id: "STU-001",
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
  },
  {
    id: 158,
    title: "High Risk Review",
    student_name: "Alan Turing",
    student_email: "alan@example.edu",
    student_id: "STU-002",
    course_id: 5,
    course_name: "Secure Systems",
    course_code: "SEC401",
    classification: "SYNTHETIC",
    classification_bucket: "SYNTHETIC",
    confidence: 71,
    risk_level: "HIGH",
    review_status: "FLAGGED",
    review_notes: "Escalated",
    wpm: 90,
    duration_seconds: 80,
    total_keystrokes: 110,
    deletions: 2,
    pauses: 1,
    avg_iki: 70,
    word_count: 120,
    certificate_id: null,
    document_hash: null,
    created_at: "2026-08-12T08:30:00Z",
  },
];

function installSuccessfulApi(sessionRows = submissions, total = sessionRows.length) {
  vi.mocked(api.get).mockImplementation((url) => {
    if (url === API_ROUTES.teacher.courses) {
      return Promise.resolve({ data: { status: "ok", courses } } as never);
    }
    if (url === API_ROUTES.teacher.sessions) {
      return Promise.resolve({
        data: { status: "ok", total, limit: 100, offset: 0, sessions: sessionRows },
      } as never);
    }
    return Promise.reject(new Error(`Unexpected GET ${String(url)}`));
  });
}

function renderSubmissions(path = "/teacher/submissions") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TeacherSubmissionsPage />
    </MemoryRouter>,
  );
}

describe("TeacherSubmissionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiErrorMessage).mockReturnValue("Submission queue unavailable.");
  });

  it("loads the review queue, prioritizes pending work, and exposes review/certificate actions", async () => {
    installSuccessfulApi();

    renderSubmissions();

    expect(await screen.findByRole("heading", { name: "Submissions" })).toBeVisible();
    expect(screen.getByText("Human Authorship Essay")).toBeVisible();
    expect(screen.getByText("High Risk Review")).toBeVisible();
    expect(screen.getByText("Queue results")).toBeVisible();
    expect(screen.getByText("Needs attention")).toBeVisible();
    expect(screen.getByRole("link", { name: "Review next" })).toHaveAttribute(
      "href",
      "/teacher/review/157",
    );
    expect(screen.getAllByRole("link", { name: "Review" })[0]).toHaveAttribute(
      "href",
      "/teacher/review/157",
    );
    expect(screen.getByRole("link", { name: "Verify certificate" })).toHaveAttribute(
      "href",
      "/verify/TT-CERT-157",
    );
  });

  it("initializes server-side queue filters from the URL query contract", async () => {
    installSuccessfulApi([submissions[1]], 1);

    renderSubmissions(
      "/teacher/submissions?course_id=5&review_status=FLAGGED&risk_level=HIGH&search=Alan",
    );

    expect(await screen.findByText("High Risk Review")).toBeVisible();

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(API_ROUTES.teacher.sessions, {
        params: {
          limit: "100",
          offset: "0",
          course_id: "5",
          review_status: "FLAGGED",
          risk_level: "HIGH",
          search: "Alan",
        },
      });
    });
    expect(screen.getByLabelText("Search submissions")).toHaveValue("Alan");
  });

  it("updates queue controls, clears them with Reset, and renders an empty result safely", async () => {
    installSuccessfulApi([], 0);

    renderSubmissions();

    expect(await screen.findByText("No submissions found")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Search submissions"), {
      target: { value: "missing" },
    });

    const review = await screen.findByLabelText("Review");
    fireEvent.change(review, { target: { value: "PENDING" } });

    const risk = await screen.findByLabelText("Risk");
    fireEvent.change(risk, { target: { value: "HIGH" } });

    const reset = await screen.findByRole("button", { name: "Reset" });
    fireEvent.click(reset);

    expect(await screen.findByLabelText("Search submissions")).toHaveValue("");
    expect(screen.getByLabelText("Review")).toHaveValue("ALL");
    expect(screen.getByLabelText("Risk")).toHaveValue("ALL");
  });

  it("surfaces submission API failures without confusing them with course-filter failures", async () => {
    vi.mocked(api.get).mockImplementation((url) => {
      if (url === API_ROUTES.teacher.courses) {
        return Promise.resolve({ data: { status: "ok", courses } } as never);
      }
      if (url === API_ROUTES.teacher.sessions) {
        return Promise.reject(new Error("queue down"));
      }
      return Promise.reject(new Error(`Unexpected GET ${String(url)}`));
    });

    renderSubmissions();

    expect(await screen.findByText("Could not load submissions")).toBeVisible();
    expect(screen.getByText("Submission queue unavailable.")).toBeVisible();
    expect(showToast).toHaveBeenCalledWith({
      type: "error",
      title: "Failed to load submissions",
      message: "Submission queue unavailable.",
    });
    expect(showToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "Courses failed to load" }),
    );
  });
});
