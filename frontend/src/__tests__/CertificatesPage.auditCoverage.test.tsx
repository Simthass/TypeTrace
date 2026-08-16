import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CertificatesPage from "../pages/CertificatesPage";
import { api } from "../lib/api";

const mocks = vi.hoisted(() => ({
  downloadCertificate: vi.fn(),
  showToast: vi.fn(),
  getApiErrorMessage: vi.fn(() => "Certificate service unavailable."),
}));

vi.mock("../hooks/useCertificateDownload", () => ({
  useCertificateDownload: () => ({
    downloadingId: null,
    downloadCertificate: mocks.downloadCertificate,
  }),
}));

vi.mock("../components/ui/ToastContext", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    api: { ...actual.api, get: vi.fn() },
    getApiErrorMessage: mocks.getApiErrorMessage,
  };
});

type LedgerStatus =
  | "VALID"
  | "REVIEW_REQUIRED"
  | "REVOKED"
  | "INVALID_SIGNATURE"
  | "LEGACY_UNSIGNED"
  | "NOT_FOUND";

function certificate(
  index: number,
  overrides: Partial<{
    title: string;
    classification: string;
    confidence: number;
    created_at: string;
    certificate_id: string;
    document_hash: string;
    risk_level: string;
    review_status: string;
    review_outcome: string;
    course_name: string | null;
    course_code: string | null;
    verify_url: string;
    status: LedgerStatus;
    certificate_active: boolean;
    degraded_analysis: boolean;
    decision_source: string | null;
  }> = {},
) {
  const certificateId = overrides.certificate_id ?? `TT-AUDIT-${String(index).padStart(3, "0")}`;
  return {
    session_id: 500 + index,
    title: overrides.title ?? `Evidence record ${index}`,
    classification: overrides.classification ?? "HUMAN",
    confidence: overrides.confidence ?? 90 - index,
    created_at: overrides.created_at ?? `2026-08-${String((index % 20) + 1).padStart(2, "0")}T08:30:00Z`,
    certificate_id: certificateId,
    document_hash: overrides.document_hash ?? String(index % 10).repeat(64),
    risk_level: overrides.risk_level ?? "LOW",
    review_status: overrides.review_status ?? "APPROVED",
    review_outcome: overrides.review_outcome ?? "Accepted",
    course_name: overrides.course_name === undefined ? "Secure Systems" : overrides.course_name,
    course_code: overrides.course_code === undefined ? "SEC401" : overrides.course_code,
    verify_url: overrides.verify_url ?? `/verify/${certificateId}`,
    status: overrides.status ?? "VALID",
    certificate_active: overrides.certificate_active ?? true,
    degraded_analysis: overrides.degraded_analysis ?? false,
    decision_source:
      overrides.decision_source === undefined
        ? "MODEL_FUSION"
        : overrides.decision_source,
  };
}

const ledgerMatrix = [
  certificate(1, { status: "VALID", classification: "HUMAN", risk_level: "LOW" }),
  certificate(2, {
    status: "REVIEW_REQUIRED",
    classification: "SUSPICIOUS",
    risk_level: "MEDIUM",
    review_status: "PENDING",
    review_outcome: "",
    certificate_active: false,
    degraded_analysis: true,
    decision_source: null,
  }),
  certificate(3, {
    status: "REVOKED",
    classification: "SYNTHETIC",
    risk_level: "HIGH",
    review_status: "FLAGGED",
    certificate_active: false,
  }),
  certificate(4, {
    status: "INVALID_SIGNATURE",
    classification: "AI-GENERATED",
    risk_level: "HIGH",
    certificate_active: false,
  }),
  certificate(5, {
    status: "LEGACY_UNSIGNED",
    classification: "AI",
    risk_level: "MEDIUM",
    certificate_active: false,
  }),
  certificate(6, {
    status: "NOT_FOUND",
    classification: "UNKNOWN",
    risk_level: "UNKNOWN",
    review_status: "UNKNOWN",
    review_outcome: "",
    document_hash: "",
    course_name: null,
    course_code: null,
    verify_url: "",
    certificate_active: false,
  }),
];

function installCertificates(rows = ledgerMatrix) {
  vi.mocked(api.get).mockResolvedValue({
    data: { status: "ok", certificates: rows },
  } as never);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CertificatesPage />
    </MemoryRouter>,
  );
}

