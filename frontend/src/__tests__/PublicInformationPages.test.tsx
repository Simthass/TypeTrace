import React, { type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AboutPage from "../pages/AboutPage";
import FeaturesPage from "../pages/FeaturesPage";
import HelpDocsPage from "../pages/HelpDocsPage";
import HowItWorksPage from "../pages/HowItWorksPage";
import NotFoundPage from "../pages/NotFoundPage";
import PrivacyPage from "../pages/PrivacyPage";
import SettingsRedirectPage from "../pages/SettingsRedirectPage";

const auth = vi.hoisted(() => ({
  isAuthenticated: false,
  user: null as null | { role: "STUDENT" | "TEACHER" },
}));

vi.mock("../store/authStore", () => ({
  useAuthStore: () => auth,
}));

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
    AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useInView: () => true,
    useReducedMotion: () => true,
  };
});

function renderPage(node: ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderSettingsRedirect() {
  return render(
    <MemoryRouter initialEntries={["/settings"]}>
      <Routes>
        <Route path="/settings" element={<SettingsRedirectPage />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("public information pages", () => {
  beforeEach(() => {
    auth.isAuthenticated = false;
    auth.user = null;
  });

  it("renders About, Features, and How It Works with their core conversion routes", () => {
    const about = renderPage(<AboutPage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Built to make authorship review more transparent.",
      }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Start using TypeTrace" })).toHaveAttribute(
      "href",
      "/register",
    );
    about.unmount();

    const features = renderPage(<FeaturesPage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Everything needed to review authorship evidence fairly.",
      }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Try TypeTrace" })).toHaveAttribute(
      "href",
      "/register",
    );
    features.unmount();

    renderPage(<HowItWorksPage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "From writing session to evidence trail in four steps.",
      }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.getByRole("link", { name: "Verify certificate" })).toHaveAttribute(
      "href",
      "/verify",
    );
  });

  it("filters help topics and renders the explicit no-results state", () => {
    renderPage(<HelpDocsPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Understand TypeTrace without guessing.",
      }),
    ).toBeVisible();
    const search = screen.getByPlaceholderText("Search help topics...");

    fireEvent.change(search, { target: { value: "certificate" } });
    expect(screen.getByText("Verification")).toBeVisible();
    expect(screen.getByText("Verify a certificate")).toBeVisible();

    fireEvent.change(search, { target: { value: "no-such-help-topic" } });
    expect(screen.getByText("No matching help topic found.")).toBeVisible();
  });

  it("renders the privacy contract and public-verification boundary", () => {
    renderPage(<PrivacyPage />);

    expect(
      screen.getByRole("heading", {
        name: "TypeTrace verifies the process without exposing the private draft.",
      }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "What TypeTrace captures" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "What public verification shows" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "What remains private" })).toBeVisible();
    const verifyLinks = screen.getAllByRole("link", { name: /Verify/i });
    expect(verifyLinks.some((link) => link.getAttribute("href") === "/verify")).toBe(true);
  });

  it("redirects unauthenticated settings requests to sign in", async () => {
    renderSettingsRedirect();

    expect(await screen.findByTestId("location")).toHaveTextContent("/login");
  });

  it("redirects authenticated students and teachers to their role-specific settings", async () => {
    auth.isAuthenticated = true;
    auth.user = { role: "STUDENT" };
    const student = renderSettingsRedirect();
    expect(await screen.findByTestId("location")).toHaveTextContent(
      "/dashboard/settings",
    );
    student.unmount();

    auth.user = { role: "TEACHER" };
    renderSettingsRedirect();
    expect(await screen.findByTestId("location")).toHaveTextContent(
      "/teacher/settings",
    );
  });

  it("renders a teacher-aware not-found recovery surface", () => {
    auth.isAuthenticated = true;
    auth.user = { role: "TEACHER" };
    renderPage(<NotFoundPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "This authorship trail does not exist.",
      }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Return to dashboard" })).toHaveAttribute(
      "href",
      "/teacher/dashboard",
    );
    expect(screen.getByRole("link", { name: "Verify certificate" })).toHaveAttribute(
      "href",
      "/verify",
    );
  });
});
