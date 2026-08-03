import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosHeaders, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AuthSessionGate from "../components/guards/AuthSessionGate";
import { api } from "../lib/api";
import { useAuthStore, type AuthUser } from "../store/authStore";

const student: AuthUser = {
  id: "student-a",
  first_name: "Student",
  last_name: "User",
  email: "student@example.com",
  role: "STUDENT",
  is_verified: true,
};

function axiosFailure(status: number) {
  return {
    isAxiosError: true,
    message: `Request failed with status code ${status}`,
    response: {
      status,
      data: {
        detail: status >= 500 ? "Service unavailable." : "Invalid session.",
      },
    },
    toJSON: () => ({}),
  };
}

describe("AuthSessionGate", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: student,
      token: "persisted-token",
      isAuthenticated: true,
      hasHydrated: true,
    });
  });

  it("preserves the persisted session during a transient server failure", async () => {
    const successResponse: AxiosResponse<{
      valid: boolean;
      user: AuthUser;
    }> = {
      data: { valid: true, user: student },
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: new AxiosHeaders() },
    };
    const get = vi
      .spyOn(api, "get")
      .mockRejectedValueOnce(axiosFailure(503))
      .mockResolvedValueOnce(successResponse);

    render(
      <AuthSessionGate>
        <div>Protected content</div>
      </AuthSessionGate>,
    );

    expect(
      await screen.findByText("Session verification unavailable"),
    ).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBe("persisted-token");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Retry verification" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Protected content")).toBeInTheDocument();
    });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("removes a session only when the server confirms it is unauthorized", async () => {
    vi.spyOn(api, "get").mockRejectedValueOnce(axiosFailure(401));

    render(
      <AuthSessionGate>
        <div>Protected content</div>
      </AuthSessionGate>,
    );

    await waitFor(() => {
      expect(useAuthStore.getState().token).toBeNull();
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
