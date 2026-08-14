import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { useAuthStore } from "../store/authStore";

vi.mock("../pages/HomePage", () => ({
  default: () => <div>Home route target</div>,
}));

vi.mock("../pages/LoginPage", () => ({
  default: () => <div>Login route target</div>,
}));

vi.mock("../pages/NotFoundPage", () => ({
  default: () => <div>Not-found route target</div>,
}));

function navigate(path: string) {
  window.history.pushState({}, "", path);
}

describe("App routing composition", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      hasHydrated: true,
    });
  });

  it("mounts the public root through the shared application shell", async () => {
    navigate("/");

    render(<App />);

    expect(await screen.findByText("Home route target")).toBeVisible();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("routes signed-out users to the authentication workspace without redirect loops", async () => {
    navigate("/login");

    render(<App />);

    expect(await screen.findByText("Login route target")).toBeVisible();
  });

  it("falls through unknown paths to the explicit not-found route", async () => {
    navigate("/this-route-does-not-exist");

    render(<App />);

    expect(await screen.findByText("Not-found route target")).toBeVisible();
  });
});
