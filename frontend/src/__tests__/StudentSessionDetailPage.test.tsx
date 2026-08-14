import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StudentSessionDetailPage from "../pages/student/StudentSessionDetailPage";
import { API_ROUTES } from "../constants/apiRoutes";
import { api, getApiErrorMessage } from "../lib/api";

const { downloadCertificate } = vi.hoisted(() => ({
  downloadCertificate: vi.fn(),
}));

vi.mock("../hooks/useCertificateDownload", () => ({
  useCertificateDownload: () => ({
    downloadingId: null,
    downloadCertificate,
  }),
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

const session = {
  id: 157,
  title: "Behavioral Evidence Report",
  text_content: "This document was written through the TypeTrace editor.",
  classification: "HUMAN",
  classification_bucket: "HUMAN",
  confidence: 94.5,
  risk_level: "LOW",
  review_status: "APPROVED",
  review_outcome: "Accepted by teacher",
  wpm: 46,
  duration_seconds: 185,
  total_keystrokes: 612,
  deletions: 21,
  pauses: 14,
  avg_iki: 178,
  word_count: 86,
  certificate_id: "TT-DETAIL-157",
  document_hash: "d".repeat(64),
  course_name: "Secure Systems",
  course_code: "SEC401",
  created_at: "2026-08-13T08:30:00Z",
};

function renderSession(path = "/sessions/157") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/sessions/:sessionId" element={<StudentSessionDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("StudentSessionDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiErrorMessage).mockReturnValue("Session service unavailable.");
  });

  it("loads the owned session and renders its document, metrics, replay, and public verification links", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { status: "ok", session },
    } as never);

    renderSession();

    expect(
      await screen.findByRole("heading", { name: "Behavioral Evidence Report" }),
    ).toBeVisible();
    expect(
      screen.getByText("This document was written through the TypeTrace editor."),
    ).toBeVisible();
    expect(screen.getByText("HUMAN (94.5%)")).toBeVisible();
    expect(screen.getByText("Accepted by teacher")).toBeVisible();
    expect(screen.getByText("Secure Systems")).toBeVisible();
    expect(screen.getByText("612")).toBeVisible();

    expect(screen.getByRole("link", { name: "Replay Audit" })).toHaveAttribute(
      "href",
      "/session/157/replay",
    );
    expect(
      screen.getByRole("link", { name: /View Public Verification/ }),
    ).toHaveAttribute("href", "/verify/TT-DETAIL-157");

    expect(api.get).toHaveBeenCalledWith(API_ROUTES.student.sessionDetail("157"));
  });

  it("downloads the certificate from the session action", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { status: "ok", session },
    } as never);

    renderSession();

    fireEvent.click(await screen.findByRole("button", { name: "Certificate" }));

    expect(downloadCertificate).toHaveBeenCalledWith("TT-DETAIL-157");
  });

  it("renders a safe empty-document state and omits certificate controls when no certificate exists", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        status: "ok",
        session: {
          ...session,
          text_content: "",
          certificate_id: "",
          document_hash: "",
          course_name: null,
          course_code: null,
        },
      },
    } as never);

    renderSession();

    expect(
      await screen.findByText("No text content was captured for this session."),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Certificate" })).not.toBeInTheDocument();
    expect(screen.queryByText("Cryptographic Ledger")).not.toBeInTheDocument();
    expect(screen.queryByText("Submitted To")).not.toBeInTheDocument();
  });

  it("renders a controlled retrieval failure with a route back to the session ledger", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("network down"));

    renderSession("/sessions/999");

    expect(await screen.findByText("Could not load session")).toBeVisible();
    expect(screen.getByText("Session service unavailable.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to Sessions" })).toHaveAttribute(
      "href",
      "/sessions",
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(API_ROUTES.student.sessionDetail("999"));
    });
  });
});
