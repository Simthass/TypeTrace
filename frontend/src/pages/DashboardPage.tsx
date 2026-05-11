import { useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { brand, colors } from "../styles/colors";

// ─── mock data — will be replaced with real API data in sprint 5 ─────────────
const mockSessions = [
  {
    id: "ses_1",
    title: "Cloud Computing Essay",
    date: "May 7, 2026",
    words: 1240,
    status: "HUMAN" as const,
    score: 96.3,
    duration: "1h 12m",
    wpm: 58,
  },
  {
    id: "ses_2",
    title: "Distributed Systems Notes",
    date: "May 5, 2026",
    words: 450,
    status: "SUSPICIOUS" as const,
    score: 67.2,
    duration: "28m",
    wpm: 42,
  },
  {
    id: "ses_3",
    title: "Literature Review — AI",
    date: "May 2, 2026",
    words: 2100,
    status: "HUMAN" as const,
    score: 98.1,
    duration: "2h 47m",
    wpm: 64,
  },
  {
    id: "ses_4",
    title: "CopyPaste_Test.txt",
    date: "April 28, 2026",
    words: 850,
    status: "AI-GENERATED" as const,
    score: 99.4,
    duration: "4m",
    wpm: 212,
  },
];

// ─── status config helper ─────────────────────────────────────────────────────
function getStatusStyle(status: "HUMAN" | "SUSPICIOUS" | "AI-GENERATED") {
  if (status === "HUMAN")
    return {
      color: brand.humanText,
      bg: brand.humanBg,
      dot: brand.humanAccent,
    };
  if (status === "SUSPICIOUS")
    return {
      color: brand.suspiciousText,
      bg: brand.suspiciousBg,
      dot: brand.suspiciousAccent,
    };
  return { color: brand.aiText, bg: brand.aiBg, dot: brand.aiAccent };
}

// ─── mini sparkline for the stat cards ───────────────────────────────────────
// not a real chart, just decorative to make the cards look data rich
function MiniSparkline({ color, up = true }: { color: string; up?: boolean }) {
  const points = up
    ? "0,18 12,14 24,16 36,10 48,12 60,6 72,8 84,4 96,2"
    : "0,4 12,8 24,6 36,12 48,10 60,14 72,16 84,18 96,16";
  return (
    <svg
      width="96"
      height="20"
      viewBox="0 0 96 20"
      fill="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.6"
      />
    </svg>
  );
}

// ─── stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon,
  sparklineColor,
  sparklineUp,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  sparklineColor: string;
  sparklineUp?: boolean;
}) {
  return (
    <div
      className="bg-white border border-surface-200 rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200 hover:border-brand group cursor-default"
      // using group so we can subtly animate the icon on hover
    >
      <div className="flex items-start justify-between">
        <div>
          <p
            className="text-[11px] font-bold uppercase tracking-widest mb-2"
            style={{ color: colors.text.secondary }}
          >
            {label}
          </p>
          <p
            className="text-[32px] font-extrabold leading-none tracking-tight"
            style={{ color: colors.text.primary }}
          >
            {value}
          </p>
        </div>
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-colors"
          style={{
            background: colors.surface[50],
            color: colors.text.secondary,
          }}
        >
          {icon}
        </div>
      </div>

      <div className="flex items-end justify-between">
        <p className="text-[12px]" style={{ color: colors.text.secondary }}>
          {sub}
        </p>
        <MiniSparkline color={sparklineColor} up={sparklineUp} />
      </div>
    </div>
  );
}

