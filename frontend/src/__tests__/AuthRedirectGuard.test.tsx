import { render, screen } from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import AuthRedirectGuard from "../components/guards/AuthRedirectGuard";
import { useAuthStore, type AuthUser } from "../store/authStore";

const teacher: AuthUser = {
  id: "teacher-1",
  first_name: "Teacher",
  email: "teacher@example.com",
  role: "TEACHER",
  is_verified: true,
};

function renderGuard(
  entry:
    | string
    | {
        pathname: string;
        state?: { from?: string };
      } = "/login",
) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={<AuthRedirectGuard />}>
          <Route path="/login" element={<div>Login form</div>} />
        </Route>
        <Route
          path="/teacher/dashboard"
          element={<div>Teacher dashboard</div>}
        />
        <Route path="/dashboard" element={<div>Student dashboard</div>} />
        <Route path="/sessions" element={<div>Requested session</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AuthRedirectGuard", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
        hasHydrated: true,
    });
  });

  it("shows the auth route to anonymous users", () => {
    renderGuard();
    expect(screen.getByText("Login form")).toBeInTheDocument();
  });

  it("redirects an authenticated teacher to the teacher dashboard", () => {
    useAuthStore.setState({
      user: teacher,
      token: "token",
      isAuthenticated: true,
    });

    renderGuard();
    expect(screen.getByText("Teacher dashboard")).toBeInTheDocument();
  });

  it("honours the original requested route after authentication", () => {
    useAuthStore.setState({
      user: teacher,
      token: "token",
      isAuthenticated: true,
    });

    renderGuard({
      pathname: "/login",
      state: { from: "/sessions" },
    });

    expect(screen.getByText("Requested session")).toBeInTheDocument();
  });
});
