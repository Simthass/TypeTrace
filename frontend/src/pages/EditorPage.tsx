import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { ROUTES } from "../constants/routes";
import { useKeystrokeCapture } from "../hooks/useKeystrokeCapture";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import {
  useEditorDraftRecovery,
  type EditorDraftSnapshot,
} from "../hooks/useEditorDraftRecovery";
import { api, getApiErrorMessage } from "../lib/api";
import { useToast } from "../components/ui/ToastContext";
import { useAuthStore } from "../store/authStore";
import { brand, colors } from "../styles/colors";
import { API_ROUTES } from "../constants/apiRoutes";
import {
  MAX_EDITOR_TEXT_LENGTH,
  MAX_PASTE_LENGTH,
  MINIMUM_KEYSTROKES,
  truncateTitle,
} from "../lib/edgeCases";
import { formatEvidenceScore } from "../lib/evidenceScore";

const EDITOR_CONSENT_STORAGE_KEY = "typetrace.editorEvidenceConsent.v1";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EnrolledCourse {
  id: number;
  course_name: string;
  course_code: string;
}

interface AnalysisResult {
  classification: string;
  confidence: number;
  certificate_id?: string | null;
  document_hash?: string | null;
  session_id?: number | null;
  kill_switch_triggered?: boolean;
  kill_switch_reason?: string | null;
  risk_level?: string;
  risk_score?: number;
  submission_id?: string;
  idempotent_replay?: boolean;
  decision_source?: string;
  model_available?: boolean;
  degraded_analysis?: boolean;
  advanced_stats?: {
    paste_count?: number;
    paste_ratio?: number;
    deletion_ratio?: number;
    risk_signals?: string[];
    human_signals?: string[];
    decision_source?: string;
    model_available?: boolean;
    model_version?: string;
    model_accuracy?: number | string | null;
    model_cv_accuracy?: number | string | null;
    academic_interpretation?: string;
    [key: string]: unknown;
  };
  stats: {
    keystrokes: number;
    deletions: number;
    deletedCharacters?: number;
    bulkDeletionEvents?: number;
    largestDeletionChars?: number;
    selectionDeletionEvents?: number;
    wordDeletionEvents?: number;
    cutEvents?: number;
    pauses: number;
    wpm: number;
    avgIki: number;
    sessionSeconds: number;
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function countWords(value: string): number {
  const clean = value.trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function countPasteEvents(
  events: Array<{ type?: string; key?: string }>,
): number {
  return events.filter(
    (event) => event?.type === "paste" || event?.key === "__PASTE_EVENT__",
  ).length;
}

function keyboardInsertionText(
  event: React.KeyboardEvent<HTMLTextAreaElement>,
): string {
  const shortcut = (event.ctrlKey || event.metaKey) && !event.altKey;
  if (shortcut) return "";
  if (event.key === "Enter") return "\n";
  if (event.key === "Tab") return "    ";
  return event.key.length === 1 ? event.key : "";
}

function getResultStyle(classification: string) {
  const n = classification.toUpperCase();
  if (n === "HUMAN")
    return {
      label: "Human",
      sublabel: "Strong human writing evidence",
      bg: brand.humanBg,
      text: brand.humanText,
      accent: brand.humanAccent,
      barColor: colors.green,
    };
  if (n === "SUSPICIOUS")
    return {
      label: "Review Required",
      sublabel: "Some behavioral anomalies detected in the writing process",
      bg: brand.suspiciousBg,
      text: brand.suspiciousText,
      accent: brand.suspiciousAccent,
      barColor: colors.amber,
    };
  return {
    label: "High Risk",
    sublabel: "Writing behavior does not match typical human patterns",
    bg: brand.aiBg,
    text: brand.aiText,
    accent: brand.aiAccent,
    barColor: colors.red,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Single stat row used inside the sidebar telemetry panel */
function StatRow({
  label,
  value,
  highlight = false,
  accent = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between py-[9px]"
      style={{
        borderBottom: `1px solid ${colors.surface[200]}`,
      }}
    >
      <span
        className="text-[12px] font-medium"
        style={{ color: colors.text.secondary }}
      >
        {label}
      </span>
      <span
        className="text-[13px] font-bold tabular-nums"
        style={{
          color: accent
            ? colors.brand
            : highlight
              ? colors.text.primary
              : colors.text.primary,
        }}
      >
        {String(value)}
      </span>
    </div>
  );
}

/** Section divider label used inside sidebar */
function SidebarLabel({ children }: { children: string }) {
  return (
    <p
      className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em]"
      style={{ color: colors.text.muted }}
    >
      {children}
    </p>
  );
}

/** Animated capture bar - the signature element.
 *  A thin bar below the textarea header that grows as keystrokes accumulate
 *  toward the MINIMUM_KEYSTROKES threshold, then pulses green when ready.
 */
function CaptureBar({
  keystrokes,
  ready,
  active,
}: {
  keystrokes: number;
  ready: boolean;
  active: boolean;
}) {
  const pct = Math.min(100, (keystrokes / MINIMUM_KEYSTROKES) * 100);

  return (
    <div
      className="relative h-[3px] w-full overflow-hidden"
      style={{ background: colors.surface[200] }}
      title={
        ready
          ? "Capture threshold reached - ready to analyze"
          : `${keystrokes}/${MINIMUM_KEYSTROKES} keystrokes captured`
      }
    >
      <div
        className="absolute left-0 top-0 h-full transition-all duration-500 ease-out"
        style={{
          width: `${pct}%`,
          background: ready
            ? colors.green
            : active
              ? colors.brand
              : colors.surface[300],
        }}
      />
      {/* Pulse indicator when actively typing */}
      {active && !ready && (
        <div
          className="absolute right-0 top-0 h-full w-[3px] animate-pulse"
          style={{ background: colors.brand, marginLeft: `${pct}%` }}
        />
      )}
    </div>
  );
}

/** Inline save state badge - top of editor */
function SaveIndicator({
  state,
  offlineSafe,
}: {
  state: "saved" | "saving" | "local" | "unsaved";
  offlineSafe?: boolean;
}) {
  const cfg = {
    saved: {
      dot: colors.green,
      label: "Saved",
      text: colors.text.muted,
    },
    saving: {
      dot: colors.amber,
      label: "Saving",
      text: colors.text.muted,
    },
    local: {
      dot: colors.amber,
      label: "Saved locally",
      text: colors.text.muted,
    },
    unsaved: {
      dot: colors.red,
      label: "Unsaved",
      text: colors.text.muted,
    },
  }[state];

  const label =
    (offlineSafe && state === "saved") || state === "local"
      ? "Saved locally"
      : cfg.label;

  return (
    <div className="flex items-center gap-[6px]">
      <span
        className="inline-block h-[7px] w-[7px] rounded-md"
        style={{
          background: cfg.dot,
          animation:
            state === "saving" ? "pulse 1s ease-in-out infinite" : "none",
        }}
      />
      <span className="text-[12px] font-medium" style={{ color: cfg.text }}>
        {label}
      </span>
    </div>
  );
}

/** Course selector modal */
function CourseSelectorModal({
  courses,
  selectedCourseId,
  onSelect,
  onCancel,
  onConfirm,
  isSubmitting,
}: {
  courses: EnrolledCourse[];
  selectedCourseId: number | null;
  onSelect: (id: number | null) => void;
  onCancel: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        style={{ background: "rgba(15, 23, 42, 0.5)" }}
        onClick={onCancel}
        aria-label="Close"
      />

      {/* Modal */}
      <div
        className="safe-bottom relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border bg-white sm:max-w-[520px] sm:rounded-md"
        style={{
          borderColor: colors.surface[200],
          boxShadow: `0 32px 80px -16px rgba(15,23,42,0.22), 0 0 0 1px ${colors.surface[200]}`,
        }}
      >
        {/* Header */}
        <div
          className="border-b px-4 py-4 sm:px-6 sm:py-5"
          style={{ borderColor: colors.surface[200] }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ color: colors.brand }}
          >
            Link evidence trail
          </p>
          <h2
            className="mt-1 text-[20px] font-bold tracking-[-0.03em]"
            style={{ color: colors.text.primary }}
          >
            Where does this session belong?
          </h2>
          <p
            className="mt-2 text-[13px] leading-[1.6]"
            style={{ color: colors.text.secondary }}
          >
            Linking to a course lets your teacher review this session's
            behavioral evidence if needed.
          </p>
        </div>

        {/* Options */}
        <div className="scroll-region max-h-[52dvh] space-y-2 overflow-y-auto px-4 py-4 sm:max-h-none sm:px-6">
          {/* Personal option */}
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="group w-full rounded-md border px-4 py-3 text-left transition-all duration-150"
            style={{
              borderColor:
                selectedCourseId === null ? colors.brand : colors.surface[200],
              background:
                selectedCourseId === null
                  ? colors.brandSoft
                  : colors.surface[50],
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p
                  className="text-[13px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  Personal session
                </p>
                <p
                  className="mt-[2px] text-[12px]"
                  style={{ color: colors.text.secondary }}
                >
                  Stored in your private workspace only
                </p>
              </div>
              {selectedCourseId === null && (
                <div
                  className="flex h-5 w-5 items-center justify-center rounded-md"
                  style={{ background: colors.brand }}
                >
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path
                      d="M1 4L3.5 6.5L9 1"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
          </button>

          {/* Course options */}
          {courses.map((course) => (
            <button
              key={course.id}
              type="button"
              onClick={() => onSelect(course.id)}
              className="w-full rounded-md border px-4 py-3 text-left transition-all duration-150"
              style={{
                borderColor:
                  selectedCourseId === course.id
                    ? colors.brand
                    : colors.surface[200],
                background:
                  selectedCourseId === course.id
                    ? colors.brandSoft
                    : colors.surface[50],
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p
                    className="text-[13px] font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {course.course_name}
                  </p>
                  <p
                    className="mt-[2px] text-[12px] font-mono"
                    style={{ color: colors.text.muted }}
                  >
                    {course.course_code}
                  </p>
                </div>
                {selectedCourseId === course.id && (
                  <div
                    className="flex h-5 w-5 items-center justify-center rounded-md"
                    style={{ background: colors.brand }}
                  >
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path
                        d="M1 4L3.5 6.5L9 1"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div
          className="flex flex-col-reverse gap-2 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-6"
          style={{ borderColor: colors.surface[200] }}
        >
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border px-4 py-[9px] text-[13px] font-semibold transition-all duration-150 hover:brightness-95"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
              background: colors.surface[100],
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-md px-5 py-[9px] text-[13px] font-semibold text-white transition-all duration-150 hover:brightness-110 disabled:opacity-50"
            style={{ background: colors.brand }}
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin"
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                >
                  <circle
                    cx="7"
                    cy="7"
                    r="5.5"
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M7 1.5A5.5 5.5 0 0112.5 7"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Analyzing…
              </>
            ) : (
              "Run analysis"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Draft recovery prompt shown when an unfinished local draft exists */
function DraftRecoveryModal({
  draft,
  onContinue,
  onDiscard,
}: {
  draft: EditorDraftSnapshot;
  onContinue: () => void;
  onDiscard: () => void;
}) {
  const savedDate = new Date(draft.savedAt).toLocaleString();
  const words = countWords(draft.text);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:px-4">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(15, 23, 42, 0.58)" }}
      />
      <div
        className="safe-bottom relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border bg-white sm:max-w-[560px] sm:rounded-md"
        style={{
          borderColor: colors.surface[200],
          boxShadow: "0 34px 90px rgba(15,23,42,0.28)",
        }}
      >
        <div className="px-6 pb-5 pt-6">
          <div
            className="mb-5 inline-flex items-center gap-2 rounded-md border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{
              borderColor: colors.amber,
              background: colors.amberTint,
              color: colors.text.primary,
            }}
          >
            <span
              className="h-2 w-2 rounded-md"
              style={{ background: colors.amber }}
            />
            Unsaved writing session found
          </div>

          <h2
            className="text-[26px] font-extrabold leading-tight tracking-[-0.045em]"
            style={{ color: colors.text.primary }}
          >
            Continue your previous unfinished session?
          </h2>
          <p
            className="mt-3 max-w-[48ch] text-[14px] leading-7"
            style={{ color: colors.text.secondary }}
          >
            TypeTrace found a locally saved editor draft. Continuing restores
            the document text, course selection, captured keystroke evidence,
            and timing state so the session can keep building a single evidence
            trail.
          </p>

          <div
            className="mt-5 grid gap-3 rounded-md border p-4 sm:grid-cols-3"
            style={{
              borderColor: colors.surface[200],
              background: colors.surface[50],
            }}
          >
            {[
              ["Title", draft.title || "Untitled document"],
              ["Words", words.toLocaleString()],
              ["Captured events", draft.keystrokeLog.length.toLocaleString()],
            ].map(([label, value]) => (
              <div key={label}>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.15em]"
                  style={{ color: colors.text.muted }}
                >
                  {label}
                </p>
                <p
                  className="mt-1 truncate text-[13px] font-bold"
                  style={{ color: colors.text.primary }}
                >
                  {String(value)}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[12px]" style={{ color: colors.text.muted }}>
            Last saved locally: {savedDate}
          </p>
        </div>

        <div
          className="flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end"
          style={{ borderColor: colors.surface[200] }}
        >
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-md border px-4 py-[10px] text-[13px] font-semibold transition hover:brightness-95"
            style={{
              borderColor: colors.surface[200],
              background: colors.surface[50],
              color: colors.text.secondary,
            }}
          >
            Discard local draft
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-md px-5 py-[10px] text-[13px] font-bold text-white transition hover:brightness-110"
            style={{ background: colors.brand }}
          >
            Continue session
          </button>
        </div>
      </div>
    </div>
  );
}

function EditorConsentModal({
  onAccept,
  onLeave,
}: {
  onAccept: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:px-4">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(15, 23, 42, 0.64)" }}
      />
      <div
        className="safe-bottom relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border bg-white sm:max-w-[620px] sm:rounded-md"
        style={{
          borderColor: colors.surface[200],
          boxShadow: "0 34px 100px rgba(15,23,42,0.34)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="TypeTrace writing evidence consent"
      >
        <div className="px-6 pb-5 pt-6">
          <div
            className="mb-5 inline-flex items-center gap-2 rounded-md border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{
              borderColor: colors.brand,
              background: colors.brandSoft,
              color: colors.brand,
            }}
          >
            First writing session notice
          </div>
          <h2
            className="text-[26px] font-extrabold leading-tight tracking-[-0.045em]"
            style={{ color: colors.text.primary }}
          >
            TypeTrace captures writing-process evidence while you type.
          </h2>
          <p
            className="mt-3 text-[14px] leading-7"
            style={{ color: colors.text.secondary }}
          >
            To create a verifiable authorship certificate, the editor records
            behavioral signals such as keystroke timing, pauses, deletions,
            paste/cut activity, revision pressure, active writing time, and
            session metadata. This evidence supports academic review; it is not
            automatic proof of misconduct.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              [
                "Captured",
                "Timing, edits, pauses, paste/cut, revision metrics",
              ],
              [
                "Private",
                "Raw essay text and raw keystrokes are not exposed publicly",
              ],
              [
                "Public",
                "Certificates show integrity hashes, status, and review-safe metadata",
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-md border p-3"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[50],
                }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: colors.text.muted }}
                >
                  {label}
                </p>
                <p
                  className="mt-2 text-[12px] leading-5"
                  style={{ color: colors.text.secondary }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>
          <p
            className="mt-4 text-[12px] leading-6"
            style={{ color: colors.text.muted }}
          >
            You can save a draft and leave at any time. Continuing means you
            understand this editor captures behavioral evidence for your
            TypeTrace session.
          </p>
        </div>
        <div
          className="flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end"
          style={{ borderColor: colors.surface[200] }}
        >
          <button
            type="button"
            onClick={onLeave}
            className="rounded-md border px-4 py-[10px] text-[13px] font-semibold transition hover:brightness-95"
            style={{
              borderColor: colors.surface[200],
              background: colors.surface[50],
              color: colors.text.secondary,
            }}
          >
            Back to dashboard
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded-md px-5 py-[10px] text-[13px] font-bold text-white transition hover:brightness-110"
            style={{ background: colors.brand }}
          >
            I understand, start capturing
          </button>
        </div>
      </div>
    </div>
  );
}

/** Full-screen SaaS-style result modal shown after analysis */
function AnalysisResultModal({
  result,
  onClose,
  onNewSession,
}: {
  result: AnalysisResult;
  onClose: () => void;
  onNewSession: () => void;
}) {
  const style = getResultStyle(result.classification);
  const navigate = useNavigate();
  const riskSignals = result.advanced_stats?.risk_signals ?? [];
  const humanSignals = result.advanced_stats?.human_signals ?? [];
  const pasteCount = Number(result.advanced_stats?.paste_count ?? 0);
  const riskScore = Math.round(
    Number(result.risk_score ?? result.advanced_stats?.risk_score ?? 0),
  );

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center sm:items-center sm:px-4 sm:py-6">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        style={{
          background: "rgba(15, 23, 42, 0.62)",
          backdropFilter: "blur(6px)",
        }}
        onClick={onClose}
        aria-label="Close analysis result"
      />

      <div
        className="relative z-10 flex max-h-[94dvh] w-full max-w-[980px] flex-col overflow-hidden rounded-t-2xl border bg-white sm:max-h-[92dvh] sm:rounded-md"
        style={{
          borderColor: colors.surface[200],
          boxShadow: "0 34px 110px rgba(15,23,42,0.32)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Behavioral analysis result"
      >
        <div
          className="border-b px-4 py-4 sm:px-6 sm:py-5"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[50],
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: colors.brand }}
              >
                Behavioral evidence report
              </p>
              <h2
                className="mt-1 text-[24px] font-extrabold tracking-[-0.04em]"
                style={{ color: colors.text.primary }}
              >
                Analysis complete
              </h2>
              <p
                className="mt-2 max-w-[70ch] text-[13px] leading-6"
                style={{ color: colors.text.secondary }}
              >
                This report summarizes writing-process evidence. It should
                support academic review, not act as automatic proof of
                authorship or misconduct.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-3 py-2 text-[12px] font-semibold transition hover:brightness-95"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[100],
                color: colors.text.secondary,
              }}
            >
              Close
            </button>
          </div>
        </div>

        <div className="scroll-region overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <section
              className="rounded-md border p-4 sm:p-6"
              style={{ borderColor: style.accent, background: style.bg }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: style.text, opacity: 0.72 }}
                  >
                    Human Writing Evidence Score
                  </p>
                  <p
                    className="mt-3 text-[42px] font-black leading-none tracking-[-0.055em]"
                    style={{ color: style.text }}
                  >
                    {formatEvidenceScore(result.confidence)}%
                  </p>
                  <p
                    className="mt-3 text-[16px] font-extrabold"
                    style={{ color: style.text }}
                  >
                    {style.label}
                  </p>
                  <p
                    className="mt-2 text-[12px] leading-6"
                    style={{ color: style.text, opacity: 0.78 }}
                  >
                    {style.sublabel}
                  </p>
                </div>

                <svg
                  width="84"
                  height="84"
                  viewBox="0 0 84 84"
                  className="shrink-0"
                >
                  <circle
                    cx="42"
                    cy="42"
                    r="34"
                    fill="none"
                    stroke={style.accent}
                    strokeOpacity="0.2"
                    strokeWidth="7"
                  />
                  <circle
                    cx="42"
                    cy="42"
                    r="34"
                    fill="none"
                    stroke={style.barColor}
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - result.confidence / 100)}`}
                    transform="rotate(-90 42 42)"
                  />
                </svg>
              </div>

              {(result.degraded_analysis ||
                result.advanced_stats?.degraded_analysis === true) && (
                <div
                  role="status"
                  className="mt-4 rounded-md border px-4 py-3 text-[12px] leading-6"
                  style={{
                    borderColor: colors.amber,
                    background: colors.amberTint,
                    color: colors.text.primary,
                  }}
                >
                  <strong>Degraded analysis:</strong> the trained model was not
                  available. TypeTrace used documented fallback rules. Treat
                  this result as supplementary evidence requiring teacher
                  review.
                </div>
              )}

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  [
                    "Risk level",
                    result.risk_level ??
                      result.advanced_stats?.risk_level ??
                      "LOW",
                  ],
                  ["Risk score", `${riskScore}%`],
                  ["Paste events", pasteCount],
                  [
                    "Decision",
                    result.advanced_stats?.decision_source ?? "model/rules",
                  ],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="min-w-0 overflow-hidden rounded-md border px-3 py-3"
                    style={{
                      borderColor: style.accent,
                      background: "rgba(255,255,255,0.45)",
                    }}
                  >
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.14em]"
                      style={{ color: style.text, opacity: 0.65 }}
                    >
                      {String(label)}
                    </p>
                    <p
                      className="mt-1 break-words text-[14px] font-extrabold leading-5"
                      style={{ color: style.text }}
                    >
                      {String(value)}
                    </p>
                  </div>
                ))}
              </div>

              {result.kill_switch_triggered && result.kill_switch_reason && (
                <div
                  className="mt-4 rounded-md border px-4 py-3 text-[12px] leading-6"
                  style={{
                    borderColor: style.accent,
                    color: style.text,
                    background: "rgba(0,0,0,0.04)",
                  }}
                >
                  {result.kill_switch_reason}
                </div>
              )}
            </section>

            <section
              className="rounded-md border bg-white p-5"
              style={{ borderColor: colors.surface[200] }}
            >
              <SidebarLabel>Core behavioral metrics</SidebarLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  ["Words per minute", result.stats.wpm],
                  ["Avg. IKI", `${result.stats.avgIki} ms`],
                  ["Keystrokes", result.stats.keystrokes],
                  ["Delete actions", result.stats.deletions],
                  [
                    "Chars removed",
                    result.stats.deletedCharacters ?? result.stats.deletions,
                  ],
                  ["Bulk deletes", result.stats.bulkDeletionEvents ?? 0],
                  ["Pauses", result.stats.pauses],
                  ["Duration", formatDuration(result.stats.sessionSeconds)],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-md border px-4 py-3"
                    style={{
                      borderColor: colors.surface[200],
                      background: colors.surface[50],
                    }}
                  >
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.14em]"
                      style={{ color: colors.text.muted }}
                    >
                      {String(label)}
                    </p>
                    <p
                      className="mt-1 text-[16px] font-extrabold"
                      style={{ color: colors.text.primary }}
                    >
                      {String(value)}
                    </p>
                  </div>
                ))}
              </div>

              {result.document_hash && (
                <div className="mt-5">
                  <SidebarLabel>Document fingerprint</SidebarLabel>
                  <p
                    className="break-all rounded-md border px-4 py-3 font-mono text-[10px] leading-6"
                    style={{
                      borderColor: colors.surface[200],
                      background: colors.surface[100],
                      color: colors.text.muted,
                    }}
                  >
                    {result.document_hash}
                  </p>
                </div>
              )}
            </section>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <section
              className="rounded-md border p-5"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[50],
              }}
            >
              <SidebarLabel>Human-supporting signals</SidebarLabel>
              <div className="space-y-2">
                {(humanSignals.length
                  ? humanSignals
                  : [
                      "No explicit human-supporting signals were returned by the analysis engine.",
                    ]
                ).map((signal) => (
                  <div
                    key={signal}
                    className="break-words rounded-md border px-3 py-2 text-[12px] leading-5"
                    style={{
                      borderColor: colors.surface[200],
                      background: colors.surface[100],
                      color: colors.text.secondary,
                    }}
                  >
                    {signal}
                  </div>
                ))}
              </div>
            </section>

            <section
              className="rounded-md border p-5"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[50],
              }}
            >
              <SidebarLabel>Review-risk signals</SidebarLabel>
              <div className="space-y-2">
                {(riskSignals.length
                  ? riskSignals
                  : [
                      "No major review-risk signals were returned by the analysis engine.",
                    ]
                ).map((signal) => (
                  <div
                    key={signal}
                    className="break-words rounded-md border px-3 py-2 text-[12px] leading-5"
                    style={{
                      borderColor: colors.surface[200],
                      background: colors.surface[100],
                      color: colors.text.secondary,
                    }}
                  >
                    {signal}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <div
          className="flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[50],
          }}
        >
          <button
            type="button"
            onClick={onNewSession}
            className="rounded-md border px-4 py-[10px] text-[13px] font-semibold transition hover:brightness-95"
            style={{
              borderColor: colors.surface[200],
              background: colors.surface[100],
              color: colors.text.secondary,
            }}
          >
            Start new session
          </button>

          {result.session_id && (
            <button
              type="button"
              onClick={() =>
                navigate(
                  ROUTES.REPLAY.replace(
                    ":sessionId",
                    String(result.session_id),
                  ),
                )
              }
              className="rounded-md border px-4 py-[10px] text-[13px] font-bold transition hover:brightness-95"
              style={{
                borderColor: colors.brand,
                background: colors.brandSoft,
                color: colors.brand,
              }}
            >
              View replay audit
            </button>
          )}

          {result.certificate_id && (
            <button
              type="button"
              onClick={() =>
                navigate(
                  ROUTES.VERIFY.replace(":certId", result.certificate_id!),
                )
              }
              className="rounded-md px-5 py-[10px] text-[13px] font-bold text-white transition hover:brightness-110"
              style={{ background: colors.brand }}
            >
              Verify certificate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function EditorPage() {
  const { showToast } = useToast();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeDraftId = searchParams.get("draftId");

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourse[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showDraftRecoveryModal, setShowDraftRecoveryModal] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.localStorage.getItem(EDITOR_CONSENT_STORAGE_KEY) !== "accepted",
  );
  useBodyScrollLock(
    showCourseModal ||
      showResultModal ||
      showDraftRecoveryModal ||
      showConsentModal,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<
    "saved" | "saving" | "local" | "unsaved"
  >("saved");
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [hasHydratedRouteDraft, setHasHydratedRouteDraft] = useState<
    string | null
  >(null);

  // Track whether user is actively typing (for CaptureBar pulse)
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suspendingDraftRef = useRef(false);
  const draftSaveErrorNotifiedRef = useRef(false);

  const {
    liveStats,
    handleKeyDown: baseHandleKeyDown,
    handleKeyUp: baseHandleKeyUp,
    handlePaste: baseHandlePaste,
    handleCut: baseHandleCut,
    handleBeforeInput: baseHandleBeforeInput,
    recordTextChange,
    rejectPendingInput,
    handleSelectionChange,
    getStats,
    resetCapture,
    hydrateCapture,
    getCaptureSnapshot,
  } = useKeystrokeCapture({ text, textareaRef });

  const userDraftId = String(user?.id ?? user?.email ?? "anonymous");
  const {
    recoveredDraft,
    hasCheckedDraft,
    isSavingDraft,
    saveDraft,
    clearDraft,
    clearLocalDraft,
    dismissRecoveredDraft,
  } = useEditorDraftRecovery({ userId: userDraftId, draftId: routeDraftId });

  const [captureTelemetry, setCaptureTelemetry] = useState({
    eventCount: 0,
    pasteEventCount: 0,
  });

  const syncCaptureTelemetry = useCallback(
    (events?: Array<{ type?: string; key?: string }>) => {
      const eventSource = events ?? getCaptureSnapshot().events;

      setCaptureTelemetry({
        eventCount: eventSource.length,
        pasteEventCount: countPasteEvents(eventSource),
      });
    },
    [getCaptureSnapshot],
  );

  const wordCount = useMemo(() => countWords(text), [text]);
  const charCount = text.length;
  const pasteEventCount = captureTelemetry.pasteEventCount;
  const hasCapturedEvents =
    captureTelemetry.eventCount > 0 ||
    liveStats.keystrokes > 0 ||
    pasteEventCount > 0;
  const hasPasteEvidence = pasteEventCount > 0 && text.trim().length > 0;
  const canAnalyze =
    (liveStats.keystrokes >= MINIMUM_KEYSTROKES || hasPasteEvidence) &&
    text.trim().length > 0;
  const keystrokePct = Math.min(
    100,
    Math.round((liveStats.keystrokes / MINIMUM_KEYSTROKES) * 100),
  );

  const fullName =
    `${user?.first_name ?? "Student"} ${user?.last_name ?? ""}`.trim();
  const initials =
    `${user?.first_name?.[0] ?? "S"}${user?.last_name?.[0] ?? ""}`.toUpperCase();

  // Wrap keydown to enforce document bounds before the capture engine logs
  // a mutation. A blocked browser edit must never remain as orphan evidence.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const insertedText = keyboardInsertionText(e);
    const selectionLength = Math.max(
      0,
      target.selectionEnd - target.selectionStart,
    );
    const projectedLength = text.length - selectionLength + insertedText.length;

    if (insertedText && projectedLength > MAX_EDITOR_TEXT_LENGTH) {
      e.preventDefault();
      showToast({
        type: "warning",
        title: "Document limit reached",
        message: "Cannot insert more characters into this session.",
      });
      return;
    }

    baseHandleKeyDown(e);
    syncCaptureTelemetry();
    setIsTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 1200);

    if (e.key !== "Tab") return;

    e.preventDefault();
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const nextText = `${text.slice(0, start)}    ${text.slice(end)}`;

    recordTextChange(nextText, { inputType: "insertText" });
    setText(nextText);
    syncCaptureTelemetry();

    window.requestAnimationFrame(() => {
      target.selectionStart = start + 4;
      target.selectionEnd = start + 4;
    });
  };

  const handleBeforeInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const native = e.nativeEvent as InputEvent;
    const insertedText = typeof native.data === "string" ? native.data : "";
    const inputType = native.inputType || "";
    const target = e.currentTarget;
    const selectionLength = Math.max(
      0,
      target.selectionEnd - target.selectionStart,
    );

    if (
      inputType.startsWith("insert") &&
      insertedText &&
      text.length - selectionLength + insertedText.length >
        MAX_EDITOR_TEXT_LENGTH
    ) {
      e.preventDefault();
      showToast({
        type: "warning",
        title: "Document limit reached",
        message: "This input would exceed the maximum document length.",
      });
      return;
    }

    baseHandleBeforeInput(e);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    baseHandleKeyUp(e);
    syncCaptureTelemetry();
  };

  const handleCut = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    baseHandleCut(e);
    syncCaptureTelemetry();
  };

  // Reject invalid paste operations before the capture engine records them.
  // This keeps the evidence event and the browser's actual text mutation aligned.
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData("text");
    const target = e.currentTarget;
    const selectionLength = Math.max(
      0,
      target.selectionEnd - target.selectionStart,
    );
    const nextDocumentLength =
      text.length - selectionLength + pastedText.length;

    if (pastedText.length > MAX_PASTE_LENGTH) {
      e.preventDefault();

      showToast({
        type: "warning",
        title: "Large paste blocked",
        message:
          "Very large paste events reduce evidence quality. Type or paste smaller sections.",
      });

      return;
    }

    if (nextDocumentLength > MAX_EDITOR_TEXT_LENGTH) {
      e.preventDefault();
      showToast({
        type: "warning",
        title: "Document limit reached",
        message:
          "This paste would exceed the maximum document length and was not recorded.",
      });
      return;
    }

    baseHandlePaste(e);
    syncCaptureTelemetry();
  };

  useEffect(() => {
    let mounted = true;

    async function loadEnrolledCourses() {
      try {
        const response = await api.get(API_ROUTES.courses.enrolled);

        if (!mounted) return;

        setEnrolledCourses(response.data?.courses ?? []);
      } catch (error) {
        if (!mounted) return;

        setEnrolledCourses([]);
        showToast({
          type: "warning",
          title: "Courses unavailable",
          message: getApiErrorMessage(error),
        });
      }
    }

    void loadEnrolledCourses();

    return () => {
      mounted = false;
    };
  }, [showToast]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const buildDraftSnapshot = useCallback(
    (options?: { pause?: boolean }) => {
      const snapshot = getCaptureSnapshot({ pause: options?.pause });

      return {
        title,
        text,
        selectedCourseId,
        keystrokeLog: snapshot.events,
        startedAt: snapshot.startedAt,
        lastActivityAt: snapshot.lastActivityAt,
        lastKeyDownTimestamp: snapshot.lastKeyDownTimestamp,
        activeDurationMs: snapshot.activeDurationMs,
        pausedAt: snapshot.pausedAt,
      };
    },
    [getCaptureSnapshot, selectedCourseId, text, title],
  );

  const hasRecoverableDraft = useMemo(() => {
    return Boolean(
      !analysisResult &&
      (text.trim().length > 0 || title.trim().length > 0 || hasCapturedEvents),
    );
  }, [analysisResult, hasCapturedEvents, text, title]);

  // Real autosave: persists text, title, course, keystroke evidence, and timing state.
  useEffect(() => {
    if (!hasRecoverableDraft) return;

    const timer = window.setTimeout(() => {
      if (suspendingDraftRef.current) return;
      setSaveState("saving");
      void saveDraft(buildDraftSnapshot(), { saveReason: "autosave" })
        .then((saved) => {
          draftSaveErrorNotifiedRef.current = false;
          setSaveState(saved.syncStatus === "SYNCED" ? "saved" : "local");
        })
        .catch((error) => {
          setSaveState("unsaved");
          if (draftSaveErrorNotifiedRef.current) return;
          draftSaveErrorNotifiedRef.current = true;
          showToast({
            type: "error",
            title: "Autosave failed",
            message: getApiErrorMessage(error),
          });
        });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [buildDraftSnapshot, hasRecoverableDraft, saveDraft, showToast]);

  // Emergency save on tab hide/reload. The hook writes a localStorage mirror first,
  // then IndexedDB, so this protects against refresh/crash as much as the browser allows.
  useEffect(() => {
    if (!hasRecoverableDraft) return;

    const persistImmediately = () => {
      if (suspendingDraftRef.current) return;
      void saveDraft(buildDraftSnapshot({ pause: true }), {
        saveReason: "recovery",
      }).catch((error) => {
        // localStorage is written synchronously before the asynchronous save.
        // Log the failure so page-hide work never becomes an unhandled promise.
        console.error("TypeTrace emergency draft save failed:", error);
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") persistImmediately();
    };

    window.addEventListener("pagehide", persistImmediately);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", persistImmediately);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [buildDraftSnapshot, hasRecoverableDraft, saveDraft]);

  useEffect(() => {
    if (!routeDraftId || !hasCheckedDraft || !recoveredDraft) return;
    if (hasHydratedRouteDraft === recoveredDraft.draftId) return;

    const timer = window.setTimeout(() => {
      setTitle(recoveredDraft.title || "");
      setText(recoveredDraft.text || "");
      setSelectedCourseId(recoveredDraft.selectedCourseId ?? null);
      setAnalysisResult(null);
      setShowResultModal(false);
      hydrateCapture({
        events: recoveredDraft.keystrokeLog,
        startedAt: recoveredDraft.startedAt,
        lastActivityAt: recoveredDraft.lastActivityAt,
        lastKeyDownTimestamp: recoveredDraft.lastKeyDownTimestamp,
        activeDurationMs: recoveredDraft.activeDurationMs,
        pausedAt: recoveredDraft.pausedAt,
      });
      syncCaptureTelemetry(recoveredDraft.keystrokeLog);
      setSaveState("saved");
      setHasHydratedRouteDraft(recoveredDraft.draftId);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    hasCheckedDraft,
    hasHydratedRouteDraft,
    hydrateCapture,
    recoveredDraft,
    routeDraftId,
    syncCaptureTelemetry,
  ]);

  // Show recovery prompt only after local draft lookup finishes.
  useEffect(() => {
    if (routeDraftId || !hasCheckedDraft || !recoveredDraft) return;
    if (recoveredDraft.saveReason === "manual") return;
    if (title.trim() || text.trim() || hasCapturedEvents) return;

    const timer = window.setTimeout(() => {
      setShowDraftRecoveryModal(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    hasCapturedEvents,
    hasCheckedDraft,
    recoveredDraft,
    routeDraftId,
    text,
    title,
  ]);

  // Cleanup typing timeout
  useEffect(
    () => () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    },
    [],
  );

  useEffect(() => {
    const hasActiveDraft =
      Boolean(text.trim()) && !analysisResult && liveStats.keystrokes > 0;

    if (!hasActiveDraft) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [text, analysisResult, liveStats.keystrokes]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const continueRecoveredDraft = () => {
    if (!recoveredDraft) return;

    setTitle(recoveredDraft.title || "");
    setText(recoveredDraft.text || "");
    setSelectedCourseId(recoveredDraft.selectedCourseId ?? null);
    setAnalysisResult(null);
    setShowResultModal(false);
    hydrateCapture({
      events: recoveredDraft.keystrokeLog,
      startedAt: recoveredDraft.startedAt,
      lastActivityAt: recoveredDraft.lastActivityAt,
      lastKeyDownTimestamp: recoveredDraft.lastKeyDownTimestamp,
      activeDurationMs: recoveredDraft.activeDurationMs,
      pausedAt: recoveredDraft.pausedAt,
    });
    syncCaptureTelemetry(recoveredDraft.keystrokeLog);
    dismissRecoveredDraft();
    setShowDraftRecoveryModal(false);
    setSaveState("saved");
    setSearchParams({ draftId: recoveredDraft.draftId }, { replace: true });

    showToast({
      type: "success",
      title: "Session restored",
      message:
        "Your unfinished document and captured evidence were restored locally.",
    });
  };

  const discardRecoveredDraft = async () => {
    try {
      await clearDraft(recoveredDraft?.draftId);
      dismissRecoveredDraft();
      setShowDraftRecoveryModal(false);

      showToast({
        type: "info",
        title: "Draft discarded",
        message:
          "The unfinished session was removed from this browser and server.",
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "Draft deletion failed",
        message: getApiErrorMessage(error),
      });
    }
  };

  const saveCurrentSessionAsDraft = async () => {
    if (!hasRecoverableDraft) {
      showToast({
        type: "info",
        title: "Nothing to save",
        message: "Start writing before saving this session as a draft.",
      });
      return;
    }

    setSaveState("saving");
    suspendingDraftRef.current = true;

    try {
      const saved = await saveDraft(buildDraftSnapshot({ pause: true }), {
        saveReason: "manual",
      });
      const synchronized = saved.syncStatus === "SYNCED";
      setSaveState(synchronized ? "saved" : "local");

      showToast({
        type: synchronized ? "success" : "warning",
        title: synchronized ? "Draft saved" : "Draft saved locally",
        message: synchronized
          ? "Your writing session was paused and synchronized to Drafts."
          : "The browser saved this draft locally, but server synchronization is still pending.",
      });

      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch {
      suspendingDraftRef.current = false;
      setSaveState("unsaved");
      showToast({
        type: "error",
        title: "Draft save failed",
        message:
          "The browser could not persist this draft. Copy your text before leaving this page.",
      });
    }
  };

  const acceptEditorConsent = () => {
    window.localStorage.setItem(EDITOR_CONSENT_STORAGE_KEY, "accepted");
    setShowConsentModal(false);
    showToast({
      type: "success",
      title: "Evidence capture enabled",
      message:
        "TypeTrace will now capture writing-process signals for this editor session.",
    });
  };

  const leaveEditorConsent = () => {
    navigate(ROUTES.DASHBOARD, { replace: true });
  };

  const openAnalyzeModal = () => {
    if (!text.trim()) {
      showToast({
        type: "error",
        title: "Nothing to analyze",
        message: "Write something in the editor before running analysis.",
      });
      return;
    }
    if (liveStats.keystrokes < MINIMUM_KEYSTROKES && pasteEventCount === 0) {
      showToast({
        type: "warning",
        title: "More evidence required",
        message: `Type at least ${MINIMUM_KEYSTROKES} keystrokes or capture a paste event. Current key capture: ${liveStats.keystrokes}.`,
      });
      return;
    }
    setShowCourseModal(true);
  };

  const confirmSubmit = async () => {
    if (isSubmitting) return;

    const finalText = text;
    const finalTitle = truncateTitle(title);
    const submitSnapshot = getCaptureSnapshot();
    const finalStats = getStats();
    const evidence = submitSnapshot.events;

    if (!finalText) {
      showToast({
        type: "warning",
        title: "Nothing to analyze",
        message: "Write something in the editor before running analysis.",
      });
      return;
    }

    if (finalText.length > MAX_EDITOR_TEXT_LENGTH) {
      showToast({
        type: "warning",
        title: "Document too long",
        message: "Reduce the document length before running analysis.",
      });
      return;
    }

    const finalPasteEvents = countPasteEvents(evidence);

    if (finalStats.keystrokes < MINIMUM_KEYSTROKES && finalPasteEvents === 0) {
      showToast({
        type: "warning",
        title: "More evidence required",
        message: `Type at least ${MINIMUM_KEYSTROKES} keystrokes or capture a paste event. Current key capture: ${finalStats.keystrokes}.`,
      });
      return;
    }

    if (!Array.isArray(evidence) || evidence.length === 0) {
      showToast({
        type: "error",
        title: "Evidence missing",
        message:
          "No keystroke evidence was captured. Start a new session and type directly in the editor.",
      });
      return;
    }

    if (finalStats.keystrokes < MINIMUM_KEYSTROKES && finalPasteEvents === 0) {
      showToast({
        type: "warning",
        title: "Insufficient evidence",
        message:
          "The captured event stream must contain either human typing evidence or paste evidence.",
      });
      return;
    }

    setIsSubmitting(true);
    suspendingDraftRef.current = true;
    let analysisCompleted = false;

    try {
      const savedDraft = await saveDraft(
        {
          title,
          text: finalText,
          selectedCourseId,
          keystrokeLog: evidence,
          startedAt: submitSnapshot.startedAt,
          lastActivityAt: submitSnapshot.lastActivityAt,
          lastKeyDownTimestamp: submitSnapshot.lastKeyDownTimestamp,
          activeDurationMs: submitSnapshot.activeDurationMs,
          pausedAt: submitSnapshot.pausedAt,
        },
        { saveReason: "manual" },
      );

      if (savedDraft.syncStatus !== "SYNCED") {
        setSaveState("local");
        showToast({
          type: "error",
          title: "Draft synchronization required",
          message:
            savedDraft.syncStatus === "CONFLICT"
              ? "The server has a newer draft version. Reload the draft and resolve the conflict before analysis."
              : "The latest evidence could not be synchronized to the server. Restore connectivity and retry analysis.",
        });
        return;
      }

      setSaveState("saved");
      const submittedDraftId = savedDraft.draftId;
      const submissionId = `draft:${submittedDraftId}`;
      const response = await api.post(API_ROUTES.sessions.analyze, {
        submission_id: submissionId,
        title: finalTitle,
        text_content: finalText,
        keystroke_array: evidence,
        stats: finalStats,
        course_id: selectedCourseId,
        active_duration_ms: submitSnapshot.activeDurationMs,
        draft_id: submittedDraftId,
        client_metadata: {
          source: routeDraftId ? "draft_resume" : "editor",
          localDraftId: submittedDraftId,
        },
      });

      const data = response.data;

      if (!data.session_id || !data.certificate_id || !data.document_hash) {
        showToast({
          type: "error",
          title: "Incomplete analysis response",
          message:
            "The server analyzed the session but did not return a complete evidence record.",
        });
        return;
      }

      analysisCompleted = true;
      setAnalysisResult({
        classification: data.classification,
        confidence: data.confidence_score,
        stats: data.stats ?? finalStats,
        kill_switch_triggered: data.kill_switch_triggered,
        kill_switch_reason: data.kill_switch_reason,
        certificate_id: data.certificate_id,
        document_hash: data.document_hash,
        session_id: data.session_id,
        risk_level: data.risk_level,
        risk_score: data.risk_score,
        submission_id: data.submission_id,
        idempotent_replay: Boolean(data.idempotent_replay),
        decision_source: data.decision_source,
        model_available: Boolean(data.model_available),
        degraded_analysis: Boolean(data.degraded_analysis),
        advanced_stats: {
          ...data.advanced_stats,
          decision_source:
            data.decision_source ?? data.advanced_stats?.decision_source,
          model_available:
            data.model_available ?? data.advanced_stats?.model_available,
          degraded_analysis:
            data.degraded_analysis ?? data.advanced_stats?.degraded_analysis,
        },
      });

      setShowCourseModal(false);
      setShowResultModal(true);
      setSaveState("saved");
      void clearLocalDraft(submittedDraftId).catch((error) => {
        showToast({
          type: "warning",
          title: "Local cleanup incomplete",
          message: getApiErrorMessage(error),
        });
      });
      setSearchParams({}, { replace: true });

      showToast({
        type: data.degraded_analysis ? "warning" : "success",
        title: data.degraded_analysis
          ? "Analysis complete in degraded mode"
          : "Analysis complete",
        message: data.degraded_analysis
          ? "The trained model was unavailable. Fallback rules were used and the certificate is labelled for manual review."
          : "Your behavioral evidence trail has been processed.",
      });
    } catch (error) {
      showToast({
        type: "error",
        title: "Analysis failed",
        message: getApiErrorMessage(error),
      });
    } finally {
      setIsSubmitting(false);
      if (!analysisCompleted) {
        suspendingDraftRef.current = false;
      }
    }
  };

  const closeResultAndReturnToDashboard = () => {
    setShowResultModal(false);
    setAnalysisResult(null);
    setShowCourseModal(false);
    setTitle("");
    setText("");
    setSelectedCourseId(null);
    setSaveState("saved");
    resetCapture();
    setCaptureTelemetry({ eventCount: 0, pasteEventCount: 0 });
    navigate(ROUTES.DASHBOARD, { replace: true });
  };

  const newSession = () => {
    setTitle("");
    setText("");
    setSelectedCourseId(null);
    setAnalysisResult(null);
    setShowCourseModal(false);
    setShowResultModal(false);
    setSaveState("saved");
    resetCapture();
    setCaptureTelemetry({ eventCount: 0, pasteEventCount: 0 });
    setSearchParams({}, { replace: true });

    showToast({
      type: "info",
      title: "New session started",
      message: "Begin writing to build a new behavioral evidence trail.",
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{ background: colors.surface[100] }}
    >
      {/* ── Top Header ─────────────────────────────────────────────────────── */}
      <header
        className="z-40 flex min-h-[52px] shrink-0 items-center justify-between gap-2 border-b bg-white px-3 py-2 sm:px-4"
        style={{ borderColor: colors.surface[200] }}
      >
        {/* Left: Logo + session name */}
        <div className="flex min-w-0 items-center gap-3">
          <Link to={ROUTES.DASHBOARD} className="shrink-0">
            <img
              src="/Logo.png"
              alt="TypeTrace"
              className="h-[26px] w-auto object-contain"
            />
          </Link>

          <div
            className="hidden h-4 w-px shrink-0 sm:block"
            style={{ background: colors.surface[200] }}
          />

          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setSaveState("unsaved");
            }}
            placeholder="Untitled document"
            className="min-w-0 max-w-[280px] border-none bg-transparent text-[14px] font-semibold outline-none placeholder:text-[14px]"
            style={{
              color: colors.text.primary,
            }}
            aria-label="Document title"
          />
        </div>

        {/* Right: status + actions */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-4">
          <div className="hidden md:block">
            <SaveIndicator
              state={isSavingDraft ? "saving" : saveState}
              offlineSafe={!isOnline}
            />
          </div>

          {/* Capture status pill */}
          <div
            className="hidden items-center gap-[6px] sm:flex"
            title={`${liveStats.keystrokes} of ${MINIMUM_KEYSTROKES} keystrokes captured`}
          >
            <div
              className="h-[6px] w-[48px] overflow-hidden rounded-md"
              style={{ background: colors.surface[200] }}
            >
              <div
                className="h-full rounded-md transition-all duration-500"
                style={{
                  width: `${keystrokePct}%`,
                  background: canAnalyze ? colors.green : colors.brand,
                }}
              />
            </div>
            <span
              className="text-[11px] font-medium tabular-nums"
              style={{ color: colors.text.muted }}
            >
              {canAnalyze
                ? "Ready"
                : pasteEventCount > 0
                  ? `${pasteEventCount} paste`
                  : `${liveStats.keystrokes}/${MINIMUM_KEYSTROKES}`}
            </span>
          </div>

          <div
            className="hidden h-4 w-px sm:block"
            style={{ background: colors.surface[200] }}
          />

          <Link
            to={ROUTES.DASHBOARD}
            className="hidden rounded-md border px-3 py-[6px] text-[12px] font-semibold transition-all duration-150 hover:brightness-95 lg:inline-flex"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.secondary,
              background: colors.surface[50],
            }}
          >
            Dashboard
          </Link>

          <button
            type="button"
            onClick={saveCurrentSessionAsDraft}
            disabled={!hasRecoverableDraft || isSubmitting}
            className="rounded-md border px-3 py-[6px] text-[12px] font-semibold transition-all duration-150 hover:brightness-95 disabled:opacity-40"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
              background: colors.surface[50],
            }}
          >
            <span className="hidden sm:inline">Save draft</span>
            <span className="sm:hidden">Save</span>
          </button>

          <button
            type="button"
            onClick={openAnalyzeModal}
            disabled={!canAnalyze || isSubmitting}
            className="flex items-center gap-2 rounded-md px-4 py-[7px] text-[12px] font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
            style={{ background: colors.brand }}
          >
            {/* Dot pulse when ready */}
            {canAnalyze && (
              <span className="h-[6px] w-[6px] animate-pulse rounded-md bg-white opacity-80" />
            )}
            <span className="hidden sm:inline">Analyze session</span>
            <span className="sm:hidden">Analyze</span>
          </button>
        </div>
      </header>

      {/* ── Body: Editor + Sidebar ──────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Editor column */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Editor toolbar strip */}
          <div
            className="flex min-h-[40px] shrink-0 items-center justify-between gap-3 border-b px-3 py-2 sm:px-5"
            style={{
              borderColor: colors.surface[200],
              background: colors.surface[50],
            }}
          >
            <div className="flex min-w-0 items-center gap-3 sm:gap-5">
              <span
                className="text-[11px] font-medium tabular-nums"
                style={{ color: colors.text.muted }}
              >
                {wordCount.toLocaleString()} words
              </span>
              <span
                className="text-[11px] tabular-nums"
                style={{ color: colors.text.muted }}
              >
                {charCount.toLocaleString()} chars
              </span>
              <span
                className="hidden rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] sm:inline-flex"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[100],
                  color: isOnline ? colors.text.muted : colors.amber,
                }}
              >
                {isOnline ? "Autosave active" : "Offline safe"}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-4">
              {/* Live typing signal */}
              {isTyping && (
                <div className="flex items-center gap-[5px]">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="inline-block h-[5px] w-[5px] rounded-md"
                      style={{
                        background: colors.brand,
                        animation: `bounce 0.8s ease-in-out ${i * 0.12}s infinite`,
                      }}
                    />
                  ))}
                </div>
              )}
              <span
                className="text-[11px] font-medium tabular-nums"
                style={{
                  color: isTyping ? colors.brand : colors.text.muted,
                }}
              >
                {isTyping ? "Capturing" : "Idle"}
              </span>
            </div>
          </div>

          {/* Capture progress bar - the signature element */}
          <CaptureBar
            keystrokes={liveStats.keystrokes}
            ready={canAnalyze}
            active={isTyping}
          />

          <details
            className="border-b bg-white px-4 py-2 xl:hidden"
            style={{ borderColor: colors.surface[200] }}
          >
            <summary
              className="touch-target flex cursor-pointer list-none items-center justify-between text-[12px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              <span>Session evidence</span>
              <span style={{ color: colors.text.muted }}>
                {liveStats.keystrokes} keys · {liveStats.wpm} WPM
              </span>
            </summary>
            <div className="grid grid-cols-2 gap-3 pb-3 pt-2 sm:grid-cols-4">
              {[
                ["Words", wordCount],
                ["Duration", formatDuration(liveStats.sessionSeconds)],
                ["Pauses", liveStats.pauses],
                ["Paste events", pasteEventCount],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-md border p-3"
                  style={{
                    borderColor: colors.surface[200],
                    background: colors.surface[100],
                  }}
                >
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: colors.text.muted }}
                  >
                    {String(label)}
                  </p>
                  <p
                    className="mt-1 font-mono text-[13px] font-bold tabular-nums"
                    style={{ color: colors.text.primary }}
                  >
                    {String(value)}
                  </p>
                </div>
              ))}
            </div>
          </details>

          {/* Textarea */}
          <div className="scroll-region flex-1 overflow-y-auto bg-white px-4 pb-24 pt-5 sm:px-10 sm:pt-6 md:px-16 lg:px-24">
            <textarea
              ref={textareaRef}
              value={text}
              onBeforeInput={handleBeforeInput}
              onChange={(e) => {
                const nextValue = e.target.value;

                if (nextValue.length > MAX_EDITOR_TEXT_LENGTH) {
                  const limitedValue = nextValue.slice(
                    0,
                    MAX_EDITOR_TEXT_LENGTH,
                  );

                  showToast({
                    type: "warning",
                    title: "Document limit reached",
                    message: `TypeTrace supports up to ${MAX_EDITOR_TEXT_LENGTH.toLocaleString()} characters per session.`,
                  });

                  rejectPendingInput();
                  recordTextChange(limitedValue, {
                    inputType: "historyBlockedInput",
                  });
                  setText(limitedValue);
                  syncCaptureTelemetry();
                  return;
                }

                recordTextChange(nextValue);
                setText(nextValue);
                syncCaptureTelemetry();
                setSaveState("unsaved");
                setAnalysisResult(null);
              }}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onPaste={handlePaste}
              onCut={handleCut}
              onSelect={handleSelectionChange}
              placeholder="Start writing here. TypeTrace quietly captures your behavioral evidence in the background - timing, pauses, deletions, and rhythm that only a human writer produces."
              className="h-full min-h-[calc(100dvh-250px)] w-full resize-none border-none bg-transparent text-[16px] leading-[1.75] outline-none placeholder:text-[15px] sm:min-h-[480px] sm:leading-[1.85]"
              style={{
                color: colors.text.primary,
              }}
              aria-label="Writing workspace"
              spellCheck
            />
          </div>
        </main>

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside
          className="hidden w-[300px] shrink-0 flex-col overflow-y-auto border-l xl:flex"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[50],
          }}
        >
          {/* Live telemetry view */}
          <>
            {/* Session identity */}
            <div
              className="border-b p-5"
              style={{ borderColor: colors.surface[200] }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white"
                  style={{ background: colors.brand }}
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <p
                    className="truncate text-[13px] font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {fullName}
                  </p>
                  <p
                    className="truncate text-[11px]"
                    style={{ color: colors.text.muted }}
                  >
                    {user?.email}
                  </p>
                </div>
              </div>

              {/* Capture status */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.16em]"
                    style={{ color: colors.text.muted }}
                  >
                    Capture threshold
                  </span>
                  <span
                    className="text-[11px] font-bold tabular-nums"
                    style={{
                      color: canAnalyze ? colors.green : colors.brand,
                    }}
                  >
                    {canAnalyze
                      ? "Ready"
                      : pasteEventCount > 0
                        ? `${pasteEventCount} paste event`
                        : `${liveStats.keystrokes} / ${MINIMUM_KEYSTROKES}`}
                  </span>
                </div>
                <div
                  className="h-[4px] w-full overflow-hidden rounded-md"
                  style={{ background: colors.surface[200] }}
                >
                  <div
                    className="h-full rounded-md transition-all duration-500"
                    style={{
                      width: `${keystrokePct}%`,
                      background: canAnalyze ? colors.green : colors.brand,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Live writing metrics */}
            <div
              className="border-b px-5 pt-5 pb-4"
              style={{ borderColor: colors.surface[200] }}
            >
              <SidebarLabel>Writing</SidebarLabel>
              <StatRow
                label="Words"
                value={wordCount.toLocaleString()}
                highlight
              />
              <StatRow label="Characters" value={charCount.toLocaleString()} />
              <StatRow label="WPM" value={liveStats.wpm} accent />
              <StatRow
                label="Duration"
                value={formatDuration(liveStats.sessionSeconds)}
              />
            </div>

            {/* Live behavioral metrics */}
            <div
              className="border-b px-5 pt-5 pb-4"
              style={{ borderColor: colors.surface[200] }}
            >
              <SidebarLabel>Behavioral signal</SidebarLabel>
              <StatRow
                label="Keystrokes"
                value={liveStats.keystrokes}
                highlight
              />
              <StatRow label="Delete actions" value={liveStats.deletions} />
              <StatRow
                label="Chars removed"
                value={(liveStats.deletedCharacters ?? 0).toLocaleString()}
              />
              <StatRow
                label="Bulk deletes"
                value={liveStats.bulkDeletionEvents ?? 0}
              />
              <StatRow label="Paste events" value={pasteEventCount} />
              <StatRow label="Pauses (>1s)" value={liveStats.pauses} />
              <StatRow
                label="Avg IKI"
                value={`${liveStats.avgIki} ms`}
                accent
              />
            </div>

            {/* Evidence trail info */}
            <div className="p-5">
              <SidebarLabel>What's being captured</SidebarLabel>
              <div className="space-y-3">
                {[
                  {
                    icon: (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <rect
                          x="1"
                          y="1"
                          width="10"
                          height="10"
                          rx="2"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                        <path
                          d="M4 6h4M6 4v4"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                      </svg>
                    ),
                    label: "Keystroke timing",
                    detail: "Dwell & flight times per key",
                  },
                  {
                    icon: (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <circle
                          cx="6"
                          cy="6"
                          r="4.5"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                        <path
                          d="M6 3.5V6l1.5 1.5"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                      </svg>
                    ),
                    label: "Pause detection",
                    detail: "Cognitive breaks >1 second",
                  },
                  {
                    icon: (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M2 9l2-2 2 2 4-6"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ),
                    label: "Revision patterns",
                    detail: "Deletions and corrections",
                  },
                  {
                    icon: (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M3 6a3 3 0 016 0"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M1 6h10"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeOpacity="0.4"
                        />
                        <circle cx="6" cy="9" r="1.5" fill="currentColor" />
                      </svg>
                    ),
                    label: "Document hash",
                    detail: "Tamper-evident content fingerprint",
                  },
                ].map(({ icon, label, detail }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div
                      className="mt-[2px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md"
                      style={{
                        background: colors.brandSoft,
                        color: colors.brand,
                      }}
                    >
                      {icon}
                    </div>
                    <div>
                      <p
                        className="text-[12px] font-semibold"
                        style={{ color: colors.text.primary }}
                      >
                        {String(label)}
                      </p>
                      <p
                        className="text-[11px]"
                        style={{ color: colors.text.muted }}
                      >
                        {detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        </aside>
      </div>

      {/* ── Bottom status bar ────────────────────────────────────────────────── */}
      <div
        className="z-40 flex min-h-[42px] shrink-0 items-center justify-between gap-3 border-t bg-white px-3 py-1 sm:h-[36px] sm:px-5"
        style={{ borderColor: colors.surface[200] }}
      >
        {/* Left: session breadcrumb */}
        <div
          className="hidden min-w-0 items-center gap-2 text-[11px] sm:flex"
          style={{ color: colors.text.muted }}
        >
          <Link
            to={ROUTES.DASHBOARD}
            className="font-medium hover:underline"
            style={{ color: colors.text.muted }}
          >
            Dashboard
          </Link>
          <span>/</span>
          <span style={{ color: colors.text.secondary }}>Editor</span>
          {title && (
            <>
              <span>/</span>
              <span
                className="max-w-[180px] truncate font-medium"
                style={{ color: colors.text.primary }}
              >
                {title}
              </span>
            </>
          )}
        </div>

        {/* Right: live stat chips */}
        <div className="scroll-region flex min-w-0 flex-1 items-center justify-end gap-3 overflow-x-auto sm:gap-[18px]">
          {[
            { label: "Words", value: wordCount },
            { label: "Keys", value: liveStats.keystrokes },
            { label: "Paste", value: pasteEventCount },
            { label: "WPM", value: liveStats.wpm },
            { label: "Time", value: formatDuration(liveStats.sessionSeconds) },
          ].map(({ label, value }) => (
            <div
              key={label}
              className={`items-center gap-[5px] ${
                label === "Keys" || label === "Paste" || label === "WPM"
                  ? "hidden sm:flex"
                  : "flex"
              }`}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: colors.text.muted }}
              >
                {label}
              </span>
              <span
                className="text-[11px] font-bold tabular-nums"
                style={{ color: colors.text.primary }}
              >
                {String(value)}
              </span>
            </div>
          ))}

          {/* Capture state indicator */}
          <div
            className="flex items-center gap-[5px] rounded-md border px-[8px] py-[3px]"
            style={{
              borderColor: canAnalyze ? colors.green : colors.surface[200],
              background: canAnalyze ? colors.mintTint : colors.surface[100],
            }}
          >
            <span
              className="h-[5px] w-[5px] rounded-md"
              style={{
                background: canAnalyze ? colors.green : colors.surface[300],
              }}
            />
            <span
              className="text-[10px] font-bold"
              style={{
                color: canAnalyze ? brand.humanText : colors.text.muted,
              }}
            >
              {canAnalyze ? "Ready to analyze" : "Capturing"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Course selector modal ────────────────────────────────────────────── */}
      {showCourseModal && (
        <CourseSelectorModal
          courses={enrolledCourses}
          selectedCourseId={selectedCourseId}
          onSelect={setSelectedCourseId}
          onCancel={() => setShowCourseModal(false)}
          onConfirm={confirmSubmit}
          isSubmitting={isSubmitting}
        />
      )}

      {showConsentModal && (
        <EditorConsentModal
          onAccept={acceptEditorConsent}
          onLeave={leaveEditorConsent}
        />
      )}

      {showDraftRecoveryModal && recoveredDraft && (
        <DraftRecoveryModal
          draft={recoveredDraft}
          onContinue={continueRecoveredDraft}
          onDiscard={discardRecoveredDraft}
        />
      )}

      {showResultModal && analysisResult && (
        <AnalysisResultModal
          result={analysisResult}
          onClose={closeResultAndReturnToDashboard}
          onNewSession={newSession}
        />
      )}

      {/* ── Global keyframe styles ────────────────────────────────────────────── */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-3px); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
