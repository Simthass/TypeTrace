import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EditorPage from "../pages/EditorPage";
import { API_ROUTES } from "../constants/apiRoutes";
import {
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
  getApiErrorMessage: vi.fn(() => "Service unavailable."),
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
  captureSnapshot: {
    startedAt: 1000,
    lastActivityAt: 2000,
    lastKeyDownTimestamp: 1900,
    activeDurationMs: 1000,
    pausedAt: null as number | null,
  },
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
    getCaptureSnapshot: vi.fn((options?: { pause?: boolean }) => ({
      events: mocks.captureEvents,
      ...mocks.captureSnapshot,
      pausedAt: options?.pause ? 2000 : mocks.captureSnapshot.pausedAt,
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
  mocks.liveStats.keystrokes = MINIMUM_KEYSTROKES + 8;
  mocks.liveStats.deletions = 4;
  mocks.liveStats.pauses = 3;
  mocks.liveStats.wpm = 42;
  mocks.liveStats.avgIki = 185;
  mocks.liveStats.sessionSeconds = 75;
  mocks.captureEvents = Array.from({ length: MINIMUM_KEYSTROKES + 8 }, (_, index) => ({
    type: "keydown",
    key: String.fromCharCode(97 + (index % 20)),
    timestamp: 1000 + index * 80,
  }));
  mocks.getStats.mockReturnValue({
    ...mocks.liveStats,
  });
}

describe("EditorPage high-yield workflow coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.search = "";
    mocks.hasCheckedDraft = true;
    mocks.recoveredDraft = null;
    mocks.liveStats.keystrokes = 0;
    mocks.liveStats.deletions = 0;
    mocks.liveStats.deletedCharacters = 0;
    mocks.liveStats.bulkDeletionEvents = 0;
    mocks.liveStats.largestDeletionChars = 0;
    mocks.liveStats.selectionDeletionEvents = 0;
    mocks.liveStats.wordDeletionEvents = 0;
    mocks.liveStats.cutEvents = 0;
    mocks.liveStats.pauses = 0;
    mocks.liveStats.wpm = 0;
    mocks.liveStats.avgIki = 0;
    mocks.liveStats.sessionSeconds = 0;
    mocks.captureEvents = [];
    mocks.getStats.mockReturnValue({ ...mocks.liveStats });
    mocks.apiGet.mockResolvedValue({ data: { courses: [] } });
    mocks.saveDraft.mockResolvedValue({
      draftId: "draft-1",
      syncStatus: "SYNCED",
    });
    mocks.clearDraft.mockResolvedValue(undefined);
    mocks.clearLocalDraft.mockResolvedValue(undefined);
  });

  it("enforces first-run evidence consent before draft recovery and records acceptance", async () => {
    mocks.recoveredDraft = {
      draftId: "recover-1",
      title: "Recovered work",
      text: "Recovered text",
      selectedCourseId: null,
      keystrokeLog: [{ type: "keydown", key: "R" }],
      startedAt: 100,
      lastActivityAt: 200,
      lastKeyDownTimestamp: 190,
      activeDurationMs: 100,
      pausedAt: 200,
      savedAt: Date.now(),
      saveReason: "recovery",
    };

    renderEditor();

    const consent = screen.getByRole("dialog", {
      name: "TypeTrace writing evidence consent",
    });
    expect(consent).toBeVisible();
    expect(
      screen.queryByRole("dialog", {
        name: "Continue your previous unfinished session?",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "I understand, start capturing",
      }),
    );

    expect(window.localStorage.getItem("typetrace.editorEvidenceConsent.v1")).toBe(
      "accepted",
    );
    expect(mocks.showToast).toHaveBeenCalledWith({
      type: "success",
      title: "Evidence capture enabled",
      message:
        "TypeTrace will now capture writing-process signals for this editor session.",
    });

    expect(
      await screen.findByRole("dialog", {
        name: "Continue your previous unfinished session?",
      }),
    ).toBeVisible();
  });

  it("restores an unfinished draft and rebinds its captured evidence", async () => {
    window.localStorage.setItem("typetrace.editorEvidenceConsent.v1", "accepted");
    mocks.recoveredDraft = {
      draftId: "recover-2",
      title: "Recovered essay",
      text: "Recovered body text",
      selectedCourseId: 5,
      keystrokeLog: [{ type: "keydown", key: "a" }],
      startedAt: 100,
      lastActivityAt: 300,
      lastKeyDownTimestamp: 290,
      activeDurationMs: 200,
      pausedAt: 300,
      savedAt: Date.now(),
      saveReason: "autosave",
    };

    renderEditor();

    expect(
      await screen.findByRole("dialog", {
        name: "Continue your previous unfinished session?",
      }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Continue session" }));

    expect(screen.getByLabelText("Document title")).toHaveValue("Recovered essay");
    expect(screen.getByLabelText("Writing workspace")).toHaveValue(
      "Recovered body text",
    );
    expect(mocks.hydrateCapture).toHaveBeenCalledWith(
      expect.objectContaining({ events: mocks.recoveredDraft!.keystrokeLog }),
    );
    expect(mocks.dismissRecoveredDraft).toHaveBeenCalled();
    expect(mocks.setSearchParams).toHaveBeenCalledWith(
      { draftId: "recover-2" },
      { replace: true },
    );
  });

  it("hydrates an explicitly routed draft without opening the recovery prompt", async () => {
    window.localStorage.setItem("typetrace.editorEvidenceConsent.v1", "accepted");
    mocks.search = "draftId=routed-draft";
    mocks.recoveredDraft = {
      draftId: "routed-draft",
      title: "Routed draft",
      text: "Opened directly from Drafts",
      selectedCourseId: null,
      keystrokeLog: [{ type: "keydown", key: "x" }],
      startedAt: 100,
      lastActivityAt: 300,
      lastKeyDownTimestamp: 290,
      activeDurationMs: 200,
      pausedAt: 300,
      savedAt: Date.now(),
      saveReason: "manual",
    };

    renderEditor();

    await waitFor(() => {
      expect(screen.getByLabelText("Document title")).toHaveValue("Routed draft");
    });
    expect(screen.getByLabelText("Writing workspace")).toHaveValue(
      "Opened directly from Drafts",
    );
    expect(
      screen.queryByRole("dialog", {
        name: "Continue your previous unfinished session?",
      }),
    ).not.toBeInTheDocument();
  });

  it("loads enrolled courses and opens the course-linking workflow once evidence is ready", async () => {
    window.localStorage.setItem("typetrace.editorEvidenceConsent.v1", "accepted");
    configureReadyCapture();
    mocks.apiGet.mockResolvedValue({
      data: {
        courses: [
          { id: 5, course_name: "Secure Systems", course_code: "SEC401" },
        ],
      },
    });

    renderEditor();

    fireEvent.change(screen.getByLabelText("Document title"), {
      target: { value: "Evidence essay" },
    });
    fireEvent.change(screen.getByLabelText("Writing workspace"), {
      target: { value: "A sufficiently captured writing session." },
    });

    const analyze = screen.getByRole("button", { name: /Analyze session/ });
    expect(analyze).toBeEnabled();
    fireEvent.click(analyze);

    expect(
      await screen.findByRole("heading", {
        name: "Where does this session belong?",
      }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /Secure Systems/ })).toBeVisible();
    expect(mocks.apiGet).toHaveBeenCalledWith(API_ROUTES.courses.enrolled);
  });

  it("submits synchronized evidence and exposes replay and certificate actions", async () => {
    window.localStorage.setItem("typetrace.editorEvidenceConsent.v1", "accepted");
    configureReadyCapture();
    mocks.apiGet.mockResolvedValue({
      data: {
        courses: [
          { id: 5, course_name: "Secure Systems", course_code: "SEC401" },
        ],
      },
    });
    mocks.apiPost.mockResolvedValue({
      data: {
        session_id: 157,
        certificate_id: "TT-CERT-157",
        document_hash: "a".repeat(64),
        classification: "HUMAN",
        confidence_score: 94,
        risk_level: "LOW",
        risk_score: 6,
        decision_source: "MODEL_FUSION",
        model_available: true,
        degraded_analysis: false,
        stats: { ...mocks.liveStats },
        advanced_stats: {
          paste_count: 0,
          risk_signals: [],
          human_signals: ["Natural timing variation"],
        },
      },
    });

    renderEditor();

    fireEvent.change(screen.getByLabelText("Document title"), {
      target: { value: "  Evidence essay  " },
    });
    fireEvent.change(screen.getByLabelText("Writing workspace"), {
      target: { value: "Human-authored evidence body." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Analyze session/ }));

    const course = await screen.findByRole("button", { name: /Secure Systems/ });
    fireEvent.click(course);
    fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));

    expect(
      await screen.findByRole("dialog", { name: "Behavioral analysis result" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Analysis complete" })).toBeVisible();
    expect(screen.getByText("Human")).toBeVisible();
    expect(screen.getByRole("button", { name: "View replay audit" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Verify certificate" })).toBeVisible();

    expect(mocks.apiPost).toHaveBeenCalledWith(
      API_ROUTES.sessions.analyze,
      expect.objectContaining({
        course_id: 5,
        draft_id: "draft-1",
        submission_id: "draft:draft-1",
        text_content: "Human-authored evidence body.",
      }),
    );
  });

  it("shows degraded-analysis provenance when the trained model is unavailable", async () => {
    window.localStorage.setItem("typetrace.editorEvidenceConsent.v1", "accepted");
    configureReadyCapture();
    mocks.apiPost.mockResolvedValue({
      data: {
        session_id: 158,
        certificate_id: "TT-CERT-158",
        document_hash: "b".repeat(64),
        classification: "SUSPICIOUS",
        confidence_score: 62,
        risk_level: "MEDIUM",
        risk_score: 38,
        decision_source: "FALLBACK_RULES",
        model_available: false,
        degraded_analysis: true,
        stats: { ...mocks.liveStats },
        advanced_stats: {
          risk_signals: ["Fallback review required"],
          human_signals: [],
        },
      },
    });

    renderEditor();
    fireEvent.change(screen.getByLabelText("Writing workspace"), {
      target: { value: "Captured text" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Analyze session/ }));
    await screen.findByRole("heading", { name: "Where does this session belong?" });
    fireEvent.click(screen.getByRole("button", { name: "Run analysis" }));

    expect(await screen.findByText(/Degraded analysis:/)).toBeVisible();
    expect(screen.getByText("Review Required")).toBeVisible();
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "warning",
        title: "Analysis complete in degraded mode",
      }),
    );
  });

  it("saves an active session as a synchronized draft and returns to the dashboard", async () => {
    window.localStorage.setItem("typetrace.editorEvidenceConsent.v1", "accepted");

    renderEditor();
    fireEvent.change(screen.getByLabelText("Document title"), {
      target: { value: "Draft title" },
    });
    fireEvent.change(screen.getByLabelText("Writing workspace"), {
      target: { value: "Draft body" },
    });

    const save = screen.getByRole("button", { name: /Save draft/ });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => {
      expect(mocks.saveDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Draft title",
          text: "Draft body",
        }),
        { saveReason: "manual" },
      );
    });
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", title: "Draft saved" }),
    );
    expect(mocks.navigate).toHaveBeenCalledWith("/dashboard", { replace: true });
  });

  it("blocks oversized paste evidence before it reaches the capture engine", async () => {
    window.localStorage.setItem("typetrace.editorEvidenceConsent.v1", "accepted");
    renderEditor();

    // Let the editor's initial enrolled-course request settle before ending the
    // test so its state update remains inside Testing Library's async act scope.
    await waitFor(() => {
      expect(mocks.apiGet).toHaveBeenCalled();
    });

    const workspace = screen.getByLabelText("Writing workspace");
    fireEvent.paste(workspace, {
      clipboardData: {
        getData: () => "x".repeat(MAX_PASTE_LENGTH + 1),
      },
    });

    expect(mocks.baseHandlePaste).not.toHaveBeenCalled();
    expect(mocks.showToast).toHaveBeenCalledWith({
      type: "warning",
      title: "Large paste blocked",
      message:
        "Very large paste events reduce evidence quality. Type or paste smaller sections.",
    });
  });

  it("surfaces enrolled-course retrieval failures without breaking the editor", async () => {
    window.localStorage.setItem("typetrace.editorEvidenceConsent.v1", "accepted");
    mocks.apiGet.mockRejectedValue(new Error("network down"));

    renderEditor();

    expect(screen.getByLabelText("Writing workspace")).toBeVisible();
    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith({
        type: "warning",
        title: "Courses unavailable",
        message: "Service unavailable.",
      });
    });
  });
});
