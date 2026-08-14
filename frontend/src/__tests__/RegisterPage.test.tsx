import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RegisterPage from "../pages/RegisterPage";
import { API_ROUTES } from "../constants/apiRoutes";
import { ROUTES } from "../constants/routes";
import { api, getApiErrorMessage } from "../lib/api";
import { useRegistrationStore } from "../store/registrationStore";

const { navigate, showToast } = vi.hoisted(() => ({
  navigate: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("../components/ui/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      post: vi.fn(),
    },
    getApiErrorMessage: vi.fn(),
  };
});

function renderRegister() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  );
}

function fillValidStudent() {
  fireEvent.change(screen.getByLabelText("First name"), {
    target: { value: "  Ada  " },
  });
  fireEvent.change(screen.getByLabelText("Last name"), {
    target: { value: "  Lovelace  " },
  });
  fireEvent.change(screen.getByLabelText("Student ID"), {
    target: { value: "  STU-100  " },
  });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "  ADA@EXAMPLE.EDU  " },
  });
  fireEvent.change(screen.getByLabelText("University name"), {
    target: { value: "  Example University  " },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "Password123!" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "Password123!" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
}

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    useRegistrationStore.getState().clearSession();
    vi.mocked(getApiErrorMessage).mockReturnValue("Registration unavailable.");
  });

  it("rejects an incomplete registration locally without contacting the API", () => {
    renderRegister();

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByText("First name and last name are required.")).toBeVisible();
    expect(api.post).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith({
      type: "warning",
      title: "Please check your information",
      message: "First name and last name are required.",
    });
  });

  it("switches to the teacher contract and requires institutional fields", () => {
    renderRegister();

    fireEvent.change(screen.getByLabelText("Account type"), {
      target: { value: "TEACHER" },
    });

    expect(screen.queryByLabelText("Student ID")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Department")).toBeVisible();

    fireEvent.change(screen.getByLabelText("First name"), {
      target: { value: "Grace" },
    });
    fireEvent.change(screen.getByLabelText("Last name"), {
      target: { value: "Hopper" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "grace@example.edu" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Password123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "Password123!" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      screen.getByText(
        "University name and department are required for teacher accounts.",
      ),
    ).toBeVisible();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("normalizes a valid student registration, stores the OTP session, and routes to verification", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        message: "OTP sent",
        registration_id: "reg_student_100",
        email: "ada@example.edu",
        role: "STUDENT",
        expires_in_seconds: 600,
      },
    } as never);

    renderRegister();
    fillValidStudent();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(API_ROUTES.auth.register, {
        role: "STUDENT",
        first_name: "Ada",
        last_name: "Lovelace",
        student_id: "STU-100",
        email: "ada@example.edu",
        university_name: "Example University",
        password: "Password123!",
        consent: true,
      }),
    );

    expect(useRegistrationStore.getState().session).toEqual(
      expect.objectContaining({
        registrationId: "reg_student_100",
        email: "ada@example.edu",
        role: "STUDENT",
        expiresAt: expect.any(Number),
      }),
    );
    expect(showToast).toHaveBeenCalledWith({
      type: "success",
      title: "OTP sent",
      message: "Check your email to complete TypeTrace registration.",
    });
    expect(navigate).toHaveBeenCalledWith(ROUTES.VERIFY_OTP, { replace: true });
  });

  it("surfaces a controlled registration failure and keeps the form usable", async () => {
    vi.mocked(api.post).mockRejectedValue(new Error("registration offline"));

    renderRegister();
    fillValidStudent();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith({
        type: "error",
        title: "Registration failed",
        message: "Registration unavailable.",
      }),
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(useRegistrationStore.getState().session).toBeNull();
    expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled();
  });
});
