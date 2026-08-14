import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CertificatesPage from "../pages/CertificatesPage";
import { API_ROUTES } from "../constants/apiRoutes";
import { api, getApiErrorMessage } from "../lib/api";

const { downloadCertificate, showToast } = vi.hoisted(() => ({
  downloadCertificate: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../hooks/useCertificateDownload", () => ({
  useCertificateDownload: () => ({
    downloadingId: null,
    downloadCertificate,
  }),
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
    },
    getApiErrorMessage: vi.fn(),
  };
});

const certificates = [
  {
    session_id: 157,
    title: "Human Authorship Essay",
    classification: "HUMAN",
    confidence: 94,
    created_at: "2026-08-13T08:30:00Z",
    certificate_id: "TT-CERT-157",
    document_hash: "a".repeat(64),
    risk_level: "LOW",
    review_status: "APPROVED",
    review_outcome: "Accepted",
    course_name: "Secure Systems",
    course_code: "SEC401",
    verify_url: "/verify/TT-CERT-157",
    status: "VALID",
    certificate_active: true,
    degraded_analysis: false,
    decision_source: "MODEL_FUSION",
  },
  {
    session_id: 158,
    title: "Fallback Review Record",
    classification: "SUSPICIOUS",
    confidence: 61,
    created_at: "2026-08-12T08:30:00Z",
    certificate_id: "TT-CERT-158",
    document_hash: "b".repeat(64),
    risk_level: "MEDIUM",
    review_status: "PENDING",
    review_outcome: "Manual review required",
    course_name: null,
    course_code: null,
    verify_url: "/verify/TT-CERT-158",
    status: "REVIEW_REQUIRED",
    certificate_active: false,
    degraded_analysis: true,
    decision_source: "FALLBACK_RULES",
  },
];

function renderCertificates() {
  return render(
    <MemoryRouter>
      <CertificatesPage />
    </MemoryRouter>,
  );
}

describe("CertificatesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiErrorMessage).mockReturnValue("Certificate service unavailable.");
  });

  it("loads the certificate vault and renders the empty-vault call to action", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { status: "ok", certificates: [] },
    } as never);

    renderCertificates();

    expect(
      await screen.findByRole("heading", { name: "Certificates" }),
    ).toBeVisible();
    expect(screen.getByText("No certificates yet")).toBeVisible();
    expect(screen.getByRole("link", { name: "Start writing session" })).toHaveAttribute(
      "href",
      "/editor/new",
    );
    expect(screen.getByRole("button", { name: "Download PDFs" })).toBeDisabled();
    expect(api.get).toHaveBeenCalledWith(API_ROUTES.certificates.list);
  });

  it("renders active and degraded certificate records with public verification and replay routes", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { status: "ok", certificates },
    } as never);

    renderCertificates();

    expect(await screen.findByText("Total certificates")).toBeVisible();
    expect(screen.getByText("2 certificates include a document hash")).toBeVisible();
    expect(screen.getAllByText("TT-CERT-157").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("TT-CERT-158").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/FALLBACK_RULES · trained model unavailable/).length)
      .toBeGreaterThanOrEqual(1);

    const verifyLinks = screen.getAllByRole("link", { name: "Verify" });
    expect(verifyLinks[0]).toHaveAttribute("href", "/verify/TT-CERT-157");
    expect(screen.getAllByRole("link", { name: "Replay" })[0]).toHaveAttribute(
      "href",
      "/session/157/replay",
    );
  });

  it("filters by search, restores the vault, and downloads every visible certificate", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { status: "ok", certificates },
    } as never);
    downloadCertificate.mockResolvedValue(undefined);

    renderCertificates();

    const search = await screen.findByPlaceholderText("Search ID, hash, course, title");
    fireEvent.change(search, { target: { value: "missing-certificate" } });

    expect(screen.getByText("No certificates match this filter")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.queryByText("No certificates match this filter")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Download PDFs" }));

    await waitFor(() => {
      expect(downloadCertificate).toHaveBeenNthCalledWith(1, "TT-CERT-157");
      expect(downloadCertificate).toHaveBeenNthCalledWith(2, "TT-CERT-158");
    });
  });

  it("surfaces certificate API failures through the page state and toast contract", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("network down"));

    renderCertificates();

    expect(await screen.findByText("Could not load certificates")).toBeVisible();
    expect(screen.getByText("Certificate service unavailable.")).toBeVisible();
    expect(showToast).toHaveBeenCalledWith({
      type: "error",
      title: "Certificates failed to load",
      message: "Certificate service unavailable.",
    });
  });
});
