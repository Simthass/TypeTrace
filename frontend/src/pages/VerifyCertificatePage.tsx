import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { colors, brand } from "../styles/colors";
import { ROUTES } from "../constants/routes";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface VerifyResult {
  valid: boolean;
  certificate_id: string;
  reason?: string; // Present when valid=false
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

function ShieldCheckIcon({ size = 24 }: { size?: number }) {
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
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function ShieldXIcon({ size = 24 }: { size?: number }) {
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
      className="flex justify-between items-center py-2.5 border-b last:border-0"
      style={{ borderColor: colors.surface[100] }}
    >
      <span className="text-[12px]" style={{ color: colors.text.secondary }}>
        {label}
      </span>
      <span
        className="text-[13px] font-mono font-semibold"
        style={{ color: colors.text.primary }}
      >
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function VerifyCertificatePage() {
  const { certId } = useParams<{ certId: string }>();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!certId) return;
    // This endpoint is public — no auth header needed
    api
      .get<VerifyResult>(`/verify/${certId}`)
      .then((r) => setResult(r.data))
      .catch(() =>
        setResult({
          valid: false,
          certificate_id: certId ?? "",
          reason: "Failed to reach the TypeTrace verification server.",
        }),
      )
      .finally(() => setIsLoading(false));
  }, [certId]);

  const handleCopyHash = async () => {
    if (!result?.document_hash) return;
    await navigator.clipboard.writeText(result.document_hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const classificationColor = (c: string) => {
    if (c === "HUMAN")
      return {
        bg: brand.humanBg,
        text: brand.humanText,
        border: `${brand.humanAccent}30`,
      };
    if (c === "SUSPICIOUS")
      return {
        bg: brand.suspiciousBg,
        text: brand.suspiciousText,
        border: `${brand.suspiciousAccent}30`,
      };
    return {
      bg: brand.aiBg,
      text: brand.aiText,
      border: `${brand.aiAccent}30`,
    };
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 font-sans"
        style={{ background: colors.surface[50] }}
      >
        <div
          className="flex items-center gap-3 text-[14px] font-mono tracking-widest uppercase"
          style={{ color: colors.text.secondary }}
        >
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
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
          Querying Ledger...
        </div>
      </div>
    );
  }

  // ── Not found / invalid ────────────────────────────────────────────────────
  if (!result || !result.valid) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 py-16 font-sans"
        style={{ background: colors.surface[50] }}
      >
        <div className="w-full max-w-[480px] flex flex-col items-center gap-6">
          {/* Logo */}
          <Link to={ROUTES.HOME}>
            <img
              src="/Logo.png"
              alt="TypeTrace"
              className="h-7 w-auto object-contain opacity-60"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </Link>

          {/* Invalid state */}
          <div
            className="w-full bg-white border rounded-2xl p-8 shadow-sm text-center flex flex-col items-center gap-5"
            style={{ borderColor: "#fecaca" }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "#fef2f2", color: "#b91c1c" }}
            >
              <ShieldXIcon size={28} />
            </div>
            <div>
              <h1
                className="text-[20px] font-bold mb-2"
                style={{ color: colors.text.primary }}
              >
                Certificate Not Verified
              </h1>
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: colors.text.secondary }}
              >
                {result?.reason ??
                  "This certificate ID was not found in the TypeTrace ledger. It may be invalid, expired, or the ID may be mistyped."}
              </p>
            </div>
            {certId && (
              <div
                className="w-full px-3 py-2 rounded-lg text-[11px] font-mono text-center"
                style={{
                  background: colors.surface[50],
                  color: colors.text.secondary,
                  border: `1px solid ${colors.surface[200]}`,
                }}
              >
                Queried: {certId}
              </div>
            )}
            <Link
              to={ROUTES.HOME}
              className="px-5 py-2.5 rounded-lg text-[13px] font-semibold text-white"
              style={{ background: colors.text.primary }}
            >
              Return to TypeTrace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Valid certificate ──────────────────────────────────────────────────────
  const { session, student, certificate_id, document_hash, issued_at } = result;
  const clsColors = classificationColor(session?.classification ?? "");

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start pt-12 pb-16 px-6 font-sans"
      style={{ background: colors.surface[50] }}
    >
      <div className="w-full max-w-[560px] flex flex-col gap-5">
        {/* Logo */}
        <div className="flex justify-center mb-2">
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
        </div>

        {/* ── VERIFICATION RESULT HEADER ── */}
        <div
          className="bg-white border rounded-2xl overflow-hidden shadow-sm"
          style={{ borderColor: "#bbf7d0" }}
        >
          {/* Green header strip */}
          <div
            className="px-6 py-5 flex items-center gap-4"
            style={{
              background: "linear-gradient(135deg, #f0fdf4 0%, #fff 70%)",
              borderBottom: `1px solid ${colors.surface[200]}`,
            }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border-2"
              style={{
                background: "#f0fdf4",
                borderColor: "#86efac",
                color: "#15803d",
              }}
            >
              <ShieldCheckIcon size={26} />
            </div>
            <div>
              <h1
                className="text-[18px] font-bold"
                style={{ color: colors.text.primary }}
              >
                Certificate Verified
              </h1>
              <p className="text-[13px] mt-0.5" style={{ color: "#15803d" }}>
                This certificate is authentic and exists in the TypeTrace
                ledger.
              </p>
            </div>
          </div>

          {/* Certificate ID + Hash */}
          <div className="px-6 py-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: colors.text.secondary }}
              >
                Certificate ID
              </span>
              <span
                className="font-mono text-[13px] font-bold"
                style={{ color: colors.text.primary }}
              >
                {certificate_id}
              </span>
            </div>

            {document_hash && (
              <div className="flex flex-col gap-1">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: colors.text.secondary }}
                >
                  SHA-256 Document Hash
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono text-[11px] flex-1 truncate"
                    style={{ color: colors.text.secondary }}
                  >
                    {document_hash}
                  </span>
                  <button
                    onClick={handleCopyHash}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold shrink-0 transition-colors"
                    style={{
                      background: copied ? "#f0fdf4" : colors.surface[50],
                      color: copied ? "#15803d" : colors.text.secondary,
                      border: `1px solid ${copied ? "#bbf7d0" : colors.surface[200]}`,
                    }}
                  >
                    <CopyIcon />
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-0.5">
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: colors.text.secondary }}
              >
                Issued At
              </span>
              <span
                className="text-[13px] font-mono"
                style={{ color: colors.text.primary }}
              >
                {issued_at}
              </span>
            </div>
          </div>
        </div>

        {/* ── STUDENT INFO ── */}
        {student && (
          <div
            className="bg-white border rounded-xl shadow-sm p-5"
            style={{ borderColor: colors.surface[200] }}
          >
            <h2
              className="text-[13px] font-semibold mb-3"
              style={{ color: colors.text.primary }}
            >
              Student
            </h2>
            <MetricRow label="Name" value={student.display_name} />
            <MetricRow label="Student ID" value={student.student_id} />
            <MetricRow label="Institution" value={student.institution} />
          </div>
        )}

        {/* ── SESSION DATA ── */}
        {session && (
          <div
            className="bg-white border rounded-xl shadow-sm overflow-hidden"
            style={{ borderColor: colors.surface[200] }}
          >
            <div
              className="px-5 py-4 border-b flex items-center justify-between"
              style={{ borderColor: colors.surface[200] }}
            >
              <h2
                className="text-[13px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                Session Metadata
              </h2>
              {/* Classification badge */}
              <span
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border"
                style={{
                  background: clsColors.bg,
                  color: clsColors.text,
                  borderColor: clsColors.border,
                }}
              >
                {session.classification === "AI-GENERATED"
                  ? "AI"
                  : session.classification}{" "}
                · {session.confidence}%
              </span>
            </div>
            <div className="px-5 py-1">
              <MetricRow label="Document Title" value={session.title} />
              {session.course && (
                <MetricRow label="Course" value={session.course} />
              )}
              <MetricRow label="Typing Duration" value={session.duration} />
              <MetricRow label="Net WPM" value={session.wpm} />
              <MetricRow
                label="Total Keystrokes"
                value={session.total_keystrokes.toLocaleString()}
              />
              <MetricRow
                label="Deletion Rate"
                value={`${session.deletion_rate}%`}
              />
              <MetricRow label="Mean IKI" value={`${session.avg_iki_ms}ms`} />
            </div>
          </div>
        )}

        {/* ── WHAT THIS MEANS ── */}
        <div
          className="bg-white border rounded-xl shadow-sm p-5"
          style={{ borderColor: colors.surface[200] }}
        >
          <h2
            className="text-[13px] font-semibold mb-3"
            style={{ color: colors.text.primary }}
          >
            What This Certificate Means
          </h2>
          <div
            className="flex flex-col gap-2.5 text-[12px] leading-relaxed"
            style={{ color: colors.text.secondary }}
          >
            <p>
              This certificate confirms that TypeTrace recorded the writing
              session for the document above. The SHA-256 hash cryptographically
              seals the keystroke data — any tampering changes the hash and
              would invalidate verification.
            </p>
            <p>
              The behavioral confidence score reflects the ML model's assessment
              of whether the typing patterns match human authorship. A score
              above 80% indicates strong human behavioral signatures (variable
              IKI, natural pauses, edit patterns).
            </p>
            <p
              style={{
                color: colors.text.secondary,
                opacity: 0.7,
                fontSize: 11,
              }}
            >
              TypeTrace provides behavioral evidence, not absolute proof. For
              formal academic disputes, this certificate should be used
              alongside other evidence.
            </p>
          </div>
        </div>

        {/* Footer link */}
        <p
          className="text-center text-[12px]"
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
  );
}
