import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { ErrorState } from "../components/ui/AsyncState";
import { ROUTES } from "../constants/routes";
import { useCertificateDownload } from "../hooks/useCertificateDownload";
import { api, getApiErrorMessage } from "../lib/api";
import { useToast } from "../components/ui/ToastProvider";
import { brand, colors } from "../styles/colors";
import { API_ROUTES } from "../constants/apiRoutes";

interface CertificateItem {
  session_id: number;
  title: string;
  classification: string;
  confidence: number;
  created_at: string;
  certificate_id: string;
  document_hash: string;
  risk_level: string;
  course_name?: string | null;
  course_code?: string | null;
  verify_url: string;
}

interface CertificatesResponse {
  status: string;
  certificates: CertificateItem[];
}

type SortMode =
  | "NEWEST"
  | "OLDEST"
  | "CONFIDENCE_HIGH"
  | "CONFIDENCE_LOW"
  | "COURSE";

type ClassificationFilter = "ALL" | "HUMAN" | "SUSPICIOUS" | "SYNTHETIC";

const PAGE_SIZE = 16;

const filters: Array<{ value: ClassificationFilter; label: string }> = [
  { value: "ALL", label: "All certificates" },
  { value: "HUMAN", label: "Human" },
  { value: "SUSPICIOUS", label: "Needs review" },
  { value: "SYNTHETIC", label: "High risk" },
];

const sortOptions: Array<{ value: SortMode; label: string }> = [
  { value: "NEWEST", label: "Newest first" },
  { value: "OLDEST", label: "Oldest first" },
  { value: "CONFIDENCE_HIGH", label: "Confidence high" },
  { value: "CONFIDENCE_LOW", label: "Confidence low" },
  { value: "COURSE", label: "Course" },
];

