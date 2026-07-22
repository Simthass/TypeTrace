import type { KeystrokeEvent } from "../types/editor";

import { API_ROUTES } from "../constants/apiRoutes";
import { api, getApiStatusCode } from "./api";

const DB_NAME = "typetrace-editor-drafts";
const DB_VERSION = 3;
const STORE_NAME = "drafts";
const LOCAL_MIRROR_PREFIX = "typetrace:draft:";
const DRAFT_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const IDLE_BREAK_THRESHOLD_MS = 30_000;

export type DraftSaveReason = "autosave" | "manual" | "recovery" | "resume";

export interface EditorDraftSnapshot {
  version: 3;
  draftKey: string;
  draftId: string;
  userId: string;
  title: string;
  text: string;
  selectedCourseId: number | null;
  keystrokeLog: KeystrokeEvent[];
  startedAt: number | null;
  lastActivityAt: number | null;
  lastKeyDownTimestamp: number | null;
  /** Active writing/capture time only. Draft idle time must never be counted. */
  activeDurationMs: number;
  /** Timestamp when this draft was intentionally suspended or emergency-frozen. */
  pausedAt: number | null;
  createdAt: number;
  savedAt: number;
  saveReason: DraftSaveReason;
  backendDraftId?: string | null;
  serverVersion?: number | null;
  syncStatus?: "LOCAL_ONLY" | "SYNCED" | "PENDING_SYNC" | "CONFLICT";
  lifecycleStatus?: "ACTIVE" | "PAUSED" | "SUBMITTED" | "DELETED";
}

export type EditorDraftInput = Omit<
  EditorDraftSnapshot,
  | "version"
  | "draftKey"
  | "draftId"
  | "userId"
  | "createdAt"
  | "savedAt"
  | "saveReason"
>;

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined";
}

export function safeDraftUserId(userId?: string | null): string {
  return String(userId || "anonymous").trim() || "anonymous";
}

export function createEditorDraftId(timestamp = Date.now()): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `draft-${timestamp}-${random}`;
}

export function createEditorDraftKey(
  userId?: string | null,
  draftId = createEditorDraftId(),
): string {
  return `editor:${safeDraftUserId(userId)}:${draftId}`;
}

function legacyDraftKey(userId?: string | null): string {
  return `editor:${safeDraftUserId(userId)}`;
}

function localMirrorKey(draftKey: string): string {
  return `${LOCAL_MIRROR_PREFIX}${draftKey}`;
}

function normalizeSaveReason(value: unknown): DraftSaveReason {
  return value === "manual" ||
    value === "recovery" ||
    value === "resume" ||
    value === "autosave"
    ? value
    : "autosave";
}

function normalizeSyncStatus(
  value: unknown,
): EditorDraftSnapshot["syncStatus"] {
  return value === "SYNCED" ||
    value === "PENDING_SYNC" ||
    value === "CONFLICT" ||
    value === "LOCAL_ONLY"
    ? value
    : "LOCAL_ONLY";
}

function normalizeLifecycleStatus(
  value: unknown,
): EditorDraftSnapshot["lifecycleStatus"] {
  return value === "ACTIVE" ||
    value === "PAUSED" ||
    value === "SUBMITTED" ||
    value === "DELETED"
    ? value
    : "PAUSED";
}

export function titleForDraft(
  draft: Pick<EditorDraftSnapshot, "title" | "text">,
) {
  const title = draft.title.trim();
  if (title) return title;

  const firstLine = draft.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine ? firstLine.slice(0, 72) : "Untitled draft";
}

