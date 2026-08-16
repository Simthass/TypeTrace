import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ReplayPage from "../pages/ReplayPage";
import { api } from "../lib/api";
import type { ReplayResponse } from "../types/replay";

const replayResponse: ReplayResponse = {
  status: "success",
  session: {
    id: 157,
    title: "Replay contract",
    classification: "HUMAN",
    classification_bucket: "HUMAN",
    confidence: 91,
    risk_level: "LOW",
    duration_ms: 3000,
    duration_seconds: 3,
    word_count: 1,
    student_name: "Replay Student",
    student_id: "ST-1",
    student_email: "student@example.test",
    course_id: 9,
    course_name: "Evidence Systems",
    course_code: "ES101",
    certificate_id: "TT-CONTRACT-001",
    document_hash: "a".repeat(64),
    review_status: "APPROVED",
    review_notes: "Reviewed",
    created_at: "2026-08-13 09:00 UTC",
  },
  metrics: {
    avg_iki: 120,
    dwell_time: 80,
    deletion_ratio: 0,
    deleted_characters: 0,
    deleted_character_ratio: 0,
    bulk_deletion_events: 0,
    largest_deletion_chars: 0,
    paste_count: 0,
    paste_ratio: 0,
    longest_pause_ms: 120,
    burst_count: 0,
    wpm: 41.2,
    active_time_pct: 100,
    pause_count: 0,
    cognitive_pause_count: 0,
    pause_density: 0,
    total_events: 3,
    keydown_events: 3,
    deletion_count: 0,
    mean_flight_ms: 120,
    mean_dwell_ms: 80,
  },
  events: [
    {
      event_index: 0,
      key: "a",
      display_key: "a",
      keyCode: 65,
      code: "KeyA",
      type: "keydown",
      timestamp: 1000,
      relative_time_ms: 0,
      down_time: null,
      up_time: null,
      dwell_time: 80,
      flight_time: 120,
      documentLength: 1,
      cursorPosition: 1,
      pastedLength: 0,
      deletedCharacters: 0,
      chars_deleted: 0,
      selection_length_before: 0,
      is_bulk_deletion: false,
      documentLengthBefore: 0,
      documentLengthAfter: 1,
      deltaLength: 1,
      insertedCharacters: 1,
      inserted_text: "a",
      is_paste: false,
      is_deletion: false,
      is_enter: false,
      is_space: false,
      is_pause: false,
      is_cognitive_pause: false,
    },
    {
      event_index: 1,
      key: "b",
      display_key: "b",
      keyCode: 66,
      code: "KeyB",
      type: "keydown",
      timestamp: 1120,
      relative_time_ms: 120,
      down_time: null,
      up_time: null,
      dwell_time: 80,
      flight_time: 120,
      documentLength: 2,
      cursorPosition: 2,
      pastedLength: 0,
      deletedCharacters: 0,
      chars_deleted: 0,
      selection_length_before: 0,
      is_bulk_deletion: false,
      documentLengthBefore: 1,
      documentLengthAfter: 2,
      deltaLength: 1,
      insertedCharacters: 1,
      inserted_text: "b",
      is_paste: false,
      is_deletion: false,
      is_enter: false,
      is_space: false,
      is_pause: false,
      is_cognitive_pause: false,
    },
    {
      event_index: 2,
      key: "c",
      display_key: "c",
      keyCode: 67,
      code: "KeyC",
      type: "keydown",
      timestamp: 1240,
      relative_time_ms: 240,
      down_time: null,
      up_time: null,
      dwell_time: 80,
      flight_time: 120,
      documentLength: 3,
      cursorPosition: 3,
      pastedLength: 0,
      deletedCharacters: 0,
      chars_deleted: 0,
      selection_length_before: 0,
      is_bulk_deletion: false,
      documentLengthBefore: 2,
      documentLengthAfter: 3,
      deltaLength: 1,
      insertedCharacters: 1,
      inserted_text: "c",
      is_paste: false,
      is_deletion: false,
      is_enter: false,
      is_space: false,
      is_pause: false,
      is_cognitive_pause: false,
    },
  ],
  timeline_markers: [],
  audit: {
    total_raw_events: 4,
    total_normalized_events: 3,
    has_paste_events: false,
    has_cognitive_pauses: false,
    has_deletions: false,
    integrity_hash: "a".repeat(64),
    is_truncated: true,
    max_events_returned: 3,
  },
};

