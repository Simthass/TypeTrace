import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import EditorPage from "../pages/EditorPage";
import {
  MAX_EDITOR_TEXT_LENGTH,
  MAX_PASTE_LENGTH,
  MINIMUM_KEYSTROKES,
} from "../lib/edgeCases";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setSearchParams: vi.fn(),
  search: "",
  showToast: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  getApiErrorMessage: vi.fn(() => "Controlled editor error."),
  saveDraft: vi.fn(),
  clearDraft: vi.fn(),
  clearLocalDraft: vi.fn(),
  dismissRecoveredDraft: vi.fn(),
  hasCheckedDraft: true,
  recoveredDraft: null as null | {
    draftId: string;
    title: string;
    text: string;
    selectedCourseId: number | null;
    keystrokeLog: Array<{ type?: string; key?: string }>;
    startedAt: number;
    lastActivityAt: number;
    lastKeyDownTimestamp: number | null;
    activeDurationMs: number;
    pausedAt: number | null;
    savedAt: number;
    saveReason: "autosave" | "manual" | "recovery";
    syncStatus?: string;
  },
  liveStats: {
    keystrokes: 0,
    deletions: 0,
    deletedCharacters: 0,
    bulkDeletionEvents: 0,
    largestDeletionChars: 0,
    selectionDeletionEvents: 0,
    wordDeletionEvents: 0,
    cutEvents: 0,
    pauses: 0,
    wpm: 0,
    avgIki: 0,
    sessionSeconds: 0,
  },
  captureEvents: [] as Array<{ type?: string; key?: string; timestamp?: number }>,
  getStats: vi.fn(),
  getCaptureSnapshot: vi.fn(),
  resetCapture: vi.fn(),
  hydrateCapture: vi.fn(),
  recordTextChange: vi.fn(),
  rejectPendingInput: vi.fn(),
  baseHandleKeyDown: vi.fn(),
  baseHandleKeyUp: vi.fn(),
  baseHandlePaste: vi.fn(),
  baseHandleCut: vi.fn(),
  baseHandleBeforeInput: vi.fn(),
  handleSelectionChange: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useSearchParams: () => [
      new URLSearchParams(mocks.search),
      mocks.setSearchParams,
    ],
  };
});

