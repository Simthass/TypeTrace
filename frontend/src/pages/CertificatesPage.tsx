// frontend/src/pages/CertificatesPage.tsx

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, getApiErrorMessage } from "../lib/api";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";
import { useCertificateDownload } from "../hooks/useCertificateDownload";
import type {
  CertificateListItem,
  CertificateListResponse,
} from "../types/certificate";

function ShieldCheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function classificationStyles(classification: string) {
  const normalized = classification.toUpperCase();

  if (normalized === "HUMAN") {
    return {
      background: brand.humanBg,
      color: brand.humanText,
      borderColor: brand.humanAccent,
      label: "Human",
    };
  }

  if (normalized === "SUSPICIOUS") {
    return {
      background: brand.suspiciousBg,
      color: brand.suspiciousText,
      borderColor: brand.suspiciousAccent,
      label: "Review",
    };
  }

  return {
    background: brand.aiBg,
    color: brand.aiText,
    borderColor: brand.aiAccent,
    label: "High Risk",
  };
}

function CertificateCard({
  certificate,
}: {
  certificate: CertificateListItem;
}) {
  const { downloadCertificate, isDownloading } = useCertificateDownload();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  const style = classificationStyles(certificate.classification);
  const verifyPath = `/verify/${certificate.certificate_id}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${verifyPath}`,
      );
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 1500);
    }
  };

  const handleDownload = async () => {
    try {
      await downloadCertificate(certificate.certificate_id);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Failed to download certificate.",
      );
    }
  };

  return (
    <div
      className="rounded-md border bg-white shadow-sm"
      style={{ borderColor: colors.surface[200] }}
    >
      <div
        className="flex items-start justify-between gap-4 border-b px-5 py-4"
        style={{ borderColor: colors.surface[200] }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-md"
              style={{ background: brand.bgNavActive, color: colors.brand }}
            >
              <ShieldCheckIcon />
            </span>
            <div className="min-w-0">
              <h3
                className="truncate text-[14px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                {certificate.title}
              </h3>
              <p
                className="mt-0.5 text-[12px]"
                style={{ color: colors.text.secondary }}
              >
                {certificate.created_at}
                {certificate.course_name ? ` · ${certificate.course_name}` : ""}
              </p>
            </div>
          </div>
        </div>

        <span
          className="rounded-md border px-2.5 py-1 text-[11px] font-semibold"
          style={{
            background: style.background,
            color: style.color,
            borderColor: style.borderColor,
          }}
        >
          {style.label}
        </span>
      </div>

      <div className="grid gap-3 px-5 py-4 sm:grid-cols-4">
        {[
          ["Confidence", `${certificate.confidence}%`],
          ["WPM", certificate.wpm],
          ["Duration", `${certificate.duration_seconds}s`],
          ["Risk", certificate.risk_level],
        ].map(([label, value]) => (
          <div key={label}>
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
              {value}
            </p>
          </div>
        ))}
      </div>

      <div
        className="border-t px-5 py-3"
        style={{ borderColor: colors.surface[200] }}
      >
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: colors.text.secondary }}
        >
          Certificate ID
        </p>
        <p
          className="mt-1 break-all font-mono text-[12px]"
          style={{ color: colors.text.primary }}
        >
          {certificate.certificate_id}
        </p>

        <p
          className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: colors.text.secondary }}
        >
          Document Hash
        </p>
        <p
          className="mt-1 break-all font-mono text-[11px]"
          style={{ color: colors.text.secondary }}
        >
          {certificate.document_hash}
        </p>
      </div>

      <div
        className="flex flex-wrap gap-2 border-t px-5 py-4"
        style={{ borderColor: colors.surface[200] }}
      >
        <button
          type="button"
          onClick={handleDownload}
          disabled={isDownloading}
          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-60"
          style={{ background: colors.brand }}
        >
          <DownloadIcon />
          {isDownloading ? "Downloading..." : "Download PDF"}
        </button>

        <Link
          to={verifyPath}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[12px] font-semibold"
          style={{
            borderColor: colors.surface[200],
            color: colors.text.primary,
          }}
        >
          <ExternalIcon />
          Verify
        </Link>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[12px] font-semibold"
          style={{
            borderColor: colors.surface[200],
            color: colors.text.primary,
          }}
        >
          <CopyIcon />
          {copyState === "copied"
            ? "Copied"
            : copyState === "error"
              ? "Failed"
              : "Copy Link"}
        </button>
      </div>
    </div>
  );
}

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<CertificateListItem[]>([]);
  const [filter, setFilter] = useState<
    "ALL" | "HUMAN" | "SUSPICIOUS" | "SYNTHETIC"
  >("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadCertificates() {
      setIsLoading(true);
      setApiError(null);

      try {
        const response =
          await api.get<CertificateListResponse>("/certificates");

        if (!mounted) return;
        setCertificates(response.data.certificates || []);
      } catch (error) {
        if (!mounted) return;
        setApiError(getApiErrorMessage(error));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadCertificates();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredCertificates = useMemo(() => {
    if (filter === "ALL") return certificates;

    return certificates.filter((certificate) => {
      const normalized = certificate.classification.toUpperCase();

      if (filter === "SYNTHETIC") {
        return normalized === "SYNTHETIC" || normalized === "AI-GENERATED";
      }

      return normalized === filter;
    });
  }, [certificates, filter]);

  return (
    <div
      className="min-h-screen px-6 py-8"
      style={{ background: colors.surface[50] }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p
              className="text-[12px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: colors.text.secondary }}
            >
              TypeTrace certificates
            </p>
            <h1
              className="mt-2 text-2xl font-semibold"
              style={{ color: colors.text.primary }}
            >
              Authorship Certificates
            </h1>
            <p
              className="mt-2 max-w-2xl text-[14px]"
              style={{ color: colors.text.secondary }}
            >
              Download cryptographic PDF certificates and share public
              verification links with teachers or institutions.
            </p>
          </div>

          <Link
            to={ROUTES.EDITOR_NEW}
            className="rounded-md px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: colors.brand }}
          >
            Create new certificate
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {[
            ["Total", certificates.length],
            [
              "Human",
              certificates.filter((c) => c.classification === "HUMAN").length,
            ],
            [
              "Review",
              certificates.filter((c) => c.classification === "SUSPICIOUS")
                .length,
            ],
            [
              "High Risk",
              certificates.filter((c) =>
                ["SYNTHETIC", "AI-GENERATED", "AI"].includes(c.classification),
              ).length,
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-md border bg-white px-4 py-3"
              style={{ borderColor: colors.surface[200] }}
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: colors.text.secondary }}
              >
                {label}
              </p>
              <p
                className="mt-1 text-xl font-semibold"
                style={{ color: colors.text.primary }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {(["ALL", "HUMAN", "SUSPICIOUS", "SYNTHETIC"] as const).map(
            (item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className="rounded-md border px-3 py-2 text-[12px] font-semibold"
                style={{
                  borderColor:
                    filter === item ? colors.brand : colors.surface[200],
                  background: filter === item ? brand.bgNavActive : "#FFFFFF",
                  color: filter === item ? colors.brand : colors.text.secondary,
                }}
              >
                {item === "ALL"
                  ? "All"
                  : item === "SYNTHETIC"
                    ? "High Risk"
                    : item}
              </button>
            ),
          )}
        </div>

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

        {isLoading ? (
          <div
            className="mt-6 rounded-md border bg-white px-5 py-10 text-center text-[13px]"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.secondary,
            }}
          >
            Loading certificates...
          </div>
        ) : filteredCertificates.length === 0 ? (
          <div
            className="mt-6 rounded-md border bg-white px-5 py-10 text-center"
            style={{ borderColor: colors.surface[200] }}
          >
            <h2
              className="text-[15px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              No certificates found
            </h2>
            <p
              className="mt-2 text-[13px]"
              style={{ color: colors.text.secondary }}
            >
              Complete a writing session to generate your first TypeTrace
              certificate.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {filteredCertificates.map((certificate) => (
              <CertificateCard
                key={certificate.certificate_id}
                certificate={certificate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