export function countDraftWords(value: string): number {
  const clean = value.trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

export function countDraftPasteEvents(events: KeystrokeEvent[]): number {
  return events.filter(
    (event) => event.type === "paste" || event.key === "__PASTE_EVENT__",
  ).length;
}

export function countDraftKeydowns(events: KeystrokeEvent[]): number {
  return events.filter((event) => event.type === "keydown").length;
}

function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isPlausibleWallClock(value: number | null): value is number {
  if (value === null) return false;
  const minWallClock = new Date("2020-01-01T00:00:00.000Z").getTime();
  const maxWallClock = Date.now() + 1000 * 60 * 60 * 24;
  return value >= minWallClock && value <= maxWallClock;
}

function sanitizeActiveDurationMs(value: unknown): number | null {
  const n = safeNumber(value);
  if (n === null || n < 0) return null;

  // An individual academic writing session should never restore as months or
  // years long. This guards old broken drafts that used wall-clock age.
  const maxReasonable = 1000 * 60 * 60 * 24;
  return Math.min(Math.round(n), maxReasonable);
}

function estimateActiveDurationMsFromEvents(events: KeystrokeEvent[]): number {
  const timestamps = events
    .map((event) => safeNumber(event.timestamp))
    .filter((value): value is number => isPlausibleWallClock(value))
    .sort((a, b) => a - b);

  if (timestamps.length < 2) return events.length > 0 ? 1000 : 0;

  let activeMs = 0;

  for (let index = 1; index < timestamps.length; index += 1) {
    const gap = Math.max(0, timestamps[index] - timestamps[index - 1]);
    if (gap <= IDLE_BREAK_THRESHOLD_MS) activeMs += gap;
  }

  return Math.max(1000, Math.min(activeMs, 1000 * 60 * 60 * 24));
}

function firstPlausibleEventTimestamp(events: KeystrokeEvent[]): number | null {
  for (const event of events) {
    const timestamp = safeNumber(event.timestamp);
    if (isPlausibleWallClock(timestamp)) return timestamp;
  }
  return null;
}

function lastPlausibleKeyDownTimestamp(
  events: KeystrokeEvent[],
): number | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    const timestamp = safeNumber(event.timestamp);
    if (event.type === "keydown" && isPlausibleWallClock(timestamp))
      return timestamp;
  }
  return null;
}

function sanitizeDraftFlightTime(value: unknown): number | null {
  const n = safeNumber(value);
  if (n === null || n <= 0) return null;
  return n > IDLE_BREAK_THRESHOLD_MS ? null : n;
}

function normalizeDraftEvents(
  events: KeystrokeEvent[],
  fallbackEndAt: number,
): KeystrokeEvent[] {
  if (!events.length) return [];

  const timestampValues = events
    .map((event) => safeNumber(event.timestamp))
    .filter((value): value is number => value !== null);
  const hasPlausibleWallClock = timestampValues.some((value) =>
    isPlausibleWallClock(value),
  );
  const firstRawTimestamp = timestampValues[0] ?? null;
  const lastRawTimestamp = timestampValues[timestampValues.length - 1] ?? null;
  const fallbackBaseAt =
    firstRawTimestamp !== null && lastRawTimestamp !== null
      ? fallbackEndAt - Math.max(0, lastRawTimestamp - firstRawTimestamp)
      : fallbackEndAt;

  let previousTimestamp = fallbackBaseAt;

  return events.map((event) => {
    const rawTimestamp = safeNumber(event.timestamp);
    let timestamp: number;

    if (isPlausibleWallClock(rawTimestamp)) {
      timestamp = rawTimestamp;
    } else if (
      !hasPlausibleWallClock &&
      rawTimestamp !== null &&
      firstRawTimestamp !== null
    ) {
      timestamp =
        fallbackBaseAt + Math.max(0, rawTimestamp - firstRawTimestamp);
    } else {
      timestamp = previousTimestamp;
    }

    previousTimestamp = timestamp;

    return {
      ...event,
      timestamp,
      flight_time: sanitizeDraftFlightTime(event.flight_time),
    };
  });
}

function isFresh(savedAt: unknown): boolean {
  const timestamp = safeNumber(savedAt);
  return timestamp !== null && Date.now() - timestamp < DRAFT_TTL_MS;
}

function hasDraftContent(
  value: Pick<EditorDraftSnapshot, "text" | "title" | "keystrokeLog">,
) {
  return (
    value.text.trim().length > 0 ||
    value.title.trim().length > 0 ||
    value.keystrokeLog.length > 0
  );
}

