import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { colors, brand } from "../styles/colors";
import { api } from "../lib/api";

// ─── STRICT ENTERPRISE GRID LAYOUT ────────────────────────────────────────────
// The last column is increased to 80px to accommodate both Replay and Download buttons.
const TABLE_GRID = "minmax(220px, 2fr) 100px 140px 80px 160px 80px";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Session {
  id: number;
  title: string;
  wpm: number;
  duration: number;
  classification: "HUMAN" | "SUSPICIOUS" | "AI-GENERATED";
  confidence: number;
  date: string;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function getStatusStyle(status: "HUMAN" | "SUSPICIOUS" | "AI-GENERATED") {
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

// ─── ICONS ────────────────────────────────────────────────────────────────────
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
const DownloadIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const PlayIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="5 3 19 12 5 21 5 3"></polygon>
  </svg>
);

// ─── IKI SPARKLINE ────────────────────────────────────────────────────────────
function IkiSparkline({ status }: { status: string }) {
  const bars =
    status === "AI-GENERATED"
      ? [80, 82, 80, 81, 82, 80, 81, 80, 82, 81]
      : status === "SUSPICIOUS"
        ? [30, 70, 20, 80, 40, 90, 25, 60, 75, 35]
        : [40, 65, 30, 75, 50, 85, 45, 70, 55, 80];

  const st = getStatusStyle(status as "HUMAN" | "SUSPICIOUS" | "AI-GENERATED");

  return (
    <div className="flex items-end gap-[2px] h-5 w-[72px]">
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

// ─── SESSION CARD ─────────────────────────────────────────────────────────────
function SessionCard({
  session,
  view,
}: {
  session: Session;
  view: "grid" | "list";
}) {
  const st = getStatusStyle(session.classification);
  const detailsStr = `${session.wpm} WPM · ${formatDuration(session.duration)}`;

  if (view === "list") {
    return (
      <div
        className="grid items-center gap-4 px-5 py-3.5 border-b last:border-b-0 group transition-colors hover:bg-surface-50"
        style={{
          gridTemplateColumns: TABLE_GRID,
          borderColor: colors.surface[200],
        }}
      >
        {/* Col 1: Document */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="h-8 w-8 rounded-md flex items-center justify-center text-white font-bold font-mono text-[13px] shrink-0"
            style={{ background: colors.text.primary }}
          >
            {session.title.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="text-[13.5px] font-semibold truncate group-hover:underline cursor-pointer"
                style={{ color: colors.text.primary }}
              >
                {session.title}
              </span>
            </div>
            <p
              className="text-[12px] mt-0.5 font-mono truncate"
              style={{ color: colors.text.secondary }}
            >
              {detailsStr}
            </p>
          </div>
        </div>

        {/* Col 2: Sparkline */}
        <div className="flex justify-center w-full">
          <IkiSparkline status={session.classification} />
        </div>

        {/* Col 3: Status Badge */}
        <div className="flex justify-center">
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md border"
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
          </div>
        </div>

        {/* Col 4: Confidence Score */}
        <div className="flex justify-center">
          <span
            className="text-[12.5px] font-bold font-mono"
            style={{ color: st.dot }}
          >
            {session.confidence}%
          </span>
        </div>

        {/* Col 5: Date */}
        <div className="flex justify-center min-w-0">
          <span
            className="text-[12px] truncate"
            style={{ color: colors.text.secondary }}
          >
            {session.date}
          </span>
        </div>

        {/* Col 6: Actions */}
        <div className="flex justify-end gap-1">
          <Link
            to={`/session/${session.id}/replay`}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-surface-200"
            style={{ color: colors.text.secondary }}
            title="Replay Session Timeline"
          >
            <PlayIcon />
          </Link>
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-surface-200"
            style={{ color: colors.text.secondary }}
            title="Download Cryptographic Report"
          >
            <DownloadIcon />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white border rounded-md p-5 flex flex-col justify-between h-[180px] transition-all group hover:border-black/20 hover:shadow-lg relative"
      style={{ borderColor: colors.surface[200] }}
    >
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
              className="text-[13.5px] font-semibold truncate group-hover:underline cursor-pointer"
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
      <IkiSparkline status={session.classification} />

      <div className="flex items-end justify-between mt-2">
        <div className="flex flex-col gap-2.5">
          <div
            className="flex items-center gap-1.5 text-[11px]"
            style={{ color: colors.text.secondary }}
          >
            <ClockIcon />
            <span>{session.date}</span>
          </div>
          <Link
            to={`/session/${session.id}/replay`}
            className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors hover:opacity-80"
            style={{ color: colors.text.primary }}
          >
            <PlayIcon /> Replay Timeline
          </Link>
        </div>
        <span className="text-[14px] font-extrabold" style={{ color: st.dot }}>
          {session.confidence}%
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL LEDGER PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function SessionsPage() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "HUMAN" | "SUSPICIOUS" | "AI-GENERATED"
  >("ALL");

  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.get("/sessions/history");
        if (response.data.status === "success") {
          setSessions(response.data.sessions);
        }
      } catch (error) {
        console.error("Failed to fetch session history:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const filtered = sessions.filter((s) => {
    const matchSearch = s.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "ALL" || s.classification === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto w-full flex flex-col gap-6 font-sans bg-brand-bgPage min-h-screen">
      {/* ── HEADER ── */}
      <div
        className="flex flex-col gap-1 border-b pb-6"
        style={{ borderColor: colors.surface[200] }}
      >
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: colors.text.primary }}
        >
          Cryptographic Ledger
        </h1>
        <p className="text-[13.5px]" style={{ color: colors.text.secondary }}>
          A complete, immutable history of all your biometric verifications
          stored in PostgreSQL.
        </p>
      </div>

      {/* ── TOOLBAR ── */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: colors.text.secondary }}
          >
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search documents by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-md text-[13.5px] bg-white border outline-none transition-shadow shadow-sm"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 2px ${colors.text.primary}20`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)";
            }}
          />
        </div>

        <div
          className="flex items-center border rounded-md shadow-sm overflow-hidden bg-white"
          style={{ borderColor: colors.surface[200] }}
        >
          {(["ALL", "HUMAN", "SUSPICIOUS", "AI-GENERATED"] as const).map(
            (f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className="h-9 px-4 text-[12px] font-semibold transition-colors border-r last:border-r-0"
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

        <div
          className="flex border rounded-md shadow-sm overflow-hidden bg-white"
          style={{ borderColor: colors.surface[200] }}
        >
          <button
            className="h-9 w-9 flex items-center justify-center transition-colors border-r"
            style={{
              background: view === "list" ? colors.surface[100] : "#fff",
              color:
                view === "list" ? colors.text.primary : colors.text.secondary,
              borderColor: colors.surface[200],
            }}
            onClick={() => setView("list")}
            title="List view"
          >
            <ListIcon />
          </button>
          <button
            className="h-9 w-9 flex items-center justify-center transition-colors"
            style={{
              background: view === "grid" ? colors.surface[100] : "#fff",
              color:
                view === "grid" ? colors.text.primary : colors.text.secondary,
            }}
            onClick={() => setView("grid")}
            title="Grid view"
          >
            <GridIcon />
          </button>
        </div>
      </div>

      {/* ── SESSIONS DISPLAY ── */}
      <div className="flex-1 pb-12">
        {isLoading ? (
          <div
            className="py-24 text-center border rounded-md border-dashed flex flex-col items-center justify-center gap-3 bg-white"
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
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p
              className="text-[13.5px] font-medium"
              style={{ color: colors.text.secondary }}
            >
              Querying PostgreSQL Ledger...
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="py-24 text-center border rounded-md border-dashed bg-white"
            style={{ borderColor: colors.surface[200] }}
          >
            <p
              className="text-[13.5px] font-medium"
              style={{ color: colors.text.secondary }}
            >
              {sessions.length === 0
                ? "Your ledger is currently empty. Complete a verification session to begin."
                : `No entries match "${search}" with the selected filter.`}
            </p>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((s) => (
              <SessionCard key={s.id} session={s} view="grid" />
            ))}
          </div>
        ) : (
          <div
            className="bg-white border rounded-md shadow-sm overflow-hidden"
            style={{ borderColor: colors.surface[200] }}
          >
            {/* ── ENTERPRISE TABLE HEADER ── */}
            <div
              className="grid items-center gap-4 px-5 py-3 border-b"
              style={{
                gridTemplateColumns: TABLE_GRID,
                borderColor: colors.surface[200],
                background: colors.surface[50],
              }}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-widest text-left"
                style={{ color: colors.text.secondary }}
              >
                Document
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-widest text-center"
                style={{ color: colors.text.secondary }}
              >
                Pattern
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-widest text-center"
                style={{ color: colors.text.secondary }}
              >
                Status
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-widest text-center"
                style={{ color: colors.text.secondary }}
              >
                Score
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-widest text-center"
                style={{ color: colors.text.secondary }}
              >
                Date
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-widest text-right"
                style={{ color: colors.text.secondary }}
              >
                Actions
              </span>
            </div>

            {/* Table Body */}
            <div className="flex flex-col">
              {filtered.map((s) => (
                <SessionCard key={s.id} session={s} view="list" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
