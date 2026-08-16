import React, { type ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  useAuthStore: () => ({ user: mocks.user, logout: mocks.logout }),
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

describe("Header final interaction closure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = null;
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 0,
    });
  });

  it("updates the sticky header styling when the document scrolls", async () => {
    renderHeader();

    expect(screen.getByRole("banner").style.backdropFilter).toBe("none");

    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 24,
    });
    fireEvent.scroll(window);

    await waitFor(() => {
      expect(screen.getByRole("banner").style.backdropFilter).toBe("blur(12px)");
    });
  });

  it("closes the profile menu when a pointer event occurs outside it", () => {
    mocks.user = {
      id: "student-final",
      first_name: "Grace",
      last_name: "Hopper",
      email: "grace@example.edu",
      role: "STUDENT",
    };
    renderHeader("/dashboard");

    fireEvent.click(screen.getByRole("button", { name: /Grace/ }));
    expect(screen.getByRole("menu")).toBeVisible();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("renders the authenticated mobile account actions and signs out from the drawer", () => {
    mocks.user = {
      id: "student-mobile",
      first_name: "Katherine",
      last_name: "Johnson",
      email: "kj@example.edu",
      role: "STUDENT",
    };
    renderHeader("/dashboard");

    fireEvent.click(screen.getByLabelText("Open menu", { selector: "button" }));
    const dialog = screen.getByRole("dialog", { name: "Site navigation" });
    expect(within(dialog).getByText("Katherine Johnson")).toBeVisible();
    expect(within(dialog).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(within(dialog).getByRole("link", { name: "New Session" })).toHaveAttribute(
      "href",
      "/editor/new",
    );
    expect(within(dialog).getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out" }));
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith("/");
  });

  it("closes a desktop dropdown through one of its navigation links", async () => {
    renderHeader();
    const navigation = screen.getByRole("navigation", { name: "Main navigation" });
    fireEvent.click(within(navigation).getByRole("button", { name: "Product" }));

    const menu = await screen.findByRole("menu");
    fireEvent.click(within(menu).getByRole("link", { name: /New Session/ }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("executes quick-action hover styling for an authenticated teacher", () => {
    mocks.user = {
      id: "teacher-final",
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.edu",
      role: "TEACHER",
    };
    renderHeader("/teacher/dashboard");

    const action = screen.getByRole("link", { name: "Create Course" });
    const initialColor = action.style.color;
    const initialBorder = action.style.borderColor;

    fireEvent.mouseEnter(action);
    expect(action.style.color).not.toBe(initialColor);
    expect(action.style.borderColor).not.toBe(initialBorder);

    fireEvent.mouseLeave(action);
    expect(action.style.color).toBe(initialColor);
    expect(action.style.borderColor).toBe(initialBorder);
  });
});
