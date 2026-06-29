import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  ErrorState,
  LoadingState,
  StatePanel,
} from "../components/ui/AsyncState";
import { useToast } from "../components/ui/ToastProvider";
import { API_ROUTES } from "../constants/apiRoutes";
import { ROUTES } from "../constants/routes";
import { api, getApiErrorMessage } from "../lib/api";
import { isValidCertificateId, normalizeCertificateId } from "../lib/edgeCases";
import { brand, colors } from "../styles/colors";
import type { PublicCertificateVerification } from "../types/certificate";

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

  if (status === "INVALID") {
    return {
      background: colors.surface[100],
      color: colors.text.secondary,
      borderColor: colors.surface[200],
      label: "Invalid Certificate",
    };
  }

  return {
    background: brand.aiBg,
    color: brand.aiText,
    borderColor: brand.aiAccent,
    label: "High Risk Evidence",
  };
}

export default function VerifyCertificatePage() {
  const { certId } = useParams<{ certId: string }>();
  const { showToast } = useToast();

  const [result, setResult] = useState<PublicCertificateVerification | null>(
    null,
  );
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function verify() {
      const cleanCertId = normalizeCertificateId(certId || "");

      if (!cleanCertId) {
        setApiError("Certificate ID is missing.");
        setIsLoading(false);

        showToast({
          type: "warning",
          title: "Certificate ID missing",
          message: "Open verification using a valid TypeTrace certificate ID.",
        });

        return;
      }

      if (!isValidCertificateId(cleanCertId)) {
        setApiError("Certificate ID format is invalid.");
        setIsLoading(false);

        showToast({
          type: "warning",
          title: "Invalid certificate ID",
          message:
            "Certificate IDs may only contain letters, numbers, dashes, and underscores.",
        });

        return;
      }

      setIsLoading(true);
      setApiError(null);

      try {
        const response = await api.get<PublicCertificateVerification>(
          API_ROUTES.certificates.verify(cleanCertId),
          {
            skipGlobalToast: true,
          },
        );

        if (!mounted) return;

        setResult(response.data);

        if (!response.data.valid) {
          showToast({
            type: "warning",
            title: "Certificate not found",
            message:
              response.data.reason ||
              "This certificate ID was not found in the TypeTrace ledger.",
          });
        }
      } catch (error) {
        if (!mounted) return;

        const message = getApiErrorMessage(error);
        setApiError(message);

        showToast({
          type: "error",
          title: "Verification failed",
          message,
        });
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void verify();

    return () => {
      mounted = false;
    };
  }, [certId, showToast]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <LoadingState
          title="Verifying certificate"
          message="Checking the TypeTrace certificate ledger."
        />
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <ErrorState
          title="Certificate verification failed"
          message={apiError}
          action={
            <Link
              to={ROUTES.VERIFY_LOOKUP}
              className="inline-flex rounded-md px-4 py-2.5 text-[13px] font-bold"
              style={{ background: colors.brand, color: colors.text.light }}
            >
              Try another certificate
            </Link>
          }
        />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <ErrorState
          title="No verification result"
          message="TypeTrace could not load a certificate result for this request."
        />
      </div>
    );
  }

  const style = statusStyle(result.status);

  if (!result.valid) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <StatePanel
          tone="warning"
          title="Certificate not found"
          message={
            result.reason ||
            "This certificate ID was not found in the TypeTrace ledger."
          }
          action={
            <Link
              to={ROUTES.VERIFY_LOOKUP}
              className="inline-flex rounded-md px-4 py-2.5 text-[13px] font-bold"
              style={{ background: colors.brand, color: colors.text.light }}
            >
              Verify another certificate
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <div
        className="rounded-md border bg-white p-6"
        style={{
          borderColor: colors.surface[200],
          boxShadow: `0 24px 70px ${colors.shadow}`,
        }}
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p
              className="text-[12px] font-bold uppercase tracking-[0.16em]"
              style={{ color: colors.brand }}
            >
              TypeTrace public verification
            </p>
            <h1
              className="mt-3 text-3xl font-semibold tracking-[-0.04em]"
              style={{ color: colors.text.primary }}
            >
              {result.title || "Writing Evidence Certificate"}
            </h1>
            <p
              className="mt-2 text-[14px] leading-7"
              style={{ color: colors.text.secondary }}
            >
              This page confirms a recorded TypeTrace writing session. It is
              supporting behavioral evidence for academic review, not absolute
              proof of authorship.
            </p>
          </div>

          <span
            className="inline-flex rounded-md border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em]"
            style={{
              background: style.background,
              color: style.color,
              borderColor: style.borderColor,
            }}
          >
            {style.label}
          </span>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            ["Certificate ID", result.certificate_id],
            ["Student", result.student_name],
            ["Student ID", result.student_id || "Not provided"],
            ["Course", result.course_name || "Personal session"],
            ["Classification", result.classification_label],
            ["Confidence", `${result.confidence}%`],
            ["Risk level", result.risk_level],
            ["Review status", result.review_status],
            ["Generated", result.generated_at],
            ["Document hash", result.document_hash],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-md border p-4"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[50],
              }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-[0.13em]"
                style={{ color: colors.text.secondary }}
              >
                {label}
              </p>
              <p
                className="mt-2 break-all text-[14px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                {value || "-"}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={`${API_ROUTES.certificates.pdf(result.certificate_id)}`}
            className="rounded-md px-4 py-2.5 text-[13px] font-bold"
            style={{ background: colors.brand, color: colors.text.light }}
          >
            Download PDF
          </a>

          <Link
            to={ROUTES.VERIFY_LOOKUP}
            className="rounded-md border px-4 py-2.5 text-[13px] font-bold"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
              background: colors.surface[50],
            }}
          >
            Verify another
          </Link>
        </div>
      </div>
    </div>
  );
}