function normalizeDraft(
  value: unknown,
  fallbackUserId?: string | null,
): EditorDraftSnapshot | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const text = typeof raw.text === "string" ? raw.text : "";
  const title = typeof raw.title === "string" ? raw.title : "";
  const rawEvents = Array.isArray(raw.keystrokeLog) ? raw.keystrokeLog : [];
  const savedAt = safeNumber(raw.savedAt) ?? Date.now();
  const events = normalizeDraftEvents(rawEvents as KeystrokeEvent[], savedAt);

  if (!isFresh(savedAt)) return null;

  const userId = safeDraftUserId(
    typeof raw.userId === "string" ? raw.userId : fallbackUserId,
  );
  const rawDraftId = typeof raw.draftId === "string" ? raw.draftId : "";
  const draftId = rawDraftId || `legacy-${savedAt}`;
  const draftKey =
    typeof raw.draftKey === "string" && raw.draftKey.includes(":")
      ? raw.draftKey.includes(`:${draftId}`)
        ? raw.draftKey
        : createEditorDraftKey(userId, draftId)
      : createEditorDraftKey(userId, draftId);

  const rawStartedAt = safeNumber(raw.startedAt);
  const rawLastActivityAt = safeNumber(raw.lastActivityAt);
  const rawLastKeyDownTimestamp = safeNumber(raw.lastKeyDownTimestamp);
  const rawActiveDurationMs = sanitizeActiveDurationMs(raw.activeDurationMs);
  const rawPausedAt = safeNumber(raw.pausedAt);
  const firstEventAt = firstPlausibleEventTimestamp(events);
  const lastKeyDownAt = lastPlausibleKeyDownTimestamp(events);
  const activeDurationMs =
    rawActiveDurationMs ?? estimateActiveDurationMsFromEvents(events);

  const draft: EditorDraftSnapshot = {
    version: 3,
    draftKey,
    draftId,
    userId,
    title,
    text,
    selectedCourseId:
      typeof raw.selectedCourseId === "number" ? raw.selectedCourseId : null,
    keystrokeLog: events,
    startedAt: isPlausibleWallClock(rawStartedAt) ? rawStartedAt : firstEventAt,
    lastActivityAt: isPlausibleWallClock(rawLastActivityAt)
      ? rawLastActivityAt
      : (lastKeyDownAt ?? firstEventAt),
    lastKeyDownTimestamp: isPlausibleWallClock(rawLastKeyDownTimestamp)
      ? rawLastKeyDownTimestamp
      : lastKeyDownAt,
    activeDurationMs,
    pausedAt: isPlausibleWallClock(rawPausedAt) ? rawPausedAt : savedAt,
    createdAt: safeNumber(raw.createdAt) ?? savedAt,
    savedAt,
    saveReason: normalizeSaveReason(raw.saveReason),
    backendDraftId:
      typeof raw.backendDraftId === "string"
        ? raw.backendDraftId
        : typeof (raw as Record<string, unknown>).backend_draft_id === "string"
          ? String((raw as Record<string, unknown>).backend_draft_id)
          : null,
    serverVersion:
      typeof raw.serverVersion === "number"
        ? raw.serverVersion
        : typeof (raw as Record<string, unknown>).version === "number"
          ? Number((raw as Record<string, unknown>).version)
          : null,
    syncStatus: normalizeSyncStatus(raw.syncStatus),
    lifecycleStatus: normalizeLifecycleStatus(raw.lifecycleStatus),
  };

  return hasDraftContent(draft) ? draft : null;
}

function isDraftForUser(
  draft: EditorDraftSnapshot,
  userId?: string | null,
): boolean {
  return draft.userId === safeDraftUserId(userId);
}

function openDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUseBrowserStorage() || !("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "draftKey" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ?? new Error("Failed to open editor draft database."),
      );
  });
}

async function readIndexedDbValue(draftKey: string): Promise<unknown | null> {
  const db = await openDraftDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(draftKey);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to read editor draft."));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Failed to read editor draft."));
    };
  });
}

async function readAllIndexedDbValues(): Promise<unknown[]> {
  const db = await openDraftDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () =>
      resolve(Array.isArray(request.result) ? request.result : []);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to list editor drafts."));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Failed to list editor drafts."));
    };
  });
}

async function writeIndexedDbDraft(
  snapshot: EditorDraftSnapshot,
): Promise<void> {
  const db = await openDraftDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(snapshot);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Failed to save editor draft."));
    };
  });
}

async function deleteIndexedDbDraft(draftKey: string): Promise<void> {
  const db = await openDraftDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(draftKey);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Failed to delete editor draft."));
    };
  });
}

function readLocalDraft(
  draftKey: string,
  userId?: string | null,
): EditorDraftSnapshot | null {
  if (!canUseBrowserStorage()) return null;

  try {
    const raw = window.localStorage.getItem(localMirrorKey(draftKey));
    if (!raw) return null;
    return normalizeDraft(JSON.parse(raw), userId);
  } catch {
    return null;
  }
}

function listLocalDrafts(userId?: string | null): EditorDraftSnapshot[] {
  if (!canUseBrowserStorage()) return [];

  const drafts: EditorDraftSnapshot[] = [];

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(LOCAL_MIRROR_PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const draft = normalizeDraft(JSON.parse(raw), userId);
      if (draft && isDraftForUser(draft, userId)) drafts.push(draft);
    }
  } catch {
    return drafts;
  }

  return drafts;
}

