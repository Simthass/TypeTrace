import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";

import { useToast } from "../components/ui/ToastContext";
import { API_ROUTES } from "../constants/apiRoutes";
import { ROUTES } from "../constants/routes";
import { API_BASE_URL, api, getApiErrorMessage } from "../lib/api";
import { isValidCertificateId, normalizeCertificateId } from "../lib/edgeCases";
import { shortId } from "../lib/documentMetadata";
import { usePageTitle } from "../hooks/usePageTitle";
import { colors } from "../styles/colors";
import {
  PublicShell,
  SectionEyebrow,
} from "../components/public/PublicVisualSystem";
import type { PublicCertificateVerification } from "../types/certificate";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

function formatDuration(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

// ─── Icon primitives ──────────────────────────────────────────────────────────

function Icon({
  name,
  size = 16,
  style,
}: {
  name:
    | "arrowLeft"
    | "check"
    | "copy"
    | "download"
    | "file"
    | "hash"
    | "lock"
    | "search"
    | "shield"
    | "warning"
    | "clock"
    | "user"
    | "building"
    | "bookOpen"
    | "externalLink"
    | "activity"
    | "chevronRight"
    | "x"
    | "alertTriangle";
  size?: number;
  style?: CSSProperties;
}) {
  const paths: Record<string, ReactNode> = {
    arrowLeft: (
      <>
        <path d="M19 12H5" />
        <path d="m11 6-6 6 6 6" />
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
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </>
    ),
    user: (
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    building: (
      <>
        <path d="M6 2h12v20H6z" />
        <path d="M9 6h6M9 10h6M9 14h3" />
      </>
    ),
    bookOpen: (
      <>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </>
    ),
    externalLink: (
      <>
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <path d="m15 3 6 6-6 6" />
        <path d="M21 3h-6v6" />
      </>
    ),
    activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    x: (
      <>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </>
    ),
    alertTriangle: (
      <>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
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
      style={style}
    >
      {paths[name]}
    </svg>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({
  value,
  label,
}: {
  value?: string | null;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.warn("Unable to copy certificate value.", error);
    }
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!value}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-all duration-150 hover:bg-surface-200 disabled:opacity-30"
      style={{ color: colors.text.secondary }}
    >
      <Icon name={copied ? "check" : "copy"} size={11} />
      {copied ? "Copied" : label || "Copy"}
    </button>
  );
}

// ─── Loading state ────────────────────────────────────────────────────────────

function LoadingPanel() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-[75px] py-32">
        <div className="space-y-8">
          <div
            className="h-5 w-40 animate-pulse rounded"
            style={{ background: colors.surface[200] }}
          />
          <div
            className="h-12 w-96 animate-pulse rounded"
            style={{ background: colors.surface[200] }}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div
              className="h-64 animate-pulse rounded-2xl"
              style={{ background: colors.surface[100] }}
            />
            <div
              className="h-64 animate-pulse rounded-2xl"
              style={{ background: colors.surface[100] }}
            />
          </div>
        </div>
      </div>
    </PublicShell>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorPanel({ title, message }: { title: string; message: string }) {
  return (
    <PublicShell>
      <div className="mx-auto max-w-lg px-[75px] py-32 text-center">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{
            background: withAlpha(colors.red, "0.06"),
            color: colors.red,
          }}
        >
          <Icon name="x" size={24} />
        </div>
        <h1
          className="mt-6 text-xl font-semibold tracking-[-0.03em]"
          style={{ color: colors.text.primary }}
        >
          {title}
        </h1>
        <p
          className="mt-3 text-[14px] leading-7"
          style={{ color: colors.text.secondary }}
        >
          {message}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            to={ROUTES.VERIFY_LOOKUP}
            className="inline-flex h-11 items-center rounded-lg px-5 text-[14px] font-semibold transition hover:opacity-90"
            style={{ background: colors.brand, color: colors.text.light }}
          >
            Verify another certificate
          </Link>
          <Link
            to={ROUTES.HOME}
            className="inline-flex h-11 items-center rounded-lg border px-5 text-[14px] font-semibold transition hover:bg-surface-100"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          >
            Home
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

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
        if (!response.data.record_found) {
          showToast({
            type: "warning",
            title: "Certificate not found",
            message:
              response.data.reason || "This certificate ID was not found.",
          });
        } else if (!response.data.certificate_active) {
          showToast({
            type: "warning",
            title: response.data.status.replaceAll("_", " "),
            message:
              response.data.ledger_reason ||
              "This certificate record is not currently active.",
          });
        }
      } catch (error) {
        if (!mounted) return;
        const message = getApiErrorMessage(error);
        setApiError(message);
        showToast({ type: "error", title: "Verification failed", message });
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    void verify();
    return () => {
      mounted = false;
    };
  }, [cleanCertId, showToast]);

  // ─── Dynamic page title ──────────────────────────────────────────────────────
  const pageTitle = useMemo(() => {
    const displayId = shortId(result?.certificate_id || cleanCertId);

    if (isLoading) {
      return displayId
        ? `Verifying Certificate ${displayId}`
        : "Verifying Certificate";
    }
    if (apiError || !result || !result.record_found) {
      return displayId
        ? `Certificate Not Found ${displayId}`
        : "Certificate Not Found";
    }
    if (result.status === "VALID") {
      return displayId
        ? `Verified Certificate ${displayId}`
        : "Verified Certificate";
    }
    if (result.status === "REVIEW_REQUIRED") {
      return displayId
        ? `Certificate Review Required ${displayId}`
        : "Certificate Review Required";
    }
    return displayId
      ? `Certificate Verification ${displayId}`
      : "Certificate Verification";
  }, [apiError, cleanCertId, isLoading, result]);

  const pageDescription = useMemo(() => {
    if (isLoading)
      return "TypeTrace is checking the public certificate ledger for this authorship evidence record.";
    if (apiError || !result || !result.record_found)
      return "This certificate ID could not be verified in the TypeTrace public ledger.";
    return `${result.classification_label || "Writing evidence"} for ${result.title || "Untitled Document"}. Public verification does not expose essay text or raw keystroke evidence.`;
  }, [apiError, isLoading, result]);

  usePageTitle({ title: pageTitle, description: pageDescription });

  if (isLoading) return <LoadingPanel />;
  if (apiError)
    return <ErrorPanel title="Verification failed" message={apiError} />;
  if (!result)
    return (
      <ErrorPanel
        title="No result"
        message="Could not load a certificate result."
      />
    );

  const rawEvidenceScore = Number(
    result.human_evidence_score ?? result.confidence ?? 0,
  );
  const confidence = Number.isFinite(rawEvidenceScore)
    ? Math.max(
        0,
        Math.min(
          100,
          rawEvidenceScore <= 1 ? rawEvidenceScore * 100 : rawEvidenceScore,
        ),
      )
    : 0;
  const confidenceLabel = `${Math.round(confidence)}%`;
  const ledgerVerified = result.ledger_verified !== false;
  const signatureLabel =
    result.signature_status || result.ledger_status || "Unknown";
  const signatureColor = ledgerVerified ? colors.green : colors.red;
  const signatureBg = ledgerVerified
    ? withAlpha(colors.green, "0.06")
    : withAlpha(colors.red, "0.06");
  const certificateUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/${encodeURIComponent(result.certificate_id)}`
      : `/verify/${result.certificate_id}`;
  const pdfUrl = `${API_BASE_URL}${API_ROUTES.certificates.pdf(result.certificate_id)}`;

  // Determine decision styling
  const decisionLabel =
    result.classification_label || result.classification || "Unknown";
  const normalizedDecisionLabel = decisionLabel.toLowerCase();
  const normalizedClassification = String(
    result.classification || "",
  ).toUpperCase();
  const normalizedRiskLevel = String(result.risk_level || "").toUpperCase();

  const isSynthetic =
    normalizedClassification === "SYNTHETIC" ||
    normalizedClassification === "AI" ||
    normalizedClassification === "AI-GENERATED" ||
    normalizedDecisionLabel.includes("synthetic") ||
    normalizedDecisionLabel.includes("ai") ||
    normalizedDecisionLabel.includes("generated") ||
    normalizedDecisionLabel.includes("high risk") ||
    normalizedRiskLevel === "HIGH";
  const isReviewRequired =
    !isSynthetic &&
    (normalizedClassification === "SUSPICIOUS" ||
      normalizedDecisionLabel.includes("review") ||
      normalizedDecisionLabel.includes("suspicious") ||
      result.status === "REVIEW_REQUIRED" ||
      normalizedRiskLevel === "MEDIUM");
  const isHumanWritten =
    !isSynthetic &&
    !isReviewRequired &&
    (normalizedClassification === "HUMAN" ||
      normalizedDecisionLabel.includes("human") ||
      normalizedDecisionLabel.includes("original") ||
      result.status === "VALID");

  const decisionColor = isHumanWritten
    ? colors.green
    : isReviewRequired
      ? colors.amber
      : isSynthetic
        ? colors.red
        : colors.text.primary;
  const decisionBg = isHumanWritten
    ? withAlpha(colors.green, "0.06")
    : isSynthetic
      ? withAlpha(colors.red, "0.06")
      : isReviewRequired
        ? withAlpha(colors.amber, "0.06")
        : colors.surface[100];
  const decisionBorder = isHumanWritten
    ? withAlpha(colors.green, "0.2")
    : isSynthetic
      ? withAlpha(colors.red, "0.2")
      : isReviewRequired
        ? withAlpha(colors.amber, "0.2")
        : colors.surface[200];
  const decisionIcon = isHumanWritten
    ? ("shield" as const)
    : isSynthetic
      ? ("alertTriangle" as const)
      : ("warning" as const);

  // Invalid state
  if (!result.record_found) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-lg px-[75px] py-32 text-center">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{
              background: withAlpha(colors.red, "0.06"),
              color: colors.red,
            }}
          >
            <Icon name="x" size={24} />
          </div>
          <h1
            className="mt-6 text-2xl font-semibold tracking-[-0.04em]"
            style={{ color: colors.text.primary }}
          >
            Certificate not found
          </h1>
          <p
            className="mt-3 text-[14px] leading-7"
            style={{ color: colors.text.secondary }}
          >
            {result.reason ||
              "This certificate ID was not found in the TypeTrace ledger."}
          </p>
          <div
            className="mt-6 inline-flex items-center gap-2 rounded-xl border px-5 py-3 font-mono text-[13px]"
            style={{
              borderColor: colors.surface[200],
              background: colors.surface[100],
              color: colors.text.primary,
            }}
          >
            {result.certificate_id || cleanCertId}
            <CopyButton value={result.certificate_id || cleanCertId} />
          </div>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              to={ROUTES.VERIFY_LOOKUP}
              className="inline-flex h-11 items-center rounded-lg px-5 text-[14px] font-semibold transition hover:opacity-90"
              style={{ background: colors.brand, color: colors.text.light }}
            >
              Verify another
            </Link>
            <Link
              to={ROUTES.HOME}
              className="inline-flex h-11 items-center rounded-lg border px-5 text-[14px] font-semibold transition hover:bg-surface-100"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
              }}
            >
              Home
            </Link>
          </div>
        </div>
      </PublicShell>
    );
  }

  // Valid state — premium redesign
  return (
    <PublicShell>
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
        animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="px-[75px] py-10 mt-10"
      >
        {/* Top navigation bar */}
        <div className="mb-10 flex items-center justify-between">
          <Link
            to={ROUTES.VERIFY_LOOKUP}
            className="group inline-flex items-center gap-2 text-[14px] font-medium transition-colors duration-150"
            style={{ color: colors.text.secondary }}
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150 group-hover:bg-surface-200"
              style={{ background: colors.surface[100] }}
            >
              <Icon name="arrowLeft" size={15} />
            </span>
            Certificate lookup
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                if (!certificateUrl) return;
                try {
                  await navigator.clipboard.writeText(certificateUrl);
                } catch (error) {
                  showToast({
                    type: "error",
                    title: "Copy failed",
                    message: "The certificate link could not be copied.",
                  });
                  console.warn("Unable to copy certificate link.", error);
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[13px] font-semibold transition-all duration-150 hover:bg-surface-100"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
              }}
            >
              <Icon name="copy" size={14} />
              Copy link
            </button>
            <a
              href={pdfUrl}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-all duration-150 hover:opacity-90"
              style={{ background: colors.brand, color: colors.text.light }}
            >
              <Icon name="download" size={14} />
              Export PDF
            </a>
          </div>
        </div>

        {/* Hero header */}
        <div className="mb-12">
          <SectionEyebrow>
            {result.certificate_active
              ? "Certificate record verified"
              : result.status.replaceAll("_", " ")}
          </SectionEyebrow>
          <h1
            className="mt-3 text-[2.1rem] font-bold leading-[1.08] tracking-[-0.045em] sm:text-[2.8rem] sm:leading-[1.05] md:text-[3.8rem]"
            style={{ color: colors.text.primary }}
          >
            {result.title || "Writing Evidence Certificate"}
          </h1>
          <p
            className="mt-4 max-w-2xl text-[15px] leading-7"
            style={{ color: colors.text.secondary }}
          >
            {result.certificate_active
              ? "The signed ledger record is active and its integrity checks passed."
              : result.status === "REVOKED"
                ? "This record exists, but the owning course teacher revoked it. It must not be treated as verified evidence."
                : result.status === "INVALID_SIGNATURE"
                  ? "This record exists, but its signature or signed payload integrity check failed."
                  : "This legacy record exists without an enforceable cryptographic signature and requires manual review."}{" "}
            No essay text or raw keystroke data is exposed publicly.
          </p>
        </div>

        {result.degraded_analysis && (
          <div
            role="status"
            className="mb-6 rounded-xl border px-5 py-4 text-[13px] leading-6"
            style={{
              borderColor: withAlpha(colors.amber, "0.35"),
              background: withAlpha(colors.amber, "0.08"),
              color: colors.text.primary,
            }}
          >
            <strong>Degraded analysis:</strong> the trained model was not used.
            This record was produced by documented fallback rules and requires
            manual academic review.
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid min-w-0 gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
          {/* Left column — evidence details */}
          <div className="space-y-6">
            {/* Session info card */}
            <div
              className="rounded-2xl border p-4 sm:p-6"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[50],
              }}
            >
              <h2
                className="text-[11px] font-bold uppercase tracking-[0.16em] mb-5"
                style={{ color: colors.text.muted }}
              >
                Session information
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    icon: "user" as const,
                    label: "Student",
                    value: result.student_name || "—",
                  },
                  {
                    icon: "building" as const,
                    label: "Institution",
                    value: result.university_name || "—",
                  },
                  {
                    icon: "bookOpen" as const,
                    label: "Course",
                    value:
                      result.course_name ||
                      result.course_code ||
                      "Personal session",
                  },
                  {
                    icon: "clock" as const,
                    label: "Generated",
                    value: formatDate(result.generated_at),
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: colors.surface[100],
                        color: colors.text.secondary,
                      }}
                    >
                      <Icon name={item.icon} size={15} />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: colors.text.muted }}
                      >
                        {item.label}
                      </p>
                      <p
                        className="mt-1 truncate text-[14px] font-semibold"
                        style={{ color: colors.text.primary }}
                      >
                        {item.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Certificate ID + Hash card */}
            <div
              className="rounded-2xl border p-4 sm:p-6"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[50],
              }}
            >
              <h2
                className="text-[11px] font-bold uppercase tracking-[0.16em] mb-5"
                style={{ color: colors.text.muted }}
              >
                Cryptographic record
              </h2>
              <div className="space-y-4">
                <div
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: colors.surface[200],
                    background: colors.surface[100],
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: colors.text.muted }}
                    >
                      Certificate ID
                    </span>
                    <CopyButton value={result.certificate_id} />
                  </div>
                  <p
                    className="font-mono text-[13px] font-semibold break-all"
                    style={{ color: colors.text.primary }}
                  >
                    {result.certificate_id}
                  </p>
                </div>
                <div
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: colors.surface[200],
                    background: withAlpha(colors.brand, "0.02"),
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon
                      name="hash"
                      size={14}
                      style={{ color: colors.brand }}
                    />
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: colors.brand }}
                    >
                      Document integrity hash
                    </span>
                    <CopyButton value={result.document_hash} />
                  </div>
                  <p
                    className="font-mono text-[12px] font-semibold break-all leading-5"
                    style={{ color: colors.text.primary }}
                  >
                    {result.document_hash || "Not available"}
                  </p>
                </div>

                <div
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: colors.surface[200],
                    background: signatureBg,
                  }}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icon
                        name={ledgerVerified ? "shield" : "alertTriangle"}
                        size={14}
                        style={{ color: signatureColor }}
                      />
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: signatureColor }}
                      >
                        Signed ledger
                      </span>
                    </div>
                    <span
                      className="rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        background: colors.surface[50],
                        color: signatureColor,
                      }}
                    >
                      {signatureLabel.replaceAll("_", " ")}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: colors.text.muted }}
                        >
                          Signed payload hash
                        </span>
                        <CopyButton value={result.signed_payload_hash} />
                      </div>
                      <p
                        className="break-all font-mono text-[12px] font-semibold leading-5"
                        style={{ color: colors.text.primary }}
                      >
                        {result.signed_payload_hash ||
                          "Legacy unsigned certificate"}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 text-[11px] sm:grid-cols-2">
                      <div>
                        <p
                          className="font-bold uppercase tracking-wider"
                          style={{ color: colors.text.muted }}
                        >
                          Algorithm
                        </p>
                        <p
                          className="mt-1 font-semibold"
                          style={{ color: colors.text.primary }}
                        >
                          {result.signature_algorithm || "UNSIGNED_LEGACY"}
                        </p>
                      </div>
                      <div>
                        <p
                          className="font-bold uppercase tracking-wider"
                          style={{ color: colors.text.muted }}
                        >
                          Key ID
                        </p>
                        <p
                          className="mt-1 truncate font-semibold"
                          style={{ color: colors.text.primary }}
                        >
                          {result.signing_key_id || "—"}
                        </p>
                      </div>
                    </div>
                    <p
                      className="text-[11px] leading-5"
                      style={{ color: colors.text.secondary }}
                    >
                      {result.ledger_reason ||
                        "This certificate is checked against its signed evidence payload."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {result.audit_timeline && result.audit_timeline.length > 0 && (
              <div
                className="rounded-2xl border p-4 sm:p-6"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[50],
                }}
              >
                <h2
                  className="mb-5 text-[11px] font-bold uppercase tracking-[0.16em]"
                  style={{ color: colors.text.muted }}
                >
                  Certificate audit timeline
                </h2>
                <div className="space-y-4">
                  {result.audit_timeline.map((event, index) => {
                    const tone = String(
                      event.status || "complete",
                    ).toLowerCase();
                    const markerColor =
                      tone === "warning"
                        ? colors.amber
                        : tone === "legacy"
                          ? colors.text.muted
                          : colors.green;

                    return (
                      <div
                        key={`${event.label}-${index}`}
                        className="flex gap-3"
                      >
                        <div className="flex flex-col items-center">
                          <span
                            className="mt-1 h-2.5 w-2.5 rounded-md"
                            style={{ background: markerColor }}
                          />
                          {index < (result.audit_timeline?.length || 0) - 1 && (
                            <span
                              className="mt-2 h-full min-h-[28px] w-px"
                              style={{ background: colors.surface[200] }}
                            />
                          )}
                        </div>
                        <div className="min-w-0 pb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className="text-[13px] font-bold"
                              style={{ color: colors.text.primary }}
                            >
                              {event.label}
                            </p>
                            {event.timestamp && (
                              <span
                                className="text-[11px]"
                                style={{ color: colors.text.muted }}
                              >
                                {formatDate(event.timestamp)}
                              </span>
                            )}
                          </div>
                          <p
                            className="mt-1 text-[12px] leading-5"
                            style={{ color: colors.text.secondary }}
                          >
                            {event.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Session metrics */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Duration",
                  value: formatDuration(result.duration_seconds),
                  sub: "Active writing time",
                  icon: "clock" as const,
                },
                {
                  label: "Words",
                  value: result.word_count || "—",
                  sub: `${result.wpm || "—"} WPM`,
                  icon: "file" as const,
                },
                {
                  label: "Risk level",
                  value: result.risk_level || "—",
                  sub: result.review_status || "—",
                  icon: "activity" as const,
                },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: colors.surface[200],
                    background: colors.surface[50],
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{
                        background: colors.surface[100],
                        color: colors.text.secondary,
                      }}
                    >
                      <Icon name={metric.icon} size={14} />
                    </div>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: colors.text.muted }}
                    >
                      {metric.label}
                    </span>
                  </div>
                  <p
                    className="text-[22px] font-bold tracking-[-0.03em] tabular-nums"
                    style={{ color: colors.text.primary }}
                  >
                    {metric.value}
                  </p>
                  <p
                    className="mt-0.5 text-[11px]"
                    style={{ color: colors.text.secondary }}
                  >
                    {metric.sub}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right column — decision panel */}
          <div className="space-y-6">
            {/* Decision card — prominent */}
            <div
              className="rounded-2xl border-2 overflow-hidden"
              style={{
                borderColor: decisionBorder,
                background: colors.surface[50],
              }}
            >
              <div className="p-4 pb-4 sm:p-6 sm:pb-4">
                <h2
                  className="text-[11px] font-bold uppercase tracking-[0.16em] mb-4"
                  style={{ color: colors.text.muted }}
                >
                  Decision
                </h2>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ background: decisionBg, color: decisionColor }}
                    >
                      <Icon name={decisionIcon} size={16} />
                    </span>
                    <span
                      className="text-[28px] font-bold tracking-[-0.04em]"
                      style={{ color: decisionColor }}
                    >
                      {decisionLabel}
                    </span>
                  </div>
                  <span
                    className="text-[28px] font-bold tracking-[-0.04em] tabular-nums"
                    style={{ color: decisionColor }}
                  >
                    {confidenceLabel}
                  </span>
                </div>
                <p
                  className="text-[12px] leading-5"
                  style={{ color: colors.text.secondary }}
                >
                  {isHumanWritten
                    ? "Writing patterns consistent with original human authorship."
                    : isSynthetic
                      ? "Writing patterns indicate synthetic or AI-generated content."
                      : isReviewRequired
                        ? "Writing behavior requires academic review."
                        : "Classification based on behavioral writing signals."}
                </p>
              </div>

              {/* Confidence bar */}
              <div className="px-4 pb-2 sm:px-6">
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span style={{ color: colors.text.muted }}>
                    Human Writing Evidence Score
                  </span>
                </div>
                <div
                  className="h-3 overflow-hidden rounded-full"
                  style={{ background: colors.surface[200] }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.max(0, Math.min(100, confidence))}%`,
                    }}
                    transition={{
                      duration: 0.8,
                      ease: [0.22, 1, 0.36, 1],
                      delay: 0.2,
                    }}
                    className="h-full rounded-full"
                    style={{ background: decisionColor }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span
                    className="text-[10px]"
                    style={{ color: colors.text.muted }}
                  >
                    0%
                  </span>
                  <span
                    className="text-[10px]"
                    style={{ color: colors.text.muted }}
                  >
                    100%
                  </span>
                </div>
              </div>

              {/* Evidence breakdown */}
              <div
                className="border-t p-4 sm:p-6"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[100],
                }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-wider mb-3"
                  style={{ color: colors.text.muted }}
                >
                  What this means
                </p>
                <ul className="space-y-2">
                  {[
                    "Based on keystroke dynamics and writing rhythm",
                    "Analyzes process, not final text content",
                    "Provides supporting evidence for human review",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-[12px] leading-5"
                      style={{ color: colors.text.secondary }}
                    >
                      <span
                        className="mt-0.5 shrink-0"
                        style={{ color: decisionColor }}
                      >
                        <Icon name="check" size={11} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div
              className="rounded-2xl border p-5"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[50],
              }}
            >
              <a
                href={pdfUrl}
                className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold transition-all duration-150 hover:opacity-90 w-full mb-3"
                style={{ background: colors.brand, color: colors.text.light }}
              >
                <Icon name="download" size={15} />
                Download certificate PDF
              </a>
              <Link
                to={ROUTES.VERIFY_LOOKUP}
                className="flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-[14px] font-semibold transition-all duration-150 hover:bg-surface-100 w-full"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              >
                <Icon name="search" size={15} />
                Verify another certificate
              </Link>
            </div>

            {/* Privacy note */}
            <div
              className="rounded-xl border p-4"
              style={{
                borderColor: withAlpha(colors.brand, "0.1"),
                background: withAlpha(colors.brand, "0.02"),
              }}
            >
              <div className="flex items-start gap-2">
                <Icon
                  name="lock"
                  size={14}
                  style={{ color: colors.brand, marginTop: 1 }}
                />
                <p
                  className="text-[11px] leading-5"
                  style={{ color: colors.text.secondary }}
                >
                  This public page confirms certificate integrity without
                  exposing private writing content or session data.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </PublicShell>
  );
}
