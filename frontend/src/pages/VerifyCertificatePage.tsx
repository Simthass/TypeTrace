import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";

import { useToast } from "../components/ui/ToastProvider";
import { API_ROUTES } from "../constants/apiRoutes";
import { ROUTES } from "../constants/routes";
import { API_BASE_URL, api, getApiErrorMessage } from "../lib/api";
import { isValidCertificateId, normalizeCertificateId } from "../lib/edgeCases";
import { brand, colors } from "../styles/colors";
import type { PublicCertificateVerification } from "../types/certificate";

function Icon({
  name,
  size = 16,
}: {
  name:
    | "arrowLeft"
    | "certificate"
    | "check"
    | "copy"
    | "download"
    | "file"
    | "hash"
    | "lock"
    | "search"
    | "shield"
    | "warning";
  size?: number;
}) {
  const paths: Record<string, ReactNode> = {
    arrowLeft: (
      <>
        <path d="M19 12H5" />
        <path d="m11 6-6 6 6 6" />
      </>
    ),
    certificate: (
      <>
        <path d="M7 3h8l4 4v14H7z" />
        <path d="M15 3v5h5" />
        <path d="M10 13h6M10 17h4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    copy: (
      <>
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
    download: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="M7 10l5 5 5-5" />
        <path d="M12 15V3" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
        <path d="M14 2v5h5" />
      </>
    ),
    hash: (
      <>
        <path d="M10 3 8 21M16 3l-2 18" />
        <path d="M4 9h17M3 15h17" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    warning: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function formatDuration(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return "Not recorded";

  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function statusMeta(status?: string) {
  const normalized = String(status || "").toUpperCase();

  if (normalized === "VALID") {
    return {
      label: "Valid certificate",
      eyebrow: "Ledger match found",
      description:
        "This certificate exists in the TypeTrace ledger and is linked to a recorded writing session.",
      background: brand.humanBg,
      color: brand.humanText,
      border: brand.humanAccent,
      icon: "shield" as const,
    };
  }

  if (normalized === "REVIEW_REQUIRED") {
    return {
      label: "Review required",
      eyebrow: "Certificate found",
      description:
        "The certificate exists, but the writing behavior should be reviewed by an academic staff member.",
      background: brand.suspiciousBg,
      color: brand.suspiciousText,
      border: brand.suspiciousAccent,
      icon: "warning" as const,
    };
  }

  if (normalized === "INVALID") {
    return {
      label: "Not found",
      eyebrow: "No ledger match",
      description:
        "TypeTrace could not find a certificate record for the supplied ID.",
      background: colors.surface[100],
      color: colors.text.secondary,
      border: colors.surface[200],
      icon: "warning" as const,
    };
  }

  return {
    label: "High risk evidence",
    eyebrow: "Certificate found",
    description:
      "The certificate exists, but the recorded session contains high-risk writing-process evidence.",
    background: brand.aiBg,
    color: brand.aiText,
    border: brand.aiAccent,
    icon: "warning" as const,
  };
}

function InfoCell({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
}) {
  return (
    <div
      className="min-w-0 rounded-md border p-4"
      style={{
        background: colors.surface[50],
        borderColor: colors.surface[200],
      }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: colors.text.muted }}
      >
        {label}
      </p>
      <p
        className={`mt-2 break-words text-[14px] font-semibold ${mono ? "font-mono" : ""}`}
        style={{ color: colors.text.primary }}
      >
        {value || "Not provided"}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div
      className="rounded-md border p-4"
      style={{
        background: colors.surface[50],
        borderColor: colors.surface[200],
      }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: colors.text.muted }}
      >
        {label}
      </p>
      <p
        className="mt-3 text-[28px] font-bold tabular-nums tracking-[-0.06em]"
        style={{ color: colors.text.primary }}
      >
        {value}
      </p>
      <p className="mt-1 text-[12px]" style={{ color: colors.text.secondary }}>
        {sub}
      </p>
    </div>
  );
}

function CopyButton({
  value,
  label,
}: {
  value?: string | null;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!value}
      className="inline-flex h-8 items-center justify-center gap-2 rounded-md border px-3 text-[12px] font-bold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        background: copied ? brand.humanBg : colors.surface[50],
        borderColor: copied ? brand.humanAccent : colors.surface[200],
        color: copied ? brand.humanText : colors.text.primary,
      }}
    >
      <Icon name={copied ? "check" : "copy"} size={13} />
      {copied ? "Copied" : label}
    </button>
  );
}

