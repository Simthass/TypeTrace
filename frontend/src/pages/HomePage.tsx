// frontend/src/pages/HomePage.tsx

import { useRef, useState, type ReactNode } from "react";
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
} from "../components/public/PublicVisualSystem";

// ─── Image paths ──────────────────────────────────────────────────────────────
const DASHBOARD_PREVIEW_SRC = "/dashboard-mockup.png";
const IMAGE_PATHS = {
  capture: "/photo-capture-session.png",
  analysis: "/photo-analysis-review.png",
  certificate: "/photo-certificate-handoff.png",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

// ─── Icon primitives ──────────────────────────────────────────────────────────

function Icon({
  name,
  size = 16,
  strokeWidth = 2,
}: {
  name:
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
    | "download"
    | "copy"
    | "pause"
    | "play"
    | "sliders";
  size?: number;
  strokeWidth?: number;
}) {
  const paths: Record<string, ReactNode> = {
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
    copy: (
      <>
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
    pause: (
      <>
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
      </>
    ),
    play: <path d="M6 4l14 8-14 8z" />,
    sliders: (
      <>
        <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
        <circle cx="4" cy="14" r="2" />
        <circle cx="12" cy="10" r="2" />
        <circle cx="20" cy="16" r="2" />
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

// ─── Section eyebrow ──────────────────────────────────────────────────────────

function Eyebrow({
  children,
  dark = false,
}: {
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em]"
      style={{
        color: dark ? withAlpha(colors.text.light, "B0") : colors.brand,
      }}
    >
      <span
        className="h-1 w-1 rounded-full"
        style={{ background: dark ? colors.text.light : colors.brand }}
      />
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────────────────

function HeroGridBackground() {
  const cols = 12;
  const rows = 7;
  const colPositions = Array.from(
    { length: cols + 1 },
    (_, i) => `${(i / cols) * 100}%`,
  );
  const rowPositions = Array.from(
    { length: rows + 1 },
    (_, i) => `${(i / rows) * 100}%`,
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <svg
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="home-grid-fade-y" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.surface[50]} stopOpacity="0" />
            <stop offset="14%" stopColor={colors.surface[50]} stopOpacity="1" />
            <stop offset="74%" stopColor={colors.surface[50]} stopOpacity="1" />
            <stop
              offset="100%"
              stopColor={colors.surface[50]}
              stopOpacity="0"
            />
          </linearGradient>
          <radialGradient id="home-grid-center" cx="50%" cy="36%" r="54%">
            <stop offset="0%" stopColor={colors.surface[50]} stopOpacity="1" />
            <stop
              offset="100%"
              stopColor={colors.surface[50]}
              stopOpacity="0"
            />
          </radialGradient>
          <mask id="home-grid-mask">
            <rect width="100%" height="100%" fill="url(#home-grid-fade-y)" />
          </mask>
        </defs>
        <g mask="url(#home-grid-mask)" opacity="0.62">
          {colPositions.map((x, i) => (
            <line
              key={`c${i}`}
              x1={x}
              y1="0%"
              x2={x}
              y2="100%"
              stroke={colors.surface[200]}
              strokeWidth="1"
            />
          ))}
          {rowPositions.map((y, i) => (
            <line
              key={`r${i}`}
              x1="0%"
              y1={y}
              x2="100%"
              y2={y}
              stroke={colors.surface[200]}
              strokeWidth="1"
            />
          ))}
          {colPositions.map((x, ci) =>
            rowPositions.map((y, ri) => (
              <g key={`${ci}-${ri}`} transform={`translate(${x}, ${y})`}>
                <line
                  x1="-4"
                  y1="0"
                  x2="4"
                  y2="0"
                  stroke={colors.surface[200]}
                  strokeWidth="1"
                />
                <line
                  x1="0"
                  y1="-4"
                  x2="0"
                  y2="4"
                  stroke={colors.surface[200]}
                  strokeWidth="1"
                />
              </g>
            )),
          )}
        </g>
        <rect width="100%" height="100%" fill="url(#home-grid-center)" />
      </svg>
      <div
        className="absolute left-1/2 top-[28%] h-[480px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `radial-gradient(ellipse at center, ${withAlpha(colors.brand, "10")} 0%, transparent 68%)`,
          filter: "blur(72px)",
        }}
      />
    </div>
  );
}

function FloatingCard({
  children,
  positionClass,
  rotate,
  delay,
  floatAmp = 8,
}: {
  children: ReactNode;
  positionClass: string;
  rotate: number;
  delay: number;
  floatAmp?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={`absolute hidden lg:block ${positionClass}`}
      initial={{ opacity: 0, y: 14 }}
      animate={
        reduced
          ? { opacity: 1, y: 0, rotate }
          : { opacity: 1, y: [0, -floatAmp, 0], rotate }
      }
      transition={
        reduced
          ? { duration: 0.5, delay }
          : {
              opacity: { duration: 0.6, delay },
              y: {
                duration: 5.5 + delay * 0.5,
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
        boxShadow: `0 18px 48px ${colors.shadow}`,
      }}
    >
      {children}
    </motion.div>
  );
}

function StudentConcernCard() {
  return (
    <div className="flex w-[248px] flex-col gap-2.5 p-3.5">
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          style={{ background: brand.aiBg, color: brand.aiText }}
        >
          <Icon name="shield" size={14} />
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: colors.text.secondary }}
        >
          Student concern
        </span>
      </div>
      <p
        className="text-[12.5px] font-semibold leading-snug"
        style={{ color: colors.text.primary }}
      >
        "My essay was flagged even though I wrote every word myself."
      </p>
      <div
        className="flex items-center justify-between border-t pt-2"
        style={{ borderColor: colors.surface[200] }}
      >
        <span className="text-[10px]" style={{ color: colors.text.secondary }}>
          Academic integrity review
        </span>
        <span
          className="rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
          style={{ background: brand.aiBg, color: brand.aiText }}
        >
          Needs context
        </span>
      </div>
    </div>
  );
}

function TeacherReviewCard() {
  return (
    <div className="flex w-[236px] flex-col gap-2.5 p-3.5">
      <div className="flex items-center gap-2">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          style={{ background: colors.brandSoft, color: colors.brand }}
        >
          <Icon name="teacher" size={14} />
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: colors.text.secondary }}
        >
          Teacher review
        </span>
      </div>
      <p
        className="text-[12.5px] font-semibold leading-snug"
        style={{ color: colors.text.primary }}
      >
        "Can you show how this draft was actually written?"
      </p>
      <div
        className="flex items-center justify-between border-t pt-2"
        style={{ borderColor: colors.surface[200] }}
      >
        <span className="text-[10px]" style={{ color: colors.text.secondary }}>
          Review request
        </span>
        <span
          className="rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
          style={{
            background: brand.suspiciousBg,
            color: brand.suspiciousText,
          }}
        >
          Pending
        </span>
      </div>
    </div>
  );
}

