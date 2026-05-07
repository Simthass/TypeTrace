import { Link } from "react-router-dom";
import { ROUTES } from "../constants/routes";

/* ─── Icons ──────────────────────────────────────────────────────────────── */
function ArrowRight({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 7.5h9M8 3.5l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KeystrokeIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="5"
        width="18"
        height="12"
        rx="2.5"
        stroke="#2A7FE0"
        strokeWidth="1.5"
      />
      <rect
        x="4.5"
        y="7.5"
        width="3"
        height="2.5"
        rx="0.8"
        fill="#2A7FE0"
        opacity="0.3"
      />
      <rect x="9.5" y="7.5" width="3" height="2.5" rx="0.8" fill="#2A7FE0" />
      <rect
        x="14.5"
        y="7.5"
        width="3"
        height="2.5"
        rx="0.8"
        fill="#2A7FE0"
        opacity="0.3"
      />
      <rect
        x="6"
        y="12"
        width="10"
        height="2.5"
        rx="0.8"
        fill="#2A7FE0"
        opacity="0.2"
      />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M11 4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2s2-.9 2-2V6c0-1.1-.9-2-2-2z"
        stroke="#2A7FE0"
        strokeWidth="1.5"
      />
      <path
        d="M7 8c-1.7 0-3 1.3-3 3s1.3 3 3 3"
        stroke="#2A7FE0"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M15 8c1.7 0 3 1.3 3 3s-1.3 3-3 3"
        stroke="#2A7FE0"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M7 8c0-1.7 1.3-3 3-3M15 8c0-1.7-1.3-3-3-3"
        stroke="#2A7FE0"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M11 3L4 6.5v4.8c0 3.8 3 7.1 7 8.2 4-1.1 7-4.4 7-8.2V6.5L11 3z"
        stroke="#2A7FE0"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 11.5l2.2 2.2 4.8-5.4"
        stroke="#2A7FE0"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CertIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 2.5h8a1.5 1.5 0 011.5 1.5v14.5L11 16.5l-5.5 2V4A1.5 1.5 0 017 2.5z"
        stroke="#2A7FE0"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 7.5h5M8.5 10.5h3.5"
        stroke="#2A7FE0"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="4"
        y="9.5"
        width="14"
        height="10"
        rx="2.5"
        stroke="#2A7FE0"
        strokeWidth="1.5"
      />
      <path
        d="M7 9.5V7a4 4 0 018 0v2.5"
        stroke="#2A7FE0"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="11" cy="14.5" r="1" fill="#2A7FE0" />
      <path
        d="M11 15.5v1.5"
        stroke="#2A7FE0"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 11h2.5l2-5 3 9 3-12 3 10 2-3H20"
        stroke="#2A7FE0"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckCircleIcon({ color = "#10B67E" }: { color?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="7" stroke={color} strokeWidth="1.3" />
      <path
        d="M5 8l2 2 4-4"
        stroke={color}
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Dot grid pattern component ─────────────────────────────────────────── */
function DotPattern() {
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, #D1D9E0 0.8px, transparent 0.8px)",
          backgroundSize: "18px 18px",
          opacity: 0.5,
        }}
      />
    </div>
  );
}

/* ─── Data ───────────────────────────────────────────────────────────────── */
const features = [
  {
    Icon: KeystrokeIcon,
    title: "Keystroke Dynamics Capture",
    description:
      "Every key press is recorded with millisecond precision, creating an unbreakable behavioral chain of evidence unique to you.",
  },
  {
    Icon: WaveIcon,
    title: "Inter-Key Interval Analysis",
    description:
      "Your natural pause patterns, typing bursts, and rhythm variations form a biometric fingerprint impossible to replicate.",
  },
  {
    Icon: LockIcon,
    title: "Privacy-First Design",
    description:
      "Content stays local. Data never leaves your device unless you explicitly export your certificate.",
  },
  {
    Icon: BrainIcon,
    title: "ML-Powered Classification",
    description:
      "A trained Random Forest model classifies your session as HUMAN, SUSPICIOUS, or AI-GENERATED with high accuracy.",
  },
  {
    Icon: CertIcon,
    title: "Tamper-Proof Certificates",
    description:
      "Cryptographically hashed PDF certificates link your session data to a verifiable authorship record.",
  },
  {
    Icon: ShieldCheckIcon,
    title: "GDPR-Compliant Export",
    description:
      "Full data control. Export your full session history or delete it permanently with a single action.",
  },
] as const;

const steps = [
  {
    step: "01",
    title: "Open the Editor",
    description:
      "Start a new session in the clean, distraction-free TypeTrace writing environment.",
  },
  {
    step: "02",
    title: "Write Naturally",
    description:
      "Our invisible recorder captures your unique keystroke rhythm and timing without disrupting your flow.",
  },
  {
    step: "03",
    title: "Pattern Analysed",
    description:
      "The ML model builds a behavioural fingerprint from your pauses, speed, and revision patterns in real time.",
  },
  {
    step: "04",
    title: "Get Your Certificate",
    description:
      "Download a cryptographically sealed PDF proving human authorship — ready to submit alongside your work.",
  },
] as const;

const classificationCards = [
  {
    label: "HUMAN",
    score: "96.3%",
    confidence: "High confidence",
    description:
      "Consistent rhythm, natural IKI variance, no paste events detected.",
    dot: "bg-verify",
    scoreCls: "text-verify",
    bgCls: "bg-verify-bg",
    borderCls: "border-verify/25",
    badgeCls: "text-verify-text bg-verify-bg border-verify/20",
  },
  {
    label: "SUSPICIOUS",
    score: "67.2%",
    confidence: "Needs review",
    description:
      "Irregular patterns and paste events detected — manual review recommended.",
    dot: "bg-warn",
    scoreCls: "text-warn",
    bgCls: "bg-warn-bg",
    borderCls: "border-warn/25",
    badgeCls: "text-warn-text bg-warn-bg border-warn/20",
  },
  {
    label: "AI-GENERATED",
    score: "94.8%",
    confidence: "High confidence",
    description:
      "Entire content pasted at once with zero natural keystroke variation.",
    dot: "bg-danger",
    scoreCls: "text-danger",
    bgCls: "bg-danger-bg",
    borderCls: "border-danger/25",
    badgeCls: "text-danger-text bg-danger-bg border-danger/20",
  },
] as const;

const stats = [
  { value: "10k+", label: "Sessions analysed" },
  { value: "96.3%", label: "Classification accuracy" },
  { value: "<2s", label: "Analysis time" },
  { value: "4", label: "Universities piloting" },
] as const;

const trustItems = [
  "No content stored on our servers",
  "GDPR compliant by design",
  "WCAG 2.1 AA accessible",
  "Open-source ML model",
] as const;

/* ─── Reusable Section Heading ───────────────────────────────────────────── */
function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
}) {
  const alignCls =
    align === "center"
      ? "text-center items-center mx-auto"
      : "text-left items-start";
  return (
    <div className={`flex flex-col gap-3 mb-14 max-w-2xl ${alignCls}`}>
      {eyebrow && (
        <span className="text-[12px] font-semibold uppercase tracking-widest text-brand">
          {eyebrow}
        </span>
      )}
      <h2 className="text-[32px] sm:text-[38px] font-semibold text-text-primary tracking-tight leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="text-[16px] text-text-secondary leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ─── Main HomePage ──────────────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <div className="bg-surface-50">
      {/* ================================================================ */}
      {/* HERO — unified layout with no visual separation                  */}
      {/* ================================================================ */}
      <section
        className="relative overflow-hidden bg-surface-50"
        style={{
          paddingLeft: "80px",
          paddingRight: "80px",
          paddingTop: "72px",
          paddingBottom: "72px",
        }}
      >
        <DotPattern />

        {/* Main hero grid — text and mockup side by side with equal margins */}
        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-16 items-center max-w-[1280px] mx-auto">
          {/* LEFT COLUMN — All text content */}
          <div className="flex flex-col gap-6">
            {/* Top badge pill */}
            <div className="inline-flex items-center gap-2 text-[12px] font-semibold text-brand bg-brand/6 border border-brand/15 rounded-full px-3.5 py-1.5 w-fit">
              <span
                className="h-1.5 w-1.5 rounded-full bg-brand"
                aria-hidden="true"
              />
              Academic Authorship Verification
            </div>

            {/* Main headline */}
            <h1 className="text-[44px] sm:text-[50px] lg:text-[56px] font-semibold text-text-primary tracking-tight leading-[1.06]">
              Certify Your Creativity
              <br />
              <span className="text-brand">with Behavioural Proof.</span>
            </h1>

            {/* Supporting paragraph */}
            <p className="text-[16px] sm:text-[17px] text-text-secondary leading-[1.7] max-w-[480px]">
              TypeTrace is an advanced keystroke biometric system designed for
              academic integrity. Write naturally — your typing rhythm becomes
              cryptographic proof of authorship.
            </p>

            {/* Trust bullet points */}
            <ul className="flex flex-col gap-2.5" role="list">
              {trustItems.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2.5 text-[14px] text-text-secondary"
                >
                  <CheckCircleIcon />
                  {item}
                </li>
              ))}
            </ul>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                to={ROUTES.EDITOR_NEW}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-[14px] font-medium text-white bg-brand rounded-xl transition-all duration-150 hover:bg-brand-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                Start Writing — Generate Proof
                <ArrowRight />
              </Link>
              <Link
                to={ROUTES.HOW_IT_WORKS}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-[14px] font-medium text-text-secondary bg-white border border-surface-200 rounded-xl transition-all duration-150 hover:border-brand/30 hover:text-brand active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                See How It Works
              </Link>
            </div>
          </div>

          {/* RIGHT COLUMN — Mock editor UI preview */}
          <div className="w-full max-w-[540px] lg:justify-self-end">
            <div className="w-full rounded-2xl border border-surface-200 bg-white shadow-[0_8px_40px_rgba(26,35,50,0.08)] overflow-hidden">
              {/* Mock window top bar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-surface-200 bg-surface-50">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-warn/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-verify/60" />
                </div>
                <span className="text-[12px] text-text-secondary font-medium">
                  Session — Essay on Climate Change
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-verify-text bg-verify-bg border border-verify/20 rounded-full px-2.5 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-verify" />
                  LIVE
                </span>
              </div>

              {/* Mock editor body */}
              <div className="p-5 flex flex-col gap-4">
                {/* Fake paragraph lines */}
                <div className="flex flex-col gap-2.5">
                  {[100, 92, 78, 94, 55, 68].map((w, i) => (
                    <div
                      key={i}
                      className="h-2 rounded-full bg-surface-100"
                      style={{ width: `${w}%` }}
                      aria-hidden="true"
                    />
                  ))}
                  {/* Blinking cursor line */}
                  <div className="flex items-center gap-1" aria-hidden="true">
                    <div
                      className="h-2 rounded-full bg-surface-100"
                      style={{ width: "42%" }}
                    />
                    <div className="h-4 w-[2px] bg-brand rounded-full animate-pulse" />
                  </div>
                </div>

                {/* IKI waveform mini card */}
                <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                      IKI Waveform
                    </span>
                    <span className="text-[11px] font-semibold text-brand">
                      avg 284ms
                    </span>
                  </div>
                  <svg
                    viewBox="0 0 280 40"
                    className="w-full h-9"
                    aria-label="IKI waveform chart"
                  >
                    <polyline
                      points="0,24 18,14 36,28 54,10 72,22 90,8 108,26 126,12 144,32 162,10 180,24 198,6 216,28 234,14 252,22 280,10"
                      fill="none"
                      stroke="#2A7FE0"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                {/* Stats row inside mock */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Words", value: "1,247" },
                    { label: "WPM", value: "68" },
                    { label: "Confidence", value: "96.3%" },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-xl border border-surface-200 bg-surface-50 p-2.5 text-center"
                    >
                      <div className="text-[15px] font-semibold text-text-primary">
                        {value}
                      </div>
                      <div className="text-[11px] text-text-secondary mt-0.5">
                        {label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Classification strip */}
                <div className="flex items-center justify-between rounded-xl border border-verify/25 bg-verify-bg px-4 py-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-widest text-verify-text mb-0.5">
                      Classification
                    </div>
                    <div className="text-[18px] font-bold text-verify">
                      HUMAN
                    </div>
                  </div>
                  <button
                    type="button"
                    className="px-4 py-2 text-[13px] font-medium text-white bg-brand rounded-lg transition-colors duration-150 hover:bg-brand-hover"
                  >
                    Get Certificate
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* STATS BAR                                                        */}
      {/* ================================================================ */}
      <section className="border-y border-surface-200 bg-white">
        <div
          className="py-7 grid grid-cols-2 lg:grid-cols-4 gap-6"
          style={{ paddingLeft: "80px", paddingRight: "80px" }}
        >
          {stats.map(({ value, label }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-[26px] font-bold text-brand leading-none">
                {value}
              </span>
              <span className="text-[13px] text-text-secondary">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================ */}
      {/* HOW IT WORKS — 4 step timeline                                   */}
      {/* ================================================================ */}
      <section
        className="py-20 lg:py-24"
        style={{ paddingLeft: "80px", paddingRight: "80px" }}
      >
        <SectionHeading
          eyebrow="Process"
          title="Four steps to verified authorship"
          subtitle="From first keystroke to certified proof — the entire process takes the length of your writing session."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <div key={step.step} className="relative flex flex-col gap-4">
              {/* Horizontal connector line between steps on desktop */}
              {i < steps.length - 1 && (
                <div
                  className="hidden lg:block absolute top-6 left-[52px] right-0 h-px bg-surface-200"
                  aria-hidden="true"
                />
              )}
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-brand/6 border border-brand/12 shrink-0">
                <span className="text-[14px] font-bold text-brand">
                  {step.step}
                </span>
              </div>
              <h3 className="text-[16px] font-semibold text-text-primary">
                {step.title}
              </h3>
              <p className="text-[14px] text-text-secondary leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================ */}
      {/* FEATURES GRID                                                    */}
      {/* ================================================================ */}
      <section className="bg-white border-t border-surface-200">
        <div
          className="py-20 lg:py-24"
          style={{ paddingLeft: "80px", paddingRight: "80px" }}
        >
          <SectionHeading
            eyebrow="Features"
            title="Everything you need to prove authorship"
            subtitle="A full verification stack — from raw keystroke capture to tamper-proof export."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ Icon, title, description }) => (
              <div
                key={title}
                className="group flex flex-col gap-4 p-6 rounded-2xl border border-surface-200 bg-surface-50 transition-all duration-200 hover:border-brand/25 hover:bg-white hover:shadow-card-md"
              >
                <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-brand/6 border border-brand/10 shrink-0 transition-colors duration-200 group-hover:bg-brand/10">
                  <Icon />
                </div>
                <h3 className="text-[15px] font-semibold text-text-primary">
                  {title}
                </h3>
                <p className="text-[13px] text-text-secondary leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* CLASSIFICATION RESULTS                                           */}
      {/* ================================================================ */}
      <section
        className="py-20 lg:py-24"
        style={{ paddingLeft: "80px", paddingRight: "80px" }}
      >
        <SectionHeading
          eyebrow="Results"
          title="Three classification outcomes"
          subtitle="Every session ends with one of three clear verdicts — built to be immediately understood by students and educators alike."
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {classificationCards.map((card) => (
            <div
              key={card.label}
              className={`flex flex-col gap-4 p-7 rounded-2xl border ${card.borderCls} ${card.bgCls} transition-all duration-150 hover:shadow-card-md`}
            >
              <span
                className={`inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest w-fit px-2.5 py-1 rounded-full border ${card.badgeCls}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${card.dot}`} />
                {card.label}
              </span>
              <div>
                <span
                  className={`text-[48px] font-bold leading-none ${card.scoreCls}`}
                >
                  {card.score}
                </span>
                <div className="text-[12px] text-text-secondary mt-1">
                  {card.confidence}
                </div>
              </div>
              <p className="text-[13px] text-text-secondary leading-relaxed border-t border-current/10 pt-4">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================ */}
      {/* TRUST SECTION — completely redesigned                            */}
      {/* ================================================================ */}
      <section className="bg-white border-t border-surface-200">
        <div
          className="py-20 lg:py-24"
          style={{ paddingLeft: "80px", paddingRight: "80px" }}
        >
          <SectionHeading
            eyebrow="Trust & Privacy"
            title="Built for institutional trust"
            subtitle="Designed from the ground up for academic environments where data sensitivity, compliance, and reliability are non-negotiable."
          />

          {/* 3-column trust cards — clean and equally sized */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1 — Privacy */}
            <div className="group flex flex-col gap-5 p-7 rounded-2xl border border-surface-200 bg-surface-50 transition-all duration-200 hover:bg-white hover:shadow-card-md hover:border-brand/20">
              {/* Icon */}
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-brand/6 border border-brand/10 shrink-0 transition-colors duration-200 group-hover:bg-brand/10">
                <LockIcon />
              </div>
              {/* Content */}
              <div className="flex flex-col gap-2.5">
                <h3 className="text-[16px] font-semibold text-text-primary">
                  Zero server-side storage
                </h3>
                <p className="text-[13px] text-text-secondary leading-relaxed">
                  Your essay content never leaves your device. Only anonymised
                  keystroke metadata is processed, and you control when data is
                  uploaded or deleted.
                </p>
              </div>
              {/* Bottom tag */}
              <div className="mt-auto pt-3 border-t border-surface-200">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-verify-text">
                  <CheckCircleIcon color="#0D7A4C" />
                  GDPR Compliant
                </span>
              </div>
            </div>

            {/* Card 2 — Verification */}
            <div className="group flex flex-col gap-5 p-7 rounded-2xl border border-surface-200 bg-surface-50 transition-all duration-200 hover:bg-white hover:shadow-card-md hover:border-brand/20">
              {/* Icon */}
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-brand/6 border border-brand/10 shrink-0 transition-colors duration-200 group-hover:bg-brand/10">
                <ShieldCheckIcon />
              </div>
              {/* Content */}
              <div className="flex flex-col gap-2.5">
                <h3 className="text-[16px] font-semibold text-text-primary">
                  Verifiable certificates
                </h3>
                <p className="text-[13px] text-text-secondary leading-relaxed">
                  Each certificate includes a QR code and SHA-256 hash. Any
                  institution can verify authenticity instantly through our
                  public verification endpoint.
                </p>
              </div>
              {/* Bottom tag */}
              <div className="mt-auto pt-3 border-t border-surface-200">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-verify-text">
                  <CheckCircleIcon color="#0D7A4C" />
                  SHA-256 Hashed
                </span>
              </div>
            </div>

            {/* Card 3 — Open Source */}
            <div className="group flex flex-col gap-5 p-7 rounded-2xl border border-surface-200 bg-surface-50 transition-all duration-200 hover:bg-white hover:shadow-card-md hover:border-brand/20">
              {/* Icon */}
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-brand/6 border border-brand/10 shrink-0 transition-colors duration-200 group-hover:bg-brand/10">
                <BrainIcon />
              </div>
              {/* Content */}
              <div className="flex flex-col gap-2.5">
                <h3 className="text-[16px] font-semibold text-text-primary">
                  Auditable ML model
                </h3>
                <p className="text-[13px] text-text-secondary leading-relaxed">
                  Our Random Forest classifier is fully open-source.
                  Universities can audit the training data, feature weights, and
                  decision thresholds independently.
                </p>
              </div>
              {/* Bottom tag */}
              <div className="mt-auto pt-3 border-t border-surface-200">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-verify-text">
                  <CheckCircleIcon color="#0D7A4C" />
                  Open Source
                </span>
              </div>
            </div>
          </div>

          {/* Bottom strip — compliance badges row */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "WCAG 2.1 AA", desc: "Accessibility standard" },
              { label: "TLS 1.3", desc: "Encryption in transit" },
              { label: "AES-256", desc: "Encryption at rest" },
              { label: "ISO 27001", desc: "Security framework" },
            ].map(({ label, desc }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5 p-5 rounded-2xl border border-surface-200 bg-surface-50/50 transition-all duration-150 hover:bg-white hover:shadow-card"
              >
                <span className="text-[15px] font-bold text-text-primary">
                  {label}
                </span>
                <span className="text-[11px] text-text-secondary text-center">
                  {desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* CTA BANNER                                                       */}
      {/* ================================================================ */}
      <section
        className="border-t border-surface-200"
        style={{
          paddingLeft: "80px",
          paddingRight: "80px",
          paddingTop: "80px",
          paddingBottom: "80px",
          background:
            "linear-gradient(160deg, #F5F7FA 0%, #EBF4FF 60%, #F5F7FA 100%)",
        }}
      >
        <div className="max-w-[640px] mx-auto text-center flex flex-col items-center gap-6">
          {/* Icon cluster above heading */}
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-white border border-surface-200 shadow-card">
              <KeystrokeIcon />
            </div>
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-brand shadow-[0_4px_16px_rgba(42,127,224,0.3)]">
              <svg
                width="22"
                height="22"
                viewBox="0 0 22 22"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M11 3L4 6.5v4.8c0 3.8 3 7.1 7 8.2 4-1.1 7-4.4 7-8.2V6.5L11 3z"
                  fill="white"
                  opacity="0.9"
                />
              </svg>
            </div>
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-white border border-surface-200 shadow-card">
              <CertIcon />
            </div>
          </div>

          <h2 className="text-[30px] sm:text-[36px] font-semibold text-text-primary tracking-tight leading-tight">
            See your typing pattern
            <br />
            analysed in real time
          </h2>

          <p className="text-[16px] text-text-secondary leading-relaxed max-w-md">
            Open the editor, start writing, and watch your behavioural
            fingerprint build — live. Your first certificate takes minutes.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link
              to={ROUTES.EDITOR_NEW}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-[14px] font-medium text-white bg-brand rounded-xl transition-all duration-150 hover:bg-brand-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 shadow-[0_4px_16px_rgba(42,127,224,0.25)] hover:shadow-[0_6px_20px_rgba(42,127,224,0.35)]"
            >
              Open Editor — Start Typing
              <ArrowRight />
            </Link>
            <Link
              to={ROUTES.REGISTER}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-[14px] font-medium text-text-secondary bg-white border border-surface-200 rounded-xl transition-all duration-150 hover:border-brand/30 hover:text-brand active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              Create Free Account
            </Link>
          </div>

          <p className="text-[12px] text-text-secondary/60">
            No account required to try · Free for students
          </p>
        </div>
      </section>
    </div>
  );
}
