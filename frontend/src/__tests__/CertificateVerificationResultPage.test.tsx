import type { HTMLAttributes, ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CertificateVerificationResultPage from "../pages/CertificateVerificationResultPage";
import { api, getApiErrorMessage } from "../lib/api";
import type { PublicCertificateVerification } from "../types/certificate";

const showToast = vi.fn();
const usePageTitle = vi.fn();

vi.mock("../components/ui/ToastContext", () => ({
  useToast: () => ({
    showToast,
  }),
}));

vi.mock("../hooks/usePageTitle", () => ({
  usePageTitle: (value: unknown) => usePageTitle(value),
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

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  useReducedMotion: () => true,
  motion: {
    div: ({ children, className, style }: HTMLAttributes<HTMLDivElement>) => (
      <div className={className} style={style}>
        {children}
      </div>
    ),
  },
}));

function renderCertificate(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/verify/:certId"
          element={<CertificateVerificationResultPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

const validCertificate = {
  record_found: true,
  ledger_verified: true,
  certificate_active: true,
  valid: true,
  status: "VALID",
  certificate_id: "TT-QUALITY-001",
  reason: null,
  verify_url: "/verify/TT-QUALITY-001",
  title: "Evidence Contract",
  student_name: "Student Example",
  student_id: null,
  university_name: "Example University",
  course_name: "Secure Systems",
  course_code: "SEC401",
  word_count: 120,
  wpm: 42.5,
  duration_seconds: 185,
  classification: "HUMAN",
  classification_label: "Human",
  confidence: 0.94,
  human_evidence_score: 0.94,
  risk_level: "LOW",
  review_status: "APPROVED",
  review_outcome: "Accepted by teacher",
  document_hash: "d".repeat(64),
  evidence_hash: "e".repeat(64),
  created_at: "2026-08-13T07:00:00Z",
  generated_at: "2026-08-13T07:01:00Z",
  ledger_status: "VALID",
  signature_algorithm: "ED25519",
  signing_key_id: "test-key",
  signed_at: "2026-08-13T07:01:00Z",
  signed_payload_hash: "a".repeat(64),
  signature_status: "VALID",
  signature_valid: true,
  payload_hash_matches: true,
  ledger_reason: "Signature verified.",
  revoked_at: null,
  revocation_reason: null,
  decision_source: "MODEL",
  model_available: true,
  degraded_analysis: false,
  audit_timeline: [
    {
      label: "Writing session recorded",
      status: "complete",
      timestamp: "2026-08-13T07:00:00Z",
      description: "Evidence recorded.",
    },
  ],
  public_exposure: {
    essay_text_exposed: false,
    raw_keystrokes_exposed: false,
    student_private_notes_exposed: false,
  },
  privacy_notice:
    "Public verification does not expose essay text or raw keystroke evidence.",
} as unknown as PublicCertificateVerification;

describe("CertificateVerificationResultPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiErrorMessage).mockReturnValue("Verification service unavailable.");
  });

  it("rejects malformed certificate identifiers without calling the API", async () => {
    renderCertificate("/verify/bad!");

    expect(
      await screen.findByRole("heading", { name: "Verification failed" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Certificate ID format is invalid.")).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Invalid certificate ID" }),
    );
  });

  it("renders a public not-found state without exposing private evidence", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ...validCertificate,
        record_found: false,
        ledger_verified: false,
        certificate_active: false,
        valid: false,
        status: "NOT_FOUND",
        reason: "Certificate ID was not found in the TypeTrace ledger.",
      },
    } as never);

    renderCertificate("/verify/TT-QUALITY-404");

    expect(
      await screen.findByRole("heading", { name: "Certificate not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Certificate ID was not found in the TypeTrace ledger."),
    ).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Certificate not found" }),
    );
  });

  it("renders an active signed certificate and its privacy statement", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: validCertificate } as never);

    renderCertificate("/verify/TT-QUALITY-001");

    expect(await screen.findByText("Certificate record verified")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Evidence Contract" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No essay text or raw keystroke data is exposed publicly/i))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Export PDF" })).toBeInTheDocument();

    await waitFor(() => {
      expect(usePageTitle).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining("Verified Certificate"),
        }),
      );
    });
  });

  it("surfaces inactive and degraded ledger states for manual review", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ...validCertificate,
        certificate_active: false,
        ledger_verified: false,
        status: "INVALID_SIGNATURE",
        ledger_status: "INVALID_SIGNATURE",
        signature_status: "INVALID_SIGNATURE",
        signature_valid: false,
        payload_hash_matches: false,
        ledger_reason: "Signed payload hash does not match.",
        degraded_analysis: true,
      },
    } as never);

    renderCertificate("/verify/TT-QUALITY-002");

    const invalidSignatureLabels = await screen.findAllByText("INVALID SIGNATURE");
    expect(invalidSignatureLabels.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/signature or signed payload integrity check failed/i))
      .toBeInTheDocument();
    expect(screen.getByText(/Degraded analysis:/i)).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "warning",
        title: "INVALID SIGNATURE",
      }),
    );
  });

  it("renders controlled API failures", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("network down"));

    renderCertificate("/verify/TT-QUALITY-003");

    expect(
      await screen.findByRole("heading", { name: "Verification failed" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Verification service unavailable.")).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        title: "Verification failed",
      }),
    );
  });
});
