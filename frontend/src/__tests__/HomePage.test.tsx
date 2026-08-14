import React, { type ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import HomePage from "../pages/HomePage";

vi.mock("framer-motion", () => {
  const stripMotionProps = (props: Record<string, unknown>) => {
    const {
      initial,
      animate,
      exit,
      transition,
      whileInView,
      viewport,
      whileHover,
      whileTap,
      layout,
      ...rest
    } = props;
    void initial;
    void animate;
    void exit;
    void transition;
    void whileInView;
    void viewport;
    void whileHover;
    void whileTap;
    void layout;
    return rest;
  };

  // Cache each mocked motion tag. Returning a new component function from the
  // Proxy on every render changes the React element type and can remount the
  // subtree, which would reset local component state such as TrustSection's
  // active tab. Real Framer Motion components have stable identities.
  const componentCache = new Map<
    string,
    React.ComponentType<{ children?: ReactNode } & Record<string, unknown>>
  >();

  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        const cached = componentCache.get(tag);
        if (cached) return cached;

        const MotionTag = ({
          children,
          ...props
        }: { children?: ReactNode } & Record<string, unknown>) =>
          React.createElement(tag, stripMotionProps(props), children);

        componentCache.set(tag, MotionTag);
        return MotionTag;
      },
    },
  );

  return {
    motion,
    AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useInView: () => true,
    useReducedMotion: () => true,
  };
});

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

describe("HomePage", () => {
  it("renders the primary product proposition and public entry routes", () => {
    renderHome();

    // The hero deliberately interleaves styled spans, so its computed accessible
    // name can collapse whitespace between span boundaries in JSDOM. Assert the
    // semantic h1 and its complete visible wording instead of a whitespace-fragile
    // accessible-name regex.
    const heroHeading = screen.getByRole("heading", { level: 1 });
    expect(heroHeading).toBeVisible();
    expect(heroHeading).toHaveTextContent(
      /Capture the\s*Writing\s*Process\s*Behind Every Draft/i,
    );
    expect(
      screen.getAllByRole("link", { name: "Start a writing session" })[0],
    ).toHaveAttribute("href", "/register");
    expect(screen.getAllByRole("link", { name: "See how it works" })[0]).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(screen.getByText("Capture the writing process")).toBeVisible();
    expect(screen.getByText("Analyze behavioral evidence")).toBeVisible();
    expect(screen.getByText("Review course submissions")).toBeVisible();
    expect(screen.getByText("Verify certificates")).toBeVisible();
  });

  it("renders the complete capture, analysis, review, and certificate story", () => {
    renderHome();

    expect(
      screen.getByRole("heading", {
        name: "Academic review is stronger when the writing process is visible.",
      }),
    ).toBeVisible();
    expect(screen.getByText("Process evidence captured in context")).toBeVisible();
    expect(screen.getByText("Tamper-evident certificate records")).toBeVisible();
    expect(screen.getByText("Human review remains in control")).toBeVisible();
    expect(screen.getByText("Public verification limits exposure")).toBeVisible();
    expect(screen.getByText("For students")).toBeVisible();
    expect(screen.getByText("For teachers")).toBeVisible();
  });

  it("switches the trust architecture between process, public verification, and human review", async () => {
    renderHome();

    const tabs = screen.getByRole("tablist", { name: "Trust architecture" });
    const processTab = within(tabs).getByRole("tab", { name: "Process evidence" });
    const privacyTab = within(tabs).getByRole("tab", { name: "Public verification" });

    expect(processTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Review how the session developed.")).toBeVisible();

    fireEvent.click(privacyTab);
    await waitFor(() => {
      expect(
        within(tabs).getByRole("tab", { name: "Public verification" }),
      ).toHaveAttribute("aria-selected", "true");
    });
    expect(
      await screen.findByText("Verify a certificate without publishing the draft."),
    ).toBeVisible();

    fireEvent.click(within(tabs).getByRole("tab", { name: "Human review" }));
    await waitFor(() => {
      expect(
        within(tabs).getByRole("tab", { name: "Human review" }),
      ).toHaveAttribute("aria-selected", "true");
    });
    expect(
      await screen.findByText("Keep the final decision with the reviewer."),
    ).toBeVisible();
  });

  it("keeps the final conversion and certificate-verification actions available", () => {
    renderHome();

    const finalHeading = screen
      .getAllByRole("heading", { level: 2 })
      .find((heading) =>
        /Record the process before\s*the final document is reviewed/i.test(
          heading.textContent || "",
        ),
      );
    if (!finalHeading) {
      throw new Error("Expected the final conversion heading to be rendered.");
    }
    expect(finalHeading).toBeVisible();
    expect(screen.getByRole("link", { name: "Create a free account" })).toHaveAttribute(
      "href",
      "/register",
    );
    const verifyLinks = screen.getAllByRole("link", { name: "Verify a certificate" });
    expect(verifyLinks.at(-1)).toHaveAttribute("href", "/verify");
  });
});
