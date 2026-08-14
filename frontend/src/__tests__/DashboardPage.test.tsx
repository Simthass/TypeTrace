import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "../pages/DashboardPage";
import { API_ROUTES } from "../constants/apiRoutes";
import { api, getApiErrorMessage } from "../lib/api";

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../components/ui/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      get: vi.fn(),
    },
    getApiErrorMessage: vi.fn(),
  };
});

vi.mock("recharts", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Chart = ({ children }: { children?: ReactNode }) => <svg>{children}</svg>;
  return {
    ResponsiveContainer: Container,
    AreaChart: Chart,
    BarChart: Chart,
    ComposedChart: Chart,
    PieChart: Chart,
    Area: () => null,
    Bar: () => null,
    CartesianGrid: () => null,
    Cell: () => null,
    Line: () => null,
    Pie: () => null,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
  };
});

const dashboard = {
  status: "ok",
  summary: {
    total_sessions: 4,
    avg_wpm: 44,
    avg_confidence: 86,
    total_seconds: 1240,
    total_keystrokes: 4800,
    total_deletions: 120,
    total_pauses: 46,
    certificate_count: 2,
    human_sessions: 3,
    suspicious_sessions: 1,
    synthetic_sessions: 0,
    approved_count: 2,
    flagged_count: 1,
    pending_count: 1,
  },
  recent_sessions: [
    {
      id: 157,
      title: "Human Authorship Essay",
      classification: "HUMAN",
      classification_bucket: "HUMAN",
      confidence: 94,
      risk_level: "LOW",
      review_status: "APPROVED",
      wpm: 46,
      duration_seconds: 185,
      word_count: 86,
      total_keystrokes: 612,
      deletions: 21,
      pauses: 14,
      avg_iki: 178,
      certificate_id: "TT-CERT-157",
      course_name: "Secure Systems",
      course_code: "SEC401",
      created_at: "2026-08-13T08:30:00Z",
    },
  ],
  trend: [
    {
      day: "2026-08-12",
      session_count: 1,
      avg_wpm: 42,
      avg_confidence: 82,
      human_count: 1,
      suspicious_count: 0,
      synthetic_count: 0,
    },
    {
      day: "2026-08-13",
      session_count: 2,
      avg_wpm: 46,
      avg_confidence: 90,
      human_count: 1,
      suspicious_count: 1,
      synthetic_count: 0,
    },
  ],
  courses: [
    {
      course_name: "Secure Systems",
      course_code: "SEC401",
      session_count: 4,
      avg_wpm: 44,
      avg_confidence: 86,
      human_count: 3,
    },
  ],
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiErrorMessage).mockReturnValue("Dashboard service unavailable.");
  });

  it("loads student evidence metrics, recent sessions, and primary workspace navigation", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: dashboard } as never);

    renderDashboard();

    expect(await screen.findByText("Total sessions")).toBeVisible();
    expect(screen.getByText("Certificates issued")).toBeVisible();
    expect(screen.getByText("Avg. Human Evidence Score")).toBeVisible();
    expect(screen.getByText("Avg. typing speed")).toBeVisible();
    expect(screen.getAllByText("Human Authorship Essay").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      "/sessions",
    );
    expect(
      screen.getAllByRole("link", { name: "Human Authorship Essay" })[0],
    ).toHaveAttribute("href", "/sessions/157");
    expect(screen.getByRole("link", { name: /New writing session/ })).toHaveAttribute(
      "href",
      "/editor/new",
    );
    expect(screen.getByRole("link", { name: "View certificates" })).toHaveAttribute(
      "href",
      "/certificates",
    );
    expect(api.get).toHaveBeenCalledWith(API_ROUTES.student.dashboard);
  });

  it("switches the evidence trend between the supported 7, 14, and 30 day views", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: dashboard } as never);

    renderDashboard();

    expect(await screen.findByText("Evidence classification trend")).toBeVisible();

    const sevenDays = screen.getByRole("button", { name: "7D" });
    const fourteenDays = screen.getByRole("button", { name: "14D" });
    const thirtyDays = screen.getByRole("button", { name: "30D" });

    expect(sevenDays).toBeEnabled();
    expect(fourteenDays).toBeEnabled();
    expect(thirtyDays).toBeEnabled();

    fireEvent.click(sevenDays);
    fireEvent.click(thirtyDays);

    expect(screen.getByText("Evidence classification trend")).toBeVisible();
  });

  it("renders a clean evidence queue when no session needs teacher review context", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ...dashboard,
        summary: {
          ...dashboard.summary,
          pending_count: 0,
          flagged_count: 0,
        },
        recent_sessions: [],
      },
    } as never);

    renderDashboard();

    expect(
      await screen.findByText("Your current evidence queue is clean."),
    ).toBeVisible();
    expect(screen.getByText("Evidence workspace")).toBeVisible();
    expect(screen.getByRole("link", { name: /New writing session/ })).toBeVisible();
  });

  it("fails closed with the dashboard error state and toast contract when retrieval fails", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("network down"));

    renderDashboard();

    expect(await screen.findByText("Dashboard unavailable")).toBeVisible();
    expect(screen.getByText("Dashboard service unavailable.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
    expect(showToast).toHaveBeenCalledWith({
      type: "error",
      title: "Dashboard failed to load",
      message: "Dashboard service unavailable.",
    });
  });
});
