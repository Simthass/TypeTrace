import { useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";

// ─── Domain Mock Data ─────────────────────────────────────────────────────────
const mockSessions = [
  {
    id: "ses_1",
    title: "Cloud Computing Essay",
    subject: "CS-401",
    details: "1,240 words • 58 WPM • 1h 12m",
    date: "1d ago",
    status: "HUMAN",
  },
  {
    id: "ses_2",
    title: "Distributed Systems Notes",
    subject: "CS-405",
    details: "450 words • 42 WPM • 28m",
    date: "3d ago",
    status: "SUSPICIOUS",
  },
  {
    id: "ses_3",
    title: "Literature Review — AI",
    subject: "ENG-201",
    details: "2,100 words • 64 WPM • 2h 47m",
    date: "Apr 26",
    status: "HUMAN",
  },
  {
    id: "ses_4",
    title: "Final Year Project Report",
    subject: "PRJ-500",
    details: "8,500 words • 61 WPM • 12h 4m",
    date: "Apr 21",
    status: "HUMAN",
  },
  {
    id: "ses_5",
    title: "CopyPaste_Test.txt",
    subject: "Sandbox",
    details: "850 words • 212 WPM • 4m",
    date: "Feb 14",
    status: "AI-GENERATED",
  },
  {
    id: "ses_6",
    title: "Ethics in Tech Essay",
    subject: "PHIL-302",
    details: "1,500 words • 55 WPM • 1h 45m",
    date: "Jan 10",
    status: "HUMAN",
  },
];

// ─── Icons ────────────────────────────────────────────────────────────────────
function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
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
}

