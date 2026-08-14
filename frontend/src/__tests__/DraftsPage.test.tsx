import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DraftsPage from "../pages/DraftsPage";
import type { EditorDraftSnapshot } from "../lib/editorDraftStore";

const mocks = vi.hoisted(() => ({
  listEditorDrafts: vi.fn(),
  deleteEditorDraftByKey: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../store/authStore", () => ({
  useAuthStore: () => ({
    user: {
      id: "student-1",
      email: "student@example.test",
      role: "STUDENT",
    },
  }),
}));

vi.mock("../components/ui/ToastContext", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock("../lib/editorDraftStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/editorDraftStore")>();
  return {
    ...actual,
    listEditorDrafts: mocks.listEditorDrafts,
    deleteEditorDraftByKey: mocks.deleteEditorDraftByKey,
  };
});

function event(type: "keydown" | "paste") {
  return {
    type,
    key: type === "paste" ? "__PASTE_EVENT__" : "a",
  } as EditorDraftSnapshot["keystrokeLog"][number];
}

function draft(
  overrides: Partial<EditorDraftSnapshot> = {},
): EditorDraftSnapshot {
  const now = Date.parse("2026-08-13T10:00:00.000Z");
  return {
    version: 3,
    draftKey: "editor:student-1:draft-alpha",
    draftId: "draft-alpha",
    userId: "student-1",
    title: "Evidence essay",
    text: "one two three four five",
    selectedCourseId: 9,
    keystrokeLog: Array.from({ length: 45 }, () => event("keydown")),
    startedAt: now - 120_000,
    lastActivityAt: now,
    lastKeyDownTimestamp: now,
    activeDurationMs: 120_000,
    pausedAt: now,
    createdAt: now - 300_000,
    savedAt: now,
    saveReason: "autosave",
    backendDraftId: "server-draft-1",
    serverVersion: 3,
    syncStatus: "SYNCED",
    lifecycleStatus: "PAUSED",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <DraftsPage />
    </MemoryRouter>,
  );
}

describe("DraftsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deleteEditorDraftByKey.mockResolvedValue(undefined);
  });

  it("loads the signed-in student's drafts and renders the empty workspace", async () => {
    mocks.listEditorDrafts.mockResolvedValue([]);

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "No saved drafts yet" }),
    ).toBeVisible();
    expect(mocks.listEditorDrafts).toHaveBeenCalledWith("student-1");
    expect(screen.getByRole("link", { name: "Start writing" })).toHaveAttribute(
      "href",
      "/editor/new",
    );
  });

  it("summarizes ready and in-progress drafts and preserves resume identifiers", async () => {
    mocks.listEditorDrafts.mockResolvedValue([
      draft(),
      draft({
        draftKey: "editor:student-1:draft-beta",
        draftId: "draft beta",
        title: "Early outline",
        text: "outline notes",
        keystrokeLog: [event("keydown")],
        syncStatus: "LOCAL_ONLY",
        savedAt: Date.parse("2026-08-13T09:00:00.000Z"),
      }),
    ]);

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Saved Drafts" }),
    ).toBeVisible();
    expect(screen.getAllByText("Evidence essay").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Early outline").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ready to analyze").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Still drafting").length).toBeGreaterThan(0);

    const resumeLinks = screen.getAllByRole("link", { name: /Resume/ });
    expect(
      resumeLinks.some(
        (link) => link.getAttribute("href") === "/editor/new?draftId=draft%20beta",
      ),
    ).toBe(true);
  });

  it("filters drafts by search and restores the ledger when the query is cleared", async () => {
    mocks.listEditorDrafts.mockResolvedValue([
      draft({ title: "Climate evidence", text: "climate research notes" }),
      draft({
        draftKey: "editor:student-1:draft-history",
        draftId: "draft-history",
        title: "History reflection",
        text: "historical analysis",
      }),
    ]);

    renderPage();
    await screen.findAllByText("Climate evidence");

    const search = screen.getByPlaceholderText("Search drafts");
    fireEvent.change(search, { target: { value: "history" } });

    expect(screen.queryByText("Climate evidence")).not.toBeInTheDocument();
    expect(screen.getAllByText("History reflection").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getAllByText("Climate evidence").length).toBeGreaterThan(0);
  });

  it("deletes a saved draft, removes it from the ledger, and reports the action", async () => {
    const savedDraft = draft();
    mocks.listEditorDrafts.mockResolvedValue([savedDraft]);

    renderPage();
    await screen.findAllByText("Evidence essay");

    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() =>
      expect(mocks.deleteEditorDraftByKey).toHaveBeenCalledWith(
        savedDraft.draftKey,
      ),
    );
    await waitFor(() =>
      expect(screen.queryByText("Evidence essay")).not.toBeInTheDocument(),
    );
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "info",
        title: "Draft deleted",
      }),
    );
  });
});
