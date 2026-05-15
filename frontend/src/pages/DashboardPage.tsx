import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";
import { api } from "../lib/api";

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
const FilterIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
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
        className="flex items-center gap-4 px-5 py-3.5 border-b last:border-b-0 group transition-colors cursor-pointer"
        style={{ borderColor: colors.surface[200] }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background =
            colors.surface[50];
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <div
          className="h-8 w-8 rounded-md flex items-center justify-center text-white font-bold font-mono text-[13px] shrink-0"
          style={{ background: colors.text.primary }}
        >
          {session.title.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-[13.5px] font-semibold truncate group-hover:underline"
              style={{ color: colors.text.primary }}
            >
              {session.title}
            </span>
            <span
              className="text-[11px] px-1.5 py-0.5 rounded-md shrink-0"
              style={{
                background: colors.surface[100],
                color: colors.text.secondary,
              }}
            >
              Document
            </span>
          </div>
          <p
            className="text-[12px] mt-0.5 font-mono"
            style={{ color: colors.text.secondary }}
          >
            {detailsStr}
          </p>
        </div>
        <div className="hidden lg:block w-[72px]">
          <IkiSparkline status={session.classification} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
          <span
            className="text-[12px] font-bold w-12 text-right"
            style={{ color: st.dot }}
          >
            {session.confidence}%
          </span>
        </div>
        <span
          className="text-[12px] w-32 text-right shrink-0 truncate"
          style={{ color: colors.text.secondary }}
        >
          {session.date}
        </span>
      </div>
    );
  }

  return (
    <div
      className="bg-white border rounded-md p-5 flex flex-col justify-between h-[168px] transition-all cursor-pointer group hover:border-black/20"
      style={{ borderColor: colors.surface[200] }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow =
          "0 4px 16px -4px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
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
      <div className="flex items-end justify-between">
        <div>
          <div
            className="flex items-center gap-1.5 mt-0.5 text-[11px]"
            style={{ color: colors.text.secondary }}
          >
            <ClockIcon />
            <span>{session.date}</span>
          </div>
        </div>
        <span className="text-[14px] font-extrabold" style={{ color: st.dot }}>
          {session.confidence}%
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "HUMAN" | "SUSPICIOUS" | "AI-GENERATED"
  >("ALL");

  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch real data from FastAPI
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.get("/sessions/history/student");
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

  // Filter Logic
  const filtered = sessions.filter((s) => {
    const matchSearch = s.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "ALL" || s.classification === statusFilter;
    return matchSearch && matchStatus;
  });

  // RESTRICT TO TOP 6 FOR DASHBOARD
  const displayedSessions = filtered.slice(0, 6);

  // Dynamic Real-World Metrics Calculation
  const totalSessions = sessions.length;
  const humanSessions = sessions.filter(
    (s) => s.classification === "HUMAN",
  ).length;
  const avgConfidence =
    totalSessions > 0
      ? (
          sessions.reduce((acc, s) => acc + s.confidence, 0) / totalSessions
        ).toFixed(1)
      : "0";
  const passRate =
    totalSessions > 0 ? Math.round((humanSessions / totalSessions) * 100) : 0;

  // Calculate Real Global Usage
  const totalDurationSeconds = sessions.reduce((acc, s) => acc + s.duration, 0);
  const formattedTotalTime =
    totalDurationSeconds > 3600
      ? `${(totalDurationSeconds / 3600).toFixed(1)}h`
      : `${Math.round(totalDurationSeconds / 60)}m`;

  // Words = (WPM * Minutes)
  const totalWords = Math.round(
    sessions.reduce((acc, s) => acc + s.wpm * (s.duration / 60), 0),
  );

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto w-full flex flex-col gap-6 font-sans bg-brand-bgPage min-h-screen">
      {/* ── TOOLBAR ── */}
      <div className="flex items-center gap-2.5 flex-wrap">
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
            title="Grid view"
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
            title="List view"
          >
            <ListIcon />
          </button>
        </div>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
        {/* ── LEFT COLUMN: ANALYTICS ── */}
        <div className="flex flex-col gap-5">
          {/* Dynamic Top-Level Stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Total Sessions", value: totalSessions },
              { label: "Avg Confidence", value: `${avgConfidence}%` },
              { label: "Human Rate", value: `${passRate}%` },
              {
                label: "AI Flags",
                value: sessions.filter(
                  (s) => s.classification === "AI-GENERATED",
                ).length,
              },
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

          {/* Real Global Metrics (Replaces the 'Upgrade to Pro' usage block) */}
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
                { label: "Total Analysis Time", value: formattedTotalTime },
                { label: "Ledger Entries", value: totalSessions },
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

        {/* ── RIGHT COLUMN: SESSION GRID/LIST ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3
              className="text-[13px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Recent Sessions
              <span
                className="ml-2 text-[11px] font-normal"
                style={{ color: colors.text.secondary }}
              >
                Showing {displayedSessions.length} of {filtered.length}
              </span>
            </h3>
            <div className="flex items-center gap-2">
              <Link
                to="/sessions"
                className="flex items-center h-8 px-3 rounded-md text-[12px] font-semibold border transition-colors hover:bg-surface-50 shadow-sm"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.secondary,
                }}
              >
                View All
              </Link>
              <Link
                to={ROUTES.EDITOR_NEW}
                className="flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-semibold text-white transition-opacity hover:opacity-90 shadow-sm"
                style={{ background: colors.text.primary }}
              >
                <PlusIcon /> New Session
              </Link>
            </div>
          </div>

          {isLoading ? (
            <div
              className="py-16 text-center border rounded-md border-dashed flex flex-col items-center justify-center gap-3"
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
                  : `No sessions match "${search}"`}
              </p>
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedSessions.map((s) => (
                <SessionCard key={s.id} session={s} view="grid" />
              ))}
            </div>
          ) : (
            <div
              className="bg-white border rounded-md overflow-hidden shadow-sm"
              style={{ borderColor: colors.surface[200] }}
            >
              <div
                className="grid px-5 py-2.5 border-b"
                style={{
                  gridTemplateColumns: "2fr 80px 120px 80px 140px",
                  borderColor: colors.surface[200],
                  background: colors.surface[50],
                }}
              >
                {["Document", "IKI Pattern", "Status", "Score", "Date"].map(
                  (h) => (
                    <span
                      key={h}
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: colors.text.secondary }}
                    >
                      {h}
                    </span>
                  ),
                )}
              </div>
              {displayedSessions.map((s) => (
                <SessionCard key={s.id} session={s} view="list" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
