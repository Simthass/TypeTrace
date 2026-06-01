// src/pages/SessionsPage.tsx
// =============================================================================
// Part 4: Session interface extended with review_status, risk_level,
// course_name. SessionCard now shows the teacher review badge so students
// get a visible feedback loop without navigating anywhere else.
// =============================================================================

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";
import { api } from "../lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type ClassificationStatus = "HUMAN" | "SUSPICIOUS" | "AI-GENERATED";
type ReviewStatus = "PENDING" | "APPROVED" | "FLAGGED" | "UNDER_REVIEW";

interface Session {
  id: number;
  title: string;
  wpm: number;
  duration: number;
  classification: ClassificationStatus;
  confidence: number;
  date: string;
  certificate_id: string | null;
  // ── Part 4: teacher feedback ───────────────────────────────────────────────
  review_status: ReviewStatus;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  review_notes: string;
  course_name: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function getStatusStyle(status: ClassificationStatus) {
  if (status === "HUMAN")
    return {
      dot: brand.humanAccent,
      bg: brand.humanBg,
      text: brand.humanText,
      border: `${brand.humanAccent}28`,
    };
  if (status === "SUSPICIOUS")
    return {
      dot: brand.suspiciousAccent,
      bg: brand.suspiciousBg,
      text: brand.suspiciousText,
      border: `${brand.suspiciousAccent}28`,
    };
  return {
    dot: brand.aiAccent,
    bg: brand.aiBg,
    text: brand.aiText,
    border: `${brand.aiAccent}28`,
  };
}

// Review badge config — maps status → colour + label
const REVIEW_CONFIG: Record<
  ReviewStatus,
  { bg: string; text: string; border: string; label: string; icon: string }
> = {
  PENDING: {
    bg: "#f8fafc",
    text: "#64748b",
    border: "#e2e8f0",
    label: "Pending Review",
    icon: "◉",
  },
  APPROVED: {
    bg: "#f0fdf4",
    text: "#15803d",
    border: "#bbf7d0",
    label: "Approved",
    icon: "✓",
  },
  FLAGGED: {
    bg: "#fef2f2",
    text: "#b91c1c",
    border: "#fecaca",
    label: "Flagged",
    icon: "⚑",
  },
  UNDER_REVIEW: {
    bg: "#fefce8",
    text: "#a16207",
    border: "#fef08a",
    label: "Under Review",
    icon: "◎",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────

const SearchIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const GridIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </svg>
);
const ListIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);
const PlusIcon = () => (
  <svg
    width="13"
    height="13"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    viewBox="0 0 24 24"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const ClockIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);
const PlayIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// IKI SPARKLINE
// ─────────────────────────────────────────────────────────────────────────────

function IkiSparkline({ status }: { status: ClassificationStatus }) {
  const bars =
    status === "AI-GENERATED"
      ? [80, 82, 80, 81, 82, 80, 81, 80, 82, 81]
      : status === "SUSPICIOUS"
        ? [30, 70, 20, 80, 40, 90, 25, 60, 75, 35]
        : [40, 65, 30, 75, 50, 85, 45, 70, 55, 80];
  const st = getStatusStyle(status);
  return (
    <div className="flex items-end gap-[2px] h-5">
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: `${h}%`,
            background: i > 3 && i < 7 ? st.dot : `${st.dot}40`,
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION CARD — now shows review badge + course tag
// ─────────────────────────────────────────────────────────────────────────────

function SessionCard({
  session,
  view,
}: {
  session: Session;
  view: "grid" | "list";
}) {
  const st = getStatusStyle(session.classification);
  const rv = REVIEW_CONFIG[session.review_status] ?? REVIEW_CONFIG.PENDING;
  const detailsStr = `${session.wpm} WPM · ${formatDuration(session.duration)}`;

  // ── LIST VIEW ──
  if (view === "list") {
    return (
      <div
        className="grid items-center gap-4 px-5 py-3.5 border-b last:border-b-0 group transition-colors"
        style={{
          gridTemplateColumns: "2fr 80px 130px 110px 120px 80px",
          borderColor: colors.surface[200],
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background =
            colors.surface[50];
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        {/* Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="h-8 w-8 rounded-md flex items-center justify-center text-white font-bold font-mono text-[13px] shrink-0"
            style={{ background: colors.text.primary }}
          >
            {session.title.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p
              className="text-[13.5px] font-semibold truncate"
              style={{ color: colors.text.primary }}
            >
              {session.title}
            </p>
            <p
              className="text-[12px] font-mono"
              style={{ color: colors.text.secondary }}
            >
              {detailsStr}
            </p>
          </div>
        </div>

        {/* IKI sparkline */}
        <div className="hidden lg:block">
          <IkiSparkline status={session.classification} />
        </div>

        {/* Classification badge */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-md border w-fit"
          style={{ background: st.bg, borderColor: st.border }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{ background: st.dot }}
          />
          <span
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: st.text }}
          >
            {session.classification === "AI-GENERATED"
              ? "AI"
              : session.classification}
          </span>
          <span className="text-[11px] font-bold" style={{ color: st.dot }}>
            {session.confidence}%
          </span>
        </div>

        {/* ── Review status badge ── */}
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-md border w-fit text-[10px] font-bold"
          style={{ background: rv.bg, borderColor: rv.border, color: rv.text }}
        >
          <span>{rv.icon}</span>
          <span>{rv.label}</span>
        </div>

        {/* Course tag */}
        <div>
          {session.course_name ? (
            <span
              className="px-2 py-0.5 rounded-md text-[10px] font-semibold font-mono"
              style={{ background: "#f0f9ff", color: "#0369a1" }}
            >
              {session.course_name}
            </span>
          ) : (
            <span
              className="text-[11px]"
              style={{ color: colors.text.secondary }}
            >
              Private
            </span>
          )}
        </div>

        {/* Date + replay */}
        <div className="flex items-center justify-end gap-2">
          <span
            className="text-[12px] truncate"
            style={{ color: colors.text.secondary }}
          >
            {session.date}
          </span>
          <Link
            to={`/session/${session.id}/replay`}
            className="p-1.5 rounded-md border transition-colors opacity-0 group-hover:opacity-100"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.secondary,
            }}
            title="Watch replay"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color =
                colors.text.primary;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color =
                colors.text.secondary;
            }}
          >
            <PlayIcon />
          </Link>
        </div>
      </div>
    );
  }

