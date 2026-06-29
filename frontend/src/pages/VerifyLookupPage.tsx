import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { colors, brand } from "../styles/colors";
import { ROUTES } from "../constants/routes";
import { API_ROUTES } from "../constants/apiRoutes";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface VerifyResult {
  valid: boolean;
  certificate_id: string;
  reason?: string;
  document_hash?: string;
  issued_at?: string;
  session?: {
    title: string;
    classification: string;
    confidence: number;
    wpm: number;
    duration: string;
    total_keystrokes: number;
    deletion_rate: number;
    avg_iki_ms: number;
    course: string | null;
  };
  student?: {
    display_name: string;
    student_id: string;
    institution: string;
  };
}

interface ToastState {
  type: "error";
  title: string;
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────

function ShieldCheck() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function ShieldX() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <line x1="9" y1="9" x2="15" y2="15" />
      <line x1="15" y1="9" x2="9" y2="15" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function FileSealIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M9 15l2 2 4-5" />
    </svg>
  );
}

function FingerprintIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12c0-5.52 4.48-10 10-10 2.76 0 5.26 1.12 7.07 2.93" />
      <path d="M5 19.5c.7-1.58 1-3.2 1-5.5a6 6 0 0 1 12 0c0 1.8-.2 3.34-.7 4.75" />
      <path d="M9 21c.67-1.67 1-3.67 1-6a2 2 0 0 1 4 0c0 2.25-.25 4.25-.75 6" />
      <path d="M14 8.5a5 5 0 0 0-7 4.58" />
      <path d="M18 11.5A6.5 6.5 0 0 0 8.5 5.7" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────────────────

function Toast({
  toast,
  onClose,
}: {
  toast: ToastState | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => {
      onClose();
    }, 4200);

    return () => window.clearTimeout(timeout);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className="fixed top-5 right-5 z-[100] w-[calc(100%-40px)] max-w-[380px]">
      <div
        role="alert"
        aria-live="assertive"
        className="rounded-md border p-4 flex items-start gap-3 animate-slide-down"
        style={{
          background: colors.surface[50],
          borderColor: `${brand.aiAccent}30`,
          boxShadow: "0 18px 50px -28px rgba(15,23,42,0.45)",
        }}
      >
        <div
          className="h-8 w-8 rounded-md flex items-center justify-center shrink-0 border"
          style={{
            background: brand.aiBg,
            color: brand.aiAccent,
            borderColor: `${brand.aiAccent}30`,
          }}
        >
          <AlertIcon />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="text-[13px] font-semibold leading-tight"
            style={{ color: colors.text.primary }}
          >
            {toast.title}
          </p>
          <p
            className="text-[12px] leading-relaxed mt-1"
            style={{ color: colors.text.secondary }}
          >
            {toast.message}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 rounded-md flex items-center justify-center shrink-0 transition-colors"
          style={{ color: colors.text.secondary }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colors.surface[100];
            e.currentTarget.style.color = colors.text.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = colors.text.secondary;
          }}
          aria-label="Dismiss notification"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function MetricRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      className="flex justify-between items-center py-3 border-b last:border-0"
      style={{ borderColor: colors.surface[200] }}
    >
      <span className="text-[12px]" style={{ color: colors.text.secondary }}>
        {label}
      </span>
      <span
        className="text-[12px] font-mono font-semibold text-right"
        style={{ color: colors.text.primary }}
      >
        {value}
      </span>
    </div>
  );
}

function InfoPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border"
      style={{
        background: colors.surface[50],
        borderColor: colors.surface[200],
        color: colors.text.secondary,
      }}
    >
      <span style={{ color: brand.action }}>{icon}</span>
      <span className="text-[12px] font-medium">{label}</span>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="border rounded-md p-5"
      style={{
        borderColor: colors.surface[200],
        background: colors.surface[50],
        boxShadow: "0 18px 55px -42px rgba(15,23,42,0.35)",
      }}
    >
      <h3
        className="text-[12px] font-bold uppercase tracking-widest mb-3"
        style={{ color: brand.action }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULT DISPLAY
// ─────────────────────────────────────────────────────────────────────────────

function VerificationResult({ result }: { result: VerifyResult }) {
  const [copied, setCopied] = useState(false);

  if (!result.valid) {
    return (
      <div
        className="border rounded-md p-8 flex flex-col items-center text-center gap-5"
        style={{
          background: brand.aiBg,
          borderColor: `${brand.aiAccent}30`,
          boxShadow: "0 24px 70px -48px rgba(239,68,68,0.45)",
        }}
      >
        <div
          className="w-14 h-14 rounded-md flex items-center justify-center"
          style={{
            background: colors.surface[50],
            color: brand.aiAccent,
            border: `1px solid ${brand.aiAccent}30`,
          }}
        >
          <ShieldX />
        </div>

        <div>
          <h2
            className="text-[20px] font-bold tracking-tight mb-1"
            style={{ color: colors.text.primary }}
          >
            Certificate Not Found
          </h2>
          <p
            className="text-[13px] max-w-[420px] leading-relaxed"
            style={{ color: colors.text.secondary }}
          >
            {result.reason ?? "This ID does not exist in the TypeTrace ledger."}
          </p>
        </div>

        <div
          className="w-full px-4 py-3 rounded-md font-mono text-[11px] text-center border"
          style={{
            background: colors.surface[50],
            color: colors.text.secondary,
            borderColor: `${brand.aiAccent}22`,
          }}
        >
          Queried: {result.certificate_id}
        </div>
      </div>
    );
  }

  const { session, student, certificate_id, document_hash, issued_at } = result;

  const isHuman = session?.classification === "HUMAN";
  const isSuspicious = session?.classification === "SUSPICIOUS";

  const resultColor = isHuman
    ? brand.humanText
    : isSuspicious
      ? brand.suspiciousText
      : brand.aiText;

  const resultBg = isHuman
    ? brand.humanBg
    : isSuspicious
      ? brand.suspiciousBg
      : brand.aiBg;

  const resultAccent = isHuman
    ? brand.humanAccent
    : isSuspicious
      ? brand.suspiciousAccent
      : brand.aiAccent;

  const handleCopy = async () => {
    if (!document_hash) return;

    await navigator.clipboard.writeText(document_hash);
    setCopied(true);

    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Verified banner */}
      <div
        className="border rounded-md p-6 md:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5"
        style={{
          background: colors.surface[50],
          borderColor: colors.surface[200],
          boxShadow: "0 24px 80px -46px rgba(15,23,42,0.38)",
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-md flex items-center justify-center shrink-0"
            style={{
              background: brand.humanBg,
              color: brand.humanText,
              border: `1px solid ${brand.humanAccent}30`,
            }}
          >
            <ShieldCheck />
          </div>

          <div>
            <p
              className="text-[11px] font-bold uppercase tracking-widest mb-1"
              style={{ color: brand.action }}
            >
              Ledger Match Found
            </p>
            <h2
              className="text-[20px] font-bold tracking-tight"
              style={{ color: colors.text.primary }}
            >
              Certificate Verified
            </h2>
            <p
              className="text-[13px] mt-1"
              style={{ color: colors.text.secondary }}
            >
              Authentic record exists in the TypeTrace verification ledger.
            </p>
          </div>
        </div>

        <span
          className="w-fit px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border"
          style={{
            background: resultBg,
            color: resultColor,
            borderColor: `${resultAccent}32`,
          }}
        >
          {session?.classification} · {session?.confidence}%
        </span>
      </div>

      {/* Main verification card */}
      <div
        className="border rounded-md overflow-hidden"
        style={{
          borderColor: colors.surface[200],
          background: colors.surface[50],
          boxShadow: "0 24px 80px -46px rgba(15,23,42,0.34)",
        }}
      >
        <div
          className="px-6 py-5 border-b flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[100],
          }}
        >
          <div>
            <p
              className="text-[11px] font-bold uppercase tracking-widest mb-1"
              style={{ color: colors.text.secondary }}
            >
              Verified Document
            </p>
            <h2
              className="text-[17px] font-bold tracking-tight"
              style={{ color: colors.text.primary }}
            >
              {session?.title ?? "Untitled Document"}
            </h2>
          </div>

          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border w-fit"
            style={{
              background: "#EFF6FF",
              borderColor: "#BFDBFE",
              color: brand.action,
            }}
          >
            <FingerprintIcon />
            <span className="text-[12px] font-semibold">
              Behavioral signature verified
            </span>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-5">
          <div>
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: colors.text.secondary }}
            >
              Certificate ID
            </span>
            <p
              className="font-mono text-[13px] font-bold mt-1 break-all"
              style={{ color: colors.text.primary }}
            >
              {certificate_id}
            </p>
          </div>

          {document_hash && (
            <div
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 rounded-md border"
              style={{
                background: colors.surface[100],
                borderColor: colors.surface[200],
              }}
            >
              <div className="min-w-0">
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-1"
                  style={{ color: brand.action }}
                >
                  SHA-256 Document Hash
                </p>
                <p
                  className="font-mono text-[11px] truncate md:max-w-[520px]"
                  style={{ color: colors.text.secondary }}
                >
                  {document_hash}
                </p>
              </div>

              <button
                onClick={handleCopy}
                className="shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-semibold transition-all border"
                style={{
                  background: copied ? brand.humanBg : colors.surface[50],
                  color: copied ? brand.humanText : brand.action,
                  borderColor: copied
                    ? `${brand.humanAccent}30`
                    : colors.surface[200],
                }}
                onMouseEnter={(e) => {
                  if (!copied) {
                    e.currentTarget.style.background = "#EFF6FF";
                    e.currentTarget.style.borderColor = "#BFDBFE";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!copied) {
                    e.currentTarget.style.background = colors.surface[50];
                    e.currentTarget.style.borderColor = colors.surface[200];
                  }
                }}
              >
                <CopyIcon />
                {copied ? "Copied" : "Copy Hash"}
              </button>
            </div>
          )}

          {issued_at && (
            <p className="text-[12px]" style={{ color: colors.text.secondary }}>
              Issued:{" "}
              <span
                className="font-mono font-semibold"
                style={{ color: colors.text.primary }}
              >
                {issued_at}
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {student && (
          <SectionCard title="Student Identity">
            <MetricRow label="Name" value={student.display_name} />
            <MetricRow label="Student ID" value={student.student_id} />
            <MetricRow label="Institution" value={student.institution} />
          </SectionCard>
        )}

        {session && (
          <SectionCard title="Session Metadata">
            <MetricRow label="Duration" value={session.duration} />
            <MetricRow label="Net WPM" value={session.wpm} />
            <MetricRow
              label="Keystrokes"
              value={session.total_keystrokes.toLocaleString()}
            />
            <MetricRow
              label="Deletion Rate"
              value={`${session.deletion_rate}%`}
            />
            <MetricRow label="Mean IKI" value={`${session.avg_iki_ms}ms`} />
            {session.course && (
              <MetricRow label="Course" value={session.course} />
            )}
          </SectionCard>
        )}
      </div>

      <div
        className="border rounded-md p-6"
        style={{
          borderColor: colors.surface[200],
          background: colors.surface[50],
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-10 h-10 rounded-md flex items-center justify-center shrink-0"
            style={{
              background: "#EFF6FF",
              color: brand.action,
              border: "1px solid #BFDBFE",
            }}
          >
            <FileSealIcon />
          </div>

          <div>
            <h3
              className="text-[14px] font-bold mb-2"
              style={{ color: colors.text.primary }}
            >
              What this verification means
            </h3>
            <p
              className="text-[13px] leading-relaxed"
              style={{ color: colors.text.secondary }}
            >
              This certificate confirms TypeTrace recorded the writing session.
              The SHA-256 hash cryptographically seals the keystroke data - any
              tampering invalidates verification. A confidence score above 80%
              indicates strong human behavioral signatures such as variable IKI,
              natural pauses, and organic edit patterns. This certificate is
              supporting evidence, not absolute proof, and should be used
              alongside other academic review materials.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function VerifyLookupPage() {
  const [certId, setCertId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showErrorToast = (message: string) => {
    setToast({
      type: "error",
      title: "Verification error",
      message,
    });
  };

  const handleVerify = async () => {
    const trimmed = certId.trim().toUpperCase();

    if (!trimmed) {
      const message = "Please enter a certificate ID.";
      setError(message);
      setResult(null);
      showErrorToast(message);
      return;
    }

    if (trimmed.length < 8) {
      const message = "Certificate IDs are at least 8 characters.";
      setError(message);
      setResult(null);
      showErrorToast(message);
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setToast(null);

    try {
      const res = await api.get<VerifyResult>(
        API_ROUTES.certificates.verifyPublic(trimmed),
      );

      /**
       * IMPORTANT:
       * If backend responds successfully but certificate is invalid,
       * show toast only. Do NOT render VerificationResult.
       */
      if (!res.data.valid) {
        const message =
          res.data.reason ??
          "Certificate ID not found in the TypeTrace verification ledger.";

        setResult(null);
        setError(message);
        showErrorToast(message);
        return;
      }

      setResult(res.data);
    } catch {
      const message =
        "Failed to reach the TypeTrace verification server. Check your connection and try again.";

      setResult(null);
      setError(message);
      showErrorToast(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col font-sans overflow-hidden"
      style={{ background: colors.surface[50] }}
    >
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="relative flex-1">
        <div className="relative z-10 max-w-[1120px] mx-auto px-6 pt-24 pb-20">
          {/* Hero */}
          <div className="max-w-[760px] mx-auto text-center mb-10">
            <h1
              className="text-[2.75rem] md:text-[4.4rem] font-bold tracking-[-0.055em] leading-[0.95] mb-5"
              style={{ color: colors.text.primary }}
            >
              Verify authorship
              <br />
              with confidence.
            </h1>

            <p
              className="text-[15px] md:text-lg leading-relaxed max-w-[620px] mx-auto"
              style={{ color: colors.text.secondary }}
            >
              Enter a TypeTrace certificate ID to validate cryptographic
              authorship evidence, inspect behavioral session metadata, and
              confirm the certificate exists in the verification ledger.
            </p>

            <div className="mt-7 flex flex-wrap justify-center gap-2">
              <InfoPill icon={<FileSealIcon />} label="SHA-256 sealed" />
              <InfoPill
                icon={<FingerprintIcon />}
                label="Behavioral biometrics"
              />
              <InfoPill icon={<ShieldCheck />} label="No account required" />
            </div>
          </div>

          {/* Search panel */}
          <div
            className="max-w-[760px] mx-auto bg-white border rounded-md p-5 md:p-6 flex flex-col gap-4"
            style={{
              borderColor: colors.surface[200],
              boxShadow: "0 30px 100px -50px rgba(15,23,42,0.40)",
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="hidden sm:flex w-11 h-11 rounded-md items-center justify-center shrink-0"
                style={{
                  background: "#EFF6FF",
                  color: brand.action,
                  border: "1px solid #BFDBFE",
                }}
              >
                <SearchIcon />
              </div>

              <div className="flex-1">
                <label
                  className="text-[12px] font-bold uppercase tracking-widest"
                  style={{ color: colors.text.secondary }}
                >
                  Certificate ID
                </label>

                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={certId}
                    onChange={(e) => {
                      setCertId(e.target.value.toUpperCase());
                      setError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                    placeholder="TT26-A1B2C3D4"
                    className="flex-1 h-12 px-4 rounded-md border font-mono text-[14px] outline-none transition-all"
                    style={{
                      borderColor: error ? brand.aiAccent : colors.surface[200],
                      color: colors.text.primary,
                      background: colors.surface[100],
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = brand.action;
                      e.currentTarget.style.boxShadow =
                        "0 0 0 4px rgba(37,99,235,0.12)";
                      e.currentTarget.style.background = colors.surface[50];
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = error
                        ? brand.aiAccent
                        : colors.surface[200];
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.background = colors.surface[100];
                    }}
                  />

                  <button
                    onClick={handleVerify}
                    disabled={isLoading}
                    className="shrink-0 h-12 px-6 rounded-md text-[14px] font-semibold text-white transition-all flex items-center justify-center gap-2"
                    style={{
                      background: brand.action,
                      opacity: isLoading ? 0.72 : 1,
                      cursor: isLoading ? "not-allowed" : "pointer",
                      boxShadow: isLoading
                        ? "none"
                        : "0 16px 38px -20px rgba(37,99,235,0.75)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoading) {
                        e.currentTarget.style.background = brand.actionHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isLoading) {
                        e.currentTarget.style.background = brand.action;
                      }
                    }}
                  >
                    {isLoading ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Checking
                      </>
                    ) : (
                      <>
                        Verify
                        <SearchIcon />
                      </>
                    )}
                  </button>
                </div>

                <p
                  className="text-[12px] mt-3"
                  style={{ color: colors.text.secondary }}
                >
                  Certificate IDs look like:{" "}
                  <code
                    className="font-mono font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    TT26-A1B2C3D4
                  </code>
                </p>
              </div>
            </div>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div
              className="max-w-[760px] mx-auto mt-8 flex items-center justify-center gap-2 py-8 rounded-md border"
              style={{
                color: colors.text.secondary,
                background: colors.surface[50],
                borderColor: colors.surface[200],
              }}
            >
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                style={{ color: brand.action }}
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-[13px] font-mono tracking-wide">
                Querying verification ledger…
              </span>
            </div>
          )}

          {/* Result */}
          {result && !isLoading && (
            <div className="max-w-[860px] mx-auto mt-8">
              <VerificationResult result={result} />
            </div>
          )}

          {/* Footer note */}
          <p
            className="text-center text-[12px] mt-10"
            style={{ color: colors.text.secondary }}
          >
            Powered by{" "}
            <Link
              to={ROUTES.HOME}
              className="font-semibold hover:underline"
              style={{ color: brand.action }}
            >
              TypeTrace
            </Link>{" "}
            - Behavioral Authorship Verification Platform
          </p>
        </div>
      </div>
    </div>
  );
}
