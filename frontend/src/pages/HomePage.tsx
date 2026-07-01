// frontend/src/pages/HomePage.tsx

import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";

import { ROUTES } from "../constants/routes";
import { brand, colors } from "../styles/colors";

// ─── Image paths — see prompts at the bottom of this file's companion doc ────
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

// ─── Icon primitives (inline, no external icon lib dependency) ───────────────

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
    | "spark";
  size?: number;
  strokeWidth?: number;
}) {
  const paths: Record<string, ReactNode> = {
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
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
// HERO — engineering grid, floating evidence cards, live dashboard preview
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

function HeroDashboardPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"],
  });
  const rotateX = useTransform(
    scrollYProgress,
    [0, 1],
    reduced ? [0, 0] : [14, 0],
  );
  const y = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [56, 0]);
  const scale = useTransform(
    scrollYProgress,
    [0, 1],
    reduced ? [1, 1] : [0.95, 1],
  );
  const opacity = useTransform(scrollYProgress, [0, 0.38], [0.25, 1]);

  return (
    <div
      ref={ref}
      className="relative z-20 mx-auto w-full max-w-[1280px] px-4 sm:px-6"
      style={{ perspective: "1400px" }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-[30%] h-[300px] w-[82%] -translate-x-1/2 rounded-full"
        style={{
          background: withAlpha(colors.brand, "14"),
          filter: "blur(80px)",
          opacity: 0.7,
        }}
      />
      <div
        className="pointer-events-none absolute bottom-[-12px] left-1/2 h-[60px] w-[72%] -translate-x-1/2 rounded-full"
        style={{
          background: withAlpha(colors.text.primary, "18"),
          filter: "blur(32px)",
        }}
      />
      <motion.div
        initial={
          reduced
            ? { opacity: 1 }
            : { opacity: 0, y: 72, rotateX: 14, scale: 0.95 }
        }
        animate={
          reduced
            ? { opacity: 1 }
            : { opacity: 1, y: 0, rotateX: 14, scale: 0.95 }
        }
        transition={{ duration: 1.1, delay: 0.42, ease: [0.16, 1, 0.3, 1] }}
        style={
          reduced
            ? undefined
            : {
                rotateX,
                y,
                scale,
                opacity,
                transformPerspective: 1400,
                transformOrigin: "center top",
              }
        }
        className="relative w-full overflow-hidden rounded-xl border bg-white will-change-transform"
        aria-label="TypeTrace dashboard preview"
      >
        <div
          className="flex h-10 items-center gap-3 border-b px-4"
          style={{
            background: colors.surface[100],
            borderColor: colors.surface[200],
          }}
        >
          <div className="flex gap-1.5">
            {[colors.red, colors.amber, colors.green].map((c) => (
              <div
                key={c}
                className="h-3 w-3 rounded-full"
                style={{ background: c }}
              />
            ))}
          </div>
          <div
            className="mx-auto flex h-6 max-w-[300px] flex-1 items-center justify-center gap-1.5 rounded-md border font-mono text-[11px]"
            style={{
              background: colors.surface[50],
              borderColor: colors.surface[200],
              color: colors.text.secondary,
            }}
          >
            <Icon name="lock" size={10} />
            app.typetrace.com
          </div>
          <div className="w-12" />
        </div>
        <img
          src={DASHBOARD_PREVIEW_SRC}
          alt="TypeTrace writing session dashboard"
          className="block w-full select-none object-cover object-top"
          draggable={false}
          style={{ maxHeight: 580 }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-20"
          style={{
            background: `linear-gradient(180deg, ${withAlpha(colors.surface[50], "30")} 0%, transparent 100%)`,
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            boxShadow: `inset 0 1px 0 ${withAlpha(colors.text.light, "CC")}, inset 0 -1px 0 ${withAlpha(colors.surface[200], "A0")}`,
          }}
        />
      </motion.div>
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
          <Icon name="shield" size={14} strokeWidth={2.3} />
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
          <Link
            to={ROUTES.REGISTER}
            className="group flex items-center gap-2 rounded-lg px-8 py-3.5 text-[14.5px] font-bold transition-all duration-150 hover:opacity-95 active:scale-[0.98]"
            style={{
              color: colors.text.light,
              background: colors.brand,
              boxShadow: `0 18px 48px ${colors.shadowStrong}`,
            }}
          >
            Start a writing session
            <span className="transition-transform duration-150 group-hover:translate-x-0.5">
              <Icon name="arrowRight" size={15} strokeWidth={2.4} />
            </span>
          </Link>
          <Link
            to={ROUTES.VERIFY_LOOKUP}
            className="flex items-center gap-2 rounded-lg border px-8 py-3.5 text-[14.5px] font-bold transition-all duration-150 hover:opacity-80"
            style={{
              color: colors.text.primary,
              borderColor: colors.surface[200],
              background: colors.surface[50],
            }}
          >
            <Icon name="search" size={15} />
            Verify a certificate
          </Link>
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
// LOGO / TRUST STRIP
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
// PHOTOGRAPHIC SHOWCASE — three real-feel product moments
// ─────────────────────────────────────────────────────────────────────────────

function ShowcasePanel({ src, alt }: { src: string; alt: string }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        borderColor: colors.surface[200],
        boxShadow: `0 24px 64px -32px ${colors.shadowStrong}`,
      }}
    >
      <img
        src={src}
        alt={alt}
        className="block h-full w-full object-cover"
        loading="lazy"
      />
    </div>
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
    body: "Once verified, a tamper-evident certificate is generated instantly — shareable with any teacher or institution that needs to confirm authorship.",
    image: IMAGE_PATHS.certificate,
    alt: "Hand holding a printed authorship certificate document",
  },
];

