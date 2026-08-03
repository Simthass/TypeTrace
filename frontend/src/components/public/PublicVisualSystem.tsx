import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";

import { ROUTES } from "../../constants/routes";
import { brand, colors } from "../../styles/colors";

export type PublicIconName =
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
  className = "",
}: {
  name: PublicIconName;
  size?: number;
  className?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5, // Thinner, sharper stroke for a premium feel
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className,
  };

  const paths: Record<PublicIconName, ReactNode> = {
    keyboard: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M7 9h.01M10 9h.01M13 9h.01M16 9h.01M7 13h.01M10 13h4M17 13h.01" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
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
      className="relative min-h-screen overflow-hidden"
      style={{ background: colors.surface[50] }}
    >
      {/* Precision Dot Grid Overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(${colors.text.primary} 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />
      {/* Subtle brand glow at the top */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2"
        style={{
          background: `radial-gradient(ellipse at center, ${colors.brandSoft} 0%, transparent 70%)`,
          filter: "blur(60px)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function PublicSection({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section
      className={`mx-auto max-w-7xl px-6 py-24 lg:px-8 ${className}`}
      style={style}
    >
      {children}
    </section>
  );
}

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <div
      className="inline-flex items-center rounded-md border px-3 py-1.5"
      style={{
        borderColor: colors.surface[200],
        background: colors.surface[50],
      }}
    >
      <span
        className="text-[11px] font-bold uppercase tracking-[0.15em]"
        style={{ color: colors.brand }}
      >
        {children}
      </span>
    </div>
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
        align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl"
      }
    >
      {eyebrow && (
        <div className={align === "center" ? "mb-5" : "mb-5"}>
          <SectionEyebrow>{eyebrow}</SectionEyebrow>
        </div>
      )}
      <h2
        className="text-3xl font-bold tracking-[-0.02em] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]"
        style={{ color: colors.text.primary }}
      >
        {title}
      </h2>
      {description && (
        <p
          className="mt-5 text-[16px] leading-relaxed"
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
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`rounded-md border bg-white ${className}`}
      style={{
        borderColor: colors.surface[200],
        boxShadow: `0 12px 32px -8px ${colors.shadow}`,
        ...style,
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
    <PublicCard className="group p-6 transition-all duration-300 hover:shadow-lg">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-md border transition-colors duration-300"
        style={{
          background: colors.surface[50],
          borderColor: colors.surface[200],
          color: colors.brand,
        }}
      >
        <PublicIcon name={icon} size={18} />
      </div>
      <h3
        className="mt-5 text-[15px] font-bold tracking-tight"
        style={{ color: colors.text.primary }}
      >
        {title}
      </h3>
      <p
        className="mt-2.5 text-[14px] leading-relaxed"
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
  className = "",
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`group inline-flex items-center justify-center gap-2 rounded-md px-5 py-3 text-[14px] font-bold transition-all active:scale-[0.98] ${className}`}
      style={{
        background: colors.brand,
        color: colors.text.light,
        boxShadow: `0 4px 14px ${colors.shadowStrong}`,
      }}
    >
      {children}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-transform duration-200 group-hover:translate-x-0.5"
      >
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </svg>
    </Link>
  );
}

export function SecondaryLink({
  to,
  children,
  className = "",
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center gap-2 rounded-md border px-5 py-3 text-[14px] font-bold transition-all hover:bg-surface-100 active:scale-[0.98] ${className}`}
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
    {
      label: "Keystroke rhythm",
      status: "Captured",
      color: colors.brand,
      mono: "184 EVTS",
    },
    {
      label: "Paste activity",
      status: "Flagged",
      color: colors.amber,
      mono: "CLIP_INT",
    },
    {
      label: "Document hash",
      status: "Locked",
      color: colors.green,
      mono: "SHA-256",
    },
  ];

  return (
    <PublicCard className="relative overflow-hidden p-0">
      {/* Dashboard Header */}
      <div
        className="border-b px-5 py-4"
        style={{
          borderColor: colors.surface[200],
          background: colors.surface[50],
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div
                className="h-2.5 w-2.5 rounded-md"
                style={{ background: colors.surface[300] }}
              />
              <div
                className="h-2.5 w-2.5 rounded-md"
                style={{ background: colors.surface[300] }}
              />
            </div>
            <p
              className="font-mono text-[11px] font-bold uppercase tracking-[0.1em]"
              style={{ color: colors.text.muted }}
            >
              Live Evidence Trail
            </p>
          </div>
          <div
            className="rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
            style={{
              borderColor: brand.humanAccent,
              background: brand.humanBg,
              color: brand.humanText,
            }}
          >
            Review-ready
          </div>
        </div>
      </div>

      <div className="p-5">
        <h3
          className="mb-5 text-[15px] font-bold tracking-tight"
          style={{ color: colors.text.primary }}
        >
          Behavioral capture active
        </h3>

        <div className="space-y-3">
          {events.map((event, index) => (
            <motion.div
              key={event.label}
              initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
              whileInView={
                shouldReduceMotion ? undefined : { opacity: 1, x: 0 }
              }
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center justify-between rounded-md border p-3.5 transition-colors hover:bg-surface-50"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[50],
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-2 w-2 rounded-md"
                  style={{ background: event.color }}
                />
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  {event.label}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className="font-mono text-[11px] font-medium"
                  style={{ color: colors.text.muted }}
                >
                  {event.mono}
                </span>
                <span
                  className="text-[12px] font-bold"
                  style={{ color: event.color }}
                >
                  {event.status}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { value: "38s", label: "total pauses" },
            { value: "12", label: "revisions" },
            { value: "98%", label: "confidence" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-md border p-3"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[50],
              }}
            >
              <p
                className="font-mono text-[16px] font-bold tracking-tight"
                style={{ color: colors.text.primary }}
              >
                {stat.value}
              </p>
              <p
                className="mt-1 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: colors.text.secondary }}
              >
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </PublicCard>
  );
}

export function CertificateGraphic() {
  return (
    <PublicCard className="overflow-hidden p-0">
      <div
        className="border-b p-6"
        style={{
          borderColor: colors.surface[200],
          background: colors.surface[50],
        }}
      >
        <div className="flex items-center justify-between mb-8">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-md border"
            style={{
              background: colors.surface[50],
              borderColor: colors.surface[200],
              color: colors.brand,
            }}
          >
            <PublicIcon name="certificate" size={18} />
          </div>
          <span
            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: brand.humanBg,
              borderColor: brand.humanAccent,
              color: brand.humanText,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-md"
              style={{ background: brand.humanText }}
            />
            Ledger recorded
          </span>
        </div>

        <h3
          className="text-[18px] font-bold tracking-tight"
          style={{ color: colors.text.primary }}
        >
          Writing Evidence Certificate
        </h3>
        <p
          className="mt-1.5 text-[13px] leading-relaxed"
          style={{ color: colors.text.secondary }}
        >
          A cryptographically signed record of captured writing-process
          evidence.
        </p>
      </div>

      <div className="p-6">
        <div className="space-y-3">
          {[
            { label: "Certificate ID", value: "TT-8Q4Z2M9A", mono: true },
            { label: "Document hash", value: "SHA256:a3f5b8", mono: true },
            { label: "Status", value: "Verified Human", mono: false },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-md border px-3.5 py-2.5"
              style={{
                borderColor: colors.surface[200],
                background: colors.surface[50],
              }}
            >
              <span
                className="text-[12px] font-medium"
                style={{ color: colors.text.secondary }}
              >
                {row.label}
              </span>
              <span
                className={`text-[12px] font-bold ${row.mono ? "font-mono tracking-tight" : ""}`}
                style={{
                  color:
                    row.label === "Status"
                      ? brand.humanText
                      : colors.text.primary,
                }}
              >
                {row.value}
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
    { icon: "document" as const, label: "Write", active: true },
    { icon: "keyboard" as const, label: "Capture", active: true },
    { icon: "model" as const, label: "Analyze", active: true },
    { icon: "certificate" as const, label: "Verify", active: false },
  ];

  return (
    <PublicCard className="p-8">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.label} className="relative flex flex-col items-center">
            <div
              className="relative z-10 flex h-12 w-12 items-center justify-center rounded-md border transition-all duration-300"
              style={{
                borderColor: step.active ? colors.brand : colors.surface[200],
                background: step.active ? colors.brand : colors.surface[50],
                color: step.active ? colors.text.light : colors.text.muted,
                boxShadow: step.active
                  ? `0 4px 12px ${colors.shadowStrong}`
                  : "none",
              }}
            >
              <PublicIcon name={step.icon} size={18} />
            </div>
            <p
              className="mt-4 text-[13px] font-bold"
              style={{
                color: step.active ? colors.text.primary : colors.text.muted,
              }}
            >
              {step.label}
            </p>
            {index < steps.length - 1 && (
              <div
                className="absolute left-[calc(50%+24px)] top-6 hidden h-px w-[calc(100%-48px)] sm:block"
                style={{
                  background: steps[index + 1].active
                    ? colors.brand
                    : colors.surface[200],
                  opacity: steps[index + 1].active ? 0.3 : 1,
                }}
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
    <PublicSection className="pt-12 pb-24">
      <div
        className="relative overflow-hidden rounded-md border p-10 md:p-14"
        style={{
          borderColor: colors.text.primary,
          background: colors.text.primary,
          boxShadow: `0 24px 60px ${colors.shadowStrong}`,
        }}
      >
        {/* Subtle interior glow */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-md"
          style={{
            background: `radial-gradient(circle, ${colors.brand} 0%, transparent 70%)`,
            opacity: 0.15,
            filter: "blur(40px)",
          }}
        />

        <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <span
              className="inline-flex rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest mb-5"
              style={{
                borderColor: colors.surface[300],
                color: colors.surface[300],
              }}
            >
              Ready for academic review
            </span>
            <h2
              className="text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ color: colors.text.light }}
            >
              Capture the writing process before doubt begins.
            </h2>
            <p
              className="mt-4 max-w-2xl text-[16px] leading-relaxed"
              style={{ color: colors.surface[300] }}
            >
              TypeTrace provides structured behavioral evidence for review. It
              documents how you write, securing your authorship with hard data.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to={ROUTES.REGISTER}
              className="inline-flex items-center justify-center rounded-md px-6 py-3.5 text-[14px] font-bold transition-all hover:opacity-90 active:scale-[0.98]"
              style={{
                background: colors.brand,
                color: colors.text.light,
              }}
            >
              Start session
            </Link>
            <Link
              to={ROUTES.VERIFY_LOOKUP}
              className="inline-flex items-center justify-center rounded-md border px-6 py-3.5 text-[14px] font-bold transition-all hover:bg-surface-50/10 active:scale-[0.98]"
              style={{
                borderColor: colors.surface[300],
                color: colors.text.light,
              }}
            >
              Verify a certificate
            </Link>
          </div>
        </div>
      </div>
    </PublicSection>
  );
}
