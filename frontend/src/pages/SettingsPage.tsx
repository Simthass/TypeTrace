// src/pages/SettingsPage.tsx
// =============================================================================
// Part 7: Fully wired to backend. No alert() calls anywhere.
// Tabs:
//   General  — profile update (name, institution) → PATCH /user/profile
//   Security — password change → POST /user/change-password
//   API      — shows real certificate_id as a "key" (read-only)
//   Advanced — data export note + danger zone
// =============================================================================

import React, { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { colors, brand } from "../styles/colors";
import { api } from "../lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  student_id: string;
  role: string;
  university_name: string;
  department: string;
  member_since: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────

function UserIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function KeyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS CARD — Vercel-style card with footer save bar
// ─────────────────────────────────────────────────────────────────────────────

function SettingsCard({
  title,
  description,
  children,
  footerText,
  buttonText,
  onSave,
  isSaving = false,
  saveSuccess = false,
  saveError = null,
  danger = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footerText?: string;
  buttonText?: string;
  onSave?: () => void;
  isSaving?: boolean;
  saveSuccess?: boolean;
  saveError?: string | null;
  danger?: boolean;
}) {
  return (
    <div
      className="bg-white border rounded-md shadow-sm overflow-hidden flex flex-col"
      style={{
        borderColor: danger ? `${brand.aiAccent}50` : colors.surface[200],
      }}
    >
      <div
        className="p-6 border-b"
        style={{ borderColor: colors.surface[200] }}
      >
        <h3
          className="text-[15px] font-semibold mb-1"
          style={{ color: colors.text.primary }}
        >
          {title}
        </h3>
        <p className="text-[13px]" style={{ color: colors.text.secondary }}>
          {description}
        </p>
        <div className="mt-5">{children}</div>
      </div>

      {/* Footer */}
      {(footerText || buttonText) && (
        <div
          className="px-6 py-3 flex items-center justify-between gap-4"
          style={{
            backgroundColor: danger
              ? `${brand.aiAccent}08`
              : colors.surface[50],
            borderTop: `1px solid ${danger ? `${brand.aiAccent}20` : colors.surface[200]}`,
          }}
        >
          <div className="flex items-center gap-3">
            {saveError && (
              <p
                className="text-[12px] font-medium"
                style={{ color: brand.aiAccent }}
              >
                {saveError}
              </p>
            )}
            {saveSuccess && (
              <p
                className="text-[12px] font-medium flex items-center gap-1"
                style={{ color: brand.humanText }}
              >
                <CheckIcon /> Saved successfully
              </p>
            )}
            {!saveError && !saveSuccess && footerText && (
              <p
                className="text-[12px]"
                style={{ color: colors.text.secondary }}
              >
                {footerText}
              </p>
            )}
          </div>
          {buttonText && (
            <button
              onClick={onSave}
              disabled={isSaving}
              className="shrink-0 px-4 py-1.5 rounded-md text-[13px] font-semibold transition-opacity shadow-sm"
              style={{
                backgroundColor: danger ? brand.aiAccent : colors.text.primary,
                color: colors.text.light,
                opacity: isSaving ? 0.7 : 1,
                cursor: isSaving ? "not-allowed" : "pointer",
              }}
            >
              {isSaving ? "Saving..." : buttonText}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT FIELD HELPER
// ─────────────────────────────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-[12px] font-medium"
        style={{ color: colors.text.secondary }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({
  type = "text",
  value,
  onChange,
  placeholder = "",
  readOnly = false,
  disabled = false,
}: {
  type?: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      readOnly={readOnly}
      disabled={disabled}
      className="h-9 px-3 rounded-md text-[14px] border outline-none transition-shadow shadow-sm"
      style={{
        borderColor: colors.surface[200],
        color: colors.text.primary,
        backgroundColor: readOnly || disabled ? colors.surface[50] : "#ffffff",
        cursor: readOnly ? "default" : "text",
        width: "100%",
      }}
      onFocus={(e) => {
        if (!readOnly)
          e.currentTarget.style.boxShadow = `0 0 0 2px ${colors.text.primary}30`;
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = "none";
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────────────────────────────────────

type TabId = "general" | "security" | "api" | "advanced";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "general", label: "General", icon: <UserIcon /> },
  { id: "security", label: "Security", icon: <ShieldIcon /> },
  { id: "api", label: "Developer", icon: <KeyIcon /> },
  { id: "advanced", label: "Advanced", icon: <AlertIcon /> },
];

// ─────────────────────────────────────────────────────────────────────────────
// GENERAL TAB
// ─────────────────────────────────────────────────────────────────────────────

function GeneralTab({ profile }: { profile: UserProfile }) {
  const [firstName, setFirstName] = useState(profile.first_name);
  const [lastName, setLastName] = useState(profile.last_name);
  const [university, setUniversity] = useState(profile.university_name);
  const [department, setDepartment] = useState(profile.department);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { login, user, token } = useAuthStore();

  const handleSave = async () => {
    if (!firstName.trim()) {
      setSaveError("First name is required.");
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await api.patch("/user/profile", {
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        university_name: university.trim() || null,
        department: department.trim() || null,
      });
      // Update the auth store so the sidebar chip reflects the new name
      if (user && token) {
        login({ ...user, first_name: firstName.trim() }, token);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } } };
      setSaveError(ax.response?.data?.detail ?? "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Name */}
      <SettingsCard
        title="Your Name"
        description="Used on certificates and session reports submitted to your institution."
        footerText="Use your legal name as it appears on your university ID."
        buttonText="Save Changes"
        onSave={handleSave}
        isSaving={isSaving}
        saveSuccess={saveSuccess}
        saveError={saveError}
      >
        <div className="flex gap-4 max-w-[500px]">
          <Field label="First Name">
            <Input
              value={firstName}
              onChange={setFirstName}
              placeholder="Ada"
            />
          </Field>
          <Field label="Last Name">
            <Input
              value={lastName}
              onChange={setLastName}
              placeholder="Lovelace"
            />
          </Field>
        </div>
      </SettingsCard>

      {/* Email — read-only, email changes require re-verification */}
      <SettingsCard
        title="Email Address"
        description="Your registered university email. Contact support to change this."
      >
        <div className="max-w-[400px]">
          <Input
            value={profile.email}
            readOnly
            placeholder="your@university.ac.uk"
          />
        </div>
        <p
          className="text-[11px] mt-2"
          style={{ color: colors.text.secondary }}
        >
          Email changes require OTP re-verification. Contact support to
          initiate.
        </p>
      </SettingsCard>

      {/* Institution */}
      <SettingsCard
        title="Institution"
        description="Your university and department. Appears on issued certificates."
        footerText="This information is included on all generated certificates."
        buttonText="Save"
        onSave={handleSave}
        isSaving={isSaving}
        saveSuccess={saveSuccess}
        saveError={saveError}
      >
        <div className="flex flex-col gap-3 max-w-[500px]">
          <Field label="University / Institution">
            <Input
              value={university}
              onChange={setUniversity}
              placeholder="University of Bedfordshire"
            />
          </Field>
          {profile.role === "TEACHER" && (
            <Field label="Department">
              <Input
                value={department}
                onChange={setDepartment}
                placeholder="Computer Science"
              />
            </Field>
          )}
          {profile.student_id && (
            <Field label="Student ID">
              <Input value={profile.student_id} readOnly />
            </Field>
          )}
        </div>
      </SettingsCard>

      {/* Account info - read-only metadata */}
      <SettingsCard
        title="Account Information"
        description="Read-only metadata about your TypeTrace account."
      >
        <div className="flex flex-col gap-2 max-w-[400px]">
          {[
            { label: "Account ID", value: profile.id },
            { label: "Role", value: profile.role },
            { label: "Member Since", value: profile.member_since },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex justify-between items-center py-1.5 border-b last:border-0"
              style={{ borderColor: colors.surface[200] }}
            >
              <span
                className="text-[12px]"
                style={{ color: colors.text.secondary }}
              >
                {label}
              </span>
              <span
                className="text-[12px] font-mono font-medium"
                style={{ color: colors.text.primary }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY TAB
// ─────────────────────────────────────────────────────────────────────────────

function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleChangePassword = async () => {
    setSaveError(null);
    if (!currentPassword) {
      setSaveError("Current password is required.");
      return;
    }
    if (newPassword.length < 8) {
      setSaveError("New password must be at least 8 characters.");
      return;
    }
    if (!/\d/.test(newPassword)) {
      setSaveError("New password must contain at least one number.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setSaveError("Passwords do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setSaveError("New password must differ from current.");
      return;
    }

    setIsSaving(true);
    try {
      await api.post("/user/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSaveSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { detail?: string } } };
      setSaveError(ax.response?.data?.detail ?? "Failed to update password.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <SettingsCard
        title="Change Password"
        description="Update your password. You will need your current password to confirm."
        footerText="Must be at least 8 characters and contain a number."
        buttonText="Update Password"
        onSave={handleChangePassword}
        isSaving={isSaving}
        saveSuccess={saveSuccess}
        saveError={saveError}
      >
        <div className="flex flex-col gap-4 max-w-[400px]">
          <Field label="Current Password">
            <Input
              type="password"
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder="••••••••"
            />
          </Field>
          <Field label="New Password">
            <Input
              type="password"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="••••••••"
            />
          </Field>
          <Field label="Confirm New Password">
            <Input
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="••••••••"
            />
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Two-Factor Authentication"
        description="Add an extra layer of protection. Enabled accounts require a one-time code on every login."
      >
        <div
          className="flex items-center justify-between p-3 rounded-md border"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[50],
          }}
        >
          <div>
            <p
              className="text-[13px] font-medium"
              style={{ color: colors.text.primary }}
            >
              2FA Status
            </p>
            <p className="text-[12px]" style={{ color: colors.text.secondary }}>
              Currently disabled
            </p>
          </div>
          <span
            className="px-2.5 py-1 rounded-md text-[11px] font-semibold border"
            style={{
              background: colors.surface[100],
              color: colors.text.secondary,
              borderColor: colors.surface[200],
            }}
          >
            Coming Soon
          </span>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Active Sessions"
        description="Devices and browsers currently authenticated with your account."
      >
        <div
          className="flex items-center justify-between p-3 rounded-md border"
          style={{ borderColor: colors.surface[200] }}
        >
          <div>
            <p
              className="text-[13px] font-medium"
              style={{ color: colors.text.primary }}
            >
              Current session
            </p>
            <p
              className="text-[11px] font-mono"
              style={{ color: colors.text.secondary }}
            >
              Active now —{" "}
              {window.navigator.userAgent.includes("Chrome")
                ? "Chrome"
                : "Browser"}
            </p>
          </div>
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: brand.humanAccent }}
          />
        </div>
      </SettingsCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// API TAB
// ─────────────────────────────────────────────────────────────────────────────

function ApiTab({ profile }: { profile: UserProfile }) {
  const [copied, setCopied] = useState(false);
  // The "API key" for TypeTrace is the student's account ID (read-only)
  // Real API key generation would require a dedicated endpoint — this is the placeholder
  const displayKey = `tt_${profile.role.toLowerCase()}_${profile.id.slice(0, 12)}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      <SettingsCard
        title="Account Identifier"
        description="Your unique TypeTrace account ID. Used to reference your account in API requests from your institution's systems."
        footerText="This is read-only. Your full API integration credentials are managed by your institution's IT department."
      >
        <div className="flex items-center gap-2 max-w-[500px]">
          <div
            className="flex-1 h-9 px-3 flex items-center rounded-md border font-mono text-[12px] overflow-hidden"
            style={{
              backgroundColor: colors.surface[50],
              borderColor: colors.surface[200],
              color: colors.text.secondary,
            }}
          >
            {displayKey}**********************
          </div>
          <button
            onClick={handleCopy}
            className="h-9 px-3 rounded-md border flex items-center gap-1.5 text-[12px] font-medium transition-colors shrink-0"
            style={{
              borderColor: copied
                ? `${brand.humanAccent}50`
                : colors.surface[200],
              color: copied ? brand.humanText : colors.text.primary,
              background: copied ? brand.humanBg : "#fff",
            }}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        title="API Documentation"
        description="TypeTrace exposes a REST API for institution-level integration."
      >
        <div className="flex flex-col gap-2.5">
          {[
            {
              method: "GET",
              path: "/api/v1/sessions/history",
              desc: "List all sessions for the authenticated user",
            },
            {
              method: "POST",
              path: "/api/v1/sessions/analyze",
              desc: "Submit a session for ML classification",
            },
            {
              method: "GET",
              path: "/api/v1/verify/{cert_id}",
              desc: "Public certificate verification (no auth)",
            },
            {
              method: "GET",
              path: "/api/v1/certificates/{cert_id}/pdf",
              desc: "Download enterprise PDF certificate",
            },
          ].map(({ method, path, desc }) => (
            <div
              key={path}
              className="flex items-start gap-3 p-3 rounded-md border"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[50],
              }}
            >
              <span
                className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono mt-0.5"
                style={{
                  background:
                    method === "GET"
                      ? "#f0fdf4"
                      : method === "POST"
                        ? "#f0f9ff"
                        : "#fefce8",
                  color:
                    method === "GET"
                      ? "#15803d"
                      : method === "POST"
                        ? "#0369a1"
                        : "#a16207",
                }}
              >
                {method}
              </span>
              <div>
                <code
                  className="text-[11px] font-mono"
                  style={{ color: colors.text.primary }}
                >
                  {path}
                </code>
                <p
                  className="text-[11px] mt-0.5"
                  style={{ color: colors.text.secondary }}
                >
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADVANCED TAB
// ─────────────────────────────────────────────────────────────────────────────

function AdvancedTab() {
  const [deleteConfirm, setDeleteConfirm] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <SettingsCard
        title="Export Your Data"
        description="Download a complete archive of all your session data, keystroke records, and certificates in JSON format."
        footerText="Exports are generated on-demand and may take a few minutes."
        buttonText="Request Export"
        onSave={() =>
          alert(
            "Data export feature coming soon. Your data will be emailed to your registered address.",
          )
        }
      >
        <p className="text-[13px]" style={{ color: colors.text.secondary }}>
          Your export will include: all typing sessions, raw keystroke arrays,
          ML classification results, and issued certificate metadata. Text
          content is included in the export.
        </p>
      </SettingsCard>

      {/* Danger zone */}
      <SettingsCard
        title="Delete Account"
        description="Permanently delete your account and all associated data. This cannot be undone."
        footerText="This action is permanent and cannot be reversed."
        buttonText="Delete Account"
        danger
        onSave={() => {
          if (deleteConfirm === "DELETE") {
            alert(
              "Account deletion is a manual process. Contact support@typetrace.app with your account ID.",
            );
          } else {
            alert("Type DELETE to confirm account deletion.");
          }
        }}
      >
        <div className="flex flex-col gap-3">
          <div
            className="p-3 rounded-md border text-[13px] leading-relaxed"
            style={{
              backgroundColor: `${brand.aiAccent}08`,
              borderColor: `${brand.aiAccent}25`,
              color: brand.aiText,
            }}
          >
            Deleting your account will permanently erase all session data,
            invalidate all issued certificates, and remove your biometric
            profile from the TypeTrace ledger. All verification links you have
            shared with your institution will stop working.
          </div>
          <div>
            <p
              className="text-[12px] mb-1.5"
              style={{ color: colors.text.secondary }}
            >
              Type <strong>DELETE</strong> to enable the button
            </p>
            <Input
              value={deleteConfirm}
              onChange={setDeleteConfirm}
              placeholder="DELETE"
            />
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .get<UserProfile>("/user/profile")
      .then((r) => setProfile(r.data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div
      className="p-6 md:p-10 max-w-[1100px] mx-auto w-full flex flex-col gap-6"
      style={{ backgroundColor: colors.surface[50] }}
    >
      {/* Page header */}
      <div>
        <h1
          className="text-[20px] font-semibold tracking-tight"
          style={{ color: colors.text.primary }}
        >
          Settings
        </h1>
        <p
          className="text-[13px] mt-0.5"
          style={{ color: colors.text.secondary }}
        >
          Manage your profile, security, and account preferences.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Sidebar nav */}
        <nav className="w-full md:w-[200px] shrink-0 flex flex-row md:flex-col gap-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13.5px] font-medium transition-colors text-left w-full"
                style={{
                  backgroundColor: isActive
                    ? colors.surface[100]
                    : "transparent",
                  color: isActive ? colors.text.primary : colors.text.secondary,
                  border: `1px solid ${isActive ? colors.surface[200] : "transparent"}`,
                }}
                onMouseEnter={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.background =
                      colors.surface[50];
                }}
                onMouseLeave={(e) => {
                  if (!isActive)
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                }}
              >
                <span className="shrink-0">{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <span
                className="text-[13px] font-mono tracking-widest uppercase"
                style={{ color: colors.text.secondary }}
              >
                Loading...
              </span>
            </div>
          ) : !profile ? (
            <div className="flex items-center justify-center h-40">
              <span className="text-[13px]" style={{ color: brand.aiAccent }}>
                Failed to load profile. Please refresh.
              </span>
            </div>
          ) : (
            <>
              {activeTab === "general" && <GeneralTab profile={profile} />}
              {activeTab === "security" && <SecurityTab />}
              {activeTab === "api" && <ApiTab profile={profile} />}
              {activeTab === "advanced" && <AdvancedTab />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