function writeLocalMirror(snapshot: EditorDraftSnapshot): void {
  if (!canUseBrowserStorage()) return;

  try {
    window.localStorage.setItem(
      localMirrorKey(snapshot.draftKey),
      JSON.stringify(snapshot),
    );
  } catch {
    // IndexedDB is still attempted. LocalStorage can fail in private mode/quota pressure.
  }
}

function deleteLocalMirror(draftKey: string): void {
  if (!canUseBrowserStorage()) return;

  try {
    window.localStorage.removeItem(localMirrorKey(draftKey));
  } catch {
    // Ignore cleanup failure.
  }
}

function readDraftIdFromKey(draftKey: string): string | null {
  const parts = draftKey.split(":");
  return parts.length ? parts[parts.length - 1] || null : null;
}

function canAttemptServerSync(): boolean {
  if (!canUseBrowserStorage()) return false;
  return window.navigator?.onLine !== false;
}

function serverTimestampToMs(value: unknown): number | null {
  return safeNumber(value);
}

function serverDraftToSnapshot(
  value: unknown,
  fallbackUserId?: string | null,
): EditorDraftSnapshot | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const userId = safeDraftUserId(fallbackUserId);
  const backendDraftId =
    typeof raw.backend_draft_id === "string"
      ? raw.backend_draft_id
      : typeof raw.id === "string"
        ? raw.id
        : null;
  const draftId =
    typeof raw.local_draft_id === "string" && raw.local_draft_id
      ? raw.local_draft_id
      : typeof raw.draft_id === "string" && raw.draft_id
        ? raw.draft_id
        : (backendDraftId ?? createEditorDraftId());
  const savedAt = serverTimestampToMs(raw.updated_at) ?? Date.now();
  const createdAt = serverTimestampToMs(raw.created_at) ?? savedAt;
  const events = Array.isArray(raw.keystroke_array)
    ? (raw.keystroke_array as KeystrokeEvent[])
    : [];

  const snapshot: EditorDraftSnapshot = {
    version: 3,
    draftKey: createEditorDraftKey(userId, draftId),
    draftId,
    userId,
    title: typeof raw.title === "string" ? raw.title : "",
    text: typeof raw.text_content === "string" ? raw.text_content : "",
    selectedCourseId: typeof raw.course_id === "number" ? raw.course_id : null,
    keystrokeLog: normalizeDraftEvents(events, savedAt),
    startedAt: serverTimestampToMs(raw.started_at),
    lastActivityAt: serverTimestampToMs(raw.last_activity_at),
    lastKeyDownTimestamp: null,
    activeDurationMs:
      sanitizeActiveDurationMs(raw.active_duration_ms) ??
      estimateActiveDurationMsFromEvents(events),
    pausedAt: serverTimestampToMs(raw.paused_at),
    createdAt,
    savedAt,
    saveReason: normalizeSaveReason(raw.save_reason),
    backendDraftId,
    serverVersion: typeof raw.version === "number" ? raw.version : null,
    syncStatus:
      normalizeSyncStatus(raw.sync_status) === "LOCAL_ONLY"
        ? "SYNCED"
        : normalizeSyncStatus(raw.sync_status),
    lifecycleStatus: normalizeLifecycleStatus(raw.lifecycle_status),
  };

  return hasDraftContent(snapshot) ? snapshot : null;
}

function draftToServerPayload(snapshot: EditorDraftSnapshot) {
  return {
    draft_id: snapshot.draftId,
    title: titleForDraft(snapshot),
    text_content: snapshot.text,
    course_id: snapshot.selectedCourseId,
    keystroke_array: snapshot.keystrokeLog,
    active_duration_ms: Math.max(0, Math.round(snapshot.activeDurationMs || 0)),
    started_at: snapshot.startedAt,
    last_activity_at: snapshot.lastActivityAt,
    paused_at: snapshot.pausedAt,
    expected_version: snapshot.serverVersion ?? undefined,
    save_reason: snapshot.saveReason,
    lifecycle_status: snapshot.lifecycleStatus ?? "PAUSED",
    sync_status: "SYNCED",
  };
}

async function fetchServerDrafts(
  userId?: string | null,
): Promise<EditorDraftSnapshot[]> {
  if (!canAttemptServerSync()) return [];

  try {
    const response = await api.get(API_ROUTES.drafts.list, {
      skipGlobalToast: true,
      skipAuthRedirect: true,
    });
    const rawDrafts = Array.isArray(response.data?.drafts)
      ? response.data.drafts
      : [];

    return rawDrafts
      .map((item: unknown) => serverDraftToSnapshot(item, userId))
      .filter(
        (draft: EditorDraftSnapshot | null): draft is EditorDraftSnapshot =>
          Boolean(draft),
      );
  } catch {
    return [];
  }
}

