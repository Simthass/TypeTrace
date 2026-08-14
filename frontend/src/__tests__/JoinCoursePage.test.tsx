import type { HTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import JoinCoursePage from "../pages/student/JoinCoursePage";
import { API_ROUTES } from "../constants/apiRoutes";
import { ROUTES } from "../constants/routes";
import { api, getApiErrorMessage } from "../lib/api";

const { navigate, showToast } = vi.hoisted(() => ({
  navigate: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("../components/ui/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      post: vi.fn(),
    },
    getApiErrorMessage: vi.fn(),
  };
});

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className, style }: HTMLAttributes<HTMLDivElement>) => (
      <div className={className} style={style}>{children}</div>
    ),
    p: ({ children, className, style }: HTMLAttributes<HTMLParagraphElement>) => (
      <p className={className} style={style}>{children}</p>
    ),
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("JoinCoursePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiErrorMessage).mockReturnValue("Invite code is not valid.");
  });

  it("rejects an empty invite code without contacting the API", () => {
    render(<JoinCoursePage />);

    const input = screen.getByPlaceholderText("TT-XXXXXXXX");
    const form = input.closest("form");
    if (!form) throw new Error("Join course form was not rendered.");

    fireEvent.submit(form);

    expect(screen.getByText("Please enter a valid invite code.")).toBeVisible();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("normalizes the invite code, joins the course, and returns to the dashboard", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        status: "ok",
        course: {
          course_name: "Secure Systems",
        },
      },
    } as never);

    render(<JoinCoursePage />);

    const input = screen.getByPlaceholderText("TT-XXXXXXXX");
    fireEvent.change(input, { target: { value: " tt- ab12 cd34 " } });

    expect(input).toHaveValue("TT-AB12CD34");
    fireEvent.click(screen.getByRole("button", { name: "Join course" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(API_ROUTES.courses.join, {
        invite_code: "TT-AB12CD34",
      });
    });

    expect(showToast).toHaveBeenCalledWith({
      type: "success",
      title: "Course joined successfully",
      message: "You are now enrolled in Secure Systems.",
    });
    expect(navigate).toHaveBeenCalledWith(ROUTES.DASHBOARD);
  });

  it("shows a controlled API error and re-enables submission", async () => {
    vi.mocked(api.post).mockRejectedValue(new Error("join failed"));

    render(<JoinCoursePage />);

    fireEvent.change(screen.getByPlaceholderText("TT-XXXXXXXX"), {
      target: { value: "TT-FAIL1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join course" }));

    expect(await screen.findByText("Invite code is not valid.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Join course" })).toBeEnabled();
    expect(navigate).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("lets the student return to the dashboard without joining a course", () => {
    render(<JoinCoursePage />);

    fireEvent.click(screen.getByRole("button", { name: "dashboard" }));

    expect(navigate).toHaveBeenCalledWith(ROUTES.DASHBOARD);
    expect(api.post).not.toHaveBeenCalled();
  });
});
