import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EditorPage from "../pages/EditorPage";
import { API_ROUTES } from "../constants/apiRoutes";
import { MINIMUM_KEYSTROKES } from "../lib/edgeCases";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setSearchParams: vi.fn(),
  search: "",
  showToast: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  getApiErrorMessage: vi.fn(() => "Controlled service error."),
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
      id: "student-1",
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
    getCaptureSnapshot: vi.fn(() => ({
      events: mocks.captureEvents,
      startedAt: 1_000,
      lastActivityAt: 2_000,
      lastKeyDownTimestamp: 1_900,
      activeDurationMs: 1_000,
      pausedAt: null,
    })),
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

function configureReadyCapture() {
  Object.assign(mocks.liveStats, {
    keystrokes: MINIMUM_KEYSTROKES + 4,
    deletions: 2,
    deletedCharacters: 3,
    bulkDeletionEvents: 1,
    largestDeletionChars: 2,
    selectionDeletionEvents: 1,
    wordDeletionEvents: 0,
    cutEvents: 0,
    pauses: 2,
    wpm: 38,
    avgIki: 205,
    sessionSeconds: 70,
  });
  mocks.captureEvents = Array.from(
    { length: MINIMUM_KEYSTROKES + 4 },
    (_, index) => ({
      type: "keydown",
      key: String.fromCharCode(97 + (index % 20)),
      timestamp: 1_000 + index * 90,
    }),
  );
  mocks.getStats.mockImplementation(() => ({ ...mocks.liveStats }));
}

async function openAnalysis() {
  fireEvent.change(screen.getByLabelText("Document title"), {
    target: { value: "Failure-mode evidence" },
  });
  fireEvent.change(screen.getByLabelText("Writing workspace"), {
    target: { value: "A captured session with enough behavioral evidence." },
  });
  fireEvent.click(screen.getByRole("button", { name: /Analyze session/ }));
  await screen.findByRole("heading", {
    name: "Where does this session belong?",
  });
}

function completeAnalysisResponse() {
  return {
    data: {
      session_id: 401,
      certificate_id: "TT-CERT-401",
      document_hash: "c".repeat(64),
      classification: "HUMAN",
      confidence_score: 91,
      risk_level: "LOW",
      risk_score: 9,
      decision_source: "MODEL_FUSION",
      model_available: true,
      degraded_analysis: false,
      stats: { ...mocks.liveStats },
      advanced_stats: { risk_signals: [], human_signals: ["Natural timing"] },
    },
  };
}

