import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "../pages/LoginPage";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { usePasswordResetStore } from "../store/passwordResetStore";
import { useRegistrationStore } from "../store/registrationStore";

const showToast = vi.fn();

vi.mock("../components/ui/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));

function renderLogin(initialEntry = "/login") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>Student dashboard target</div>} />
        <Route
          path="/teacher/dashboard"
          element={<div>Teacher dashboard target</div>}
        />
        <Route path="/sessions" element={<div>Requested route target</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    showToast.mockReset();
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();

    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      hasHydrated: true,
    });
    useRegistrationStore.setState({ session: null });
    usePasswordResetStore.setState({ session: null });
  });

  it("rejects malformed email without calling the API", () => {
    const post = vi.spyOn(api, "post");

    renderLogin();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "not-an-email" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(post).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "warning",
        title: "Invalid email",
      }),
    );
  });

  it("requires a nonblank password", () => {
    const post = vi.spyOn(api, "post");

    renderLogin();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "student@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(post).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "warning",
        title: "Password required",
      }),
    );
  });

  it("normalizes the email, persists login, clears transient sessions, and routes by role", async () => {
    useRegistrationStore.getState().setSession({
      registrationId: "reg_test",
      email: "student@example.com",
      role: "STUDENT",
      expiresAt: Date.now() + 60_000,
    });
    usePasswordResetStore.getState().setSession({
      resetId: "rst_test",
      email: "student@example.com",
      expiresAt: Date.now() + 60_000,
    });

    vi.spyOn(api, "post").mockResolvedValue({
      data: {
        message: "Login successful.",
        access_token: "access-token",
        user: {
          id: "teacher-1",
          first_name: "Ada",
          last_name: "Teacher",
          email: "teacher@example.com",
          role: "TEACHER",
          is_verified: true,
        },
      },
    } as never);

    renderLogin();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "  TEACHER@EXAMPLE.COM " },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByText("Teacher dashboard target");

    expect(api.post).toHaveBeenCalledWith(
      expect.any(String),
      {
        email: "teacher@example.com",
        password: "Password123",
      },
    );
    expect(useAuthStore.getState()).toMatchObject({
      token: "access-token",
      isAuthenticated: true,
      user: expect.objectContaining({ role: "TEACHER" }),
    });
    expect(useRegistrationStore.getState().session).toBeNull();
    expect(usePasswordResetStore.getState().session).toBeNull();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "success",
        title: "Login successful",
      }),
    );
  });

  it("honors an authenticated return route supplied in router state", async () => {
    vi.spyOn(api, "post").mockResolvedValue({
      data: {
        message: "Login successful.",
        access_token: "access-token",
        user: {
          id: "student-1",
          first_name: "Student",
          last_name: "",
          email: "student@example.com",
          role: "STUDENT",
          is_verified: true,
        },
      },
    } as never);

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/login",
            state: { from: "/sessions" },
          },
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/sessions" element={<div>Requested route target</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "student@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await screen.findByText("Requested route target");
  });

  it("surfaces a controlled API failure and re-enables submission", async () => {
    vi.spyOn(api, "post").mockRejectedValue(new Error("network unavailable"));

    renderLogin();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "student@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Password123" },
    });

    const button = screen.getByRole("button", { name: "Sign in" });
    fireEvent.click(button);

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Login failed",
        }),
      ),
    );
    expect(button).toBeEnabled();
  });
});
