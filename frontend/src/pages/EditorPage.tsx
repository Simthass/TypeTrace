// frontend/src/pages/EditorPage.tsx

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ROUTES } from "../constants/routes";
import { useKeystrokeCapture } from "../hooks/useKeystrokeCapture";
import { api, getApiErrorMessage } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { brand, colors } from "../styles/colors";
import type { AnalysisResult, EnrolledCourse } from "../types/editor";

const MINIMUM_KEYSTROKES = 30;

function countWords(value: string): number {
  const clean = value.trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function getResultStyle(classification: string) {
  const normalized = classification.toUpperCase();

  if (normalized === "HUMAN") {
    return {
      label: "Human Writing Pattern",
      bg: brand.humanBg,
      text: brand.humanText,
      accent: brand.humanAccent,
    };
  }

  if (normalized === "SUSPICIOUS") {
    return {
      label: "Review Recommended",
      bg: brand.suspiciousBg,
      text: brand.suspiciousText,
      accent: brand.suspiciousAccent,
    };
  }

  return {
    label: "High Risk Pattern",
    bg: brand.aiBg,
    text: brand.aiText,
    accent: brand.aiAccent,
  };
}

function MetricPill({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      className="rounded-md border px-3 py-2"
      style={{
        borderColor: colors.surface[200],
        background: colors.surface[50],
      }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: colors.text.secondary }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-[15px] font-bold"
        style={{ color: colors.text.primary }}
      >
        {value}
      </p>
    </div>
  );
}

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
  onSelect: (courseId: number | null) => void;
  onCancel: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(15, 23, 42, 0.48)" }}
        onClick={onCancel}
      />

      <div
        className="relative z-10 w-full max-w-[520px] rounded-2xl border bg-white p-6"
        style={{
          borderColor: colors.surface[200],
          boxShadow: `0 28px 100px -44px ${colors.shadowStrong}`,
        }}
      >
        <p
          className="text-[11px] font-bold uppercase tracking-[0.18em]"
          style={{ color: colors.brand }}
        >
          Submit session
        </p>

        <h2
          className="mt-2 text-2xl font-bold tracking-[-0.04em]"
          style={{ color: colors.text.primary }}
        >
          Where should this evidence trail be linked?
        </h2>

        <p
          className="mt-3 text-[14px] leading-6"
          style={{ color: colors.text.secondary }}
        >
          Select a course if this writing session belongs to an academic module,
          or keep it as a personal session.
        </p>

        <div className="mt-5 grid gap-3">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="rounded-md border px-4 py-3 text-left transition"
            style={{
              borderColor:
                selectedCourseId === null ? colors.brand : colors.surface[200],
              background:
                selectedCourseId === null
                  ? colors.brandSoft
                  : colors.surface[50],
            }}
          >
            <p
              className="text-[14px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Personal session
            </p>
            <p
              className="mt-1 text-[12px]"
              style={{ color: colors.text.secondary }}
            >
              Keep this writing session inside your private workspace.
            </p>
          </button>

          {courses.map((course) => (
            <button
              key={course.id}
              type="button"
              onClick={() => onSelect(course.id)}
              className="rounded-md border px-4 py-3 text-left transition"
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
              <p
                className="text-[14px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                {course.course_name}
              </p>
              <p
                className="mt-1 text-[12px]"
                style={{ color: colors.text.secondary }}
              >
                {course.course_code}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border px-4 py-2 text-[13px] font-semibold"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
              background: colors.surface[50],
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="rounded-md px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
            style={{ background: colors.brand }}
          >
            {isSubmitting ? "Analyzing..." : "Analyze session"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultPanel({
  result,
  onNewSession,
}: {
  result: AnalysisResult;
  onNewSession: () => void;
}) {
  const style = getResultStyle(result.classification);

  return (
    <aside
      className="rounded-2xl border bg-white p-5"
      style={{
        borderColor: colors.surface[200],
        boxShadow: `0 22px 70px -48px ${colors.shadowStrong}`,
      }}
    >
      <div
        className="rounded-xl border p-5"
        style={{
          borderColor: style.accent,
          background: style.bg,
          color: style.text,
        }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.16em]">
          Authorship result
        </p>

        <h2 className="mt-3 text-[2.4rem] font-extrabold tracking-[-0.05em]">
          {Math.round(result.confidence)}%
        </h2>

        <p className="mt-1 text-[14px] font-semibold">{style.label}</p>

        {result.kill_switch_triggered && result.kill_switch_reason && (
          <p className="mt-3 text-[12px] leading-5">
            {result.kill_switch_reason}
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricPill label="WPM" value={result.stats.wpm} />
        <MetricPill label="IKI" value={`${result.stats.avgIki}ms`} />
        <MetricPill label="Keys" value={result.stats.keystrokes} />
        <MetricPill label="Pauses" value={result.stats.pauses} />
      </div>

      {result.document_hash && (
        <div
          className="mt-4 rounded-md border p-3"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[100],
          }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: colors.text.secondary }}
          >
            Document hash
          </p>
          <p
            className="mt-2 break-all font-mono text-[11px]"
            style={{ color: colors.text.primary }}
          >
            {result.document_hash}
          </p>
        </div>
      )}

      <div className="mt-5 grid gap-2">
        {result.session_id && (
          <Link
            to={ROUTES.REPLAY.replace(":sessionId", String(result.session_id))}
            className="rounded-md px-4 py-2.5 text-center text-[13px] font-semibold text-white"
            style={{ background: colors.brand }}
          >
            View replay audit
          </Link>
        )}

        {result.certificate_id && (
          <Link
            to={`/verify/${result.certificate_id}`}
            className="rounded-md border px-4 py-2.5 text-center text-[13px] font-semibold"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          >
            Verify certificate
          </Link>
        )}

        <button
          type="button"
          onClick={onNewSession}
          className="rounded-md border px-4 py-2.5 text-[13px] font-semibold"
          style={{
            borderColor: colors.surface[200],
            color: colors.text.secondary,
            background: colors.surface[50],
          }}
        >
          Start new session
        </button>
      </div>
    </aside>
  );
}

export default function EditorPage() {
  const { user } = useAuthStore();

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourse[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );
  const [apiError, setApiError] = useState<string | null>(null);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    keystrokeLogRef,
    liveStats,
    handleKeyDown,
    handleKeyUp,
    handlePaste,
    getStats,
    resetCapture,
  } = useKeystrokeCapture({ text });

  const wordCount = useMemo(() => countWords(text), [text]);
  const charCount = text.length;

  const fullName =
    `${user?.first_name || "Student"} ${user?.last_name || ""}`.trim();

  const canAnalyze =
    liveStats.keystrokes >= MINIMUM_KEYSTROKES && text.trim().length > 0;

  useEffect(() => {
    let mounted = true;

    async function loadCourses() {
      try {
        const response = await api.get("/courses/enrolled");
        if (!mounted) return;
        setEnrolledCourses(response.data?.courses || []);
      } catch {
        if (!mounted) return;
        setEnrolledCourses([]);
      }
    }

    loadCourses();

    return () => {
      mounted = false;
    };
  }, []);

  const openAnalyzeModal = () => {
    setApiError(null);

    if (!text.trim()) {
      setApiError("Please write something before analyzing the session.");
      return;
    }

    if (liveStats.keystrokes < MINIMUM_KEYSTROKES) {
      setApiError(
        `Please type at least ${MINIMUM_KEYSTROKES} keystrokes before analysis. Current: ${liveStats.keystrokes}.`,
      );
      return;
    }

    setShowCourseModal(true);
  };

  const confirmSubmit = async () => {
    setIsSubmitting(true);
    setApiError(null);

    try {
      const finalStats = getStats();

      const response = await api.post("/sessions/analyze", {
        title: title.trim() || "Untitled Document",
        text_content: text,
        keystroke_array: keystrokeLogRef.current,
        stats: finalStats,
        course_id: selectedCourseId,
      });

      setAnalysisResult({
        classification: response.data.classification,
        confidence: response.data.confidence_score,
        stats: finalStats,
        advanced_stats: response.data.advanced_stats,
        kill_switch_triggered: response.data.kill_switch_triggered,
        kill_switch_reason: response.data.kill_switch_reason,
        certificate_id: response.data.certificate_id,
        document_hash: response.data.document_hash,
        session_id: response.data.session_id,
      });

      setShowCourseModal(false);
    } catch (error) {
      setApiError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const newSession = () => {
    setTitle("");
    setText("");
    setSelectedCourseId(null);
    setAnalysisResult(null);
    setApiError(null);
    resetCapture();
  };

  return (
    <main
      className="min-h-screen pb-20"
      style={{ background: colors.surface[100] }}
    >
      <header
        className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur"
        style={{ borderColor: colors.surface[200] }}
      >
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-5">
            <Link to={ROUTES.DASHBOARD} className="flex items-center">
              <img
                src="/Logo.png"
                alt="TypeTrace"
                className="h-[30px] w-auto object-contain"
              />
            </Link>

            <div
              className="hidden h-7 w-px md:block"
              style={{ background: colors.surface[200] }}
            />

            <div className="hidden md:block">
              <p
                className="text-[11px] font-bold uppercase tracking-[0.16em]"
                style={{ color: colors.brand }}
              >
                Live writing workspace
              </p>
              <p
                className="text-[13px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                Capture evidence while you write naturally
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={ROUTES.DASHBOARD}
              className="rounded-md border px-3 py-2 text-[13px] font-semibold"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
                background: colors.surface[50],
              }}
            >
              Dashboard
            </Link>

            <button
              type="button"
              onClick={openAnalyzeModal}
              disabled={!canAnalyze || isSubmitting}
              className="rounded-md px-4 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: colors.brand }}
            >
              Analyze
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1500px] grid-cols-1 gap-5 px-5 py-5 xl:grid-cols-[1fr_360px]">
        <div
          className="overflow-hidden rounded-2xl border bg-white"
          style={{
            borderColor: colors.surface[200],
            boxShadow: `0 24px 90px -58px ${colors.shadowStrong}`,
          }}
        >
          <div
            className="flex flex-col gap-4 border-b px-5 py-4 md:flex-row md:items-center md:justify-between"
            style={{ borderColor: colors.surface[200] }}
          >
            <div className="min-w-0 flex-1">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Untitled academic document"
                className="w-full border-none bg-transparent text-[1.65rem] font-bold tracking-[-0.05em] outline-none"
                style={{ color: colors.text.primary }}
              />

              <p
                className="mt-1 text-[12px]"
                style={{ color: colors.text.secondary }}
              >
                Every keystroke, pause, correction, and paste event is captured
                as behavioral evidence.
              </p>
            </div>

            <div
              className="rounded-md border px-3 py-2 text-[12px] font-semibold"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[100],
                color: colors.text.secondary,
              }}
            >
              {liveStats.keystrokes < MINIMUM_KEYSTROKES
                ? `${MINIMUM_KEYSTROKES - liveStats.keystrokes} more keys needed`
                : "Ready for analysis"}
            </div>
          </div>

          {apiError && (
            <div
              className="mx-5 mt-5 rounded-md border px-4 py-3 text-[13px]"
              style={{
                borderColor: brand.aiAccent,
                background: brand.aiBg,
                color: brand.aiText,
              }}
            >
              {apiError}
            </div>
          )}

          <div className="p-5">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onPaste={handlePaste}
              placeholder="Start writing here. TypeTrace will quietly capture your writing process in the background."
              className="min-h-[calc(100vh-285px)] w-full resize-none rounded-xl border px-5 py-5 text-[16px] leading-8 outline-none transition focus:ring-2"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[50],
                color: colors.text.primary,
              }}
            />
          </div>
        </div>

        <div className="space-y-5">
          {analysisResult ? (
            <ResultPanel result={analysisResult} onNewSession={newSession} />
          ) : (
            <aside
              className="rounded-2xl border bg-white p-5"
              style={{
                borderColor: colors.surface[200],
                boxShadow: `0 22px 70px -48px ${colors.shadowStrong}`,
              }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-[0.16em]"
                style={{ color: colors.brand }}
              >
                Live telemetry
              </p>

              <h2
                className="mt-2 text-xl font-bold tracking-[-0.04em]"
                style={{ color: colors.text.primary }}
              >
                Session signal quality
              </h2>

              <p
                className="mt-2 text-[13px] leading-6"
                style={{ color: colors.text.secondary }}
              >
                The system needs enough natural typing behavior before it can
                generate a reliable authorship result.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <MetricPill label="Words" value={wordCount} />
                <MetricPill label="Characters" value={charCount} />
                <MetricPill label="Keystrokes" value={liveStats.keystrokes} />
                <MetricPill label="Deletions" value={liveStats.deletions} />
                <MetricPill label="WPM" value={liveStats.wpm} />
                <MetricPill
                  label="Duration"
                  value={formatDuration(liveStats.sessionSeconds)}
                />
                <MetricPill label="Pauses" value={liveStats.pauses} />
                <MetricPill label="Avg IKI" value={`${liveStats.avgIki}ms`} />
              </div>
            </aside>
          )}

          <aside
            className="rounded-2xl border bg-white p-5"
            style={{ borderColor: colors.surface[200] }}
          >
            <p
              className="text-[11px] font-bold uppercase tracking-[0.16em]"
              style={{ color: colors.text.secondary }}
            >
              Writing evidence
            </p>

            <div className="mt-4 grid gap-3">
              {[
                [
                  "Behavioral capture",
                  "Keydown, keyup, dwell and flight timing",
                ],
                [
                  "Integrity trail",
                  "Session evidence prepared for certificate sealing",
                ],
                [
                  "Replay ready",
                  "Teachers can review suspicious sessions later",
                ],
              ].map(([titleValue, desc]) => (
                <div
                  key={titleValue}
                  className="rounded-md border p-3"
                  style={{
                    borderColor: colors.surface[200],
                    background: colors.surface[50],
                  }}
                >
                  <p
                    className="text-[13px] font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {titleValue}
                  </p>
                  <p
                    className="mt-1 text-[12px] leading-5"
                    style={{ color: colors.text.secondary }}
                  >
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <footer
        className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur"
        style={{ borderColor: colors.surface[200] }}
      >
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-5 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-md border text-[12px] font-bold"
              style={{
                borderColor: colors.surface[200],
                background: colors.brandSoft,
                color: colors.brand,
              }}
            >
              {user?.first_name?.[0] || "S"}
            </div>

            <div className="min-w-0">
              <p
                className="text-[10px] font-bold uppercase tracking-[0.16em]"
                style={{ color: colors.text.secondary }}
              >
                Student workspace
              </p>
              <p
                className="truncate text-[13px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                {fullName}
              </p>
              <p
                className="truncate text-[12px]"
                style={{ color: colors.text.secondary }}
              >
                {user?.email}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 md:flex">
            <MetricPill label="Words" value={wordCount} />
            <MetricPill label="Keys" value={liveStats.keystrokes} />
            <MetricPill label="WPM" value={liveStats.wpm} />
            <MetricPill
              label="Time"
              value={formatDuration(liveStats.sessionSeconds)}
            />
          </div>
        </div>
      </footer>

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
    </main>
  );
}
