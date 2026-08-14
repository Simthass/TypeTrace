import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "../pages/SettingsPage";
import { API_ROUTES } from "../constants/apiRoutes";
import { api } from "../lib/api";

const {
  toastSuccess,
  toastError,
  toastWarning,
  setUser,
  logout,
  navigate,
} = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
  setUser: vi.fn(),
  logout: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("../components/ui/ToastContext", () => ({
  useToast: () => ({
    success: toastSuccess,
    error: toastError,
    warning: toastWarning,
  }),
}));

vi.mock("../store/authStore", () => ({
  useAuthStore: () => ({
    user: {
      id: "student-1",
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.edu",
      role: "STUDENT",
      is_verified: true,
      university_name: "University of Bedfordshire",
      department: "Computing",
    },
    setUser,
    logout,
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      get: vi.fn(),
      patch: vi.fn(),
      post: vi.fn(),
    },
  };
});

function renderSettings() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe("SettingsPage", () => {
  const originalCreateObjectURL = window.URL.createObjectURL;
  const originalRevokeObjectURL = window.URL.revokeObjectURL;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });
    vi.restoreAllMocks();
  });

  it("edits the profile, saves the normalized account payload, and updates the auth store", async () => {
    const updatedProfile = {
      id: "student-1",
      first_name: "Augusta",
      last_name: "Lovelace",
      email: "ada@example.edu",
      role: "STUDENT",
      university_name: "University of Bedfordshire",
      department: "Computing",
    };
    vi.mocked(api.patch).mockResolvedValue({
      data: { profile: updatedProfile },
    } as never);

    renderSettings();

    expect(screen.getByText("Profile Information")).toBeVisible();
    expect(screen.getByRole("link", { name: /Back to Dashboard/ })).toHaveAttribute(
      "href",
      "/dashboard",
    );

    fireEvent.change(screen.getByLabelText("First Name"), {
      target: { value: "Augusta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(API_ROUTES.user.profile, {
        first_name: "Augusta",
        last_name: "Lovelace",
        university_name: "University of Bedfordshire",
        department: "Computing",
      }),
    );
    expect(setUser).toHaveBeenCalledWith(updatedProfile);
    expect(toastSuccess).toHaveBeenCalledWith(
      "Profile updated",
      "Your account details were saved.",
    );
  });

  it("rejects mismatched new passwords locally without contacting the password endpoint", () => {
    renderSettings();

    fireEvent.click(screen.getByRole("tab", { name: "Security" }));
    fireEvent.change(screen.getByLabelText("Current Password"), {
      target: { value: "Current123" },
    });
    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "NewPass123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "Different123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(api.post).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      "Password mismatch",
      "New passwords do not match.",
    );
  });

  it("changes a valid password, invalidates the local session, and routes back to login", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { status: "ok" } } as never);

    renderSettings();

    fireEvent.click(screen.getByRole("tab", { name: "Security" }));
    fireEvent.change(screen.getByLabelText("Current Password"), {
      target: { value: "Current123" },
    });
    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "NewPass123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "NewPass123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(API_ROUTES.user.changePassword, {
        current_password: "Current123",
        new_password: "NewPass123",
      }),
    );
    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/login", { replace: true });
    expect(toastSuccess).toHaveBeenCalledWith(
      "Password changed",
      "Sign in again. All previously issued sessions are now invalid.",
    );
  });

  it("exports the portable account record as JSON and revokes the temporary object URL", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { status: "ok", sessions: [], certificates: [] },
    } as never);

    const createObjectURL = vi.fn(() => "blob:typetrace-export");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    renderSettings();

    fireEvent.click(screen.getByRole("tab", { name: "Data & Export" }));
    fireEvent.click(screen.getByRole("button", { name: "Download JSON" }));

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(API_ROUTES.user.dataExport),
    );
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:typetrace-export");
    expect(toastSuccess).toHaveBeenCalledWith(
      "Export ready",
      "Your data has been downloaded.",
    );
  });
});
