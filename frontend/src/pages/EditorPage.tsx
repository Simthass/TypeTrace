// frontend/src/pages/EditorPage.tsx

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";
import { api, getApiErrorMessage } from "../lib/api";
import { useKeystrokeCapture } from "../hooks/useKeystrokeCapture";
import type { AnalysisResult, EnrolledCourse } from "../types/editor";

const MINIMUM_KEYSTROKES = 30;

function countWords(value: string): number {
  const clean = value.trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getClassificationStyles(classification: string) {
  const normalized = classification.toUpperCase();

  if (normalized === "HUMAN") {
    return {
      background: brand.humanBg,
      color: brand.humanText,
      borderColor: brand.humanAccent,
      label: "Human Writing Pattern",
    };
  }

  if (normalized === "SUSPICIOUS") {
    return {
      background: brand.suspiciousBg,
      color: brand.suspiciousText,
      borderColor: brand.suspiciousAccent,
      label: "Suspicious Writing Pattern",
    };
  }

  return {
    background: brand.aiBg,
    color: brand.aiText,
    borderColor: brand.aiAccent,
    label: "Synthetic Writing Pattern",
  };
}

interface CourseSelectorModalProps {
  courses: EnrolledCourse[];
  selectedCourseId: number | null;
  onSelect: (courseId: number | null) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

function CourseSelectorModal({
  courses,
  selectedCourseId,
  onSelect,
  onConfirm,
  onCancel,
  isSubmitting,
}: CourseSelectorModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div
        className="w-full max-w-lg rounded-md border bg-white shadow-xl"
        style={{ borderColor: colors.surface[200] }}
      >
        <div
          className="border-b px-5 py-4"
          style={{ borderColor: colors.surface[200] }}
        >
          <h2
            className="text-[15px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Attach this writing session
          </h2>
          <p
            className="mt-1 text-[13px]"
            style={{ color: colors.text.secondary }}
          >
            Choose a course if this submission belongs to one. You can also
            submit it as a personal writing session.
          </p>
        </div>

        <div className="max-h-80 overflow-y-auto p-3">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="mb-2 flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition-colors"
            style={{
              borderColor:
                selectedCourseId === null ? colors.brand : colors.surface[200],
              background:
                selectedCourseId === null
                  ? brand.bgNavActive
                  : colors.surface[50],
            }}
          >
            <div>
              <p
                className="text-[13px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                Personal session
              </p>
              <p
                className="text-[12px]"
                style={{ color: colors.text.secondary }}
              >
                Not linked to a course
              </p>
            </div>
            {selectedCourseId === null && (
              <span
                className="text-[12px] font-semibold"
                style={{ color: colors.brand }}
              >
                Selected
              </span>
            )}
          </button>

          {courses.map((course) => (
            <button
              key={course.id}
              type="button"
              onClick={() => onSelect(course.id)}
              className="mb-2 flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition-colors"
              style={{
                borderColor:
                  selectedCourseId === course.id
                    ? colors.brand
                    : colors.surface[200],
                background:
                  selectedCourseId === course.id
                    ? brand.bgNavActive
                    : colors.surface[50],
              }}
            >
              <div>
                <p
                  className="text-[13px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  {course.course_name}
                </p>
                <p
                  className="text-[12px]"
                  style={{ color: colors.text.secondary }}
                >
                  {course.course_code}
                </p>
              </div>
              {selectedCourseId === course.id && (
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: colors.brand }}
                >
                  Selected
                </span>
              )}
            </button>
          ))}
        </div>

        <div
          className="flex items-center justify-end gap-2 border-t px-5 py-4"
          style={{ borderColor: colors.surface[200] }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-md border px-4 py-2 text-[13px] font-semibold"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.secondary,
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

interface AnalysisScreenProps {
  result: AnalysisResult;
  courseName: string | null;
  onNewSession: () => void;
}

function AnalysisScreen({
  result,
  courseName,
  onNewSession,
}: AnalysisScreenProps) {
  const classificationStyle = getClassificationStyles(result.classification);

  return (
    <div
      className="min-h-screen px-6 py-8"
      style={{ background: colors.surface[50] }}
    >
      <div className="mx-auto max-w-5xl">
        <div
          className="rounded-md border bg-white p-6 shadow-sm"
          style={{ borderColor: colors.surface[200] }}
        >
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <p
                className="text-[12px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: colors.text.secondary }}
              >
                TypeTrace analysis complete
              </p>
              <h1
                className="mt-2 text-2xl font-semibold"
                style={{ color: colors.text.primary }}
              >
                Writing authenticity report
              </h1>
              <p
                className="mt-2 max-w-2xl text-[14px]"
                style={{ color: colors.text.secondary }}
              >
                This result is based on keystroke timing, writing rhythm,
                deletion behavior, pauses, paste events, and machine learning
                inference.
              </p>
            </div>

            <div
              className="rounded-md border px-4 py-3 text-right"
              style={{
                background: classificationStyle.background,
                color: classificationStyle.color,
                borderColor: classificationStyle.borderColor,
              }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em]">
                Classification
              </p>
              <p className="mt-1 text-lg font-bold">
                {classificationStyle.label}
              </p>
              <p className="mt-1 text-[13px] font-semibold">
                {result.confidence}% confidence
              </p>
            </div>
          </div>

          {result.kill_switch_triggered && (
            <div
              className="mt-5 rounded-md border px-4 py-3 text-[13px]"
              style={{
                background: brand.aiBg,
                borderColor: brand.aiAccent,
                color: brand.aiText,
              }}
            >
              Strong rule-based signal triggered:{" "}
              {result.kill_switch_reason ||
                "High-risk typing behavior detected."}
            </div>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["WPM", result.stats.wpm],
              ["Keystrokes", result.stats.keystrokes],
              ["Deletions", result.stats.deletions],
              ["Avg IKI", `${result.stats.avgIki}ms`],
              ["Pauses", result.stats.pauses],
              ["Duration", formatDuration(result.stats.sessionSeconds)],
              ["Certificate", result.certificate_id || "Pending"],
              ["Course", courseName || "Personal"],
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
                  className="mt-1 text-[17px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          {result.document_hash && (
            <div
              className="mt-5 rounded-md border px-4 py-3"
              style={{ borderColor: colors.surface[200] }}
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: colors.text.secondary }}
              >
                Document SHA-256 Hash
              </p>
              <p
                className="mt-1 break-all font-mono text-[12px]"
                style={{ color: colors.text.primary }}
              >
                {result.document_hash}
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onNewSession}
              className="rounded-md px-4 py-2 text-[13px] font-semibold text-white"
              style={{ background: colors.brand }}
            >
              Start new session
            </button>

            {result.session_id && (
              <Link
                to={`/session/${result.session_id}/replay`}
                className="rounded-md border px-4 py-2 text-[13px] font-semibold"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              >
                View replay
              </Link>
            )}

            {result.certificate_id && (
              <Link
                to={`/verify/${result.certificate_id}`}
                className="rounded-md border px-4 py-2 text-[13px] font-semibold"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              >
                Verify certificate
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EditorPage() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourse[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );
  const [apiError, setApiError] = useState<string | null>(null);

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

  useEffect(() => {
    let isMounted = true;

    async function loadCourses() {
      try {
        const response = await api.get("/courses/enrolled");
        if (!isMounted) return;

        setEnrolledCourses(response.data?.courses || []);
      } catch {
        if (!isMounted) return;
        setEnrolledCourses([]);
      }
    }

    loadCourses();

    return () => {
      isMounted = false;
    };
  }, []);

  const canAnalyze =
    liveStats.keystrokes >= MINIMUM_KEYSTROKES && text.trim().length > 0;

  const handleOpenAnalyzeModal = () => {
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

  const handleConfirmSubmit = async () => {
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

      setShowCourseModal(false);

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
    } catch (error) {
      setApiError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewSession = () => {
    setAnalysisResult(null);
    setTitle("");
    setText("");
    setSelectedCourseId(null);
    setApiError(null);
    resetCapture();
  };

  if (analysisResult) {
    const courseName = selectedCourseId
      ? enrolledCourses.find((course) => course.id === selectedCourseId)
          ?.course_name || null
      : null;

    return (
      <AnalysisScreen
        result={analysisResult}
        courseName={courseName}
        onNewSession={handleNewSession}
      />
    );
  }

  return (
    <div
      className="flex h-screen flex-col overflow-hidden font-sans"
      style={{ background: focusMode ? "#FFFFFF" : colors.surface[50] }}
    >
      <header
        className="flex h-12 shrink-0 items-center gap-3 border-b bg-white px-4"
        style={{ borderColor: colors.surface[200] }}
      >
        {!focusMode && (
          <Link
            to={ROUTES.DASHBOARD}
            className="rounded-md px-2 py-1 text-[12px] font-medium transition-colors"
            style={{ color: colors.text.secondary }}
          >
            Back to dashboard
          </Link>
        )}

        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Untitled Document"
          className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold outline-none"
          style={{ color: colors.text.primary }}
        />

        <button
          type="button"
          onClick={() => setFocusMode((current) => !current)}
          className="rounded-md border px-3 py-1.5 text-[12px] font-semibold"
          style={{
            borderColor: colors.surface[200],
            color: colors.text.secondary,
            background: colors.surface[50],
          }}
        >
          {focusMode ? "Exit focus" : "Focus"}
        </button>

        <button
          type="button"
          onClick={handleOpenAnalyzeModal}
          disabled={!canAnalyze || isSubmitting}
          className="rounded-md px-4 py-1.5 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: colors.brand }}
        >
          Analyze
        </button>
      </header>

      <main className="flex min-h-0 flex-1">
        {!focusMode && (
          <aside
            className="hidden w-72 shrink-0 border-r bg-white p-4 lg:block"
            style={{ borderColor: colors.surface[200] }}
          >
            <h2
              className="text-[13px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Live writing evidence
            </h2>

            <div className="mt-4 grid gap-3">
              {[
                ["Words", wordCount],
                ["Characters", charCount],
                ["WPM", liveStats.wpm],
                ["Keystrokes", liveStats.keystrokes],
                ["Deletions", liveStats.deletions],
                ["Pauses", liveStats.pauses],
                ["Avg IKI", `${liveStats.avgIki}ms`],
                ["Duration", formatDuration(liveStats.sessionSeconds)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-md border px-3 py-2"
                  style={{ borderColor: colors.surface[200] }}
                >
                  <p
                    className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: colors.text.secondary }}
                  >
                    {label}
                  </p>
                  <p
                    className="mt-1 text-[16px] font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div
              className="mt-4 rounded-md border px-3 py-3 text-[12px]"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[50],
                color: colors.text.secondary,
              }}
            >
              Keystroke capture records timing, pauses, deletions, paste events,
              dwell time, and inter-key intervals while you write.
            </div>
          </aside>
        )}

        <section className="flex min-w-0 flex-1 flex-col">
          {apiError && (
            <div
              className="mx-auto mt-4 w-full max-w-4xl rounded-md border px-4 py-3 text-[13px]"
              style={{
                borderColor: brand.aiAccent,
                background: brand.aiBg,
                color: brand.aiText,
              }}
            >
              {apiError}
            </div>
          )}

          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 py-5">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onPaste={handlePaste}
              placeholder="Start typing your assignment here. TypeTrace will capture your writing process as evidence of authorship."
              spellCheck
              className="min-h-0 flex-1 resize-none rounded-md border bg-white px-6 py-5 text-[16px] leading-8 outline-none transition-colors"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
                boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
              }}
            />
          </div>
        </section>
      </main>

      {!focusMode && (
        <footer
          className="flex h-9 shrink-0 items-center gap-4 border-t px-5"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[50],
          }}
        >
          <div
            className="flex items-center gap-1.5 text-[11px] font-mono"
            style={{ color: colors.text.secondary }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background:
                  keystrokeLogRef.current.length > 0
                    ? colors.green
                    : colors.surface[200],
                boxShadow:
                  keystrokeLogRef.current.length > 0
                    ? `0 0 4px ${colors.green}`
                    : "none",
              }}
            />
            {liveStats.keystrokes} keys · {liveStats.deletions} deletions · IKI{" "}
            {liveStats.avgIki}ms
          </div>

          <div className="flex-1" />

          <span
            className="text-[11px] font-mono"
            style={{ color: colors.text.secondary }}
          >
            {charCount} chars
          </span>
          <span
            className="text-[11px] font-mono"
            style={{ color: colors.text.secondary }}
          >
            ~{Math.max(1, Math.ceil(wordCount / 200))} min read
          </span>
        </footer>
      )}

      {showCourseModal && (
        <CourseSelectorModal
          courses={enrolledCourses}
          selectedCourseId={selectedCourseId}
          onSelect={setSelectedCourseId}
          onConfirm={handleConfirmSubmit}
          onCancel={() => setShowCourseModal(false)}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