function ShowcaseSection() {
  return (
    <section
      className="px-6 py-28 md:px-12 md:py-36"
      style={{ background: colors.surface[50] }}
    >
      <div className="mx-auto max-w-[1200px]">
        <Reveal className="mx-auto mb-20 max-w-2xl text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2
            className="mt-4 text-[2.3rem] font-bold leading-[1.08] tracking-[-0.03em] md:text-[3.1rem]"
            style={{ color: colors.text.primary }}
          >
            From keystroke to certificate, in one continuous trail.
          </h2>
        </Reveal>

        <div className="grid gap-20">
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
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RADIAL CAPABILITY MAP — signature element, replaces the teal "hub" reference
// A custom SVG radial diagram built from TypeTrace's own concepts.
// ─────────────────────────────────────────────────────────────────────────────

const RADIAL_NODES = [
  { label: "Keystroke timing", icon: "keyboard" as const, angle: -90 },
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

  return (
    <div className="relative mx-auto flex w-full max-w-[560px] items-center justify-center">
      <svg
        width="100%"
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        {/* Concentric guide rings */}
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

        {/* Spokes */}
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

        {/* Center node */}
        <circle
          cx={center}
          cy={center}
          r={68}
          fill={colors.surface[50]}
          stroke={colors.brand}
          strokeWidth="1.5"
        />
      </svg>

      {/* Center label (HTML overlay for crisp text) */}
      <div
        className="absolute flex flex-col items-center justify-center"
        style={{ width: 136, height: 136 }}
      >
        <span
          className="text-[19px] font-extrabold tracking-tight"
          style={{ color: colors.text.primary }}
        >
          Type<span style={{ color: colors.brand }}>Trace</span>
        </span>
        <span
          className="mt-1 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: colors.text.muted }}
        >
          Writing session
        </span>
      </div>

      {/* Node cards positioned via trig, overlaid as HTML for crisp icon+label rendering */}
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
    <section
      className="border-y px-6 py-28 md:px-12 md:py-36"
      style={{
        background: colors.surface[100],
        borderColor: colors.surface[200],
      }}
    >
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-16 lg:grid-cols-[1fr_1.05fr]">
        <Reveal>
          <RadialCapabilityMap />
        </Reveal>
        <Reveal delay={0.08}>
          <Eyebrow>One workspace</Eyebrow>
          <h2
            className="mt-4 text-[2.3rem] font-bold leading-[1.08] tracking-[-0.03em] md:text-[3.1rem]"
            style={{ color: colors.text.primary }}
          >
            One writing session, eight layers of evidence.
          </h2>
          <p
            className="mt-5 text-[16px] leading-relaxed"
            style={{ color: colors.text.secondary }}
          >
            Every signal TypeTrace records feeds the same authorship record —
            from the first keystroke to the certificate a teacher verifies.
            Nothing is captured in isolation.
          </p>
          <div className="mt-8 flex flex-col gap-2">
            <Link
              to={ROUTES.REGISTER}
              className="inline-flex w-fit items-center gap-2 rounded-lg px-6 py-3 text-[14px] font-bold transition hover:opacity-95 active:scale-[0.98]"
              style={{
                color: colors.text.light,
                background: colors.brand,
                boxShadow: `0 14px 36px ${colors.shadowStrong}`,
              }}
            >
              Start a writing session
              <Icon name="arrowRight" size={15} strokeWidth={2.4} />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DARK FEATURE BLOCK — replaces the teal "differentiator" reference
// In TypeTrace navy, not teal.
// ─────────────────────────────────────────────────────────────────────────────

function DifferentiatorCard({
  icon,
  title,
  body,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  title: string;
  body: string;
}) {
  return (
    <div
      className="flex flex-col gap-4 rounded-2xl bg-white p-6"
      style={{ boxShadow: `0 24px 48px -20px rgba(0,0,0,0.35)` }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ background: colors.brandSoft, color: colors.brand }}
      >
        <Icon name={icon} size={18} strokeWidth={2} />
      </div>
      <div>
        <p
          className="text-[15px] font-bold"
          style={{ color: colors.text.primary }}
        >
          {title}
        </p>
        <p
          className="mt-1.5 text-[13.5px] leading-relaxed"
          style={{ color: colors.text.secondary }}
        >
          {body}
        </p>
      </div>
    </div>
  );
}

function DifferentiatorSection() {
  return (
    <section className="relative overflow-hidden px-6 py-2 md:px-12">
      <div
        className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[28px] px-6 py-20 md:px-16 md:py-28"
        style={{ background: colors.text.primary }}
      >
        {/* Dot grid texture */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.05]"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="diff-dots"
              x="0"
              y="0"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="1" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#diff-dots)" />
        </svg>
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[700px] -translate-x-1/2 -translate-y-1/3 rounded-full"
          style={{
            background: withAlpha(colors.brand, "45"),
            filter: "blur(100px)",
          }}
        />

        {/* Floating cards above the headline, like the reference */}
        <div className="relative z-10 mb-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Reveal delay={0}>
            <DifferentiatorCard
              icon="keyboard"
              title="Invisible capture"
              body="Records naturally as students write — no separate tool, no workflow change."
            />
          </Reveal>
          <Reveal delay={0.06}>
            <DifferentiatorCard
              icon="model"
              title="Process-based scoring"
              body="Classification trained on writing behavior, not vocabulary or sentence style."
            />
          </Reveal>
          <Reveal delay={0.12}>
            <DifferentiatorCard
              icon="replay"
              title="Replayable evidence"
              body="Reviewers can watch the session unfold instead of trusting a single score."
            />
          </Reveal>
          <Reveal delay={0.18}>
            <DifferentiatorCard
              icon="lock"
              title="Tamper-evident seal"
              body="A SHA-256 hash locks the record the moment a certificate is issued."
            />
          </Reveal>
        </div>

        <Reveal delay={0.2} className="relative z-10 text-center">
          <h2
            className="mx-auto max-w-3xl text-[2.1rem] font-bold leading-[1.1] tracking-[-0.03em] md:text-[3rem]"
            style={{ color: colors.text.light }}
          >
            These four layers are why TypeTrace evidence holds up under review.
          </h2>
          <div className="mt-9">
            <Link
              to={ROUTES.REGISTER}
              className="inline-flex items-center gap-2 rounded-lg px-8 py-3.5 text-[14.5px] font-bold transition hover:opacity-95 active:scale-[0.98]"
              style={{ background: colors.text.light, color: colors.brand }}
            >
              Start for free
              <Icon name="arrowRight" size={15} strokeWidth={2.4} />
            </Link>
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
  icon: Parameters<typeof Icon>[0]["name"];
  title: string;
  body: string;
  points: string[];
}) {
  return (
    <div
      className="rounded-2xl border bg-white p-8"
      style={{
        borderColor: colors.surface[200],
        boxShadow: `0 20px 48px -28px ${colors.shadowStrong}`,
      }}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ background: colors.brandSoft, color: colors.brand }}
      >
        <Icon name={icon} size={20} strokeWidth={2} />
      </div>
      <h3
        className="mt-6 text-[1.5rem] font-bold tracking-[-0.02em]"
        style={{ color: colors.text.primary }}
      >
        {title}
      </h3>
      <p
        className="mt-3 text-[14.5px] leading-relaxed"
        style={{ color: colors.text.secondary }}
      >
        {body}
      </p>
      <div className="mt-6 flex flex-col gap-3">
        {points.map((point) => (
          <div
            key={point}
            className="flex items-start gap-3 text-[13.5px]"
            style={{ color: colors.text.secondary }}
          >
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
              style={{ background: brand.humanBg, color: brand.humanText }}
            >
              <Icon name="check" size={11} strokeWidth={2.6} />
            </span>
            {point}
          </div>
        ))}
      </div>
    </div>
  );
}

function StudentTeacherSection() {
  return (
    <section
      className="px-6 py-28 md:px-12 md:py-36"
      style={{ background: colors.surface[50] }}
    >
      <div className="mx-auto max-w-[1200px]">
        <Reveal className="mx-auto mb-16 max-w-2xl text-center">
          <Eyebrow>Two-sided workflow</Eyebrow>
          <h2
            className="mt-4 text-[2.3rem] font-bold leading-[1.08] tracking-[-0.03em] md:text-[3.1rem]"
            style={{ color: colors.text.primary }}
          >
            Built for students who need proof and teachers who need context.
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRUST ACCORDION
// ─────────────────────────────────────────────────────────────────────────────

const TRUST_ITEMS = [
  {
    title: "Process evidence instead of final-text guessing",
    content:
      "TypeTrace records how the document was produced: rhythm, hesitation, revision behavior, paste bursts, deletions, and typing consistency. This gives reviewers more context than text-only AI detector output.",
  },
  {
    title: "Certificate records without exposing private drafts",
    content:
      "Public verification can confirm certificate status and integrity metadata without revealing the full writing content or private session data.",
  },
  {
    title: "Designed for academic review, not automatic punishment",
    content:
      "TypeTrace supports fair human review. It provides structured evidence that teachers can interpret alongside institutional academic integrity procedures.",
  },
];

function TrustAccordion() {
  const [active, setActive] = useState(0);
  return (
    <div
      className="flex w-full flex-col border-t"
      style={{ borderColor: colors.surface[200] }}
    >
      {TRUST_ITEMS.map((item, index) => {
        const open = active === index;
        return (
          <button
            key={item.title}
            type="button"
            onClick={() => setActive(open ? -1 : index)}
            className="border-b text-left"
            style={{ borderColor: colors.surface[200] }}
          >
            <div className="flex items-center justify-between gap-6 py-7">
              <h3
                className="text-xl tracking-[-0.03em] transition-all duration-200 md:text-2xl"
                style={{
                  color: open ? colors.text.primary : colors.text.secondary,
                  fontWeight: open ? 650 : 450,
                }}
              >
                {item.title}
              </h3>
              <motion.div
                animate={{ rotate: open ? 45 : 0 }}
                transition={{ duration: 0.22 }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                style={{
                  background: open ? colors.brand : "transparent",
                  color: open ? colors.text.light : colors.text.primary,
                  border: `1.5px solid ${open ? colors.brand : colors.surface[200]}`,
                }}
              >
                +
              </motion.div>
            </div>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <p
                    className="max-w-2xl pb-7 text-base leading-relaxed md:text-lg"
                    style={{ color: colors.text.secondary }}
                  >
                    {item.content}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        );
      })}
    </div>
  );
}

function TrustSection() {
  return (
    <section
      className="border-t px-6 py-28 md:px-12 md:py-36"
      style={{
        borderColor: colors.surface[200],
        background: colors.surface[100],
      }}
    >
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-start gap-16 lg:grid-cols-2 lg:gap-24">
        <div className="lg:sticky lg:top-32">
          <Reveal>
            <Eyebrow>Trust architecture</Eyebrow>
            <h2
              className="mt-4 text-[2.1rem] font-bold leading-[1.1] tracking-[-0.03em] md:text-[2.9rem]"
              style={{ color: colors.text.primary }}
            >
              Serious academic evidence needs serious product design.
            </h2>
            <p
              className="mt-5 text-[15.5px] leading-relaxed"
              style={{ color: colors.text.secondary }}
            >
              TypeTrace is built to feel calm, defensible, and professional —
              because the product handles sensitive academic review workflows.
            </p>
          </Reveal>
        </div>
        <Reveal delay={0.08}>
          <TrustAccordion />
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
      className="relative overflow-hidden px-6 py-36 text-center"
      style={{ background: colors.text.primary }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${withAlpha(colors.brand, "55")} 0%, transparent 48%)`,
        }}
      />
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.035]"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="home-cta-dots"
            x="0"
            y="0"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#home-cta-dots)" />
      </svg>
      <div className="relative z-10 mx-auto flex max-w-[820px] flex-col items-center gap-6">
        <Reveal>
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5"
            style={{
              color: colors.text.light,
              borderColor: withAlpha(colors.text.light, "24"),
              background: withAlpha(colors.text.light, "08"),
            }}
          >
            <Icon name="spark" size={14} />
            <span className="text-[12px] font-semibold">
              Start building a writing evidence trail
            </span>
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <h2
            className="text-[2.8rem] font-bold leading-tight tracking-[-0.04em] md:text-[4.4rem]"
            style={{ color: colors.text.light }}
          >
            Stop defending final text.
            <br />
            Start documenting the process.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p
            className="max-w-xl text-[17px] leading-relaxed"
            style={{ color: withAlpha(colors.text.light, "B8") }}
          >
            Create a session, write naturally, generate evidence, and share a
            certificate when your work needs to be reviewed.
          </p>
        </Reveal>
        <Reveal delay={0.14}>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Link
              to={ROUTES.REGISTER}
              className="flex items-center gap-2 rounded-lg px-8 py-3.5 text-[15px] font-bold transition-all hover:opacity-95 active:scale-[0.98]"
              style={{ background: colors.text.light, color: colors.brand }}
            >
              Start free session
              <Icon name="arrowRight" size={16} strokeWidth={2.4} />
            </Link>
            <Link
              to={ROUTES.VERIFY_LOOKUP}
              className="flex items-center gap-2 rounded-lg border px-8 py-3.5 text-[15px] font-bold transition-all hover:opacity-80"
              style={{
                color: withAlpha(colors.text.light, "CC"),
                borderColor: withAlpha(colors.text.light, "28"),
              }}
            >
              <Icon name="search" size={16} />
              Verify certificate
            </Link>
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
    <main
      className="min-h-screen w-full overflow-x-hidden font-sans"
      style={{ background: colors.surface[50] }}
    >
      <HeroSection />
      <TrustStrip />
      <ShowcaseSection />
      <CapabilityMapSection />
      <DifferentiatorSection />
      <StudentTeacherSection />
      <TrustSection />
      <FinalCtaSection />
    </main>
  );
}