function MiniDashboardFrame({
  className = "",
  muted = false,
  delay = 0,
}: {
  className?: string;
  muted?: boolean;
  delay?: number;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 24, scale: 0.98 }}
      animate={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.72, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`overflow-hidden rounded-md border bg-white ${className}`}
      style={{
        borderColor: muted
          ? withAlpha(colors.surface[200], "90")
          : colors.surface[200],
        boxShadow: muted
          ? `0 18px 56px ${withAlpha(colors.shadow, "60")}`
          : `0 28px 90px ${withAlpha(colors.shadowStrong, "45")}`,
      }}
      aria-hidden={muted}
    >
      <img
        src={DASHBOARD_PREVIEW_SRC}
        alt={muted ? "" : "TypeTrace dashboard preview"}
        className="block w-full select-none object-cover object-top"
        draggable={false}
        style={{
          maxHeight: muted ? 540 : 660,
          opacity: muted ? 0.72 : 1,
          filter: muted ? "saturate(0.82) contrast(0.96)" : undefined,
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-16"
        style={{
          background: `linear-gradient(180deg, ${withAlpha(colors.surface[50], "70")} 0%, transparent 100%)`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-md"
        style={{
          boxShadow: `inset 0 1px 0 ${withAlpha(colors.text.light, "E6")}, inset 0 -1px 0 ${withAlpha(colors.surface[200], "A0")}`,
        }}
      />
    </motion.div>
  );
}

function HeroDashboardPreview() {
  const reduced = useReducedMotion();

  return (
    <div className="relative z-20 mx-auto w-full max-w-[1380px] px-4 pb-8 pt-2 sm:px-6">
      <div
        className="pointer-events-none absolute left-1/2 top-[18%] h-[360px] w-[76%] -translate-x-1/2 rounded-full"
        style={{
          background: `radial-gradient(ellipse at center, ${withAlpha(colors.brand, "18")} 0%, transparent 68%)`,
          filter: "blur(88px)",
          opacity: 0.82,
        }}
      />

      <div className="relative mx-auto h-[430px] max-w-[1180px] sm:h-[560px] lg:h-[690px]">
        {" "}
        {/*
          Three real dashboard image frames, stacked vertically like the
          reference: the front image stays closest to the hero copy, the second
          sits slightly higher behind it, and the third sits higher again.
        */}
        <MiniDashboardFrame
          muted
          delay={0.18}
          className="absolute inset-x-0 top-0 z-0 mx-auto w-[86%] max-w-[1040px]"
        />
        <MiniDashboardFrame
          muted
          delay={0.28}
          className="absolute inset-x-0 top-8 z-10 mx-auto w-[93%] max-w-[1110px]"
        />
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 42, scale: 0.98 }}
          animate={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.86, delay: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-x-0 top-16 z-20 mx-auto w-full max-w-[1180px]"
        >
          <MiniDashboardFrame />
        </motion.div>
        <div
          className="pointer-events-none absolute inset-x-[-6%] bottom-[-70px] z-40 h-[340px]"
          style={{
            background: `linear-gradient(180deg, transparent 0%, ${withAlpha(colors.surface[50], "D8")} 38%, ${colors.surface[50]} 100%)`,
          }}
        />
        <div
          className="pointer-events-none absolute bottom-12 left-1/2 z-30 h-20 w-[74%] -translate-x-1/2 rounded-full"
          style={{
            background: withAlpha(colors.text.primary, "16"),
            filter: "blur(38px)",
          }}
        />
      </div>
    </div>
  );
}

function HeroSection() {
  const reduced = useReducedMotion();
  const delay = (n: number) => (reduced ? 0 : n);

  return (
    <section className="relative flex min-h-screen flex-col items-center overflow-hidden px-6 pb-28 pt-[min(10vh,96px)] text-center">
      <HeroGridBackground />
      <FloatingCard
        positionClass="left-[1%] top-[15%] xl:left-[5%] xl:top-[19%]"
        rotate={-4}
        delay={delay(0.7)}
        floatAmp={9}
      >
        <StudentConcernCard />
      </FloatingCard>
      <FloatingCard
        positionClass="right-[1%] top-[13%] xl:right-[5%] xl:top-[17%]"
        rotate={3.5}
        delay={delay(0.85)}
        floatAmp={11}
      >
        <TeacherReviewCard />
      </FloatingCard>
      <div className="relative z-10 flex w-full max-w-[920px] flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.58,
            delay: delay(0.05),
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.12em]"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[50],
            color: colors.brand,
          }}
        >
          <PublicIcon name="shield" size={14} />
          Behavioral authorship evidence
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.68,
            delay: delay(0.14),
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mb-7 max-w-[940px] text-[3.55rem] font-bold leading-[0.95] tracking-[-0.065em] sm:text-[5rem] lg:text-[5.8rem]"
        >
          <span style={{ color: colors.text.primary }}>
            Authorship evidence,
          </span>
          <br />
          <span style={{ color: colors.brand }}>built as you write.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.62, delay: delay(0.24) }}
          className="mb-11 max-w-[620px] text-[17px] leading-[1.75]"
          style={{ color: colors.text.secondary }}
        >
          TypeTrace captures keystroke dynamics, pauses, revisions, and timing
          signals to create reviewable writing evidence before academic work is
          questioned.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.58, delay: delay(0.32) }}
          className="mb-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <PrimaryLink to={ROUTES.REGISTER}>
            Start a writing session
          </PrimaryLink>
          <SecondaryLink to={ROUTES.VERIFY_LOOKUP}>
            <PublicIcon name="search" size={15} />
            Verify a certificate
          </SecondaryLink>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: delay(0.48) }}
          className="flex flex-wrap justify-center gap-x-6 gap-y-2"
        >
          {[
            "No setup required",
            "Works inside any browser editor",
            "Results in under a minute",
          ].map((t) => (
            <span
              key={t}
              className="flex items-center gap-1.5 text-[12.5px]"
              style={{ color: colors.text.secondary }}
            >
              <Icon name="check" size={13} strokeWidth={2.6} />
              {t}
            </span>
          ))}
        </motion.div>
      </div>
      <div className="relative z-10 mt-16 w-full">
        <HeroDashboardPreview />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRUST STRIP
