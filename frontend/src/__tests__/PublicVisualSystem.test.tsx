import React, { type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import {
  CertificateGraphic,
  EvidenceBoard,
  IconTile,
  PrimaryLink,
  PublicCard,
  PublicCtaBand,
  PublicIcon,
  PublicSection,
  PublicShell,
  SecondaryLink,
  SectionEyebrow,
  SectionHeading,
  WorkflowGraphic,
  type PublicIconName,
} from "../components/public/PublicVisualSystem";

vi.mock("framer-motion", () => {
  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => {
          const {
            initial,
            animate,
            exit,
            transition,
            whileInView,
            viewport,
            ...rest
          } = props;
          void initial;
          void animate;
          void exit;
          void transition;
          void whileInView;
          void viewport;
          return React.createElement(tag, rest, children);
        },
    },
  );

  return {
    motion,
    useReducedMotion: () => true,
  };
});

function withRouter(node: ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

describe("PublicVisualSystem", () => {
  it("renders every supported public icon without exposing decorative SVGs to assistive technology", () => {
    const names: PublicIconName[] = [
      "keyboard",
      "shield",
      "timeline",
      "certificate",
      "teacher",
      "privacy",
      "search",
      "replay",
      "model",
      "hash",
      "document",
      "course",
    ];

    const { container } = render(
      <div>
        {names.map((name) => (
          <span key={name} data-testid={`icon-${name}`}>
            <PublicIcon name={name} size={24} className="test-icon" />
          </span>
        ))}
      </div>,
    );

    expect(container.querySelectorAll("svg")).toHaveLength(names.length);
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(
      names.length,
    );
  });

  it("renders the reusable shell, section, heading, card, tile, and link primitives", () => {
    withRouter(
      <PublicShell>
        <PublicSection className="custom-section">
          <SectionEyebrow>Evidence design</SectionEyebrow>
          <SectionHeading
            eyebrow="Architecture"
            title="Explainable evidence"
            description="A review-safe evidence surface."
            align="center"
          />
          <PublicCard className="custom-card">Card body</PublicCard>
          <IconTile
            icon="shield"
            title="Private evidence"
            description="Sensitive evidence remains protected."
          />
          <PrimaryLink to="/register">Create account</PrimaryLink>
          <SecondaryLink to="/verify">Verify</SecondaryLink>
        </PublicSection>
      </PublicShell>,
    );

    expect(screen.getByText("Evidence design")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Explainable evidence" })).toBeVisible();
    expect(screen.getByText("A review-safe evidence surface.")).toBeVisible();
    expect(screen.getByText("Card body")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Private evidence" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.getByRole("link", { name: "Verify" })).toHaveAttribute(
      "href",
      "/verify",
    );
  });

  it("renders the evidence dashboard, signed-certificate graphic, and four-stage workflow", () => {
    withRouter(
      <>
        <EvidenceBoard />
        <CertificateGraphic />
        <WorkflowGraphic />
      </>,
    );

    expect(screen.getByText("Live Evidence Trail")).toBeVisible();
    expect(screen.getByText("Keystroke rhythm")).toBeVisible();
    expect(screen.getByText("Paste activity")).toBeVisible();
    expect(screen.getAllByText("Document hash").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("heading", { name: "Writing Evidence Certificate" })).toBeVisible();
    expect(screen.getByText("TT-8Q4Z2M9A")).toBeVisible();
    expect(screen.getByText("Write")).toBeVisible();
    expect(screen.getByText("Capture")).toBeVisible();
    expect(screen.getByText("Analyze")).toBeVisible();
    expect(screen.getByText("Verify")).toBeVisible();
  });

  it("renders the public CTA band with account creation and certificate lookup routes", () => {
    withRouter(<PublicCtaBand />);

    expect(
      screen.getByRole("heading", {
        name: "Capture the writing process before doubt begins.",
      }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Start session" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.getByRole("link", { name: "Verify a certificate" })).toHaveAttribute(
      "href",
      "/verify",
    );
  });
});
