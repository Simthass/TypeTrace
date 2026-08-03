import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";

import { ROUTES } from "../constants/routes";
import { isValidCertificateId, normalizeCertificateId } from "../lib/edgeCases";
import { brand, colors } from "../styles/colors";

interface ToastState {
  type: "error";
  title: string;
  message: string;
}

interface IconProps {
  size?: number;
  strokeWidth?: number;
}

function ShieldCheckIcon({ size = 20, strokeWidth = 1.9 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function FileSealIcon({ size = 21, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <circle cx="12" cy="15" r="3" />
      <path d="m10.7 15 1 1 1.8-2" />
    </svg>
  );
}

function FingerprintIcon({ size = 20, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
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

function LockIcon({ size = 20, strokeWidth = 1.9 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14v3" />
    </svg>
  );
}

function AlertIcon({ size = 18, strokeWidth = 2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function ArrowRightIcon({ size = 16, strokeWidth = 2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function CloseIcon({ size = 14, strokeWidth = 2.2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.28"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
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
    if (!toast) return undefined;

    const timeout = window.setTimeout(onClose, 4200);
    return () => window.clearTimeout(timeout);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className="fixed right-4 top-4 z-[100] w-[calc(100%-32px)] max-w-[390px] sm:right-6 sm:top-6">
      <div
        role="alert"
        aria-live="assertive"
        className="flex items-start gap-3 rounded-2xl border p-4"
        style={{
          background: colors.surface[50],
          borderColor: "rgba(239, 68, 68, 0.28)",
          boxShadow: `0 24px 70px ${colors.shadowStrong}`,
        }}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: brand.aiBg, color: brand.aiText }}
        >
          <AlertIcon />
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <p
            className="text-[13px] font-bold leading-tight"
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
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
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

function VerificationFeature({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className="rounded-2xl border p-4 text-left"
      style={{
        background: "rgba(255,255,255,0.74)",
        borderColor: colors.surface[200],
        boxShadow: `0 16px 42px -30px ${colors.shadowStrong}`,
        backdropFilter: "blur(14px)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: colors.brandSoft, color: brand.action }}
        >
          {icon}
        </div>
        <div>
          <h2
            className="text-[13px] font-bold"
            style={{ color: colors.text.primary }}
          >
            {title}
          </h2>
          <p
            className="mt-1 text-[12px] leading-relaxed"
            style={{ color: colors.text.secondary }}
          >
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyLookupPage() {
  const navigate = useNavigate();
  const [certId, setCertId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const closeToast = useCallback(() => setToast(null), []);

  const showErrorToast = useCallback((message: string) => {
    setToast({
      type: "error",
      title: "Certificate ID not accepted",
      message,
    });
  }, []);

  const handleVerify = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    if (isLoading) return;

    const normalized = normalizeCertificateId(certId).toUpperCase();

    if (!normalized) {
      const message =
        "Enter the certificate ID printed on the certificate or supplied in its verification link.";
      setError(message);
      showErrorToast(message);
      return;
    }

    if (!isValidCertificateId(normalized)) {
      const message =
        normalized.length < 8
          ? "The certificate ID is incomplete. Check the full ID and try again."
          : "Use only letters, numbers, dashes, and underscores in the certificate ID.";
      setError(message);
      showErrorToast(message);
      return;
    }

    setCertId(normalized);
    setError(null);
    setToast(null);
    setIsLoading(true);

    const path = ROUTES.VERIFY.replace(
      ":certId",
      encodeURIComponent(normalized),
    );

    window.requestAnimationFrame(() => navigate(path));
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden pt-10"
      style={{ background: colors.surface[100] }}
    >
      <Toast toast={toast} onClose={closeToast} />

      <main className="relative z-10 px-5 pb-16 pt-8 sm:px-8 sm:pb-20 sm:pt-12 lg:pt-16">
        <div className="mx-auto flex max-w-[960px] flex-col items-center text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
            style={{
              background: "rgba(255,255,255,0.78)",
              borderColor: colors.surface[200],
              color: brand.action,
              boxShadow: `0 12px 30px -24px ${colors.shadowStrong}`,
              backdropFilter: "blur(12px)",
            }}
          >
            <ShieldCheckIcon size={14} strokeWidth={2.1} />
            <span className="text-[10px] font-bold uppercase tracking-[0.16em]">
              Public certificate verification
            </span>
          </div>

          <h1
            className="mt-6 max-w-[760px] text-[2.15rem] font-bold leading-[1.08] tracking-[-0.045em] min-[380px]:text-[2.4rem] sm:text-[3.7rem] sm:leading-[1.02] lg:text-[4.55rem]"
            style={{ color: colors.text.primary }}
          >
            Verify a TypeTrace
            <br />
            <span style={{ color: brand.action }}>certificate record.</span>
          </h1>

          <p
            className="mt-5 max-w-[650px] text-[14px] leading-7 sm:text-[16px]"
            style={{ color: colors.text.secondary }}
          >
            Enter the certificate ID to confirm that the public record exists,
            review its integrity status, and view the limited metadata made
            available for academic verification.
          </p>

          <section
            className="relative mt-9 w-full max-w-[790px] overflow-hidden rounded-[28px] border p-2"
            style={{
              background: "rgba(255,255,255,0.62)",
              borderColor: "rgba(203,213,225,0.82)",
              boxShadow: `0 34px 110px -42px ${colors.shadowStrong}`,
              backdropFilter: "blur(18px)",
            }}
            aria-labelledby="certificate-lookup-heading"
          >
            <div
              className="rounded-[22px] border p-5 text-left sm:p-7"
              style={{
                background: colors.surface[50],
                borderColor: colors.surface[200],
              }}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.15em]"
                    style={{ color: brand.action }}
                  >
                    Certificate lookup
                  </p>
                  <h2
                    id="certificate-lookup-heading"
                    className="mt-1 text-[19px] font-bold tracking-[-0.02em] sm:text-[21px]"
                    style={{ color: colors.text.primary }}
                  >
                    Enter the certificate ID
                  </h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                    style={{
                      background: brand.humanBg,
                      color: brand.humanText,
                    }}
                  >
                    <ShieldCheckIcon size={12} strokeWidth={2.2} />
                    No sign-in required
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                    style={{
                      background: colors.brandSoft,
                      color: brand.action,
                    }}
                  >
                    <LockIcon size={12} strokeWidth={2.2} />
                    Review-safe metadata
                  </span>
                </div>
              </div>

              <form onSubmit={handleVerify} className="mt-6" noValidate>
                <label
                  htmlFor="certificate-id"
                  className="text-[11px] font-bold uppercase tracking-[0.13em]"
                  style={{ color: colors.text.secondary }}
                >
                  Certificate ID
                </label>

                <div
                  className="mt-2 flex flex-col gap-2 rounded-2xl border p-2 sm:flex-row sm:items-center"
                  style={{
                    background: colors.surface[100],
                    borderColor: error ? brand.aiAccent : colors.surface[200],
                    boxShadow: error
                      ? "0 0 0 4px rgba(239, 68, 68, 0.08)"
                      : "none",
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3 px-2 sm:px-3">
                    <span style={{ color: brand.action }}>
                      <FileSealIcon size={20} />
                    </span>
                    <input
                      id="certificate-id"
                      type="text"
                      value={certId}
                      onChange={(event) => {
                        setCertId(event.target.value.toUpperCase());
                        setError(null);
                      }}
                      placeholder="TT26-A1B2C3D4"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      maxLength={80}
                      aria-invalid={Boolean(error)}
                      aria-describedby="certificate-id-help certificate-id-error"
                      className="h-12 min-w-0 flex-1 bg-transparent font-mono text-[14px] font-semibold tracking-[0.04em] outline-none placeholder:font-normal placeholder:tracking-normal sm:text-[15px]"
                      style={{ color: colors.text.primary }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl px-6 text-[13px] font-bold sm:w-auto transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
                    style={{
                      background: brand.action,
                      color: brand.textOnDark,
                      boxShadow: isLoading
                        ? "none"
                        : "0 14px 34px rgba(37, 99, 235, 0.26)",
                    }}
                    onMouseEnter={(event) => {
                      if (!isLoading) {
                        event.currentTarget.style.background =
                          brand.actionHover;
                      }
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = brand.action;
                    }}
                  >
                    {isLoading ? (
                      <>
                        <SpinnerIcon />
                        Opening record
                      </>
                    ) : (
                      <>
                        Verify certificate
                        <ArrowRightIcon />
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-3 min-h-[38px]">
                  {error ? (
                    <p
                      id="certificate-id-error"
                      role="alert"
                      className="flex items-start gap-2 text-[12px] leading-relaxed"
                      style={{ color: brand.aiText }}
                    >
                      <span className="mt-0.5 shrink-0">
                        <AlertIcon size={14} />
                      </span>
                      {error}
                    </p>
                  ) : (
                    <p
                      id="certificate-id-help"
                      className="text-[12px] leading-relaxed"
                      style={{ color: colors.text.secondary }}
                    >
                      Find this ID on the certificate PDF or use the
                      verification link supplied with the certificate. Example:{" "}
                      <code
                        className="font-mono font-bold"
                        style={{ color: colors.text.primary }}
                      >
                        TT26-A1B2C3D4
                      </code>
                    </p>
                  )}
                </div>
              </form>
            </div>
          </section>

          <div className="mt-5 grid w-full max-w-[790px] gap-3 sm:grid-cols-3">
            <VerificationFeature
              icon={<FileSealIcon size={19} />}
              title="Certificate record"
              description="Confirms that the certificate ID exists and shows its current public status."
            />
            <VerificationFeature
              icon={<FingerprintIcon size={19} />}
              title="Integrity metadata"
              description="Displays document-hash and signature information made available for verification."
            />
            <VerificationFeature
              icon={<LockIcon size={19} />}
              title="Privacy boundary"
              description="Public lookup does not expose the essay text, replay, or raw keystroke events."
            />
          </div>

          <div
            className="mt-7 flex w-full max-w-[790px] flex-col items-center justify-between gap-4 rounded-2xl border px-4 py-4 text-center sm:flex-row sm:px-5 sm:text-left"
            style={{
              background: "rgba(255,255,255,0.58)",
              borderColor: colors.surface[200],
              backdropFilter: "blur(12px)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: colors.brandSoft, color: brand.action }}
              >
                <ShieldCheckIcon size={16} />
              </div>
              <div>
                <p
                  className="text-[12px] font-bold"
                  style={{ color: colors.text.primary }}
                >
                  Evidence for review, not an automatic misconduct decision
                </p>
                <p
                  className="mt-1 text-[11px] leading-relaxed"
                  style={{ color: colors.text.secondary }}
                >
                  A TypeTrace result should be interpreted with the writing
                  context, institutional policy, and human academic judgement.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3 text-[11px] font-semibold">
              <Link
                to={ROUTES.PRIVACY}
                className="transition-opacity hover:opacity-70"
                style={{ color: brand.action }}
              >
                Privacy and evidence handling
              </Link>
              <span style={{ color: colors.surface[300] }}>•</span>
              <Link
                to={ROUTES.HELP_DOCS}
                className="transition-opacity hover:opacity-70"
                style={{ color: colors.text.secondary }}
              >
                Help documentation
              </Link>
            </div>
          </div>

          <p className="mt-8 text-[11px]" style={{ color: colors.text.muted }}>
            TypeTrace public verification exposes only the information needed to
            check the certificate record.
          </p>
        </div>
      </main>
    </div>
  );
}
