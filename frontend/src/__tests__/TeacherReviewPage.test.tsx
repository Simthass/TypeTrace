import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TeacherReviewPage from "../pages/teacher/TeacherReviewPage";
import { api } from "../lib/api";

const showToast = vi.fn();

vi.mock("../components/ui/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));

const baseSubmission = {
  id: 157,
  title: "Behavioral evidence report",
  student_name: "Ada Student",
  student_email: "ada.student@example.test",
  student_id: "ST-157",
  course_id: 9,
  course_name: "Evidence Systems",
  course_code: "ES101",
  classification: "HUMAN",
  classification_bucket: "HUMAN",
  confidence: 91,
  risk_level: "LOW",
  review_status: "APPROVED",
  review_notes: "Evidence is consistent.",
  wpm: 44,
  duration_seconds: 180,
  total_keystrokes: 420,
  deletions: 21,
  pauses: 14,
  avg_iki: 132,
  word_count: 86,
  certificate_id: "TT-REVIEW-001",
  document_hash: "a".repeat(64),
  decision_source: "MODEL_FUSION",
  model_available: true,
  degraded_analysis: false,
  created_at: "2026-08-13T09:00:00.000Z",
  text_content: "This document was written through the TypeTrace editor.",
  text_preview: "This document was written through the TypeTrace editor.",
  text_truncated: false,
  text_redacted_reason: null,
  review_saved_at: "2026-08-13T09:30:00.000Z",
};

function renderReview(path = "/teacher/review/157") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/teacher/review/:sessionId"
          element={<TeacherReviewPage />}
        />
        <Route
          path="/teacher/submissions"
          element={<div>Submission queue target</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TeacherReviewPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    showToast.mockReset();
  });

  it("loads the teacher-scoped dossier and renders its document and evidence state", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { status: "success", session: baseSubmission },
    } as never);

    renderReview();

    expect(
      await screen.findByRole("heading", {
        name: "Behavioral evidence report",
      }),
    ).toBeVisible();
    expect(api.get).toHaveBeenCalledWith("/teacher/sessions/157");
    expect(
      screen.getByText("This document was written through the TypeTrace editor."),
    ).toBeVisible();
    expect(screen.getByText("91%")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Approve evidence/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Saved/)).toBeVisible();
  });

  it("tracks unsaved teacher changes, trims notes, and persists the review contract", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: { status: "success", session: baseSubmission },
    } as never);
    const patch = vi.spyOn(api, "patch").mockResolvedValue({
      data: {
        review_status: "FLAGGED",
        review_notes: "Escalate for formal review.",
        review_saved_at: "2026-08-13T10:00:00.000Z",
      },
    } as never);

    renderReview();
    await screen.findByRole("heading", { name: "Behavioral evidence report" });

    fireEvent.click(
      screen.getByRole("button", { name: /Flag for academic review/ }),
    );
    fireEvent.change(screen.getByLabelText("Review notes"), {
      target: { value: "  Escalate for formal review.  " },
    });

    expect(screen.getByText("Unsaved changes")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Save teacher decision" }),
    );

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/teacher/sessions/157/review", {
        status: "FLAGGED",
        notes: "Escalate for formal review.",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Flag for academic review/ }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        title: "Review saved",
      }),
    );
  });

  it("makes degraded fallback analysis explicit to the reviewer", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: {
        status: "success",
        session: {
          ...baseSubmission,
          classification: "SUSPICIOUS",
          classification_bucket: "SUSPICIOUS",
          confidence: 58,
          risk_level: "MEDIUM",
          decision_source: "FALLBACK_RULES",
          model_available: false,
          degraded_analysis: true,
          review_status: "PENDING",
          review_notes: "",
          review_saved_at: null,
        },
      },
    } as never);

    renderReview();

    const degradedHeading = await screen.findByText("Degraded analysis record");
    const degradedBanner = degradedHeading.closest('[role="status"]');

    expect(degradedBanner).not.toBeNull();
    expect(
      within(degradedBanner as HTMLElement).getByText(/FALLBACK_RULES/),
    ).toBeVisible();
    expect(
      screen.getByText("FALLBACK_RULES · model unavailable", { exact: true }),
    ).toBeVisible();
    expect(screen.getByText("Review Required")).toBeVisible();
  });

  it("renders an explicit document-empty state without inventing submission text", async () => {
    vi.spyOn(api, "get").mockResolvedValue({
      data: {
        status: "success",
        session: {
          ...baseSubmission,
          title: "Metadata-only submission",
          text_content: null,
          text_preview: null,
          word_count: 0,
        },
      },
    } as never);

    renderReview();

    expect(
      await screen.findByRole("heading", { name: "Metadata-only submission" }),
    ).toBeVisible();
    expect(
      screen.getByText("No text content was captured for this submission."),
    ).toBeVisible();
  });
});
