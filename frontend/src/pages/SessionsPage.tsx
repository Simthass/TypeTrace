// frontend/src/pages/SessionsPage.tsx

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api, getApiErrorMessage } from "../lib/api";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";
import type {
  StudentSessionItem,
  StudentSessionsResponse,
} from "../types/student";

function SearchIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function getBadge(session: StudentSessionItem) {
  if (session.classification_bucket === "HUMAN") {
    return {
      label: "Human",
      bg: brand.humanBg,
      text: brand.humanText,
      border: brand.humanAccent,
    };
  }

  if (session.classification_bucket === "SUSPICIOUS") {
    return {
      label: "Review",
      bg: brand.suspiciousBg,
      text: brand.suspiciousText,
      border: brand.suspiciousAccent,
    };
  }

  return {
    label: "High Risk",
    bg: brand.aiBg,
    text: brand.aiText,
    border: brand.aiAccent,
  };
}

function SessionCard({ session }: { session: StudentSessionItem }) {
  const badge = getBadge(session);

  return (
    <div
      className="rounded-md border bg-white shadow-sm"
      style={{ borderColor: colors.surface[200] }}
    >
      <div
        className="flex flex-col justify-between gap-3 border-b px-5 py-4 md:flex-row md:items-start"
        style={{ borderColor: colors.surface[200] }}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className="truncate text-[15px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              {session.title}
            </h2>
            <span
              className="rounded-md border px-2 py-0.5 text-[11px] font-semibold"
              style={{
                background: badge.bg,
                color: badge.text,
                borderColor: badge.border,
              }}
            >
              {badge.label}
            </span>
          </div>
          <p
            className="mt-1 text-[12px]"
            style={{ color: colors.text.secondary }}
          >
            {session.created_at}
            {session.course_name ? ` · ${session.course_name}` : " · Personal"}
          </p>
        </div>

        <div className="text-left md:text-right">
          <p
            className="text-[15px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            {session.confidence}%
          </p>
          <p className="text-[11px]" style={{ color: colors.text.secondary }}>
            Confidence
          </p>
        </div>
      </div>

      <div className="grid gap-3 px-5 py-4 sm:grid-cols-4">
        {[
          ["WPM", session.wpm],
          ["Words", session.word_count],
          ["Keystrokes", session.total_keystrokes],
          ["Risk", session.risk_level],
          ["Review", session.review_status],
          ["Deletions", session.deletions],
          ["Pauses", session.pauses],
          ["Avg IKI", `${session.avg_iki}ms`],
        ].map(([label, value]) => (
          <div key={label}>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: colors.text.secondary }}
            >
              {label}
            </p>
            <p
              className="mt-1 text-[13px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              {value || "—"}
            </p>
          </div>
        ))}
      </div>

      {session.review_notes && (
        <div
          className="border-t px-5 py-3 text-[13px]"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[50],
            color: colors.text.secondary,
          }}
        >
          Teacher note: {session.review_notes}
        </div>
      )}

      <div
        className="flex flex-wrap gap-2 border-t px-5 py-4"
        style={{ borderColor: colors.surface[200] }}
      >
        <Link
          to={`/session/${session.id}/replay`}
          className="rounded-md px-3 py-2 text-[12px] font-semibold text-white"
          style={{ background: colors.brand }}
        >
          View Replay
        </Link>

        {session.certificate_id && (
          <Link
            to={`/verify/${session.certificate_id}`}
            className="rounded-md border px-3 py-2 text-[12px] font-semibold"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          >
            Verify Certificate
          </Link>
        )}
      </div>
    </div>
  );
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<StudentSessionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [classification, setClassification] = useState("ALL");
  const [reviewStatus, setReviewStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "100");
    params.set("offset", "0");

    if (classification !== "ALL") params.set("classification", classification);
    if (reviewStatus !== "ALL") params.set("review_status", reviewStatus);
    if (search.trim()) params.set("search", search.trim());

    return params.toString();
  }, [classification, reviewStatus, search]);

  useEffect(() => {
    let mounted = true;

    async function loadSessions() {
      setIsLoading(true);
      setApiError(null);

      try {
        const response = await api.get<StudentSessionsResponse>(
          `/student/sessions?${queryParams}`,
        );

        if (!mounted) return;
        setSessions(response.data.sessions || []);
        setTotal(response.data.total || 0);
      } catch (error) {
        if (!mounted) return;
        setApiError(getApiErrorMessage(error));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadSessions();

    return () => {
      mounted = false;
    };
  }, [queryParams]);

  return (
    <div
      className="min-h-screen px-6 py-8"
      style={{ background: colors.surface[50] }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p
              className="text-[12px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: colors.text.secondary }}
            >
              Writing evidence history
            </p>
            <h1
              className="mt-2 text-2xl font-semibold"
              style={{ color: colors.text.primary }}
            >
              Sessions
            </h1>
            <p
              className="mt-2 max-w-2xl text-[14px]"
              style={{ color: colors.text.secondary }}
            >
              Review every captured writing session, classification,
              certificate, and teacher review state.
            </p>
          </div>

          <Link
            to={ROUTES.EDITOR_NEW}
            className="rounded-md px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: colors.brand }}
          >
            New Session
          </Link>
        </div>

        <div
          className="mt-6 rounded-md border bg-white p-4"
          style={{ borderColor: colors.surface[200] }}
        >
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <span
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: colors.text.secondary }}
              >
                <SearchIcon />
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title or content..."
                className="w-full rounded-md border py-2 pl-9 pr-3 text-[13px] outline-none"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              />
            </div>

            <select
              value={classification}
              onChange={(event) => setClassification(event.target.value)}
              className="rounded-md border px-3 py-2 text-[13px] outline-none"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
              }}
            >
              <option value="ALL">All classifications</option>
              <option value="HUMAN">Human</option>
              <option value="SUSPICIOUS">Review</option>
              <option value="SYNTHETIC">High Risk</option>
            </select>

            <select
              value={reviewStatus}
              onChange={(event) => setReviewStatus(event.target.value)}
              className="rounded-md border px-3 py-2 text-[13px] outline-none"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
              }}
            >
              <option value="ALL">All review states</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="FLAGGED">Flagged</option>
            </select>
          </div>

          <p
            className="mt-3 text-[12px]"
            style={{ color: colors.text.secondary }}
          >
            Showing {sessions.length} of {total} sessions
          </p>
        </div>

        {apiError && (
          <div
            className="mt-6 rounded-md border px-4 py-3 text-[13px]"
            style={{
              borderColor: brand.aiAccent,
              background: brand.aiBg,
              color: brand.aiText,
            }}
          >
            {apiError}
          </div>
        )}

        {isLoading ? (
          <div
            className="mt-6 rounded-md border bg-white px-5 py-10 text-center text-[13px]"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.secondary,
            }}
          >
            Loading sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div
            className="mt-6 rounded-md border bg-white px-5 py-10 text-center"
            style={{ borderColor: colors.surface[200] }}
          >
            <h2
              className="text-[15px] font-semibold"
              style={{ color: colors.text.primary }}
            >
              No sessions found
            </h2>
            <p
              className="mt-2 text-[13px]"
              style={{ color: colors.text.secondary }}
            >
              Adjust the filters or create your first writing session.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
