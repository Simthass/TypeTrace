import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";

import { ROUTES } from "../../constants/routes";
import { brand, colors } from "../../styles/colors";

type PublicIconName =
  | "keyboard"
  | "shield"
  | "timeline"
  | "certificate"
  | "teacher"
  | "privacy"
  | "search"
  | "replay"
  | "model"
  | "hash"
  | "document"
  | "course";

export function PublicIcon({
  name,
  size = 20,
}: {
  name: PublicIconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<PublicIconName, ReactNode> = {
    keyboard: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M7 9h.01M10 9h.01M13 9h.01M16 9h.01M7 13h.01M10 13h4M17 13h.01" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),
    timeline: (
      <>
        <path d="M4 19V5" />
        <path d="M4 17h16" />
        <path d="M7 14c2-6 4-6 6 0s4 6 6 0" />
        <circle cx="7" cy="14" r="1" />
        <circle cx="13" cy="14" r="1" />
        <circle cx="19" cy="14" r="1" />
      </>
    ),
    certificate: (
      <>
        <path d="M7 3h8l4 4v14H7z" />
        <path d="M15 3v5h5" />
        <path d="M10 13h6M10 17h4" />
        <circle cx="8" cy="20" r="2" />
      </>
    ),
    teacher: (
      <>
        <path d="M4 6h16v11H4z" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
        <path d="M8 10h8M8 13h5" />
      </>
    ),
    privacy: (
      <>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        <path d="M12 15v2" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
    replay: (
      <>
        <path d="M4 12a8 8 0 1 0 2.3-5.7" />
        <path d="M4 4v6h6" />
        <path d="M10 9v6l5-3z" />
      </>
    ),
    model: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
      </>
    ),
    hash: (
      <>
        <path d="M10 3 8 21M16 3l-2 18M4 9h17M3 15h17" />
      </>
    ),
    document: (
      <>
        <path d="M7 3h7l5 5v13H7z" />
        <path d="M14 3v6h5" />
        <path d="M10 13h6M10 17h4" />
      </>
    ),
    course: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative overflow-hidden"
      style={{ background: colors.surface[50] }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          background: `linear-gradient(180deg, ${colors.brandSoft}, ${colors.surface[50]})`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

export function PublicSection({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`mx-auto max-w-7xl px-5 py-20 sm:px-6 lg:px-8 ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p
      className="text-[12px] font-bold uppercase tracking-[0.18em]"
      style={{ color: colors.brand }}
    >
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={
        align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"
      }
    >
      {eyebrow && <SectionEyebrow>{eyebrow}</SectionEyebrow>}
      <h2
        className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl lg:text-5xl"
        style={{ color: colors.text.primary }}
      >
        {title}
      </h2>
      {description && (
        <p
          className="mt-5 text-base leading-8 sm:text-lg"
          style={{ color: colors.text.secondary }}
        >
          {description}
        </p>
      )}
    </div>
  );
}

export function PublicCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md border bg-white ${className}`}
      style={{
        borderColor: colors.surface[200],
        boxShadow: `0 24px 70px ${colors.shadow}`,
      }}
    >
      {children}
    </div>
  );
}

export function IconTile({
  icon,
  title,
  description,
}: {
  icon: PublicIconName;
  title: string;
  description: string;
}) {
  return (
    <PublicCard className="p-6 transition duration-200 hover:-translate-y-1">
      <div
        className="flex h-11 w-11 items-center justify-center rounded-md"
        style={{
          background: colors.brandSoft,
          color: colors.brand,
        }}
      >
        <PublicIcon name={icon} />
      </div>
      <h3
        className="mt-5 text-[16px] font-semibold"
        style={{ color: colors.text.primary }}
      >
        {title}
      </h3>
      <p
        className="mt-3 text-[14px] leading-7"
        style={{ color: colors.text.secondary }}
      >
        {description}
      </p>
    </PublicCard>
  );
}

export function PrimaryLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-[14px] font-bold transition hover:opacity-90"
      style={{
        background: colors.brand,
        color: colors.text.light,
      }}
    >
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}

export function SecondaryLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-md border px-5 py-3 text-[14px] font-bold transition hover:opacity-80"
      style={{
        borderColor: colors.surface[200],
        background: colors.surface[50],
        color: colors.text.primary,
      }}
    >
      {children}
    </Link>
  );
}

