import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api, getApiErrorMessage } from "../lib/api";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";
import type {
  ReplayEvent,
  ReplayResponse,
  ReplaySegment,
  ReplayTimelineMarker,
} from "../types/replay";
import { API_ROUTES } from "../constants/apiRoutes";

function PlayIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 5h4v14H6z" />
      <path d="M14 5h4v14h-4z" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v6h6" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function formatTime(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const totalSeconds = Math.floor(safe / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatLongTime(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const totalSeconds = Math.floor(safe / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function classificationStyle(bucket: string) {
  if (bucket === "HUMAN") {
    return {
      label: "Human",
      bg: brand.humanBg,
      text: brand.humanText,
      border: brand.humanAccent,
    };
  }

  if (bucket === "SUSPICIOUS") {
    return {
      label: "Review",
      bg: brand.suspiciousBg,
      text: brand.suspiciousText,
      border: brand.suspiciousAccent,
    };
  }

  if (bucket === "SYNTHETIC") {
    return {
      label: "High Risk",
      bg: brand.aiBg,
      text: brand.aiText,
      border: brand.aiAccent,
    };
  }

  return {
    label: "Unknown",
    bg: colors.surface[100],
    text: colors.text.secondary,
    border: colors.surface[200],
  };
}

function markerColor(type: ReplayTimelineMarker["type"]) {
  if (type === "paste") return brand.suspiciousAccent;
  if (type === "deletion") return brand.aiAccent;
  if (type === "cognitive_pause") return colors.text.primary;
  return colors.steel;
}

function metricValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return value;
}

function buildSegments(
  events: ReplayEvent[],
  currentTimeMs: number,
): ReplaySegment[] {
  const activeEvents = events.filter(
    (event) => event.relative_time_ms <= currentTimeMs,
  );
  const segments: ReplaySegment[] = [];
  let buffer = "";

  const flushTyped = () => {
    if (buffer.length > 0) {
      segments.push({
        text: buffer,
        type: "typed",
      });
      buffer = "";
    }
  };

  activeEvents.forEach((event) => {
    if (event.type !== "keydown" && event.type !== "paste") return;

    if (event.is_paste) {
      flushTyped();

      const label =
        event.pastedLength > 0
          ? `[pasted ${event.pastedLength} characters]`
          : "[pasted content]";

      segments.push({
        text: label,
        type: "paste",
      });

      return;
    }

    if (event.is_deletion) {
      if (buffer.length > 0) {
        buffer = buffer.slice(0, -1);
      } else if (segments.length > 0) {
        const last = segments[segments.length - 1];

        if (last.text.length > 1) {
          segments[segments.length - 1] = {
            ...last,
            text: last.text.slice(0, -1),
          };
        } else {
          segments.pop();
        }
      }

      return;
    }

    if (event.key === "Enter") {
      buffer += "\n";
      return;
    }

    if (event.key === "Tab") {
      buffer += "    ";
      return;
    }

    if (event.key === " ") {
      buffer += " ";
      return;
    }

    if (event.key.length === 1) {
      buffer += event.key;
    }
  });

  flushTyped();
  return segments;
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div
      className="rounded-md border bg-white px-4 py-3"
      style={{ borderColor: colors.surface[200] }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-[0.12em]"
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
      {sub && (
        <p
          className="mt-1 text-[12px]"
          style={{ color: colors.text.secondary }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function SegmentRenderer({
  segments,
  isPlaying,
}: {
  segments: ReplaySegment[];
  isPlaying: boolean;
}) {
  if (segments.length === 0) {
    return (
      <span style={{ color: colors.text.secondary }}>
        Press play to reconstruct the writing session.
      </span>
    );
  }

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === "paste") {
          return (
            <span
              key={`${segment.type}-${index}`}
              className="mx-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-semibold"
              style={{
                background: brand.suspiciousBg,
                color: brand.suspiciousText,
                border: `1px solid ${brand.suspiciousAccent}`,
              }}
              title="Clipboard paste event. Original pasted text is intentionally not replayed for privacy."
            >
              <ClipboardIcon />
              {segment.text}
            </span>
          );
        }

        return <span key={`${segment.type}-${index}`}>{segment.text}</span>;
      })}

      {isPlaying && (
        <span
          className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse align-middle"
          style={{ background: colors.text.primary }}
        />
      )}
    </>
  );
}

