import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { colors, brand } from "../styles/colors";
import { ROUTES } from "../constants/routes";
import { useAuthStore } from "../store/authStore";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Classification = "HUMAN" | "SUSPICIOUS" | "AI-GENERATED";

interface Session {
  id: number;
  title: string;
  wpm: number;
  duration: number;
  classification: Classification;
  confidence: number;
  date: string;
  certificate_id: string | null;
  review_status: string;
  course_name: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────

function ShieldCheckIcon() {
  return (
    <svg
      width="16"
      height="16"
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

function ExternalLinkIcon() {
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
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CERTIFICATE CARD
// ─────────────────────────────────────────────────────────────────────────────

function CertificateCard({
  session,
  studentName,
}: {
  session: Session;
  studentName: string;
}) {
  const [copied, setCopied] = useState(false);
  const isHuman = session.classification === "HUMAN";
  const certId = session.certificate_id!;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(certId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Public verify URL — matches the existing /verify/:certId route
  const verifyUrl = `${window.location.origin}/verify/${certId}`;

  return (
    <div
      className="bg-white border rounded-xl overflow-hidden shadow-sm flex flex-col"
      style={{ borderColor: colors.surface[200] }}
    >
      {/* Certificate header strip — styled to feel like a real document */}
      <div
        className="px-6 py-5 flex items-start justify-between gap-3"
        style={{
          background: isHuman
            ? `linear-gradient(135deg, ${brand.humanBg} 0%, #fff 60%)`
            : `linear-gradient(135deg, ${brand.aiBg} 0%, #fff 60%)`,
          borderBottom: `1px solid ${colors.surface[200]}`,
        }}
      >
        <div className="flex items-center gap-3">
          {/* Certificate seal */}
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-2"
            style={{
              background: isHuman ? brand.humanBg : brand.aiBg,
              borderColor: isHuman ? brand.humanAccent : brand.aiAccent,
              color: isHuman ? brand.humanText : brand.aiText,
            }}
          >
            <ShieldCheckIcon />
          </div>
          <div>
            <p
              className="text-[15px] font-semibold leading-snug"
              style={{ color: colors.text.primary }}
            >
              {session.title}
            </p>
            <p
              className="text-[12px] mt-0.5"
              style={{ color: colors.text.secondary }}
            >
              Issued to {studentName} · {session.date}
            </p>
          </div>
        </div>

        {/* Classification badge */}
        <div
          className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border"
          style={{
            background: isHuman ? brand.humanBg : brand.aiBg,
            color: isHuman ? brand.humanText : brand.aiText,
            borderColor: isHuman
              ? `${brand.humanAccent}40`
              : `${brand.aiAccent}40`,
          }}
        >
          {session.classification === "AI-GENERATED"
            ? "AI"
            : session.classification}
        </div>
      </div>

      {/* Certificate body */}
      <div className="px-6 py-4 flex flex-col gap-4 flex-1">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Confidence", value: `${session.confidence}%` },
            { label: "WPM", value: session.wpm },
            { label: "Course", value: session.course_name ?? "Personal" },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span
                className="text-[9px] font-bold uppercase tracking-widest"
                style={{ color: colors.text.secondary }}
              >
                {label}
              </span>
              <span
                className="text-[13px] font-semibold font-mono truncate"
                style={{ color: colors.text.primary }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Certificate ID block */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            background: colors.surface[50],
            border: `1px solid ${colors.surface[200]}`,
          }}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-wider shrink-0"
            style={{ color: colors.text.secondary }}
          >
            CERT ID
          </span>
          <span
            className="flex-1 font-mono text-[11px] truncate"
            style={{ color: colors.text.primary }}
          >
            {certId}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-colors shrink-0"
            style={{
              background: copied ? "#f0fdf4" : "white",
              color: copied ? "#15803d" : colors.text.secondary,
              border: `1px solid ${copied ? "#bbf7d0" : colors.surface[200]}`,
            }}
          >
            <CopyIcon />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Footer actions */}
      <div
        className="px-6 py-3 flex items-center gap-3 border-t"
        style={{
          borderColor: colors.surface[200],
          background: colors.surface[50],
        }}
      >
        {/* Verify publicly */}
        <a
          href={verifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[12px] font-semibold transition-colors"
          style={{ color: brand.action }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "0.8";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "1";
          }}
        >
          <ExternalLinkIcon />
          Verify Certificate
        </a>

        <span style={{ color: colors.surface[200] }}>·</span>

        {/* Replay link */}
        <Link
          to={`/session/${session.id}/replay`}
          className="flex items-center gap-1.5 text-[12px] font-semibold transition-opacity hover:opacity-70"
          style={{ color: colors.text.secondary }}
        >
          <PlayIcon />
          Replay
        </Link>

        {/* Review status if submitted */}
        {session.review_status &&
          session.review_status !== "PENDING" &&
          session.course_name && (
            <>
              <span style={{ color: colors.surface[200] }}>·</span>
              <span
                className="text-[11px] font-semibold ml-auto"
                style={{
                  color:
                    session.review_status === "APPROVED"
                      ? "#15803d"
                      : session.review_status === "FLAGGED"
                        ? "#b91c1c"
                        : "#a16207",
                }}
              >
                {session.review_status === "APPROVED"
                  ? "✓ Approved"
                  : session.review_status === "FLAGGED"
                    ? "⚑ Flagged"
                    : "◎ Under Review"}
              </span>
            </>
          )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function CertificatesPage() {
  const { user } = useAuthStore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "HUMAN" | "OTHER">("ALL");

  const studentName = user
    ? `${user.first_name} ${user.last_name ?? ""}`.trim()
    : "Student";

  useEffect(() => {
    api
      .get<{ status: string; sessions: Session[] }>("/sessions/history")
      .then((r) => {
        if (r.data.status === "success") {
          // Only sessions that actually have a certificate
          setSessions(r.data.sessions.filter((s) => !!s.certificate_id));
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = sessions.filter((s) => {
    if (filter === "HUMAN") return s.classification === "HUMAN";
    if (filter === "OTHER") return s.classification !== "HUMAN";
    return true;
  });

  const humanCount = sessions.filter(
    (s) => s.classification === "HUMAN",
  ).length;
  const avgConf =
    sessions.length > 0
      ? (
          sessions.reduce((a, s) => a + s.confidence, 0) / sessions.length
        ).toFixed(1)
      : "—";

  return (
    <div
      className="p-6 md:p-8 max-w-[1200px] mx-auto flex flex-col gap-6 font-sans min-h-screen"
      style={{ background: colors.surface[50] }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-[20px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Certificates
          </h1>
          <p
            className="text-[13px] mt-0.5"
            style={{ color: colors.text.secondary }}
          >
            Cryptographic proof of authorship for all your verified sessions.
          </p>
        </div>
        <Link
          to={ROUTES.EDITOR_NEW}
          className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white shadow-sm"
          style={{ background: colors.text.primary }}
        >
          + New Session
        </Link>
      </div>

      {/* Stats row */}
      {sessions.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Certificates", value: sessions.length },
            {
              label: "Human Verified",
              value: humanCount,
              accent: brand.humanText,
            },
            {
              label: "Avg Confidence",
              value: `${avgConf}%`,
              accent: brand.action,
            },
          ].map(({ label, value, accent }) => (
            <div
              key={label}
              className="bg-white border rounded-xl p-4 shadow-sm"
              style={{ borderColor: colors.surface[200] }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ color: colors.text.secondary }}
              >
                {label}
              </p>
              <p
                className="text-[22px] font-extrabold font-mono"
                style={{ color: accent ?? colors.text.primary }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      {sessions.length > 0 && (
        <div className="flex items-center gap-2">
          {(["ALL", "HUMAN", "OTHER"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors"
              style={{
                background: filter === f ? colors.text.primary : "white",
                color: filter === f ? "white" : colors.text.secondary,
                borderColor:
                  filter === f ? colors.text.primary : colors.surface[200],
              }}
            >
              {f === "OTHER" ? "Suspicious / AI" : f}
            </button>
          ))}
          <span
            className="text-[12px] ml-2"
            style={{ color: colors.text.secondary }}
          >
            {filtered.length} certificate{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <span
            className="text-[13px] font-mono tracking-widest uppercase"
            style={{ color: colors.text.secondary }}
          >
            Loading...
          </span>
        </div>
      ) : sessions.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border gap-4"
          style={{ borderColor: colors.surface[200] }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: colors.surface[50],
              color: colors.text.secondary,
            }}
          >
            <ShieldCheckIcon />
          </div>
          <div className="text-center">
            <p
              className="text-[15px] font-semibold mb-1"
              style={{ color: colors.text.primary }}
            >
              No certificates yet
            </p>
            <p className="text-[13px]" style={{ color: colors.text.secondary }}>
              Complete a typing session to generate your first cryptographic
              certificate.
            </p>
          </div>
          <Link
            to={ROUTES.EDITOR_NEW}
            className="px-5 py-2.5 rounded-lg text-[13px] font-semibold text-white"
            style={{ background: colors.text.primary }}
          >
            Start First Session
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="flex items-center justify-center py-12 bg-white rounded-xl border"
          style={{ borderColor: colors.surface[200] }}
        >
          <p className="text-[13px]" style={{ color: colors.text.secondary }}>
            No certificates match this filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((s) => (
            <CertificateCard key={s.id} session={s} studentName={studentName} />
          ))}
        </div>
      )}

      {/* GDPR note */}
      <p
        className="text-[11px] text-center pb-4"
        style={{ color: colors.text.secondary }}
      >
        Certificates are cryptographically sealed with SHA-256 and immutably
        stored in the TypeTrace ledger. Share the "Verify Certificate" link with
        your institution to prove authorship.
      </p>
    </div>
  );
}
