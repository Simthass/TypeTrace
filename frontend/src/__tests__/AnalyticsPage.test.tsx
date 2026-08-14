import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AnalyticsPage from "../pages/AnalyticsPage";
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
    LineChart: Chart,
    PieChart: Chart,
    RadarChart: Chart,
    ScatterChart: Chart,
    Area: () => null,
    Bar: () => null,
    Cell: () => null,
    CartesianGrid: () => null,
    Line: () => null,
    Pie: () => null,
    PolarAngleAxis: () => null,
    PolarGrid: () => null,
    Radar: () => null,
    Scatter: () => null,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
    ZAxis: () => null,
  };
});


function renderAnalytics() {
  return render(
    <MemoryRouter>
      <AnalyticsPage />
    </MemoryRouter>,
  );
}

const analytics = {
  status: "ok",
  daily: [
    {
      day: "2026-08-12",
      session_count: 1,
      avg_wpm: 40,
      avg_confidence: 80,
      total_keys: 1000,
      deletions: 30,
      pauses: 20,
    },
    {
      day: "2026-08-13",
      session_count: 2,
      avg_wpm: 50,
      avg_confidence: 90,
      total_keys: 1500,
      deletions: 40,
      pauses: 10,
    },
  ],
  courses: [
    {
      course_name: "Secure Systems",
      course_code: "SEC401",
      session_count: 3,
      avg_wpm: 45,
      avg_confidence: 88,
      human_count: 2,
      suspicious_count: 1,
      synthetic_count: 0,
    },
  ],
  bests: {
    best_wpm: 61,
    best_confidence: 95,
    longest_session: 1800,
    best_iki: 150,
    total_sessions: 3,
    total_seconds: 2400,
  },
};

describe("AnalyticsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiErrorMessage).mockReturnValue("Analytics service unavailable.");
  });

  it("loads behavioral analytics, selected-window metrics, and course evidence context", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: analytics } as never);

    renderAnalytics();

    expect(await screen.findByRole("heading", { name: "Analytics" })).toBeVisible();
    expect(screen.getByText("API window: 2 daily rows")).toBeVisible();
    expect(screen.getByText("Sessions captured")).toBeVisible();
    expect(screen.getAllByText("Average confidence").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Average WPM").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Revision pressure").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("SEC401").length).toBeGreaterThanOrEqual(1);
    expect(api.get).toHaveBeenCalledWith(API_ROUTES.student.analytics);
  });

  it("recalculates activity coverage when the student changes the analytics period", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: analytics } as never);

    renderAnalytics();

    expect(await screen.findByText("2/30 days")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "7D" }));

    expect(screen.getByText("2/7 days")).toBeVisible();
    expect(screen.getByRole("button", { name: "14D" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "30D" })).toBeEnabled();
  });

  it("renders the explicit empty analytics state before any writing evidence exists", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ...analytics,
        daily: [],
        courses: [],
      },
    } as never);

    renderAnalytics();

    expect(await screen.findByText("No analytics available yet")).toBeVisible();
    expect(
      screen.getByText(/Analyze writing sessions to build charts/),
    ).toBeVisible();
  });

  it("surfaces analytics retrieval failures through the error state and toast contract", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("network down"));

    renderAnalytics();

    expect(await screen.findByText("Could not load analytics")).toBeVisible();
    expect(screen.getByText("Analytics service unavailable.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
    expect(showToast).toHaveBeenCalledWith({
      type: "error",
      title: "Analytics failed to load",
      message: "Analytics service unavailable.",
    });
  });
});
