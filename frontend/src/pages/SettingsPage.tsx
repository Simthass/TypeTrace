// frontend/src/pages/SettingsPage.tsx

import { useState } from "react";

import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageState";
import { Tabs } from "../components/ui/Tabs";
import { api, getApiErrorMessage } from "../lib/api";
import { useToast } from "../components/ui/ToastProvider";
import { useAuthStore } from "../store/authStore";
import { brand, colors } from "../styles/colors";

type SettingsTab = "profile" | "security" | "privacy" | "export" | "danger";

export default function SettingsPage() {
  const toast = useToast();
  const { user, setUser, logout } = useAuthStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
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

  const tabs = [
    { value: "profile", label: "Profile" },
    { value: "security", label: "Security" },
    { value: "privacy", label: "Privacy" },
    { value: "export", label: "Data Export" },
    { value: "danger", label: "Danger Zone" },
  ];

  const saveProfile = async () => {
    setIsSaving(true);

    try {
      const response = await api.patch("/user/profile", profile);
      setUser(response.data.user || response.data);
      toast.success(
        "Profile updated",
        "Your account details were saved successfully.",
      );
    } catch (error) {
      toast.error("Profile update failed", getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const changePassword = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error(
        "Password mismatch",
        "New password and confirmation do not match.",
      );
      return;
    }

    if (passwordForm.new_password.length < 8) {
      toast.warning(
        "Password too short",
        "Use at least 8 characters for your new password.",
      );
      return;
    }

    setIsSaving(true);

    try {
      await api.post("/user/change-password", {
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
        "Your account password has been updated.",
      );
    } catch (error) {
      toast.error("Password update failed", getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const exportData = async () => {
    setIsExporting(true);

    try {
      const response = await api.get("/user/data-export");
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: "application/json",
      });

      const fileUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = fileUrl;
      link.download = "typetrace-data-export.json";
      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(fileUrl);

      toast.success(
        "Data export downloaded",
        "Your profile, session, and certificate data export is ready.",
      );
    } catch (error) {
      toast.error("Export failed", getApiErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  };

  const deleteAccount = async () => {
    const confirmed = window.confirm(
      "This will permanently delete your account. TypeTrace will remove your personal account data. Continue?",
    );

    if (!confirmed) return;

    try {
      await api.delete("/user/account");
      logout();
      toast.success(
        "Account deleted",
        "Your TypeTrace account has been removed.",
      );
    } catch (error) {
      toast.error("Delete failed", getApiErrorMessage(error));
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Account settings"
        title="Control your profile, security, and data."
        description="Manage your TypeTrace account with clear privacy, security, export, and deletion controls."
      />

      <Card>
        <CardBody>
          <Tabs
            items={tabs}
            value={activeTab}
            onChange={(value) => setActiveTab(value as SettingsTab)}
          />
        </CardBody>
      </Card>

      {activeTab === "profile" && (
        <Card elevated>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  className="text-[16px] font-bold"
                  style={{ color: colors.text.primary }}
                >
                  Profile information
                </h2>
                <p
                  className="mt-1 text-[13px]"
                  style={{ color: colors.text.secondary }}
                >
                  Keep your academic identity accurate for certificates and
                  review records.
                </p>
              </div>

              <Badge tone="brand">{user?.role}</Badge>
            </div>
          </CardHeader>

          <CardBody className="grid gap-4 md:grid-cols-2">
            {[
              ["First name", "first_name"],
              ["Last name", "last_name"],
              ["University", "university_name"],
              ["Department", "department"],
            ].map(([label, key]) => (
              <label key={key} className="block">
                <span
                  className="text-[12px] font-bold"
                  style={{ color: colors.text.secondary }}
                >
                  {label}
                </span>

                <input
                  value={profile[key as keyof typeof profile]}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  className="mt-2 h-11 w-full rounded-md border px-3 text-[14px] outline-none"
                  style={{
                    borderColor: colors.surface[200],
                    color: colors.text.primary,
                    background: colors.surface[50],
                  }}
                />
              </label>
            ))}

            <div className="md:col-span-2">
              <Button type="button" onClick={saveProfile} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save profile"}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {activeTab === "security" && (
        <Card elevated>
          <CardHeader>
            <h2
              className="text-[16px] font-bold"
              style={{ color: colors.text.primary }}
            >
              Security
            </h2>
            <p
              className="mt-1 text-[13px]"
              style={{ color: colors.text.secondary }}
            >
              Change your password and confirm your account verification state.
            </p>
          </CardHeader>

          <CardBody className="space-y-5">
            <div
              className="rounded-md border p-4"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[50],
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p
                    className="text-[14px] font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    Email verification
                  </p>
                  <p
                    className="mt-1 text-[13px]"
                    style={{ color: colors.text.secondary }}
                  >
                    Verified accounts can access protected writing and
                    certificate workflows.
                  </p>
                </div>

                <Badge tone={user?.is_verified ? "human" : "suspicious"}>
                  {user?.is_verified ? "Verified" : "Not verified"}
                </Badge>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["Current password", "current_password", "password"],
                ["New password", "new_password", "password"],
                ["Confirm password", "confirm_password", "password"],
              ].map(([label, key, type]) => (
                <label key={key} className="block">
                  <span
                    className="text-[12px] font-bold"
                    style={{ color: colors.text.secondary }}
                  >
                    {label}
                  </span>

                  <input
                    type={type}
                    value={passwordForm[key as keyof typeof passwordForm]}
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    className="mt-2 h-11 w-full rounded-md border px-3 text-[14px] outline-none"
                    style={{
                      borderColor: colors.surface[200],
                      color: colors.text.primary,
                      background: colors.surface[50],
                    }}
                  />
                </label>
              ))}
            </div>

            <Button type="button" onClick={changePassword} disabled={isSaving}>
              {isSaving ? "Updating..." : "Change password"}
            </Button>
          </CardBody>
        </Card>
      )}

      {activeTab === "privacy" && (
        <Card elevated>
          <CardHeader>
            <h2
              className="text-[16px] font-bold"
              style={{ color: colors.text.primary }}
            >
              Privacy summary
            </h2>
            <p
              className="mt-1 text-[13px]"
              style={{ color: colors.text.secondary }}
            >
              Understand exactly what TypeTrace captures and what becomes
              visible.
            </p>
          </CardHeader>

          <CardBody className="grid gap-4 md:grid-cols-3">
            {[
              [
                "Captured privately",
                "Keystroke timing, pauses, edits, paste events, document text, and behavioral metrics are stored for authorship evidence.",
              ],
              [
                "Visible to teachers",
                "Teachers can see sessions linked to their courses, classification results, replay audit, and review metadata.",
              ],
              [
                "Public verification",
                "Public certificate pages expose certificate status, document hash, classification, and verification metadata.",
              ],
            ].map(([title, description]) => (
              <div
                key={title}
                className="rounded-md border p-4"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[50],
                }}
              >
                <p
                  className="text-[14px] font-bold"
                  style={{ color: colors.text.primary }}
                >
                  {title}
                </p>
                <p
                  className="mt-2 text-[13px] leading-6"
                  style={{ color: colors.text.secondary }}
                >
                  {description}
                </p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {activeTab === "export" && (
        <Card elevated>
          <CardHeader>
            <h2
              className="text-[16px] font-bold"
              style={{ color: colors.text.primary }}
            >
              Data export
            </h2>
            <p
              className="mt-1 text-[13px]"
              style={{ color: colors.text.secondary }}
            >
              Download a readable JSON copy of your TypeTrace account data.
            </p>
          </CardHeader>

          <CardBody className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              {[
                "Profile details",
                "Writing sessions",
                "Certificates and hashes",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-md border p-4"
                  style={{
                    borderColor: colors.surface[200],
                    background: colors.surface[50],
                  }}
                >
                  <p
                    className="text-[13px] font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    {item}
                  </p>
                </div>
              ))}
            </div>

            <Button type="button" onClick={exportData} disabled={isExporting}>
              {isExporting ? "Preparing export..." : "Download data export"}
            </Button>
          </CardBody>
        </Card>
      )}

      {activeTab === "danger" && (
        <Card elevated>
          <CardHeader>
            <h2
              className="text-[16px] font-bold"
              style={{ color: brand.aiText }}
            >
              Danger zone
            </h2>
            <p
              className="mt-1 text-[13px]"
              style={{ color: colors.text.secondary }}
            >
              Permanent account actions require careful confirmation.
            </p>
          </CardHeader>

          <CardBody>
            <div
              className="rounded-md border p-4"
              style={{
                borderColor: brand.aiAccent,
                background: brand.aiBg,
              }}
            >
              <p
                className="text-[14px] font-bold"
                style={{ color: brand.aiText }}
              >
                Delete account
              </p>
              <p
                className="mt-2 text-[13px] leading-6"
                style={{ color: brand.aiText }}
              >
                This removes your account access and personal profile data. Only
                use this if you are sure you no longer need TypeTrace.
              </p>

              <div className="mt-4">
                <Button type="button" variant="danger" onClick={deleteAccount}>
                  Delete account
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
