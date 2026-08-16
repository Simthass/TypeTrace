import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SessionsPage from "../pages/SessionsPage";
import { api, getApiErrorMessage } from "../lib/api";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../components/ui/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    api: { ...actual.api, get: vi.fn() },
    getApiErrorMessage: vi.fn(),
  };
});

function session(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: index,
    title: `Session ${String(index).padStart(2, "0")}`,
    classification: "HUMAN",
    classification_bucket: "HUMAN",
    confidence: 80 + (index % 15),
    risk_level: "LOW",
    review_status: "APPROVED",
    review_outcome: "Accepted",
    review_notes: "",
    wpm: 25 + index,
    duration_seconds: 120 + index * 10,
    word_count: 50 + index,
    certificate_id: `TT-SESSION-${index}`,
    course_name: "Evidence Systems",
    course_code: "EVI500",
    created_at: `2026-08-${String(Math.min(index, 28)).padStart(2, "0")}T08:00:00Z`,
    ...overrides,
  };
}

function renderSessions() {
  return render(
    <MemoryRouter>
      <SessionsPage />
    </MemoryRouter>,
  );
}

describe("SessionsPage final operational closure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiErrorMessage).mockReturnValue("Controlled sessions error.");
  });

  it("normalizes high-risk, discussion, flagged, personal, unknown, and long-duration records", async () => {
    const rows = [
      session(1),
      session(2, {
        classification: "SUSPICIOUS",
        classification_bucket: "SUSPICIOUS",
        risk_level: "MEDIUM",
        review_status: "NEEDS_DISCUSSION",
        certificate_id: null,
      }),
      session(3, {
        classification: "AI-GENERATED",
        classification_bucket: "AI-GENERATED",
        risk_level: "HIGH",
        review_status: "FLAGGED",
        duration_seconds: 4_200,
      }),
      session(4, {
        classification: "UNKNOWN_BUCKET",
        classification_bucket: "",
        risk_level: "UNKNOWN",
        review_status: "NOT_APPLICABLE",
        course_name: null,
        course_code: null,
        certificate_id: null,
        created_at: "not-a-date",
      }),
    ];
    vi.mocked(api.get).mockResolvedValue({
      data: { status: "ok", total: rows.length, sessions: rows },
    } as never);

    renderSessions();

    expect(await screen.findAllByText("High risk")).not.toHaveLength(0);
    expect(screen.getAllByText("NEEDS DISCUSSION").length).toBeGreaterThan(0);
    expect(screen.getAllByText("FLAGGED").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Personal").length).toBeGreaterThan(0);
    expect(screen.getAllByText("UNKNOWN BUCKET").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1h").length).toBeGreaterThan(0);
  });

  it("executes every classification and review filter and restores the complete ledger", async () => {
    const rows = [
      session(1),
      session(2, {
        title: "Review session",
        classification: "SUSPICIOUS",
        classification_bucket: "SUSPICIOUS",
        review_status: "PENDING",
      }),
      session(3, {
        title: "Flagged synthetic",
        classification: "HIGH_RISK",
        classification_bucket: "HIGH_RISK",
        review_status: "FLAGGED",
      }),
    ];
    vi.mocked(api.get).mockResolvedValue({
      data: { status: "ok", total: rows.length, sessions: rows },
    } as never);

    renderSessions();
    await screen.findByText("Captured sessions");

    fireEvent.click(screen.getByRole("button", { name: /Needs review/ }));
    expect(screen.getAllByText("Review session").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /High risk/ }));
    expect(screen.getAllByText("Flagged synthetic").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Human/ }));
    expect(screen.getAllByText("Session 01").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /All evidence/ }));
    const [reviewSelect] = screen.getAllByRole("combobox");
    fireEvent.change(reviewSelect, { target: { value: "FLAGGED" } });
    expect(screen.getAllByText("Flagged synthetic").length).toBeGreaterThan(0);

    fireEvent.change(reviewSelect, { target: { value: "ALL" } });
    expect(screen.getAllByText("Session 01").length).toBeGreaterThan(0);
  });

  it("executes every supported sort mode without losing evidence records", async () => {
    const rows = [
      session(1, { confidence: 40, wpm: 20, duration_seconds: 100 }),
      session(2, { confidence: 95, wpm: 70, duration_seconds: 600 }),
      session(3, { confidence: 65, wpm: 45, duration_seconds: 300 }),
    ];
    vi.mocked(api.get).mockResolvedValue({
      data: { status: "ok", total: rows.length, sessions: rows },
    } as never);

    renderSessions();
    await screen.findByText("Captured sessions");
    const [, sortSelect] = screen.getAllByRole("combobox");

    for (const value of [
      "oldest",
      "confidence-desc",
      "confidence-asc",
      "wpm-desc",
      "duration-desc",
      "newest",
    ]) {
      fireEvent.change(sortSelect, { target: { value } });
      expect(screen.getAllByText("Session 01").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Session 02").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Session 03").length).toBeGreaterThan(0);
    }
  });

  it("paginates a ledger larger than one page in both directions", async () => {
    const rows = Array.from({ length: 17 }, (_, index) => session(index + 1));
    vi.mocked(api.get).mockResolvedValue({
      data: { status: "ok", total: rows.length, sessions: rows },
    } as never);

    renderSessions();
    expect(await screen.findByText(/Showing 1–16 of 17 sessions/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/Showing 17–17 of 17 sessions/)).toBeVisible();
    expect(screen.getByText("2 / 2")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Prev" }));
    expect(screen.getByText(/Showing 1–16 of 17 sessions/)).toBeVisible();
    expect(screen.getByText("1 / 2")).toBeVisible();
  });

  it("resets all filters from the no-match action", async () => {
    const rows = [session(1), session(2)];
    vi.mocked(api.get).mockResolvedValue({
      data: { status: "ok", total: rows.length, sessions: rows },
    } as never);

    renderSessions();
    const search = await screen.findByPlaceholderText(
      "Search title, course, certificate",
    );
    fireEvent.change(search, { target: { value: "impossible-filter" } });
    expect(screen.getByText("No sessions match your filters")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(search).toHaveValue("");
    expect(screen.getAllByText("Session 01").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Session 02").length).toBeGreaterThan(0);
  });
});
