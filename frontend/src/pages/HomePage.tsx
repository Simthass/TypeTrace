import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "framer-motion";

import { ROUTES } from "../constants/routes";
import { brand, colors } from "../styles/colors";
import {
  PublicIcon,
  PublicShell,
  PublicSection,
  SectionEyebrow,
  SectionHeading,
  PublicCard,
  PrimaryLink,
  SecondaryLink,
  type PublicIconName,
} from "../components/public/PublicVisualSystem";

// ─── Image paths ──────────────────────────────────────────────────────────────
const HERO_BG_ARROW_SRC = "/bg-arrow.webp";
// Concentric-circle background for the "Why choose us" section.
// Save the uploaded circles image into your /public folder at this path.
const WHY_CHOOSE_BG_SRC = "/circles-bg.webp";

const IMAGE_PATHS = {
  capture: "/photo-capture-session.webp",
  analysis: "/photo-analysis-review.webp",
  certificate: "/photo-certificate-handoff.webp",
};

// Trust avatar images — replace these paths with your actual images
const TRUST_AVATARS = [
  "/avatar-1.webp",
  "/avatar-2.webp",
  "/avatar-3.webp",
  "/avatar-4.webp",
];

// Student images for WritingSessionsCard — replace with your own
const STUDENT_AVATARS = [
  "/student-js.webp",
  "/student-ak.webp",
  "/student-mp.webp",
  "/student-rt.webp",
  "/student-ln.webp",
  "/student-qw.webp",
  "/student-be.webp",
  "/student-od.webp",
  "/student-cf.webp",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

// ─── Icon primitives ──────────────────────────────────────────────────────────

type IconName =
  | "shield"
  | "search"
  | "keyboard"
  | "timeline"
  | "teacher"
  | "document"
  | "model"
  | "certificate"
  | "hash"
  | "replay"
  | "pulse"
  | "lock"
  | "check"
  | "arrowRight"
  | "spark"
  | "zap"
  | "eye"
  | "fingerprint"
  | "globe"
  | "users"
  | "clock"
  | "activity"
  | "server"
  | "database"
  | "shieldCheck"
  | "barChart"
  | "fileText"
  | "download";

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}

function Icon({ name, size = 16, strokeWidth = 2 }: IconProps) {
  const paths: Record<IconName, ReactNode> = {
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    shieldCheck: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
    keyboard: (
      <>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12" />
      </>
    ),
    timeline: (
      <>
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-7" />
      </>
    ),
    teacher: (
      <>
        <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
      </>
    ),
    document: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </>
    ),
    fileText: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8M16 17H8M10 9H8" />
      </>
    ),
    model: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      </>
    ),
    certificate: (
      <>
        <circle cx="12" cy="8" r="6" />
        <path d="M9 13.5 7 22l5-3 5 3-2-8.5" />
      </>
    ),
    hash: (
      <>
        <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
      </>
    ),
    replay: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
        <path d="M12 7v5l3 3" />
      </>
    ),
    pulse: <path d="M3 12h4l2-7 4 14 2-7h6" />,
    lock: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </>
    ),
    check: <path d="M20 6 9 17l-5-5" />,
    arrowRight: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    spark: (
      <>
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
      </>
    ),
    zap: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
    eye: (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    fingerprint: (
      <>
        <path d="M2 12C2 6.5 6.5 2 12 2s10 4.5 10 10" />
        <path d="M5 12a7 7 0 0 1 14 0" />
        <path d="M8 12a4 4 0 0 1 8 0" />
        <path d="M12 10v2" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </>
    ),
    activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
    server: (
      <>
        <rect x="2" y="2" width="20" height="8" rx="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" />
        <path d="M6 6h.01M6 18h.01" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </>
    ),
    barChart: (
      <>
        <path d="M3 3v18h18" />
        <path d="M7 16h2M11 11h2M15 8h2M19 13h2" />
      </>
    ),
    download: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="m7 10 5 5 5-5" />
        <path d="M12 15V3" />
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
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

// ─── Reveal-on-scroll wrapper ──────────────────────────────────────────────────
// NOTE: only use this for content BELOW the fold. Anything inside the hero's
// first viewport should animate on mount instead (see ProductFlowRow), or it
// will sit invisible until the user scrolls to it.

function Reveal({
  children,
  delay = 0,
  className,
  y = 24,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduced = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      initial={reduced ? false : { opacity: 0, y }}
      animate={reduced ? undefined : inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.62, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────────────────

function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <img
        src={HERO_BG_ARROW_SRC}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover opacity-70"
        style={{
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 30%, black 45%, transparent 90%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 30%, black 45%, transparent 90%)",
        }}
      />
      <div
        className="absolute left-1/2 top-[24%] h-[420px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `radial-gradient(ellipse at center, ${withAlpha(colors.brand, "12")} 0%, transparent 68%)`,
          filter: "blur(70px)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-40"
        style={{
          background: `linear-gradient(180deg, transparent 0%, ${colors.surface[50]} 100%)`,
        }}
      />
    </div>
  );
}

/** Small floating widget — plain card, subtle idle float, no rotation. */
function HeroWidget({
  children,
  positionClass,
  delay,
}: {
  children: ReactNode;
  positionClass: string;
  delay: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={`absolute hidden lg:block ${positionClass}`}
      initial={{ opacity: 0, y: 14 }}
      animate={reduced ? { opacity: 1, y: 0 } : { opacity: 1, y: [0, -7, 0] }}
      transition={
        reduced
          ? { duration: 0.5, delay }
          : {
              opacity: { duration: 0.6, delay },
              y: {
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: delay + 0.6,
              },
            }
      }
      style={{
        background: colors.surface[50],
        border: `1px solid ${colors.surface[200]}`,
        borderRadius: 14,
        boxShadow: `0 18px 44px ${colors.shadow}`,
      }}
    >
      {children}
    </motion.div>
  );
}

function ToggleDot({ on }: { on: boolean }) {
  return (
    <div
      className="flex h-4 w-8 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200"
      style={{ background: on ? colors.brand : colors.surface[200] }}
    >
      <div
        className="h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: on ? "translateX(16px)" : "translateX(0px)" }}
      />
    </div>
  );
}

/** Left widget — contrasts final-text review with captured process evidence. */
function EvidenceSourceWidget() {
  return (
    <div className="flex w-[230px] flex-col gap-2.5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p
            className="text-[9px] font-bold uppercase tracking-wider"
            style={{ color: colors.text.muted }}
          >
            Final text only
          </p>
          <p
            className="text-[11.5px] font-semibold"
            style={{ color: colors.text.secondary }}
          >
            No writing-process context
          </p>
        </div>
        <ToggleDot on={false} />
      </div>
      <div
        className="h-px w-full"
        style={{ background: colors.surface[200] }}
      />
      <div className="flex items-center justify-between">
        <div>
          <p
            className="text-[9px] font-bold uppercase tracking-wider"
            style={{ color: colors.brand }}
          >
            TypeTrace session
          </p>
          <p
            className="text-[11.5px] font-semibold"
            style={{ color: colors.text.primary }}
          >
            Process evidence recorded
          </p>
        </div>
        <ToggleDot on={true} />
      </div>
    </div>
  );
}

/** Right widget — communicates certificate-record integrity without overclaiming. */
function SealBadgeWidget() {
  return (
    <div className="flex w-[180px] flex-col items-center gap-2.5 p-4 text-center">
      <p
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: colors.text.secondary }}
      >
        Tamper-evident record
      </p>
      <div
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{ background: brand.humanBg, color: brand.humanText }}
      >
        <Icon name="shieldCheck" size={20} strokeWidth={1.8} />
      </div>
    </div>
  );
}

