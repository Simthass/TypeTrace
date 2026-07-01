import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ROUTES } from "../constants/routes";
import { isValidCertificateId, normalizeCertificateId } from "../lib/edgeCases";
import { brand, colors } from "../styles/colors";

interface ToastState {
  type: "error";
  title: string;
  message: string;
}

function ShieldCheck() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function FileSealIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M9 15l2 2 4-5" />
    </svg>
  );
}

function FingerprintIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12c0-5.52 4.48-10 10-10 2.76 0 5.26 1.12 7.07 2.93" />
      <path d="M5 19.5c.7-1.58 1-3.2 1-5.5a6 6 0 0 1 12 0c0 1.8-.2 3.34-.7 4.75" />
      <path d="M9 21c.67-1.67 1-3.67 1-6a2 2 0 0 1 4 0c0 2.25-.25 4.25-.75 6" />
      <path d="M14 8.5a5 5 0 0 0-7 4.58" />
      <path d="M18 11.5A6.5 6.5 0 0 0 8.5 5.7" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function Toast({
  toast,
  onClose,
}: {
  toast: ToastState | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!toast) return;

    const timeout = window.setTimeout(() => {
      onClose();
    }, 4200);

    return () => window.clearTimeout(timeout);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className="fixed right-5 top-5 z-[100] w-[calc(100%-40px)] max-w-[380px]">
      <div
        role="alert"
        aria-live="assertive"
        className="flex items-start gap-3 rounded-md border p-4"
        style={{
          background: colors.surface[50],
          borderColor: brand.aiAccent,
          boxShadow: `0 18px 50px ${colors.shadow}`,
        }}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
          style={{
            background: brand.aiBg,
            color: brand.aiAccent,
            borderColor: brand.aiAccent,
          }}
        >
          <AlertIcon />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="text-[13px] font-semibold leading-tight"
            style={{ color: colors.text.primary }}
          >
            {toast.title}
          </p>
          <p
            className="mt-1 text-[12px] leading-relaxed"
            style={{ color: colors.text.secondary }}
          >
            {toast.message}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
          style={{ color: colors.text.secondary }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = colors.surface[100];
            event.currentTarget.style.color = colors.text.primary;
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = "transparent";
            event.currentTarget.style.color = colors.text.secondary;
          }}
          aria-label="Dismiss notification"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

function InfoPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5"
      style={{
        background: colors.surface[50],
        borderColor: colors.surface[200],
        color: colors.text.secondary,
      }}
    >
      <span style={{ color: brand.action }}>{icon}</span>
      <span className="text-[12px] font-medium">{label}</span>
    </div>
  );
}

