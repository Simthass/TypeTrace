import { useState } from "react";
import { useAuthStore } from "../store/authStore";
import { colors, brand } from "../styles/colors";

// ─── Icons ────────────────────────────────────────────────────────────────────
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
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// ─── Reusable Vercel-style Settings Card ──────────────────────────────────────
function SettingsCard({
  title,
  description,
  children,
  footerText,
  buttonText,
  onSave,
  danger = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footerText?: string;
  buttonText?: string;
  onSave?: () => void;
  danger?: boolean;
}) {
  return (
    <div
      className="bg-white border rounded-md shadow-sm overflow-hidden flex flex-col"
      style={{
        borderColor: danger ? `${brand.aiAccent}40` : colors.surface[200],
      }}
    >
      <div
        className="p-6 border-b"
        style={{ borderColor: colors.surface[200] }}
      >
        <h3
          className="text-[16px] font-semibold mb-1"
          style={{ color: colors.text.primary }}
        >
          {title}
        </h3>
        <p className="text-[13px]" style={{ color: colors.text.secondary }}>
          {description}
        </p>

        <div className="mt-6">{children}</div>
      </div>

      {/* card footer - vercel puts the save button in this little gray bar at the bottom */}
      {(footerText || buttonText) && (
        <div
          className="px-6 py-3.5 flex items-center justify-between"
          style={{
            backgroundColor: danger
              ? `${brand.aiAccent}10`
              : colors.surface[50],
          }}
        >
          <p className="text-[13px]" style={{ color: colors.text.secondary }}>
            {footerText}
          </p>
          {buttonText && (
            <button
              onClick={onSave}
              className="px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors shadow-sm"
              style={{
                backgroundColor: danger ? brand.aiAccent : colors.text.primary,
                color: colors.text.light,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              {buttonText}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState("general");
  const [copied, setCopied] = useState(false);

  // form state (just visual for now till backend is fully wired)
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [email, setEmail] = useState(user?.email || "");

  const handleCopyKey = () => {
    navigator.clipboard.writeText("tt_live_8f92bd3a4928d10b99c4");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = [
    { id: "general", label: "General", icon: <UserIcon /> },
    { id: "security", label: "Security", icon: <ShieldIcon /> },
    { id: "api", label: "Developer API", icon: <KeyIcon /> },
    { id: "advanced", label: "Advanced", icon: <AlertIcon /> },
  ];

  return (
    <div
      className="p-6 md:p-12 max-w-[1440px] mx-auto w-full flex flex-col gap-8"
      style={{ backgroundColor: colors.surface[50] }}
    >
      {/* ── Page Header ── */}
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight mb-1"
          style={{ color: colors.text.primary }}
        >
          Settings
        </h1>
        <p className="text-[14px]" style={{ color: colors.text.secondary }}>
          Manage your workspace preferences and integrations.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* ── Left Sidebar Navigation ── */}
        <nav className="w-full md:w-[220px] flex flex-col gap-1 shrink-0">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2.5 px-3 py-3 rounded-md text-[14px] font-medium transition-colors text-left"
                style={{
                  backgroundColor: isActive
                    ? colors.surface[100]
                    : "transparent",
                  color: isActive ? colors.text.primary : colors.text.secondary,
                }}
                onMouseEnter={(e) =>
                  !isActive &&
                  (e.currentTarget.style.backgroundColor = colors.surface[50])
                }
                onMouseLeave={(e) =>
                  !isActive &&
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                <span className="shrink-0">{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* ── Right Content Area ── */}
        <div className="flex-1 flex flex-col gap-8 min-w-0 w-full">
          {/* GENERAL TAB */}
          {activeTab === "general" && (
            <>
              <SettingsCard
                title="Your Name"
                description="This will be the name displayed on your generated biometric certificates."
                footerText="Please use your real legal name for university submissions."
                buttonText="Save"
                onSave={() => alert("Name saved!")}
              >
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label
                      className="block text-[12px] font-medium mb-1.5"
                      style={{ color: colors.text.secondary }}
                    >
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full h-9 px-3 rounded-md text-[14px] bg-white border outline-none focus:ring-1 focus:ring-black transition-shadow shadow-sm"
                      style={{
                        borderColor: colors.surface[200],
                        color: colors.text.primary,
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <label
                      className="block text-[12px] font-medium mb-1.5"
                      style={{ color: colors.text.secondary }}
                    >
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full h-9 px-3 rounded-md text-[14px] bg-white border outline-none focus:ring-1 focus:ring-black transition-shadow shadow-sm"
                      style={{
                        borderColor: colors.surface[200],
                        color: colors.text.primary,
                      }}
                    />
                  </div>
                </div>
              </SettingsCard>

              <SettingsCard
                title="Email Address"
                description="The email associated with your account. We will send security alerts here."
                footerText="We will email you to verify this change."
                buttonText="Save"
                onSave={() => alert("Email saved!")}
              >
                <div className="max-w-[400px]">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-9 px-3 rounded-md text-[14px] bg-white border outline-none focus:ring-1 focus:ring-black transition-shadow shadow-sm"
                    style={{
                      borderColor: colors.surface[200],
                      color: colors.text.primary,
                    }}
                  />
                </div>
              </SettingsCard>
            </>
          )}

          {/* SECURITY TAB */}
          {activeTab === "security" && (
            <>
              <SettingsCard
                title="Change Password"
                description="Update your password to keep your account secure."
                footerText="Must be at least 8 characters long."
                buttonText="Update Password"
              >
                <div className="flex flex-col gap-4 max-w-[400px]">
                  <div>
                    <label
                      className="block text-[12px] font-medium mb-1.5"
                      style={{ color: colors.text.secondary }}
                    >
                      Current Password
                    </label>
                    <input
                      type="password"
                      className="w-full h-9 px-3 rounded-md text-[14px] bg-white border outline-none focus:ring-1 focus:ring-black transition-shadow shadow-sm"
                      style={{ borderColor: colors.surface[200] }}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-[12px] font-medium mb-1.5"
                      style={{ color: colors.text.secondary }}
                    >
                      New Password
                    </label>
                    <input
                      type="password"
                      className="w-full h-9 px-3 rounded-md text-[14px] bg-white border outline-none focus:ring-1 focus:ring-black transition-shadow shadow-sm"
                      style={{ borderColor: colors.surface[200] }}
                    />
                  </div>
                </div>
              </SettingsCard>

              <SettingsCard
                title="Two-Factor Authentication"
                description="Add an extra layer of security to your account. We strongly recommend this."
                buttonText="Enable 2FA"
              >
                <p
                  className="text-[13px] italic"
                  style={{ color: colors.text.secondary }}
                >
                  Two-factor authentication is currently disabled on your
                  account.
                </p>
              </SettingsCard>
            </>
          )}

          {/* API TAB */}
          {activeTab === "api" && (
            <>
              <SettingsCard
                title="REST API Keys"
                description="Use these keys to authenticate API requests from your university servers. Do not share them in public repositories."
                footerText="Your secret keys carry many privileges, so be sure to keep them secure!"
              >
                <div className="flex flex-col gap-2">
                  <label
                    className="block text-[12px] font-medium mb-1"
                    style={{ color: colors.text.secondary }}
                  >
                    Secret Key (Live)
                  </label>
                  <div className="flex items-center gap-2">
                    {/* mock api key block cos backend webhooks arent built yet */}
                    <div
                      className="flex-1 h-9 px-3 flex items-center justify-between rounded-md border font-mono text-[13px]"
                      style={{
                        backgroundColor: colors.surface[50],
                        borderColor: colors.surface[200],
                        color: colors.text.primary,
                      }}
                    >
                      tt_live_8f92bd3a4928d10b99c4****************
                    </div>
                    <button
                      onClick={handleCopyKey}
                      className="h-9 px-3 rounded-md border flex items-center gap-2 text-[12.5px] font-medium hover:bg-surface-50 transition-colors"
                      style={{
                        borderColor: colors.surface[200],
                        color: colors.text.primary,
                      }}
                    >
                      {copied ? (
                        <span className="text-green-600">Copied</span>
                      ) : (
                        <>
                          <CopyIcon /> Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </SettingsCard>
            </>
          )}

          {/* ADVANCED TAB (Danger Zone) */}
          {activeTab === "advanced" && (
            <>
              <SettingsCard
                title="Export Data"
                description="Download a ZIP file containing all your raw biometric JSON payloads and certificates."
                footerText="Data exports may take up to 5 minutes to generate."
                buttonText="Request Export"
              >
                <p
                  className="text-[13px]"
                  style={{ color: colors.text.secondary }}
                >
                  We will email you a secure link to download your data archive
                  once it is ready.
                </p>
              </SettingsCard>

              {/* github style danger zone */}
              <SettingsCard
                title="Delete Workspace"
                description="Permanently delete your account, all session data, and invalidate all existing cryptographic certificates."
                footerText="This action is not reversible. Proceed with extreme caution."
                buttonText="Delete Account"
                danger={true}
              >
                <div
                  className="p-3 rounded-md border"
                  style={{
                    backgroundColor: `${brand.aiAccent}10`,
                    borderColor: `${brand.aiAccent}30`,
                  }}
                >
                  <p
                    className="text-[13px] font-medium"
                    style={{ color: brand.aiAccent }}
                  >
                    Warning: Deleting your account will break the verification
                    links on all PDF certificates you have already submitted to
                    your university.
                  </p>
                </div>
              </SettingsCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