vi.mock("../components/ui/ToastContext", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock("../store/authStore", () => ({
  useAuthStore: () => ({
    user: {
      id: "student-final",
      first_name: "Grace",
      last_name: "Hopper",
      email: "grace@example.edu",
      role: "STUDENT",
    },
  }),
}));

vi.mock("../hooks/useBodyScrollLock", () => ({
  useBodyScrollLock: vi.fn(),
}));

vi.mock("../hooks/useEditorDraftRecovery", () => ({
  useEditorDraftRecovery: () => ({
    recoveredDraft: mocks.recoveredDraft,
    hasCheckedDraft: mocks.hasCheckedDraft,
    isSavingDraft: false,
    saveDraft: mocks.saveDraft,
    clearDraft: mocks.clearDraft,
    clearLocalDraft: mocks.clearLocalDraft,
    dismissRecoveredDraft: mocks.dismissRecoveredDraft,
  }),
}));

vi.mock("../hooks/useKeystrokeCapture", () => ({
  useKeystrokeCapture: () => ({
    liveStats: mocks.liveStats,
    handleKeyDown: mocks.baseHandleKeyDown,
    handleKeyUp: mocks.baseHandleKeyUp,
    handlePaste: mocks.baseHandlePaste,
    handleCut: mocks.baseHandleCut,
    handleBeforeInput: mocks.baseHandleBeforeInput,
    recordTextChange: mocks.recordTextChange,
    rejectPendingInput: mocks.rejectPendingInput,
    handleSelectionChange: mocks.handleSelectionChange,
    getStats: mocks.getStats,
    resetCapture: mocks.resetCapture,
    hydrateCapture: mocks.hydrateCapture,
    getCaptureSnapshot: mocks.getCaptureSnapshot,
  }),
}));

vi.mock("../lib/api", () => ({
  api: {
    get: mocks.apiGet,
    post: mocks.apiPost,
  },
  getApiErrorMessage: mocks.getApiErrorMessage,
}));

function renderEditor() {
  return render(
    <MemoryRouter>
      <EditorPage />
    </MemoryRouter>,
  );
}

function acceptConsentBeforeRender() {
  window.localStorage.setItem(
    "typetrace.editorEvidenceConsent.v1",
    "accepted",
  );
}

function configureReadyCapture() {
  Object.assign(mocks.liveStats, {
    keystrokes: MINIMUM_KEYSTROKES + 5,
    deletions: 3,
    deletedCharacters: 5,
    bulkDeletionEvents: 1,
    largestDeletionChars: 3,
    selectionDeletionEvents: 1,
    wordDeletionEvents: 1,
    cutEvents: 1,
    pauses: 3,
    wpm: 41,
    avgIki: 190,
    sessionSeconds: 125,
  });
  mocks.captureEvents = Array.from(
    { length: MINIMUM_KEYSTROKES + 5 },
    (_, index) => ({
      type: "keydown",
      key: String.fromCharCode(97 + (index % 20)),
      timestamp: 1_000 + index * 80,
    }),
  );
}

async function openAnalysis() {
  fireEvent.change(screen.getByLabelText("Document title"), {
    target: { value: "Final evidence" },
  });
  fireEvent.change(screen.getByLabelText("Writing workspace"), {
    target: { value: "A final captured writing session for closure testing." },
  });
  fireEvent.click(screen.getByRole("button", { name: /Analyze session/ }));
  await screen.findByRole("heading", {
    name: "Where does this session belong?",
  });
}

describe("EditorPage final behavioral closure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    window.localStorage.clear();
    mocks.search = "";
    mocks.hasCheckedDraft = true;
    mocks.recoveredDraft = null;
    Object.assign(mocks.liveStats, {
      keystrokes: 0,
      deletions: 0,
      deletedCharacters: 0,
      bulkDeletionEvents: 0,
      largestDeletionChars: 0,
      selectionDeletionEvents: 0,
      wordDeletionEvents: 0,
      cutEvents: 0,
      pauses: 0,
      wpm: 0,
      avgIki: 0,
      sessionSeconds: 0,
    });
    mocks.captureEvents = [];
    mocks.getStats.mockImplementation(() => ({ ...mocks.liveStats }));
    mocks.getCaptureSnapshot.mockImplementation((options?: { pause?: boolean }) => ({
      events: mocks.captureEvents,
      startedAt: 1_000,
      lastActivityAt: 2_000,
      lastKeyDownTimestamp: 1_900,
      activeDurationMs: 1_000,
      pausedAt: options?.pause ? 2_000 : null,
    }));
    mocks.apiGet.mockResolvedValue({ data: { courses: [] } });
    mocks.apiPost.mockResolvedValue({ data: {} });
    mocks.saveDraft.mockResolvedValue({
      draftId: "draft-final",
      syncStatus: "SYNCED",
    });
    mocks.clearDraft.mockResolvedValue(undefined);
    mocks.clearLocalDraft.mockResolvedValue(undefined);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("tracks browser offline and online transitions in the save indicator", async () => {
    acceptConsentBeforeRender();
    renderEditor();

    fireEvent(window, new Event("offline"));
    await waitFor(() => {
      expect(screen.getAllByText("Saved locally").length).toBeGreaterThan(0);
    });

    fireEvent(window, new Event("online"));
    await waitFor(() => {
      expect(screen.getAllByText("Saved").length).toBeGreaterThan(0);
    });
  });

  it("truncates oversized change input and rejects orphan capture evidence", () => {
    acceptConsentBeforeRender();
    renderEditor();

    const oversized = "x".repeat(MAX_EDITOR_TEXT_LENGTH + 7);
    fireEvent.change(screen.getByLabelText("Writing workspace"), {
      target: { value: oversized },
    });

    expect(mocks.rejectPendingInput).toHaveBeenCalledTimes(1);
    expect(mocks.recordTextChange).toHaveBeenCalledWith(
      "x".repeat(MAX_EDITOR_TEXT_LENGTH),
      { inputType: "historyBlockedInput" },
    );
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "warning",
        title: "Document limit reached",
      }),
    );
  });

  it("implements Tab insertion as four captured spaces at the current selection", () => {
    acceptConsentBeforeRender();
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }),
    );
    renderEditor();

    const workspace = screen.getByLabelText("Writing workspace") as HTMLTextAreaElement;
    fireEvent.change(workspace, { target: { value: "ab" } });
    workspace.setSelectionRange(1, 1);
    mocks.recordTextChange.mockClear();

    fireEvent.keyDown(workspace, { key: "Tab", code: "Tab" });

    expect(mocks.baseHandleKeyDown).toHaveBeenCalledTimes(1);
    expect(mocks.recordTextChange).toHaveBeenCalledWith("a    b", {
      inputType: "insertText",
    });
    expect(workspace).toHaveValue("a    b");
  });

  it("blocks a keyboard insertion that would exceed the document limit", () => {
    acceptConsentBeforeRender();
    renderEditor();

    const workspace = screen.getByLabelText("Writing workspace") as HTMLTextAreaElement;
    fireEvent.change(workspace, {
      target: { value: "x".repeat(MAX_EDITOR_TEXT_LENGTH) },
    });
    workspace.setSelectionRange(MAX_EDITOR_TEXT_LENGTH, MAX_EDITOR_TEXT_LENGTH);
    mocks.baseHandleKeyDown.mockClear();
    mocks.showToast.mockClear();

    fireEvent.keyDown(workspace, { key: "a", code: "KeyA" });

    expect(mocks.baseHandleKeyDown).not.toHaveBeenCalled();
    expect(mocks.showToast).toHaveBeenCalledWith({
      type: "warning",
      title: "Document limit reached",
      message: "Cannot insert more characters into this session.",
    });
  });

  it("records a valid paste but blocks a paste that would overflow the document", () => {
    acceptConsentBeforeRender();
    renderEditor();

    const workspace = screen.getByLabelText("Writing workspace") as HTMLTextAreaElement;
    fireEvent.paste(workspace, {
      clipboardData: { getData: () => "short paste" },
    });
    expect(mocks.baseHandlePaste).toHaveBeenCalledTimes(1);

    fireEvent.change(workspace, {
      target: { value: "x".repeat(MAX_EDITOR_TEXT_LENGTH - 1) },
    });
    workspace.setSelectionRange(MAX_EDITOR_TEXT_LENGTH - 1, MAX_EDITOR_TEXT_LENGTH - 1);
    mocks.baseHandlePaste.mockClear();
    mocks.showToast.mockClear();

    fireEvent.paste(workspace, {
      clipboardData: {
        getData: () => "z".repeat(Math.min(3, MAX_PASTE_LENGTH)),
      },
    });

    expect(mocks.baseHandlePaste).not.toHaveBeenCalled();
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "warning",
        title: "Document limit reached",
      }),
    );
  });

  it("autosaves an active draft and exposes pending synchronization as local-safe state", async () => {
    acceptConsentBeforeRender();
    vi.useFakeTimers();
    mocks.saveDraft.mockResolvedValue({
      draftId: "draft-local-autosave",
      syncStatus: "PENDING_SYNC",
    });
    renderEditor();

    fireEvent.change(screen.getByLabelText("Document title"), {
      target: { value: "Autosave title" },
    });
    fireEvent.change(screen.getByLabelText("Writing workspace"), {
      target: { value: "Autosave body" },
    });

    await act(async () => {
      vi.advanceTimersByTime(360);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Autosave title",
        text: "Autosave body",
      }),
      { saveReason: "autosave" },
    );
    expect(screen.getAllByText("Saved locally").length).toBeGreaterThan(0);
  });

  it("reports one controlled autosave failure and leaves the editor unsaved", async () => {
    acceptConsentBeforeRender();
    vi.useFakeTimers();
    mocks.saveDraft.mockRejectedValue(new Error("autosave unavailable"));
    renderEditor();

    fireEvent.change(screen.getByLabelText("Writing workspace"), {
      target: { value: "Autosave failure body" },
    });

    await act(async () => {
      vi.advanceTimersByTime(360);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.showToast).toHaveBeenCalledWith({
      type: "error",
      title: "Autosave failed",
      message: "Controlled editor error.",
    });
    expect(screen.getAllByText("Unsaved").length).toBeGreaterThan(0);
  });

  it("persists a recovery snapshot on page hide and hidden visibility", async () => {
    acceptConsentBeforeRender();
    renderEditor();

    fireEvent.change(screen.getByLabelText("Writing workspace"), {
      target: { value: "Crash-safe evidence" },
    });

    window.dispatchEvent(new Event("pagehide"));
    await waitFor(() => {
      expect(mocks.saveDraft).toHaveBeenCalledWith(
        expect.objectContaining({ text: "Crash-safe evidence" }),
        { saveReason: "recovery" },
      );
    });

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => {
      const recoveryCalls = mocks.saveDraft.mock.calls.filter(
        ([, options]) => options?.saveReason === "recovery",
      );
      expect(recoveryCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("protects an active typed draft with the beforeunload contract", async () => {
    acceptConsentBeforeRender();
    mocks.liveStats.keystrokes = 1;
    renderEditor();

    fireEvent.change(screen.getByLabelText("Writing workspace"), {
      target: { value: "Unsaved typed work" },
    });

    const event = new Event("beforeunload", { cancelable: true });
    const dispatchResult = window.dispatchEvent(event);

    expect(dispatchResult).toBe(false);
    expect(event.defaultPrevented).toBe(true);
  });

  it("allows the first-run consent dialog to return to the dashboard", () => {
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Back to dashboard" }));

    expect(mocks.navigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    expect(
      window.localStorage.getItem("typetrace.editorEvidenceConsent.v1"),
    ).toBeNull();
  });

  it("switches course selection back to personal and cancels the analysis modal", async () => {
    acceptConsentBeforeRender();
    configureReadyCapture();
    mocks.apiGet.mockResolvedValue({
      data: {
        courses: [
          { id: 7, course_name: "Advanced Security", course_code: "SEC407" },
        ],
      },
    });
    renderEditor();
    await openAnalysis();

    fireEvent.click(await screen.findByRole("button", { name: /Advanced Security/ }));
    fireEvent.click(screen.getByRole("button", { name: /Personal session/ }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(
      screen.queryByRole("heading", {
        name: "Where does this session belong?",
      }),
    ).not.toBeInTheDocument();
  });

  it("renders high-risk kill-switch evidence and executes replay, verify, and close actions", async () => {
    acceptConsentBeforeRender();
    configureReadyCapture();
    mocks.apiPost.mockResolvedValue({
      data: {
        session_id: 601,
        certificate_id: "TT-CERT-601",
        document_hash: "f".repeat(64),
        classification: "SYNTHETIC",
        confidence_score: 18,
        risk_level: "HIGH",
        risk_score: 82,
        kill_switch_triggered: true,
        kill_switch_reason: "Dominant paste evidence requires manual review.",
        decision_source: "MODEL_FUSION",
        model_available: true,
        degraded_analysis: false,
        stats: { ...mocks.liveStats },
        advanced_stats: {
          paste_count: 2,
          risk_signals: [],
          human_signals: [],
        },
      },
    });
    renderEditor();
    await openAnalysis();
    fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));

    expect(
      await screen.findByRole("dialog", { name: "Behavioral analysis result" }),
    ).toBeVisible();
    expect(screen.getByText("High Risk")).toBeVisible();
    expect(
      screen.getByText("Dominant paste evidence requires manual review."),
    ).toBeVisible();
    expect(
      screen.getByText(/No explicit human-supporting signals/),
    ).toBeVisible();
    expect(screen.getByText(/No major review-risk signals/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "View replay audit" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/session/601/replay");

    fireEvent.click(screen.getByRole("button", { name: "Verify certificate" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/verify/TT-CERT-601");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(mocks.resetCapture).toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith("/dashboard", { replace: true });
  });
});
