// frontend/src/pages/SettingsPage.tsx

import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api, getApiErrorMessage } from "../lib/api";
import { useToast } from "../components/ui/ToastProvider";
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
      className="rounded-xl border bg-white p-6 transition-all hover:shadow-md"
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

export default function SettingsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuthStore();

  const [activeTab, setActiveTab] = useState<
    "profile" | "security" | "data" | "danger"
  >("profile");
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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

  // ── Handlers ──
  const saveProfile = async () => {
    setIsSaving(true);
    try {
      const response = await api.patch(API_ROUTES.user.profile, profile);
      setUser(response.data.user || response.data);
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
    if (passwordForm.new_password.length < 8) {
      toast.warning("Password too short", "Minimum 8 characters required.");
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
      toast.success("Password changed", "Your password has been updated.");
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

  const deleteAccount = async () => {
    if (
      !window.confirm(
        "This action is permanent. Are you sure you want to delete your account?",
      )
    )
      return;
    try {
      await api.delete(API_ROUTES.user.account);
      logout();
      toast.success("Account deleted", "Your account has been removed.");
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (error) {
      toast.error("Delete failed", getApiErrorMessage(error));
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
      {/* EXACT 75px Padding */}
      <div className="px-[75px] py-10">
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

        {/* TOP TAB SWITCHER - 2026 Minimalist Style */}
        <div
          className="mb-8 inline-flex items-center rounded-lg bg-white p-1 border"
          style={{
            borderColor: colors.surface[200],
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)",
          }}
        >
          {[
            { id: "profile", label: "Profile", icon: "user" },
            { id: "security", label: "Security", icon: "lock" },
            { id: "data", label: "Data & Export", icon: "download" },
            { id: "danger", label: "Danger Zone", icon: "trash" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-all ${
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          {/* LEFT COLUMN: Dynamic Content based on Active Tab */}
          <div className="space-y-6">
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
              </SectionCard>
            )}

            {/* TAB 4: DANGER ZONE */}
            {activeTab === "danger" && (
              <div
                className="rounded-xl border p-6"
                style={{
                  borderColor: brand.aiAccent,
                  backgroundColor: brand.aiBg,
                }}
              >
                <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5" style={{ color: brand.aiText }}>
                      <Icon type="warning" size={18} />
                    </div>
                    <div>
                      <h3
                        className="text-[15px] font-bold"
                        style={{ color: brand.aiText }}
                      >
                        Delete Account
                      </h3>
                      <p
                        className="mt-0.5 text-[13px]"
                        style={{ color: brand.aiText }}
                      >
                        Permanently delete your account and all associated data.
                        This action is irreversible.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={deleteAccount}
                    className="shrink-0 rounded-lg border px-4 py-2 text-[13px] font-semibold text-white transition hover:opacity-90 shadow-sm"
                    style={{
                      backgroundColor: brand.aiAccent,
                      borderColor: brand.aiAccent,
                    }}
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: User Context & Help (Sleek context panel) */}
          <div className="space-y-6">
            {/* User Snapshot Card - Embedded "Bento" Style */}
            <div
              className="rounded-xl border bg-white p-6"
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
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[16px] font-bold ring-2 ring-offset-2"
                  style={{
                    backgroundColor: colors.brandSoft,
                    color: colors.brand,
                    ringColor: colors.brandSoft,
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
              className="rounded-xl border bg-white p-6"
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
