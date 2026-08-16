import { render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { EmptyState, ErrorState, LoadingState, StatePanel } from "../components/ui/AsyncState";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { CardGridSkeleton, DashboardSkeleton, Skeleton, TableSkeleton } from "../components/ui/Skeleton";
import { classificationTone } from "../components/ui/badgeTone";
import { usePageTitle } from "../hooks/usePageTitle";

describe("shared UI closure coverage", () => {
  it("renders loading, empty, error, and every state-panel tone with optional actions", () => {
    render(
      <>
        <LoadingState />
        <LoadingState title="Loading evidence" message="Preparing evidence." />
        <EmptyState title="Nothing here" message="No records." action={<button>Start</button>} />
        <ErrorState message="Network failed" action={<button>Retry</button>} />
        <StatePanel title="Default" message="Default state" />
        <StatePanel tone="warning" title="Warning" message="Review required" />
        <StatePanel tone="success" title="Success" message="Saved" />
        <StatePanel tone="error" title="Error" message="Failed" />
      </>,
    );

    expect(screen.getByText("Loading")).toBeVisible();
    expect(screen.getByText("Loading evidence")).toBeVisible();
    expect(screen.getByRole("button", { name: "Start" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
    expect(screen.getByText("Warning")).toBeVisible();
    expect(screen.getByText("Success")).toBeVisible();
  });

  it("renders every badge style and maps every classification tone", () => {
    render(
      <>
        <Badge>Neutral</Badge>
        <Badge tone="brand">Brand</Badge>
        <Badge tone="human">Human</Badge>
        <Badge tone="verified">Verified</Badge>
        <Badge tone="suspicious">Suspicious</Badge>
        <Badge tone="danger">Danger</Badge>
      </>,
    );

    expect(screen.getByText("Neutral")).toBeVisible();
    expect(classificationTone("HUMAN")).toBe("human");
    expect(classificationTone("suspicious")).toBe("suspicious");
    expect(classificationTone("SYNTHETIC")).toBe("danger");
    expect(classificationTone("AI")).toBe("danger");
    expect(classificationTone("AI-GENERATED")).toBe("danger");
    expect(classificationTone("HIGH_RISK")).toBe("danger");
    expect(classificationTone("unknown")).toBe("neutral");
  });

  it("renders every button variant and size for buttons and links", () => {
    render(
      <MemoryRouter>
        <Button size="sm" variant="primary" leftIcon={<span>L</span>} rightIcon={<span>R</span>}>Primary</Button>
        <Button size="md" variant="secondary">Secondary</Button>
        <Button size="lg" variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <ButtonLink to="/next" size="sm" variant="primary">Primary link</ButtonLink>
        <ButtonLink to="/next" size="md" variant="secondary">Secondary link</ButtonLink>
        <ButtonLink to="/next" size="lg" variant="ghost">Ghost link</ButtonLink>
        <ButtonLink to="/next" variant="danger">Danger link</ButtonLink>
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /Primary/ })).toBeVisible();
    expect(screen.getByRole("link", { name: "Danger link" })).toHaveAttribute("href", "/next");
  });

  it("renders all skeleton families with default and custom counts", () => {
    const { container } = render(
      <>
        <Skeleton className="marker" rounded="rounded-full" />
        <DashboardSkeleton />
        <TableSkeleton />
        <TableSkeleton rows={2} />
        <CardGridSkeleton />
        <CardGridSkeleton cards={2} />
      </>,
    );
    expect(container.querySelector(".marker")).toHaveClass("rounded-full");
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(20);
  });

  it("applies document metadata through the page-title hook", () => {
    const original = document.title;
    renderHook(() =>
      usePageTitle({
        title: "Coverage closure",
        description: "Coverage-specific description",
        noSuffix: true,
      }),
    );
    expect(document.title).toBe("Coverage closure");
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      "content",
      "Coverage-specific description",
    );
    document.title = original;
  });
});
