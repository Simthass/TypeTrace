import { render, screen } from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import RoleGuard from "../components/guards/RoleGuard";
import { useAuthStore, type AuthUser } from "../store/authStore";

const student: AuthUser = {
  id: "student-1",
  first_name: "Student",
  email: "student@example.com",
  role: "STUDENT",
  is_verified: true,
};

const teacher: AuthUser = {
  id: "teacher-1",
  first_name: "Teacher",
  email: "teacher@example.com",
  role: "TEACHER",
  is_verified: true,
};

function setAuth(
  user: AuthUser | null,
  {
    authenticated = Boolean(user),
    hydrated = true,
  }: {
    authenticated?: boolean;
    hydrated?: boolean;
  } = {},
) {
  useAuthStore.setState({
    user,
    token: authenticated ? "token" : null,
    isAuthenticated: authenticated,
    hasHydrated: hydrated,
  });
}

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route
          element={<RoleGuard allowedRoles={["STUDENT"]} />}
        >
          <Route
            path="/protected"
            element={<div>Protected student page</div>}
          />
        </Route>
        <Route path="/login" element={<div>Login page</div>} />
        <Route
          path="/dashboard"
          element={<div>Student dashboard</div>}
        />
        <Route
          path="/teacher/dashboard"
          element={<div>Teacher dashboard</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RoleGuard", () => {
  beforeEach(() => {
    setAuth(null, { authenticated: false, hydrated: true });
  });

  it("renders nothing until persisted authentication has hydrated", () => {
    setAuth(null, { authenticated: false, hydrated: false });
    const { container } = renderGuard();
    expect(container).toBeEmptyDOMElement();
  });

  it("redirects anonymous users to login", () => {
    renderGuard();
    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("renders the protected route for an allowed student", () => {
    setAuth(student);
    renderGuard();
    expect(
      screen.getByText("Protected student page"),
    ).toBeInTheDocument();
  });

  it("redirects a teacher to the teacher dashboard", () => {
    setAuth(teacher);
    renderGuard();
    expect(screen.getByText("Teacher dashboard")).toBeInTheDocument();
  });
});
