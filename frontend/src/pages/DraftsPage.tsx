import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";

import { ROUTES } from "../constants/routes";
import { useAuthStore } from "../store/authStore";
import { brand, colors } from "../styles/colors";
import {
  countDraftKeydowns,
  countDraftPasteEvents,
  countDraftWords,
  deleteEditorDraftByKey,
  listEditorDrafts,
  titleForDraft,
  type EditorDraftSnapshot,
} from "../lib/editorDraftStore";
import { useToast } from "../components/ui/ToastContext";
import { MINIMUM_KEYSTROKES } from "../lib/edgeCases";

function Icon({ type, size = 16 }: { type: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    draft: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h5" />
      </>
    ),
    editor: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
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
    trash: (
      <>
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    keyboard: (
      <>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12" />
      </>
    ),
    offline: (
      <>
        <path d="M2 12a10 10 0 0 1 16.9-7.2" />
        <path d="M22 12a10 10 0 0 1-16.9 7.2" />
        <path d="M2 2l20 20" />
      </>
    ),
    course: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
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

function panelStyle() {
  return {
    background: colors.surface[50],
    borderColor: colors.surface[200],
    boxShadow: `0 1px 3px ${colors.shadow}`,
  };
}

function formatDateTime(value: number): string {
  if (!Number.isFinite(value)) return "Unknown";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDurationFromDraft(draft: EditorDraftSnapshot): string {
  const activeMs = Math.max(0, Math.round(Number(draft.activeDurationMs || 0)));
  if (!activeMs) return "0m";

  const totalSeconds = Math.max(1, Math.round(activeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function draftReadiness(draft: EditorDraftSnapshot) {
  const keydowns = countDraftKeydowns(draft.keystrokeLog);
  const pasteEvents = countDraftPasteEvents(draft.keystrokeLog);
  const words = countDraftWords(draft.text);
  const ready =
    (keydowns >= MINIMUM_KEYSTROKES || pasteEvents > 0) && words > 0;

  return { keydowns, pasteEvents, words, ready };
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

function StatusBadge({ ready }: { ready: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{
        background: ready ? colors.mintTint : colors.amberTint,
        borderColor: ready ? colors.mintTint : colors.amberTint,
        color: ready ? brand.humanText : brand.suspiciousText,
      }}
    >
      {ready ? "Ready to analyze" : "Still drafting"}
    </span>
  );
}

function DraftMobileCard({
  draft,
  deleting,
  onDelete,
}: {
  draft: EditorDraftSnapshot;
  deleting: boolean;
  onDelete: (draft: EditorDraftSnapshot) => void;
}) {
  const readiness = draftReadiness(draft);
  const resumePath = `${ROUTES.EDITOR_NEW}?draftId=${encodeURIComponent(draft.draftId)}`;

  return (
    <article className="mobile-record-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className="text-anywhere text-[14px] font-semibold leading-5"
            style={{ color: colors.text.primary }}
          >
            {titleForDraft(draft)}
          </h3>
          <p className="mt-1 text-[11px]" style={{ color: colors.text.muted }}>
            Saved {formatDateTime(draft.savedAt)}
          </p>
        </div>
        <StatusBadge ready={readiness.ready} />
      </div>

      <div className="mobile-record-grid mt-4">
        <div>
          <p className="mobile-record-label">Words</p>
          <p className="mobile-record-value font-mono tabular-nums">
            {readiness.words.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="mobile-record-label">Duration</p>
          <p className="mobile-record-value font-mono tabular-nums">
            {formatDurationFromDraft(draft)}
          </p>
        </div>
        <div>
          <p className="mobile-record-label">Keys</p>
          <p className="mobile-record-value font-mono tabular-nums">
            {readiness.keydowns.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="mobile-record-label">Evidence events</p>
          <p className="mobile-record-value font-mono tabular-nums">
            {draft.keystrokeLog.length.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className="rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
          style={{
            background:
              draft.syncStatus === "SYNCED"
                ? colors.mintTint
                : colors.surface[100],
            borderColor: colors.surface[200],
            color:
              draft.syncStatus === "SYNCED"
                ? brand.humanText
                : colors.text.muted,
          }}
        >
          {draft.syncStatus === "SYNCED"
            ? "Cloud synced"
            : draft.syncStatus === "CONFLICT"
              ? "Sync conflict"
              : "Local fallback"}
        </span>
        <span className="text-[11px]" style={{ color: colors.text.muted }}>
          Created {formatDateTime(draft.createdAt)}
        </span>
      </div>

      <div className="responsive-actions mt-4">
        <Link
          to={resumePath}
          className="touch-target inline-flex items-center justify-center gap-2 rounded-md border px-3 text-[12px] font-semibold"
          style={{
            borderColor: colors.surface[200],
            color: colors.text.secondary,
            background: colors.surface[50],
          }}
        >
          <Icon type="editor" size={14} />
          Resume draft
        </Link>
        <button
          type="button"
          disabled={deleting}
          onClick={() => onDelete(draft)}
          className="touch-target inline-flex items-center justify-center gap-2 rounded-md border px-3 text-[12px] font-semibold disabled:opacity-50"
          style={{
            borderColor: colors.surface[200],
            color: brand.aiText,
            background: colors.surface[50],
          }}
        >
          <Icon type="trash" size={14} />
          Delete
        </button>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <section className="rounded-md border" style={panelStyle()}>
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-md"
          style={{ background: colors.brandSoft, color: colors.brand }}
        >
          <Icon type="empty" size={24} />
        </div>
        <h2
          className="mt-4 text-[18px] font-bold tracking-[-0.03em]"
          style={{ color: colors.text.primary }}
        >
          No saved drafts yet
        </h2>
        <p
          className="mt-2 max-w-lg text-[13px] leading-6"
          style={{ color: colors.text.secondary }}
        >
          Drafts appear here when you save a session manually or when TypeTrace
          autosaves during writing, reloads, or connection loss. Synced drafts
          are also preserved on the server when you are online.
        </p>
        <Link
          to={ROUTES.EDITOR_NEW}
          className="mt-5 inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-[13px] font-semibold"
          style={{ background: colors.brand, color: colors.text.light }}
        >
          <Icon type="editor" size={14} />
          Start writing
        </Link>
      </div>
    </section>
  );
}

export default function DraftsPage() {
  const { user } = useAuthStore();
  const { showToast } = useToast();
  const userId = String(user?.id ?? user?.email ?? "anonymous");

  const [drafts, setDrafts] = useState<EditorDraftSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "READY" | "DRAFTING">("ALL");
  const [sortBy, setSortBy] = useState<"updated" | "created" | "words">(
    "updated",
  );
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    setIsLoading(true);
    try {
      const nextDrafts = await listEditorDrafts(userId);
      setDrafts(nextDrafts);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let mounted = true;
    const timer = window.setTimeout(() => {
      void listEditorDrafts(userId).then((nextDrafts) => {
        if (!mounted) return;
        setDrafts(nextDrafts);
        setIsLoading(false);
      });
    }, 0);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [userId]);

  const filteredDrafts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return drafts
      .filter((draft) => {
        const readiness = draftReadiness(draft);
        const matchesFilter =
          filter === "ALL" ||
          (filter === "READY" && readiness.ready) ||
          (filter === "DRAFTING" && !readiness.ready);
        const matchesSearch =
          !query ||
          titleForDraft(draft).toLowerCase().includes(query) ||
          draft.text.toLowerCase().includes(query);

        return matchesFilter && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === "created") return b.createdAt - a.createdAt;
        if (sortBy === "words")
          return countDraftWords(b.text) - countDraftWords(a.text);
        return b.savedAt - a.savedAt;
      });
  }, [drafts, filter, search, sortBy]);

  const stats = useMemo(() => {
    const ready = drafts.filter((draft) => draftReadiness(draft).ready).length;
    const totalWords = drafts.reduce(
      (sum, draft) => sum + countDraftWords(draft.text),
      0,
    );
    const totalEvents = drafts.reduce(
      (sum, draft) => sum + draft.keystrokeLog.length,
      0,
    );

    return {
      total: drafts.length,
      ready,
      drafting: Math.max(0, drafts.length - ready),
      totalWords,
      totalEvents,
    };
  }, [drafts]);

  const deleteDraft = async (draft: EditorDraftSnapshot) => {
    if (deletingKey) return;
    setDeletingKey(draft.draftKey);

    try {
      await deleteEditorDraftByKey(draft.draftKey);
      setDrafts((current) =>
        current.filter((item) => item.draftKey !== draft.draftKey),
      );
      showToast({
        type: "info",
        title: "Draft deleted",
        message: "The saved writing draft was removed from this browser.",
      });
    } finally {
      setDeletingKey(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div
          className="fixed left-0 top-0 z-50 h-0.5 w-full animate-pulse"
          style={{ background: colors.brand }}
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

  return (
    <div
      className="responsive-page space-y-4"
      style={{ paddingLeft: 12, paddingRight: 12 }}
    >
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: colors.text.muted }}
          >
            Draft workspace
          </p>
          <h1
            className="mt-1 text-[24px] font-bold tracking-[-0.04em]"
            style={{ color: colors.text.primary }}
          >
            Saved Drafts
          </h1>
          <p
            className="mt-1 max-w-2xl text-[13px] leading-6"
            style={{ color: colors.text.secondary }}
          >
            Resume unfinished writing sessions with their original text,
            keystroke evidence, timing state, and course selection intact.
          </p>
        </div>

        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 xl:w-auto xl:flex-nowrap xl:justify-end">
          <button
            type="button"
            onClick={() => void loadDrafts()}
            className="h-9 shrink-0 rounded-md border px-4 text-[13px] font-semibold"
            style={{
              background: colors.surface[50],
              borderColor: colors.surface[200],
              color: colors.text.secondary,
            }}
          >
            Refresh
          </button>
          <Link
            to={ROUTES.EDITOR_NEW}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 text-[13px] font-semibold"
            style={{ background: colors.brand, color: colors.text.light }}
          >
            <Icon type="editor" size={15} />
            New draft
          </Link>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Saved drafts"
          value={stats.total}
          helper="Unsubmitted sessions stored locally for resume"
          icon="draft"
        />
        <MetricCard
          label="Ready to analyze"
          value={stats.ready}
          helper="Drafts with enough typing or paste evidence"
          icon="keyboard"
        />
        <MetricCard
          label="Total words"
          value={stats.totalWords.toLocaleString()}
          helper="Words currently sitting in unfinished drafts"
          icon="editor"
        />
        <MetricCard
          label="Captured events"
          value={stats.totalEvents.toLocaleString()}
          helper="Keystroke, paste, cut, and revision events preserved"
          icon="offline"
        />
      </div>

      {!drafts.length ? (
        <EmptyState />
      ) : (
        <section className="rounded-md border" style={panelStyle()}>
          <div
            className="border-b p-4"
            style={{ borderColor: colors.surface[200] }}
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.16em]"
                  style={{ color: colors.text.muted }}
                >
                  Draft ledger
                </p>
                <h2
                  className="mt-1 text-[15px] font-bold tracking-[-0.02em]"
                  style={{ color: colors.text.primary }}
                >
                  Resume or remove unfinished sessions
                </h2>
                <p
                  className="mt-0.5 text-[12px] leading-5"
                  style={{ color: colors.text.secondary }}
                >
                  Submitting a draft through analysis removes it from this list
                  and moves the final record to Sessions.
                </p>
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
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search drafts"
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
                      onClick={() => setSearch("")}
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
                    value={filter}
                    onChange={(event) =>
                      setFilter(event.target.value as typeof filter)
                    }
                    className="h-9 appearance-none rounded-md border py-0 pl-3 pr-8 text-[12px] font-semibold outline-none"
                    style={{
                      background: colors.surface[50],
                      borderColor: colors.surface[200],
                      color: colors.text.secondary,
                    }}
                  >
                    <option value="ALL">All drafts</option>
                    <option value="READY">Ready to analyze</option>
                    <option value="DRAFTING">Still drafting</option>
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
                    onChange={(event) =>
                      setSortBy(event.target.value as typeof sortBy)
                    }
                    className="h-9 appearance-none rounded-md border py-0 pl-3 pr-8 text-[12px] font-semibold outline-none"
                    style={{
                      background: colors.surface[50],
                      borderColor: colors.surface[200],
                      color: colors.text.secondary,
                    }}
                  >
                    <option value="updated">Last saved</option>
                    <option value="created">Created date</option>
                    <option value="words">Most words</option>
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

          {!filteredDrafts.length ? (
            <div className="px-6 py-16 text-center">
              <p
                className="text-[15px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                No drafts match your filters
              </p>
              <p
                className="mt-1 text-[13px]"
                style={{ color: colors.text.secondary }}
              >
                Clear the search or switch the draft status filter.
              </p>
            </div>
          ) : (
            <>
              <div className="mobile-card-list xl:hidden">
                {filteredDrafts.map((draft) => (
                  <DraftMobileCard
                    key={draft.draftKey}
                    draft={draft}
                    deleting={deletingKey === draft.draftKey}
                    onDelete={(item) => void deleteDraft(item)}
                  />
                ))}
              </div>

              <div className="hidden overflow-x-auto xl:block">
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
                        "Draft",
                        "Progress",
                        "Evidence",
                        "Timing",
                        "Status",
                        "Actions",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className={`px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] ${
                            heading === "Actions" ? "sticky right-0" : ""
                          }`}
                          style={{
                            color: colors.text.muted,
                            ...(heading === "Actions"
                              ? {
                                  background: colors.surface[100],
                                  zIndex: 10,
                                }
                              : {}),
                          }}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDrafts.map((draft) => {
                      const readiness = draftReadiness(draft);
                      const resumePath = `${ROUTES.EDITOR_NEW}?draftId=${encodeURIComponent(draft.draftId)}`;

                      return (
                        <tr
                          key={draft.draftKey}
                          className="border-b transition-colors duration-100 hover:bg-surface-100"
                          style={{ borderColor: colors.surface[200] }}
                        >
                          <td className="px-4 py-3 align-middle">
                            <div className="min-w-0">
                              <p
                                className="max-w-[260px] truncate text-[13px] font-semibold"
                                style={{ color: colors.text.primary }}
                              >
                                {titleForDraft(draft)}
                              </p>
                              <p
                                className="mt-0.5 text-[11px]"
                                style={{ color: colors.text.muted }}
                              >
                                Saved {formatDateTime(draft.savedAt)}
                              </p>
                            </div>
                          </td>

                          <td className="px-4 py-3 align-middle">
                            <div
                              className="grid grid-cols-2 gap-2 text-[11px]"
                              style={{ color: colors.text.secondary }}
                            >
                              <div>
                                <p style={{ color: colors.text.muted }}>
                                  Words
                                </p>
                                <p
                                  className="font-mono font-bold tabular-nums"
                                  style={{ color: colors.text.primary }}
                                >
                                  {readiness.words.toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <p style={{ color: colors.text.muted }}>
                                  Chars
                                </p>
                                <p
                                  className="font-mono font-bold tabular-nums"
                                  style={{ color: colors.text.primary }}
                                >
                                  {draft.text.length.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 align-middle">
                            <div
                              className="grid grid-cols-3 gap-2 text-[11px]"
                              style={{ color: colors.text.secondary }}
                            >
                              <div>
                                <p style={{ color: colors.text.muted }}>Keys</p>
                                <p
                                  className="font-mono font-bold tabular-nums"
                                  style={{ color: colors.text.primary }}
                                >
                                  {readiness.keydowns.toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <p style={{ color: colors.text.muted }}>
                                  Paste
                                </p>
                                <p
                                  className="font-mono font-bold tabular-nums"
                                  style={{ color: colors.text.primary }}
                                >
                                  {readiness.pasteEvents}
                                </p>
                              </div>
                              <div>
                                <p style={{ color: colors.text.muted }}>
                                  Events
                                </p>
                                <p
                                  className="font-mono font-bold tabular-nums"
                                  style={{ color: colors.text.primary }}
                                >
                                  {draft.keystrokeLog.length.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 align-middle">
                            <div
                              className="text-[12px]"
                              style={{ color: colors.text.secondary }}
                            >
                              <p
                                className="font-mono font-bold tabular-nums"
                                style={{ color: colors.text.primary }}
                              >
                                {formatDurationFromDraft(draft)}
                              </p>
                              <p
                                className="mt-0.5 text-[11px]"
                                style={{ color: colors.text.muted }}
                              >
                                Created {formatDateTime(draft.createdAt)}
                              </p>
                            </div>
                          </td>

                          <td className="px-4 py-3 align-middle">
                            <div className="flex flex-col items-start gap-1.5">
                              <StatusBadge ready={readiness.ready} />
                              <span
                                className="rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                style={{
                                  background:
                                    draft.syncStatus === "SYNCED"
                                      ? colors.mintTint
                                      : colors.surface[100],
                                  borderColor: colors.surface[200],
                                  color:
                                    draft.syncStatus === "SYNCED"
                                      ? brand.humanText
                                      : colors.text.muted,
                                }}
                              >
                                {draft.syncStatus === "SYNCED"
                                  ? "Cloud synced"
                                  : draft.syncStatus === "CONFLICT"
                                    ? "Sync conflict"
                                    : "Local fallback"}
                              </span>
                            </div>
                          </td>

                          <td
                            className="sticky right-0 whitespace-nowrap px-4 py-3 align-middle"
                            style={{
                              background: colors.surface[50],
                              zIndex: 10,
                            }}
                          >
                            <div className="flex flex-nowrap items-center gap-1.5">
                              <Link
                                to={resumePath}
                                className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-[11px] font-semibold"
                                style={{
                                  borderColor: colors.surface[200],
                                  color: colors.text.secondary,
                                  background: colors.surface[50],
                                }}
                              >
                                <Icon type="editor" size={13} />
                                Resume
                              </Link>
                              <button
                                type="button"
                                disabled={deletingKey === draft.draftKey}
                                onClick={() => void deleteDraft(draft)}
                                className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 text-[11px] font-semibold disabled:opacity-50"
                                style={{
                                  borderColor: colors.surface[200],
                                  color: brand.aiText,
                                  background: colors.surface[50],
                                }}
                              >
                                <Icon type="trash" size={13} />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