function Icon({ type, size = 16 }: { type: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="m9 15 2 2 4-5" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    warning: (
      <>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    alert: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v5" />
        <path d="M12 16h.01" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
    copy: (
      <>
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
    download: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="M7 10l5 5 5-5" />
        <path d="M12 15V3" />
      </>
    ),
    close: (
      <>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </>
    ),
    empty: (
      <>
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
        <path d="M14 2v6h6" />
        <path d="m9 15 2 2 4-5" />
      </>
    ),
    external: (
      <>
        <path d="M15 3h6v6" />
        <path d="M10 14 21 3" />
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      </>
    ),
    hash: (
      <>
        <path d="M4 9h16" />
        <path d="M4 15h16" />
        <path d="M10 3 8 21" />
        <path d="M16 3l-2 18" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </>
    ),
    replay: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
      </>
    ),
    chevron: <path d="m6 9 6 6 6-6" />,
    rows: (
      <>
        <rect x="3" y="4" width="18" height="4" rx="1" />
        <rect x="3" y="10" width="18" height="4" rx="1" />
        <rect x="3" y="16" width="18" height="4" rx="1" />
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

function isHighRisk(value: string): boolean {
  return ["SYNTHETIC", "AI", "AI-GENERATED", "HIGH_RISK", "HIGH RISK"].includes(
    String(value || "").toUpperCase(),
  );
}

function classificationBucket(
  value?: string,
): "HUMAN" | "SUSPICIOUS" | "HIGH_RISK" | "UNKNOWN" {
  const normalized = String(value || "UNKNOWN").toUpperCase();

  if (normalized === "HUMAN") return "HUMAN";
  if (normalized === "SUSPICIOUS") return "SUSPICIOUS";
  if (isHighRisk(normalized)) return "HIGH_RISK";
  return "UNKNOWN";
}

/**
 * Progress-bar / accent color for a given classification bucket.
 * Human = green, Review Required (Suspicious) = amber, High Risk = red.
 * Falls back to brand blue only for genuinely unknown/unclassified state.
 */
function progressBarColor(value?: string): string {
  const bucket = classificationBucket(value);
  if (bucket === "HUMAN") return colors.green;
  if (bucket === "SUSPICIOUS") return colors.amber;
  if (bucket === "HIGH_RISK") return colors.red;
  return colors.brand;
}

function countByFilter(
  certificates: CertificateItem[],
  filter: ClassificationFilter,
) {
  if (filter === "ALL") return certificates.length;

  return certificates.filter((item) => {
    const value = classificationBucket(item.classification);
    if (filter === "SYNTHETIC") return value === "HIGH_RISK";
    return value === filter;
  }).length;
}

function normalizePercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pct(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function shortCertificateId(value: string): string {
  if (!value) return "Unknown";
  if (value.length <= 18) return value;
  return `${value.slice(0, 18)}...`;
}

function shortHash(value?: string | null): string {
  if (!value) return "Not available";
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
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

function statusStyle(value?: string) {
  const normalized = String(value || "UNKNOWN").toUpperCase();

  if (
    normalized === "HUMAN" ||
    normalized === "LOW" ||
    normalized === "APPROVED"
  ) {
    return {
      background: colors.mintTint,
      color: brand.humanText,
      borderColor: colors.mintTint,
      label:
        normalized === "LOW"
          ? "Low"
          : normalized === "APPROVED"
            ? "Approved"
            : "Human",
    };
  }

  if (normalized === "SUSPICIOUS" || normalized === "MEDIUM") {
    return {
      background: colors.amberTint,
      color: brand.suspiciousText,
      borderColor: colors.amberTint,
      label: normalized === "SUSPICIOUS" ? "Needs review" : normalized,
    };
  }

  if (
    isHighRisk(normalized) ||
    normalized === "HIGH" ||
    normalized === "FLAGGED"
  ) {
    return {
      background: colors.roseTint,
      color: brand.aiText,
      borderColor: colors.roseTint,
      label: isHighRisk(normalized) ? "High risk" : normalized,
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

export default function CertificatesPage() {
  const { showToast } = useToast();
  const { downloadingId, downloadCertificate } = useCertificateDownload();

  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [selectedFilter, setSelectedFilter] =
    useState<ClassificationFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortMode>("NEWEST");
  const [search, setSearch] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCertificate, setSelectedCertificate] =
    useState<CertificateItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadCertificates() {
      setIsLoading(true);
      setApiError(null);

      try {
        const response = await api.get<CertificatesResponse>(
          API_ROUTES.certificates.list,
        );

        if (!mounted) return;
        setCertificates(response.data.certificates || []);
      } catch (error) {
        if (!mounted) return;
        const message = getApiErrorMessage(error);
        setApiError(message);
        showToast({
          type: "error",
          title: "Certificates failed to load",
          message,
        });
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadCertificates();

    return () => {
      mounted = false;
    };
  }, [showToast]);

  const stats = useMemo(() => {
    const total = certificates.length;
    const human = certificates.filter(
      (item) => classificationBucket(item.classification) === "HUMAN",
    ).length;
    const hashes = certificates.filter((item) =>
      Boolean(item.document_hash),
    ).length;
    const avgConfidence = total
      ? Math.round(
          certificates.reduce(
            (sum, item) => sum + safeNumber(item.confidence),
            0,
          ) / total,
        )
      : 0;

    return {
      total,
      human,
      hashes,
      hashCoverage: pct(hashes, total),
      avgConfidence,
    };
  }, [certificates]);

  const filteredCertificates = useMemo(() => {
    const query = search.trim().toLowerCase();

    return certificates
      .filter((item) => {
        const classification = classificationBucket(item.classification);
        const matchesClassification =
          selectedFilter === "ALL" ||
          (selectedFilter === "SYNTHETIC"
            ? classification === "HIGH_RISK"
            : classification === selectedFilter);
        const matchesSearch =
          !query ||
          String(item.title || "")
            .toLowerCase()
            .includes(query) ||
          String(item.certificate_id || "")
            .toLowerCase()
            .includes(query) ||
          String(item.document_hash || "")
            .toLowerCase()
            .includes(query) ||
          String(item.course_name || "")
            .toLowerCase()
            .includes(query) ||
          String(item.course_code || "")
            .toLowerCase()
            .includes(query);

        return matchesClassification && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === "OLDEST")
          return parseTime(a.created_at) - parseTime(b.created_at);
        if (sortBy === "CONFIDENCE_HIGH")
          return safeNumber(b.confidence) - safeNumber(a.confidence);
        if (sortBy === "CONFIDENCE_LOW")
          return safeNumber(a.confidence) - safeNumber(b.confidence);
        if (sortBy === "COURSE") {
          return String(
            a.course_code || a.course_name || "Personal",
          ).localeCompare(String(b.course_code || b.course_name || "Personal"));
        }
        return parseTime(b.created_at) - parseTime(a.created_at);
      });
  }, [certificates, search, selectedFilter, sortBy]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCertificates.length / PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages - 1);
  const paginatedCertificates = filteredCertificates.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  const tabItems = filters.map((filter) => ({
    ...filter,
    count: countByFilter(certificates, filter.value),
  }));

  const copyCertificateId = async (
    event: MouseEvent<HTMLButtonElement>,
    certificateId: string,
  ) => {
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(certificateId);
      setCopiedId(certificateId);
      window.setTimeout(() => setCopiedId(null), 1400);
    } catch {
      showToast({
        type: "error",
        title: "Copy failed",
        message: "Could not copy the certificate ID.",
      });
    }
  };

  const handleDownload = (
    event: MouseEvent<HTMLButtonElement>,
    certificateId: string,
  ) => {
    event.stopPropagation();
    downloadCertificate(certificateId);
  };

  const handleDownloadAll = async () => {
    for (const certificate of filteredCertificates) {
      await downloadCertificate(certificate.certificate_id);
    }
  };

  if (isLoading) return <InlineLoader />;

  if (apiError) {
    return (
      <ErrorState
        title="Could not load certificates"
        message={apiError}
        action={
          <Button type="button" onClick={() => window.location.reload()}>
            Retry
          </Button>
        }
      />
    );
  }

  const showingStart = filteredCertificates.length
    ? safePage * PAGE_SIZE + 1
    : 0;
  const showingEnd = Math.min(
    (safePage + 1) * PAGE_SIZE,
    filteredCertificates.length,
  );

  return (
    <div className="mx-auto max-w-[1440px] space-y-4 px-0 pb-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: colors.text.muted }}
          >
            Certificate vault
          </p>
          <h1
            className="mt-1 text-[24px] font-bold tracking-[-0.04em]"
            style={{ color: colors.text.primary }}
          >
            Certificates
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
          label="Total certificates"
          value={stats.total}
          helper="Issued certificate records in the vault"
          icon="file"
        />
        <MetricCard
          label="Human verified"
          value={stats.human}
          helper="Certificates linked to human-classified sessions"
          icon="shield"
        />
        <MetricCard
          label="Average confidence"
          value={`${stats.avgConfidence}%`}
          helper="Mean model confidence across certificates"
          icon="lock"
        />
        <MetricCard
          label="Hash coverage"
          value={`${stats.hashCoverage}%`}
          helper={`${stats.hashes} certificates include a document hash`}
          icon="hash"
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
                  placeholder="Search ID, hash, course, title"
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
                  value={sortBy}
                  onChange={(event) => {
                    setSortBy(event.target.value as SortMode);
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

              <button
                type="button"
                disabled={!filteredCertificates.length}
                onClick={handleDownloadAll}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[50],
                  color: colors.text.primary,
                }}
              >
                <Icon type="download" size={14} />
                Download PDFs
              </button>
            </div>
          </div>
        </div>

        {!certificates.length ? (
          <EmptyTable
            title="No certificates yet"
            subtitle="Analyze a writing session to generate a certificate with a public verification record."
            action={
              <Link
                to={ROUTES.EDITOR_NEW}
                className="inline-flex h-9 items-center justify-center rounded-md px-4 text-[13px] font-semibold"
                style={{ background: colors.brand, color: colors.text.light }}
              >
                Start writing session
              </Link>
            }
          />
        ) : !filteredCertificates.length ? (
          <EmptyTable
            title="No certificates match this filter"
            subtitle="Try another classification filter, sort order, or search query."
            action={
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSelectedFilter("ALL");
                  setSortBy("NEWEST");
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
                      "Certificate",
                      "Document",
                      "Course",
                      "Classification",
                      "Confidence",
                      "Risk",
                      "Issued",
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
                  {paginatedCertificates.map((certificate) => {
                    const confidence = normalizePercent(certificate.confidence);
                    const barColor = progressBarColor(
                      certificate.classification,
                    );

                    return (
                      <tr
                        key={certificate.certificate_id}
                        className="border-b transition-colors duration-100 hover:bg-surface-100"
                        style={{ borderColor: colors.surface[200] }}
                      >
                        <td className="px-4 py-3 align-middle">
                          <div className="flex min-w-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedCertificate(certificate)
                              }
                              className="min-w-0 text-left"
                            >
                              <p
                                className="max-w-[180px] truncate font-mono text-[12px] font-bold"
                                style={{ color: colors.text.primary }}
                              >
                                {shortCertificateId(certificate.certificate_id)}
                              </p>
                              <p
                                className="mt-0.5 max-w-[180px] truncate font-mono text-[11px]"
                                style={{ color: colors.text.muted }}
                              >
                                {shortHash(certificate.document_hash)}
                              </p>
                            </button>
                            <span className="relative shrink-0">
                              <button
                                type="button"
                                onClick={(event) =>
                                  copyCertificateId(
                                    event,
                                    certificate.certificate_id,
                                  )
                                }
                                className="flex h-6 w-6 items-center justify-center rounded-md"
                                style={{ color: colors.text.secondary }}
                                aria-label="Copy certificate ID"
                              >
                                <Icon type="copy" size={12} />
                              </button>
                              {copiedId === certificate.certificate_id && (
                                <span
                                  className="absolute left-1/2 top-7 z-10 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold"
                                  style={{
                                    background: colors.text.primary,
                                    color: colors.text.light,
                                  }}
                                >
                                  Copied
                                </span>
                              )}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3 align-middle">
                          <button
                            type="button"
                            onClick={() => setSelectedCertificate(certificate)}
                            className="min-w-0 text-left"
                          >
                            <p
                              className="max-w-[260px] truncate text-[13px] font-semibold"
                              style={{ color: colors.text.primary }}
                            >
                              {certificate.title || "Untitled Document"}
                            </p>
                            <p
                              className="mt-0.5 text-[11px]"
                              style={{ color: colors.text.muted }}
                            >
                              Session #{certificate.session_id}
                            </p>
                          </button>
                        </td>

                        <td className="px-4 py-3 align-middle">
                          <p
                            className="max-w-[140px] truncate text-[12px] font-medium"
                            style={{ color: colors.text.primary }}
                          >
                            {certificate.course_code || "Personal"}
                          </p>
                          <p
                            className="max-w-[140px] truncate text-[11px]"
                            style={{ color: colors.text.muted }}
                          >
                            {certificate.course_name || "No course linked"}
                          </p>
                        </td>

                        <td className="px-4 py-3 align-middle">
                          <StatusBadge value={certificate.classification} />
                        </td>

                        <td className="px-4 py-3 align-middle">
                          <div className="w-24">
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
                                  background: barColor,
                                  width: `${confidence}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 align-middle">
                          <StatusBadge
                            value={certificate.risk_level || "LOW"}
                          />
                        </td>

                        <td
                          className="px-4 py-3 text-[12px] align-middle"
                          style={{ color: colors.text.muted }}
                        >
                          {formatShortDate(certificate.created_at)}
                        </td>

                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center gap-1.5">
                            <Link
                              to={`/verify/${certificate.certificate_id}`}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold"
                              style={{
                                borderColor: colors.surface[200],
                                color: colors.text.secondary,
                                background: colors.surface[50],
                              }}
                            >
                              <Icon type="external" size={13} />
                              Verify
                            </Link>
                            <Link
                              to={ROUTES.REPLAY.replace(
                                ":sessionId",
                                String(certificate.session_id),
                              )}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold"
                              style={{
                                borderColor: colors.surface[200],
                                color: colors.text.secondary,
                                background: colors.surface[50],
                              }}
                            >
                              <Icon type="replay" size={13} />
                              Replay
                            </Link>
                            <button
                              type="button"
                              disabled={
                                downloadingId === certificate.certificate_id
                              }
                              onClick={(event) =>
                                handleDownload(
                                  event,
                                  certificate.certificate_id,
                                )
                              }
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                              style={{
                                borderColor: colors.surface[200],
                                color: colors.text.secondary,
                                background: colors.surface[50],
                              }}
                            >
                              <Icon type="download" size={13} />
                              PDF
                            </button>
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
                Showing {showingStart}–{showingEnd} of{" "}
                {filteredCertificates.length} certificates
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

      {selectedCertificate && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setSelectedCertificate(null)}
        >
          <div
            className="absolute inset-0"
            style={{ background: colors.shadowStrong }}
          />
          <aside
            className="absolute right-0 top-0 h-full w-full max-w-[420px] overflow-y-auto border-l p-5"
            style={{
              background: colors.surface[50],
              borderColor: colors.surface[200],
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.16em]"
                  style={{ color: colors.text.muted }}
                >
                  Certificate audit
                </p>
                <h2
                  className="mt-1 text-[16px] font-bold"
                  style={{ color: colors.text.primary }}
                >
                  Certificate detail
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCertificate(null)}
                className="flex h-8 w-8 items-center justify-center rounded-md border"
                style={{
                  background: colors.surface[50],
                  borderColor: colors.surface[200],
                  color: colors.text.secondary,
                }}
                aria-label="Close certificate detail"
              >
                <Icon type="close" size={16} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: colors.text.muted }}
                >
                  Certificate ID
                </p>
                <div
                  className="mt-2 break-all rounded-md border p-3 font-mono text-[12px]"
                  style={{
                    background: colors.surface[100],
                    borderColor: colors.surface[200],
                    color: colors.text.primary,
                  }}
                >
                  {selectedCertificate.certificate_id}
                </div>
              </div>

              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: colors.text.muted }}
                >
                  Document hash
                </p>
                <div
                  className="mt-2 break-all rounded-md border p-3 font-mono text-[12px]"
                  style={{
                    background: colors.surface[100],
                    borderColor: colors.surface[200],
                    color: colors.text.primary,
                  }}
                >
                  {selectedCertificate.document_hash || "Not available"}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div
                  className="rounded-md border p-3"
                  style={{
                    background: colors.surface[100],
                    borderColor: colors.surface[200],
                  }}
                >
                  <p
                    className="text-[11px]"
                    style={{ color: colors.text.muted }}
                  >
                    Classification
                  </p>
                  <div className="mt-2">
                    <StatusBadge value={selectedCertificate.classification} />
                  </div>
                </div>
                <div
                  className="rounded-md border p-3"
                  style={{
                    background: colors.surface[100],
                    borderColor: colors.surface[200],
                  }}
                >
                  <p
                    className="text-[11px]"
                    style={{ color: colors.text.muted }}
                  >
                    Confidence
                  </p>
                  <p
                    className="mt-2 text-[18px] font-bold tabular-nums"
                    style={{
                      color: progressBarColor(
                        selectedCertificate.classification,
                      ),
                    }}
                  >
                    {normalizePercent(selectedCertificate.confidence)}%
                  </p>
                </div>
                <div
                  className="rounded-md border p-3"
                  style={{
                    background: colors.surface[100],
                    borderColor: colors.surface[200],
                  }}
                >
                  <p
                    className="text-[11px]"
                    style={{ color: colors.text.muted }}
                  >
                    Risk
                  </p>
                  <div className="mt-2">
                    <StatusBadge
                      value={selectedCertificate.risk_level || "LOW"}
                    />
                  </div>
                </div>
              </div>

              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: colors.text.muted }}
                >
                  Document
                </p>
                <div
                  className="mt-2 rounded-md border p-3"
                  style={{
                    background: colors.surface[100],
                    borderColor: colors.surface[200],
                  }}
                >
                  <p
                    className="text-[13px] font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {selectedCertificate.title || "Untitled Document"}
                  </p>
                  <p
                    className="mt-1 text-[12px]"
                    style={{ color: colors.text.muted }}
                  >
                    {selectedCertificate.course_code || "Personal"} ·{" "}
                    {formatShortDate(selectedCertificate.created_at)}
                  </p>
                </div>
              </div>

              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: colors.text.muted }}
                >
                  Verify URL
                </p>
                <Link
                  to={`/verify/${selectedCertificate.certificate_id}`}
                  className="mt-2 block break-all rounded-md border p-3 text-[12px] font-semibold"
                  style={{
                    background: colors.surface[100],
                    borderColor: colors.surface[200],
                    color: colors.brand,
                  }}
                >
                  {selectedCertificate.verify_url ||
                    `/verify/${selectedCertificate.certificate_id}`}
                </Link>
              </div>

              <div className="space-y-2 pt-2">
                <Link
                  to={`/verify/${selectedCertificate.certificate_id}`}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-md text-[13px] font-semibold"
                  style={{ background: colors.brand, color: colors.text.light }}
                >
                  <Icon type="external" size={14} />
                  Verify Certificate
                </Link>
                <Link
                  to={ROUTES.REPLAY.replace(
                    ":sessionId",
                    String(selectedCertificate.session_id),
                  )}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-md border text-[13px] font-semibold"
                  style={{
                    background: colors.surface[50],
                    borderColor: colors.surface[200],
                    color: colors.text.primary,
                  }}
                >
                  <Icon type="replay" size={14} />
                  Replay Session
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    downloadCertificate(selectedCertificate.certificate_id)
                  }
                  disabled={
                    downloadingId === selectedCertificate.certificate_id
                  }
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-md border text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: colors.surface[50],
                    borderColor: colors.surface[200],
                    color: colors.text.primary,
                  }}
                >
                  <Icon type="download" size={14} />
                  Download PDF
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