function LoadingPanel() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:px-8">
      <div
        className="overflow-hidden rounded-md border"
        style={{
          background: colors.surface[50],
          borderColor: colors.surface[200],
          boxShadow: `0 1px 3px ${colors.shadow}`,
        }}
      >
        <div
          className="h-1 animate-pulse"
          style={{ background: colors.brand }}
        />
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div
              className="h-8 w-48 animate-pulse rounded-md"
              style={{ background: colors.surface[200] }}
            />
            <div
              className="h-20 animate-pulse rounded-md"
              style={{ background: colors.surface[100] }}
            />
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-24 animate-pulse rounded-md"
                  style={{ background: colors.surface[100] }}
                />
              ))}
            </div>
          </div>
          <div
            className="h-72 animate-pulse rounded-md"
            style={{ background: colors.surface[100] }}
          />
        </div>
      </div>
    </div>
  );
}

function ErrorPanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 lg:px-8">
      <div
        className="rounded-md border p-8 text-center"
        style={{
          background: colors.surface[50],
          borderColor: colors.surface[200],
          boxShadow: `0 1px 3px ${colors.shadow}`,
        }}
      >
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-md"
          style={{ background: brand.aiBg, color: brand.aiText }}
        >
          <Icon name="warning" size={20} />
        </div>
        <h1
          className="mt-5 text-[24px] font-bold tracking-[-0.04em]"
          style={{ color: colors.text.primary }}
        >
          {title}
        </h1>
        <p
          className="mx-auto mt-3 max-w-xl text-[14px] leading-7"
          style={{ color: colors.text.secondary }}
        >
          {message}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to={ROUTES.VERIFY_LOOKUP}
            className="inline-flex h-10 items-center justify-center rounded-md px-4 text-[13px] font-bold"
            style={{ background: colors.brand, color: colors.text.light }}
          >
            Verify another certificate
          </Link>
          <Link
            to={ROUTES.HOME}
            className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-[13px] font-bold"
            style={{
              background: colors.surface[50],
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          >
            Back to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyCertificatePage() {
  const { certId } = useParams<{ certId: string }>();
  const { showToast } = useToast();
  const shouldReduceMotion = useReducedMotion();

  const [result, setResult] = useState<PublicCertificateVerification | null>(
    null,
  );
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const cleanCertId = useMemo(
    () => normalizeCertificateId(certId || ""),
    [certId],
  );

  useEffect(() => {
    let mounted = true;

    async function verify() {
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
          API_ROUTES.certificates.verifyPublic(cleanCertId),
          { skipGlobalToast: true },
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
  }, [cleanCertId, showToast]);

  if (isLoading) return <LoadingPanel />;

  if (apiError) {
    return (
      <ErrorPanel title="Certificate verification failed" message={apiError} />
    );
  }

  if (!result) {
    return (
      <ErrorPanel
        title="No verification result"
        message="TypeTrace could not load a certificate result for this request."
      />
    );
  }

  const meta = statusMeta(result.status);

  if (!result.valid) {
    return (
      <section
        className="px-5 py-16 sm:px-6 lg:px-8"
        style={{ background: colors.surface[50] }}
      >
        <div className="mx-auto max-w-4xl">
          <div
            className="rounded-md border p-8"
            style={{
              background: colors.surface[50],
              borderColor: colors.surface[200],
              boxShadow: `0 1px 3px ${colors.shadow}`,
            }}
          >
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md"
                  style={{ background: meta.background, color: meta.color }}
                >
                  <Icon name={meta.icon} size={20} />
                </div>
                <div>
                  <p
                    className="text-[11px] font-bold uppercase tracking-[0.16em]"
                    style={{ color: colors.text.muted }}
                  >
                    {meta.eyebrow}
                  </p>
                  <h1
                    className="mt-2 text-[30px] font-bold tracking-[-0.05em]"
                    style={{ color: colors.text.primary }}
                  >
                    Certificate not found
                  </h1>
                  <p
                    className="mt-3 max-w-2xl text-[14px] leading-7"
                    style={{ color: colors.text.secondary }}
                  >
                    {result.reason ||
                      "This certificate ID was not found in the TypeTrace ledger."}
                  </p>
                </div>
              </div>
              <span
                className="w-fit rounded-md border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em]"
                style={{
                  background: meta.background,
                  borderColor: meta.border,
                  color: meta.color,
                }}
              >
                Invalid
              </span>
            </div>

            <div
              className="mt-8 rounded-md border p-4"
              style={{
                background: colors.surface[100],
                borderColor: colors.surface[200],
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: colors.text.muted }}
              >
                Queried certificate ID
              </p>
              <p
                className="mt-2 break-all font-mono text-[13px] font-bold"
                style={{ color: colors.text.primary }}
              >
                {result.certificate_id || cleanCertId}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                to={ROUTES.VERIFY_LOOKUP}
                className="inline-flex h-10 items-center justify-center rounded-md px-4 text-[13px] font-bold"
                style={{ background: colors.brand, color: colors.text.light }}
              >
                Verify another certificate
              </Link>
              <Link
                to={ROUTES.HOME}
                className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-[13px] font-bold"
                style={{
                  background: colors.surface[50],
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              >
                Back to homepage
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const certificateUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/${encodeURIComponent(
          result.certificate_id,
        )}`
      : result.verify_url || `/verify/${result.certificate_id}`;

  const pdfUrl = `${API_BASE_URL}${API_ROUTES.certificates.pdf(
    result.certificate_id,
  )}`;

  const confidence = Number(result.confidence || 0);

  return (
    <section
      className="relative overflow-hidden px-5 py-10 sm:px-6 lg:px-8"
      style={{ background: colors.surface[50] }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[360px] w-[620px] -translate-x-1/2 rounded-md"
        style={{
          background: colors.brandSoft,
          filter: "blur(92px)",
          opacity: 0.66,
        }}
      />

      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
        animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-7xl"
      >
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to={ROUTES.VERIFY_LOOKUP}
            className="inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-[13px] font-bold transition hover:brightness-95"
            style={{
              background: colors.surface[50],
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          >
            <Icon name="arrowLeft" size={14} />
            Verify another
          </Link>

          <div className="flex flex-wrap gap-2">
            <CopyButton value={certificateUrl} label="Copy link" />
            <a
              href={pdfUrl}
              className="inline-flex h-8 items-center justify-center gap-2 rounded-md px-3 text-[12px] font-bold transition hover:brightness-110"
              style={{ background: colors.brand, color: colors.text.light }}
            >
              <Icon name="download" size={13} />
              PDF
            </a>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <main
            className="overflow-hidden rounded-md border"
            style={{
              background: colors.surface[50],
              borderColor: colors.surface[200],
              boxShadow: `0 1px 3px ${colors.shadow}`,
            }}
          >
            <div
              className="border-b p-6 md:p-8"
              style={{
                background: colors.surface[50],
                borderColor: colors.surface[200],
              }}
            >
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p
                    className="text-[11px] font-bold uppercase tracking-[0.16em]"
                    style={{ color: colors.brand }}
                  >
                    TypeTrace certificate result
                  </p>
                  <h1
                    className="mt-3 max-w-3xl text-[34px] font-bold leading-tight tracking-[-0.055em] md:text-[46px]"
                    style={{ color: colors.text.primary }}
                  >
                    {result.title || "Writing Evidence Certificate"}
                  </h1>
                  <p
                    className="mt-4 max-w-2xl text-[15px] leading-7"
                    style={{ color: colors.text.secondary }}
                  >
                    This public page confirms the certificate record, document
                    integrity hash, and privacy-safe session metadata. It does
                    not expose essay text or raw keystroke data.
                  </p>
                </div>

                <span
                  className="inline-flex w-fit items-center gap-2 rounded-md border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em]"
                  style={{
                    background: meta.background,
                    borderColor: meta.border,
                    color: meta.color,
                  }}
                >
                  <Icon name={meta.icon} size={13} />
                  {meta.label}
                </span>
              </div>
            </div>

            <div className="p-6 md:p-8">
              <div className="grid gap-4 md:grid-cols-4">
                <MetricCard
                  label="Human Writing Evidence Score"
                  value={`${confidence}%`}
                  sub="Behavioral evidence score"
                />
                <MetricCard
                  label="Words"
                  value={result.word_count || 0}
                  sub="Submitted document length"
                />
                <MetricCard
                  label="WPM"
                  value={result.wpm || 0}
                  sub="Recorded writing speed"
                />
                <MetricCard
                  label="Duration"
                  value={formatDuration(result.duration_seconds)}
                  sub="Captured session time"
                />
              </div>

              <div
                className="mt-6 rounded-md border p-5"
                style={{
                  background: colors.surface[100],
                  borderColor: colors.surface[200],
                }}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.14em]"
                      style={{ color: colors.text.muted }}
                    >
                      Decision
                    </p>
                    <p
                      className="mt-2 text-[20px] font-bold tracking-[-0.04em]"
                      style={{ color: colors.text.primary }}
                    >
                      {result.classification_label ||
                        result.classification ||
                        "Unknown"}
                    </p>
                  </div>
                  <div className="min-w-0 md:w-[240px]">
                    <div
                      className="h-2 overflow-hidden rounded-md"
                      style={{ background: colors.surface[200] }}
                    >
                      <div
                        className="h-full rounded-md"
                        style={{
                          width: `${Math.max(0, Math.min(100, confidence))}%`,
                          background: colors.brand,
                        }}
                      />
                    </div>
                    <p
                      className="mt-2 text-right text-[12px] font-medium"
                      style={{ color: colors.text.secondary }}
                    >
                      {confidence}% confidence
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <InfoCell
                  label="Certificate ID"
                  value={result.certificate_id}
                  mono
                />
                <InfoCell label="Student" value={result.student_name} />
                <InfoCell
                  label="Student ID"
                  value={result.student_id || "Not publicly shown"}
                  mono
                />
                <InfoCell
                  label="Institution"
                  value={result.university_name || "Not provided"}
                />
                <InfoCell
                  label="Course"
                  value={result.course_name || "Personal session"}
                />
                <InfoCell
                  label="Course code"
                  value={result.course_code || "Not provided"}
                  mono
                />
                <InfoCell label="Risk level" value={result.risk_level} />
                <InfoCell label="Review status" value={result.review_status} />
                <InfoCell label="Created" value={result.created_at} />
                <InfoCell label="Generated" value={result.generated_at} />
              </div>

              <div
                className="mt-6 rounded-md border p-5"
                style={{
                  background: colors.brandSoft,
                  borderColor: colors.surface[200],
                }}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span style={{ color: colors.brand }}>
                        <Icon name="hash" size={16} />
                      </span>
                      <p
                        className="text-[10px] font-bold uppercase tracking-[0.14em]"
                        style={{ color: colors.brand }}
                      >
                        Document integrity hash
                      </p>
                    </div>
                    <p
                      className="mt-3 break-all font-mono text-[12px] font-semibold leading-6"
                      style={{ color: colors.text.primary }}
                    >
                      {result.document_hash || "Not available"}
                    </p>
                  </div>
                  <CopyButton value={result.document_hash} label="Copy hash" />
                </div>
              </div>
            </div>
          </main>

          <aside className="space-y-5">
            <div
              className="rounded-md border p-5"
              style={{
                background: colors.text.primary,
                borderColor: colors.text.primary,
                boxShadow: `0 1px 3px ${colors.shadowStrong}`,
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                  style={{
                    background: colors.surface[50],
                    color: colors.brand,
                  }}
                >
                  <Icon name="lock" size={18} />
                </span>
                <div>
                  <p
                    className="text-[13px] font-bold"
                    style={{ color: colors.text.light }}
                  >
                    Privacy-safe public record
                  </p>
                  <p
                    className="mt-2 text-[12px] leading-6"
                    style={{ color: colors.surface[300] }}
                  >
                    This page can confirm certificate status, timestamps, course
                    metadata, and hash integrity without showing private essay
                    text or raw keystroke evidence.
                  </p>
                </div>
              </div>
            </div>

            <div
              className="rounded-md border p-5"
              style={{
                background: colors.surface[50],
                borderColor: colors.surface[200],
                boxShadow: `0 1px 3px ${colors.shadow}`,
              }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-[0.14em]"
                style={{ color: colors.text.muted }}
              >
                Ledger state
              </p>
              <div className="mt-4 space-y-3">
                {[
                  ["Certificate", meta.label],
                  ["Ledger", result.ledger_status || "Session recorded"],
                  ["Verification URL", result.verify_url || certificateUrl],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-md border p-3"
                    style={{
                      background: colors.surface[100],
                      borderColor: colors.surface[200],
                    }}
                  >
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.14em]"
                      style={{ color: colors.text.muted }}
                    >
                      {label}
                    </p>
                    <p
                      className="mt-2 break-all text-[12px] font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-md border p-5"
              style={{
                background: colors.surface[50],
                borderColor: colors.surface[200],
              }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-[0.14em]"
                style={{ color: colors.text.muted }}
              >
                Actions
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <a
                  href={pdfUrl}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-[13px] font-bold transition hover:brightness-110"
                  style={{ background: colors.brand, color: colors.text.light }}
                >
                  <Icon name="download" size={14} />
                  Download certificate PDF
                </a>
                <Link
                  to={ROUTES.VERIFY_LOOKUP}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-[13px] font-bold transition hover:brightness-95"
                  style={{
                    background: colors.surface[50],
                    borderColor: colors.surface[200],
                    color: colors.text.primary,
                  }}
                >
                  <Icon name="search" size={14} />
                  Verify another certificate
                </Link>
              </div>
            </div>

            <div
              className="rounded-md border p-5"
              style={{
                background: colors.surface[100],
                borderColor: colors.surface[200],
              }}
            >
              <p
                className="text-[12px] font-semibold leading-6"
                style={{ color: colors.text.secondary }}
              >
                TypeTrace provides behavioral authorship evidence to support
                academic review. It does not claim absolute proof of authorship.
              </p>
            </div>
          </aside>
        </div>
      </motion.div>
    </section>
  );
}