describe("EditorPage failure-mode coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem(
      "typetrace.editorEvidenceConsent.v1",
      "accepted",
    );
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
    mocks.apiGet.mockResolvedValue({ data: { courses: [] } });
    mocks.saveDraft.mockResolvedValue({
      draftId: "draft-failure-modes",
      syncStatus: "SYNCED",
    });
    mocks.clearDraft.mockResolvedValue(undefined);
    mocks.clearLocalDraft.mockResolvedValue(undefined);
    mocks.apiPost.mockResolvedValue(completeAnalysisResponse());
    mocks.getApiErrorMessage.mockReturnValue("Controlled service error.");
  });

  it("discards a recovered draft from browser/server state", async () => {
    mocks.recoveredDraft = {
      draftId: "recover-discard",
      title: "Discard me",
      text: "Temporary evidence",
      selectedCourseId: null,
      keystrokeLog: [{ type: "keydown", key: "a" }],
      startedAt: 100,
      lastActivityAt: 200,
      lastKeyDownTimestamp: 190,
      activeDurationMs: 100,
      pausedAt: 200,
      savedAt: Date.now(),
      saveReason: "recovery",
    };

    renderEditor();
    fireEvent.click(
      await screen.findByRole(
        "button",
        { name: "Discard local draft" },
        { timeout: 5_000 },
      ),
    );

    await waitFor(() => {
      expect(mocks.clearDraft).toHaveBeenCalledWith("recover-discard");
    });
    expect(mocks.dismissRecoveredDraft).toHaveBeenCalled();
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "info", title: "Draft discarded" }),
    );
  }, 15_000);

  it("keeps recovery available when draft deletion fails", async () => {
    mocks.recoveredDraft = {
      draftId: "recover-failed-delete",
      title: "Keep me",
      text: "Still needed",
      selectedCourseId: null,
      keystrokeLog: [],
      startedAt: 100,
      lastActivityAt: 200,
      lastKeyDownTimestamp: null,
      activeDurationMs: 100,
      pausedAt: 200,
      savedAt: Date.now(),
      saveReason: "recovery",
    };
    mocks.clearDraft.mockRejectedValue(new Error("delete failed"));

    renderEditor();
    fireEvent.click(
      await screen.findByRole(
        "button",
        { name: "Discard local draft" },
        { timeout: 5_000 },
      ),
    );

    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith({
        type: "error",
        title: "Draft deletion failed",
        message: "Controlled service error.",
      });
    });
    expect(mocks.dismissRecoveredDraft).not.toHaveBeenCalled();
  }, 15_000);

  it("reports a locally saved manual draft when synchronization is pending", async () => {
    mocks.saveDraft.mockResolvedValue({
      draftId: "draft-local",
      syncStatus: "PENDING_SYNC",
    });
    renderEditor();

    fireEvent.change(screen.getByLabelText("Writing workspace"), {
      target: { value: "Keep this draft locally" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save draft/ }));

    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "warning",
          title: "Draft saved locally",
        }),
      );
    });
    expect(mocks.navigate).toHaveBeenCalledWith("/dashboard", { replace: true });
  });

  it("reports durable-save failure and does not navigate away", async () => {
    mocks.saveDraft.mockRejectedValue(new Error("quota"));
    renderEditor();

    fireEvent.change(screen.getByLabelText("Writing workspace"), {
      target: { value: "Do not lose this text" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save draft/ }));

    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error", title: "Draft save failed" }),
      );
    });
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("blocks analysis when the latest draft returns a version conflict", async () => {
    configureReadyCapture();
    mocks.saveDraft.mockResolvedValue({
      draftId: "draft-conflict",
      syncStatus: "CONFLICT",
    });
    renderEditor();
    await openAnalysis();
    fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));

    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Draft synchronization required",
          message: expect.stringMatching(/newer draft version/i),
        }),
      );
    });
    expect(mocks.apiPost).not.toHaveBeenCalled();
  });

  it("rejects an incomplete analysis response without inventing a result", async () => {
    configureReadyCapture();
    mocks.apiPost.mockResolvedValue({
      data: {
        session_id: 402,
        classification: "HUMAN",
        document_hash: "d".repeat(64),
      },
    });
    renderEditor();
    await openAnalysis();
    fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));

    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Incomplete analysis response",
        }),
      );
    });
    expect(
      screen.queryByRole("dialog", { name: "Behavioral analysis result" }),
    ).not.toBeInTheDocument();
  });

  it("surfaces analysis transport failures and leaves the session retryable", async () => {
    configureReadyCapture();
    mocks.apiPost.mockRejectedValue(new Error("analysis offline"));
    renderEditor();
    await openAnalysis();
    fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));

    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith({
        type: "error",
        title: "Analysis failed",
        message: "Controlled service error.",
      });
    });
    expect(screen.getByRole("button", { name: "Run analysis" })).toBeEnabled();
  });

  it("keeps a completed result when local draft cleanup fails", async () => {
    configureReadyCapture();
    mocks.clearLocalDraft.mockRejectedValue(new Error("browser cleanup"));
    renderEditor();
    await openAnalysis();
    fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));

    expect(
      await screen.findByRole("dialog", { name: "Behavioral analysis result" }),
    ).toBeVisible();
    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith({
        type: "warning",
        title: "Local cleanup incomplete",
        message: "Controlled service error.",
      });
    });
    expect(mocks.apiPost).toHaveBeenCalledWith(
      API_ROUTES.sessions.analyze,
      expect.objectContaining({ draft_id: "draft-failure-modes" }),
    );
  });

  it("starts a clean evidence session from the completed-result action", async () => {
    configureReadyCapture();
    renderEditor();
    await openAnalysis();
    fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));

    fireEvent.click(
      await screen.findByRole("button", { name: "Start new session" }),
    );

    expect(mocks.resetCapture).toHaveBeenCalledTimes(1);
    expect(mocks.setSearchParams).toHaveBeenCalledWith({}, { replace: true });
    expect(screen.getByLabelText("Writing workspace")).toHaveValue("");
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "info", title: "New session started" }),
    );
  });
});
