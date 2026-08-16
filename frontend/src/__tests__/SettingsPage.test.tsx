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
  clearLocalAccountData,
} = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
  setUser: vi.fn(),
  logout: vi.fn(),
  navigate: vi.fn(),
  clearLocalAccountData: vi.fn(),
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

vi.mock("../lib/accountLocalCleanup", () => ({
  clearLocalAccountData,
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
      delete: vi.fn(),
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

function prepareDownloadMocks(prefix = "export") {
  const createObjectURL = vi.fn(() => `blob:typetrace-${prefix}`);
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
  return { createObjectURL, revokeObjectURL, click };
}

describe("SettingsPage", () => {
  const originalCreateObjectURL = window.URL.createObjectURL;
  const originalRevokeObjectURL = window.URL.revokeObjectURL;
  const originalConfirm = window.confirm;

  beforeEach(() => {
    vi.clearAllMocks();
    clearLocalAccountData.mockResolvedValue({
      deletedDraftCount: 0,
      failures: [],
    });
    Object.defineProperty(window, "confirm", {
      configurable: true,
      writable: true,
      value: vi.fn(() => true),
    });
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
    Object.defineProperty(window, "confirm", {
      configurable: true,
      writable: true,
      value: originalConfirm,
    });
    vi.restoreAllMocks();
  });

  it("edits the profile, saves the account payload, and updates the auth store", async () => {
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

  it("surfaces a controlled profile error when the API omits the updated profile", async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { status: "success" } } as never);
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Update failed",
        "Something went wrong. Please try again.",
      ),
    );
    expect(setUser).not.toHaveBeenCalled();
  });

  it("rejects mismatched and weak new passwords locally", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("tab", { name: "Security" }));

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "NewPass123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "Different123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));
    expect(toastError).toHaveBeenCalledWith(
      "Password mismatch",
      "New passwords do not match.",
    );

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "weak" },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "weak" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(toastWarning).toHaveBeenCalledWith(
      "Weak password",
      "Use 8–128 characters with at least one letter and one number.",
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it("changes a valid password, invalidates the local session, and routes to login", async () => {
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

  it("reports password API failures without logging out", async () => {
    vi.mocked(api.post).mockRejectedValue(new Error("password endpoint down"));
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

    await waitFor(() => expect(toastError).toHaveBeenCalledWith(
      "Update failed",
      "Something went wrong. Please try again.",
    ));
    expect(logout).not.toHaveBeenCalled();
  });

  it("exports the portable account record and revokes the temporary object URL", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { status: "ok", sessions: [], certificates: [] },
    } as never);
    const { createObjectURL, revokeObjectURL, click } = prepareDownloadMocks();

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

  it("validates sensitive-export password and explicit EXPORT confirmation", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("tab", { name: "Data & Export" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Download sensitive JSON" }),
    );
    expect(toastWarning).toHaveBeenCalledWith(
      "Password required",
      expect.stringContaining("current password"),
    );

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "Current123" },
    });
    fireEvent.change(screen.getByLabelText("Type EXPORT to confirm"), {
      target: { value: "not export" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Download sensitive JSON" }),
    );

    expect(toastWarning).toHaveBeenCalledWith(
      "Confirmation required",
      "Type EXPORT exactly to confirm the sensitive data export.",
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it("downloads sensitive evidence only after re-authentication confirmation", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { status: "success", privacy: { include_sensitive: true } },
    } as never);
    const { revokeObjectURL } = prepareDownloadMocks("sensitive-export");
    renderSettings();

    fireEvent.click(screen.getByRole("tab", { name: "Data & Export" }));
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "Current123" },
    });
    fireEvent.change(screen.getByLabelText("Type EXPORT to confirm"), {
      target: { value: " export " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Download sensitive JSON" }),
    );

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(API_ROUTES.user.sensitiveDataExport, {
        current_password: "Current123",
        confirmation: "EXPORT",
      }),
    );
    expect(revokeObjectURL).toHaveBeenCalledWith(
      "blob:typetrace-sensitive-export",
    );
    expect(toastSuccess).toHaveBeenCalledWith(
      "Sensitive export ready",
      "Essay text and raw evidence were exported after re-authentication.",
    );
    expect(screen.getByLabelText("Current password")).toHaveValue("");
  });

  it("validates anonymization credentials before any destructive request", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("tab", { name: "Danger Zone" }));
    fireEvent.click(screen.getByRole("button", { name: "Anonymize Account" }));
    expect(toastWarning).toHaveBeenCalledWith(
      "Password required",
      expect.stringContaining("current password"),
    );

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "Current123" },
    });
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "no" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anonymize Account" }));

    expect(toastWarning).toHaveBeenCalledWith(
      "Confirmation required",
      "Type DELETE exactly to confirm account anonymization.",
    );
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("honors the final browser confirmation before account anonymization", () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    renderSettings();
    fireEvent.click(screen.getByRole("tab", { name: "Danger Zone" }));
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "Current123" },
    });
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "DELETE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anonymize Account" }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("anonymizes the account, clears local drafts, and returns to login", async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: { status: "success" } } as never);
    clearLocalAccountData.mockResolvedValue({
      deletedDraftCount: 2,
      failures: [],
    });
    renderSettings();

    fireEvent.click(screen.getByRole("tab", { name: "Danger Zone" }));
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "Current123" },
    });
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: " delete " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anonymize Account" }));

    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith(API_ROUTES.user.account, {
        data: {
          password: "Current123",
          confirmation: "DELETE",
        },
      }),
    );
    expect(clearLocalAccountData).toHaveBeenCalledWith("student-1");
    expect(toastSuccess).toHaveBeenCalledWith(
      "Account anonymized",
      "Your login identity and 2 local drafts were removed.",
    );
    expect(navigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  it("warns when server anonymization succeeds but browser cleanup is incomplete", async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: { status: "success" } } as never);
    clearLocalAccountData.mockResolvedValue({
      deletedDraftCount: 1,
      failures: ["indexedDB"],
    });
    renderSettings();

    fireEvent.click(screen.getByRole("tab", { name: "Danger Zone" }));
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "Current123" },
    });
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "DELETE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Anonymize Account" }));

    await waitFor(() => expect(clearLocalAccountData).toHaveBeenCalledTimes(1));
    expect(toastWarning).toHaveBeenCalledWith(
      "Account anonymized",
      expect.stringContaining("browser storage"),
    );
    expect(navigate).toHaveBeenCalledWith("/login", { replace: true });
  });
});
