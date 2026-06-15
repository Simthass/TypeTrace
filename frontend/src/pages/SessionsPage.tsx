import { useEffect, useMemo, useState } from "react";

import { Badge, classificationTone } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { EmptyState, PageHeader } from "../components/ui/PageState";
import { TableSkeleton } from "../components/ui/Skeleton";
import { Tabs } from "../components/ui/Tabs";
import { ErrorState } from "../components/ui/AsyncState";
import { ROUTES } from "../constants/routes";
import { api, getApiErrorMessage } from "../lib/api";
import { useToast } from "../components/ui/ToastProvider";
import { colors } from "../styles/colors";
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

const filters = [
  { value: "ALL", label: "All" },
  { value: "HUMAN", label: "Human" },
  { value: "SUSPICIOUS", label: "Review" },
  { value: "SYNTHETIC", label: "High Risk" },
];

function filterCount(sessions: SessionItem[], filter: string) {
  if (filter === "ALL") return sessions.length;

  return sessions.filter((session) => {
    const bucket = String(
      session.classification_bucket || session.classification,
    ).toUpperCase();

    if (filter === "SYNTHETIC") {
      return ["SYNTHETIC", "AI", "AI-GENERATED", "HIGH_RISK"].includes(bucket);
    }

    return bucket === filter;
  }).length;
}

function SessionCard({ session }: { session: SessionItem }) {
  const bucket = session.classification_bucket || session.classification;
  const tone = classificationTone(bucket);

  return (
    <Card className="transition hover:-translate-y-0.5">
      <CardBody>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2
                className="text-[16px] font-bold"
                style={{ color: colors.text.primary }}
              >
                {session.title || "Untitled Document"}
              </h2>

              <Badge tone={tone}>{bucket}</Badge>
              <Badge tone="neutral">{session.review_status || "PENDING"}</Badge>
            </div>

            <p
              className="mt-2 text-[13px]"
              style={{ color: colors.text.secondary }}
            >
              {session.course_code || "Personal session"} · {session.created_at}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <ButtonLink
              to={ROUTES.REPLAY.replace(":sessionId", String(session.id))}
              variant="secondary"
              size="sm"
            >
              Replay
            </ButtonLink>

            {session.certificate_id && (
              <ButtonLink to={`/verify/${session.certificate_id}`} size="sm">
                Verify
              </ButtonLink>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Confidence", `${session.confidence}%`],
            ["WPM", session.wpm],
            ["Words", session.word_count],
            ["Duration", `${session.duration_seconds}s`],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-md border px-3 py-2"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[50],
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: colors.text.secondary }}
              >
                {label}
              </p>
              <p
                className="mt-1 text-[14px] font-bold"
                style={{ color: colors.text.primary }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

export default function SessionsPage() {
  const { showToast } = useToast();

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedFilter, setSelectedFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const matchesFilter =
        selectedFilter === "ALL" ||
        (selectedFilter === "SYNTHETIC"
          ? ["SYNTHETIC", "AI", "AI-GENERATED", "HIGH_RISK"].includes(
              String(
                session.classification_bucket || session.classification,
              ).toUpperCase(),
            )
          : String(
              session.classification_bucket || session.classification,
            ).toUpperCase() === selectedFilter);

      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        session.title.toLowerCase().includes(query) ||
        String(session.course_name || "")
          .toLowerCase()
          .includes(query) ||
        String(session.course_code || "")
          .toLowerCase()
          .includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [sessions, selectedFilter, search]);

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

  if (isLoading) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Evidence library"
          title="Writing sessions"
          description="Review your captured authorship trails, replay behavioral evidence, and access certificate records."
          action={<ButtonLink to={ROUTES.EDITOR_NEW}>New session</ButtonLink>}
        />
        <TableSkeleton rows={6} />
      </div>
    );
  }

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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Evidence library"
        title="Writing sessions"
        description="Review your captured authorship trails, replay behavioral evidence, and access certificate records."
        action={<ButtonLink to={ROUTES.EDITOR_NEW}>New session</ButtonLink>}
      />

      <Card>
        <CardBody className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            items={tabItems}
            value={selectedFilter}
            onChange={setSelectedFilter}
          />

          <div className="flex w-full gap-2 lg:w-auto">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search sessions or courses..."
              className="h-10 w-full rounded-md border px-3 text-[13px] outline-none lg:w-72"
              style={{
                borderColor: colors.surface[200],
                color: colors.text.primary,
                background: colors.surface[50],
              }}
            />

            {search && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSearch("")}
              >
                Clear
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {!sessions.length ? (
        <EmptyState
          icon="session"
          title="No sessions yet"
          description="Start a writing session to capture keystrokes, pauses, edits, and a replayable authorship trail."
          action={
            <ButtonLink to={ROUTES.EDITOR_NEW}>Start first session</ButtonLink>
          }
        />
      ) : !filteredSessions.length ? (
        <EmptyState
          icon="search"
          title="No sessions match your filters"
          description="Try changing the classification filter or clearing your search query."
          action={
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSearch("");
                setSelectedFilter("ALL");
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {filteredSessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}
