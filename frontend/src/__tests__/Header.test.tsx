import React, { type ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Header from "../components/layout/Header";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  logout: vi.fn(),
  bodyScrollLock: vi.fn(),
  user: null as null | {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: "STUDENT" | "TEACHER";
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("../store/authStore", () => ({
  useAuthStore: () => ({
    user: mocks.user,
    logout: mocks.logout,
  }),
}));

vi.mock("../hooks/useBodyScrollLock", () => ({
  useBodyScrollLock: (locked: boolean) => mocks.bodyScrollLock(locked),
}));

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

  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
          React.createElement(tag, stripMotionProps(props), children),
    },
  );

  return {
    motion,
    AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  };
});

function renderHeader(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Header />
    </MemoryRouter>,
  );
}

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = null;
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 0,
    });
  });

  it("renders and dismisses the signed-out announcement with authentication entry routes", () => {
    renderHeader();

    expect(
      screen.getByText(
        "TypeTrace v1.0 - Writing-process evidence for fair academic review",
      ),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /Get Started/ })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "Start for free" })).toHaveAttribute(
      "href",
      "/register",
    );

    fireEvent.click(screen.getByRole("button", { name: "Dismiss banner" }));
    expect(
      screen.queryByText(
        "TypeTrace v1.0 - Writing-process evidence for fair academic review",
      ),
    ).not.toBeInTheDocument();
  });

  it("opens the Product and Resources menus and exposes the public navigation map", async () => {
    renderHeader("/verify");

    const navigation = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(navigation).getByRole("link", { name: "Verify" })).toHaveAttribute(
      "href",
      "/verify",
    );

    const productButton = within(navigation).getByRole("button", { name: "Product" });
    fireEvent.click(productButton);
    const productMenu = await screen.findByRole("menu");
    expect(within(productMenu).getByRole("link", { name: /Dashboard/ })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(within(productMenu).getByRole("link", { name: /New Session/ })).toHaveAttribute(
      "href",
      "/editor/new",
    );
    expect(within(productMenu).getByRole("link", { name: /Documentation/ })).toHaveAttribute(
      "href",
      "/help",
    );

    fireEvent.click(productButton);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(within(navigation).getByRole("button", { name: "Resources" }));
    const resourcesMenu = await screen.findByRole("menu");
    expect(within(resourcesMenu).getByRole("link", { name: /How It Works/ })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(within(resourcesMenu).getByRole("link", { name: /About TypeTrace/ })).toHaveAttribute(
      "href",
      "/about",
    );
  });

  it("opens the signed-out mobile navigation, locks scrolling, and closes it with Escape", () => {
    renderHeader();

    // Tailwind's responsive CSS is not evaluated by JSDOM, so the hamburger
    // retains its inline desktop display:none style. Query by its accessible
    // label rather than visibility-filtered role lookup, then exercise the real
    // React mobile-drawer state transition.
    fireEvent.click(
      screen.getByLabelText("Open menu", { selector: "button" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Site navigation" });

    expect(dialog).toBeVisible();
    expect(within(dialog).getByRole("link", { name: "Features" })).toHaveAttribute(
      "href",
      "/features",
    );
    expect(within(dialog).getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(mocks.bodyScrollLock).toHaveBeenCalledWith(true);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByRole("dialog", { name: "Site navigation" }),
    ).not.toBeInTheDocument();
  });

  it("renders the student quick action and account menu, then signs out to the public home", () => {
    mocks.user = {
      id: "student-1",
      first_name: "Grace",
      last_name: "Hopper",
      email: "grace@example.edu",
      role: "STUDENT",
    };
    renderHeader("/dashboard");

    expect(screen.getByRole("link", { name: "New Session" })).toHaveAttribute(
      "href",
      "/editor/new",
    );
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Grace/ }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Grace Hopper")).toBeVisible();
    expect(within(menu).getByRole("link", { name: /Dashboard/ })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(within(menu).getByRole("link", { name: /Settings/ })).toHaveAttribute(
      "href",
      "/settings",
    );

    fireEvent.click(within(menu).getByRole("button", { name: "Sign out" }));
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith("/");
  });

  it("maps an authenticated teacher to teacher dashboard and course creation actions", () => {
    mocks.user = {
      id: "teacher-1",
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.edu",
      role: "TEACHER",
    };
    renderHeader("/teacher/dashboard");

    expect(screen.getByRole("link", { name: "Create Course" })).toHaveAttribute(
      "href",
      "/teacher/courses",
    );

    fireEvent.click(screen.getByRole("button", { name: /Ada/ }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Teacher")).toBeVisible();
    expect(within(menu).getByRole("link", { name: /Dashboard/ })).toHaveAttribute(
      "href",
      "/teacher/dashboard",
    );
    expect(within(menu).getByRole("link", { name: /Create Course/ })).toHaveAttribute(
      "href",
      "/teacher/courses",
    );
  });
});
