import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ErrorBoundary from "../components/errors/ErrorBoundary";

const { toastError } = vi.hoisted(() => ({
  toastError: vi.fn(),
}));

vi.mock("../lib/toast", () => ({
  toast: {
    error: toastError,
  },
}));

function BrokenView({ message = "render exploded" }: { message?: string }): ReactElement {
  throw new Error(message);
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    toastError.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders healthy descendants without showing the recovery surface", () => {
    render(
      <ErrorBoundary>
        <div>Healthy workspace</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Healthy workspace")).toBeVisible();
    expect(
      screen.queryByRole("heading", {
        name: "TypeTrace could not render this page.",
      }),
    ).not.toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("catches render failures, reports the incident, and exposes a controlled fallback", () => {
    render(
      <ErrorBoundary>
        <BrokenView message="teacher dossier render failed" />
      </ErrorBoundary>,
    );

    expect(
      screen.getByRole("heading", {
        name: "TypeTrace could not render this page.",
      }),
    ).toBeVisible();
    expect(screen.getByText("teacher dossier render failed")).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Go to home" })).toBeEnabled();
    expect(toastError).toHaveBeenCalledWith(
      "Application error",
      "A page failed to render. Refresh the page or return to the dashboard.",
    );
    expect(console.error).toHaveBeenCalled();
  });

  it("allows a transient render failure to recover through the retry action", () => {
    let shouldThrow = true;

    function FlakyView() {
      if (shouldThrow) {
        throw new Error("temporary render failure");
      }
      return <div>Recovered workspace</div>;
    }

    render(
      <ErrorBoundary>
        <FlakyView />
      </ErrorBoundary>,
    );

    const retry = screen.getByRole("button", { name: "Try again" });
    expect(retry).toBeEnabled();

    shouldThrow = false;
    fireEvent.click(retry);

    expect(screen.getByText("Recovered workspace")).toBeVisible();
    expect(
      screen.queryByRole("heading", {
        name: "TypeTrace could not render this page.",
      }),
    ).not.toBeInTheDocument();
  });
});