export default function ReplayPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [replay, setReplay] = useState<ReplayResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [viewMode, setViewMode] = useState<"document" | "events">("document");

  const playbackTimerRef = useRef<number | null>(null);

  const loadReplay = useCallback(async () => {
    const cleanSessionId = sessionId?.trim();

    if (!cleanSessionId) {
      setApiError("Replay session ID is missing.");
      setIsLoading(false);
      return;
    }

    if (!/^\d+$/.test(cleanSessionId)) {
      setApiError("Replay session ID is invalid.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setApiError(null);

    try {
      const response = await api.get<ReplayResponse>(
        API_ROUTES.sessions.replay(cleanSessionId),
      );

      setReplay(response.data);
      setIsPlaying(false);
      setCurrentTimeMs(0);
    } catch (error) {
      setApiError(getApiErrorMessage(error));
      setReplay(null);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadReplay();
  }, [loadReplay]);

  useEffect(() => {
    return () => {
      if (playbackTimerRef.current) {
        window.clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTimeMs(0);

    if (playbackTimerRef.current) {
      window.clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  }, [replay?.session.id]);

  const maxTimeMs = useMemo(() => {
    if (!replay) return 1000;

    const lastEventTime =
      replay.events.length > 0
        ? replay.events[replay.events.length - 1].relative_time_ms
        : 0;

    return Math.max(replay.session.duration_ms, lastEventTime, 1000);
  }, [replay]);

  const playbackProgress = useMemo(() => {
    const replayDurationMs = Math.max(replay?.session.duration_ms ?? 0, 1);
    return Math.min(100, Math.max(0, (currentTimeMs / replayDurationMs) * 100));
  }, [currentTimeMs, replay]);

  const activeEventIndex = useMemo(() => {
    if (!replay) return 0;
    return replay.events.filter(
      (event) => event.relative_time_ms <= currentTimeMs,
    ).length;
  }, [replay, currentTimeMs]);

  const activeEvent = useMemo(() => {
    if (!replay || activeEventIndex === 0) return null;
    return replay.events[
      Math.min(activeEventIndex - 1, replay.events.length - 1)
    ];
  }, [replay, activeEventIndex]);

  const visibleSegments = useMemo(() => {
    if (!replay) return [];
    return buildSegments(replay.events, currentTimeMs);
  }, [replay, currentTimeMs]);

  const visibleEvents = useMemo(() => {
    if (!replay) return [];
    return replay.events.filter(
      (event) => event.relative_time_ms <= currentTimeMs,
    );
  }, [replay, currentTimeMs]);

  const togglePlayback = () => {
    if (!replay || replay.events.length === 0) return;

    if (isPlaying) {
      if (playbackTimerRef.current) {
        window.clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }

      setIsPlaying(false);
      return;
    }

    if (currentTimeMs >= maxTimeMs) {
      setCurrentTimeMs(0);
    }

    setIsPlaying(true);

    playbackTimerRef.current = window.setInterval(() => {
      setCurrentTimeMs((current) => {
        const next = current + 16 * playbackSpeed;

        if (next >= maxTimeMs) {
          if (playbackTimerRef.current) {
            window.clearInterval(playbackTimerRef.current);
            playbackTimerRef.current = null;
          }

          setIsPlaying(false);
          return maxTimeMs;
        }

        return next;
      });
    }, 16);
  };

  const handleScrub = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!replay) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const percentage = (event.clientX - rect.left) / rect.width;
    const nextTime = Math.max(0, Math.min(maxTimeMs, percentage * maxTimeMs));
    setCurrentTimeMs(nextTime);
  };

  const resetPlayback = () => {
    if (playbackTimerRef.current) {
      window.clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    setIsPlaying(false);
    setCurrentTimeMs(0);
  };

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: colors.surface[50] }}
      >
        <div
          className="rounded-md border bg-white px-6 py-5 text-center shadow-sm"
          style={{ borderColor: colors.surface[200] }}
        >
          <p
            className="text-[13px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Loading replay audit...
          </p>
          <p
            className="mt-1 text-[12px]"
            style={{ color: colors.text.secondary }}
          >
            Reconstructing keystroke evidence.
          </p>
        </div>
      </div>
    );
  }

  if (apiError || !replay) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-6"
        style={{ background: colors.surface[50] }}
      >
        <div
          className="w-full max-w-md rounded-md border bg-white p-6 text-center shadow-sm"
          style={{ borderColor: colors.surface[200] }}
        >
          <div
            className="mx-auto flex h-10 w-10 items-center justify-center rounded-md"
            style={{ background: brand.aiBg, color: brand.aiText }}
          >
            <AlertIcon />
          </div>
          <h1
            className="mt-4 text-lg font-semibold"
            style={{ color: colors.text.primary }}
          >
            Replay unavailable
          </h1>
          <p
            className="mt-2 text-[13px]"
            style={{ color: colors.text.secondary }}
          >
            {apiError || "This replay could not be loaded."}
          </p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-5 rounded-md px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: colors.brand }}
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const badge = classificationStyle(replay.session.classification_bucket);

  return (
    <div className="min-h-screen" style={{ background: colors.surface[50] }}>
      <header
        className="sticky top-0 z-20 border-b bg-white px-6 py-4"
        style={{ borderColor: colors.surface[200] }}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-1 rounded-md border p-2"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
              }}
              aria-label="Go back"
            >
              <BackIcon />
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  className="text-[17px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  Replay Audit: {replay.session.title}
                </h1>
                <span
                  className="rounded-md border px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    background: badge.bg,
                    color: badge.text,
                    borderColor: badge.border,
                  }}
                >
                  {badge.label}
                </span>
              </div>

              <p
                className="mt-1 text-[12px]"
                style={{ color: colors.text.secondary }}
              >
                {replay.session.student_name || replay.session.student_id} ·{" "}
                {replay.session.course_name || "Personal session"} ·{" "}
                {replay.session.created_at}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {replay.session.certificate_id && (
              <Link
                to={ROUTES.VERIFY.replace(
                  ":certId",
                  replay.session.certificate_id,
                )}
                className="rounded-md border px-3 py-2 text-[12px] font-semibold"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              >
                Verify Certificate
              </Link>
            )}

            <button
              type="button"
              onClick={resetPlayback}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[12px] font-semibold"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
              }}
            >
              <ResetIcon />
              Reset
            </button>

            <button
              type="button"
              onClick={togglePlayback}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-[12px] font-semibold text-white"
              style={{ background: colors.brand }}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
              {isPlaying ? "Pause" : "Play"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 px-6 py-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-5">
          {replay?.audit.is_truncated && (
            <div
              className="rounded-md border p-4"
              style={{
                borderColor: brand.suspiciousAccent,
                background: brand.suspiciousBg,
              }}
            >
              <p
                className="text-[13px] font-bold"
                style={{ color: brand.suspiciousText }}
              >
                Replay truncated for performance
              </p>

              <p
                className="mt-1 text-[12px] leading-5"
                style={{ color: brand.suspiciousText }}
              >
                This session contains more events than the replay viewer can
                safely render at once. The audit summary remains available, but
                only the first {replay.audit.max_events_returned} events are
                shown.
              </p>
            </div>
          )}

          {activeEvent?.is_cognitive_pause && (
            <div
              className="rounded-md border px-4 py-3 text-[13px]"
              style={{
                borderColor: brand.suspiciousAccent,
                background: brand.suspiciousBg,
                color: brand.suspiciousText,
              }}
            >
              Cognitive pause detected:{" "}
              {formatLongTime(activeEvent.flight_time || 0)} gap before this
              event.
            </div>
          )}

          <div
            className="rounded-md border bg-white p-5 shadow-sm"
            style={{ borderColor: colors.surface[200] }}
          >
            <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <h2
                  className="text-[15px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  Writing reconstruction
                </h2>
                <p
                  className="mt-1 text-[12px]"
                  style={{ color: colors.text.secondary }}
                >
                  Replays the writing process from captured keystroke evidence.
                  Paste contents are intentionally summarized for privacy.
                </p>
              </div>

              <div
                className="flex rounded-md border bg-white p-1"
                style={{ borderColor: colors.surface[200] }}
              >
                {(["document", "events"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className="rounded-md px-3 py-1.5 text-[12px] font-semibold"
                    style={{
                      background:
                        viewMode === mode ? brand.bgNavActive : "#FFFFFF",
                      color:
                        viewMode === mode
                          ? colors.brand
                          : colors.text.secondary,
                    }}
                  >
                    {mode === "document" ? "Document" : "Event Stream"}
                  </button>
                ))}
              </div>
            </div>

            {replay.events.length === 0 ? (
              <div
                className="rounded-md border p-5"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[100],
                }}
              >
                <p
                  className="text-[14px] font-bold"
                  style={{ color: colors.text.primary }}
                >
                  No replayable keystroke events
                </p>

                <p
                  className="mt-2 text-[13px] leading-6"
                  style={{ color: colors.text.secondary }}
                >
                  This session exists, but TypeTrace could not find replayable
                  event data. The summary metrics and certificate record may
                  still be available, but playback cannot be reconstructed for
                  this session.
                </p>
              </div>
            ) : viewMode === "document" ? (
              <div
                className="min-h-[440px] whitespace-pre-wrap rounded-md border p-5 font-mono text-[14px] leading-7"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[50],
                  color: colors.text.primary,
                }}
              >
                <SegmentRenderer
                  segments={visibleSegments}
                  isPlaying={isPlaying}
                />
              </div>
            ) : (
              <div
                className="max-h-[520px] overflow-auto rounded-md border"
                style={{ borderColor: colors.surface[200] }}
              >
                {visibleEvents.length === 0 ? (
                  <p
                    className="px-4 py-6 text-[13px]"
                    style={{ color: colors.text.secondary }}
                  >
                    Press play to see the event stream.
                  </p>
                ) : (
                  visibleEvents
                    .slice()
                    .reverse()
                    .slice(0, 120)
                    .map((event) => (
                      <div
                        key={`${event.event_index}-${event.relative_time_ms}`}
                        className="grid grid-cols-[80px_1fr_90px] gap-3 border-b px-4 py-2 text-[12px] last:border-b-0"
                        style={{ borderColor: colors.surface[200] }}
                      >
                        <span style={{ color: colors.text.secondary }}>
                          {formatTime(event.relative_time_ms)}
                        </span>
                        <span style={{ color: colors.text.primary }}>
                          {event.display_key}
                          {event.is_paste
                            ? ` · ${event.pastedLength} chars pasted`
                            : ""}
                          {event.is_deletion ? " · deletion" : ""}
                          {event.is_cognitive_pause
                            ? ` · ${formatLongTime(event.flight_time || 0)} pause`
                            : ""}
                        </span>
                        <span
                          className="text-right"
                          style={{ color: colors.text.secondary }}
                        >
                          {event.type}
                        </span>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>

          <div
            className="rounded-md border bg-white p-5 shadow-sm"
            style={{ borderColor: colors.surface[200] }}
          >
            <div className="flex items-center justify-between text-[12px] font-semibold">
              <span style={{ color: colors.text.secondary }}>
                {formatTime(currentTimeMs)}
              </span>
              <span style={{ color: colors.text.secondary }}>
                {formatTime(maxTimeMs)}
              </span>
            </div>

            <div
              className="relative mt-3 h-8 cursor-pointer"
              onClick={handleScrub}
            >
              <div
                className="absolute top-3 h-2 w-full overflow-hidden rounded-full border"
                style={{
                  background: colors.surface[100],
                  borderColor: colors.surface[200],
                }}
              >
                {replay.timeline_markers.map((marker) => (
                  <span
                    key={`${marker.type}-${marker.event_index}-${marker.relative_time_ms}`}
                    className="absolute top-0 h-full"
                    title={marker.label}
                    style={{
                      left: `${Math.min(100, Math.max(0, (marker.relative_time_ms / maxTimeMs) * 100))}%`,
                      width: marker.type === "paste" ? 5 : 2,
                      background: markerColor(marker.type),
                    }}
                  />
                ))}

                <div
                  className="h-full"
                  style={{
                    width: `${playbackProgress}%`,
                    background: colors.brand,
                  }}
                />
              </div>

              <div
                className="absolute top-[9px] h-4 w-4 rounded-full shadow-sm"
                style={{
                  left: `calc(${playbackProgress}% - 8px)`,
                  background: colors.text.primary,
                }}
              />
            </div>

            <div className="mt-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div className="flex flex-wrap gap-2">
                {[0.5, 1, 2, 4].map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => setPlaybackSpeed(speed)}
                    className="rounded-md border px-3 py-1.5 text-[12px] font-semibold"
                    style={{
                      borderColor:
                        playbackSpeed === speed
                          ? colors.brand
                          : colors.surface[200],
                      background:
                        playbackSpeed === speed ? brand.bgNavActive : "#FFFFFF",
                      color:
                        playbackSpeed === speed
                          ? colors.brand
                          : colors.text.secondary,
                    }}
                  >
                    {speed}x
                  </button>
                ))}
              </div>

              <div
                className="flex flex-wrap gap-3 text-[11px]"
                style={{ color: colors.text.secondary }}
              >
                <span>Paste</span>
                <span>Deletion</span>
                <span>Pause</span>
                <span>Cognitive pause</span>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <div
            className="rounded-md border bg-white p-5 shadow-sm"
            style={{ borderColor: colors.surface[200] }}
          >
            <h2
              className="text-[15px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Audit summary
            </h2>

            <div className="mt-4 grid gap-3">
              <MetricCard
                label="Confidence"
                value={`${replay.session.confidence}%`}
                sub={replay.session.risk_level}
              />
              <MetricCard
                label="Progress"
                value={`${activeEventIndex}/${replay.events.length}`}
                sub="events replayed"
              />
              <MetricCard
                label="WPM"
                value={replay.metrics.wpm}
                sub={`${replay.session.word_count} words`}
              />
              <MetricCard
                label="Duration"
                value={formatLongTime(replay.session.duration_ms)}
                sub={`${replay.metrics.active_time_pct}% active intervals`}
              />
            </div>
          </div>

          <div
            className="rounded-md border bg-white p-5 shadow-sm"
            style={{ borderColor: colors.surface[200] }}
          >
            <h2
              className="text-[15px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Behavioral metrics
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {[
                ["Avg IKI", `${metricValue(replay.metrics.avg_iki)}ms`],
                ["Mean Dwell", `${metricValue(replay.metrics.dwell_time)}ms`],
                [
                  "Mean Flight",
                  `${metricValue(replay.metrics.mean_flight_ms)}ms`,
                ],
                [
                  "Longest Pause",
                  formatLongTime(replay.metrics.longest_pause_ms),
                ],
                ["Paste Events", replay.metrics.paste_count],
                ["Deletion Count", replay.metrics.deletion_count],
                [
                  "Deletion Ratio",
                  `${Math.round(replay.metrics.deletion_ratio * 100)}%`,
                ],
                ["Cognitive Pauses", replay.metrics.cognitive_pause_count],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b py-2 last:border-b-0"
                  style={{ borderColor: colors.surface[200] }}
                >
                  <span
                    className="text-[12px]"
                    style={{ color: colors.text.secondary }}
                  >
                    {label}
                  </span>
                  <span
                    className="text-[12px] font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div
            className="rounded-md border bg-white p-5 shadow-sm"
            style={{ borderColor: colors.surface[200] }}
          >
            <h2
              className="text-[15px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Timeline markers
            </h2>

            <div className="mt-4 max-h-[300px] space-y-2 overflow-auto">
              {replay.timeline_markers.length ? (
                replay.timeline_markers.map((marker) => (
                  <div
                    key={`${marker.type}-${marker.event_index}`}
                    className="rounded-md border px-3 py-2"
                    style={{ borderColor: colors.surface[200] }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className="text-[12px] font-semibold"
                        style={{ color: colors.text.primary }}
                      >
                        {marker.label}
                      </span>
                      <span
                        className="text-[11px]"
                        style={{ color: colors.text.secondary }}
                      >
                        {formatTime(marker.relative_time_ms)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p
                  className="text-[13px]"
                  style={{ color: colors.text.secondary }}
                >
                  No paste, deletion, or pause markers detected.
                </p>
              )}
            </div>
          </div>

          <div
            className="rounded-md border bg-white p-5 shadow-sm"
            style={{ borderColor: colors.surface[200] }}
          >
            <h2
              className="text-[15px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Audit interpretation
            </h2>

            <p
              className="mt-3 text-[14px] leading-7"
              style={{ color: colors.text.secondary }}
            >
              This replay reconstructs the recorded writing-session event stream
              using captured keystroke timing, pause, deletion, and paste
              metadata. It should be interpreted as supporting behavioral
              evidence, not as absolute proof of authorship or misconduct.
            </p>
          </div>

          <div
            className="rounded-md border bg-white p-5 shadow-sm"
            style={{ borderColor: colors.surface[200] }}
          >
            <h2
              className="text-[15px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Integrity
            </h2>

            <p
              className="mt-3 break-all font-mono text-[11px]"
              style={{ color: colors.text.secondary }}
            >
              {replay.session.document_hash || "No document hash available."}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {replay.session.certificate_id && (
                <Link
                  to={ROUTES.VERIFY.replace(
                    ":certId",
                    replay.session.certificate_id,
                  )}
                  className="rounded-md px-3 py-2 text-[12px] font-semibold text-white"
                  style={{ background: colors.brand }}
                >
                  Verify
                </Link>
              )}

              <Link
                to={ROUTES.SESSIONS}
                className="rounded-md border px-3 py-2 text-[12px] font-semibold"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              >
                Sessions
              </Link>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
