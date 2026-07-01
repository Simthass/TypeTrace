import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { Tabs } from "../components/ui/Tabs";
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
  review_status: string;
  course_name?: string | null;
  course_code?: string | null;
  verify_url: string;
}

interface CertificatesResponse {
  status: string;
  certificates: CertificateItem[];
}

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

function isHighRisk(value: string): boolean {
  return ["SYNTHETIC", "AI", "AI-GENERATED", "HIGH_RISK", "HIGH RISK"].includes(
    String(value || "").toUpperCase(),
  );
}

function countByFilter(certificates: CertificateItem[], filter: string) {
  if (filter === "ALL") return certificates.length;

  return certificates.filter((item) => {
    const value = String(item.classification || "").toUpperCase();

    if (filter === "SYNTHETIC") return isHighRisk(value);

    return value === filter;
  }).length;
}

function normalizePercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function shortCertificateId(value: string): string {
  if (!value) return "Unknown";
  if (value.length <= 16) return value;
  return `${value.slice(0, 16)}...`;
}

function cardShadow() {
  return `0 1px 3px ${colors.shadow}`;
}

function statusStyle(value?: string) {
  const normalized = String(value || "UNKNOWN").toUpperCase();

  if (normalized === "HUMAN" || normalized === "LOW") {
    return {
      background: colors.mintTint,
      color: brand.humanText,
      borderColor: colors.mintTint,
      label: normalized === "LOW" ? "Low" : "Human",
    };
  }

  if (
    normalized === "SUSPICIOUS" ||
    normalized === "MEDIUM" ||
    normalized === "PENDING"
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
    normalized === "HIGH" ||
    normalized === "FLAGGED"
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

function MetricTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
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
        Current certificate vault
      </p>
    </div>
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
            className="h-7 w-48 animate-pulse rounded-md"
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

export default function CertificatesPage() {
  const { showToast } = useToast();
  const { downloadingId, downloadCertificate } = useCertificateDownload();

  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [selectedFilter, setSelectedFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCertificate, setSelectedCertificate] =
    useState<CertificateItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredCertificates = useMemo(() => {
    return certificates.filter((item) => {
      const value = String(item.classification || "").toUpperCase();
      const matchesFilter =
        selectedFilter === "ALL" ||
        (selectedFilter === "SYNTHETIC"
          ? isHighRisk(value)
          : value === selectedFilter);

      const query = search.trim().toLowerCase();
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

      return matchesFilter && matchesSearch;
    });
  }, [certificates, selectedFilter, search]);

  const stats = useMemo(() => {
    const total = certificates.length;
    const human = certificates.filter(
      (item) => String(item.classification || "").toUpperCase() === "HUMAN",
    ).length;
    const review = certificates.filter(
      (item) =>
        String(item.classification || "").toUpperCase() === "SUSPICIOUS",
    ).length;
    const highRisk = certificates.filter((item) =>
      isHighRisk(item.classification),
    ).length;

    return { total, human, review, highRisk };
  }, [certificates]);

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

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-0">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1
            className="text-[22px] font-bold tracking-[-0.03em]"
            style={{ color: colors.text.primary }}
          >
            Certificates
          </h1>
          <p
            className="mt-0.5 text-[13px]"
            style={{ color: colors.text.secondary }}
          >
            Verifiable authorship records sealed with SHA-256.
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
          label="Total Certificates"
          value={stats.total}
          icon="file"
        />
        <MetricTile label="Human Verified" value={stats.human} icon="shield" />
        <MetricTile
          label="Review Required"
          value={stats.review}
          icon="warning"
        />
        <MetricTile label="High Risk" value={stats.highRisk} icon="alert" />
      </div>

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
              placeholder="Search certificates..."
              className="h-9 w-full rounded-md border py-0 pl-9 pr-9 text-[13px] outline-none sm:w-56"
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
            Download All
          </button>
        </div>
      </div>

      <div
        className="overflow-hidden rounded-md border bg-white"
        style={{ borderColor: colors.surface[200], boxShadow: cardShadow() }}
      >
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
            subtitle="Try another classification filter or clear the search query."
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
                Show all certificates
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[1100px]">
              <div
                className="grid grid-cols-[200px_minmax(240px,1fr)_110px_120px_100px_80px_130px_140px] items-center gap-4 border-b px-5 py-3"
                style={{
                  background: colors.surface[100],
                  borderColor: colors.surface[200],
                }}
              >
                {[
                  "Certificate ID",
                  "Document",
                  "Course",
                  "Classification",
                  "Confidence",
                  "Risk",
                  "Date",
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

              {filteredCertificates.map((certificate) => {
                const confidence = normalizePercent(certificate.confidence);

                return (
                  <button
                    key={certificate.certificate_id}
                    type="button"
                    onClick={() => setSelectedCertificate(certificate)}
                    className="grid h-[56px] w-full grid-cols-[200px_minmax(240px,1fr)_110px_120px_100px_80px_130px_140px] items-center gap-4 border-b px-5 text-left transition-colors duration-100 hover:bg-surface-100"
                    style={{ borderColor: colors.surface[200] }}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="truncate font-mono text-[12px] font-bold"
                        style={{ color: colors.text.primary }}
                      >
                        {shortCertificateId(certificate.certificate_id)}
                      </span>
                      <span className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(event) =>
                            copyCertificateId(event, certificate.certificate_id)
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

                    <div className="min-w-0">
                      <p
                        className="truncate text-[13px] font-semibold"
                        style={{ color: colors.text.primary }}
                      >
                        {certificate.title || "Untitled Document"}
                      </p>
                    </div>

                    <div
                      className="truncate text-[12px]"
                      style={{ color: colors.text.secondary }}
                    >
                      {certificate.course_code || "Personal"}
                    </div>

                    <StatusBadge value={certificate.classification} />

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

                    <StatusBadge value={certificate.risk_level || "LOW"} />

                    <div
                      className="text-[12px]"
                      style={{ color: colors.text.muted }}
                    >
                      {certificate.created_at}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/verify/${certificate.certificate_id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex h-7 items-center justify-center rounded-md border px-2 text-[11px] font-semibold"
                        style={{
                          borderColor: colors.surface[200],
                          color: colors.brand,
                          background: colors.surface[50],
                        }}
                      >
                        Verify
                      </Link>
                      <Link
                        to={ROUTES.REPLAY.replace(
                          ":sessionId",
                          String(certificate.session_id),
                        )}
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex h-7 items-center justify-center rounded-md border px-2 text-[11px] font-semibold"
                        style={{
                          borderColor: colors.surface[200],
                          color: colors.text.secondary,
                          background: colors.surface[50],
                        }}
                      >
                        Replay
                      </Link>
                      <button
                        type="button"
                        disabled={downloadingId === certificate.certificate_id}
                        onClick={(event) =>
                          handleDownload(event, certificate.certificate_id)
                        }
                        className="inline-flex h-7 items-center justify-center rounded-md border px-2 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                          borderColor: colors.surface[200],
                          color: colors.text.secondary,
                          background: colors.surface[50],
                        }}
                      >
                        PDF
                      </button>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

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
            className="absolute right-0 top-0 h-full w-full max-w-[360px] overflow-y-auto border-l bg-white p-5"
            style={{ borderColor: colors.surface[200] }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <h2
                className="text-[14px] font-bold"
                style={{ color: colors.text.primary }}
              >
                Certificate Detail
              </h2>
              <button
                type="button"
                onClick={() => setSelectedCertificate(null)}
                className="flex h-8 w-8 items-center justify-center rounded-md"
                style={{ color: colors.text.secondary }}
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
                  className="mt-2 break-all rounded-md p-3 font-mono text-[12px]"
                  style={{
                    background: colors.surface[100],
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
                  className="mt-2 break-all rounded-md p-3 font-mono text-[12px]"
                  style={{
                    background: colors.surface[100],
                    color: colors.text.primary,
                  }}
                >
                  {selectedCertificate.document_hash || "Not available"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-md border p-3"
                  style={{ borderColor: colors.surface[200] }}
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
                  style={{ borderColor: colors.surface[200] }}
                >
                  <p
                    className="text-[11px]"
                    style={{ color: colors.text.muted }}
                  >
                    Confidence
                  </p>
                  <p
                    className="mt-2 text-[18px] font-bold tabular-nums"
                    style={{ color: colors.text.primary }}
                  >
                    {normalizePercent(selectedCertificate.confidence)}%
                  </p>
                </div>
              </div>

              <div
                className="rounded-md border p-3"
                style={{ borderColor: colors.surface[200] }}
              >
                <p className="text-[11px]" style={{ color: colors.text.muted }}>
                  Risk
                </p>
                <div className="mt-2">
                  <StatusBadge value={selectedCertificate.risk_level} />
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
                  className="mt-2 block break-all rounded-md p-3 text-[12px] font-semibold"
                  style={{
                    background: colors.surface[100],
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
                  className="flex h-11 w-full items-center justify-center rounded-md text-[13px] font-semibold"
                  style={{ background: colors.brand, color: colors.text.light }}
                >
                  Verify Certificate
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    downloadCertificate(selectedCertificate.certificate_id)
                  }
                  disabled={
                    downloadingId === selectedCertificate.certificate_id
                  }
                  className="flex h-11 w-full items-center justify-center rounded-md border text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background: colors.surface[50],
                    borderColor: colors.surface[200],
                    color: colors.text.primary,
                  }}
                >
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
