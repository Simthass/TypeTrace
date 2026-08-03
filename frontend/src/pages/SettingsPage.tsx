import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api, getApiErrorMessage } from "../lib/api";
import { clearLocalAccountData } from "../lib/accountLocalCleanup";
import { isStrongEnoughPassword } from "../lib/edgeCases";
import { useToast } from "../components/ui/ToastContext";
import { ROUTES } from "../constants/routes";
import { useAuthStore } from "../store/authStore";
import { brand, colors } from "../styles/colors";
import { API_ROUTES } from "../constants/apiRoutes";

// ─── Icon Helpers ──────────────────────────────────────────────────────────────

function Icon({
  type,
  size = 16,
  className = "",
}: {
  type: string;
  size?: number;
  className?: string;
}) {
  const paths: Record<string, ReactNode> = {
    arrowLeft: <path d="m15 18-6-6 6-6" />,
    user: (
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    mail: (
      <>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-10 7L2 7" />
      </>
    ),
    lock: (
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    download: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="M7 10l5 5 5-5" />
        <path d="M12 15V3" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </>
    ),
    check: <path d="M20 6 9 17l-5-5" />,
    warning: (
      <>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    external: (
      <>
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <path d="M15 3h6v6" />
        <path d="M10 14 21 3" />
      </>
    ),
    key: (
      <>
        <circle cx="7.5" cy="15.5" r="5.5" />
        <path d="m13.5 9.5 6 6" />
        <path d="m17 13 3-3" />
        <path d="m20 10 3-3" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {paths[type] ?? null}
    </svg>
  );
}

// ─── UI Components ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  description,
  children,
  rightElement,
}: {
  title: string;
  description: string;
  children: ReactNode;
  rightElement?: ReactNode;
}) {
  return (
    <div
      className="rounded-xl border bg-white p-4 transition-all hover:shadow-md sm:p-6"
      style={{
        borderColor: colors.surface[200],
        boxShadow:
          "0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 1px 0 rgba(0, 0, 0, 0.02)",
      }}
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3
            className="text-[15px] font-bold tracking-tight"
            style={{ color: colors.text.primary }}
          >
            {title}
          </h3>
          <p
            className="mt-0.5 text-[13px] leading-relaxed"
            style={{ color: colors.text.secondary }}
          >
            {description}
          </p>
        </div>
        {rightElement && <div>{rightElement}</div>}
      </div>
      {children}
    </div>
  );
}

// Modern 2026 Input - Minimal, clean, focused ring.
function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span
        className="block text-[12px] font-medium"
        style={{ color: colors.text.secondary }}
      >
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 block w-full rounded-lg border bg-white px-3 py-2 text-[14px] outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-brand/50"
        style={{
          borderColor: colors.surface[200],
          color: colors.text.primary,
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)",
        }}
      />
    </label>
  );
}

function Badge({
  children,
  color = colors.brand,
  bg = colors.brandSoft,
}: {
  children: ReactNode;
  color?: string;
  bg?: string;
}) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ backgroundColor: bg, color: color }}
    >
      {children}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initialsFor(firstName?: string, lastName?: string) {
  const first = String(firstName || "").trim();
  const last = String(lastName || "").trim();
  return `${first[0] || "S"}${last[0] || ""}`.toUpperCase();
}

// ─── Page Component ──────────────────────────────────────────────────────────

type SettingsTab = "profile" | "security" | "data" | "danger";

const SETTINGS_TABS: ReadonlyArray<{
  id: SettingsTab;
  label: string;
  icon: string;
}> = [
  { id: "profile", label: "Profile", icon: "user" },
  { id: "security", label: "Security", icon: "lock" },
  { id: "data", label: "Data & Export", icon: "download" },
  { id: "danger", label: "Danger Zone", icon: "trash" },
];

