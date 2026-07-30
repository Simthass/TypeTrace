import { beforeEach, describe, expect, it } from "vitest";

import { useAuthStore, type AuthUser } from "../store/authStore";

const student: AuthUser = {
  id: "10",
  first_name: "Test",
  email: "student@example.com",
  role: "STUDENT",
  is_verified: true,
};

function resetStore() {
  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    hasHydrated: true,
  });
}

describe("authStore", () => {
  beforeEach(() => {
    resetStore();
  });

  it("normalizes and stores a successful login", () => {
    useAuthStore.getState().login(student, "token");

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe("token");
    expect(state.user?.last_name).toBe("");
    expect(state.user?.student_id).toBeNull();
    expect(state.isStudent()).toBe(true);
    expect(state.isTeacher()).toBe(false);
  });

  it("clears all authentication state during logout", () => {
    useAuthStore.getState().login(student, "token");
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("does not mark a user authenticated without a token", () => {
    useAuthStore.getState().setUser(student);

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });


});