export function EvidenceBoard() {
  const shouldReduceMotion = useReducedMotion();

  const events = [
    { label: "Keystroke rhythm", value: "Captured", icon: "keyboard" as const },
    { label: "Paste activity", value: "Flagged", icon: "timeline" as const },
    { label: "Document hash", value: "Locked", icon: "hash" as const },
  ];

  return (
    <PublicCard className="relative overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <div>
          <p
            className="text-[12px] font-bold uppercase tracking-[0.16em]"
            style={{ color: colors.text.secondary }}
          >
            Live evidence trail
          </p>
          <h3
            className="mt-2 text-xl font-semibold tracking-[-0.03em]"
            style={{ color: colors.text.primary }}
          >
            Writing process, not just final text
          </h3>
        </div>

        <div
          className="rounded-md px-3 py-1.5 text-[12px] font-bold"
          style={{
            background: brand.humanBg,
            color: brand.humanText,
          }}
        >
          Review-ready
        </div>
      </div>

      <div
        className="mt-6 rounded-md border p-4"
        style={{ borderColor: colors.surface[200] }}
      >
        <div className="space-y-3">
          {events.map((event, index) => (
            <motion.div
              key={event.label}
              initial={shouldReduceMotion ? false : { opacity: 0, x: -10 }}
              whileInView={
                shouldReduceMotion ? undefined : { opacity: 1, x: 0 }
              }
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              className="flex items-center justify-between rounded-md border p-3"
              style={{
                borderColor: colors.surface[200],
                background: index === 1 ? colors.amberTint : colors.surface[50],
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-md"
                  style={{
                    background: colors.brandSoft,
                    color: colors.brand,
                  }}
                >
                  <PublicIcon name={event.icon} size={17} />
                </span>
                <span
                  className="text-[14px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  {event.label}
                </span>
              </div>
              <span
                className="text-[13px] font-bold"
                style={{ color: colors.text.secondary }}
              >
                {event.value}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          ["184", "events"],
          ["38s", "pauses"],
          ["SHA", "hash"],
        ].map(([value, label]) => (
          <div
            key={label}
            className="rounded-md border p-3 text-center"
            style={{
              borderColor: colors.surface[200],
              background: colors.surface[100],
            }}
          >
            <p
              className="text-lg font-bold"
              style={{ color: colors.text.primary }}
            >
              {value}
            </p>
            <p
              className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: colors.text.secondary }}
            >
              {label}
            </p>
          </div>
        ))}
      </div>
    </PublicCard>
  );
}

export function CertificateGraphic() {
  return (
    <PublicCard className="overflow-hidden p-5">
      <div
        className="rounded-md p-5"
        style={{
          background: `linear-gradient(135deg, ${colors.surface[50]}, ${colors.brandSoft})`,
        }}
      >
        <div className="flex items-center justify-between">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-md"
            style={{ background: colors.brand, color: colors.text.light }}
          >
            <PublicIcon name="certificate" />
          </div>
          <span
            className="rounded-md px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]"
            style={{
              background: brand.humanBg,
              color: brand.humanText,
            }}
          >
            Ledger recorded
          </span>
        </div>

        <h3
          className="mt-8 text-2xl font-semibold tracking-[-0.04em]"
          style={{ color: colors.text.primary }}
        >
          Writing Evidence Certificate
        </h3>

        <p
          className="mt-3 text-[14px] leading-7"
          style={{ color: colors.text.secondary }}
        >
          A review-safe certificate linked to the writing session, behavioral
          evidence, and document integrity hash.
        </p>

        <div className="mt-6 space-y-3">
          {[
            ["Certificate ID", "TT-8Q4Z2M9A1P0K"],
            ["Document hash", "SHA-256 locked"],
            ["Review status", "Supporting evidence"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-md border px-3 py-2"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[50],
              }}
            >
              <span
                className="text-[12px]"
                style={{ color: colors.text.secondary }}
              >
                {label}
              </span>
              <span
                className="text-[12px] font-bold"
                style={{ color: colors.text.primary }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PublicCard>
  );
}

export function WorkflowGraphic() {
  const steps = [
    { icon: "document" as const, label: "Write" },
    { icon: "keyboard" as const, label: "Capture" },
    { icon: "model" as const, label: "Analyze" },
    { icon: "certificate" as const, label: "Verify" },
  ];

  return (
    <PublicCard className="p-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.label} className="relative">
            <div
              className="rounded-md border p-4"
              style={{
                borderColor: colors.surface[200],
                background: index === 2 ? colors.brandSoft : colors.surface[50],
              }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-md"
                style={{
                  background: index === 2 ? colors.brand : colors.surface[100],
                  color: index === 2 ? colors.text.light : colors.brand,
                }}
              >
                <PublicIcon name={step.icon} size={18} />
              </div>
              <p
                className="mt-4 text-[14px] font-bold"
                style={{ color: colors.text.primary }}
              >
                {step.label}
              </p>
            </div>
            {index < steps.length - 1 && (
              <div
                className="hidden sm:block absolute left-[calc(100%-4px)] top-1/2 h-px w-4"
                style={{ background: colors.surface[300] }}
              />
            )}
          </div>
        ))}
      </div>
    </PublicCard>
  );
}

export function PublicCtaBand() {
  return (
    <PublicSection className="pt-8">
      <div
        className="rounded-md border p-8 sm:p-10 lg:p-12"
        style={{
          borderColor: colors.surface[200],
          background: colors.text.primary,
          boxShadow: `0 30px 90px ${colors.shadowStrong}`,
        }}
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p
              className="text-[12px] font-bold uppercase tracking-[0.18em]"
              style={{ color: colors.surface[300] }}
            >
              Ready for academic review
            </p>
            <h2
              className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl"
              style={{ color: colors.text.light }}
            >
              Capture the writing process before doubt begins.
            </h2>
            <p
              className="mt-4 max-w-2xl text-[15px] leading-7"
              style={{ color: colors.surface[300] }}
            >
              TypeTrace provides structured behavioral evidence for review. It
              does not replace academic judgment or institutional procedure.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to={ROUTES.REGISTER}
              className="rounded-md px-5 py-3 text-[14px] font-bold transition hover:opacity-90"
              style={{
                background: colors.brand,
                color: colors.text.light,
              }}
            >
              Start writing session
            </Link>
            <Link
              to={ROUTES.VERIFY_LOOKUP}
              className="rounded-md border px-5 py-3 text-[14px] font-bold transition hover:opacity-80"
              style={{
                borderColor: colors.surface[300],
                color: colors.text.light,
              }}
            >
              Verify certificate
            </Link>
          </div>
        </div>
      </div>
    </PublicSection>
  );
}
