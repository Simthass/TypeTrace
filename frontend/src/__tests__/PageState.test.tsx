import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import {
  AlertBox,
  EmptyState,
  FirstRunEmptyState,
  LoadingState,
  PageHeader,
} from "../components/ui/PageState";
import { ROUTES } from "../constants/routes";

afterEach(() => cleanup());

describe("PageState", () => {
  it("renders the complete page header contract and supports the minimal variant", () => {
    const { rerender } = render(
      <PageHeader
        eyebrow="Evidence workspace"
        title="Session evidence"
        description="Review captured authorship evidence."
        action={<button type="button">Create session</button>}
      />,
    );

    expect(screen.getByText("Evidence workspace")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Session evidence" })).toBeVisible();
    expect(screen.getByText("Review captured authorship evidence.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create session" })).toBeVisible();

    rerender(<PageHeader title="Minimal heading" />);
    expect(screen.getByRole("heading", { name: "Minimal heading" })).toBeVisible();
    expect(screen.queryByText("Evidence workspace")).not.toBeInTheDocument();
  });

  it("renders default and custom loading labels", () => {
    const { rerender } = render(<LoadingState />);
    expect(screen.getByText("Loading workspace...")).toBeVisible();

    rerender(<LoadingState label="Loading certificates..." />);
    expect(screen.getByText("Loading certificates...")).toBeVisible();
  });

  it("renders every empty-state icon branch", () => {
    const icons = [
      "session",
      "certificate",
      "course",
      "review",
      "search",
      "document",
    ] as const;

    for (const icon of icons) {
      const view = render(
        <EmptyState
          icon={icon}
          title={`${icon} empty`}
          description={`No ${icon} records are available.`}
        />,
      );
      expect(screen.getByRole("heading", { name: `${icon} empty` })).toBeVisible();
      expect(view.container.querySelector("svg[aria-hidden='true']")).not.toBeNull();
      view.unmount();
    }
  });

  it("renders compact empty states with contextual actions", () => {
    render(
      <EmptyState
        compact
        title="No matching records"
        description="Change the active filters."
        action={<button type="button">Reset filters</button>}
      />,
    );

    expect(screen.getByText("No matching records")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reset filters" })).toBeVisible();
  });

  it("executes success, error, warning, info, and default alert tones", () => {
    render(
      <div>
        <AlertBox type="success">Success state</AlertBox>
        <AlertBox type="error">Error state</AlertBox>
        <AlertBox type="warning">Warning state</AlertBox>
        <AlertBox type="info">Info state</AlertBox>
        <AlertBox>Default info state</AlertBox>
      </div>,
    );

    for (const label of [
      "Success state",
      "Error state",
      "Warning state",
      "Info state",
      "Default info state",
    ]) {
      expect(screen.getByText(label)).toBeVisible();
    }
  });

  it("links the first-run authorship state to a new editor session", () => {
    render(
      <MemoryRouter>
        <FirstRunEmptyState />
      </MemoryRouter>,
    );

    expect(screen.getByText("Start your first authorship trail")).toBeVisible();
    expect(screen.getByRole("link", { name: "Start first session" })).toHaveAttribute(
      "href",
      ROUTES.EDITOR_NEW,
    );
  });
});