function GridIcon() {
  return (
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
}

function ListIcon() {
  return (
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
}

function ClockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

// ─── Status Style Map ─────────────────────────────────────────────────────────
function getStatusClasses(status: string) {
  if (status === "HUMAN")
    return {
      border: `border-[${colors.surface[200]}]`,
      dot: brand.humanAccent,
      bg: brand.humanBg,
      text: brand.humanText,
    };
  if (status === "SUSPICIOUS")
    return {
      border: `border-[${brand.suspiciousAccent}50]`,
      dot: brand.suspiciousAccent,
      bg: brand.suspiciousBg,
      text: brand.suspiciousText,
    };
  return {
    border: `border-[${brand.aiAccent}50]`,
    dot: brand.aiAccent,
    bg: brand.aiBg,
    text: brand.aiText,
  };
}

// ─── IKI Sparkline ────────────────────────────────────────────────────────────
function IkiSparkline({ status }: { status: string }) {
  const bars =
    status === "AI-GENERATED"
      ? [80, 82, 80, 81, 82, 80, 81, 80, 82, 81]
      : status === "SUSPICIOUS"
        ? [30, 70, 20, 80, 40, 90, 25, 60, 75, 35]
        : [40, 65, 30, 75, 50, 85, 45, 70, 55, 80];

  const st = getStatusClasses(status);

  return (
    <div className="flex items-end gap-[2px] h-5 w-16">
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

export default function SessionsPage() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("list"); // Default to list for sessions page
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "HUMAN" | "SUSPICIOUS" | "AI-GENERATED"
  >("ALL");

  const filtered = mockSessions.filter((s) => {
    const matchSearch = s.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 md:p-10 max-w-[1200px] mx-auto w-full flex flex-col gap-6">
      {/* ── Page Header ── */}
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight mb-1"
          style={{ color: colors.text.primary }}
        >
          Sessions
        </h1>
        <p className="text-[14px]" style={{ color: colors.text.secondary }}>
          Manage and review your biometric authentication sessions.
        </p>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: colors.text.secondary }}
          >
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search sessions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-md text-[14px] bg-white border outline-none focus:ring-1 focus:ring-black transition-shadow shadow-sm"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          />
        </div>

        {/* Status Filters */}
        <div
          className="flex border rounded-md shadow-sm overflow-hidden bg-white"
          style={{ borderColor: colors.surface[200] }}
        >
          {(["ALL", "HUMAN", "SUSPICIOUS", "AI-GENERATED"] as const).map(
            (f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className="h-9 px-3.5 text-[12px] font-semibold transition-colors border-r last:border-r-0"
                style={{
                  background: statusFilter === f ? colors.surface[100] : "#fff",
                  color:
                    statusFilter === f
                      ? colors.text.primary
                      : colors.text.secondary,
                  borderColor: colors.surface[200],
                }}
              >
                {f === "AI-GENERATED" ? "AI" : f}
              </button>
            ),
          )}
        </div>

        {/* View Toggles */}
        <div
          className="flex border rounded-md shadow-sm overflow-hidden bg-white"
          style={{ borderColor: colors.surface[200] }}
        >
          <button
            className="h-9 w-10 flex items-center justify-center transition-colors border-r"
            style={{
              background: view === "list" ? colors.surface[100] : "#fff",
              color:
                view === "list" ? colors.text.primary : colors.text.secondary,
              borderColor: colors.surface[200],
            }}
            onClick={() => setView("list")}
          >
            <ListIcon />
          </button>
          <button
            className="h-9 w-10 flex items-center justify-center transition-colors"
            style={{
              background: view === "grid" ? colors.surface[100] : "#fff",
              color:
                view === "grid" ? colors.text.primary : colors.text.secondary,
            }}
            onClick={() => setView("grid")}
          >
            <GridIcon />
          </button>
        </div>
      </div>

      {/* ── Content Area ── */}
      {filtered.length === 0 ? (
        <div
          className="py-20 text-center border rounded-md border-dashed bg-white"
          style={{ borderColor: colors.surface[200] }}
        >
          <p className="text-[14px]" style={{ color: colors.text.secondary }}>
            No sessions found matching your criteria.
          </p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => {
            const st = getStatusClasses(s.status);
            return (
              <div
                key={s.id}
                className="bg-white border rounded-md shadow-sm p-5 flex flex-col justify-between h-[160px] hover:shadow-md transition-all cursor-pointer group"
                style={{ borderColor: colors.surface[200] }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-black flex items-center justify-center text-white font-bold text-[14px] shrink-0 font-mono">
                      {s.title.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span
                        className="text-[14px] font-semibold truncate group-hover:underline"
                        style={{ color: colors.text.primary }}
                      >
                        {s.title}
                      </span>
                      <span
                        className="text-[13px] truncate"
                        style={{ color: colors.text.secondary }}
                      >
                        {s.subject}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-end mt-auto">
                  <div className="flex flex-col gap-1.5">
                    <div
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md border w-fit"
                      style={{ borderColor: st.border, backgroundColor: st.bg }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: st.dot }}
                      />
                      <span
                        className="text-[10px] font-bold tracking-widest uppercase"
                        style={{ color: st.text }}
                      >
                        {s.status === "AI-GENERATED" ? "AI" : s.status}
                      </span>
                    </div>
                    <div
                      className="flex items-center gap-2 text-[12px]"
                      style={{ color: colors.text.secondary }}
                    >
                      <span>{s.date}</span>
                    </div>
                  </div>
                  <IkiSparkline status={s.status} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="bg-white border rounded-md shadow-sm overflow-hidden"
          style={{ borderColor: colors.surface[200] }}
        >
          {/* List Header */}
          <div
            className="grid grid-cols-[1fr_120px_100px_100px_60px] gap-4 px-5 py-3 border-b items-center"
            style={{
              backgroundColor: colors.surface[50],
              borderColor: colors.surface[200],
            }}
          >
            <span
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: colors.text.secondary }}
            >
              Document
            </span>
            <span
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: colors.text.secondary }}
            >
              Rhythm
            </span>
            <span
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: colors.text.secondary }}
            >
              Status
            </span>
            <span
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: colors.text.secondary }}
            >
              Date
            </span>
            <span
              className="text-[11px] font-semibold uppercase tracking-wider text-right"
              style={{ color: colors.text.secondary }}
            >
              Action
            </span>
          </div>

          {/* List Rows */}
          <div
            className="flex flex-col divide-y"
            style={{ borderColor: colors.surface[200] }}
          >
            {filtered.map((s) => {
              const st = getStatusClasses(s.status);
              return (
                <div
                  key={s.id}
                  className="grid grid-cols-[1fr_120px_100px_100px_60px] gap-4 px-5 py-4 items-center hover:bg-gray-50 transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-black flex items-center justify-center text-white font-bold text-[14px] shrink-0 font-mono">
                      {s.title.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span
                        className="text-[14px] font-medium truncate group-hover:underline"
                        style={{ color: colors.text.primary }}
                      >
                        {s.title}
                      </span>
                      <span
                        className="text-[12px] truncate"
                        style={{ color: colors.text.secondary }}
                      >
                        {s.details}
                      </span>
                    </div>
                  </div>

                  <div>
                    <IkiSparkline status={s.status} />
                  </div>

                  <div>
                    <div
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md border w-fit"
                      style={{ borderColor: st.border, backgroundColor: st.bg }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: st.dot }}
                      />
                      <span
                        className="text-[10px] font-bold tracking-widest uppercase"
                        style={{ color: st.text }}
                      >
                        {s.status === "AI-GENERATED" ? "AI" : s.status}
                      </span>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-1.5 text-[13px]"
                    style={{ color: colors.text.secondary }}
                  >
                    <ClockIcon /> {s.date}
                  </div>

                  <div className="flex justify-end">
                    <button
                      className="p-1.5 rounded-md hover:bg-surface-200 transition-colors opacity-0 group-hover:opacity-100"
                      style={{ color: colors.text.secondary }}
                      title="Download Certificate"
                    >
                      <DownloadIcon />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