async function fetchServerDraft(
  draftId: string,
  userId?: string | null,
): Promise<EditorDraftSnapshot | null> {
  if (!canAttemptServerSync()) return null;

  try {
    const response = await api.get(API_ROUTES.drafts.detail(draftId), {
      skipGlobalToast: true,
      skipAuthRedirect: true,
    });
    return serverDraftToSnapshot(response.data?.draft, userId);
  } catch {
    return null;
  }
}

async function syncDraftToServer(
  snapshot: EditorDraftSnapshot,
): Promise<EditorDraftSnapshot> {
  if (!canAttemptServerSync()) {
    return { ...snapshot, syncStatus: "PENDING_SYNC" };
  }

  try {
    const response = await api.post(
      API_ROUTES.drafts.list,
      draftToServerPayload(snapshot),
      {
        skipGlobalToast: true,
        skipAuthRedirect: true,
      },
    );
    const serverDraft = serverDraftToSnapshot(
      response.data?.draft,
      snapshot.userId,
    );
    return serverDraft ?? { ...snapshot, syncStatus: "SYNCED" };
  } catch (error: unknown) {
    const status = getApiStatusCode(error);
    const response =
      error && typeof error === "object" && "response" in error
        ? (
            error as {
              response?: {
                data?: {
                  detail?: {
                    server_draft?: unknown;
                  };
                };
              };
            }
          ).response
        : undefined;
    const serverDraft = serverDraftToSnapshot(
      response?.data?.detail?.server_draft,
      snapshot.userId,
    );

    if (status === 409 && serverDraft) {
      return {
        ...serverDraft,
        syncStatus: "CONFLICT",
      };
    }

    return {
      ...snapshot,
      syncStatus: "PENDING_SYNC",
    };
  }
}

async function deleteServerDraftById(draftId: string | null): Promise<void> {
  if (!draftId || !canAttemptServerSync()) return;

  try {
    await api.delete(API_ROUTES.drafts.detail(draftId), {
      skipGlobalToast: true,
      skipAuthRedirect: true,
    });
  } catch {
    // Local deletion still wins for the current browser. Backend cleanup retries
    // when the draft is next synced/listed.
  }
}

function mergeDraftLists(drafts: EditorDraftSnapshot[]): EditorDraftSnapshot[] {
  const byKey = new Map<string, EditorDraftSnapshot>();

  drafts.forEach((draft) => {
    const existing = byKey.get(draft.draftKey);
    if (!existing || draft.savedAt >= existing.savedAt) {
      byKey.set(draft.draftKey, draft);
    }
  });

  return Array.from(byKey.values()).sort((a, b) => b.savedAt - a.savedAt);
}

export async function listEditorDrafts(
  userId?: string | null,
): Promise<EditorDraftSnapshot[]> {
  const localDrafts = listLocalDrafts(userId);
  const indexedDrafts = await (async (): Promise<EditorDraftSnapshot[]> => {
    try {
      const values = await readAllIndexedDbValues();
      return values
        .map((value) => normalizeDraft(value, userId))
        .filter((draft): draft is EditorDraftSnapshot => Boolean(draft))
        .filter((draft) => isDraftForUser(draft, userId));
    } catch {
      return [];
    }
  })();

  const localCombined = mergeDraftLists([...localDrafts, ...indexedDrafts]);
  const syncedLocalDrafts = await Promise.all(
    localCombined.map((draft) =>
      draft.syncStatus === "SYNCED" || !canAttemptServerSync()
        ? Promise.resolve(draft)
        : syncDraftToServer(draft),
    ),
  );
  const serverDrafts = await fetchServerDrafts(userId);
  const drafts = mergeDraftLists([...syncedLocalDrafts, ...serverDrafts]);

  drafts.forEach((draft) => {
    writeLocalMirror(draft);
    void writeIndexedDbDraft(draft).catch(() => undefined);
  });

  return drafts;
}

