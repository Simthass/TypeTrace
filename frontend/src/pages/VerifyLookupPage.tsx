import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { colors, brand } from "../styles/colors";
import { ROUTES } from "../constants/routes";

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

// ─────────────────────────────────────────────────────────────────────────────
// METRIC ROW
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
      className="flex justify-between items-center py-2 border-b last:border-0"
      style={{ borderColor: colors.surface[100] }}
    >
      <span className="text-[12px]" style={{ color: colors.text.secondary }}>
        {label}
      </span>
      <span
        className="text-[12px] font-mono font-semibold"
        style={{ color: colors.text.primary }}
      >
        {value}
      </span>
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
        className="border rounded-xl p-6 flex flex-col items-center text-center gap-4"
        style={{ background: brand.aiBg, borderColor: `${brand.aiAccent}30` }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{
            background: "#fff",
            color: brand.aiAccent,
            border: `1px solid ${brand.aiAccent}30`,
          }}
        >
          <ShieldX />
        </div>
        <div>
          <h2
            className="text-[16px] font-bold mb-1"
            style={{ color: colors.text.primary }}
          >
            Certificate Not Found
          </h2>
          <p className="text-[13px]" style={{ color: colors.text.secondary }}>
            {result.reason ?? "This ID does not exist in the TypeTrace ledger."}
          </p>
        </div>
        <div
          className="w-full px-3 py-2 rounded-lg font-mono text-[11px] text-center"
          style={{
            background: "#fff",
            color: colors.text.secondary,
            border: `1px solid ${colors.surface[200]}`,
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

  const handleCopy = async () => {
    if (!document_hash) return;
    await navigator.clipboard.writeText(document_hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Valid banner */}
      <div
        className="border rounded-xl p-5 flex items-start gap-4"
        style={{
          background: brand.humanBg,
          borderColor: `${brand.humanAccent}30`,
        }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: "#fff",
            color: brand.humanText,
            border: `1px solid ${brand.humanAccent}30`,
          }}
        >
          <ShieldCheck />
        </div>
        <div>
          <h2
            className="text-[15px] font-bold"
            style={{ color: colors.text.primary }}
          >
            Certificate Verified
          </h2>
          <p className="text-[12px] mt-0.5" style={{ color: brand.humanText }}>
            Authentic — exists in the TypeTrace ledger
          </p>
        </div>
      </div>

      {/* Classification + hash */}
      <div
        className="border rounded-xl overflow-hidden"
        style={{ borderColor: colors.surface[200], background: "#fff" }}
      >
        <div
          className="px-5 py-4 border-b flex items-center justify-between"
          style={{ borderColor: colors.surface[200] }}
        >
          <span
            className="text-[12px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            {session?.title ?? "Untitled Document"}
          </span>
          <span
            className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border"
            style={{
              background: resultBg,
              color: resultColor,
              borderColor: `${resultColor}30`,
            }}
          >
            {session?.classification} · {session?.confidence}%
          </span>
        </div>

        <div className="px-5 py-3">
          <div className="flex flex-col gap-0.5 mb-3">
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: colors.text.secondary }}
            >
              Certificate ID
            </span>
            <span
              className="font-mono text-[12px] font-bold"
              style={{ color: colors.text.primary }}
            >
              {certificate_id}
            </span>
          </div>

          {document_hash && (
            <div
              className="flex items-center justify-between gap-2 p-2.5 rounded-lg"
              style={{
                background: colors.surface[50],
                border: `1px solid ${colors.surface[200]}`,
              }}
            >
              <div className="min-w-0">
                <p
                  className="text-[9px] font-bold uppercase tracking-widest mb-0.5"
                  style={{ color: colors.text.secondary }}
                >
                  SHA-256 Hash
                </p>
                <p
                  className="font-mono text-[10px] truncate"
                  style={{ color: colors.text.secondary }}
                >
                  {document_hash}
                </p>
              </div>
              <button
                onClick={handleCopy}
                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors"
                style={{
                  background: copied ? brand.humanBg : "#fff",
                  color: copied ? brand.humanText : colors.text.secondary,
                  border: `1px solid ${copied ? `${brand.humanAccent}30` : colors.surface[200]}`,
                }}
              >
                <CopyIcon />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}

          {issued_at && (
            <p
              className="text-[11px] mt-2"
              style={{ color: colors.text.secondary }}
            >
              Issued: {issued_at}
            </p>
          )}
        </div>
      </div>

      {/* Student info */}
      {student && (
        <div
          className="border rounded-xl p-5"
          style={{ borderColor: colors.surface[200], background: "#fff" }}
        >
          <h3
            className="text-[12px] font-semibold mb-3"
            style={{ color: colors.text.primary }}
          >
            Student
          </h3>
          <MetricRow label="Name" value={student.display_name} />
          <MetricRow label="Student ID" value={student.student_id} />
          <MetricRow label="Institution" value={student.institution} />
        </div>
      )}

      {/* Session metrics */}
      {session && (
        <div
          className="border rounded-xl p-5"
          style={{ borderColor: colors.surface[200], background: "#fff" }}
        >
          <h3
            className="text-[12px] font-semibold mb-3"
            style={{ color: colors.text.primary }}
          >
            Session Metadata
          </h3>
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
        </div>
      )}

      {/* What this means */}
      <div
        className="border rounded-xl p-5"
        style={{ borderColor: colors.surface[200], background: "#fff" }}
      >
        <h3
          className="text-[12px] font-semibold mb-2"
          style={{ color: colors.text.primary }}
        >
          What This Means
        </h3>
        <p
          className="text-[12px] leading-relaxed"
          style={{ color: colors.text.secondary }}
        >
          This certificate confirms TypeTrace recorded the writing session. The
          SHA-256 hash cryptographically seals the keystroke data — any
          tampering invalidates verification. A confidence score above 80%
          indicates strong human behavioral signatures (variable IKI, natural
          pauses, edit patterns). This certificate is evidence, not absolute
          proof — use alongside other supporting documentation for formal
          proceedings.
        </p>
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

  const handleVerify = async () => {
    const trimmed = certId.trim().toUpperCase();
    if (!trimmed) {
      setError("Please enter a certificate ID.");
      return;
    }
    if (trimmed.length < 8) {
      setError("Certificate IDs are at least 8 characters.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await api.get<VerifyResult>(
        `/verify/${encodeURIComponent(trimmed)}`,
      );
      setResult(res.data);
    } catch {
      setResult({
        valid: false,
        certificate_id: trimmed,
        reason:
          "Failed to reach the TypeTrace verification server. Check your connection.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col font-sans"
      style={{ background: colors.surface[50] }}
    >
      {/* Minimal header */}
      <header
        className="shrink-0 flex items-center justify-between px-8 h-14 bg-white border-b"
        style={{ borderColor: colors.surface[200] }}
      >
        <Link to={ROUTES.HOME}>
          <img
            src="/Logo.png"
            alt="TypeTrace"
            className="h-7 w-auto object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            to={ROUTES.LOGIN}
            className="text-[13px] font-medium px-3 py-1.5 rounded-md border transition-colors"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.secondary,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                colors.surface[50];
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#fff";
            }}
          >
            Sign In
          </Link>
          <Link
            to={ROUTES.REGISTER}
            className="text-[13px] font-semibold px-3 py-1.5 rounded-md text-white"
            style={{ background: colors.text.primary }}
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex justify-center px-6 py-12">
        <div className="w-full max-w-[540px] flex flex-col gap-6">
          {/* Page title */}
          <div className="text-center">
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 border"
              style={{
                background: "#fff",
                borderColor: colors.surface[200],
                color: colors.text.secondary,
              }}
            >
              <ShieldCheck />
            </div>
            <h1
              className="text-[22px] font-bold tracking-tight mb-2"
              style={{ color: colors.text.primary }}
            >
              Verify a Certificate
            </h1>
            <p className="text-[13px]" style={{ color: colors.text.secondary }}>
              Enter a TypeTrace certificate ID to verify its authenticity and
              view session metadata. No account required.
            </p>
          </div>

          {/* Input form */}
          <div
            className="bg-white border rounded-xl p-5 flex flex-col gap-3"
            style={{ borderColor: colors.surface[200] }}
          >
            <label
              className="text-[12px] font-semibold"
              style={{ color: colors.text.secondary }}
            >
              Certificate ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={certId}
                onChange={(e) => {
                  setCertId(e.target.value.toUpperCase());
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                placeholder="TT26-A1B2C3D4"
                className="flex-1 h-10 px-3 rounded-lg border font-mono text-[13px] outline-none transition-shadow"
                style={{
                  borderColor: error ? brand.aiAccent : colors.surface[200],
                  color: colors.text.primary,
                  background: colors.surface[50],
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 0 2px ${colors.text.primary}20`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <button
                onClick={handleVerify}
                disabled={isLoading}
                className="shrink-0 h-10 px-5 rounded-lg text-[13px] font-semibold text-white transition-opacity"
                style={{
                  background: colors.text.primary,
                  opacity: isLoading ? 0.7 : 1,
                  cursor: isLoading ? "not-allowed" : "pointer",
                }}
              >
                {isLoading ? "Checking…" : "Verify"}
              </button>
            </div>

            {error && (
              <p
                className="text-[12px] font-medium"
                style={{ color: brand.aiAccent }}
              >
                {error}
              </p>
            )}

            <p className="text-[11px]" style={{ color: colors.text.secondary }}>
              Certificate IDs look like:{" "}
              <code
                className="font-mono"
                style={{ color: colors.text.primary }}
              >
                TT26-A1B2C3D4
              </code>
            </p>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div
              className="flex items-center justify-center gap-2 py-8"
              style={{ color: colors.text.secondary }}
            >
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
              <span className="text-[13px] font-mono tracking-wide">
                Querying ledger…
              </span>
            </div>
          )}

          {/* Result */}
          {result && !isLoading && <VerificationResult result={result} />}

          {/* Footer note */}
          <p
            className="text-center text-[11px]"
            style={{ color: colors.text.secondary }}
          >
            Powered by{" "}
            <Link
              to={ROUTES.HOME}
              className="font-semibold hover:underline"
              style={{ color: colors.text.primary }}
            >
              TypeTrace
            </Link>{" "}
            — Behavioral Authorship Verification Platform
          </p>
        </div>
      </div>
    </div>
  );
}
