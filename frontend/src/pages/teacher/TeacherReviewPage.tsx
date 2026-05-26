// src/pages/teacher/TeacherReviewPage.tsx
// =============================================================================
// The "killer feature" — teacher reviews a student session with all ML metrics,
// a text preview, a replay link, and a one-click approve/flag workflow.
// =============================================================================

import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { colors } from "../../styles/colors";
import { ROUTES } from "../../constants/routes";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface SessionDetail {
  id: number;
  title: string;
  wpm: number;
  duration: number;
  classification: string;
  confidence: number;
  total_keystrokes: number;
  deletions: number;
  pauses: number;
  avg_iki: number;
  date: string;
  review_status: string;
  review_notes: string;
  risk_level: string;
  certificate_id: string | null;
  document_hash: string | null;
  text_preview: string;
  student: {
    first_name: string;
    last_name: string;
    email: string;
    student_id: string;
  };
  course_name: string;
  course_id: number;
}

type ReviewStatus = "APPROVED" | "FLAGGED" | "UNDER_REVIEW" | "PENDING";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const TEACHER_BLUE = "#0369a1";

const RISK_STYLE: Record<string, { bg: string; text: string; border: string }> =
  {
    HIGH: { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
    MEDIUM: { bg: "#fefce8", text: "#a16207", border: "#fef08a" },
    LOW: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  };

const STATUS_OPTIONS: {
  value: ReviewStatus;
  label: string;
  bg: string;
  text: string;
  border: string;
}[] = [
  {
    value: "APPROVED",
    label: "✓ Approve",
    bg: "#f0fdf4",
    text: "#15803d",
    border: "#bbf7d0",
  },
  {
    value: "FLAGGED",
    label: "⚑ Flag for Investigation",
    bg: "#fef2f2",
    text: "#b91c1c",
    border: "#fecaca",
  },
  {
    value: "UNDER_REVIEW",
    label: "◎ Mark Under Review",
    bg: "#fefce8",
    text: "#a16207",
    border: "#fef08a",
  },
];

function MetricGrid({
  items,
}: {
  items: { label: string; value: string | number; mono?: boolean }[];
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(({ label, value, mono }) => (
        <div
          key={label}
          className="flex flex-col gap-1 p-3 bg-white rounded-xl border"
          style={{ borderColor: colors.surface[200] }}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: colors.text.secondary }}
          >
            {label}
          </span>
          <span
            className={`text-[18px] font-bold ${mono ? "font-mono" : ""}`}
            style={{ color: colors.text.primary }}
          >
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function TeacherReviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review form state
  const [selectedStatus, setSelectedStatus] = useState<ReviewStatus | null>(
    null,
  );
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    api
      .get<SessionDetail>(`/teacher/sessions/${sessionId}`)
      .then((r) => {
        setSession(r.data);
        setNotes(r.data.review_notes ?? "");
        if (r.data.review_status !== "PENDING") {
          setSelectedStatus(r.data.review_status as ReviewStatus);
        }
      })
      .catch((e: unknown) => {
        const ax = e as { response?: { data?: { detail?: string } } };
        setError(
          ax.response?.data?.detail ?? "Session not found or access denied.",
        );
      })
      .finally(() => setIsLoading(false));
  }, [sessionId]);

  const handleSaveReview = async () => {
    if (!selectedStatus || !sessionId) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await api.patch(`/teacher/sessions/${sessionId}/review`, {
        status: selectedStatus,
        notes: notes.trim(),
      });
      setSaveSuccess(true);
      // Update local state to reflect saved status
      setSession((prev) =>
        prev
          ? { ...prev, review_status: selectedStatus, review_notes: notes }
          : prev,
      );
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { detail?: string } } };
      alert(ax.response?.data?.detail ?? "Failed to save review.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span
          className="text-[13px] font-mono tracking-widest uppercase"
          style={{ color: colors.text.secondary }}
        >
          Loading session...
        </span>
      </div>
    );
  }

  // ── Error ──
  if (error || !session) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-[14px] font-medium" style={{ color: "#b91c1c" }}>
          {error ?? "Session not found."}
        </p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white"
          style={{ background: TEACHER_BLUE }}
        >
          Go Back
        </button>
      </div>
    );
  }

  const riskStyle = RISK_STYLE[session.risk_level] ?? RISK_STYLE.LOW;
  const deletionRatio =
    session.total_keystrokes > 0
      ? ((session.deletions / session.total_keystrokes) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      {/* ── Breadcrumb ── */}
      <div
        className="flex items-center gap-2 text-[12px] mb-5"
        style={{ color: colors.text.secondary }}
      >
        <Link to="/teacher/submissions" className="hover:underline">
          Submissions
        </Link>
        <span>›</span>
        <span style={{ color: colors.text.primary }}>
          Session #{session.id}
        </span>
      </div>

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1
            className="text-[20px] font-semibold leading-snug"
            style={{ color: colors.text.primary }}
          >
            {session.title}
          </h1>
          <div
            className="flex flex-wrap items-center gap-3 mt-2 text-[13px]"
            style={{ color: colors.text.secondary }}
          >
            <span>
              <strong style={{ color: colors.text.primary }}>
                {session.student.first_name} {session.student.last_name}
              </strong>
              {" · "}
              {session.student.student_id}
            </span>
            <span>·</span>
            <span>{session.course_name}</span>
            <span>·</span>
            <span>{session.date}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase border"
            style={{
              background: riskStyle.bg,
              color: riskStyle.text,
              borderColor: riskStyle.border,
            }}
          >
            {session.risk_level} RISK
          </span>
          {/* Direct replay link — the killer feature */}
          <Link
            to={`/session/${session.id}/replay`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: TEACHER_BLUE }}
          >
            ▶ Watch Replay
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── LEFT COLUMN: metrics + text preview ── */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Classification result card */}
          <div
            className="flex items-center gap-5 p-5 bg-white rounded-xl border"
            style={{ borderColor: colors.surface[200] }}
          >
            <div className="flex flex-col flex-1">
              <span
                className="text-[11px] font-bold uppercase tracking-widest mb-1"
                style={{ color: colors.text.secondary }}
              >
                ML Classification
              </span>
              <span
                className="text-[24px] font-bold tracking-tight"
                style={{ color: colors.text.primary }}
              >
                {session.classification}
              </span>
              <span
                className="text-[13px]"
                style={{ color: colors.text.secondary }}
              >
                Confidence:{" "}
                <strong style={{ color: colors.text.primary }}>
                  {session.confidence}%
                </strong>
              </span>
            </div>
            {/* Confidence ring — simple CSS arc */}
            <div
              className="shrink-0 w-16 h-16 rounded-full flex items-center justify-center font-bold text-[14px]"
              style={{
                background: `conic-gradient(${TEACHER_BLUE} ${session.confidence * 3.6}deg, ${colors.surface[100]} 0deg)`,
                color: colors.text.primary,
              }}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-[13px] font-bold bg-white">
                {session.confidence}%
              </div>
            </div>
          </div>

          {/* Behavioral metrics grid */}
          <MetricGrid
            items={[
              { label: "WPM", value: session.wpm },
              {
                label: "Duration",
                value: `${Math.floor(session.duration / 60)}m ${Math.round(session.duration % 60)}s`,
              },
              { label: "Keystrokes", value: session.total_keystrokes },
              {
                label: "Deletions",
                value: `${session.deletions} (${deletionRatio}%)`,
              },
              { label: "Avg IKI", value: `${session.avg_iki}ms`, mono: true },
              { label: "Pauses (>1s)", value: session.pauses },
              {
                label: "Certificate",
                value: session.certificate_id ? "✓ Issued" : "None",
              },
              {
                label: "Doc Hash",
                value: session.document_hash
                  ? `${session.document_hash.slice(0, 8)}…`
                  : "None",
                mono: true,
              },
            ]}
          />

          {/* Text preview */}
          <div
            className="flex flex-col gap-3 p-5 bg-white rounded-xl border"
            style={{ borderColor: colors.surface[200] }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: colors.text.secondary }}
              >
                Text Preview (first 500 chars)
              </span>
              <Link
                to={`/session/${session.id}/replay`}
                className="text-[12px] font-semibold"
                style={{ color: TEACHER_BLUE }}
              >
                Full Replay →
              </Link>
            </div>
            <div
              className="p-4 rounded-lg font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words max-h-[240px] overflow-y-auto"
              style={{
                background: colors.surface[50],
                color: colors.text.primary,
                border: `1px solid ${colors.surface[200]}`,
              }}
            >
              {session.text_preview || (
                <span style={{ color: colors.text.secondary }}>
                  No text content available.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: review workflow panel ── */}
        <div className="flex flex-col gap-4">
          <div
            className="flex flex-col gap-4 p-5 bg-white rounded-xl border"
            style={{ borderColor: colors.surface[200] }}
          >
            <div>
              <h3
                className="text-[14px] font-semibold mb-0.5"
                style={{ color: colors.text.primary }}
              >
                Review Decision
              </h3>
              <p
                className="text-[12px]"
                style={{ color: colors.text.secondary }}
              >
                Current:{" "}
                <strong>{session.review_status.replace("_", " ")}</strong>
              </p>
            </div>

            {/* Status selector */}
            <div className="flex flex-col gap-2">
              {STATUS_OPTIONS.map((opt) => {
                const isSelected = selectedStatus === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedStatus(opt.value)}
                    className="flex items-center gap-2.5 w-full px-4 py-3 rounded-xl border-2 text-left text-[13px] font-semibold transition-all"
                    style={{
                      background: isSelected ? opt.bg : "white",
                      borderColor: isSelected
                        ? opt.border
                        : colors.surface[200],
                      color: isSelected ? opt.text : colors.text.secondary,
                    }}
                  >
                    <span
                      className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                      style={{
                        borderColor: isSelected
                          ? opt.text
                          : colors.surface[200],
                        background: isSelected ? opt.text : "transparent",
                      }}
                    >
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Notes textarea */}
            <div className="flex flex-col gap-1.5">
              <label
                className="text-[12px] font-medium"
                style={{ color: colors.text.secondary }}
              >
                Instructor Notes (optional)
              </label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add context or evidence notes for this review decision..."
                className="px-3 py-2.5 rounded-lg text-[13px] outline-none resize-none transition-all"
                style={{
                  border: `1px solid ${colors.surface[200]}`,
                  background: colors.surface[50],
                  color: colors.text.primary,
                  lineHeight: 1.6,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = TEACHER_BLUE;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = colors.surface[200];
                }}
              />
            </div>

            {/* Save button */}
            <button
              onClick={handleSaveReview}
              disabled={!selectedStatus || isSaving}
              className="w-full py-3 rounded-xl text-[13px] font-semibold text-white transition-all"
              style={{
                background: saveSuccess ? "#15803d" : TEACHER_BLUE,
                opacity: !selectedStatus || isSaving ? 0.6 : 1,
                cursor: !selectedStatus || isSaving ? "not-allowed" : "pointer",
              }}
            >
              {isSaving
                ? "Saving..."
                : saveSuccess
                  ? "✓ Saved"
                  : "Save Review Decision"}
            </button>

            {saveSuccess && (
              <p
                className="text-[12px] text-center font-medium"
                style={{ color: "#15803d" }}
              >
                Review decision recorded.
              </p>
            )}
          </div>

          {/* Student info card */}
          <div
            className="flex flex-col gap-3 p-5 bg-white rounded-xl border"
            style={{ borderColor: colors.surface[200] }}
          >
            <span
              className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: colors.text.secondary }}
            >
              Student Info
            </span>
            {[
              {
                label: "Name",
                value: `${session.student.first_name} ${session.student.last_name}`,
              },
              { label: "ID", value: session.student.student_id },
              { label: "Email", value: session.student.email },
              { label: "Course", value: session.course_name },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: colors.text.secondary }}
                >
                  {label}
                </span>
                <span
                  className="text-[13px]"
                  style={{ color: colors.text.primary }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
