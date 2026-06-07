// frontend/src/components/auth/AuthPanel.tsx

import type {
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { Link } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { brand, colors } from "../../styles/colors";

interface AuthPanelProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  sideTitle: string;
  sideDescription: string;
}

export function AuthPanel({
  eyebrow,
  title,
  description,
  children,
  sideTitle,
  sideDescription,
}: AuthPanelProps) {
  return (
    <div
      className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[1fr_0.92fr]"
      style={{ background: colors.surface[50] }}
    >
      <section className="flex items-center justify-center px-6 py-12 md:px-10">
        <div className="w-full max-w-[460px]">
          <Link
            to={ROUTES.HOME}
            className="mb-10 inline-flex w-fit items-center"
          >
            <img
              src="/Logo.png"
              alt="TypeTrace"
              className="h-[34px] w-auto object-contain"
            />
          </Link>

          <p
            className="text-[11px] font-bold uppercase tracking-[0.2em]"
            style={{ color: colors.brand }}
          >
            {eyebrow}
          </p>

          <h1
            className="mt-3 text-[2.4rem] font-bold leading-[1.02] tracking-[-0.05em]"
            style={{ color: colors.text.primary }}
          >
            {title}
          </h1>

          <p
            className="mt-4 text-[15px] leading-7"
            style={{ color: colors.text.secondary }}
          >
            {description}
          </p>

          <div className="mt-8">{children}</div>
        </div>
      </section>

      <section
        className="relative hidden overflow-hidden border-l px-10 py-12 lg:flex lg:items-center"
        style={{
          borderColor: colors.surface[200],
          background: colors.surface[100],
        }}
      >
        <div
          className="absolute left-[-20%] top-[8%] h-[34rem] w-[34rem] rounded-full"
          style={{
            background: `radial-gradient(circle, ${colors.brandSoft} 0%, transparent 66%)`,
            filter: "blur(40px)",
          }}
        />

        <div className="relative z-10 mx-auto w-full max-w-[520px]">
          <div
            className="rounded-3xl border bg-white p-6"
            style={{
              borderColor: colors.surface[200],
              boxShadow: `0 24px 80px -48px ${colors.shadowStrong}`,
            }}
          >
            <div
              className="flex items-center justify-between border-b pb-5"
              style={{ borderColor: colors.surface[200] }}
            >
              <div>
                <p
                  className="text-[11px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: colors.text.secondary }}
                >
                  Live authorship trail
                </p>
                <p
                  className="mt-1 text-[15px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  Process-based verification
                </p>
              </div>

              <div
                className="rounded-md border px-2.5 py-1.5 text-[11px] font-bold"
                style={{
                  borderColor: brand.humanAccent,
                  background: brand.humanBg,
                  color: brand.humanText,
                }}
              >
                Verified
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {[
                [
                  "Keystroke rhythm",
                  "Natural variance detected",
                  brand.humanAccent,
                ],
                ["Paste burst", "No high-risk event", brand.humanAccent],
                ["Certificate", "Ready for academic review", colors.brand],
              ].map(([label, value, accent]) => (
                <div
                  key={label}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: colors.surface[200],
                    background: colors.surface[50],
                  }}
                >
                  <div className="flex items-center justify-between">
                    <p
                      className="text-[13px] font-semibold"
                      style={{ color: colors.text.primary }}
                    >
                      {label}
                    </p>
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: accent }}
                    />
                  </div>
                  <p
                    className="mt-1 text-[12px]"
                    style={{ color: colors.text.secondary }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <h2
            className="mt-10 text-[2.4rem] font-bold leading-[1.04] tracking-[-0.05em]"
            style={{ color: colors.text.primary }}
          >
            {sideTitle}
          </h2>

          <p
            className="mt-4 max-w-md text-[15px] leading-7"
            style={{ color: colors.text.secondary }}
          >
            {sideDescription}
          </p>
        </div>
      </section>
    </div>
  );
}

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function AuthField({ label, error, ...props }: AuthFieldProps) {
  return (
    <label className="block">
      <span
        className="text-[13px] font-semibold"
        style={{ color: colors.text.primary }}
      >
        {label}
      </span>

      <input
        {...props}
        className="mt-2 h-11 w-full rounded-md border px-3 text-[14px] outline-none transition focus:ring-2"
        style={{
          borderColor: error ? brand.aiAccent : colors.surface[200],
          color: colors.text.primary,
          background: colors.surface[50],
        }}
      />

      {error && (
        <p className="mt-1.5 text-[12px]" style={{ color: brand.aiAccent }}>
          {error}
        </p>
      )}
    </label>
  );
}

interface AuthSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

export function AuthSelect({ label, children, ...props }: AuthSelectProps) {
  return (
    <label className="block">
      <span
        className="text-[13px] font-semibold"
        style={{ color: colors.text.primary }}
      >
        {label}
      </span>

      <select
        {...props}
        className="mt-2 h-11 w-full rounded-md border px-3 text-[14px] outline-none transition focus:ring-2"
        style={{
          borderColor: colors.surface[200],
          color: colors.text.primary,
          background: colors.surface[50],
        }}
      >
        {children}
      </select>
    </label>
  );
}

export function AuthButton({
  children,
  isLoading,
}: {
  children: ReactNode;
  isLoading?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className="flex h-11 w-full items-center justify-center rounded-md px-4 text-[14px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70"
      style={{ background: colors.brand }}
    >
      {isLoading ? "Please wait..." : children}
    </button>
  );
}

export function AuthMessage({
  type,
  children,
}: {
  type: "success" | "error" | "info";
  children: ReactNode;
}) {
  const style =
    type === "success"
      ? { bg: brand.humanBg, text: brand.humanText, border: brand.humanAccent }
      : type === "error"
        ? { bg: brand.aiBg, text: brand.aiText, border: brand.aiAccent }
        : {
            bg: colors.brandSoft,
            text: colors.brand,
            border: colors.surface[200],
          };

  return (
    <div
      className="rounded-md border px-3 py-2.5 text-[13px] leading-6"
      style={{
        background: style.bg,
        color: style.text,
        borderColor: style.border,
      }}
    >
      {children}
    </div>
  );
}

export function AuthForm({
  onSubmit,
  children,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {children}
    </form>
  );
}