export async function readEditorDraft(
  userId?: string | null,
  draftId?: string | null,
): Promise<EditorDraftSnapshot | null> {
  const safeUser = safeDraftUserId(userId);

  if (draftId) {
    const draftKey = createEditorDraftKey(safeUser, draftId);
    const local = readLocalDraft(draftKey, safeUser);
    const server = await fetchServerDraft(draftId, safeUser);

    try {
      const indexed = normalizeDraft(
        await readIndexedDbValue(draftKey),
        safeUser,
      );
      const latest =
        mergeDraftLists(
          [server, indexed, local].filter(
            (draft): draft is EditorDraftSnapshot => Boolean(draft),
          ),
        )[0] ?? null;
      if (latest) {
        writeLocalMirror(latest);
        void writeIndexedDbDraft(latest).catch(() => undefined);
      }
      return latest;
    } catch {
      return (
        mergeDraftLists(
          [server, local].filter((draft): draft is EditorDraftSnapshot =>
            Boolean(draft),
          ),
        )[0] ?? null
      );
    }
  }

  const drafts = await listEditorDrafts(safeUser);
  const legacyKey = legacyDraftKey(safeUser);
  const legacy = readLocalDraft(legacyKey, safeUser);

  if (legacy) drafts.push(legacy);

  return mergeDraftLists(drafts)[0] ?? null;
}

export async function saveEditorDraft(params: {
  userId?: string | null;
  draftId?: string | null;
  snapshot: EditorDraftInput;
  saveReason?: DraftSaveReason;
  existingCreatedAt?: number | null;
}): Promise<EditorDraftSnapshot> {
  const userId = safeDraftUserId(params.userId);
  const draftId = params.draftId || createEditorDraftId();
  const savedAt = Date.now();
  const draftKey = createEditorDraftKey(userId, draftId);
  const existingCreatedAt = params.existingCreatedAt ?? null;
  const previousLocal = readLocalDraft(draftKey, userId);

  let snapshot: EditorDraftSnapshot = {
    version: 3,
    draftKey,
    draftId,
    userId,
    title: params.snapshot.title,
    text: params.snapshot.text,
    selectedCourseId: params.snapshot.selectedCourseId,
    keystrokeLog: params.snapshot.keystrokeLog,
    startedAt: params.snapshot.startedAt,
    lastActivityAt: params.snapshot.lastActivityAt,
    lastKeyDownTimestamp: params.snapshot.lastKeyDownTimestamp,
    activeDurationMs:
      sanitizeActiveDurationMs(params.snapshot.activeDurationMs) ?? 0,
    pausedAt: isPlausibleWallClock(safeNumber(params.snapshot.pausedAt))
      ? safeNumber(params.snapshot.pausedAt)
      : params.saveReason === "manual" || params.saveReason === "recovery"
        ? savedAt
        : null,
    createdAt: existingCreatedAt ?? previousLocal?.createdAt ?? savedAt,
    savedAt,
    saveReason: params.saveReason ?? "autosave",
    backendDraftId: previousLocal?.backendDraftId ?? null,
    serverVersion: previousLocal?.serverVersion ?? null,
    syncStatus:
      canUseBrowserStorage() && window.navigator?.onLine === false
        ? "PENDING_SYNC"
        : "LOCAL_ONLY",
    lifecycleStatus:
      params.saveReason === "manual" || params.saveReason === "recovery"
        ? "PAUSED"
        : "ACTIVE",
  };

  if (!hasDraftContent(snapshot)) return snapshot;

  writeLocalMirror(snapshot);

  try {
    await writeIndexedDbDraft(snapshot);
  } catch {
    // The local mirror is already durable enough for refresh/crash recovery.
  }

  snapshot = await syncDraftToServer(snapshot);
  writeLocalMirror(snapshot);
  try {
    await writeIndexedDbDraft(snapshot);
  } catch {
    // Server sync result is mirrored in localStorage; ignore IndexedDB cleanup failures.
  }

  return snapshot;
}

export async function deleteEditorDraftByKey(draftKey: string): Promise<void> {
  const draftId = readDraftIdFromKey(draftKey);
  deleteLocalMirror(draftKey);
  try {
    await deleteIndexedDbDraft(draftKey);
  } catch {
    // Local mirror is already removed; ignore IndexedDB cleanup failures.
  }
  await deleteServerDraftById(draftId);
}

export async function deleteEditorDraft(
  userId?: string | null,
  draftId?: string | null,
): Promise<void> {
  const safeUser = safeDraftUserId(userId);

  if (draftId) {
    await deleteEditorDraftByKey(createEditorDraftKey(safeUser, draftId));
    return;
  }

  const latest = await readEditorDraft(safeUser);
  if (latest) await deleteEditorDraftByKey(latest.draftKey);
}