export default function SettingsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuthStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSensitiveExporting, setIsSensitiveExporting] = useState(false);
  const [sensitiveExportForm, setSensitiveExportForm] = useState({
    current_password: "",
    confirmation: "",
  });

  const [profile, setProfile] = useState({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    university_name: user?.university_name || "",
    department: user?.department || "",
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [deleteForm, setDeleteForm] = useState({
    password: "",
    confirmation: "",
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Handlers ──
  const saveProfile = async () => {
    setIsSaving(true);
    try {
      const response = await api.patch(API_ROUTES.user.profile, profile);
      if (!response.data.profile) {
        throw new Error("Profile update response did not include the updated profile.");
      }
      setUser(response.data.profile);
      toast.success("Profile updated", "Your account details were saved.");
    } catch (error) {
      toast.error("Update failed", getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const changePassword = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("Password mismatch", "New passwords do not match.");
      return;
    }
    if (!isStrongEnoughPassword(passwordForm.new_password)) {
      toast.warning(
        "Weak password",
        "Use 8–128 characters with at least one letter and one number.",
      );
      return;
    }

    setIsSaving(true);
    try {
      await api.post(API_ROUTES.user.changePassword, {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      toast.success(
        "Password changed",
        "Sign in again. All previously issued sessions are now invalid.",
      );
      logout();
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (error) {
      toast.error("Update failed", getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const exportData = async () => {
    setIsExporting(true);
    try {
      const response = await api.get(API_ROUTES.user.dataExport);
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "typetrace-export.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Export ready", "Your data has been downloaded.");
    } catch (error) {
      toast.error("Export failed", getApiErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  };

  const exportSensitiveData = async () => {
    if (!sensitiveExportForm.current_password) {
      toast.warning(
        "Password required",
        "Enter your current password before exporting essay text and raw keystroke evidence.",
      );
      return;
    }
    if (sensitiveExportForm.confirmation.trim().toUpperCase() !== "EXPORT") {
      toast.warning(
        "Confirmation required",
        "Type EXPORT exactly to confirm the sensitive data export.",
      );
      return;
    }

    setIsSensitiveExporting(true);
    try {
      const response = await api.post(API_ROUTES.user.sensitiveDataExport, {
        current_password: sensitiveExportForm.current_password,
        confirmation: "EXPORT",
      });
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "typetrace-sensitive-export.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSensitiveExportForm({ current_password: "", confirmation: "" });
      toast.success(
        "Sensitive export ready",
        "Essay text and raw evidence were exported after re-authentication.",
      );
    } catch (error) {
      toast.error("Sensitive export failed", getApiErrorMessage(error));
    } finally {
      setIsSensitiveExporting(false);
    }
  };

  const deleteAccount = async () => {
    if (!deleteForm.password) {
      toast.warning(
        "Password required",
        "Enter your current password before anonymizing the account.",
      );
      return;
    }
    if (deleteForm.confirmation.trim().toUpperCase() !== "DELETE") {
      toast.warning(
        "Confirmation required",
        "Type DELETE exactly to confirm account anonymization.",
      );
      return;
    }
    if (
      !window.confirm(
        "Your login identity will be anonymized and access will be disabled. Academic evidence is retained for institutional integrity. Continue?",
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const deletedUserId = user?.id ?? null;
      await api.delete(API_ROUTES.user.account, {
        data: {
          password: deleteForm.password,
          confirmation: deleteForm.confirmation.trim().toUpperCase(),
        },
      });
      setDeleteForm({ password: "", confirmation: "" });
      const cleanup = await clearLocalAccountData(deletedUserId);
      if (cleanup.failures.length > 0) {
        toast.warning(
          "Account anonymized",
          "The server account was anonymized, but some browser storage could not be cleared automatically. Clear this site's browser data before leaving the device.",
        );
      } else {
        toast.success(
          "Account anonymized",
          `Your login identity and ${cleanup.deletedDraftCount} local draft${cleanup.deletedDraftCount === 1 ? "" : "s"} were removed.`,
        );
      }
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (error) {
      toast.error("Anonymization failed", getApiErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Computed ──
  const displayName =
    `${profile.first_name || "Student"} ${profile.last_name || ""}`.trim() ||
    "Student account";
  const initials = initialsFor(profile.first_name, profile.last_name);
  const accountHomeRoute =
    user?.role === "TEACHER" ? ROUTES.TEACHER_DASHBOARD : ROUTES.DASHBOARD;

  return (
    <div
      className="min-h-screen bg-gray-50/80"
      style={{ backgroundColor: colors.surface[100] }}
    >
      <div className="w-full min-w-0 px-4 py-6 sm:px-6 sm:py-8 md:px-10 lg:px-[75px] lg:py-10">
        {/* Header with Back Navigation */}
        <div className="mb-8 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <Link
              to={accountHomeRoute}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors hover:opacity-80"
              style={{ color: colors.text.secondary }}
            >
              <Icon type="arrowLeft" size={14} /> Back to Dashboard
            </Link>
            <h1
              className="mt-2 text-2xl font-bold tracking-tight"
              style={{ color: colors.text.primary }}
            >
              Settings
            </h1>
            <p
              className="mt-1 text-[14px]"
              style={{ color: colors.text.secondary }}
            >
              Manage your identity, security, and data.
            </p>
          </div>
        </div>

        {/* Responsive tab switcher */}
        <div
          className="mb-8 grid w-full min-w-0 grid-cols-2 gap-1 rounded-lg border bg-white p-1 sm:inline-grid sm:w-auto sm:grid-cols-4"
          role="tablist"
          aria-label="Account settings"
          style={{
            borderColor: colors.surface[200],
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
          }}
        >
          {SETTINGS_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-center text-[12px] font-medium transition-all sm:gap-2 sm:px-3.5 sm:text-[13px] ${
                  isActive ? "shadow-sm" : "hover:bg-gray-50/50"
                }`}
                style={{
                  backgroundColor: isActive
                    ? colors.surface[50]
                    : "transparent",
                  color: isActive ? colors.text.primary : colors.text.secondary,
                }}
              >
                <Icon
                  type={tab.icon}
                  size={15}
                  className={isActive ? "text-brand" : "opacity-50"}
                />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Main Bento Grid Layout - 2 Columns */}
        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* LEFT COLUMN: Dynamic Content based on Active Tab */}
          <div className="min-w-0 space-y-6">
            {/* TAB 1: PROFILE */}
            {activeTab === "profile" && (
              <SectionCard
                title="Profile Information"
                description="Used on certificates, session metadata, and course enrollments."
              >
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <InputField
                    label="First Name"
                    value={profile.first_name}
                    onChange={(v) => setProfile({ ...profile, first_name: v })}
                    placeholder="John"
                  />
                  <InputField
                    label="Last Name"
                    value={profile.last_name}
                    onChange={(v) => setProfile({ ...profile, last_name: v })}
                    placeholder="Doe"
                  />
                  <InputField
                    label="University / Institution"
                    value={profile.university_name}
                    onChange={(v) =>
                      setProfile({ ...profile, university_name: v })
                    }
                    placeholder="University of Bedfordshire"
                  />
                  <InputField
                    label="Department / Faculty"
                    value={profile.department}
                    onChange={(v) => setProfile({ ...profile, department: v })}
                    placeholder="Dept. of Computer Science"
                  />
                </div>
                <div
                  className="mt-8 flex justify-end border-t pt-6"
                  style={{ borderColor: colors.surface[200] }}
                >
                  <button
                    onClick={saveProfile}
                    disabled={isSaving}
                    className="rounded-lg bg-brand px-6 py-2.5 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50 shadow-sm"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </SectionCard>
            )}

            {/* TAB 2: SECURITY */}
            {activeTab === "security" && (
              <SectionCard
                title="Security & Access"
                description="Manage your password and verification settings."
              >
                <div className="space-y-5">
                  <div
                    className="flex items-center justify-between rounded-lg border bg-white/50 p-4"
                    style={{ borderColor: colors.surface[200] }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <Icon type="mail" size={14} />
                      </div>
                      <div>
                        <p
                          className="text-[13px] font-medium"
                          style={{ color: colors.text.primary }}
                        >
                          Email verification
                        </p>
                        <p
                          className="text-[12px]"
                          style={{ color: colors.text.secondary }}
                        >
                          {user?.is_verified
                            ? "Your email is verified."
                            : "Verify your email for full access."}
                        </p>
                      </div>
                    </div>
                    <Badge
                      bg={user?.is_verified ? colors.mintTint : colors.roseTint}
                      color={user?.is_verified ? brand.humanText : brand.aiText}
                    >
                      {user?.is_verified ? "Active" : "Pending"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <InputField
                      label="Current Password"
                      type="password"
                      value={passwordForm.current_password}
                      onChange={(v) =>
                        setPasswordForm({
                          ...passwordForm,
                          current_password: v,
                        })
                      }
                    />
                    <InputField
                      label="New Password"
                      type="password"
                      value={passwordForm.new_password}
                      onChange={(v) =>
                        setPasswordForm({ ...passwordForm, new_password: v })
                      }
                    />
                    <InputField
                      label="Confirm New Password"
                      type="password"
                      value={passwordForm.confirm_password}
                      onChange={(v) =>
                        setPasswordForm({
                          ...passwordForm,
                          confirm_password: v,
                        })
                      }
                    />
                  </div>
                  <div
                    className="flex justify-end border-t pt-6"
                    style={{ borderColor: colors.surface[200] }}
                  >
                    <button
                      onClick={changePassword}
                      disabled={isSaving}
                      className="rounded-lg border border-gray-200 bg-white px-6 py-2.5 text-[13px] font-semibold transition hover:bg-gray-50 disabled:opacity-50 shadow-sm"
                      style={{ color: colors.text.primary }}
                    >
                      {isSaving ? "Updating..." : "Update Password"}
                    </button>
                  </div>
                </div>
              </SectionCard>
            )}

            {/* TAB 3: DATA & EXPORT */}
            {activeTab === "data" && (
              <SectionCard
                title="Data Export"
                description="Download a JSON backup of your sessions, certificates, and profile."
              >
                <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-3">
                    <div
                      className="mt-0.5 rounded-lg bg-gray-50 p-2 text-gray-400"
                      style={{ borderColor: colors.surface[200] }}
                    >
                      <Icon type="download" size={18} />
                    </div>
                    <div>
                      <p
                        className="text-[13px]"
                        style={{ color: colors.text.primary }}
                      >
                        Your data is portable.
                      </p>
                      <p
                        className="text-[12px]"
                        style={{ color: colors.text.secondary }}
                      >
                        Includes all sessions, certificates, and account
                        history.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={exportData}
                    disabled={isExporting}
                    className="shrink-0 rounded-lg border bg-white px-4 py-2 text-[13px] font-semibold transition hover:bg-gray-50 disabled:opacity-50 shadow-sm"
                    style={{
                      borderColor: colors.surface[200],
                      color: colors.text.primary,
                    }}
                  >
                    {isExporting ? "Preparing..." : "Download JSON"}
                  </button>
                </div>

                <div
                  className="mt-6 border-t pt-6"
                  style={{ borderColor: colors.surface[200] }}
                >
                  <h3
                    className="text-[14px] font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    Sensitive evidence export
                  </h3>
                  <p
                    className="mt-1 text-[12px] leading-6"
                    style={{ color: colors.text.secondary }}
                  >
                    Includes decrypted essay text and raw keystroke events. This
                    action requires password re-authentication, is audited, and
                    excludes course invite codes and third-party email addresses.
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <InputField
                      label="Current password"
                      type="password"
                      value={sensitiveExportForm.current_password}
                      onChange={(value) =>
                        setSensitiveExportForm((current) => ({
                          ...current,
                          current_password: value,
                        }))
                      }
                    />
                    <InputField
                      label="Type EXPORT to confirm"
                      value={sensitiveExportForm.confirmation}
                      onChange={(value) =>
                        setSensitiveExportForm((current) => ({
                          ...current,
                          confirmation: value,
                        }))
                      }
                    />
                  </div>
                  <button
                    type="button"
                    onClick={exportSensitiveData}
                    disabled={isSensitiveExporting}
                    className="mt-4 rounded-lg border bg-white px-4 py-2 text-[13px] font-semibold transition hover:bg-gray-50 disabled:opacity-50"
                    style={{
                      borderColor: colors.surface[200],
                      color: colors.text.primary,
                    }}
                  >
                    {isSensitiveExporting
                      ? "Preparing sensitive export..."
                      : "Download sensitive JSON"}
                  </button>
                </div>
              </SectionCard>
            )}

            {/* TAB 4: DANGER ZONE */}
            {activeTab === "danger" && (
              <div
                className="rounded-xl border p-4 sm:p-6"
                style={{
                  borderColor: brand.aiAccent,
                  backgroundColor: brand.aiBg,
                }}
              >
                <div className="grid gap-6">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5" style={{ color: brand.aiText }}>
                      <Icon type="warning" size={18} />
                    </div>
                    <div>
                      <h3
                        className="text-[15px] font-bold"
                        style={{ color: brand.aiText }}
                      >
                        Anonymize Account
                      </h3>
                      <p
                        className="mt-0.5 text-[13px]"
                        style={{ color: brand.aiText }}
                      >
                        Your login identity will be removed and access disabled.
                        Existing academic evidence and audit relationships are
                        retained for institutional integrity. This action is
                        irreversible.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <InputField
                      label="Current password"
                      type="password"
                      value={deleteForm.password}
                      onChange={(value) =>
                        setDeleteForm((current) => ({
                          ...current,
                          password: value,
                        }))
                      }
                      placeholder="Enter your current password"
                    />
                    <InputField
                      label="Type DELETE to confirm"
                      value={deleteForm.confirmation}
                      onChange={(value) =>
                        setDeleteForm((current) => ({
                          ...current,
                          confirmation: value,
                        }))
                      }
                      placeholder="DELETE"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void deleteAccount()}
                      disabled={isDeleting}
                      className="rounded-lg border px-4 py-2 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{
                        backgroundColor: brand.aiAccent,
                        borderColor: brand.aiAccent,
                      }}
                    >
                      {isDeleting ? "Processing…" : "Anonymize Account"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: User Context & Help (Sleek context panel) */}
          <div className="space-y-6">
            {/* User Snapshot Card - Embedded "Bento" Style */}
            <div
              className="rounded-xl border bg-white p-4 sm:p-6"
              style={{ borderColor: colors.surface[200] }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: colors.text.muted }}
              >
                Workspace Profile
              </p>
              <div className="mt-4 flex items-center gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[16px] font-bold"
                  style={{
                    backgroundColor: colors.brandSoft,
                    color: colors.brand,
                    boxShadow: `0 0 0 2px ${colors.surface[50]}, 0 0 0 4px ${colors.brandSoft}`,
                  }}
                >
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[15px] font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    {displayName}
                  </p>
                  <p
                    className="truncate text-[13px]"
                    style={{ color: colors.text.secondary }}
                  >
                    {user?.email}
                  </p>
                </div>
              </div>
              <div
                className="mt-5 flex flex-wrap gap-2 border-t pt-4"
                style={{ borderColor: colors.surface[200] }}
              >
                <Badge bg={colors.brandSoft} color={colors.brand}>
                  {user?.role || "STUDENT"}
                </Badge>
                <Badge
                  bg={user?.is_verified ? colors.mintTint : colors.roseTint}
                  color={user?.is_verified ? brand.humanText : brand.aiText}
                >
                  {user?.is_verified ? "Verified" : "Unverified"}
                </Badge>
              </div>
            </div>

            {/* Quick Help Card - Minimal */}
            <div
              className="rounded-xl border bg-white p-4 sm:p-6"
              style={{ borderColor: colors.surface[200] }}
            >
              <h4
                className="text-[14px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                Documentation
              </h4>
              <p
                className="mt-1 text-[13px] leading-relaxed"
                style={{ color: colors.text.secondary }}
              >
                Learn how TypeTrace manages behavioral evidence, generates
                certificates, and handles privacy.
              </p>
              <Link
                to={ROUTES.HELP_DOCS}
                className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold transition hover:opacity-80"
                style={{ color: colors.brand }}
              >
                Open Docs <Icon type="external" size={13} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
