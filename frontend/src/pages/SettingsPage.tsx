// frontend/src/pages/SettingsPage.tsx

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api, getApiErrorMessage } from "../lib/api";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";
import { useAuthStore } from "../store/authStore";
import type {
  AccountProfile,
  AccountProfileResponse,
  AccountProfileUpdateResponse,
  PrivacySummaryResponse,
} from "../types/account";

type SettingsTab = "profile" | "security" | "privacy" | "danger";

function BackIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function MessageBox({
  type,
  message,
}: {
  type: "success" | "error" | "info";
  message: string;
}) {
  const style =
    type === "success"
      ? {
          border: brand.humanAccent,
          bg: brand.humanBg,
          text: brand.humanText,
        }
      : type === "error"
        ? {
            border: brand.aiAccent,
            bg: brand.aiBg,
            text: brand.aiText,
          }
        : {
            border: colors.surface[200],
            bg: colors.surface[50],
            text: colors.text.secondary,
          };

  return (
    <div
      className="rounded-md border px-4 py-3 text-[13px]"
      style={{
        borderColor: style.border,
        background: style.bg,
        color: style.text,
      }}
    >
      {message}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="text-[11px] font-semibold uppercase tracking-[0.12em]"
      style={{ color: colors.text.secondary }}
    >
      {children}
    </label>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const authUser = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const login = useAuthStore((state) => state.login);
  const token = useAuthStore((state) => state.token);

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [summary, setSummary] = useState<
    AccountProfileResponse["summary"] | null
  >(null);
  const [privacy, setPrivacy] = useState<
    PrivacySummaryResponse["privacy"] | null
  >(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [universityName, setUniversityName] = useState("");
  const [department, setDepartment] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [apiError, setApiError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const homeRoute = useMemo(() => {
    if (authUser?.role === "TEACHER") return ROUTES.TEACHER_DASHBOARD;
    return ROUTES.DASHBOARD;
  }, [authUser?.role]);

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      setIsLoading(true);
      setApiError(null);

      try {
        const [profileResponse, privacyResponse] = await Promise.all([
          api.get<AccountProfileResponse>("/user/profile"),
          api.get<PrivacySummaryResponse>("/user/privacy"),
        ]);

        if (!mounted) return;

        const loadedProfile = profileResponse.data.profile;

        setProfile(loadedProfile);
        setSummary(profileResponse.data.summary);
        setPrivacy(privacyResponse.data.privacy);

        setFirstName(loadedProfile.first_name || "");
        setLastName(loadedProfile.last_name || "");
        setUniversityName(loadedProfile.university_name || "");
        setDepartment(loadedProfile.department || "");
      } catch (error) {
        if (!mounted) return;
        setApiError(getApiErrorMessage(error));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  const clearMessages = () => {
    setApiError(null);
    setSuccessMsg(null);
  };

  const handleProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();
    clearMessages();

    if (!firstName.trim()) {
      setApiError("First name is required.");
      return;
    }

    setIsSavingProfile(true);

    try {
      const response = await api.patch<AccountProfileUpdateResponse>(
        "/user/profile",
        {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          university_name: universityName.trim() || null,
          department: department.trim() || null,
        },
      );

      const updatedProfile = response.data.profile;

      setProfile(updatedProfile);
      setSuccessMsg(response.data.message || "Profile updated successfully.");

      if (authUser && token) {
        login(
          {
            ...authUser,
            first_name: updatedProfile.first_name,
            last_name: updatedProfile.last_name,
          },
          token,
        );
      }
    } catch (error) {
      setApiError(getApiErrorMessage(error));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    clearMessages();

    if (newPassword.length < 8) {
      setApiError("New password must contain at least 8 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setApiError("New password and confirmation do not match.");
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await api.post<{ message: string }>(
        "/user/change-password",
        {
          current_password: currentPassword,
          new_password: newPassword,
        },
      );

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setSuccessMsg(response.data.message || "Password changed successfully.");
    } catch (error) {
      setApiError(getApiErrorMessage(error));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleExport = async () => {
    clearMessages();
    setIsExporting(true);

    try {
      const response = await api.get("/user/data-export");

      const json = JSON.stringify(response.data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);

      const dateStamp = new Date().toISOString().slice(0, 10);
      const filename = `typetrace-data-export-${dateStamp}.json`;

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);

      setSuccessMsg("Data export downloaded successfully.");
    } catch (error) {
      setApiError(getApiErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async (event: FormEvent) => {
    event.preventDefault();
    clearMessages();

    if (deleteConfirmation.trim().toUpperCase() !== "DELETE") {
      setApiError("Type DELETE to confirm account removal.");
      return;
    }

    setIsDeleting(true);

    try {
      await api.delete("/user/account", {
        data: {
          password: deletePassword,
          confirmation: deleteConfirmation,
        },
      });

      logout();
      navigate(ROUTES.LOGIN);
    } catch (error) {
      setApiError(getApiErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  };

  const tabs: Array<{
    id: SettingsTab;
    label: string;
    icon: React.ReactNode;
  }> = [
    { id: "profile", label: "Profile", icon: <UserIcon /> },
    { id: "security", label: "Security", icon: <LockIcon /> },
    { id: "privacy", label: "Privacy", icon: <ShieldIcon /> },
    { id: "danger", label: "Danger Zone", icon: <TrashIcon /> },
  ];

  return (
    <div
      className="min-h-screen px-6 py-8"
      style={{ background: colors.surface[50] }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <Link
              to={homeRoute}
              className="inline-flex items-center gap-2 text-[13px] font-semibold"
              style={{ color: colors.brand }}
            >
              <BackIcon />
              Back to dashboard
            </Link>

            <p
              className="mt-6 text-[12px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: colors.text.secondary }}
            >
              Account settings
            </p>

            <h1
              className="mt-2 text-2xl font-semibold"
              style={{ color: colors.text.primary }}
            >
              Profile, Security & Privacy
            </h1>

            <p
              className="mt-2 max-w-2xl text-[14px]"
              style={{ color: colors.text.secondary }}
            >
              Manage your TypeTrace profile, password, personal data export, and
              privacy controls.
            </p>
          </div>

          {profile && (
            <div
              className="rounded-md border bg-white px-4 py-3 text-left md:text-right"
              style={{ borderColor: colors.surface[200] }}
            >
              <p
                className="text-[13px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                {profile.first_name} {profile.last_name}
              </p>
              <p
                className="mt-1 text-[12px]"
                style={{ color: colors.text.secondary }}
              >
                {profile.role} · {profile.email}
              </p>
            </div>
          )}
        </div>

        {apiError && (
          <div className="mt-6">
            <MessageBox type="error" message={apiError} />
          </div>
        )}
        {successMsg && (
          <div className="mt-6">
            <MessageBox type="success" message={successMsg} />
          </div>
        )}

        {isLoading ? (
          <div
            className="mt-6 rounded-md border bg-white px-5 py-10 text-center text-[13px]"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.secondary,
            }}
          >
            Loading account settings...
          </div>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-[260px_1fr]">
            <aside
              className="rounded-md border bg-white p-3 shadow-sm"
              style={{ borderColor: colors.surface[200] }}
            >
              <div className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      clearMessages();
                      setActiveTab(tab.id);
                    }}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13px] font-semibold"
                    style={{
                      background:
                        activeTab === tab.id ? brand.bgNavActive : "#FFFFFF",
                      color:
                        activeTab === tab.id
                          ? colors.brand
                          : colors.text.secondary,
                    }}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </aside>

            <main className="space-y-5">
              {activeTab === "profile" && (
                <>
                  <div
                    className="rounded-md border bg-white p-5 shadow-sm"
                    style={{ borderColor: colors.surface[200] }}
                  >
                    <h2
                      className="text-[16px] font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      Profile details
                    </h2>
                    <p
                      className="mt-1 text-[13px]"
                      style={{ color: colors.text.secondary }}
                    >
                      Update your personal and institution details. Email, role,
                      and Student ID are locked for integrity.
                    </p>

                    <form
                      onSubmit={handleProfileSubmit}
                      className="mt-5 grid gap-4"
                    >
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <FieldLabel>First name</FieldLabel>
                          <input
                            value={firstName}
                            onChange={(event) =>
                              setFirstName(event.target.value)
                            }
                            className="mt-2 w-full rounded-md border px-3 py-2 text-[13px] outline-none"
                            style={{
                              borderColor: colors.surface[200],
                              color: colors.text.primary,
                            }}
                          />
                        </div>

                        <div>
                          <FieldLabel>Last name</FieldLabel>
                          <input
                            value={lastName}
                            onChange={(event) =>
                              setLastName(event.target.value)
                            }
                            className="mt-2 w-full rounded-md border px-3 py-2 text-[13px] outline-none"
                            style={{
                              borderColor: colors.surface[200],
                              color: colors.text.primary,
                            }}
                          />
                        </div>

                        <div>
                          <FieldLabel>Email</FieldLabel>
                          <input
                            value={profile?.email || ""}
                            disabled
                            className="mt-2 w-full rounded-md border px-3 py-2 text-[13px] outline-none disabled:cursor-not-allowed"
                            style={{
                              borderColor: colors.surface[200],
                              color: colors.text.secondary,
                              background: colors.surface[100],
                            }}
                          />
                        </div>

                        <div>
                          <FieldLabel>Role</FieldLabel>
                          <input
                            value={profile?.role || ""}
                            disabled
                            className="mt-2 w-full rounded-md border px-3 py-2 text-[13px] outline-none disabled:cursor-not-allowed"
                            style={{
                              borderColor: colors.surface[200],
                              color: colors.text.secondary,
                              background: colors.surface[100],
                            }}
                          />
                        </div>

                        {profile?.role === "STUDENT" && (
                          <div>
                            <FieldLabel>Student ID</FieldLabel>
                            <input
                              value={profile?.student_id || ""}
                              disabled
                              className="mt-2 w-full rounded-md border px-3 py-2 text-[13px] outline-none disabled:cursor-not-allowed"
                              style={{
                                borderColor: colors.surface[200],
                                color: colors.text.secondary,
                                background: colors.surface[100],
                              }}
                            />
                          </div>
                        )}

                        <div>
                          <FieldLabel>Institution</FieldLabel>
                          <input
                            value={universityName}
                            onChange={(event) =>
                              setUniversityName(event.target.value)
                            }
                            className="mt-2 w-full rounded-md border px-3 py-2 text-[13px] outline-none"
                            style={{
                              borderColor: colors.surface[200],
                              color: colors.text.primary,
                            }}
                          />
                        </div>

                        <div>
                          <FieldLabel>Department</FieldLabel>
                          <input
                            value={department}
                            onChange={(event) =>
                              setDepartment(event.target.value)
                            }
                            className="mt-2 w-full rounded-md border px-3 py-2 text-[13px] outline-none"
                            style={{
                              borderColor: colors.surface[200],
                              color: colors.text.primary,
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isSavingProfile}
                          className="rounded-md px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
                          style={{ background: colors.brand }}
                        >
                          {isSavingProfile ? "Saving..." : "Save profile"}
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    {[
                      ["Sessions", summary?.total_sessions ?? 0],
                      ["Certificates", summary?.certificate_count ?? 0],
                      [
                        "Writing Time",
                        formatDuration(summary?.total_seconds ?? 0),
                      ],
                      ["Avg Confidence", `${summary?.avg_confidence ?? 0}%`],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="rounded-md border bg-white px-4 py-3"
                        style={{ borderColor: colors.surface[200] }}
                      >
                        <p
                          className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                          style={{ color: colors.text.secondary }}
                        >
                          {label}
                        </p>
                        <p
                          className="mt-1 text-[18px] font-semibold"
                          style={{ color: colors.text.primary }}
                        >
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === "security" && (
                <div
                  className="rounded-md border bg-white p-5 shadow-sm"
                  style={{ borderColor: colors.surface[200] }}
                >
                  <h2
                    className="text-[16px] font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    Change password
                  </h2>
                  <p
                    className="mt-1 text-[13px]"
                    style={{ color: colors.text.secondary }}
                  >
                    Use a strong password with at least 8 characters.
                  </p>

                  <form
                    onSubmit={handlePasswordSubmit}
                    className="mt-5 grid gap-4"
                  >
                    <div>
                      <FieldLabel>Current password</FieldLabel>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(event) =>
                          setCurrentPassword(event.target.value)
                        }
                        className="mt-2 w-full rounded-md border px-3 py-2 text-[13px] outline-none"
                        style={{
                          borderColor: colors.surface[200],
                          color: colors.text.primary,
                        }}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <FieldLabel>New password</FieldLabel>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(event) =>
                            setNewPassword(event.target.value)
                          }
                          className="mt-2 w-full rounded-md border px-3 py-2 text-[13px] outline-none"
                          style={{
                            borderColor: colors.surface[200],
                            color: colors.text.primary,
                          }}
                        />
                      </div>

                      <div>
                        <FieldLabel>Confirm new password</FieldLabel>
                        <input
                          type="password"
                          value={confirmNewPassword}
                          onChange={(event) =>
                            setConfirmNewPassword(event.target.value)
                          }
                          className="mt-2 w-full rounded-md border px-3 py-2 text-[13px] outline-none"
                          style={{
                            borderColor: colors.surface[200],
                            color: colors.text.primary,
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isChangingPassword}
                        className="rounded-md px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
                        style={{ background: colors.brand }}
                      >
                        {isChangingPassword ? "Updating..." : "Change password"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === "privacy" && (
                <>
                  <div
                    className="rounded-md border bg-white p-5 shadow-sm"
                    style={{ borderColor: colors.surface[200] }}
                  >
                    <h2
                      className="text-[16px] font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      Privacy overview
                    </h2>
                    <p
                      className="mt-1 text-[13px]"
                      style={{ color: colors.text.secondary }}
                    >
                      TypeTrace stores writing-process evidence to verify
                      authorship and preserve academic integrity.
                    </p>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      {[
                        ["Sessions", privacy?.total_sessions ?? 0],
                        [
                          "Keystroke logs",
                          privacy?.sessions_with_keystrokes ?? 0,
                        ],
                        ["Certificates", privacy?.certificates ?? 0],
                        ["Total keystrokes", privacy?.total_keystrokes ?? 0],
                        [
                          "Course enrollments",
                          privacy?.course_enrollments ?? 0,
                        ],
                        ["Owned courses", privacy?.owned_courses ?? 0],
                      ].map(([label, value]) => (
                        <div
                          key={String(label)}
                          className="rounded-md border px-3 py-2"
                          style={{ borderColor: colors.surface[200] }}
                        >
                          <p
                            className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                            style={{ color: colors.text.secondary }}
                          >
                            {label}
                          </p>
                          <p
                            className="mt-1 text-[15px] font-semibold"
                            style={{ color: colors.text.primary }}
                          >
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    className="rounded-md border bg-white p-5 shadow-sm"
                    style={{ borderColor: colors.surface[200] }}
                  >
                    <h2
                      className="text-[16px] font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      Data categories
                    </h2>

                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {(privacy?.data_categories || []).map((category) => (
                        <div
                          key={category}
                          className="rounded-md border px-3 py-2 text-[13px] font-semibold"
                          style={{
                            borderColor: colors.surface[200],
                            color: colors.text.primary,
                          }}
                        >
                          {category}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleExport}
                      disabled={isExporting}
                      className="mt-5 inline-flex items-center gap-2 rounded-md px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
                      style={{ background: colors.brand }}
                    >
                      <DownloadIcon />
                      {isExporting ? "Exporting..." : "Download my data"}
                    </button>
                  </div>
                </>
              )}

              {activeTab === "danger" && (
                <div
                  className="rounded-md border bg-white p-5 shadow-sm"
                  style={{ borderColor: brand.aiAccent }}
                >
                  <h2
                    className="text-[16px] font-semibold"
                    style={{ color: brand.aiText }}
                  >
                    Account removal
                  </h2>
                  <p
                    className="mt-2 text-[13px]"
                    style={{ color: colors.text.secondary }}
                  >
                    This anonymizes your account identity and disables login.
                    Academic evidence, certificates, document hashes, and
                    teacher review records are preserved for institutional
                    integrity.
                  </p>

                  <div className="mt-4">
                    <MessageBox
                      type="info"
                      message="This action does not erase academic evidence. It removes your personal identity from the account while preserving verification records."
                    />
                  </div>

                  <form
                    onSubmit={handleDeleteAccount}
                    className="mt-5 grid gap-4"
                  >
                    <div>
                      <FieldLabel>Password</FieldLabel>
                      <input
                        type="password"
                        value={deletePassword}
                        onChange={(event) =>
                          setDeletePassword(event.target.value)
                        }
                        className="mt-2 w-full rounded-md border px-3 py-2 text-[13px] outline-none"
                        style={{
                          borderColor: colors.surface[200],
                          color: colors.text.primary,
                        }}
                      />
                    </div>

                    <div>
                      <FieldLabel>Type DELETE to confirm</FieldLabel>
                      <input
                        value={deleteConfirmation}
                        onChange={(event) =>
                          setDeleteConfirmation(event.target.value)
                        }
                        className="mt-2 w-full rounded-md border px-3 py-2 text-[13px] outline-none"
                        style={{
                          borderColor: colors.surface[200],
                          color: colors.text.primary,
                        }}
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isDeleting}
                        className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
                        style={{ background: colors.red }}
                      >
                        <TrashIcon />
                        {isDeleting ? "Removing..." : "Remove account"}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
