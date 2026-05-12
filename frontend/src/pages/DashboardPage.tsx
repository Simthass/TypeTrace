import { useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { useAuthStore } from "../store/authStore";

// mock data for UI visual
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

function getStatusClasses(status: "HUMAN" | "SUSPICIOUS" | "AI-GENERATED") {
  if (status === "HUMAN")
    return { text: "text-verify-text", bg: "bg-verify-bg", dot: "bg-verify" };
  if (status === "SUSPICIOUS")
    return { text: "text-warn-text", bg: "bg-warn-bg", dot: "bg-warn" };
  return { text: "text-danger-text", bg: "bg-danger-bg", dot: "bg-danger" };
}

// ─── Stat Card Component (Vercel Style) ───
function StatCard({
  label,
  value,
  sub,
  sparklineColor,
}: {
  label: string;
  value: string;
  sub: string;
  sparklineColor: string;
}) {
  // strictly using rounded-lg and thin borders to match vercel
  return (
    <div className="bg-white border border-surface-200 rounded-lg p-5 flex flex-col shadow-card hover:shadow-card-md transition-shadow">
      <p className="text-[13px] font-medium text-text-secondary mb-1">
        {label}
      </p>
      <p className="text-[32px] font-semibold text-text-primary tracking-tight leading-none mb-3">
        {value}
      </p>

      <div className="flex items-center gap-2 mt-auto pt-4 border-t border-surface-200/60">
        <div className={`h-2 w-2 rounded-full ${sparklineColor}`} />
        <p className="text-[12px] text-text-secondary truncate">{sub}</p>
      </div>
    </div>
  );
}

// ─── Activity Item Component ───
function ActivityItem({
  title,
  time,
  type,
}: {
  title: string;
  time: string;
  type: "session" | "cert" | "login";
}) {
  const iconColors = {
    session: "text-brand bg-brand-light",
    cert: "text-verify bg-verify-bg",
    login: "text-text-secondary bg-surface-100",
  };

  return (
    <div className="flex items-center gap-3 py-3 border-b border-surface-100 last:border-0">
      <div
        className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${iconColors[type]}`}
      >
        {type === "cert" ? (
          <svg
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-text-primary truncate">
          {title}
        </p>
      </div>
      <p className="text-[12px] text-text-secondary shrink-0">{time}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [activeFilter, setActiveFilter] = useState<
    "ALL" | "HUMAN" | "SUSPICIOUS" | "AI-GENERATED"
  >("ALL");
  const { user } = useAuthStore();

  const filtered =
    activeFilter === "ALL"
      ? mockSessions
      : mockSessions.filter((s) => s.status === activeFilter);

  return (
    // made the max width wider like vercel layout
    <div className="p-6 md:p-10 max-w-[1400px] mx-auto w-full">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary mb-1">
            Overview
          </h1>
          <p className="text-[14px] text-text-secondary">
            Welcome back, {user?.first_name || "Student"}. Here's your
            verification activity.
          </p>
        </div>

        <Link
          to={ROUTES.EDITOR_NEW}
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-semibold bg-text-primary text-white transition-all hover:bg-black"
        >
          <svg
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            viewBox="0 0 24 24"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Session
        </Link>
      </div>

      {/* ── Stat Cards Grid (Vercel Style) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Verified Words"
          value="3,790"
          sub="Across 4 sessions"
          sparklineColor="bg-brand"
        />
        <StatCard
          label="Avg. Confidence"
          value="87.2%"
          sub="High human probability"
          sparklineColor="bg-verify"
        />
        <StatCard
          label="Certificates Issued"
          value="2"
          sub="Last generated May 7"
          sparklineColor="bg-brand"
        />
        <StatCard
          label="Average WPM"
          value="61"
          sub="Consistent typing rhythm"
          sparklineColor="bg-text-secondary"
        />
      </div>

      {/* ── Main Content Area ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Left Col: Projects/Sessions Table */}
        <div className="bg-white border border-surface-200 rounded-lg shadow-card overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-surface-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-[15px] font-semibold text-text-primary">
              Recent Sessions
            </h2>

            {/* Filter Tabs Vercel Style */}
            <div className="flex items-center gap-1 p-1 rounded-md bg-surface-50 border border-surface-200">
              {(["ALL", "HUMAN", "SUSPICIOUS", "AI-GENERATED"] as const).map(
                (f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`px-3 py-1.5 rounded text-[11.5px] font-semibold uppercase tracking-wide transition-all ${
                      activeFilter === f
                        ? "bg-white text-text-primary shadow-sm"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    {f === "AI-GENERATED" ? "AI" : f}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-200">
                  {["Document", "Date", "Words", "Result"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-[12px] font-medium text-text-secondary"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filtered.map((s) => {
                  const st = getStatusClasses(s.status);
                  return (
                    <tr
                      key={s.id}
                      className="group hover:bg-surface-50 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-[14px] font-medium text-text-primary leading-tight mb-0.5 group-hover:text-brand transition-colors">
                              {s.title}
                            </p>
                            <p className="text-[12px] text-text-secondary">
                              {s.duration} • {s.wpm} WPM
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[13px] text-text-secondary">
                        {s.date}
                      </td>
                      <td className="px-5 py-4 text-[13px] text-text-primary">
                        {s.words.toLocaleString()}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase ${st.bg} ${st.text}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${st.dot}`}
                          />
                          {s.status === "AI-GENERATED" ? "AI" : s.status} (
                          {s.score}%)
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Activity & Usage */}
        <div className="flex flex-col gap-6">
          {/* Usage Box */}
          <div className="bg-white border border-surface-200 rounded-lg shadow-card p-5">
            <h3 className="text-[14px] font-semibold text-text-primary mb-4">
              Plan Usage
            </h3>
            <div className="flex justify-between items-center mb-2">
              <span className="text-[13px] text-text-secondary">
                Free Sessions
              </span>
              <span className="text-[13px] font-medium text-text-primary">
                4 / 10
              </span>
            </div>
            <div className="h-2 w-full bg-surface-100 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-text-primary rounded-full"
                style={{ width: "40%" }}
              />
            </div>
            <button className="w-full py-2 rounded-md border border-surface-200 text-[13px] font-medium text-text-primary hover:bg-surface-50 transition-colors">
              Upgrade to Pro
            </button>
          </div>

          {/* Activity Feed */}
          <div className="bg-white border border-surface-200 rounded-lg shadow-card p-5">
            <h3 className="text-[14px] font-semibold text-text-primary mb-4">
              Recent Activity
            </h3>
            <div className="flex flex-col">
              <ActivityItem
                title="Session completed successfully"
                time="2h"
                type="session"
              />
              <ActivityItem
                title="Certificate generated"
                time="2h"
                type="cert"
              />
              <ActivityItem
                title="Account verified via OTP"
                time="1d"
                type="login"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