// ─── activity feed item ───────────────────────────────────────────────────────
function ActivityItem({
  title,
  time,
  type,
}: {
  title: string;
  time: string;
  type: "session" | "cert" | "login";
}) {
  const icons = {
    session: (
      <svg
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        viewBox="0 0 24 24"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    cert: (
      <svg
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        viewBox="0 0 24 24"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    login: (
      <svg
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        viewBox="0 0 24 24"
      >
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <polyline points="10 17 15 12 10 7" />
        <line x1="15" y1="12" x2="3" y2="12" />
      </svg>
    ),
  };

  const dotColors = {
    session: brand.action,
    cert: brand.humanAccent,
    login: colors.text.secondary,
  };

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-surface-200 last:border-0">
      <div
        className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${dotColors[type]}14`, color: dotColors[type] }}
      >
        {icons[type]}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] font-medium truncate"
          style={{ color: colors.text.primary }}
        >
          {title}
        </p>
      </div>
      <p
        className="text-[11px] shrink-0"
        style={{ color: colors.text.secondary }}
      >
        {time}
      </p>
    </div>
  );
}

// ─── empty state for when there are no sessions ───────────────────────────────
// shows a nice prompt instead of blank space
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div
        className="h-14 w-14 rounded-2xl flex items-center justify-center"
        style={{ background: `${brand.action}10` }}
      >
        <svg
          width="24"
          height="24"
          fill="none"
          stroke={brand.action}
          strokeWidth="1.6"
          strokeLinecap="round"
          viewBox="0 0 24 24"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M12 12v6M9 15h6" />
        </svg>
      </div>
      <div className="text-center">
        <p
          className="text-[15px] font-semibold mb-1"
          style={{ color: colors.text.primary }}
        >
          No sessions yet
        </p>
        <p className="text-[13px]" style={{ color: colors.text.secondary }}>
          Start writing to generate your first certificate
        </p>
      </div>
      <Link
        to={ROUTES.EDITOR_NEW}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-all hover:opacity-90"
        style={{ background: brand.action }}
      >
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
        New Session
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [activeFilter, setActiveFilter] = useState<
    "ALL" | "HUMAN" | "SUSPICIOUS" | "AI-GENERATED"
  >("ALL");

  const filtered =
    activeFilter === "ALL"
      ? mockSessions
      : mockSessions.filter((s) => s.status === activeFilter);

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
      {/* ── page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1
            className="text-[24px] font-bold tracking-tight mb-1"
            style={{ color: colors.text.primary }}
          >
            Overview
          </h1>
          <p className="text-[13.5px]" style={{ color: colors.text.secondary }}>
            Welcome back, Simthass. Here's your authorship activity.
          </p>
        </div>

        <Link
          to={ROUTES.EDITOR_NEW}
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
          style={{
            background: brand.action,
            boxShadow: `0 2px 8px -2px ${brand.action}55`,
          }}
        >
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
          New Session
        </Link>
      </div>

      {/* ── stat cards row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Verified Words"
          value="3,790"
          sub="Across 4 sessions"
          sparklineColor={brand.action}
          sparklineUp
          icon={
            <svg
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              viewBox="0 0 24 24"
            >
              <path d="M3 3v18h18" />
              <path d="M18 9l-5 5-4-4-5 5" />
            </svg>
          }
        />
        <StatCard
          label="Avg. Confidence"
          value="87.2%"
          sub="↑ 4.1% from last week"
          sparklineColor={brand.humanAccent}
          sparklineUp
          icon={
            <svg
              width="16"
              height="16"
              fill="none"
              stroke={brand.humanAccent}
              strokeWidth="1.8"
              strokeLinecap="round"
              viewBox="0 0 24 24"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          }
        />
        <StatCard
          label="Certificates"
          value="2"
          sub="Last generated May 7"
          sparklineColor={brand.action}
          sparklineUp
          icon={
            <svg
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              viewBox="0 0 24 24"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          }
        />
        <StatCard
          label="Avg. WPM"
          value="61"
          sub="Healthy human range"
          sparklineColor={colors.text.secondary}
          icon={
            <svg
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              viewBox="0 0 24 24"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          }
        />
      </div>

      {/* ── main content grid: table + activity feed ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* ── sessions table ── */}
        <div className="bg-white border border-surface-200 rounded-2xl overflow-hidden">
          {/* table header + filters */}
          <div className="px-5 py-4 border-b border-surface-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2
              className="text-[15px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Recent Sessions
            </h2>

            {/* filter pills — cleaner than a dropdown for this usecase */}
            <div
              className="flex items-center gap-1 p-1 rounded-xl border border-surface-200"
              style={{ background: colors.surface[50] }}
            >
              {(["ALL", "HUMAN", "SUSPICIOUS", "AI-GENERATED"] as const).map(
                (f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className="px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all duration-150"
                    style={{
                      background: activeFilter === f ? "#fff" : "transparent",
                      color:
                        activeFilter === f
                          ? colors.text.primary
                          : colors.text.secondary,
                      boxShadow:
                        activeFilter === f
                          ? `0 1px 4px rgba(0,0,0,0.06)`
                          : "none",
                      border:
                        activeFilter === f
                          ? `1px solid ${colors.surface[200]}`
                          : "1px solid transparent",
                    }}
                  >
                    {f === "AI-GENERATED" ? "AI" : f}
                  </button>
                ),
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr style={{ background: colors.surface[50] }}>
                    {["Document", "Date", "Words", "WPM", "Result", ""].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-5 py-3 text-[11px] font-bold uppercase tracking-widest border-b border-surface-200 whitespace-nowrap"
                          style={{ color: colors.text.secondary }}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => {
                    const st = getStatusStyle(s.status);
                    return (
                      <tr
                        key={s.id}
                        className="group transition-colors"
                        style={{
                          borderBottom:
                            i < filtered.length - 1
                              ? `1px solid ${colors.surface[200]}`
                              : "none",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background =
                            colors.surface[50];
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background =
                            "transparent";
                        }}
                      >
                        {/* title + subtitle */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: colors.surface[100] }}
                            >
                              <svg
                                width="12"
                                height="12"
                                fill="none"
                                stroke={colors.text.secondary}
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                viewBox="0 0 24 24"
                              >
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                            </div>
                            <div>
                              <p
                                className="text-[13px] font-semibold leading-tight"
                                style={{ color: colors.text.primary }}
                              >
                                {s.title}
                              </p>
                              <p
                                className="text-[11px]"
                                style={{ color: colors.text.secondary }}
                              >
                                {s.duration}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td
                          className="px-5 py-3.5 text-[13px] whitespace-nowrap"
                          style={{ color: colors.text.secondary }}
                        >
                          {s.date}
                        </td>
                        <td
                          className="px-5 py-3.5 text-[13px] font-medium"
                          style={{ color: colors.text.primary }}
                        >
                          {s.words.toLocaleString()}
                        </td>
                        <td
                          className="px-5 py-3.5 text-[13px] font-medium"
                          style={{ color: colors.text.secondary }}
                        >
                          {s.wpm}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border"
                              style={{
                                background: st.bg,
                                color: st.color,
                                borderColor: `${st.dot}28`,
                              }}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ background: st.dot }}
                              />
                              {s.status === "AI-GENERATED" ? "AI" : s.status}
                            </span>
                            <span
                              className="text-[11px] font-bold"
                              style={{ color: st.dot }}
                            >
                              {s.score}%
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-all text-[12px] font-medium px-3 py-1.5 rounded-lg border border-surface-200 hover:border-brand"
                            style={{ color: brand.action }}
                          >
                            Download
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* table footer with pagination hint */}
          <div
            className="px-5 py-3 border-t border-surface-200 flex items-center justify-between"
            style={{ background: colors.surface[50] }}
          >
            <p className="text-[12px]" style={{ color: colors.text.secondary }}>
              Showing {filtered.length} of {mockSessions.length} sessions
            </p>
            <Link
              to={ROUTES.EDITOR}
              className="text-[12px] font-semibold transition-colors"
              style={{ color: brand.action }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = brand.actionHover)
              }
              onMouseLeave={(e) => (e.currentTarget.style.color = brand.action)}
            >
              View all sessions →
            </Link>
          </div>
        </div>

        {/* ── right column: activity + quick actions ── */}
        <div className="flex flex-col gap-4">
          {/* quick actions */}
          <div className="bg-white border border-surface-200 rounded-2xl p-4">
            <h3
              className="text-[12px] font-bold uppercase tracking-widest mb-3"
              style={{ color: colors.text.secondary }}
            >
              Quick Actions
            </h3>
            <div className="flex flex-col gap-2">
              {[
                {
                  label: "New Writing Session",
                  desc: "Start capturing biometrics",
                  to: ROUTES.EDITOR_NEW,
                  primary: true,
                },
                {
                  label: "View Certificates",
                  desc: "Download or verify",
                  to: ROUTES.REPORTS,
                  primary: false,
                },
                {
                  label: "Account Settings",
                  desc: "Privacy & preferences",
                  to: ROUTES.SETTINGS,
                  primary: false,
                },
              ].map(({ label, desc, to, primary }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border transition-all group"
                  style={{
                    borderColor: primary
                      ? brand.action + "40"
                      : colors.surface[200],
                    background: primary ? `${brand.action}07` : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor =
                      brand.action + "60";
                    (e.currentTarget as HTMLElement).style.background =
                      `${brand.action}08`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = primary
                      ? brand.action + "40"
                      : colors.surface[200];
                    (e.currentTarget as HTMLElement).style.background = primary
                      ? `${brand.action}07`
                      : "transparent";
                  }}
                >
                  <div>
                    <p
                      className="text-[13px] font-semibold leading-tight"
                      style={{
                        color: primary ? brand.action : colors.text.primary,
                      }}
                    >
                      {label}
                    </p>
                    <p
                      className="text-[11px] mt-0.5"
                      style={{ color: colors.text.secondary }}
                    >
                      {desc}
                    </p>
                  </div>
                  <svg
                    width="14"
                    height="14"
                    fill="none"
                    stroke={brand.action}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    viewBox="0 0 24 24"
                    className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>

          {/* recent activity feed */}
          <div className="bg-white border border-surface-200 rounded-2xl p-4 flex-1">
            <h3
              className="text-[12px] font-bold uppercase tracking-widest mb-3"
              style={{ color: colors.text.secondary }}
            >
              Recent Activity
            </h3>
            <div>
              <ActivityItem
                title="Cloud Computing Essay session ended"
                time="2h ago"
                type="session"
              />
              <ActivityItem
                title="Certificate generated — SHA-256 sealed"
                time="2h ago"
                type="cert"
              />
              <ActivityItem
                title="Distributed Systems Notes session ended"
                time="2d ago"
                type="session"
              />
              <ActivityItem
                title="Literature Review certificate issued"
                time="4d ago"
                type="cert"
              />
              <ActivityItem title="Account created" time="May 1" type="login" />
            </div>
          </div>

          {/* privacy reminder — good to show this in dashboard */}
          <div
            className="rounded-2xl p-4 flex gap-3"
            style={{
              background: `${brand.action}07`,
              border: `1px solid ${brand.action}18`,
            }}
          >
            <svg
              width="16"
              height="16"
              fill="none"
              stroke={brand.action}
              strokeWidth="1.8"
              strokeLinecap="round"
              viewBox="0 0 24 24"
              className="shrink-0 mt-0.5"
            >
              <rect x="5" y="10" width="14" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <div>
              <p
                className="text-[12px] font-semibold mb-0.5"
                style={{ color: brand.action }}
              >
                Your data is private
              </p>
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: brand.action, opacity: 0.75 }}
              >
                Essay content never leaves your device. Only anonymised
                keystroke timing data is processed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
