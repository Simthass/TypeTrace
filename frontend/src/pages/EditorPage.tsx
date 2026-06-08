// frontend/src/pages/EditorPage.tsx

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { ROUTES } from "../constants/routes";
import { useKeystrokeCapture } from "../hooks/useKeystrokeCapture";
import { api, getApiErrorMessage } from "../lib/api";
import { useToast } from "../components/ui/ToastProvider";
import { useAuthStore } from "../store/authStore";
import { brand, colors } from "../styles/colors";

const MINIMUM_KEYSTROKES = 30;

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
  stats: {
    keystrokes: number;
    deletions: number;
    pauses: number;
    wpm: number;
    avgIki: number;
    sessionSeconds: number;
  };
}

function countWords(value: string): number {
  const clean = value.trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;

  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function resultTone(classification: string) {
  const normalized = classification.toUpperCase();

  if (normalized === "HUMAN") {
    return {
      tone: "human" as const,
      label: "Human Writing Pattern",
      bg: brand.humanBg,
      text: brand.humanText,
      accent: brand.humanAccent,
    };
  }

  if (normalized === "SUSPICIOUS") {
    return {
      tone: "suspicious" as const,
      label: "Review Recommended",
      bg: brand.suspiciousBg,
      text: brand.suspiciousText,
      accent: brand.suspiciousAccent,
    };
  }

  return {
    tone: "danger" as const,
    label: "High Risk Pattern",
    bg: brand.aiBg,
    text: brand.aiText,
    accent: brand.aiAccent,
  };
}

function MetricTile({
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
      <button
        type="button"
        className="absolute inset-0"
        style={{
          background: "rgba(15, 23, 42, 0.48)",
          backdropFilter: "blur(5px)",
        }}
        onClick={onCancel}
        aria-label="Close modal"
      />

      <Card elevated className="relative z-10 w-full max-w-[540px]">
        <CardHeader>
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
            Link this evidence trail
          </h2>

          <p
            className="mt-3 text-[14px] leading-6"
            style={{ color: colors.text.secondary }}
          >
            Select a course if this writing session belongs to an academic
            module, or keep it as a personal session.
          </p>
        </CardHeader>

        <CardBody>
          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="rounded-md border px-4 py-3 text-left transition"
              style={{
                borderColor:
                  selectedCourseId === null
                    ? colors.brand
                    : colors.surface[200],
                background:
                  selectedCourseId === null
                    ? colors.brandSoft
                    : colors.surface[50],
              }}
            >
              <p
                className="text-[14px] font-bold"
                style={{ color: colors.text.primary }}
              >
                Personal session
              </p>
              <p
                className="mt-1 text-[12px]"
                style={{ color: colors.text.secondary }}
              >
                Keep this evidence inside your private workspace.
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
                  className="text-[14px] font-bold"
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
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>

            <Button type="button" onClick={onConfirm} disabled={isSubmitting}>
              {isSubmitting ? "Analyzing..." : "Analyze session"}
            </Button>
          </div>
        </CardBody>
      </Card>
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
  const style = resultTone(result.classification);

  return (
    <Card elevated>
      <CardBody>
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

          <p className="mt-1 text-[14px] font-bold">{style.label}</p>

          {result.kill_switch_triggered && result.kill_switch_reason && (
            <p className="mt-3 text-[12px] leading-5">
              {result.kill_switch_reason}
            </p>
          )}
        </div>

        <div className="mt-5">
          <p
            className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: colors.text.secondary }}
          >
            Behavioral metrics
          </p>

          <div className="grid grid-cols-2 gap-3">
            <MetricTile label="WPM" value={result.stats.wpm} />
            <MetricTile label="IKI" value={`${result.stats.avgIki}ms`} />
            <MetricTile label="Keys" value={result.stats.keystrokes} />
            <MetricTile label="Pauses" value={result.stats.pauses} />
          </div>
        </div>

        {result.document_hash && (
          <div
            className="mt-5 rounded-md border p-3"
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
            <ButtonLink
              to={ROUTES.REPLAY.replace(
                ":sessionId",
                String(result.session_id),
              )}
            >
              View replay audit
            </ButtonLink>
          )}

          {result.certificate_id && (
            <ButtonLink
              to={`/verify/${result.certificate_id}`}
              variant="secondary"
            >
              Verify certificate
            </ButtonLink>
          )}

          <Button type="button" variant="secondary" onClick={onNewSession}>
            Start new session
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export default function EditorPage() {
  const toast = useToast();
  const { user } = useAuthStore();

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourse[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved">(
    "saved",
  );

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

  useEffect(() => {
    if (!text && !title) return;

    setSaveState("saving");

    const timeout = window.setTimeout(() => {
      setSaveState("saved");
    }, 800);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [text, title]);

  const openAnalyzeModal = () => {
    if (!text.trim()) {
      toast.error(
        "Nothing to analyze",
        "Please write something before analyzing.",
      );
      return;
    }

    if (liveStats.keystrokes < MINIMUM_KEYSTROKES) {
      toast.warning(
        "More typing required",
        `Please type at least ${MINIMUM_KEYSTROKES} keystrokes. Current: ${liveStats.keystrokes}.`,
      );
      return;
    }

    setShowCourseModal(true);
  };

  const confirmSubmit = async () => {
    setIsSubmitting(true);

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
        kill_switch_triggered: response.data.kill_switch_triggered,
        kill_switch_reason: response.data.kill_switch_reason,
        certificate_id: response.data.certificate_id,
        document_hash: response.data.document_hash,
        session_id: response.data.session_id,
      });

      setShowCourseModal(false);
      toast.success(
        "Analysis complete",
        "Your writing evidence trail has been processed successfully.",
      );
    } catch (error) {
      toast.error("Analysis failed", getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const newSession = () => {
    setTitle("");
    setText("");
    setSelectedCourseId(null);
    setAnalysisResult(null);
    resetCapture();
    toast.info(
      "New session started",
      "You can begin writing a new authorship trail.",
    );
  };

  return (
    <main
      className="min-h-screen pb-24"
      style={{ background: colors.surface[100] }}
    >
      <header
        className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur"
        style={{ borderColor: colors.surface[200] }}
      >
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-5">
            <Link to={ROUTES.DASHBOARD}>
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
                className="text-[13px] font-bold"
                style={{ color: colors.text.primary }}
              >
                Capture evidence while you write naturally
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone={saveState === "saved" ? "human" : "brand"}>
              {saveState === "saved"
                ? "Saved"
                : saveState === "saving"
                  ? "Saving..."
                  : "Unsaved"}
            </Badge>

            <ButtonLink to={ROUTES.DASHBOARD} variant="secondary">
              Dashboard
            </ButtonLink>

            <Button
              type="button"
              onClick={openAnalyzeModal}
              disabled={!canAnalyze || isSubmitting}
            >
              Analyze
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1500px] grid-cols-1 gap-5 px-5 py-5 xl:grid-cols-[1fr_370px]">
        <Card elevated className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
                  Keystrokes, pauses, edits, and paste events are captured as
                  behavioral evidence.
                </p>
              </div>

              <Badge tone={canAnalyze ? "human" : "brand"}>
                {canAnalyze
                  ? "Ready for analysis"
                  : `${Math.max(0, MINIMUM_KEYSTROKES - liveStats.keystrokes)} more keys`}
              </Badge>
            </div>
          </CardHeader>

          <CardBody>
            <textarea
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setSaveState("unsaved");
              }}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onPaste={handlePaste}
              placeholder="Start writing here. TypeTrace will quietly capture your writing process in the background."
              className="min-h-[calc(100vh-320px)] w-full resize-none rounded-xl border px-6 py-6 text-[16px] leading-8 outline-none transition focus:ring-2"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[50],
                color: colors.text.primary,
                boxShadow: `inset 0 1px 0 ${colors.surface[200]}`,
              }}
            />
          </CardBody>
        </Card>

        <div className="space-y-5">
          {analysisResult ? (
            <ResultPanel result={analysisResult} onNewSession={newSession} />
          ) : (
            <Card elevated>
              <CardHeader>
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
                  Metrics are grouped so the panel feels like a product tool,
                  not a noisy stat wall.
                </p>
              </CardHeader>

              <CardBody className="space-y-5">
                <div>
                  <p
                    className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em]"
                    style={{ color: colors.text.secondary }}
                  >
                    Writing
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <MetricTile label="Words" value={wordCount} />
                    <MetricTile label="Characters" value={charCount} />
                    <MetricTile label="WPM" value={liveStats.wpm} />
                    <MetricTile
                      label="Duration"
                      value={formatDuration(liveStats.sessionSeconds)}
                    />
                  </div>
                </div>

                <div>
                  <p
                    className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em]"
                    style={{ color: colors.text.secondary }}
                  >
                    Behavior
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <MetricTile
                      label="Keystrokes"
                      value={liveStats.keystrokes}
                    />
                    <MetricTile label="Deletions" value={liveStats.deletions} />
                    <MetricTile label="Pauses" value={liveStats.pauses} />
                    <MetricTile
                      label="Avg IKI"
                      value={`${liveStats.avgIki}ms`}
                    />
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardBody>
              <p
                className="text-[11px] font-bold uppercase tracking-[0.16em]"
                style={{ color: colors.text.secondary }}
              >
                Evidence trail
              </p>

              <div className="mt-4 grid gap-3">
                {[
                  [
                    "Behavioral capture",
                    "Keydown, keyup, dwell and flight timing",
                  ],
                  [
                    "Integrity trail",
                    "Document hash and certificate-ready proof",
                  ],
                  [
                    "Replay ready",
                    "Teachers can inspect suspicious moments later",
                  ],
                ].map(([label, description]) => (
                  <div
                    key={label}
                    className="rounded-md border p-3"
                    style={{
                      borderColor: colors.surface[200],
                      background: colors.surface[50],
                    }}
                  >
                    <p
                      className="text-[13px] font-bold"
                      style={{ color: colors.text.primary }}
                    >
                      {label}
                    </p>
                    <p
                      className="mt-1 text-[12px] leading-5"
                      style={{ color: colors.text.secondary }}
                    >
                      {description}
                    </p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
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
                className="truncate text-[13px] font-bold"
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
            <MetricTile label="Words" value={wordCount} />
            <MetricTile label="Keys" value={liveStats.keystrokes} />
            <MetricTile label="WPM" value={liveStats.wpm} />
            <MetricTile
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
