import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { Tabs } from "../components/ui/Tabs";
import { ErrorState } from "../components/ui/AsyncState";
import { ROUTES } from "../constants/routes";
import { api, getApiErrorMessage } from "../lib/api";
import { useToast } from "../components/ui/ToastProvider";
import { brand, colors } from "../styles/colors";
import { API_ROUTES } from "../constants/apiRoutes";

interface SessionItem {
  id: number;
  title: string;
  classification: string;
  classification_bucket: string;
  confidence: number;
  risk_level: string;
  review_status: string;
  wpm: number;
  duration_seconds: number;
  word_count: number;
  certificate_id?: string | null;
  course_name?: string | null;
  course_code?: string | null;
  created_at: string;
}

interface SessionsResponse {
  status: string;
  total: number;
  sessions: SessionItem[];
}

const PAGE_SIZE = 20;

const filters = [
  { value: "ALL", label: "All" },
  { value: "HUMAN", label: "Human" },
  { value: "SUSPICIOUS", label: "Review" },
  { value: "SYNTHETIC", label: "High Risk" },
];

function Icon({ type, size = 16 }: { type: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    list: (
      <>
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M3 6h.01" />
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    award: (
      <>
        <circle cx="12" cy="8" r="5" />
        <path d="M8.5 12.5 7 22l5-3 5 3-1.5-9.5" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
    close: (
      <>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </>
    ),
    chevron: <path d="m6 9 6 6 6-6" />,
    replay: (
      <>
        <path d="M2 12a10 10 0 1 0 3-7.07" />
        <path d="M2 4v6h6" />
      </>
    ),
    external: (
      <>
        <path d="M15 3h6v6" />
        <path d="M10 14 21 3" />
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      </>
    ),
    empty: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M9 15h6" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[type] ?? null}
    </svg>
  );
}

function getBucket(session: SessionItem): string {
  return String(
    session.classification_bucket || session.classification || "UNKNOWN",
  ).toUpperCase();
}

function isHighRisk(value: string): boolean {
  return ["SYNTHETIC", "AI", "AI-GENERATED", "HIGH_RISK", "HIGH RISK"].includes(
    String(value || "").toUpperCase(),
  );
}

function filterCount(sessions: SessionItem[], filter: string) {
  if (filter === "ALL") return sessions.length;

  return sessions.filter((session) => {
    const bucket = getBucket(session);

    if (filter === "SYNTHETIC") return isHighRisk(bucket);

    return bucket === filter;
  }).length;
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${minutes}m ${rest}s`;
}

function normalizePercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function cardShadow() {
  return `0 1px 3px ${colors.shadow}`;
}

function statusStyle(value?: string) {
  const normalized = String(value || "UNKNOWN").toUpperCase();

  if (
    normalized === "HUMAN" ||
    normalized === "APPROVED" ||
    normalized === "LOW"
  ) {
    return {
      background: colors.mintTint,
      color: brand.humanText,
      borderColor: colors.mintTint,
      label: normalized === "LOW" ? "Low" : normalized,
    };
  }

  if (
    normalized === "SUSPICIOUS" ||
    normalized === "PENDING" ||
    normalized === "MEDIUM"
  ) {
    return {
      background: colors.amberTint,
      color: brand.suspiciousText,
      borderColor: colors.amberTint,
      label: normalized === "SUSPICIOUS" ? "Review" : normalized,
    };
  }

  if (
    isHighRisk(normalized) ||
    normalized === "FLAGGED" ||
    normalized === "HIGH"
  ) {
    return {
      background: colors.roseTint,
      color: brand.aiText,
      borderColor: colors.roseTint,
      label: isHighRisk(normalized) ? "High Risk" : normalized,
    };
  }

  return {
    background: colors.surface[100],
    color: colors.text.secondary,
    borderColor: colors.surface[200],
    label: normalized,
  };
}

function StatusBadge({ value }: { value?: string }) {
  const style = statusStyle(value);

  return (
    <span
      className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{
        background: style.background,
        borderColor: style.borderColor,
        color: style.color,
      }}
    >
      {String(style.label || "UNKNOWN").replaceAll("_", " ")}
    </span>
  );
}

function EmptyTable({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-md"
        style={{ background: colors.brandSoft, color: colors.brand }}
      >
        <Icon type="empty" size={28} />
      </div>
      <p
        className="mt-4 text-[15px] font-semibold"
        style={{ color: colors.text.primary }}
      >
        {title}
      </p>
      <p
        className="mt-1 max-w-md text-[13px]"
        style={{ color: colors.text.secondary }}
      >
        {subtitle}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function MetricTile({
  label,
  value,
  trend,
  icon,
}: {
  label: string;
  value: string | number;
  trend: string;
  icon: string;
}) {
  return (
    <div
      className="rounded-md border bg-white p-4"
      style={{ borderColor: colors.surface[200], boxShadow: cardShadow() }}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className="text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{ color: colors.text.muted }}
        >
          {label}
        </p>
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{ background: colors.brandSoft, color: colors.brand }}
        >
          <Icon type={icon} size={16} />
        </div>
      </div>
      <p
        className="mt-3 text-[24px] font-bold tracking-[-0.04em] tabular-nums"
        style={{ color: colors.text.primary }}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px]" style={{ color: colors.text.secondary }}>
        {trend}
      </p>
    </div>
  );
}

function InlineLoader() {
  return (
    <div className="space-y-5">
      <div
        className="fixed left-0 top-0 z-50 h-0.5 w-full animate-pulse"
        style={{ background: colors.brand }}
      />
      <div className="flex items-end justify-between gap-4">
        <div>
          <div
            className="h-7 w-56 animate-pulse rounded-md"
            style={{ background: colors.surface[200] }}
          />
          <div
            className="mt-2 h-4 w-80 animate-pulse rounded-md"
            style={{ background: colors.surface[200] }}
          />
        </div>
        <div
          className="h-9 w-28 animate-pulse rounded-md"
          style={{ background: colors.surface[200] }}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-md border bg-white"
            style={{ borderColor: colors.surface[200] }}
          />
        ))}
      </div>
      <div
        className="h-[420px] animate-pulse rounded-md border bg-white"
        style={{ borderColor: colors.surface[200] }}
      />
    </div>
  );
}

export default function SessionsPage() {
  const { showToast } = useToast();

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedFilter, setSelectedFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const bucket = getBucket(session);
      const matchesFilter =
        selectedFilter === "ALL" ||
        (selectedFilter === "SYNTHETIC"
          ? isHighRisk(bucket)
          : bucket === selectedFilter);

      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        String(session.title || "")
          .toLowerCase()
          .includes(query) ||
        String(session.course_name || "")
          .toLowerCase()
          .includes(query) ||
        String(session.course_code || "")
          .toLowerCase()
          .includes(query) ||
        String(session.certificate_id || "")
          .toLowerCase()
          .includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [sessions, selectedFilter, search]);

  const stats = useMemo(() => {
    const total = sessions.length;
    const human = sessions.filter(
      (session) => getBucket(session) === "HUMAN",
    ).length;
    const avgConfidence = total
      ? Math.round(
          sessions.reduce(
            (sum, session) => sum + Number(session.confidence || 0),
            0,
          ) / total,
        )
      : 0;
    const certificates = sessions.filter((session) =>
      Boolean(session.certificate_id),
    ).length;
    const humanRate = total ? Math.round((human / total) * 100) : 0;

    return {
      total,
      humanRate,
      avgConfidence,
      certificates,
    };
  }, [sessions]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSessions.length / PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages - 1);
  const paginatedSessions = filteredSessions.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  useEffect(() => {
    setPage(0);
  }, [selectedFilter, search]);

  useEffect(() => {
    let mounted = true;

    async function loadSessions() {
      setIsLoading(true);
      setApiError(null);

      try {
        const response = await api.get<SessionsResponse>(
          API_ROUTES.student.sessions,
          {
            params: {
              limit: 100,
            },
          },
        );

        if (!mounted) return;
        setSessions(response.data.sessions || []);
      } catch (error) {
        if (!mounted) return;
        const message = getApiErrorMessage(error);
        setApiError(message);
        showToast({
          type: "error",
          title: "Sessions failed to load",
          message,
        });
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadSessions();

    return () => {
      mounted = false;
    };
  }, [showToast]);

  const tabItems = filters.map((filter) => ({
    ...filter,
    count: filterCount(sessions, filter.value),
  }));

  if (isLoading) return <InlineLoader />;

  if (apiError) {
    return (
      <ErrorState
        title="Could not load sessions"
        message={apiError}
        action={
          <Button type="button" onClick={() => window.location.reload()}>
            Retry
          </Button>
        }
      />
    );
  }

  const showingStart = filteredSessions.length ? safePage * PAGE_SIZE + 1 : 0;
  const showingEnd = Math.min(
    (safePage + 1) * PAGE_SIZE,
    filteredSessions.length,
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-0">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1
            className="text-[22px] font-bold tracking-[-0.03em]"
            style={{ color: colors.text.primary }}
          >
            Writing Sessions
          </h1>
          <p
            className="mt-0.5 text-[13px]"
            style={{ color: colors.text.secondary }}
          >
            Your complete authorship evidence library.
          </p>
        </div>

        <Link
          to={ROUTES.EDITOR_NEW}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-[13px] font-semibold"
          style={{ background: colors.brand, color: colors.text.light }}
        >
          <Icon type="plus" size={15} />
          New Session
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Total Sessions"
          value={stats.total}
          trend="All captured sessions"
          icon="list"
        />
        <MetricTile
          label="Human Rate"
          value={`${stats.humanRate}%`}
          trend="Human-classified sessions"
          icon="shield"
        />
        <MetricTile
          label="Avg Confidence"
          value={`${stats.avgConfidence}%`}
          trend="Across all evidence"
          icon="award"
        />
        <MetricTile
          label="Certificates Issued"
          value={stats.certificates}
          trend="Verifiable records"
          icon="clock"
        />
      </div>

      <div
        className="rounded-md border bg-white p-3"
        style={{ borderColor: colors.surface[200], boxShadow: cardShadow() }}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            items={tabItems}
            value={selectedFilter}
            onChange={setSelectedFilter}
          />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <div
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: colors.text.muted }}
              >
                <Icon type="search" size={14} />
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search sessions..."
                className="h-9 w-full rounded-md border py-0 pl-9 pr-9 text-[13px] outline-none sm:w-64"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                  background: colors.surface[50],
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md"
                  style={{ color: colors.text.secondary }}
                  aria-label="Clear search"
                >
                  <Icon type="close" size={13} />
                </button>
              )}
            </div>

            <button
              type="button"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-[12px] font-semibold"
              style={{
                background: "transparent",
                color: colors.text.secondary,
              }}
            >
              Sort by
              <Icon type="chevron" size={13} />
            </button>
          </div>
        </div>

        <p className="mt-3 text-[12px]" style={{ color: colors.text.muted }}>
          Showing {filteredSessions.length} of {sessions.length} sessions
        </p>
      </div>

      <div
        className="overflow-hidden rounded-md border bg-white"
        style={{ borderColor: colors.surface[200], boxShadow: cardShadow() }}
      >
        {!sessions.length ? (
          <EmptyTable
            title="No sessions yet"
            subtitle="Start a writing session to capture keystrokes, pauses, edits, and a replayable authorship trail."
            action={
              <Link
                to={ROUTES.EDITOR_NEW}
                className="inline-flex h-9 items-center justify-center rounded-md px-4 text-[13px] font-semibold"
                style={{ background: colors.brand, color: colors.text.light }}
              >
                Start first session
              </Link>
            }
          />
        ) : !filteredSessions.length ? (
          <EmptyTable
            title="No sessions match your filters"
            subtitle="Try changing the classification filter or clearing the search query."
            action={
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSelectedFilter("ALL");
                }}
                className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-[13px] font-semibold"
                style={{
                  background: colors.surface[50],
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              >
                Reset filters
              </button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[1060px]">
                <div
                  className="grid grid-cols-[40px_minmax(240px,1fr)_120px_120px_100px_80px_90px_100px_100px] items-center gap-4 border-b px-5 py-3"
                  style={{
                    background: colors.surface[100],
                    borderColor: colors.surface[200],
                  }}
                >
                  {[
                    "#",
                    "Document",
                    "Course",
                    "Classification",
                    "Confidence",
                    "WPM",
                    "Duration",
                    "Review",
                    "Actions",
                  ].map((heading) => (
                    <div
                      key={heading}
                      className="text-[10px] font-bold uppercase tracking-[0.14em]"
                      style={{ color: colors.text.muted }}
                    >
                      {heading}
                    </div>
                  ))}
                </div>

                {paginatedSessions.map((session, index) => {
                  const bucket = getBucket(session);
                  const confidence = normalizePercent(session.confidence);

                  return (
                    <div
                      key={session.id}
                      className="grid h-[52px] grid-cols-[40px_minmax(240px,1fr)_120px_120px_100px_80px_90px_100px_100px] items-center gap-4 border-b px-5 transition-colors duration-100 hover:bg-surface-100"
                      style={{ borderColor: colors.surface[200] }}
                    >
                      <div
                        className="text-[12px] tabular-nums"
                        style={{ color: colors.text.muted }}
                      >
                        {safePage * PAGE_SIZE + index + 1}
                      </div>

                      <div className="min-w-0">
                        <p
                          className="truncate text-[13px] font-semibold"
                          style={{ color: colors.text.primary }}
                        >
                          {session.title || "Untitled Document"}
                        </p>
                        <p
                          className="mt-0.5 truncate text-[11px]"
                          style={{ color: colors.text.muted }}
                        >
                          {session.created_at}
                        </p>
                      </div>

                      <div
                        className="truncate text-[12px]"
                        style={{ color: colors.text.secondary }}
                      >
                        {session.course_code || "Personal"}
                      </div>

                      <StatusBadge value={bucket} />

                      <div>
                        <p
                          className="font-mono text-[13px] font-bold tabular-nums"
                          style={{ color: colors.text.primary }}
                        >
                          {confidence}%
                        </p>
                        <div
                          className="mt-1 h-1 rounded-md"
                          style={{ background: colors.surface[200] }}
                        >
                          <div
                            className="h-1 rounded-md"
                            style={{
                              background: colors.brand,
                              width: `${confidence}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div
                        className="text-[13px] font-medium tabular-nums"
                        style={{ color: colors.text.primary }}
                      >
                        {Math.round(Number(session.wpm) || 0)}
                      </div>

                      <div
                        className="text-[12px]"
                        style={{ color: colors.text.secondary }}
                      >
                        {formatDuration(session.duration_seconds)}
                      </div>

                      <StatusBadge value={session.review_status || "PENDING"} />

                      <div className="flex items-center gap-1.5">
                        <Link
                          to={ROUTES.REPLAY.replace(
                            ":sessionId",
                            String(session.id),
                          )}
                          className="inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-[11px] font-semibold"
                          style={{
                            borderColor: colors.surface[200],
                            color: colors.text.secondary,
                            background: colors.surface[50],
                          }}
                        >
                          Replay
                        </Link>

                        {session.certificate_id && (
                          <Link
                            to={`/verify/${session.certificate_id}`}
                            className="inline-flex h-7 items-center justify-center rounded-md border px-2.5 text-[11px] font-semibold"
                            style={{
                              borderColor: colors.surface[200],
                              color: colors.text.secondary,
                              background: colors.surface[50],
                            }}
                          >
                            Verify
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {filteredSessions.length > PAGE_SIZE && (
              <div
                className="flex items-center justify-between border-t px-5 py-3"
                style={{ borderColor: colors.surface[200] }}
              >
                <p className="text-[12px]" style={{ color: colors.text.muted }}>
                  Showing {showingStart}–{showingEnd} of{" "}
                  {filteredSessions.length}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safePage === 0}
                    onClick={() =>
                      setPage((current) => Math.max(0, current - 1))
                    }
                    className="h-8 rounded-md border px-3 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      borderColor: colors.surface[200],
                      background: colors.surface[50],
                      color: colors.text.primary,
                    }}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={safePage >= totalPages - 1}
                    onClick={() =>
                      setPage((current) =>
                        Math.min(totalPages - 1, current + 1),
                      )
                    }
                    className="h-8 rounded-md border px-3 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      borderColor: colors.surface[200],
                      background: colors.surface[50],
                      color: colors.text.primary,
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