describe("CertificatesPage audit and interaction coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.downloadCertificate.mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("renders every ledger and classification bucket including inactive fallback records", async () => {
    installCertificates();
    renderPage();

    expect(await screen.findByText("Total certificates")).toBeVisible();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Active · review required").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Revoked").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Invalid signature").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Legacy unsigned").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not found").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("High risk").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/FALLBACK_RULES · trained model unavailable/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Personal").length).toBeGreaterThan(0);
  });

  it("opens the certificate audit drawer, exposes privacy-safe actions, downloads, and closes it", async () => {
    installCertificates([ledgerMatrix[1]]);
    renderPage();

    const id = await screen.findAllByText("TT-AUDIT-002");
    const opener = id.map((node) => node.closest("button")).find(Boolean);
    expect(opener).toBeTruthy();
    fireEvent.click(opener!);

    expect(await screen.findByText("Certificate audit")).toBeVisible();
    expect(screen.getByText("Certificate ID")).toBeVisible();
    expect(screen.getByText("Ledger status")).toBeVisible();
    expect(screen.getByText("Document hash")).toBeVisible();
    expect(screen.getByText(/not an active verified certificate/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "Verify Certificate" })).toHaveAttribute(
      "href",
      "/verify/TT-AUDIT-002",
    );
    expect(screen.getByRole("link", { name: "Replay Session" })).toHaveAttribute(
      "href",
      "/session/502/replay",
    );

    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(mocks.downloadCertificate).toHaveBeenCalledWith("TT-AUDIT-002");

    fireEvent.click(screen.getByRole("button", { name: "Close certificate detail" }));
    expect(screen.queryByText("Certificate audit")).not.toBeInTheDocument();
  });

  it("copies certificate IDs and reports clipboard failure without changing page state", async () => {
    installCertificates([ledgerMatrix[0]]);
    renderPage();

    const copyButtons = await screen.findAllByRole("button", { name: "Copy certificate ID" });
    fireEvent.click(copyButtons[0]);

    await waitFor(() => {
      expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith("TT-AUDIT-001");
    });
    expect(await screen.findByText("Copied")).toBeVisible();

    vi.mocked(window.navigator.clipboard.writeText).mockRejectedValueOnce(new Error("denied"));
    fireEvent.click(copyButtons.at(-1)!);
    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith({
        type: "error",
        title: "Copy failed",
        message: "Could not copy the certificate ID.",
      });
    });
  });

  it("executes all classification filters, every sort mode, and the full reset path", async () => {
    installCertificates();
    renderPage();

    await screen.findByText("Total certificates");
    fireEvent.click(screen.getByRole("button", { name: /Needs review/ }));
    expect(screen.getAllByText("TT-AUDIT-002").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /High risk/ }));
    expect(screen.getAllByText("TT-AUDIT-003").length).toBeGreaterThan(0);

    const sort = screen.getByRole("combobox");
    for (const value of ["OLDEST", "CONFIDENCE_HIGH", "CONFIDENCE_LOW", "COURSE", "NEWEST"]) {
      fireEvent.change(sort, { target: { value } });
      expect(sort).toHaveValue(value);
    }

    fireEvent.change(screen.getByPlaceholderText("Search ID, hash, course, title"), {
      target: { value: "definitely missing" },
    });
    expect(screen.getByText("No certificates match this filter")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByPlaceholderText("Search ID, hash, course, title")).toHaveValue("");
    expect(sort).toHaveValue("NEWEST");
  }, 15_000);

  it("paginates a vault larger than one page and preserves individual download actions", async () => {
    const rows = Array.from({ length: 17 }, (_, index) => certificate(index + 20));
    installCertificates(rows);
    renderPage();

    expect(await screen.findByText("1 / 2")).toBeVisible();
    expect(screen.getByText(/Showing 1–16 of 17 certificates/)).toBeVisible();

    const sortedRows = [...rows].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("2 / 2")).toBeVisible();
    expect(screen.getByText(/Showing 17–17 of 17 certificates/)).toBeVisible();

    const pageTwoPdfButtons = screen.getAllByRole("button", { name: "PDF" });
    expect(pageTwoPdfButtons.length).toBeGreaterThan(0);
    fireEvent.click(pageTwoPdfButtons[0]);
    expect(mocks.downloadCertificate).toHaveBeenCalledWith(
      sortedRows[16].certificate_id,
    );

    fireEvent.click(screen.getByRole("button", { name: "Prev" }));
    expect(screen.getByText("1 / 2")).toBeVisible();
  }, 15_000);

  it("normalizes malformed numeric/date values without breaking the certificate vault", async () => {
    installCertificates([
      certificate(90, {
        confidence: Number.NaN,
        created_at: "not-a-date",
        document_hash: "short-hash",
        classification: "UNCLASSIFIED",
        risk_level: "UNSET",
        review_status: "UNSET",
      }),
    ]);
    renderPage();

    expect(await screen.findByText("Average confidence")).toBeVisible();
    expect(screen.getAllByText("0%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("not-a-date").length).toBeGreaterThan(0);
    expect(screen.getAllByText("short-hash").length).toBeGreaterThan(0);
  });
});
