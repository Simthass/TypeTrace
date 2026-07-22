import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { ErrorState } from "../components/ui/AsyncState";
import { ROUTES } from "../constants/routes";
import { api, getApiErrorMessage } from "../lib/api";
import { useToast } from "../components/ui/ToastContext";
import { brand, colors } from "../styles/colors";
import { API_ROUTES } from "../constants/apiRoutes";
import {
  formatEvidenceScore,
  normalizeEvidenceScore,
} from "../lib/evidenceScore";

interface SessionItem {
  id: number;
  title: string;
  classification: string;
  classification_bucket: string;
  confidence: number;
  risk_level: string;
  review_status: string;
  review_outcome?: string;
  review_notes?: string;
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

type ClassificationFilter = "ALL" | "HUMAN" | "SUSPICIOUS" | "SYNTHETIC";
type ReviewFilter =
  | "ALL"
  | "PENDING"
  | "APPROVED"
  | "FLAGGED"
  | "NEEDS_DISCUSSION"
  | "NOT_APPLICABLE";
type SortValue =
  | "newest"
  | "oldest"
  | "confidence-desc"
  | "confidence-asc"
  | "wpm-desc"
  | "duration-desc";

const PAGE_SIZE = 16;

const classificationFilters: Array<{
  value: ClassificationFilter;
  label: string;
}> = [
  { value: "ALL", label: "All evidence" },
  { value: "HUMAN", label: "Human" },
  { value: "SUSPICIOUS", label: "Needs review" },
  { value: "SYNTHETIC", label: "High risk" },
];

const reviewFilters: Array<{ value: ReviewFilter; label: string }> = [
  { value: "ALL", label: "All review states" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "NEEDS_DISCUSSION", label: "Needs discussion" },
  { value: "FLAGGED", label: "Flagged" },
  { value: "NOT_APPLICABLE", label: "Personal" },
];

const sortOptions: Array<{ value: SortValue; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "confidence-desc", label: "Human score high to low" },
  { value: "confidence-asc", label: "Human score low to high" },
  { value: "wpm-desc", label: "Typing speed high to low" },
  { value: "duration-desc", label: "Longest sessions" },
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
    certificate: (
      <>
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v6h6" />
        <path d="m9 15 2 2 4-5" />
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
    rows: (
      <>
        <rect x="3" y="4" width="18" height="4" rx="1" />
        <rect x="3" y="10" width="18" height="4" rx="1" />
        <rect x="3" y="16" width="18" height="4" rx="1" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    filter: (
      <>
        <path d="M4 5h16" />
        <path d="M7 12h10" />
        <path d="M10 19h4" />
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

function cardShadow() {
  return `0 1px 3px ${colors.shadow}`;
}

function panelStyle() {
  return {
    background: colors.surface[50],
    borderColor: colors.surface[200],
    boxShadow: cardShadow(),
  };
}

function pct(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function safeAverage(values: number[]): number {
  if (!values.length) return 0;
  return (
    values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length
  );
}

function parseTime(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatShortDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || "Unknown";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCompactDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.round(safe / 60);
  if (minutes >= 60) return `${Math.round(minutes / 60)}h`;
  return `${minutes}m`;
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

function normalizeClassification(
  value: string,
): ClassificationFilter | "UNKNOWN" {
  const bucket = String(value || "UNKNOWN").toUpperCase();
  if (bucket === "HUMAN") return "HUMAN";
  if (bucket === "SUSPICIOUS") return "SUSPICIOUS";
  if (isHighRisk(bucket)) return "SYNTHETIC";
  return "UNKNOWN";
}

function progressBarColor(session: SessionItem): string {
  const bucket = normalizeClassification(getBucket(session));
  if (bucket === "HUMAN") return colors.green;
  if (bucket === "SUSPICIOUS") return colors.amber;
  if (bucket === "SYNTHETIC") return colors.red;
  return colors.brand;
}

function normalizeReviewStatus(value?: string): ReviewFilter | "UNKNOWN" {
  const normalized = String(value || "PENDING").toUpperCase();
  if (normalized === "APPROVED") return "APPROVED";
  if (normalized === "FLAGGED") return "FLAGGED";
  if (normalized === "NEEDS_DISCUSSION") return "NEEDS_DISCUSSION";
  if (normalized === "NOT_APPLICABLE") return "NOT_APPLICABLE";
  if (normalized === "PENDING" || normalized === "REVIEW_REQUIRED") {
    return "PENDING";
  }
  return "UNKNOWN";
}

function filterCount(sessions: SessionItem[], filter: ClassificationFilter) {
  if (filter === "ALL") return sessions.length;
  return sessions.filter(
    (session) => normalizeClassification(getBucket(session)) === filter,
  ).length;
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
    normalized === "MEDIUM" ||
    normalized === "NEEDS_DISCUSSION" ||
    normalized === "REVIEW_REQUIRED"
  ) {
    return {
      background: colors.amberTint,
      color: brand.suspiciousText,
      borderColor: colors.amberTint,
      label: normalized === "SUSPICIOUS" ? "Needs review" : normalized,
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
      label: isHighRisk(normalized) ? "High risk" : normalized,
    };
  }

  if (normalized === "NOT_APPLICABLE") {
    return {
      background: colors.surface[100],
      color: colors.text.secondary,
      borderColor: colors.surface[200],
      label: "Personal",
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

function MetricCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: string;
}) {
  return (
    <section className="rounded-md border p-4" style={panelStyle()}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[12px] font-semibold"
            style={{ color: colors.text.secondary }}
          >
            {label}
          </p>
          <p
            className="mt-4 text-[30px] font-bold leading-none tracking-[-0.05em] tabular-nums"
            style={{ color: colors.text.primary }}
          >
            {value}
          </p>
        </div>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
          style={{
            background: colors.surface[100],
            borderColor: colors.surface[200],
            color: colors.text.secondary,
          }}
        >
          <Icon type={icon} size={16} />
        </div>
      </div>
      <p
        className="mt-3 text-[12px] leading-5"
        style={{ color: colors.text.muted }}
      >
        {helper}
      </p>
    </section>
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
        <Icon type="empty" size={24} />
      </div>
      <p
        className="mt-4 text-[15px] font-semibold"
        style={{ color: colors.text.primary }}
      >
        {title}
      </p>
      <p
        className="mt-1 max-w-md text-[13px] leading-6"
        style={{ color: colors.text.secondary }}
      >
        {subtitle}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function InlineLoader() {
  return (
    <div className="space-y-4">
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
            className="h-28 animate-pulse rounded-md border"
            style={{
              background: colors.surface[50],
              borderColor: colors.surface[200],
            }}
          />
        ))}
      </div>
      <div
        className="h-[520px] animate-pulse rounded-md border"
        style={{
          background: colors.surface[50],
          borderColor: colors.surface[200],
        }}
      />
    </div>
  );
}

export default function SessionsPage() {
  const { showToast } = useToast();

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedFilter, setSelectedFilter] =
    useState<ClassificationFilter>("ALL");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortValue>("newest");
  const [search, setSearch] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);

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

  const stats = useMemo(() => {
    const total = sessions.length;
    const human = sessions.filter(
      (session) => normalizeClassification(getBucket(session)) === "HUMAN",
    ).length;
    const needsReview = sessions.filter(
      (session) => normalizeClassification(getBucket(session)) === "SUSPICIOUS",
    ).length;
    const highRisk = sessions.filter(
      (session) => normalizeClassification(getBucket(session)) === "SYNTHETIC",
    ).length;
    const certificates = sessions.filter((session) =>
      Boolean(session.certificate_id),
    ).length;
    const pending = sessions.filter(
      (session) => normalizeReviewStatus(session.review_status) === "PENDING",
    ).length;
    const approved = sessions.filter(
      (session) => normalizeReviewStatus(session.review_status) === "APPROVED",
    ).length;
    const flagged = sessions.filter(
      (session) => normalizeReviewStatus(session.review_status) === "FLAGGED",
    ).length;
    const courseCount = new Set(
      sessions
        .map((session) => session.course_code || session.course_name)
        .filter(Boolean),
    ).size;
    const avgConfidence = total
      ? Math.round(
          sessions.reduce(
            (sum, session) => sum + Number(session.confidence || 0),
            0,
          ) / total,
        )
      : 0;

    return {
      total,
      human,
      needsReview,
      highRisk,
      humanRate: pct(human, total),
      avgConfidence,
      certificates,
      certificateRate: pct(certificates, total),
      avgWpm: Math.round(
        safeAverage(sessions.map((session) => Number(session.wpm || 0))),
      ),
      totalSeconds: sessions.reduce(
        (sum, session) => sum + Number(session.duration_seconds || 0),
        0,
      ),
      pending,
      approved,
      flagged,
      courseCount,
      personalCount: sessions.filter(
        (session) => !session.course_code && !session.course_name,
      ).length,
    };
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return sessions
      .filter((session) => {
        const bucket = normalizeClassification(getBucket(session));
        const status = normalizeReviewStatus(session.review_status);

        const matchesClassification =
          selectedFilter === "ALL" || bucket === selectedFilter;
        const matchesReview = reviewFilter === "ALL" || status === reviewFilter;
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

        return matchesClassification && matchesReview && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === "oldest") {
          return parseTime(a.created_at) - parseTime(b.created_at);
        }
        if (sortBy === "confidence-desc") {
          return Number(b.confidence || 0) - Number(a.confidence || 0);
        }
        if (sortBy === "confidence-asc") {
          return Number(a.confidence || 0) - Number(b.confidence || 0);
        }
        if (sortBy === "wpm-desc") {
          return Number(b.wpm || 0) - Number(a.wpm || 0);
        }
        if (sortBy === "duration-desc") {
          return (
            Number(b.duration_seconds || 0) - Number(a.duration_seconds || 0)
          );
        }

        return parseTime(b.created_at) - parseTime(a.created_at);
      });
  }, [reviewFilter, search, selectedFilter, sessions, sortBy]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSessions.length / PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages - 1);
  const paginatedSessions = filteredSessions.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  const tabItems = classificationFilters.map((filter) => ({
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
    <div className="mx-auto max-w-[1440px] space-y-4 px-0 pb-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: colors.text.muted }}
          >
            Evidence ledger
          </p>
          <h1
            className="mt-1 text-[24px] font-bold tracking-[-0.04em]"
            style={{ color: colors.text.primary }}
          >
            Writing Sessions
          </h1>
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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Captured sessions"
          value={stats.total}
          helper="Every writing session saved in your evidence library"
          icon="list"
        />
        <MetricCard
          label="Human-classified"
          value={`${stats.humanRate}%`}
          helper={`${stats.human} of ${stats.total} sessions classified as human`}
          icon="shield"
        />
        <MetricCard
          label="Average human score"
          value={`${stats.avgConfidence}%`}
          helper="Mean human-writing evidence score across captured sessions"
          icon="award"
        />
        <MetricCard
          label="Certificates issued"
          value={stats.certificates}
          helper={`${stats.certificateRate}% of sessions have a verifiable certificate`}
          icon="certificate"
        />
      </div>

      <section className="rounded-md border" style={panelStyle()}>
        <div
          className="border-b p-4"
          style={{ borderColor: colors.surface[200] }}
        >
          <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {tabItems.map((item) => {
                const active = selectedFilter === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setSelectedFilter(item.value);
                      setPage(0);
                    }}
                    className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[12px] font-semibold transition"
                    style={{
                      background: active
                        ? colors.text.primary
                        : colors.surface[50],
                      borderColor: active
                        ? colors.text.primary
                        : colors.surface[200],
                      color: active ? colors.text.light : colors.text.secondary,
                    }}
                  >
                    {item.label}
                    <span
                      className="rounded-md px-1.5 py-0.5 font-mono text-[10px]"
                      style={{
                        background: active ? colors.brand : colors.surface[100],
                        color: active ? colors.text.light : colors.text.muted,
                      }}
                    >
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>

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
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(0);
                  }}
                  placeholder="Search title, course, certificate"
                  className="h-9 w-full rounded-md border py-0 pl-9 pr-9 text-[13px] outline-none sm:w-72"
                  style={{
                    borderColor: colors.surface[200],
                    color: colors.text.primary,
                    background: colors.surface[50],
                  }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setPage(0);
                    }}
                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md"
                    style={{ color: colors.text.secondary }}
                    aria-label="Clear search"
                  >
                    <Icon type="close" size={13} />
                  </button>
                )}
              </div>

              <div className="relative">
                <select
                  value={reviewFilter}
                  onChange={(event) => {
                    setReviewFilter(event.target.value as ReviewFilter);
                    setPage(0);
                  }}
                  className="h-9 appearance-none rounded-md border py-0 pl-3 pr-8 text-[12px] font-semibold outline-none"
                  style={{
                    background: colors.surface[50],
                    borderColor: colors.surface[200],
                    color: colors.text.secondary,
                  }}
                >
                  {reviewFilters.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <span
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
                  style={{ color: colors.text.muted }}
                >
                  <Icon type="chevron" size={13} />
                </span>
              </div>

              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(event) => {
                    setSortBy(event.target.value as SortValue);
                    setPage(0);
                  }}
                  className="h-9 appearance-none rounded-md border py-0 pl-3 pr-8 text-[12px] font-semibold outline-none"
                  style={{
                    background: colors.surface[50],
                    borderColor: colors.surface[200],
                    color: colors.text.secondary,
                  }}
                >
                  {sortOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <span
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
                  style={{ color: colors.text.muted }}
                >
                  <Icon type="chevron" size={13} />
                </span>
              </div>
            </div>
          </div>
        </div>

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
            subtitle="Try changing the classification filter, review state, sort order, or search query."
            action={
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSelectedFilter("ALL");
                  setReviewFilter("ALL");
                  setSortBy("newest");
                  setPage(0);
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
              <table className="w-full min-w-[1120px] border-collapse text-left">
                <thead>
                  <tr
                    className="border-b"
                    style={{
                      background: colors.surface[100],
                      borderColor: colors.surface[200],
                    }}
                  >
                    {[
                      "Document",
                      "Course",
                      "Classification",
                      "Human score",
                      "Capture stats",
                      "Review",
                      "Certificate",
                      "Actions",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em]"
                        style={{ color: colors.text.muted }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedSessions.map((session) => {
                    const bucket = getBucket(session);
                    const confidence = normalizeEvidenceScore(
                      session.confidence,
                    );
                    const hasCertificate = Boolean(session.certificate_id);
                    const barColor = progressBarColor(session);

                    return (
                      <tr
                        key={session.id}
                        className="border-b transition-colors duration-100 hover:bg-surface-100"
                        style={{ borderColor: colors.surface[200] }}
                      >
                        <td className="px-4 py-3 align-middle">
                          <div className="min-w-0">
                            <Link
                              to={ROUTES.SESSION_DETAIL.replace(
                                ":sessionId",
                                String(session.id),
                              )}
                              className="block max-w-[280px] truncate text-[13px] font-semibold hover:underline"
                              style={{ color: colors.text.primary }}
                            >
                              {session.title || "Untitled Document"}
                            </Link>
                            <p
                              className="mt-0.5 text-[11px]"
                              style={{ color: colors.text.muted }}
                            >
                              Captured {formatShortDate(session.created_at)}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-3 align-middle">
                          <div className="min-w-0">
                            <p
                              className="max-w-[160px] truncate text-[12px] font-medium"
                              style={{ color: colors.text.primary }}
                            >
                              {session.course_code || "Personal"}
                            </p>
                            <p
                              className="max-w-[160px] truncate text-[11px]"
                              style={{ color: colors.text.muted }}
                            >
                              {session.course_name || "No course linked"}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-3 align-middle">
                          <StatusBadge value={bucket} />
                        </td>

                        <td className="px-4 py-3 align-middle">
                          <div className="w-24">
                            <p
                              className="font-mono text-[13px] font-bold tabular-nums"
                              style={{ color: colors.text.primary }}
                            >
                              {formatEvidenceScore(confidence)}%
                            </p>
                            <div
                              className="mt-1 h-1 rounded-md"
                              style={{ background: colors.surface[200] }}
                            >
                              <div
                                className="h-1 rounded-md"
                                style={{
                                  background: barColor,
                                  width: `${confidence}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 align-middle">
                          <div
                            className="grid grid-cols-3 gap-2 text-[11px]"
                            style={{ color: colors.text.secondary }}
                          >
                            <div>
                              <p style={{ color: colors.text.muted }}>Words</p>
                              <p
                                className="font-mono font-bold tabular-nums"
                                style={{ color: colors.text.primary }}
                              >
                                {Number(session.word_count || 0)}
                              </p>
                            </div>
                            <div>
                              <p style={{ color: colors.text.muted }}>WPM</p>
                              <p
                                className="font-mono font-bold tabular-nums"
                                style={{ color: colors.text.primary }}
                              >
                                {Math.round(Number(session.wpm) || 0)}
                              </p>
                            </div>
                            <div>
                              <p style={{ color: colors.text.muted }}>Time</p>
                              <p
                                className="font-mono font-bold tabular-nums"
                                style={{ color: colors.text.primary }}
                              >
                                {formatCompactDuration(
                                  session.duration_seconds,
                                )}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 align-middle">
                          <div className="space-y-1">
                            <StatusBadge
                              value={session.review_status || "PENDING"}
                            />
                            {session.review_outcome && (
                              <p
                                className="max-w-[150px] text-[11px] leading-4"
                                style={{ color: colors.text.muted }}
                              >
                                {session.review_outcome}
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 align-middle">
                          {hasCertificate ? (
                            <span
                              className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold"
                              style={{
                                background: colors.mintTint,
                                borderColor: colors.mintTint,
                                color: brand.humanText,
                              }}
                            >
                              <Icon type="certificate" size={12} />
                              Issued
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold"
                              style={{
                                background: colors.surface[100],
                                borderColor: colors.surface[200],
                                color: colors.text.muted,
                              }}
                            >
                              Not issued
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center gap-1.5">
                            <Link
                              to={ROUTES.REPLAY.replace(
                                ":sessionId",
                                String(session.id),
                              )}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold hover:bg-surface-100"
                              style={{
                                borderColor: colors.surface[200],
                                color: colors.text.secondary,
                                background: colors.surface[50],
                              }}
                            >
                              <Icon type="replay" size={13} />
                              Replay
                            </Link>

                            {session.certificate_id && (
                              <Link
                                to={`/verify/${session.certificate_id}`}
                                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold hover:bg-surface-100"
                                style={{
                                  borderColor: colors.surface[200],
                                  color: colors.text.secondary,
                                  background: colors.surface[50],
                                }}
                              >
                                <Icon type="external" size={13} />
                                Verify
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: colors.surface[200] }}
            >
              <p className="text-[12px]" style={{ color: colors.text.muted }}>
                Showing {showingStart}–{showingEnd} of {filteredSessions.length}{" "}
                sessions
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage === 0}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  className="h-8 rounded-md border px-3 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    borderColor: colors.surface[200],
                    background: colors.surface[50],
                    color: colors.text.primary,
                  }}
                >
                  Prev
                </button>
                <span
                  className="rounded-md border px-2.5 py-1 text-[12px] font-semibold"
                  style={{
                    background: colors.surface[100],
                    borderColor: colors.surface[200],
                    color: colors.text.secondary,
                  }}
                >
                  {safePage + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages - 1}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages - 1, current + 1))
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
          </>
        )}
      </section>
    </div>
  );
}