// ─────────────────────────────────────────────────────────────────────────────

function TrustStrip() {
  const items = [
    "University of Bedfordshire",
    "Academic Integrity Office",
    "Student Council",
    "Writing Center",
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
          Piloted with
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
    title: "Writing behavior captured the moment you start typing.",
    body: "No plugins, no extra setup. The moment a student opens a session, TypeTrace begins recording rhythm, pauses, and revisions in the background.",
    image: IMAGE_PATHS.capture,
    alt: "Student typing on a laptop during a focused writing session",
  },
  {
    number: "02",
    eyebrow: "Analyze",
    title: "Behavioral signals reviewed by a transparent model.",
    body: "Every session is scored against real writing-behavior patterns, not text style. Reviewers see the evidence, not a black-box verdict.",
    image: IMAGE_PATHS.analysis,
    alt: "Educator reviewing a writing analytics report on a desktop monitor",
  },
  {
    number: "03",
    eyebrow: "Certify",
    title: "A sealed certificate, ready for academic submission.",
    body: "Once verified, a tamper-evident certificate is generated instantly - shareable with any teacher or institution that needs to confirm authorship.",
    image: IMAGE_PATHS.certificate,
    alt: "Hand holding a printed authorship certificate document",
  },
];

function ShowcaseSection() {
  return (
    <PublicSection className="py-20 md:py-28">
      <div className="mx-auto max-w-[1200px]">
        <Reveal className="mx-auto mb-16 max-w-2xl text-center">
          <SectionEyebrow>How it works</SectionEyebrow>
          <SectionHeading
            title="From keystroke to certificate, in one continuous trail."
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

const RADIAL_NODES = [
  { label: "Pause detection", icon: "pulse" as const, angle: -38.6 },
  { label: "Replay timeline", icon: "replay" as const, angle: 12.8 },
  { label: "ML classification", icon: "model" as const, angle: 64.2 },
  { label: "SHA-256 sealing", icon: "hash" as const, angle: 115.6 },
  { label: "Certificate issue", icon: "certificate" as const, angle: 167 },
  { label: "Teacher review", icon: "teacher" as const, angle: 218.4 },
  { label: "Public verification", icon: "search" as const, angle: 269.8 },
];

function RadialCapabilityMap() {
  const size = 560;
  const center = size / 2;
  const outerR = 230;
  const iconNameMap: Record<string, any> = {
    keyboard: "keyboard",
    pulse: "pulse",
    replay: "replay",
    model: "model",
    hash: "hash",
    certificate: "certificate",
    teacher: "teacher",
    search: "search",
  };

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
        const localIconName = iconNameMap[node.icon] || "keyboard";
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
              <Icon name={localIconName} size={19} strokeWidth={1.8} />
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
          <SectionHeading title="One writing session, seven layers of evidence." />
          <p
            className="mt-4 text-[16px] leading-relaxed"
            style={{ color: colors.text.secondary }}
          >
            Every signal TypeTrace records feeds the same authorship record -
            from the first keystroke to the certificate a teacher verifies.
            Nothing is captured in isolation.
          </p>
          <div className="mt-6">
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
// DIFFERENTIATOR
// ─────────────────────────────────────────────────────────────────────────────

const COMPETITOR_DATA = [
  {
    feature: "Writing process capture",
    typeTrace: true,
    aiDetectors: false,
    proctoring: "Partial",
    detail: "Records every keystroke, pause, and revision in real-time",
  },
  {
    feature: "Behavioral evidence",
    typeTrace: true,
    aiDetectors: false,
    proctoring: false,
    detail: "Analyzes how you write, not what you write",
  },
  {
    feature: "Replayable sessions",
    typeTrace: true,
    aiDetectors: false,
    proctoring: "Limited",
    detail: "Watch the entire writing process unfold",
  },
  {
    feature: "Privacy-preserving",
    typeTrace: true,
    aiDetectors: false,
    proctoring: false,
    detail: "No video recording, no screen monitoring",
  },
  {
    feature: "Tamper-evident certificates",
    typeTrace: true,
    aiDetectors: false,
    proctoring: false,
    detail: "SHA-256 sealed proof of authorship",
  },
  {
    feature: "Teacher review tools",
    typeTrace: true,
    aiDetectors: "Partial",
    proctoring: "Partial",
    detail: "Built for academic review, not automated punishment",
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
    if (value === true)
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
    if (value === false)
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
      className="group flex items-center border-b py-3 transition-colors duration-150 ml-5"
      style={{ borderColor: colors.surface[200] }}
    >
      <div className="flex-1 pr-4">
        <p
          className="text-[13px] font-semibold"
          style={{ color: colors.text.primary }}
        >
          {feature}
        </p>
        <motion.p
          initial={false}
          animate={{
            height: isHovered ? "auto" : 0,
            opacity: isHovered ? 1 : 0,
            marginTop: isHovered ? 4 : 0,
          }}
          className="overflow-hidden text-[11px] leading-relaxed"
          style={{ color: colors.text.secondary }}
        >
          {detail}
        </motion.p>
      </div>
      <div className="flex w-[300px] shrink-0 items-center justify-around">
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
    "The evidence of authorship lies not in the words we choose, but in how we write them.";
  const events = [
    { time: "00:01", action: "Session started", type: "system" },
    { time: "00:03", action: "Keystroke rhythm captured", type: "keystroke" },
    { time: "00:07", action: "Pause detected (2.3s)", type: "pause" },
    { time: "00:12", action: "Text revised", type: "revision" },
    { time: "00:18", action: "Paste blocked", type: "security" },
    { time: "00:24", action: "Session hash generated", type: "system" },
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
              {[colors.red, colors.amber, colors.green].map((c) => (
                <div
                  key={c}
                  className="h-2 w-2 rounded-full"
                  style={{ background: c }}
                />
              ))}
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
  icon: string;
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
        <Icon name={icon as any} size={16} strokeWidth={1.8} />
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
      className="relative overflow-hidden px-6 py-20 md:px-12 md:py-28"
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
            title="Evidence that holds up under scrutiny."
            description="Unlike AI detectors that guess, and proctoring tools that spy, TypeTrace captures how you write - creating reviewable evidence that respects privacy."
            align="center"
          />
        </Reveal>
        <Reveal className="mb-12 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard value="100%" label="Privacy-preserving" icon="lock" />
          <StatCard value="&lt;50ms" label="Capture latency" icon="zap" />
          <StatCard
            value="SHA-256"
            label="Cryptographic seal"
            icon="fingerprint"
          />
          <StatCard value="7" label="Evidence layers" icon="activity" />
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
                  className="border-b flex items-center py-2.5 ml-5"
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
                      AI Detector
                    </span>
                    <span
                      className="w-16 text-center text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: colors.text.muted }}
                    >
                      Proctor
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
                    Start free session
                    <Icon name="arrowRight" size={13} strokeWidth={2.5} />
                  </Link>
                </div>
              </PublicCard>
            </div>
          </Reveal>
        </div>
        <Reveal delay={0.15} className="mt-12">
          <div className="flex flex-wrap items-center justify-center gap-6">
            {[
              { icon: "shield", text: "Encrypted sessions" },
              { icon: "eye", text: "No video recording" },
              { icon: "database", text: "EU data storage" },
              { icon: "users", text: "Built with educators" },
            ].map((badge) => (
              <div key={badge.text} className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ background: colors.brandSoft, color: colors.brand }}
                >
                  <Icon name={badge.icon as any} size={13} />
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
  icon: string;
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
        <PublicIcon name={icon as any} size={18} />
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
            title="Built for students who need proof and teachers who need context."
            align="center"
          />
        </Reveal>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Reveal>
            <RoleCard
              icon="keyboard"
              title="For students"
              body="Create authorship evidence while writing, before your work is ever questioned."
              points={[
                "Write inside a focused, distraction-free editor.",
                "Capture rhythm, edits, pauses, and revisions automatically.",
                "Generate a certificate for academic submission in one click.",
              ]}
            />
          </Reveal>
          <Reveal delay={0.08}>
            <RoleCard
              icon="teacher"
              title="For teachers"
              body="Review the writing process instead of relying on a single AI detector score."
              points={[
                "Verify certificate authenticity in seconds.",
                "Review session-level behavioral evidence.",
                "Use replay and metrics to support fair decisions.",
              ]}
            />
          </Reveal>
        </div>
      </div>
    </PublicSection>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRUST SECTION — REDESIGNED: Clean dark cards with evidence flow
// ─────────────────────────────────────────────────────────────────────────────

const TRUST_PILLARS = [
  {
    icon: "activity",
    title: "Process over product",
    desc: "We capture how the document was written — rhythm, hesitation, revisions — not just the final text.",
    stat: "200+",
    statLabel: "behavioral signals tracked",
  },
  {
    icon: "shieldCheck",
    title: "Verify without exposure",
    desc: "Public verification confirms authenticity without revealing private drafts or session content.",
    stat: "SHA-256",
    statLabel: "tamper-evident sealing",
  },
  {
    icon: "users",
    title: "Built for human review",
    desc: "Evidence designed for educators to interpret alongside institutional procedures. No black-box judgments.",
    stat: "Human-first",
    statLabel: "review workflow",
  },
];

function TrustSection() {
  return (
    <section
      className="relative overflow-hidden px-6 py-24 md:px-12 md:py-32"
      style={{ background: colors.text.primary }}
    >
      {/* Subtle texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(${colors.text.light} 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `radial-gradient(circle, ${withAlpha(colors.brand, "25")} 0%, transparent 55%)`,
          filter: "blur(70px)",
        }}
      />

      <div className="relative mx-auto max-w-[1100px]">
        {/* Header */}
        <Reveal className="mb-14 text-center">
          <h2
            className="text-[2.5rem] font-bold leading-[1.1] tracking-[-0.04em] md:text-[3.2rem]"
            style={{ color: colors.text.light }}
          >
            Evidence you can
            <br />
            defend in any room.
          </h2>
          <p
            className="mt-4 text-[15px] leading-relaxed max-w-xl mx-auto"
            style={{ color: withAlpha(colors.text.light, "75") }}
          >
            Every design decision in TypeTrace serves one goal: making writing
            evidence that holds up under the strictest academic scrutiny.
          </p>
        </Reveal>

        {/* Three pillars — dark cards */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 mb-12">
          {TRUST_PILLARS.map((pillar, i) => (
            <Reveal key={pillar.title} delay={i * 0.08}>
              <div
                className="group relative rounded-2xl border p-6 transition-all duration-300 hover:border-brand/30"
                style={{
                  borderColor: withAlpha(colors.text.light, "10"),
                  background: withAlpha(colors.text.light, "03"),
                }}
              >
                {/* Hover glow */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: `radial-gradient(200px circle at 50% 0%, ${withAlpha(colors.brand, "12")} 0%, transparent 70%)`,
                  }}
                />
                <div className="relative">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl mb-4"
                    style={{
                      background: withAlpha(colors.brand, "18"),
                      color: colors.brand,
                    }}
                  >
                    <Icon
                      name={pillar.icon as any}
                      size={18}
                      strokeWidth={1.8}
                    />
                  </div>
                  <h3
                    className="text-lg font-bold tracking-[-0.02em] mb-2"
                    style={{ color: colors.text.light }}
                  >
                    {pillar.title}
                  </h3>
                  <p
                    className="text-[13px] leading-relaxed mb-5"
                    style={{ color: withAlpha(colors.text.light, "70") }}
                  >
                    {pillar.desc}
                  </p>
                  <div
                    className="flex items-baseline gap-2 pt-4 border-t"
                    style={{ borderColor: withAlpha(colors.text.light, "08") }}
                  >
                    <span
                      className="text-2xl font-bold tracking-tight"
                      style={{ color: colors.brand }}
                    >
                      {pillar.stat}
                    </span>
                    <span
                      className="text-[11px] font-medium"
                      style={{ color: withAlpha(colors.text.light, "50") }}
                    >
                      {pillar.statLabel}
                    </span>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Evidence flow — visual chain */}
        <Reveal delay={0.15}>
          <div
            className="rounded-2xl border p-6 md:p-8"
            style={{
              borderColor: withAlpha(colors.text.light, "10"),
              background: withAlpha(colors.text.light, "02"),
            }}
          >
            <p
              className="text-[11px] font-bold uppercase tracking-wider mb-6 text-center"
              style={{ color: withAlpha(colors.text.light, "50") }}
            >
              How evidence flows
            </p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-2">
              {[
                { icon: "keyboard", label: "Writing session", active: true },
                { icon: "activity", label: "Behavior capture", active: true },
                { icon: "hash", label: "SHA-256 seal", active: true },
                { icon: "certificate", label: "Certificate", active: true },
                { icon: "search", label: "Public verify", active: false },
              ].map((step, i) => (
                <div
                  key={step.label}
                  className="flex items-center gap-3 md:gap-2 w-full md:w-auto"
                >
                  <div
                    className={`flex flex-col items-center gap-1.5 rounded-xl px-4 py-3 transition-all duration-200 flex-1 md:flex-initial ${step.active ? "" : "opacity-40"}`}
                    style={{
                      background: step.active
                        ? withAlpha(colors.brand, "12")
                        : withAlpha(colors.text.light, "04"),
                    }}
                  >
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{
                        color: step.active
                          ? colors.brand
                          : withAlpha(colors.text.light, "40"),
                      }}
                    >
                      <Icon name={step.icon as any} size={16} strokeWidth={2} />
                    </div>
                    <span
                      className="text-[10px] font-semibold text-center whitespace-nowrap"
                      style={{
                        color: step.active
                          ? colors.text.light
                          : withAlpha(colors.text.light, "40"),
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < 4 && (
                    <div className="flex items-center justify-center w-6 h-6 md:w-4 md:h-4 shrink-0 rotate-90 md:rotate-0">
                      <Icon name="arrowRight" size={14} strokeWidth={2} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* CTA */}
        <Reveal delay={0.2}>
          <div className="mt-10 text-center">
            <Link
              to={ROUTES.REGISTER}
              className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-[14px] font-bold transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
              style={{
                background: colors.brand,
                color: colors.text.light,
                boxShadow: `0 6px 24px ${withAlpha(colors.brand, "35")}`,
              }}
            >
              Start building evidence
              <Icon name="arrowRight" size={14} strokeWidth={2.5} />
            </Link>
            <p
              className="mt-3 text-[11px]"
              style={{ color: withAlpha(colors.text.light, "45") }}
            >
              Free forever — no credit card required
            </p>
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
      className="relative overflow-hidden px-6 py-28 text-center md:py-36"
      style={{ background: colors.surface[50] }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${withAlpha(colors.brand, "08")} 0%, transparent 55%)`,
        }}
      />
      <div className="relative z-10 mx-auto flex max-w-[720px] flex-col items-center gap-5">
        <Reveal delay={0.05}>
          <h2
            className="text-[2.6rem] font-bold leading-tight tracking-[-0.04em] md:text-[3.5rem]"
            style={{ color: colors.text.primary }}
          >
            Stop defending final text.
            <br />
            Start documenting the process.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p
            className="max-w-lg text-[16px] leading-relaxed"
            style={{ color: colors.text.secondary }}
          >
            Join thousands of students and educators who've moved beyond AI
            detection drama. Create evidence that speaks for itself.
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
              Start writing — it's free
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
          <div className="mt-4 flex items-center gap-6">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-7 w-7 rounded-full border-2"
                  style={{
                    borderColor: colors.surface[50],
                    background: `linear-gradient(135deg, ${colors.brandSoft}, ${colors.brand})`,
                  }}
                />
              ))}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span
                    key={i}
                    style={{ color: colors.amber, fontSize: "13px" }}
                  >
                    ★
                  </span>
                ))}
              </div>
              <p
                className="text-[11px] font-medium"
                style={{ color: colors.text.secondary }}
              >
                Trusted by students at 50+ universities
              </p>
            </div>
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
      <ShowcaseSection />
      <CapabilityMapSection />
      <DifferentiatorSection />
      <StudentTeacherSection />
      <TrustSection />
      <FinalCtaSection />
    </PublicShell>
  );
}