export default function VerifyLookupPage() {
  const navigate = useNavigate();
  const [certId, setCertId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showErrorToast = (message: string) => {
    setToast({
      type: "error",
      title: "Verification error",
      message,
    });
  };

  const handleVerify = () => {
    const trimmed = normalizeCertificateId(certId).toUpperCase();

    if (!trimmed) {
      const message = "Please enter a certificate ID.";
      setError(message);
      showErrorToast(message);
      return;
    }

    if (!isValidCertificateId(trimmed)) {
      const message =
        trimmed.length < 8
          ? "Certificate IDs are at least 8 characters."
          : "Certificate IDs may only contain letters, numbers, dashes, and underscores.";
      setError(message);
      showErrorToast(message);
      return;
    }

    setIsLoading(true);
    setError(null);
    setToast(null);

    const path = ROUTES.VERIFY.replace(":certId", encodeURIComponent(trimmed));

    navigate(path);
  };

  return (
    <div
      className="flex min-h-screen flex-col overflow-hidden font-sans"
      style={{ background: colors.surface[50] }}
    >
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="relative flex-1">
        <div className="relative z-10 mx-auto max-w-[1120px] px-6 pb-20 pt-24">
          <div className="mx-auto mb-10 max-w-[760px] text-center">
            <h1
              className="mb-5 text-[2.75rem] font-bold leading-[0.95] tracking-[-0.055em] md:text-[4.4rem]"
              style={{ color: colors.text.primary }}
            >
              Verify authorship
              <br />
              with confidence.
            </h1>

            <p
              className="mx-auto max-w-[620px] text-[15px] leading-relaxed md:text-lg"
              style={{ color: colors.text.secondary }}
            >
              Enter a TypeTrace certificate ID to validate cryptographic
              authorship evidence, inspect behavioral session metadata, and
              confirm the certificate exists in the verification ledger.
            </p>

            <div className="mt-7 flex flex-wrap justify-center gap-2">
              <InfoPill icon={<FileSealIcon />} label="SHA-256 sealed" />
              <InfoPill
                icon={<FingerprintIcon />}
                label="Behavioral biometrics"
              />
              <InfoPill icon={<ShieldCheck />} label="No account required" />
            </div>
          </div>

          <div
            className="mx-auto flex max-w-[760px] flex-col gap-4 rounded-md border p-5 md:p-6"
            style={{
              background: colors.surface[50],
              borderColor: colors.surface[200],
              boxShadow: `0 30px 100px ${colors.shadow}`,
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-md border sm:flex"
                style={{
                  background: colors.brandSoft,
                  color: brand.action,
                  borderColor: colors.surface[200],
                }}
              >
                <SearchIcon />
              </div>

              <div className="flex-1">
                <label
                  className="text-[12px] font-bold uppercase tracking-widest"
                  style={{ color: colors.text.secondary }}
                >
                  Certificate ID
                </label>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={certId}
                    onChange={(event) => {
                      setCertId(event.target.value.toUpperCase());
                      setError(null);
                    }}
                    onKeyDown={(event) =>
                      event.key === "Enter" && handleVerify()
                    }
                    placeholder="TT26-A1B2C3D4"
                    className="h-12 flex-1 rounded-md border px-4 font-mono text-[14px] outline-none transition-all"
                    style={{
                      borderColor: error ? brand.aiAccent : colors.surface[200],
                      color: colors.text.primary,
                      background: colors.surface[100],
                    }}
                    onFocus={(event) => {
                      event.currentTarget.style.borderColor = brand.action;
                      event.currentTarget.style.boxShadow = `0 0 0 4px ${colors.brandSoft}`;
                      event.currentTarget.style.background = colors.surface[50];
                    }}
                    onBlur={(event) => {
                      event.currentTarget.style.borderColor = error
                        ? brand.aiAccent
                        : colors.surface[200];
                      event.currentTarget.style.boxShadow = "none";
                      event.currentTarget.style.background =
                        colors.surface[100];
                    }}
                  />

                  <button
                    type="button"
                    onClick={handleVerify}
                    disabled={isLoading}
                    className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-md px-6 text-[14px] font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-70"
                    style={{
                      background: brand.action,
                      color: brand.textOnDark,
                      boxShadow: isLoading
                        ? "none"
                        : `0 16px 38px ${colors.shadowStrong}`,
                    }}
                    onMouseEnter={(event) => {
                      if (!isLoading) {
                        event.currentTarget.style.background =
                          brand.actionHover;
                      }
                    }}
                    onMouseLeave={(event) => {
                      if (!isLoading) {
                        event.currentTarget.style.background = brand.action;
                      }
                    }}
                  >
                    {isLoading ? (
                      <>
                        <svg
                          className="h-4 w-4 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            fill="currentColor"
                            d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
                          />
                        </svg>
                        Opening
                      </>
                    ) : (
                      <>
                        Verify
                        <SearchIcon />
                      </>
                    )}
                  </button>
                </div>

                <p
                  className="mt-3 text-[12px]"
                  style={{ color: colors.text.secondary }}
                >
                  Certificate IDs look like:{" "}
                  <code
                    className="font-mono font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    TT26-A1B2C3D4
                  </code>
                </p>
              </div>
            </div>
          </div>

          <p
            className="mt-10 text-center text-[12px]"
            style={{ color: colors.text.secondary }}
          >
            Powered by{" "}
            <Link
              to={ROUTES.HOME}
              className="font-semibold hover:underline"
              style={{ color: brand.action }}
            >
              TypeTrace
            </Link>{" "}
            - Behavioral Authorship Verification Platform
          </p>
        </div>
      </div>
    </div>
  );
}
