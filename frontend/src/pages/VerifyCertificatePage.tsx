// frontend/src/pages/VerifyCertificatePage.tsx

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, getApiErrorMessage } from "../lib/api";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";
import type { PublicCertificateVerification } from "../types/certificate";
import { API_ROUTES } from "../constants/apiRoutes";

function statusStyle(status: string | undefined) {
  if (status === "VALID") {
    return {
      background: brand.humanBg,
      color: brand.humanText,
      borderColor: brand.humanAccent,
      label: "Valid Certificate",
    };
  }

  if (status === "REVIEW_REQUIRED") {
    return {
      background: brand.suspiciousBg,
      color: brand.suspiciousText,
      borderColor: brand.suspiciousAccent,
      label: "Review Required",
    };
  }

  return {
    background: brand.aiBg,
    color: brand.aiText,
    borderColor: brand.aiAccent,
    label: "High Risk / Invalid",
  };
}

export default function VerifyCertificatePage() {
  const { certId } = useParams<{ certId: string }>();

  const [result, setResult] = useState<PublicCertificateVerification | null>(
    null,
  );
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function verify() {
      const cleanCertId = certId?.trim();

      if (!cleanCertId) {
        setApiError("Certificate ID is missing.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setApiError(null);
      setResult(null);

      try {
        const response = await api.get<PublicCertificateVerification>(
          API_ROUTES.certificates.verifyPublic(cleanCertId),
        );

        if (!mounted) return;

        setResult(response.data);

        if (!response.data.valid) {
          setApiError(
            response.data.reason ||
              "Certificate ID was not found in the TypeTrace verification ledger.",
          );
        }
      } catch (error) {
        if (!mounted) return;
        setApiError(getApiErrorMessage(error));
        setResult(null);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void verify();

    return () => {
      mounted = false;
    };
  }, [certId]);

  const style = statusStyle(result?.status);

  return (
    <div
      className="min-h-screen px-6 py-12"
      style={{ background: colors.surface[50] }}
    >
      <div className="mx-auto max-w-5xl">
        <div
          className="rounded-md border bg-white p-6 shadow-sm"
          style={{ borderColor: colors.surface[200] }}
        >
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <p
                className="text-[12px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: colors.text.secondary }}
              >
                TypeTrace public verification
              </p>
              <h1
                className="mt-2 text-2xl font-semibold"
                style={{ color: colors.text.primary }}
              >
                Certificate Verification
              </h1>
              <p
                className="mt-2 text-[14px]"
                style={{ color: colors.text.secondary }}
              >
                This page verifies that a TypeTrace certificate exists and
                matches a recorded writing session.
              </p>
            </div>

            {result && (
              <div
                className="rounded-md border px-4 py-3 text-right"
                style={{
                  background: style.background,
                  color: style.color,
                  borderColor: style.borderColor,
                }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em]">
                  Status
                </p>
                <p className="mt-1 text-lg font-bold">{style.label}</p>
              </div>
            )}
          </div>

          {isLoading && (
            <div
              className="mt-8 text-[13px]"
              style={{ color: colors.text.secondary }}
            >
              Verifying certificate...
            </div>
          )}

          {apiError && (
            <div
              className="mt-6 rounded-md border px-4 py-3 text-[13px]"
              style={{
                borderColor: brand.aiAccent,
                background: brand.aiBg,
                color: brand.aiText,
              }}
            >
              {apiError}
            </div>
          )}

          {result && !result.valid && (
            <div
              className="mt-6 rounded-md border px-4 py-4"
              style={{
                borderColor: brand.aiAccent,
                background: brand.aiBg,
              }}
            >
              <h2
                className="text-[15px] font-semibold"
                style={{ color: brand.aiText }}
              >
                Certificate not found
              </h2>
              <p className="mt-2 text-[13px]" style={{ color: brand.aiText }}>
                {result.reason ||
                  "This certificate ID is not recorded in the TypeTrace ledger."}
              </p>
            </div>
          )}

          {result && result.valid && (
            <>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Certificate ID", result.certificate_id],
                  ["Student", result.student_name],
                  ["Student ID", result.student_id || "Not provided"],
                  ["Institution", result.university_name || "Not provided"],
                  ["Course", result.course_name || "Personal"],
                  ["Classification", result.classification_label],
                  ["Confidence", `${result.confidence}%`],
                  ["Risk Level", result.risk_level],
                  ["Word Count", result.word_count],
                  ["WPM", result.wpm],
                  ["Duration", `${result.duration_seconds}s`],
                  ["Generated", result.generated_at],
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
                      className="mt-1 break-words text-[13px] font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      {value || "—"}
                    </p>
                  </div>
                ))}
              </div>

              <div
                className="mt-6 rounded-md border px-4 py-3"
                style={{ borderColor: colors.surface[200] }}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: colors.text.secondary }}
                >
                  Document Integrity Hash
                </p>
                <p
                  className="mt-1 break-all font-mono text-[11px]"
                  style={{ color: colors.text.primary }}
                >
                  {result.document_hash}
                </p>
              </div>

              <div
                className="mt-6 rounded-md border px-4 py-3"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[50],
                }}
              >
                <p
                  className="text-[13px]"
                  style={{ color: colors.text.secondary }}
                >
                  Ledger status:{" "}
                  <span
                    className="font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {result.ledger_status}
                  </span>
                </p>
                <p
                  className="mt-1 text-[12px]"
                  style={{ color: colors.text.secondary }}
                >
                  Review status: {result.review_status}
                </p>
              </div>

              <div
                className="mt-6 rounded-md border p-5"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[50],
                }}
              >
                <p
                  className="text-[13px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: colors.text.secondary }}
                >
                  Interpretation guidance
                </p>

                <p
                  className="mt-3 text-[14px] leading-7"
                  style={{ color: colors.text.secondary }}
                >
                  This certificate confirms that TypeTrace recorded a writing
                  session and associated behavioral evidence for the listed
                  document. It should be treated as supporting authorship
                  evidence, not as absolute proof of authorship or misconduct.
                  Academic decisions should consider this record alongside
                  institutional review procedures and other available evidence.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <a
                  href={`/api/v1/certificates/${result.certificate_id}/pdf`}
                  className="rounded-md px-4 py-2 text-[13px] font-semibold text-white"
                  style={{ background: colors.brand }}
                >
                  Download PDF
                </a>

                <Link
                  to={ROUTES.VERIFY_LOOKUP}
                  className="rounded-md border px-4 py-2 text-[13px] font-semibold"
                  style={{
                    borderColor: colors.surface[200],
                    color: colors.text.primary,
                  }}
                >
                  Verify another certificate
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
