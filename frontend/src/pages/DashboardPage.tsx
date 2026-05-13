import { useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { useAuthStore } from "../store/authStore";
import { colors, brand } from "../styles/colors";

// ─── mock data — swap for real API call in sprint 5 ──────────────────────────
const mockSessions = [
  {
    id: "ses_1",
    title: "Cloud Computing Essay",
    subject: "CS-401",
    details: "1,240 words · 58 WPM · 1h 12m",
    date: "1d ago",
    status: "HUMAN" as const,
    score: 96.3,
  },
  {
    id: "ses_2",
    title: "Distributed Systems Notes",
    subject: "CS-405",
    details: "450 words · 42 WPM · 28m",
    date: "3d ago",
    status: "SUSPICIOUS" as const,
    score: 67.2,
  },
  {
    id: "ses_3",
    title: "Literature Review — AI",
    subject: "ENG-201",
    details: "2,100 words · 64 WPM · 2h 47m",
    date: "Apr 26",
    status: "HUMAN" as const,
    score: 98.1,
  },
  {
    id: "ses_4",
    title: "Final Year Project Report",
    subject: "PRJ-500",
    details: "8,500 words · 61 WPM · 12h 4m",
    date: "Apr 21",
    status: "HUMAN" as const,
    score: 94.7,
  },
  {
    id: "ses_5",
    title: "CopyPaste_Test.txt",
    subject: "Sandbox",
    details: "850 words · 212 WPM · 4m",
    date: "Feb 14",
    status: "AI-GENERATED" as const,
    score: 99.4,
  },
  {
    id: "ses_6",
    title: "Ethics in Tech Essay",
    subject: "PHIL-302",
    details: "1,500 words · 55 WPM · 1h 45m",
    date: "Jan 10",
    status: "HUMAN" as const,
    score: 91.2,
  },
];

// ─── status style helper ──────────────────────────────────────────────────────
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

// ─── icons ────────────────────────────────────────────────────────────────────
function SearchIcon() {
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
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function FilterIcon() {
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

function PlusIcon() {
  return (
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
}

function ClockIcon() {
  return (
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
}

function DownloadIcon() {
  return (
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
}

// ─── mini sparkline — unique to TypeTrace, shows IKI rhythm per session ───────
// its not a real chart just decorative, looks professional though
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

// ─── session card ─────────────────────────────────────────────────────────────
function SessionCard({
  session,
  view,
}: {
  session: (typeof mockSessions)[0];
  view: "grid" | "list";
}) {
  const st = getStatusStyle(session.status);

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
        {/* icon */}
        <div
          className="h-8 w-8 rounded-md flex items-center justify-center text-white font-bold font-mono text-[13px] shrink-0"
          style={{ background: colors.text.primary }}
        >
          {session.title.charAt(0)}
        </div>

        {/* title + meta */}
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
              {session.subject}
            </span>
          </div>
          <p
            className="text-[12px] mt-0.5"
            style={{ color: colors.text.secondary }}
          >
            {session.details}
          </p>
        </div>

        {/* IKI sparkline — unique TypeTrace element */}
        <div className="hidden lg:block w-[72px]">
          <IkiSparkline status={session.status} />
        </div>

        {/* status + score */}
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
              {session.status === "AI-GENERATED" ? "AI" : session.status}
            </span>
          </div>
          <span
            className="text-[12px] font-bold w-12 text-right"
            style={{ color: st.dot }}
          >
            {session.score}%
          </span>
        </div>

        {/* date */}
        <span
          className="text-[12px] w-14 text-right shrink-0"
          style={{ color: colors.text.secondary }}
        >
          {session.date}
        </span>

        {/* actions — fade in on hover */}
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-surface-100"
          style={{ color: colors.text.secondary }}
          title="Download certificate"
        >
          <DownloadIcon />
        </button>
      </div>
    );
  }

  // grid view
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
            {session.title.charAt(0)}
          </div>
          <div className="min-w-0">
            <p
              className="text-[13.5px] font-semibold truncate group-hover:underline"
              style={{ color: colors.text.primary }}
            >
              {session.title}
            </p>
            <p className="text-[12px]" style={{ color: colors.text.secondary }}>
              {session.subject}
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
            {session.status === "AI-GENERATED" ? "AI" : session.status}
          </span>
        </div>
      </div>

      {/* IKI sparkline — this is our unique biometric fingerprint visualisation */}
      <IkiSparkline status={session.status} />

      <div className="flex items-end justify-between">
        <div>
          <p className="text-[12.5px]" style={{ color: colors.text.primary }}>
            {session.details}
          </p>
          <div
            className="flex items-center gap-1.5 mt-0.5 text-[11px]"
            style={{ color: colors.text.secondary }}
          >
            <ClockIcon />
            <span>{session.date}</span>
          </div>
        </div>
        <span className="text-[14px] font-extrabold" style={{ color: st.dot }}>
          {session.score}%
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "HUMAN" | "SUSPICIOUS" | "AI-GENERATED"
  >("ALL");
  const { user } = useAuthStore();

  const filtered = mockSessions.filter((s) => {
    const matchSearch = s.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto w-full flex flex-col gap-6">
      {/* ── toolbar: search + filters + view toggle ── */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* search */}
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
            // make focus ring use our brand color, not tailwinds default blue
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 2px ${colors.text.primary}20`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)";
            }}
          />
        </div>

        {/* status filter pills */}
        <div
          className="flex items-center border rounded-md shadow-sm overflow-hidden bg-white"
          style={{ borderColor: colors.surface[200] }}
        >
          {(["ALL", "HUMAN", "SUSPICIOUS", "AI-GENERATED"] as const).map(
            (f, i) => (
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

        {/* filter button */}
        <button
          className="h-9 w-9 bg-white border rounded-md flex items-center justify-center shadow-sm transition-colors hover:bg-surface-50"
          style={{
            borderColor: colors.surface[200],
            color: colors.text.secondary,
          }}
          title="Filter options"
        >
          <FilterIcon />
        </button>

        {/* grid / list toggle */}
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

      {/* ── main two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
        {/* ── LEFT COLUMN ── */}
        <div className="flex flex-col gap-5">
          {/* ── quick stats row — unique TypeTrace element ── */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Verified Words", value: "14.6K" },
              { label: "Avg Confidence", value: "91.2%" },
              { label: "Sessions", value: "6" },
              { label: "Certificates", value: "4" },
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
                  className="text-[22px] font-extrabold leading-none"
                  style={{ color: colors.text.primary }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* ── usage card ── */}
          <div>
            <h3
              className="text-[13px] font-semibold mb-2"
              style={{ color: colors.text.primary }}
            >
              Usage
            </h3>
            <div
              className="bg-white border rounded-md shadow-sm p-5"
              style={{ borderColor: colors.surface[200] }}
            >
              <div className="flex justify-between items-center mb-5">
                <span
                  className="text-[13px] font-medium"
                  style={{ color: colors.text.secondary }}
                >
                  Last 30 days
                </span>
                <Link
                  to={ROUTES.SETTINGS}
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold text-white transition-opacity hover:opacity-90"
                  style={{ background: colors.text.primary }}
                >
                  Upgrade
                </Link>
              </div>

              <div className="flex flex-col gap-3.5">
                {[
                  {
                    label: "Keystrokes Analysed",
                    used: 3700,
                    total: 10000,
                    display: "3.7K / 10K",
                  },
                  {
                    label: "Certificates Issued",
                    used: 4,
                    total: 10,
                    display: "4 / 10",
                  },
                  {
                    label: "Processing Time",
                    used: 277,
                    total: 14400,
                    display: "4m 37s / 4h",
                  },
                  {
                    label: "Verification Requests",
                    used: 142,
                    total: 1000,
                    display: "142 / 1K",
                  },
                ].map(({ label, used, total, display }) => (
                  <div key={label} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[12.5px]">
                      <span style={{ color: colors.text.secondary }}>
                        {label}
                      </span>
                      <span
                        className="font-mono font-semibold"
                        style={{ color: colors.text.primary }}
                      >
                        {display}
                      </span>
                    </div>
                    <div
                      className="h-1 rounded-md overflow-hidden"
                      style={{ background: colors.surface[200] }}
                    >
                      <div
                        className="h-full rounded-md transition-all duration-700"
                        style={{
                          width: `${Math.min((used / total) * 100, 100)}%`,
                          background: colors.text.primary,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── biometric health card — TypeTrace exclusive, not in vercel ── */}
          <div>
            <h3
              className="text-[13px] font-semibold mb-2"
              style={{ color: colors.text.primary }}
            >
              Biometric Health
            </h3>
            <div
              className="bg-white border rounded-md shadow-sm p-5"
              style={{ borderColor: colors.surface[200] }}
            >
              <div className="flex flex-col gap-4">
                {[
                  { label: "Avg IKI Variance", value: "±134ms", good: true },
                  { label: "Avg Deletion Rate", value: "8.2%", good: true },
                  { label: "Paste Events", value: "1 detected", good: false },
                  { label: "Avg WPM", value: "61 WPM", good: true },
                ].map(({ label, value, good }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0"
                        style={{
                          background: good ? brand.humanAccent : brand.aiAccent,
                        }}
                      />
                      <span
                        className="text-[12.5px]"
                        style={{ color: colors.text.secondary }}
                      >
                        {label}
                      </span>
                    </div>
                    <span
                      className="text-[12.5px] font-semibold font-mono"
                      style={{
                        color: good ? colors.text.primary : brand.aiAccent,
                      }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── alerts card ── */}
          <div>
            <h3
              className="text-[13px] font-semibold mb-2"
              style={{ color: colors.text.primary }}
            >
              Alerts
            </h3>
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
                Get anomaly alerts
              </p>
              <p
                className="text-[12px] leading-relaxed max-w-[180px]"
                style={{ color: colors.text.secondary }}
              >
                Monitor sessions for AI paste events and get notified
                automatically.
              </p>
              <button
                className="mt-1 px-4 py-1.5 rounded-md border text-[12px] font-semibold hover:bg-surface-50 transition-colors"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              >
                Upgrade to Pro
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: sessions ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3
              className="text-[13px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Sessions
              <span
                className="ml-2 text-[11px] font-normal"
                style={{ color: colors.text.secondary }}
              >
                {filtered.length} of {mockSessions.length}
              </span>
            </h3>
            <Link
              to={ROUTES.EDITOR_NEW}
              className="flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: colors.text.primary }}
            >
              <PlusIcon />
              New Session
            </Link>
          </div>

          {/* sessions grid or list */}
          {filtered.length === 0 ? (
            <div
              className="py-16 text-center border rounded-md border-dashed"
              style={{ borderColor: colors.surface[200] }}
            >
              <p
                className="text-[13.5px]"
                style={{ color: colors.text.secondary }}
              >
                No sessions match "{search}"
              </p>
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((s) => (
                <SessionCard key={s.id} session={s} view="grid" />
              ))}
            </div>
          ) : (
            <div
              className="bg-white border rounded-md overflow-hidden shadow-sm"
              style={{ borderColor: colors.surface[200] }}
            >
              {/* list header */}
              <div
                className="grid px-5 py-2.5 border-b"
                style={{
                  gridTemplateColumns: "2fr 80px 120px 80px 60px 32px",
                  borderColor: colors.surface[200],
                  background: colors.surface[50],
                }}
              >
                {["Document", "IKI Pattern", "Status", "Score", "Date", ""].map(
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
              {filtered.map((s) => (
                <SessionCard key={s.id} session={s} view="list" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
