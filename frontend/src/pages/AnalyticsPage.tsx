import { useState } from "react";
import { colors, brand } from "../styles/colors";

// ─── mock data for charts cos i cant afford a real bi metrics db yet ──────────
const activityData = [
  { day: "01", sessions: 4, score: 92 },
  { day: "02", sessions: 2, score: 95 },
  { day: "03", sessions: 5, score: 88 },
  { day: "04", sessions: 7, score: 96 },
  { day: "05", sessions: 1, score: 99 },
  { day: "06", sessions: 3, score: 85 },
  { day: "07", sessions: 8, score: 94 },
  { day: "08", sessions: 6, score: 91 },
  { day: "09", sessions: 2, score: 97 },
  { day: "10", sessions: 9, score: 62 }, // the day i tested the ai paste script lol
  { day: "11", sessions: 4, score: 96 },
  { day: "12", sessions: 5, score: 93 },
  { day: "13", sessions: 3, score: 98 },
  { day: "14", sessions: 6, score: 95 },
];

const featureImportance = [
  { label: "Flight Time (IKI) Variance", value: 38 },
  { label: "Paste Event Detection", value: 26 },
  { label: "Pause Frequency (>1000ms)", value: 18 },
  { label: "Mean Dwell Time", value: 12 },
  { label: "Deletion Ratio", value: 6 },
];

// ─── icons ────────────────────────────────────────────────────────────────────
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