  // ── GRID VIEW ──
  return (
    <div
      className="bg-white border rounded-md p-5 flex flex-col gap-3 transition-all cursor-pointer group hover:border-black/20"
      style={{ borderColor: colors.surface[200] }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          "0 4px 16px -4px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* Title row */}
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="h-7 w-7 rounded-md flex items-center justify-center text-white font-bold font-mono text-[12px] shrink-0"
            style={{ background: colors.text.primary }}
          >
            {session.title.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p
              className="text-[13.5px] font-semibold truncate group-hover:underline"
              style={{ color: colors.text.primary }}
            >
              {session.title}
            </p>
            <p
              className="text-[12px] font-mono"
              style={{ color: colors.text.secondary }}
            >
              {detailsStr}
            </p>
          </div>
        </div>
        {/* Classification chip */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-md border shrink-0"
          style={{ background: st.bg, borderColor: st.border }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: st.dot }}
          />
          <span
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: st.text }}
          >
            {session.classification === "AI-GENERATED"
              ? "AI"
              : session.classification}
          </span>
        </div>
      </div>

      {/* IKI sparkline */}
      <IkiSparkline status={session.classification} />

      {/* ── Review status badge + course tag ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold"
          style={{ background: rv.bg, borderColor: rv.border, color: rv.text }}
        >
          {rv.icon} {rv.label}
        </span>
        {session.course_name && (
          <span
            className="px-2 py-0.5 rounded-md text-[10px] font-semibold font-mono"
            style={{ background: "#f0f9ff", color: "#0369a1" }}
          >
            {session.course_name}
          </span>
        )}
      </div>

      {/* Review notes — only shown when a teacher has left a note */}
      {session.review_notes && (
        <p
          className="text-[11px] leading-relaxed px-2 py-1.5 rounded-md border-l-2 italic"
          style={{
            color: colors.text.secondary,
            borderLeftColor: rv.border,
            background: rv.bg,
          }}
        >
          "{session.review_notes}"
        </p>
      )}

      {/* Footer row */}
      <div className="flex items-end justify-between mt-auto pt-1">
        <div
          className="flex items-center gap-1.5 text-[11px]"
          style={{ color: colors.text.secondary }}
        >
          <ClockIcon />
          <span>{session.date}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[14px] font-extrabold"
            style={{ color: st.dot }}
          >
            {session.confidence}%
          </span>
          <Link
            to={`/session/${session.id}/replay`}
            className="flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.secondary,
            }}
            title="Watch replay"
          >
            <PlayIcon /> Replay
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSIONS PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | ClassificationStatus
  >("ALL");
  const [reviewFilter, setReviewFilter] = useState<"ALL" | ReviewStatus>("ALL");
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    api
      .get<{ status: string; sessions: Session[] }>("/sessions/history")
      .then((r) => {
        if (r.data.status === "success") setSessions(r.data.sessions);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = sessions.filter((s) => {
    if (statusFilter !== "ALL" && s.classification !== statusFilter)
      return false;
    if (reviewFilter !== "ALL" && s.review_status !== reviewFilter)
      return false;
    if (search && !s.title.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  const displayedSessions = showMore ? filtered : filtered.slice(0, 12);

  // Left panel stats — all derived from real API data
  const totalSessions = sessions.length;
  const avgConf =
    totalSessions > 0
      ? (
          sessions.reduce((a, s) => a + s.confidence, 0) / totalSessions
        ).toFixed(1)
      : "0";
  const humanRate =
    totalSessions > 0
      ? Math.round(
          (sessions.filter((s) => s.classification === "HUMAN").length /
            totalSessions) *
            100,
        )
      : 0;
  const aiFlags = sessions.filter(
    (s) => s.classification === "AI-GENERATED",
  ).length;
  const pendingReviews = sessions.filter(
    (s) => s.review_status === "PENDING" && s.course_name,
  ).length;
  const flagged = sessions.filter((s) => s.review_status === "FLAGGED").length;
  const totalWords = Math.round(
    sessions.reduce((a, s) => a + s.wpm * (s.duration / 60), 0),
  );
  const totalTime = sessions.reduce((a, s) => a + s.duration, 0);
  const formattedTime =
    totalTime > 3600
      ? `${(totalTime / 3600).toFixed(1)}h`
      : `${Math.round(totalTime / 60)}m`;

  return (
    <div
      className="p-6 md:p-8 max-w-[1600px] mx-auto w-full flex flex-col gap-6 font-sans min-h-screen"
      style={{ background: colors.surface[50] }}
    >
      {/* ── TOOLBAR ── */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: colors.text.secondary }}
          >
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search sessions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-md text-[13.5px] bg-white border outline-none shadow-sm"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          />
        </div>

        {/* Classification filter */}
        <div
          className="flex items-center border rounded-md shadow-sm overflow-hidden bg-white"
          style={{ borderColor: colors.surface[200] }}
        >
          {(["ALL", "HUMAN", "SUSPICIOUS", "AI-GENERATED"] as const).map(
            (f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className="h-9 px-3 text-[12px] font-semibold transition-colors border-r last:border-r-0"
                style={{
                  background: statusFilter === f ? colors.text.primary : "#fff",
                  color: statusFilter === f ? "#fff" : colors.text.secondary,
                  borderColor: colors.surface[200],
                }}
              >
                {f === "AI-GENERATED" ? "AI" : f}
              </button>
            ),
          )}
        </div>

        {/* Review status filter */}
        <div
          className="flex items-center border rounded-md shadow-sm overflow-hidden bg-white"
          style={{ borderColor: colors.surface[200] }}
        >
          {(
            ["ALL", "PENDING", "APPROVED", "FLAGGED", "UNDER_REVIEW"] as const
          ).map((f) => (
            <button
              key={f}
              onClick={() => setReviewFilter(f)}
              className="h-9 px-3 text-[12px] font-semibold transition-colors border-r last:border-r-0"
              style={{
                background: reviewFilter === f ? colors.text.primary : "#fff",
                color: reviewFilter === f ? "#fff" : colors.text.secondary,
                borderColor: colors.surface[200],
              }}
            >
              {f === "UNDER_REVIEW" ? "IN REVIEW" : f}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div
          className="flex border rounded-md shadow-sm overflow-hidden bg-white"
          style={{ borderColor: colors.surface[200] }}
        >
          <button
            className="h-9 w-9 flex items-center justify-center transition-colors border-r"
            style={{
              background: view === "grid" ? colors.surface[100] : "#fff",
              color:
                view === "grid" ? colors.text.primary : colors.text.secondary,
              borderColor: colors.surface[200],
            }}
            onClick={() => setView("grid")}
          >
            <GridIcon />
          </button>
          <button
            className="h-9 w-9 flex items-center justify-center transition-colors"
            style={{
              background: view === "list" ? colors.surface[100] : "#fff",
              color:
                view === "list" ? colors.text.primary : colors.text.secondary,
            }}
            onClick={() => setView("list")}
          >
            <ListIcon />
          </button>
        </div>

        <Link
          to={ROUTES.EDITOR_NEW}
          className="flex items-center gap-1.5 h-9 px-3 rounded-md text-[12px] font-semibold text-white shadow-sm ml-auto"
          style={{ background: colors.text.primary }}
        >
          <PlusIcon /> New Session
        </Link>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        {/* ── LEFT: STATS PANEL ── */}
        <div className="flex flex-col gap-4">
          {/* Core stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Total Sessions", value: totalSessions },
              { label: "Avg Confidence", value: `${avgConf}%` },
              { label: "Human Rate", value: `${humanRate}%` },
              { label: "AI Flags", value: aiFlags },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="bg-white border rounded-md p-4 shadow-sm"
                style={{ borderColor: colors.surface[200] }}
              >
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                  style={{ color: colors.text.secondary }}
                >
                  {label}
                </p>
                <p
                  className="text-[22px] font-extrabold leading-none font-mono"
                  style={{ color: colors.text.primary }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Review status summary — the feedback loop card */}
          <div
            className="bg-white border rounded-md shadow-sm p-5"
            style={{ borderColor: colors.surface[200] }}
          >
            <h3
              className="text-[13px] font-semibold mb-4"
              style={{ color: colors.text.primary }}
            >
              Teacher Feedback
            </h3>
            <div className="flex flex-col gap-2.5">
              {(
                ["APPROVED", "FLAGGED", "UNDER_REVIEW", "PENDING"] as const
              ).map((status) => {
                const rv = REVIEW_CONFIG[status];
                const count = sessions.filter(
                  (s) => s.review_status === status && s.course_name,
                ).length;
                return (
                  <div
                    key={status}
                    className="flex items-center justify-between"
                  >
                    <span
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold"
                      style={{
                        background: rv.bg,
                        borderColor: rv.border,
                        color: rv.text,
                      }}
                    >
                      {rv.icon} {rv.label}
                    </span>
                    <span
                      className="text-[13px] font-mono font-bold"
                      style={{
                        color:
                          count > 0 && status === "FLAGGED"
                            ? "#b91c1c"
                            : colors.text.primary,
                      }}
                    >
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
            {flagged > 0 && (
              <div
                className="mt-3 px-3 py-2 rounded-lg text-[11px] leading-relaxed"
                style={{ background: "#fef2f2", color: "#b91c1c" }}
              >
                ⚑ {flagged} session{flagged > 1 ? "s" : ""} flagged by your
                instructor. Check the notes on each for details.
              </div>
            )}
          </div>

          {/* Global metrics */}
          <div
            className="bg-white border rounded-md shadow-sm p-5"
            style={{ borderColor: colors.surface[200] }}
          >
            <h3
              className="text-[13px] font-semibold mb-4"
              style={{ color: colors.text.primary }}
            >
              Global Metrics
            </h3>
            <div className="flex flex-col gap-3">
              {[
                {
                  label: "Total Verified Words",
                  value: totalWords.toLocaleString(),
                },
                { label: "Total Analysis Time", value: formattedTime },
                { label: "Ledger Entries", value: totalSessions },
                { label: "Pending Review", value: pendingReviews },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex justify-between items-center border-b last:border-b-0 pb-2 last:pb-0"
                  style={{ borderColor: colors.surface[50] }}
                >
                  <span
                    className="text-[12px]"
                    style={{ color: colors.text.secondary }}
                  >
                    {label}
                  </span>
                  <span
                    className="text-[13px] font-mono font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Ledger status */}
          <div
            className="bg-white border rounded-md shadow-sm p-5 flex flex-col items-center text-center gap-3"
            style={{ borderColor: colors.surface[200] }}
          >
            <div
              className="h-9 w-9 rounded-md border flex items-center justify-center"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.secondary,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </div>
            <p
              className="text-[13px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Cryptographic Sealing Active
            </p>
            <p
              className="text-[12px] leading-relaxed max-w-[200px]"
              style={{ color: colors.text.secondary }}
            >
              All captured sessions are bound to your user identity and
              immutable in the PostgreSQL ledger.
            </p>
          </div>
        </div>

        {/* ── RIGHT: SESSION LIST/GRID ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3
              className="text-[13px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Sessions
              <span
                className="ml-2 text-[11px] font-normal"
                style={{ color: colors.text.secondary }}
              >
                Showing {displayedSessions.length} of {filtered.length}
              </span>
            </h3>
          </div>

          {isLoading ? (
            <div
              className="py-16 text-center border rounded-md border-dashed flex flex-col items-center gap-3"
              style={{ borderColor: colors.surface[200] }}
            >
              <svg
                className="animate-spin h-6 w-6"
                style={{ color: colors.text.secondary }}
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
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p
                className="text-[13.5px] font-medium"
                style={{ color: colors.text.secondary }}
              >
                Syncing with Ledger...
              </p>
            </div>
          ) : displayedSessions.length === 0 ? (
            <div
              className="py-16 text-center border rounded-md border-dashed"
              style={{ borderColor: colors.surface[200] }}
            >
              <p
                className="text-[13.5px] font-medium"
                style={{ color: colors.text.secondary }}
              >
                {sessions.length === 0
                  ? "No cryptographic records found. Start typing to build your profile."
                  : `No sessions match the current filters.`}
              </p>
            </div>
          ) : view === "grid" ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayedSessions.map((s) => (
                  <SessionCard key={s.id} session={s} view="grid" />
                ))}
              </div>
            </>
          ) : (
            <div
              className="bg-white border rounded-md overflow-hidden shadow-sm"
              style={{ borderColor: colors.surface[200] }}
            >
              {/* List header */}
              <div
                className="grid px-5 py-2.5 border-b"
                style={{
                  gridTemplateColumns: "2fr 80px 130px 110px 120px 80px",
                  borderColor: colors.surface[200],
                  background: colors.surface[50],
                }}
              >
                {[
                  "Document",
                  "IKI Pattern",
                  "Status",
                  "Review",
                  "Course",
                  "Date",
                ].map((h) => (
                  <span
                    key={h}
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: colors.text.secondary }}
                  >
                    {h}
                  </span>
                ))}
              </div>
              {displayedSessions.map((s) => (
                <SessionCard key={s.id} session={s} view="list" />
              ))}
            </div>
          )}

          {/* Show more */}
          {filtered.length > 12 && (
            <button
              onClick={() => setShowMore(!showMore)}
              className="mt-4 w-full py-2.5 rounded-md border text-[13px] font-semibold transition-colors"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.secondary,
                background: "white",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  colors.surface[50];
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "white";
              }}
            >
              {showMore ? "Show less" : `Show all ${filtered.length} sessions`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
