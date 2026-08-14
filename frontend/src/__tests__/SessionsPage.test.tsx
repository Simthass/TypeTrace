import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SessionsPage from "../pages/SessionsPage";
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

const sessions = [
  {
    id: 157,
    title: "Human Authorship Essay",
    classification: "HUMAN",
    classification_bucket: "HUMAN",
    confidence: 94,
    risk_level: "LOW",
    review_status: "APPROVED",
    review_outcome: "Accepted",
    review_notes: "Strong behavioral evidence.",
    wpm: 46,
    duration_seconds: 185,
    word_count: 86,
    certificate_id: "TT-SESSION-157",
    course_name: "Secure Systems",
    course_code: "SEC401",
    created_at: "2026-08-13T08:30:00Z",
  },
  {
    id: 158,
    title: "Review Queue Draft",
    classification: "SUSPICIOUS",
    classification_bucket: "SUSPICIOUS",
    confidence: 62,
    risk_level: "MEDIUM",
    review_status: "PENDING",
    review_outcome: "",
    review_notes: "",
    wpm: 30,
    duration_seconds: 240,
    word_count: 72,
    certificate_id: null,
    course_name: null,
    course_code: null,
    created_at: "2026-08-12T08:30:00Z",
  },
];

function renderSessions() {
  return render(
    <MemoryRouter>
      <SessionsPage />
    </MemoryRouter>,
  );
}

describe("SessionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiErrorMessage).mockReturnValue("Sessions service unavailable.");
  });

  it("loads the student ledger and renders the empty-session call to action", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { status: "ok", total: 0, sessions: [] },
    } as never);

    renderSessions();

    expect(
      await screen.findByRole("heading", { name: "Writing Sessions" }),
    ).toBeVisible();
    expect(screen.getByText("No sessions yet")).toBeVisible();
    expect(screen.getByRole("link", { name: "Start first session" })).toHaveAttribute(
      "href",
      "/editor/new",
    );
    expect(api.get).toHaveBeenCalledWith(API_ROUTES.student.sessions, {
      params: { limit: 100 },
    });
  });

  it("summarizes classification, review, course, certificate, and replay state for saved sessions", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { status: "ok", total: sessions.length, sessions },
    } as never);

    renderSessions();

    expect(await screen.findByText("Captured sessions")).toBeVisible();
    expect(screen.queryByText("2 of 2 sessions classified as human")).not.toBeInTheDocument();
    expect(screen.getByText("1 of 2 sessions classified as human")).toBeVisible();
    expect(screen.getAllByText("50%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Human Authorship Essay").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Review Queue Draft").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("SEC401").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Issued").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("link", { name: "Replay" }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole("link", { name: "Verify" })[0]).toHaveAttribute(
      "href",
      "/verify/TT-SESSION-157",
    );
  });

  it("filters the ledger by search and restores all records when the search is cleared", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { status: "ok", total: sessions.length, sessions },
    } as never);

    renderSessions();

    const search = await screen.findByPlaceholderText(
      "Search title, course, certificate",
    );
    fireEvent.change(search, { target: { value: "no-such-session" } });

    expect(screen.getByText("No sessions match your filters")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(screen.queryByText("No sessions match your filters")).not.toBeInTheDocument();
    expect(screen.getAllByText("Human Authorship Essay").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Review Queue Draft").length).toBeGreaterThanOrEqual(1);
  });

  it("surfaces API failures through the page state and toast contract", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("network down"));

    renderSessions();

    expect(await screen.findByText("Could not load sessions")).toBeVisible();
    expect(screen.getByText("Sessions service unavailable.")).toBeVisible();
    expect(showToast).toHaveBeenCalledWith({
      type: "error",
      title: "Sessions failed to load",
      message: "Sessions service unavailable.",
    });

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  });
});