function CalendarIcon() {
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
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

// ─── components ───────────────────────────────────────────────────────────────
function MetricCard({
  title,
  value,
  change,
  trend,
}: {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
}) {
  const trendColor =
    trend === "up"
      ? brand.humanAccent
      : trend === "down"
        ? brand.aiAccent
        : colors.text.secondary;

  return (
    <div
      className="bg-white border rounded-md p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow"
      style={{ borderColor: colors.surface[200] }}
    >
      <span
        className="text-[13px] font-medium"
        style={{ color: colors.text.secondary }}
      >
        {title}
      </span>
      <div className="flex items-end justify-between">
        <span
          className="text-[28px] font-semibold leading-none tracking-tight"
          style={{ color: colors.text.primary }}
        >
          {value}
        </span>
        <div
          className="flex items-center gap-1 text-[12px] font-medium"
          style={{ color: trendColor }}
        >
          {trend === "up" ? (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          ) : trend === "down" ? (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          ) : (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
          {change}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("14d");

  // math for the pure css charts
  const maxSessions = Math.max(...activityData.map((d) => d.sessions));

  return (
    <div className="p-6 md:p-10 max-w-[1200px] mx-auto w-full flex flex-col gap-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-semibold tracking-tight mb-1"
            style={{ color: colors.text.primary }}
          >
            Analytics
          </h1>
          <p className="text-[14px]" style={{ color: colors.text.secondary }}>
            Biometric telemetry and machine learning classification metrics.
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center border rounded-md shadow-sm bg-white overflow-hidden"
            style={{ borderColor: colors.surface[200] }}
          >
            <div
              className="pl-3 pr-2 py-1.5 border-r flex items-center"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.secondary,
              }}
            >
              <CalendarIcon />
            </div>
            <select
              className="bg-transparent text-[13px] font-medium outline-none px-3 py-1.5 appearance-none cursor-pointer"
              style={{ color: colors.text.primary }}
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <option value="7d">Last 7 Days</option>
              <option value="14d">Last 14 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>

          <button
            className="flex items-center justify-center h-9 w-9 border rounded-md shadow-sm bg-white hover:bg-surface-50 transition-colors"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.secondary,
            }}
            title="Export CSV"
          >
            <DownloadIcon />
          </button>
        </div>
      </div>

      {/* ── Top Metrics Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Sessions" value="65" change="12%" trend="up" />
        <MetricCard
          title="Avg. Verification Score"
          value="94.2%"
          change="2.1%"
          trend="up"
        />
        <MetricCard
          title="AI Anomalies Blocked"
          value="3"
          change="1"
          trend="down"
        />
        <MetricCard
          title="Average WPM"
          value="62"
          change="0%"
          trend="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-start">
        {/* ── Main Activity Chart ── */}
        <div
          className="bg-white border rounded-md shadow-sm p-6 flex flex-col"
          style={{ borderColor: colors.surface[200] }}
        >
          <div className="flex items-center justify-between mb-8">
            <h3
              className="text-[14px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              Session Activity
            </h3>
            <span
              className="text-[12px] font-medium px-2 py-1 rounded-md bg-surface-50 border"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.secondary,
              }}
            >
              Sessions per day
            </span>
          </div>

          {/* Pure CSS Bar Chart (Vercel Style) */}
          <div className="h-[240px] flex items-end justify-between gap-2 md:gap-4 mt-auto relative">
            {/* Background grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-full border-t"
                  style={{ borderColor: colors.surface[100] }}
                />
              ))}
            </div>

            {activityData.map((data, i) => {
              const heightPct = (data.sessions / maxSessions) * 100;
              // if score dropped below 70, flag it red, otherwise black
              const isAnomaly = data.score < 70;

              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-3 relative group z-10"
                >
                  {/* Tooltip on hover */}
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[11px] py-1 px-2 rounded-md whitespace-nowrap pointer-events-none z-20">
                    {data.sessions} sessions ({data.score}% avg)
                  </div>

                  {/* The Bar */}
                  <div
                    className="w-full rounded-t-md transition-all duration-500 ease-out group-hover:opacity-80"
                    style={{
                      height: `${heightPct}%`,
                      minHeight: "4px",
                      backgroundColor: isAnomaly
                        ? brand.aiAccent
                        : colors.text.primary,
                    }}
                  />
                  {/* X Axis Label */}
                  <span
                    className="text-[11px] font-mono"
                    style={{ color: colors.text.secondary }}
                  >
                    {data.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Feature Importance Radar/List ── */}
        {/* building a custom CSS progress bar list to explain to the prof how the ML model works */}
        <div
          className="bg-white border rounded-md shadow-sm p-6 flex flex-col gap-6"
          style={{ borderColor: colors.surface[200] }}
        >
          <div>
            <h3
              className="text-[14px] font-semibold mb-1"
              style={{ color: colors.text.primary }}
            >
              Random Forest Features
            </h3>
            <p className="text-[12px]" style={{ color: colors.text.secondary }}>
              Weighting of biometric parameters used for classification.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {featureImportance.map((feat, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[12px]">
                  <span
                    className="font-medium"
                    style={{ color: colors.text.primary }}
                  >
                    {feat.label}
                  </span>
                  <span
                    className="font-mono font-semibold"
                    style={{ color: colors.text.secondary }}
                  >
                    {feat.value}%
                  </span>
                </div>
                <div
                  className="h-1.5 w-full rounded-full overflow-hidden"
                  style={{ backgroundColor: colors.surface[100] }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${feat.value}%`,
                      backgroundColor:
                        i === 0 ? brand.humanAccent : colors.text.primary,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Section: Anomaly Log ── */}
      <div
        className="bg-white border rounded-md shadow-sm overflow-hidden"
        style={{ borderColor: colors.surface[200] }}
      >
        <div
          className="px-6 py-4 border-b"
          style={{
            borderColor: colors.surface[200],
            backgroundColor: colors.surface[50],
          }}
        >
          <h3
            className="text-[14px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Recent Anomalies Detected
          </h3>
        </div>

        <div
          className="flex flex-col divide-y"
          style={{ borderColor: colors.surface[200] }}
        >
          {/* Mock anomaly rows */}
          {[
            {
              id: "1",
              file: "CopyPaste_Test.txt",
              trigger: "Paste Event > 500 chars",
              conf: "12.4%",
              date: "Day 10",
            },
            {
              id: "2",
              file: "Distributed Systems Notes",
              trigger: "Erratic IKI Variance",
              conf: "67.2%",
              date: "Day 06",
            },
          ].map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[1fr_2fr_100px_80px] gap-4 px-6 py-3.5 items-center hover:bg-surface-50 transition-colors"
            >
              <span
                className="text-[13px] font-medium truncate"
                style={{ color: colors.text.primary }}
              >
                {row.file}
              </span>
              <div className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: brand.aiAccent }}
                />
                <span
                  className="text-[12px]"
                  style={{ color: colors.text.secondary }}
                >
                  {row.trigger}
                </span>
              </div>
              <span
                className="text-[12px] font-bold font-mono"
                style={{ color: brand.aiAccent }}
              >
                {row.conf}
              </span>
              <span
                className="text-[12px] text-right"
                style={{ color: colors.text.secondary }}
              >
                {row.date}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