/** Product-purpose line shown above the main hero heading. */
function HeroTrustRow() {
  return (
    <div className="mb-7 flex flex-col items-center gap-3 sm:flex-row">
      <div className="flex -space-x-2">
        {TRUST_AVATARS.map((src, i) => (
          <img
            key={i}
            src={src}
            alt="Trusted user"
            className="h-7 w-7 rounded-full border-2 object-cover"
            style={{ borderColor: colors.surface[50] }}
          />
        ))}
      </div>
      <span
        className="text-[13px] font-medium"
        style={{ color: colors.text.secondary }}
      >
        Build for students, teachers &amp; academic reviewers
      </span>
    </div>
  );
}

/** Small icon node used inside the flow connector. */
function FlowNode({ icon }: { icon: IconName }) {
  return (
    <div
      className="flex h-9 w-9 items-center justify-center rounded-lg border"
      style={{
        background: colors.surface[50],
        borderColor: colors.surface[200],
        color: colors.brand,
        boxShadow: `0 6px 16px -8px ${colors.shadow}`,
      }}
    >
      <Icon name={icon} size={16} strokeWidth={1.8} />
    </div>
  );
}

/** Animated connecting line with a pulse traveling toward the logo pill. */
function FlowLine({ reverse = false }: { reverse?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <div
      className="relative hidden h-px w-10 shrink-0 sm:block md:w-14"
      style={{ background: colors.surface[200] }}
    >
      {!reduced && (
        <motion.div
          className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
          style={{ background: colors.brand }}
          animate={{ left: reverse ? ["100%", "0%"] : ["0%", "100%"] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
        />
      )}
    </div>
  );
}

function TypingDots() {
  const reduced = useReducedMotion();

  return (
    <div className="mt-1.5 flex h-2 items-center justify-center gap-0.5">
      {[0, 1, 2].map((dot) => (
        <motion.span
          key={dot}
          className="h-1 w-1 rounded-full"
          style={{ background: colors.brand }}
          animate={
            reduced ? undefined : { opacity: [0.35, 1, 0.35], y: [0, -2, 0] }
          }
          transition={
            reduced
              ? undefined
              : {
                  duration: 0.85,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: dot * 0.14,
                }
          }
        />
      ))}
    </div>
  );
}

/** Left card content — student images with live typing indicators */
function WritingSessionsCardBody() {
  return (
    <div className="w-[250px] p-3.5">
      <p
        className="mb-3 text-[10px] font-bold uppercase tracking-widest"
        style={{ color: colors.text.secondary }}
      >
        Illustrative writing sessions
      </p>
      <div className="grid grid-cols-3 place-items-center gap-2">
        {STUDENT_AVATARS.map((src, i) => (
          <div key={i} className="flex flex-col items-center">
            <img
              src={src}
              alt="Student"
              className="h-9 w-9 rounded-full object-cover"
            />
            <TypingDots />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Right card content */
function CertifiedSessionsCardBody() {
  const rows = [
    {
      name: "Example session A",
      pct: 96,
      label: "Human-supporting",
      avatar: STUDENT_AVATARS[0],
      color: brand.humanText,
      bg: brand.humanBg,
    },
    {
      name: "Example session B",
      pct: 64,
      label: "Review Required",
      avatar: STUDENT_AVATARS[1],
      color: brand.suspiciousText,
      bg: brand.suspiciousBg,
    },
    {
      name: "Example session C",
      pct: 18,
      label: "High risk",
      avatar: STUDENT_AVATARS[2],
      color: colors.red,
      bg: withAlpha(colors.red, "12"),
    },
  ];

  return (
    <div className="w-[250px] p-3.5">
      <p
        className="mb-3 text-[10px] font-bold uppercase tracking-widest"
        style={{ color: colors.text.secondary }}
      >
        Illustrative evidence results
      </p>
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center gap-2.5">
            <img
              src={row.avatar}
              alt={row.name}
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p
                  className="truncate text-[11.5px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  {row.name}
                </p>
                <span
                  className="shrink-0 text-[10px] font-bold"
                  style={{ color: row.color }}
                >
                  {row.pct}%
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
                style={{ background: colors.surface[200] }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${row.pct}%`, background: row.color }}
                />
              </div>
              <div
                className="mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.04em]"
                style={{ background: row.bg, color: row.color }}
              >
                {row.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The center product-flow composition — two content cards flanking a
 * connector that feeds into the TypeTrace logo pill.
 *
 * IMPORTANT: this sits in the hero's first viewport, so it animates on
 * MOUNT (plain motion.div with initial/animate), not on scroll-into-view.
 * Using the `Reveal` (useInView) wrapper here was why it previously stayed
 * invisible until the user scrolled.
 */
function ProductFlowRow() {
  const reduced = useReducedMotion();
  const cardStyle: CSSProperties = {
    background: colors.surface[50],
    border: `1px solid ${colors.surface[200]}`,
    borderRadius: 16,
    boxShadow: `0 18px 44px -20px ${colors.shadow}`,
  };

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.62,
        delay: reduced ? 0 : 0.4,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="relative z-20 mx-auto mt-14 flex w-full max-w-[900px] flex-col items-center gap-5 px-4 sm:flex-row sm:justify-center sm:gap-0"
    >
      <div style={cardStyle}>
        <WritingSessionsCardBody />
      </div>

      <div className="flex items-center gap-3 px-3 py-4 sm:py-0">
        <div className="flex flex-col gap-3">
          <FlowNode icon="keyboard" />
          <FlowNode icon="pulse" />
        </div>
        <FlowLine />
        <div
          className="flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-[12.5px] font-bold shadow-sm"
          style={{ background: colors.brand, color: colors.text.light }}
        >
          <Icon name="shieldCheck" size={14} />
          TypeTrace
        </div>
        <FlowLine />
        <div className="flex flex-col gap-3">
          <FlowNode icon="hash" />
          <FlowNode icon="certificate" />
        </div>
      </div>

      <div style={cardStyle}>
        <CertifiedSessionsCardBody />
      </div>
    </motion.div>
  );
}

function HeroSection() {
  const reduced = useReducedMotion();
  const delay = (n: number) => (reduced ? 0 : n);

  return (
    <section className="relative flex min-h-[calc(100dvh-60px)] flex-col items-center overflow-hidden px-4 pb-16 pt-[92px] text-center sm:px-6 sm:pb-24 sm:pt-[100px]">
      <HeroBackground />

      <HeroWidget
        positionClass="left-[3%] top-[24%] xl:left-[7%]"
        delay={delay(0.7)}
      >
        <EvidenceSourceWidget />
      </HeroWidget>
      <HeroWidget
        positionClass="right-[3%] top-[10%] xl:right-[8%]"
        delay={delay(0.85)}
      >
        <SealBadgeWidget />
      </HeroWidget>

      <div className="relative z-10 flex w-full max-w-[880px] flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: delay(0.05) }}
        >
          <HeroTrustRow />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.68,
            delay: delay(0.14),
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mb-5 max-w-[820px] text-[2.25rem] font-bold leading-[1.08] tracking-[-0.04em] min-[380px]:text-[2.55rem] sm:mb-6 sm:text-[4rem] sm:leading-[1.05]"
        >
          <span style={{ color: colors.text.primary }}>Capture the </span>
          <span style={{ color: colors.brand }}>Writing</span>
          <br />
          <span style={{ color: colors.brand }}>Process </span>
          <span style={{ color: colors.text.primary }}>
            Behind Every Draft.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: delay(0.24) }}
          className="mb-9 max-w-[560px] text-[16.5px] leading-[1.7]"
          style={{ color: colors.text.secondary }}
        >
          TypeTrace records keystroke timing, pauses, revisions, and paste
          activity during a writing session, then produces a tamper-evident
          certificate for student and teacher review.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: delay(0.32) }}
          className="mb-4 flex flex-col items-center gap-3 sm:flex-row"
        >
          <PrimaryLink to={ROUTES.REGISTER}>
            Start a writing session
          </PrimaryLink>
          <SecondaryLink to={ROUTES.HOW_IT_WORKS}>
            See how it works
          </SecondaryLink>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: delay(0.42) }}
          className="text-[12.5px]"
          style={{ color: colors.text.muted }}
        >
          Student and teacher accounts available · No credit card required
        </motion.p>
      </div>

      <ProductFlowRow />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRUST STRIP
// ─────────────────────────────────────────────────────────────────────────────

function TrustStrip() {
  const items = [
    "Capture the writing process",
    "Analyze behavioral evidence",
    "Review course submissions",
    "Verify certificates",
  ];

  return (
    <section
      className="border-y px-6 py-8 md:px-12"
      style={{
        background: colors.surface[50],
        borderColor: colors.surface[200],
      }}
    >
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-center gap-x-12 gap-y-4">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ color: colors.text.muted }}
        >
          Core workflow
        </span>
        {items.map((name) => (
          <span
            key={name}
            className="text-[14px] font-semibold"
            style={{ color: colors.text.secondary }}
          >
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WHY CHOOSE US
// ─────────────────────────────────────────────────────────────────────────────

const WHY_CHOOSE_FEATURES = [
  {
    icon: "keyboard" as const,
    title: "Process evidence captured in context",
    body: "TypeTrace records timing, pauses, revisions, deletions, and paste activity while the writing session develops.",
  },
  {
    icon: "shieldCheck" as const,
    title: "Tamper-evident certificate records",
    body: "Document and evidence hashes make later changes detectable, while the signed certificate preserves the recorded result.",
  },
  {
    icon: "teacher" as const,
    title: "Human review remains in control",
    body: "Behavioral signals support a teacher's review; they do not make an automatic misconduct decision.",
  },
  {
    icon: "lock" as const,
    title: "Public verification limits exposure",
    body: "Certificate lookup confirms a public record without publishing the full essay or raw keystroke stream.",
  },
];

function WhyChooseSection() {
  return (
    <section
      className="relative w-screen left-1/2 -translate-x-1/2 overflow-hidden py-16 md:py-20"
      style={{ background: colors.surface[50] }}
    >
      {/* Background image ... */}
      <img
        src={WHY_CHOOSE_BG_SRC}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-80"
        // maybe remove the w-[1400px] max-w-none and use full cover
        style={{
          maskImage:
            "linear-gradient(180deg, black 0%, black 55%, transparent 92%)",
          WebkitMaskImage:
            "linear-gradient(180deg, black 0%, black 55%, transparent 92%)",
        }}
      />

      {/* Inner content container with normal horizontal padding */}
      <div className="relative mx-auto max-w-[900px] px-6 text-center">
        <Reveal>
          <SectionEyebrow>Why TypeTrace</SectionEyebrow>
          <h2
            className="mx-auto mt-3 max-w-[720px] text-[2.1rem] font-bold leading-[1.18] tracking-[-0.03em] md:text-[2.75rem]"
            style={{ color: colors.text.primary }}
          >
            Academic review is stronger when the writing process is visible.
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-x-10 gap-y-10 text-left sm:grid-cols-2">
          {WHY_CHOOSE_FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={i * 0.06} className="flex gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                style={{ background: colors.brandSoft, color: colors.brand }}
              >
                <Icon name={feature.icon} size={20} strokeWidth={1.8} />
              </div>
              <div>
                <h3
                  className="text-[16px] font-bold"
                  style={{ color: colors.text.primary }}
                >
                  {feature.title}
                </h3>
                <p
                  className="mt-1.5 text-[14px] leading-relaxed"
                  style={{ color: colors.text.secondary }}
                >
                  {feature.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.3} className="mt-16">
          <Link
            to={ROUTES.HOW_IT_WORKS}
            className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[14px] font-bold transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
            style={{
              background: colors.brand,
              color: colors.text.light,
              boxShadow: `0 10px 30px ${withAlpha(colors.brand, "35")}`,
            }}
          >
            See how it works
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHOWCASE
// ─────────────────────────────────────────────────────────────────────────────

function ShowcasePanel({ src, alt }: { src: string; alt: string }) {
  return (
    <PublicCard className="overflow-hidden rounded-2xl">
      <img
        src={src}
        alt={alt}
        className="block h-full w-full object-cover"
        loading="lazy"
      />
    </PublicCard>
  );
}

const SHOWCASE_STEPS = [
  {
    number: "01",
    eyebrow: "Capture",
    title: "Capture writing-process evidence as the session develops.",
    body: "The editor records timing, pauses, revisions, deletions, and paste activity while the student writes. Idle time is separated from active writing time.",
    image: IMAGE_PATHS.capture,
    alt: "Student typing on a laptop during a focused writing session",
  },
  {
    number: "02",
    eyebrow: "Analyze",
    title: "Combine timing-model output with transparent behavioral rules.",
    body: "The timing anomaly model and behavioral rule layer produce a bounded human-support score and review signals. The result supports review; it does not decide misconduct.",
    image: IMAGE_PATHS.analysis,
    alt: "Educator reviewing a writing evidence report on a desktop monitor",
  },
  {
    number: "03",
    eyebrow: "Certify",
    title: "Generate a signed, tamper-evident certificate.",
    body: "The certificate links document integrity, evidence integrity, model version, and the recorded result to a public verification record without exposing the essay or raw keystroke stream.",
    image: IMAGE_PATHS.certificate,
    alt: "Hand holding a printed TypeTrace evidence certificate",
  },
];

function ShowcaseSection() {
  return (
    <PublicSection className="py-20 md:py-28">
      <div className="mx-auto max-w-[1200px]">
        <Reveal className="mx-auto mb-16 max-w-2xl text-center">
          <SectionEyebrow>How it works</SectionEyebrow>
          <SectionHeading
            title="From writing session to reviewable certificate, in one evidence trail."
            align="center"
          />
        </Reveal>
        <div className="grid gap-16">
          {SHOWCASE_STEPS.map((step, index) => {
            const flip = index % 2 === 1;
            return (
              <Reveal key={step.number}>
                <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
                  <div className={flip ? "md:order-2" : ""}>
                    <span
                      className="font-mono text-[13px] font-bold"
                      style={{ color: colors.brand }}
                    >
                      {step.number}
                    </span>
                    <p
                      className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em]"
                      style={{ color: colors.text.muted }}
                    >
                      {step.eyebrow}
                    </p>
                    <h3
                      className="mt-3 text-[1.9rem] font-bold leading-[1.1] tracking-[-0.025em] md:text-[2.3rem]"
                      style={{ color: colors.text.primary }}
                    >
                      {step.title}
                    </h3>
                    <p
                      className="mt-4 text-[15.5px] leading-relaxed"
                      style={{ color: colors.text.secondary }}
                    >
                      {step.body}
                    </p>
                  </div>
                  <div className={flip ? "md:order-1" : ""}>
                    <ShowcasePanel src={step.image} alt={step.alt} />
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </PublicSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RADIAL CAPABILITY MAP
// ─────────────────────────────────────────────────────────────────────────────

interface RadialNode {
  label: string;
  icon: IconName;
  angle: number;
}

const RADIAL_NODES: ReadonlyArray<RadialNode> = [
  { label: "Pause analysis", icon: "pulse", angle: -38.6 },
  { label: "Event replay", icon: "replay", angle: 12.8 },
  { label: "Timing-model score", icon: "model", angle: 64.2 },
  { label: "Evidence hashing", icon: "hash", angle: 115.6 },
  { label: "Certificate record", icon: "certificate", angle: 167 },
  { label: "Teacher review", icon: "teacher", angle: 218.4 },
  { label: "Public verification", icon: "search", angle: 269.8 },
];

function RadialCapabilityMap() {
  const size = 560;
  const center = size / 2;
  const outerR = 230;

  return (
    <div className="relative mx-auto flex w-full max-w-[560px] items-center justify-center">
      <svg
        width="100%"
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        <circle
          cx={center}
          cy={center}
          r={outerR}
          fill="none"
          stroke={colors.surface[200]}
          strokeWidth="1"
          strokeDasharray="2 6"
        />
        <circle
          cx={center}
          cy={center}
          r={outerR * 0.6}
          fill="none"
          stroke={colors.surface[200]}
          strokeWidth="1"
          strokeDasharray="2 6"
        />
        {RADIAL_NODES.map((node, i) => {
          const rad = (node.angle * Math.PI) / 180;
          const x2 = center + outerR * Math.cos(rad);
          const y2 = center + outerR * Math.sin(rad);
          return (
            <line
              key={`spoke-${i}`}
              x1={center}
              y1={center}
              x2={x2}
              y2={y2}
              stroke={colors.surface[200]}
              strokeWidth="1"
            />
          );
        })}
        <circle
          cx={center}
          cy={center}
          r={68}
          fill={colors.surface[50]}
          stroke={colors.brand}
          strokeWidth="1.5"
        />
      </svg>
      <div
        className="absolute flex flex-col items-center justify-center"
        style={{ width: 90, height: 90 }}
      >
        <img
          src="/QR-Logo.png"
          alt="TypeTrace"
          className="h-full w-full object-contain p-4"
        />
      </div>
      {RADIAL_NODES.map((node) => {
        const rad = (node.angle * Math.PI) / 180;
        const xPct = 50 + (outerR / size) * 100 * Math.cos(rad);
        const yPct = 50 + (outerR / size) * 100 * Math.sin(rad);
        return (
          <div
            key={node.label}
            className="absolute flex flex-col items-center gap-2"
            style={{
              left: `${xPct}%`,
              top: `${yPct}%`,
              transform: "translate(-50%, -50%)",
              width: 108,
            }}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl border"
              style={{
                background: colors.surface[50],
                borderColor: colors.surface[200],
                color: colors.brand,
                boxShadow: `0 8px 20px -10px ${colors.shadow}`,
              }}
            >
              <Icon name={node.icon} size={19} strokeWidth={1.8} />
            </div>
            <span
              className="text-center text-[11.5px] font-semibold leading-tight"
              style={{ color: colors.text.secondary }}
            >
              {node.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CapabilityMapSection() {
  return (
    <PublicSection
      className="border-y py-20 md:py-28"
      style={{ borderColor: colors.surface[200] }}
    >
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-16 lg:grid-cols-[1fr_1.05fr]">
        <Reveal>
          <RadialCapabilityMap />
        </Reveal>
        <Reveal delay={0.08}>
          <SectionEyebrow>One workspace</SectionEyebrow>
          <SectionHeading title="One writing session, seven connected evidence functions." />
          <p
            className="mt-4 text-[16px] leading-relaxed"
            style={{ color: colors.text.secondary }}
          >
            Captured timing, revision, pause, paste, and integrity signals feed
            one session record. Each function supports a different stage of
            academic review without claiming absolute proof.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <PrimaryLink to={ROUTES.REGISTER}>
              Start a writing session
            </PrimaryLink>
          </div>
        </Reveal>
      </div>
    </PublicSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DIFFERENTIATOR - Comparison table + live preview
// ─────────────────────────────────────────────────────────────────────────────

const COMPETITOR_DATA = [
  {
    feature: "Writing-process capture",
    typeTrace: true,
    aiDetectors: false,
    proctoring: "Varies",
    detail:
      "Records captured timing, pause, revision, deletion, and paste events during the writing session.",
  },
  {
    feature: "Behavioral timing evidence",
    typeTrace: true,
    aiDetectors: false,
    proctoring: "Limited",
    detail:
      "Evaluates how the session developed rather than relying on linguistic style alone.",
  },
  {
    feature: "Replayable event trail",
    typeTrace: true,
    aiDetectors: false,
    proctoring: "Varies",
    detail:
      "Presents the captured session timeline with pause, paste, deletion, and revision markers.",
  },
  {
    feature: "Privacy-aware public lookup",
    typeTrace: true,
    aiDetectors: false,
    proctoring: false,
    detail:
      "Public verification excludes the full essay and raw keystroke evidence.",
  },
  {
    feature: "Tamper-evident evidence record",
    typeTrace: true,
    aiDetectors: false,
    proctoring: "Varies",
    detail:
      "Uses document and evidence hashes together with a signed certificate payload.",
  },
  {
    feature: "Course-linked teacher review",
    typeTrace: true,
    aiDetectors: "Varies",
    proctoring: "Varies",
    detail:
      "Connects enrolled student submissions to course ownership, replay evidence, notes, and review status.",
  },
];

function ComparisonRow({
  feature,
  typeTrace,
  aiDetectors,
  proctoring,
  detail,
  index,
}: {
  feature: string;
  typeTrace: boolean | string;
  aiDetectors: boolean | string;
  proctoring: boolean | string;
  detail: string;
  index: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const reduced = useReducedMotion();

  const renderCell = (
    value: boolean | string,
    isTypeTrace: boolean = false,
  ) => {
    if (value === true) {
      return (
        <motion.div
          initial={false}
          animate={{ scale: isHovered && isTypeTrace ? 1.15 : 1 }}
          className="mx-auto flex h-6 w-6 items-center justify-center rounded-full"
          style={{
            background: isTypeTrace
              ? withAlpha(colors.brand, "12")
              : withAlpha(colors.green, "12"),
            color: isTypeTrace ? colors.brand : colors.green,
          }}
        >
          <Icon name="check" size={13} strokeWidth={3} />
        </motion.div>
      );
    }
    if (value === false) {
      return (
        <div
          className="mx-auto flex h-6 w-6 items-center justify-center rounded-full"
          style={{ background: withAlpha(colors.surface[300], "15") }}
        >
          <span
            style={{
              color: colors.text.muted,
              fontSize: "12px",
              lineHeight: 1,
            }}
          >
            -
          </span>
        </div>
      );
    }
    return (
      <span
        className="text-[11px] font-medium"
        style={{ color: colors.text.muted }}
      >
        {value}
      </span>
    );
  };

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, x: -8 }}
      whileInView={reduced ? undefined : { opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group flex flex-col items-stretch gap-3 border-b px-4 py-4 transition-colors duration-150 sm:ml-5 sm:flex-row sm:items-center sm:gap-0 sm:px-0 sm:py-3"
      style={{ borderColor: colors.surface[200] }}
    >
      <div className="min-w-0 flex-1 sm:pr-4">
        <p
          className="text-[13px] font-semibold"
          style={{ color: colors.text.primary }}
        >
          {feature}
        </p>
        <motion.p
          initial={false}
          animate={{
            height: "auto",
            opacity: 1,
            marginTop: 4,
          }}
          className="overflow-hidden text-[11px] leading-relaxed"
          style={{ color: colors.text.secondary }}
        >
          {detail}
        </motion.p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:hidden">
        {[
          ["TypeTrace", typeTrace, true],
          ["Text detector", aiDetectors, false],
          ["Proctoring", proctoring, false],
        ].map(([label, value, isTypeTraceValue]) => (
          <div
            key={String(label)}
            className="rounded-md border px-2 py-2 text-center"
            style={{ borderColor: colors.surface[200] }}
          >
            <p
              className="mb-2 text-[9px] font-bold uppercase tracking-[0.08em]"
              style={{ color: colors.text.muted }}
            >
              {String(label)}
            </p>
            {renderCell(value as boolean | string, Boolean(isTypeTraceValue))}
          </div>
        ))}
      </div>

      <div className="hidden w-[300px] shrink-0 items-center justify-around sm:flex">
        <div className="w-16 text-center">
          <motion.div
            animate={{
              background: isHovered
                ? withAlpha(colors.brand, "06")
                : "transparent",
            }}
            className="rounded-md py-1"
          >
            {renderCell(typeTrace, true)}
          </motion.div>
        </div>
        <div className="w-16 text-center">{renderCell(aiDetectors)}</div>
        <div className="w-16 text-center">{renderCell(proctoring)}</div>
      </div>
    </motion.div>
  );
}

function LiveWritingPreview() {
  const text =
    "A writing-process record gives reviewers context that final text alone cannot provide.";
  const events = [
    { time: "00:01", action: "Session started", type: "system" },
    { time: "00:03", action: "Keystroke rhythm captured", type: "keystroke" },
    { time: "00:07", action: "Pause detected (2.3s)", type: "pause" },
    { time: "00:12", action: "Text revised", type: "revision" },
    { time: "00:18", action: "Paste event recorded", type: "security" },
    { time: "00:24", action: "Evidence hash generated", type: "system" },
  ];

  return (
    <PublicCard className="overflow-hidden">
      <div
        className="border-b px-4 py-2.5"
        style={{ borderColor: colors.surface[200] }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div
                className="h-2 w-2 rounded-full"
                style={{ background: colors.red }}
              />
              <div
                className="h-2 w-2 rounded-full"
                style={{ background: colors.amber }}
              />
              <div
                className="h-2 w-2 rounded-full"
                style={{ background: colors.green }}
              />
            </div>
            <span
              className="ml-1 text-[10px] font-medium"
              style={{ color: colors.text.muted }}
            >
              Session #TT-8Q4Z2
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="flex h-1.5 w-1.5 rounded-full"
              style={{ background: colors.green }}
            />
            <span
              className="text-[9px] font-bold uppercase tracking-wider"
              style={{ color: brand.humanText }}
            >
              Live
            </span>
          </div>
        </div>
      </div>
      <div
        className="grid grid-cols-[1fr_180px] divide-x"
        style={{ borderColor: colors.surface[200] }}
      >
        <div className="p-4">
          <div
            className="font-mono text-[12px] leading-relaxed"
            style={{ color: colors.text.primary }}
          >
            {text.split("").map((char, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.015 }}
              >
                {char}
              </motion.span>
            ))}
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="ml-0.5 inline-block h-3.5 w-0.5"
              style={{ background: colors.brand }}
            />
          </div>
        </div>
        <div className="p-3" style={{ background: colors.surface[100] }}>
          <p
            className="mb-2 text-[9px] font-bold uppercase tracking-wider"
            style={{ color: colors.text.muted }}
          >
            Event Log
          </p>
          <div className="space-y-1">
            {events.map((event, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-start gap-1.5 rounded px-1.5 py-1"
                style={{
                  background:
                    event.type === "security"
                      ? withAlpha(brand.suspiciousBg, "40")
                      : event.type === "system"
                        ? withAlpha(colors.brand, "05")
                        : "transparent",
                }}
              >
                <span
                  className="mt-0.5 text-[8px] font-mono shrink-0"
                  style={{ color: colors.text.muted }}
                >
                  {event.time}
                </span>
                <span
                  className="text-[9px] font-medium leading-tight"
                  style={{ color: colors.text.secondary }}
                >
                  {event.action}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </PublicCard>
  );
}

function StatCard({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon: IconName;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-xl border p-4 transition-shadow duration-200 hover:shadow-md"
      style={{
        borderColor: colors.surface[200],
        background: colors.surface[50],
      }}
    >
      <div
        className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ background: colors.brandSoft, color: colors.brand }}
      >
        <Icon name={icon} size={16} strokeWidth={1.8} />
      </div>
      <p
        className="text-xl font-bold tracking-tight"
        style={{ color: colors.text.primary }}
      >
        {value}
      </p>
      <p
        className="mt-0.5 text-[11px] font-medium"
        style={{ color: colors.text.secondary }}
      >
        {label}
      </p>
    </motion.div>
  );
}

function DifferentiatorSection() {
  return (
    <section
      className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20 md:px-12 md:py-28"
      style={{ background: colors.surface[100] }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(${colors.text.primary} 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative mx-auto max-w-[1200px]">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <SectionEyebrow>Why TypeTrace</SectionEyebrow>
          <SectionHeading
            title="A different source of evidence for academic review."
            description="TypeTrace focuses on captured writing behavior. It complements, rather than replaces, academic judgement, institutional procedure, and other review evidence."
            align="center"
          />
        </Reveal>

        <Reveal className="mb-12 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <StatCard value="43" label="Timing-model features" icon="model" />
          <StatCard value="2" label="Evidence layers" icon="activity" />
          <StatCard
            value="Signed"
            label="SHA-256 + Ed25519"
            icon="fingerprint"
          />
          <StatCard value="3" label="Decision bands" icon="barChart" />
        </Reveal>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-14">
          <Reveal>
            <div>
              <p
                className="mb-3 text-[12px] font-bold uppercase tracking-wider"
                style={{ color: colors.text.secondary }}
              >
                See it in action
              </p>
              <LiveWritingPreview />
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div>
              <p
                className="mb-3 text-[12px] font-bold uppercase tracking-wider"
                style={{ color: colors.text.secondary }}
              >
                How we compare
              </p>
              <PublicCard className="overflow-hidden">
                <div
                  className="hidden border-b py-2.5 sm:ml-5 sm:flex sm:items-center"
                  style={{ borderColor: colors.surface[200] }}
                >
                  <div className="flex-1">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: colors.text.muted }}
                    >
                      Capability
                    </span>
                  </div>
                  <div className="flex w-[300px] shrink-0 items-center justify-around">
                    <span
                      className="w-16 text-center text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: colors.brand }}
                    >
                      TypeTrace
                    </span>
                    <span
                      className="w-16 text-center text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: colors.text.muted }}
                    >
                      Final-text detector
                    </span>
                    <span
                      className="w-16 text-center text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: colors.text.muted }}
                    >
                      Remote proctoring
                    </span>
                  </div>
                </div>
                <div className="py-1">
                  {COMPETITOR_DATA.map((row, index) => (
                    <ComparisonRow key={row.feature} {...row} index={index} />
                  ))}
                </div>
                <div
                  className="border-t p-4 text-center"
                  style={{
                    borderColor: colors.surface[200],
                    background: withAlpha(colors.brand, "02"),
                  }}
                >
                  <Link
                    to={ROUTES.REGISTER}
                    className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-[13px] font-bold transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
                    style={{
                      background: colors.brand,
                      color: colors.text.light,
                      boxShadow: `0 4px 14px ${withAlpha(colors.brand, "30")}`,
                    }}
                  >
                    Start a writing session
                    <Icon name="arrowRight" size={13} strokeWidth={2.5} />
                  </Link>
                </div>
              </PublicCard>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.15} className="mt-12">
          <div className="flex flex-wrap items-center justify-center gap-6">
            {(
              [
                { icon: "shield", text: "Role-protected review" },
                { icon: "eye", text: "No video capture" },
                { icon: "lock", text: "Public lookup hides drafts" },
                { icon: "users", text: "Human decision remains required" },
              ] satisfies ReadonlyArray<{
                icon: IconName;
                text: string;
              }>
            ).map((badge) => (
              <div key={badge.text} className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ background: colors.brandSoft, color: colors.brand }}
                >
                  <Icon name={badge.icon} size={13} />
                </div>
                <span
                  className="text-[11px] font-medium"
                  style={{ color: colors.text.secondary }}
                >
                  {badge.text}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT / TEACHER ROLE CARDS
// ─────────────────────────────────────────────────────────────────────────────

function RoleCard({
  icon,
  title,
  body,
  points,
}: {
  icon: PublicIconName;
  title: string;
  body: string;
  points: string[];
}) {
  return (
    <PublicCard className="p-6">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: colors.brandSoft, color: colors.brand }}
      >
        <PublicIcon name={icon} size={18} />
      </div>
      <h3
        className="mt-4 text-[1.3rem] font-bold tracking-[-0.02em]"
        style={{ color: colors.text.primary }}
      >
        {title}
      </h3>
      <p
        className="mt-2 text-[14px] leading-relaxed"
        style={{ color: colors.text.secondary }}
      >
        {body}
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {points.map((point) => (
          <div
            key={point}
            className="flex items-start gap-2.5 text-[13px]"
            style={{ color: colors.text.secondary }}
          >
            <span
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded"
              style={{ background: brand.humanBg, color: brand.humanText }}
            >
              <Icon name="check" size={10} strokeWidth={2.8} />
            </span>
            {point}
          </div>
        ))}
      </div>
    </PublicCard>
  );
}

function StudentTeacherSection() {
  return (
    <PublicSection className="py-20 md:py-28">
      <div className="mx-auto max-w-[1200px]">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <SectionEyebrow>Two-sided workflow</SectionEyebrow>
          <SectionHeading
            title="Built for students who need a record and teachers who need context."
            align="center"
          />
        </Reveal>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Reveal>
            <RoleCard
              icon="keyboard"
              title="For students"
              body="Create a writing-process record as you work, then use it in a personal or course-linked review."
              points={[
                "Record timing, pause, revision, deletion, and paste events in the editor.",
                "Save drafts and resume without treating inactive time as writing time.",
                "Generate and share a verifiable session certificate.",
              ]}
            />
          </Reveal>
          <Reveal delay={0.08}>
            <RoleCard
              icon="teacher"
              title="For teachers"
              body="Review course-linked writing evidence instead of relying on a final-text score alone."
              points={[
                "Create courses and enrol students through controlled invite codes.",
                "Review submitted sessions with metrics, signals, and replay evidence.",
                "Record a review status and manage certificate revocation when required.",
              ]}
            />
          </Reveal>
        </div>
      </div>
    </PublicSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRUST SECTION - Horizontal tabs + visual evidence chain
// ─────────────────────────────────────────────────────────────────────────────

type TrustTabId = "process" | "privacy" | "review";

interface TrustTab {
  id: TrustTabId;
  label: string;
  icon: IconName;
  title: string;
  content: string;
  stat: string;
  statLabel: string;
}

const TRUST_TABS: ReadonlyArray<TrustTab> = [
  {
    id: "process",
    label: "Process evidence",
    icon: "activity",
    title: "Review how the session developed.",
    content:
      "TypeTrace records captured timing, pauses, revisions, deletions, paste activity, and rhythm variation so that a reviewer can inspect the writing process alongside the final document.",
    stat: "Session-level",
    statLabel: "Evidence record",
  },
  {
    id: "privacy",
    label: "Public verification",
    icon: "shieldCheck",
    title: "Verify a certificate without publishing the draft.",
    content:
      "Public verification returns certificate status, integrity metadata, and a review-safe result summary. It does not expose the full essay or raw keystroke evidence.",
    stat: "Public-safe",
    statLabel: "Verification view",
  },
  {
    id: "review",
    label: "Human review",
    icon: "users",
    title: "Keep the final decision with the reviewer.",
    content:
      "TypeTrace classifications and behavioral signals support academic review. They are not automatic findings of authorship or misconduct and must be interpreted with institutional procedure and student context.",
    stat: "Human-led",
    statLabel: "Decision process",
  },
];

function TrustSection() {
  const [activeTab, setActiveTab] = useState<TrustTabId>("process");
  const active =
    TRUST_TABS.find((tab) => tab.id === activeTab) ?? TRUST_TABS[0];
  const reduced = useReducedMotion();

  return (
    <section
      className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20 md:px-12 md:py-28"
      style={{ background: colors.text.primary }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(${withAlpha(colors.text.light, "80")} 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `radial-gradient(circle, ${withAlpha(colors.brand, "30")} 0%, transparent 60%)`,
          filter: "blur(80px)",
        }}
      />

      <div className="relative mx-auto max-w-[1100px]">
        <Reveal className="mb-10 text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 mb-5"
            style={{
              borderColor: withAlpha(colors.text.light, "20"),
              background: withAlpha(colors.text.light, "06"),
            }}
          >
            <Icon name="shieldCheck" size={13} />
            <span
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: withAlpha(colors.text.light, "B0") }}
            >
              Trust architecture
            </span>
          </div>
          <h2
            className="text-[2.2rem] font-bold leading-[1.1] tracking-[-0.04em] md:text-[3rem]"
            style={{ color: colors.text.light }}
          >
            Evidence designed for
            <br />
            careful academic review.
          </h2>
          <p
            className="mt-3 text-[15px] leading-relaxed max-w-lg mx-auto"
            style={{ color: withAlpha(colors.text.light, "80") }}
          >
            TypeTrace separates private session evidence from public certificate
            metadata and keeps final interpretation with the reviewer.
          </p>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="mb-8 flex min-w-0 justify-center">
            <div
              className="grid w-full min-w-0 max-w-[680px] grid-cols-1 gap-1 rounded-xl border p-1 sm:grid-cols-3"
              role="tablist"
              aria-label="Trust architecture"
              style={{
                borderColor: withAlpha(colors.text.light, "15"),
                background: withAlpha(colors.text.light, "05"),
              }}
            >
              {TRUST_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative flex w-full min-w-0 items-center justify-start gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold transition-all duration-200 sm:justify-center sm:px-4 sm:text-center"
                  style={{
                    color:
                      activeTab === tab.id
                        ? colors.brand
                        : withAlpha(colors.text.light, "70"),
                    background:
                      activeTab === tab.id ? colors.text.light : "transparent",
                    boxShadow:
                      activeTab === tab.id
                        ? `0 2px 8px ${withAlpha(colors.text.primary, "20")}`
                        : "none",
                  }}
                >
                  <Icon name={tab.icon} size={14} strokeWidth={2} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px] items-center">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{
                      background: withAlpha(colors.brand, "25"),
                      color: colors.brand,
                    }}
                  >
                    <Icon name={active.icon} size={18} strokeWidth={1.8} />
                  </div>
                  <h3
                    className="text-xl font-bold tracking-[-0.03em]"
                    style={{ color: colors.text.light }}
                  >
                    {active.title}
                  </h3>
                </div>
                <p
                  className="text-[15px] leading-relaxed"
                  style={{ color: withAlpha(colors.text.light, "85") }}
                >
                  {active.content}
                </p>
                <div className="mt-6">
                  <Link
                    to={ROUTES.REGISTER}
                    className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-[13px] font-bold transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
                    style={{
                      background: colors.brand,
                      color: colors.text.light,
                      boxShadow: `0 4px 16px ${withAlpha(colors.brand, "35")}`,
                    }}
                  >
                    Start a writing session
                    <Icon name="arrowRight" size={13} strokeWidth={2.5} />
                  </Link>
                </div>
              </div>

              <div
                className="rounded-2xl border p-6 text-center"
                style={{
                  borderColor: withAlpha(colors.text.light, "12"),
                  background: withAlpha(colors.text.light, "04"),
                }}
              >
                <p
                  className="text-[3.5rem] font-extrabold leading-none tracking-tight"
                  style={{ color: colors.text.light }}
                >
                  {active.stat}
                </p>
                <p
                  className="mt-2 text-[13px] font-medium"
                  style={{ color: withAlpha(colors.text.light, "70") }}
                >
                  {active.statLabel}
                </p>
                <div className="mt-4 flex justify-center gap-1.5">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-1.5 w-8 rounded-full"
                      style={{
                        background:
                          i === 1
                            ? colors.brand
                            : withAlpha(colors.text.light, "15"),
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
            {(
              [
                { icon: "lock", text: "Role-based access" },
                { icon: "fingerprint", text: "SHA-256 + Ed25519 integrity" },
                { icon: "users", text: "Reviewer-led decisions" },
              ] satisfies ReadonlyArray<{
                icon: IconName;
                text: string;
              }>
            ).map((item) => (
              <div key={item.text} className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{
                    background: withAlpha(colors.brand, "20"),
                    color: colors.brand,
                  }}
                >
                  <Icon name={item.icon} size={13} />
                </div>
                <span
                  className="text-[11px] font-medium"
                  style={{ color: withAlpha(colors.text.light, "70") }}
                >
                  {item.text}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FINAL CTA
// ─────────────────────────────────────────────────────────────────────────────

function FinalCtaSection() {
  return (
    <section
      className="relative overflow-hidden px-4 py-20 text-center sm:px-6 sm:py-28 md:py-36"
      style={{ background: colors.surface[50] }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${withAlpha(colors.brand, "08")} 0%, transparent 55%)`,
        }}
      />
      <div className="relative z-10 mx-auto flex max-w-[720px] flex-col items-center gap-5">
        <Reveal>
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
            style={{
              borderColor: colors.surface[200],
              background: colors.surface[50],
              color: colors.brand,
            }}
          >
            <Icon name="zap" size={13} />
            <span className="text-[11px] font-semibold">
              Student and teacher accounts available
            </span>
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <h2
            className="text-[2.6rem] font-bold leading-tight tracking-[-0.04em] md:text-[3.5rem]"
            style={{ color: colors.text.primary }}
          >
            Record the process before
            <br />
            the final document is reviewed.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p
            className="max-w-lg text-[16px] leading-relaxed"
            style={{ color: colors.text.secondary }}
          >
            Start a TypeTrace session to capture writing-process evidence,
            generate a certificate, and make the result available for careful
            academic review.
          </p>
        </Reveal>
        <Reveal delay={0.14}>
          <div className="mt-2 flex flex-col items-center gap-4">
            <Link
              to={ROUTES.REGISTER}
              className="flex items-center gap-2 rounded-lg px-8 py-3.5 text-[15px] font-bold transition-all hover:opacity-95 active:scale-[0.98]"
              style={{
                background: colors.brand,
                color: colors.text.light,
                boxShadow: `0 8px 32px ${withAlpha(colors.brand, "35")}`,
              }}
            >
              Create a free account
              <Icon name="arrowRight" size={15} strokeWidth={2.5} />
            </Link>
            <div className="flex items-center gap-4">
              <Link
                to={ROUTES.VERIFY_LOOKUP}
                className="flex items-center gap-1.5 text-[13px] font-medium transition hover:opacity-80"
                style={{ color: colors.text.secondary }}
              >
                <Icon name="search" size={13} />
                Verify a certificate
              </Link>
              <span style={{ color: colors.surface[300] }}>·</span>
              <span
                className="text-[12px]"
                style={{ color: colors.text.muted }}
              >
                No credit card required
              </span>
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.18}>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {[
              "Writing-process capture",
              "Teacher review workflow",
              "Public certificate verification",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ background: brand.humanBg, color: brand.humanText }}
                >
                  <Icon name="check" size={11} strokeWidth={2.8} />
                </span>
                <span
                  className="text-[12px] font-medium"
                  style={{ color: colors.text.secondary }}
                >
                  {item}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <PublicShell>
      <HeroSection />
      <TrustStrip />
      <WhyChooseSection />
      <ShowcaseSection />
      <CapabilityMapSection />
      <DifferentiatorSection />
      <StudentTeacherSection />
      <TrustSection />
      <FinalCtaSection />
    </PublicShell>
  );
}
