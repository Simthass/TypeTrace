// frontend/src/pages/VerifyLookupPage.tsx

import { useState } from "react";
import { Link } from "react-router-dom";

import { api, getApiErrorMessage } from "../lib/api";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";
import type { PublicCertificateVerification } from "../types/certificate";

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function VerificationResult({
  result,
}: {
  result: PublicCertificateVerification;
}) {
  if (!result.valid) {
    return (
      <div
        className="mt-6 rounded-md border bg-white p-5"
        style={{ borderColor: brand.aiAccent }}
      >
        <h2
          className="text-[15px] font-semibold"
          style={{ color: brand.aiText }}
        >
          Certificate not found
        </h2>
        <p
          className="mt-2 text-[13px]"
          style={{ color: colors.text.secondary }}
        >
          {result.reason ||
            "This certificate ID does not exist in the TypeTrace ledger."}
        </p>
      </div>
    );
  }

  const statusStyle =
    result.status === "VALID"
      ? {
          background: brand.humanBg,
          color: brand.humanText,
          borderColor: brand.humanAccent,
        }
      : result.status === "REVIEW_REQUIRED"
        ? {
            background: brand.suspiciousBg,
            color: brand.suspiciousText,
            borderColor: brand.suspiciousAccent,
          }
        : {
            background: brand.aiBg,
            color: brand.aiText,
            borderColor: brand.aiAccent,
          };

  return (
    <div
      className="mt-6 rounded-md border bg-white p-5"
      style={{ borderColor: colors.surface[200] }}
    >
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <h2
            className="text-[17px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            {result.title}
          </h2>
          <p
            className="mt-1 text-[13px]"
            style={{ color: colors.text.secondary }}
          >
            Certificate ID:{" "}
            <span className="font-mono" style={{ color: colors.text.primary }}>
              {result.certificate_id}
            </span>
          </p>
        </div>

        <span
          className="rounded-md border px-3 py-1.5 text-[12px] font-semibold"
          style={statusStyle}
        >
          {result.status}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Student", result.student_name],
          ["Student ID", result.student_id || "Not provided"],
          ["Institution", result.university_name || "Not provided"],
          ["Course", result.course_name || "Personal"],
          ["Classification", result.classification_label],
          ["Confidence", `${result.confidence}%`],
          ["Risk Level", result.risk_level],
          ["Generated", result.generated_at],
          ["Words", result.word_count],
          ["WPM", result.wpm],
          ["Duration", `${result.duration_seconds}s`],
          ["Ledger", result.ledger_status],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-md border px-3 py-2"
            style={{ borderColor: colors.surface[200] }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: colors.text.secondary }}
            >
              {label}
            </p>
            <p
              className="mt-1 text-[13px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              {value || "—"}
            </p>
          </div>
        ))}
      </div>

      <div
        className="mt-5 rounded-md border px-4 py-3"
        style={{ borderColor: colors.surface[200] }}
      >
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: colors.text.secondary }}
        >
          Document Hash
        </p>
        <p
          className="mt-1 break-all font-mono text-[11px]"
          style={{ color: colors.text.primary }}
        >
          {result.document_hash}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href={`/api/v1/certificates/${result.certificate_id}/pdf`}
          className="rounded-md px-4 py-2 text-[13px] font-semibold text-white"
          style={{ background: colors.brand }}
        >
          Download PDF
        </a>

        <Link
          to={`/verify/${result.certificate_id}`}
          className="rounded-md border px-4 py-2 text-[13px] font-semibold"
          style={{
            borderColor: colors.surface[200],
            color: colors.text.primary,
          }}
        >
          Open verification page
        </Link>
      </div>
    </div>
  );
}

export default function VerifyLookupPage() {
  const [certificateId, setCertificateId] = useState("");
  const [result, setResult] = useState<PublicCertificateVerification | null>(
    null,
  );
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleVerify = async () => {
    const trimmed = certificateId.trim();

    if (!trimmed) {
      setApiError("Enter a TypeTrace certificate ID.");
      return;
    }

    setIsLoading(true);
    setApiError(null);
    setResult(null);

    try {
      const response = await api.get<PublicCertificateVerification>(
        `/verify/${encodeURIComponent(trimmed)}`,
      );

      setResult(response.data);
    } catch (error) {
      setApiError(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen px-6 py-12"
      style={{ background: colors.surface[50] }}
    >
      <div className="mx-auto max-w-4xl">
        <div
          className="rounded-md border bg-white p-6 shadow-sm"
          style={{ borderColor: colors.surface[200] }}
        >
          <p
            className="text-[12px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: colors.text.secondary }}
          >
            Public certificate verification
          </p>
          <h1
            className="mt-2 text-2xl font-semibold"
            style={{ color: colors.text.primary }}
          >
            Verify a TypeTrace Certificate
          </h1>
          <p
            className="mt-2 max-w-2xl text-[14px]"
            style={{ color: colors.text.secondary }}
          >
            Enter the certificate ID printed on a TypeTrace PDF to confirm the
            writing session exists in the TypeTrace ledger.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <input
              value={certificateId}
              onChange={(event) => setCertificateId(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleVerify();
              }}
              placeholder="Example: TT26-ABC123EF"
              className="min-w-0 flex-1 rounded-md border px-4 py-3 text-[14px] outline-none"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
              }}
            />

            <button
              type="button"
              onClick={handleVerify}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-[13px] font-semibold text-white disabled:opacity-60"
              style={{ background: colors.brand }}
            >
              <SearchIcon />
              {isLoading ? "Verifying..." : "Verify"}
            </button>
          </div>

          {apiError && (
            <div
              className="mt-4 rounded-md border px-4 py-3 text-[13px]"
              style={{
                borderColor: brand.aiAccent,
                background: brand.aiBg,
                color: brand.aiText,
              }}
            >
              {apiError}
            </div>
          )}
        </div>

        {result && <VerificationResult result={result} />}

        <div className="mt-6 text-center">
          <Link
            to={ROUTES.HOME}
            className="text-[13px] font-semibold"
            style={{ color: colors.brand }}
          >
            Back to TypeTrace
          </Link>
        </div>
      </div>
    </div>
  );
}