function renderReplay(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/session/:sessionId/replay" element={<ReplayPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ReplayPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fails closed for malformed session identifiers without calling the API", async () => {
    const get = vi.spyOn(api, "get");

    renderReplay("/session/not-a-number/replay");

    expect(await screen.findByRole("heading", { name: "Replay unavailable" })).toBeVisible();
    expect(screen.getByText("Replay session ID is invalid.")).toBeVisible();
    expect(get).not.toHaveBeenCalled();
  });

  it("loads the replay contract and surfaces truncation and certificate context", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: replayResponse });

    renderReplay("/session/157/replay");

    expect(
      await screen.findByRole("heading", { name: "Replay Audit: Replay contract" }),
    ).toBeVisible();
    expect(get).toHaveBeenCalledWith("/sessions/157/replay");
    expect(screen.getByText("Human", { exact: true })).toBeVisible();
    expect(screen.getByText("Replay truncated for performance")).toBeVisible();
    expect(screen.getByRole("link", { name: "Verify Certificate" })).toHaveAttribute(
      "href",
      "/verify/TT-CONTRACT-001",
    );
    expect(screen.getByRole("button", { name: "Play" })).toBeEnabled();
  });

  it("renders a controlled error when replay retrieval fails", async () => {
    vi.spyOn(api, "get").mockRejectedValue(new Error("backend unavailable"));

    renderReplay("/session/157/replay");

    expect(await screen.findByRole("heading", { name: "Replay unavailable" })).toBeVisible();
    expect(screen.getByText("Something went wrong. Please try again.")).toBeVisible();
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  });

  it("switches to the event stream, seeks with transport controls, and restarts", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: replayResponse });
    renderReplay("/session/157/replay");

    await screen.findByRole("heading", { name: "Replay Audit: Replay contract" });
    fireEvent.click(screen.getByRole("button", { name: "Event Stream" }));
    expect(screen.getByText("keydown", { exact: true })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Forward 5 seconds" }));
    expect(screen.getByText("c", { exact: true })).toBeVisible();
    expect(screen.getByText(/0:03 \/ 0:03/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(screen.getByText(/0:00 \/ 0:03/)).toBeVisible();
  });

  it("changes playback speed and automatically stops at the end of the replay", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: replayResponse });
    renderReplay("/session/157/replay");
    await screen.findByRole("heading", { name: "Replay Audit: Replay contract" });

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "4x" }));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();

    act(() => {
      vi.advanceTimersByTime(800);
    });

    expect(screen.getByRole("button", { name: "Play" })).toBeEnabled();
    expect(screen.getByText(/0:03 \/ 0:03/)).toBeVisible();
  });

  it("supports keyboard seek shortcuts while leaving modified shortcuts alone", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: replayResponse });
    renderReplay("/session/157/replay");
    await screen.findByRole("heading", { name: "Replay Audit: Replay contract" });

    fireEvent.keyDown(window, { key: "End", code: "End" });
    await waitFor(() => {
      expect(screen.getByText(/0:03 \/ 0:03/)).toBeVisible();
    });

    fireEvent.keyDown(window, { key: "Home", code: "Home" });
    await waitFor(() => {
      expect(screen.getByText(/0:00 \/ 0:03/)).toBeVisible();
    });

    fireEvent.keyDown(window, { key: "ArrowRight", code: "ArrowRight" });
    await waitFor(() => {
      expect(screen.getByText(/0:03 \/ 0:03/)).toBeVisible();
    });

    fireEvent.keyDown(window, { key: "Home", code: "Home", ctrlKey: true });
    await waitFor(() => {
      expect(screen.getByText(/0:03 \/ 0:03/)).toBeVisible();
    });
  });

  it("seeks from the scrub bar and from timeline marker controls", async () => {
    const withMarker: ReplayResponse = {
      ...replayResponse,
      timeline_markers: [
        {
          type: "pause",
          event_index: 2,
          relative_time_ms: 2_000,
          label: "Long pause",
          key: "Pause",
        },
      ],
    };
    vi.spyOn(api, "get").mockResolvedValue({ data: withMarker });
    renderReplay("/session/157/replay");
    await screen.findByRole("heading", { name: "Replay Audit: Replay contract" });

    fireEvent.click(screen.getByRole("button", { name: /Long pause/ }));
    expect(screen.getByText(/0:02 \/ 0:03/)).toBeVisible();

    const scrub = screen.getByTitle(/Pause: Long pause at/).closest("div.relative") as HTMLDivElement;
    Object.defineProperty(scrub, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 0,
        right: 100,
        width: 100,
        top: 0,
        bottom: 10,
        height: 10,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });
    fireEvent.click(scrub, { clientX: 50 });
    expect(screen.getByText(/0:01 \/ 0:03/)).toBeVisible();
  });

  it("surfaces reconstruction-integrity mismatches instead of presenting them as exact", async () => {
    const inconsistent: ReplayResponse = {
      ...replayResponse,
      events: replayResponse.events.map((event, index) =>
        index === replayResponse.events.length - 1
          ? { ...event, documentLength: 99, documentLengthAfter: 99 }
          : event,
      ),
    };
    vi.spyOn(api, "get").mockResolvedValue({ data: inconsistent });
    renderReplay("/session/157/replay");

    expect(
      await screen.findByText("Reconstruction may be incomplete"),
    ).toBeVisible();
    expect(screen.getByText(/supporting evidence only/)).toBeVisible();
  });

  it("shows a non-playable state when the authorized replay contains no events", async () => {
    const emptyReplay: ReplayResponse = {
      ...replayResponse,
      events: [],
      timeline_markers: [],
      audit: {
        ...replayResponse.audit,
        total_raw_events: 0,
        total_normalized_events: 0,
        is_truncated: false,
        max_events_returned: 0,
      },
    };
    vi.spyOn(api, "get").mockResolvedValue({ data: emptyReplay });
    renderReplay("/session/157/replay");

    expect(
      await screen.findByText("No replayable keystroke events"),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("button", { name: "Play" })).toBeEnabled();
    expect(screen.getByText("No paste, deletion, or pause markers detected.")).toBeVisible();
  });

});
