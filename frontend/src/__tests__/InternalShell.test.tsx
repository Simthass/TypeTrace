import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import {
  AppSurface,
  EmptyPanel,
  InternalIcon,
  MetricTile,
  PageHeading,
  PrimaryAction,
  SecondaryAction,
  StatusPill,
} from "../components/internal/InternalShell";

const iconNames = [
  "dashboard",
  "editor",
  "sessions",
  "certificate",
  "analytics",
  "course",
  "teacher",
  "student",
  "review",
  "replay",
  "shield",
  "search",
  "settings",
  "logout",
  "hash",
  "clock",
  "keyboard",
  "document",
  "trend",
  "download",
  "warning",
  "check",
] as const;

describe("InternalShell primitives", () => {
  it("renders every internal icon as decorative SVG content", () => {
    const { container } = render(
      <div>
        {iconNames.map((name) => (
          <span key={name} data-testid={`internal-icon-${name}`}>
            <InternalIcon name={name} size={20} />
          </span>
        ))}
      </div>,
    );

    expect(container.querySelectorAll("svg")).toHaveLength(iconNames.length);
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(
      iconNames.length,
    );
  });

  it("renders application surfaces, headings, and contextual actions", () => {
    render(
      <MemoryRouter>
        <AppSurface className="test-surface">
          <PageHeading
            eyebrow="Student evidence"
            title="Writing sessions"
            description="Review saved authorship evidence."
            action={<PrimaryAction to="/editor/new">New session</PrimaryAction>}
          />
          <SecondaryAction to="/sessions">View sessions</SecondaryAction>
        </AppSurface>
      </MemoryRouter>,
    );

    expect(screen.getByText("Student evidence")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Writing sessions" })).toBeVisible();
    expect(screen.getByText("Review saved authorship evidence.")).toBeVisible();
    expect(screen.getByRole("link", { name: /New session/ })).toHaveAttribute(
      "href",
      "/editor/new",
    );
    expect(screen.getByRole("link", { name: "View sessions" })).toHaveAttribute(
      "href",
      "/sessions",
    );
  });

  it("renders metric tiles and every supported status tone", () => {
    render(
      <div>
        <MetricTile
          icon="analytics"
          label="Human evidence"
          value="92%"
          detail="Across verified sessions"
        />
        <StatusPill label="Neutral" />
        <StatusPill label="Verified" tone="good" />
        <StatusPill label="Review" tone="warning" />
        <StatusPill label="High risk" tone="danger" />
        <StatusPill label="Signed" tone="brand" />
      </div>,
    );

    expect(screen.getByText("Human evidence")).toBeVisible();
    expect(screen.getByText("92%")).toBeVisible();
    expect(screen.getByText("Across verified sessions")).toBeVisible();
    for (const label of ["Neutral", "Verified", "Review", "High risk", "Signed"]) {
      expect(screen.getByText(label)).toBeVisible();
    }
  });

  it("renders an empty-state panel with an optional recovery action", () => {
    render(
      <MemoryRouter>
        <EmptyPanel
          icon="document"
          title="No sessions yet"
          description="Start a writing session to create your first evidence record."
          action={<PrimaryAction to="/editor/new">Start writing</PrimaryAction>}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "No sessions yet" })).toBeVisible();
    expect(
      screen.getByText(
        "Start a writing session to create your first evidence record.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /Start writing/ })).toHaveAttribute(
      "href",
      "/editor/new",
    );
  });
});
