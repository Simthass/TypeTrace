import { useRef, useState, type ComponentProps, type ReactNode } from "react";
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
import {
  PublicCard,
  PublicIcon,
  PublicSection,
  PublicShell,
  SectionHeading,
} from "../components/public/PublicVisualSystem";

const DASHBOARD_PREVIEW_SRC = "/dashboard-mockup.png";

const IMAGE_PATHS = {
  journeyWrite: "/journey-write.png",
  journeyCapture: "/journey-capture.png",
  journeyAnalyze: "/journey-analyze.png",
  journeyCertificate: "/journey-certificate.png",
  comparison: "/process-vs-detector.png",
  replay: "/replay-timeline.png",
  certificate: "/certificate-preview.png",
  studentTeacher: "/student-teacher-workflow.png",
};

type PublicIconName = ComponentProps<typeof PublicIcon>["name"];

function withAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

function HeroGridBackground() {
  const cols = 12;
  const rows = 7;

  const colPositions = Array.from(
    { length: cols + 1 },
    (_, index) => `${(index / cols) * 100}%`,
  );

  const rowPositions = Array.from(
    { length: rows + 1 },
    (_, index) => `${(index / rows) * 100}%`,
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
          {colPositions.map((x, index) => (
            <line
              key={`column-${index}`}
              x1={x}
              y1="0%"
              x2={x}
              y2="100%"
              stroke={colors.surface[200]}
              strokeWidth="1"
            />
          ))}

          {rowPositions.map((y, index) => (
            <line
              key={`row-${index}`}
              x1="0%"
              y1={y}
              x2="100%"
              y2={y}
              stroke={colors.surface[200]}
              strokeWidth="1"
            />
          ))}

          {colPositions.map((x, columnIndex) =>
            rowPositions.map((y, rowIndex) => (
              <g
                key={`cross-${columnIndex}-${rowIndex}`}
                transform={`translate(${x}, ${y})`}
              >
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
          background: `radial-gradient(ellipse at center, ${withAlpha(
            colors.brand,
            "10",
          )} 0%, transparent 68%)`,
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
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className={`absolute hidden lg:block ${positionClass}`}
      initial={{ opacity: 0, y: 14 }}
      animate={
        reducedMotion
          ? { opacity: 1, y: 0, rotate }
          : {
              opacity: 1,
              y: [0, -floatAmp, 0],
              rotate,
            }
      }
      transition={
        reducedMotion
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
        borderRadius: 12,
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
          <PublicIcon name="shield" size={14} />
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
        “My essay was flagged even though I wrote every word myself.”
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
          <PublicIcon name="teacher" size={14} />
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
        “Can you show how this draft was actually written?”
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
  const reducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"],
  });

  const rotateX = useTransform(
    scrollYProgress,
    [0, 1],
    reducedMotion ? [0, 0] : [14, 0],
  );

  const y = useTransform(
    scrollYProgress,
    [0, 1],
    reducedMotion ? [0, 0] : [56, 0],
  );

  const scale = useTransform(
    scrollYProgress,
    [0, 1],
    reducedMotion ? [1, 1] : [0.95, 1],
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
          reducedMotion
            ? { opacity: 1 }
            : { opacity: 0, y: 72, rotateX: 14, scale: 0.95 }
        }
        animate={
          reducedMotion
            ? { opacity: 1 }
            : { opacity: 1, y: 0, rotateX: 14, scale: 0.95 }
        }
        transition={{
          duration: 1.1,
          delay: 0.42,
          ease: [0.16, 1, 0.3, 1],
        }}
        style={
          reducedMotion
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
        className="relative w-full overflow-hidden rounded-md border bg-white will-change-transform"
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
            {[colors.red, colors.amber, colors.green].map((color) => (
              <div
                key={color}
                className="h-3 w-3 rounded-full"
                style={{ background: color }}
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
            <PublicIcon name="privacy" size={10} />
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
            background: `linear-gradient(180deg, ${withAlpha(
              colors.surface[50],
              "30",
            )} 0%, transparent 100%)`,
          }}
        />

        <div
          className="pointer-events-none absolute inset-0 rounded-md"
          style={{
            boxShadow: `inset 0 1px 0 ${withAlpha(
              colors.text.light,
              "CC",
            )}, inset 0 -1px 0 ${withAlpha(colors.surface[200], "A0")}`,
          }}
        />
      </motion.div>
    </div>
  );
}

function HeroSection() {
  const reducedMotion = useReducedMotion();
  const delay = (value: number) => (reducedMotion ? 0 : value);

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
          className="mb-6 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[12px] font-bold uppercase tracking-[0.14em]"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[50],
            color: colors.brand,
          }}
        >
          <PublicIcon name="shield" size={15} />
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
          className="mb-7 max-w-[940px] text-[3.55rem] font-semibold leading-[0.95] tracking-[-0.065em] sm:text-[5rem] lg:text-[5.8rem]"
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
          TypeTrace captures keystroke dynamics, pauses, revisions, paste
          activity, and timing signals to create reviewable writing evidence
          before academic work is questioned.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.58, delay: delay(0.32) }}
          className="mb-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Link
            to={ROUTES.REGISTER}
            className="group flex items-center gap-2 rounded-md px-8 py-3.5 text-[14.5px] font-bold transition-all duration-150 hover:opacity-95 active:scale-[0.98]"
            style={{
              color: colors.text.light,
              background: colors.brand,
              boxShadow: `0 18px 48px ${colors.shadowStrong}`,
            }}
          >
            Start a writing session
            <span
              aria-hidden="true"
              className="transition-transform duration-150 group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>

          <Link
            to={ROUTES.VERIFY_LOOKUP}
            className="flex items-center gap-2 rounded-md border px-8 py-3.5 text-[14.5px] font-bold transition-all duration-150 hover:opacity-80"
            style={{
              color: colors.text.primary,
              borderColor: colors.surface[200],
              background: colors.surface[50],
            }}
          >
            <PublicIcon name="search" size={15} />
            Verify a certificate
          </Link>
        </motion.div>
      </div>

      <div className="relative z-10 w-full">
        <HeroDashboardPreview />
      </div>
    </section>
  );
}

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      initial={reducedMotion ? false : { opacity: 0, y: 24 }}
      animate={reducedMotion ? undefined : inView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.62,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function ImagePanel({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <PublicCard className={`overflow-hidden ${className ?? ""}`}>
      <img
        src={src}
        alt={alt}
        className="block h-full w-full object-cover object-center"
        loading="lazy"
      />
    </PublicCard>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: PublicIconName;
  label: string;
  value: string;
}) {
  return (
    <PublicCard className="p-5">
      <div
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-md"
        style={{ background: colors.brandSoft, color: colors.brand }}
      >
        <PublicIcon name={icon} size={18} />
      </div>

      <p
        className="text-[13px] font-semibold"
        style={{ color: colors.text.secondary }}
      >
        {label}
      </p>

      <p
        className="mt-1 text-xl font-semibold tracking-[-0.03em]"
        style={{ color: colors.text.primary }}
      >
        {value}
      </p>
    </PublicCard>
  );
}

function ProofStatsSection() {
  return (
    <section
      className="border-y px-6 py-8 md:px-12"
      style={{
        background: colors.surface[50],
        borderColor: colors.surface[200],
      }}
    >
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon="keyboard"
          label="Evidence captured"
          value="Keystrokes, pauses, edits"
        />
        <StatCard
          icon="timeline"
          label="Workflow"
          value="Write → Analyze → Review"
        />
        <StatCard
          icon="shield"
          label="Integrity layer"
          value="Certificate + hash"
        />
        <StatCard
          icon="teacher"
          label="User roles"
          value="Student and teacher"
        />
      </div>
    </section>
  );
}

const JOURNEY_STEPS = [
  {
    number: "01",
    title: "Write naturally",
    text: "Students write assignments inside a focused TypeTrace editor without changing their normal writing flow.",
    image: IMAGE_PATHS.journeyWrite,
    alt: "Student writing in TypeTrace editor",
    icon: "document" as PublicIconName,
  },
  {
    number: "02",
    title: "Capture the process",
    text: "Keystrokes, pauses, corrections, paste events, and rhythm changes become structured behavioral evidence.",
    image: IMAGE_PATHS.journeyCapture,
    alt: "Behavioral keystroke capture visualization",
    icon: "keyboard" as PublicIconName,
  },
  {
    number: "03",
    title: "Analyze writing behavior",
    text: "TypeTrace turns raw session behavior into review-safe authorship signals teachers can understand.",
    image: IMAGE_PATHS.journeyAnalyze,
    alt: "Behavioral authorship analytics dashboard",
    icon: "model" as PublicIconName,
  },
  {
    number: "04",
    title: "Generate certificate",
    text: "The final session can be sealed with a certificate, document hash, and public verification record.",
    image: IMAGE_PATHS.journeyCertificate,
    alt: "TypeTrace certificate illustration",
    icon: "certificate" as PublicIconName,
  },
];

function ProcessJourneySection() {
  return (
    <PublicSection className="py-32">
      <Reveal className="mx-auto mb-20 max-w-3xl text-center">
        <SectionHeading
          align="center"
          eyebrow="How TypeTrace works"
          title="A visual evidence trail from writing to verification."
          description="Instead of judging only the final text, TypeTrace records how the work was created and turns that process into reviewable evidence."
        />
      </Reveal>

      <div className="relative">
        <div
          className="absolute left-4 top-0 hidden h-full w-px md:left-1/2 md:block"
          style={{
            background: `linear-gradient(180deg, transparent 0%, ${colors.surface[200]} 8%, ${colors.surface[200]} 92%, transparent 100%)`,
          }}
        />

        <div className="grid gap-20">
          {JOURNEY_STEPS.map((step, index) => {
            const flip = index % 2 === 1;

            return (
              <Reveal key={step.number}>
                <div className="relative grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
                  <div
                    className="absolute left-1/2 top-1/2 hidden h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 md:block"
                    style={{
                      background: colors.brand,
                      borderColor: colors.surface[50],
                      boxShadow: `0 0 0 1px ${colors.surface[200]}`,
                    }}
                  />

                  <div className={flip ? "md:order-2" : ""}>
                    <div className="max-w-[430px]">
                      <div
                        className="mb-5 flex h-11 w-11 items-center justify-center rounded-md"
                        style={{
                          background: colors.brandSoft,
                          color: colors.brand,
                        }}
                      >
                        <PublicIcon name={step.icon} />
                      </div>

                      <span
                        className="font-mono text-sm font-bold"
                        style={{ color: colors.brand }}
                      >
                        {step.number}
                      </span>

                      <h3
                        className="mt-3 text-[2rem] font-semibold tracking-[-0.04em] md:text-[2.65rem]"
                        style={{ color: colors.text.primary }}
                      >
                        {step.title}
                      </h3>

                      <p
                        className="mt-4 text-[16px] leading-relaxed"
                        style={{ color: colors.text.secondary }}
                      >
                        {step.text}
                      </p>
                    </div>
                  </div>

                  <ImagePanel
                    src={step.image}
                    alt={step.alt}
                    className={flip ? "md:order-1" : ""}
                  />
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </PublicSection>
  );
}

function ComparisonSection() {
  return (
    <section
      className="border-y px-6 py-32 md:px-12"
      style={{
        background: colors.surface[100],
        borderColor: colors.surface[200],
      }}
    >
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <SectionHeading
            eyebrow="Why it is different"
            title="AI detectors guess from the final text. TypeTrace shows the process."
            description="A polished essay can look suspicious even when it is authentic. TypeTrace gives reviewers behavioral context: typing rhythm, pauses, corrections, replay, and certificate integrity."
          />

          <div className="mt-8 grid gap-3">
            {[
              "Final-text checks are reactive and often lack context.",
              "Writing behavior is captured while it happens.",
              "Certificates support review without exposing private drafts publicly.",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 text-[15px]"
                style={{ color: colors.text.secondary }}
              >
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
                  style={{ background: brand.humanBg, color: brand.humanText }}
                >
                  <PublicIcon name="shield" size={12} />
                </span>
                {item}
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <ImagePanel
            src={IMAGE_PATHS.comparison}
            alt="Text-only detector versus TypeTrace process evidence comparison"
          />
        </Reveal>
      </div>
    </section>
  );
}

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
    <PublicCard className="p-7">
      <div
        className="mb-5 flex h-11 w-11 items-center justify-center rounded-md"
        style={{ background: colors.brandSoft, color: colors.brand }}
      >
        <PublicIcon name={icon} />
      </div>

      <h3
        className="text-2xl font-semibold tracking-[-0.04em]"
        style={{ color: colors.text.primary }}
      >
        {title}
      </h3>

      <p
        className="mt-3 text-[15px] leading-relaxed"
        style={{ color: colors.text.secondary }}
      >
        {body}
      </p>

      <div className="mt-6 grid gap-3">
        {points.map((point) => (
          <div
            key={point}
            className="flex items-start gap-3 text-[14px]"
            style={{ color: colors.text.secondary }}
          >
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
              style={{ background: colors.brandSoft, color: colors.brand }}
            >
              <PublicIcon name="shield" size={12} />
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
    <PublicSection className="py-32">
      <Reveal className="mx-auto mb-16 max-w-3xl text-center">
        <SectionHeading
          align="center"
          eyebrow="Two-sided workflow"
          title="Built for students who need evidence and teachers who need context."
        />
      </Reveal>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal>
          <RoleCard
            icon="keyboard"
            title="For students"
            body="Create authorship evidence while writing, before your work is questioned."
            points={[
              "Write inside a focused editor.",
              "Capture rhythm, edits, pauses, and paste events.",
              "Generate a certificate for academic review.",
            ]}
          />
        </Reveal>

        <Reveal delay={0.08}>
          <RoleCard
            icon="teacher"
            title="For teachers"
            body="Review the writing process instead of relying only on AI detector output."
            points={[
              "Verify certificate records.",
              "Review session-level evidence.",
              "Use replay and metrics to support fair decisions.",
            ]}
          />
        </Reveal>
      </div>

      <Reveal delay={0.12} className="mt-10">
        <ImagePanel
          src={IMAGE_PATHS.studentTeacher}
          alt="Student and teacher TypeTrace workflow"
        />
      </Reveal>
    </PublicSection>
  );
}

function ReplaySection() {
  return (
    <section
      className="border-y px-6 py-32 md:px-12"
      style={{
        background: colors.surface[100],
        borderColor: colors.surface[200],
      }}
    >
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-14 lg:grid-cols-2">
        <Reveal>
          <ImagePanel
            src={IMAGE_PATHS.replay}
            alt="TypeTrace writing replay timeline interface"
          />
        </Reveal>

        <Reveal delay={0.08}>
          <SectionHeading
            eyebrow="Replay audit"
            title="Replay how the document was created."
            description="The replay timeline helps reviewers see writing bursts, thinking pauses, deletions, paste events, and revision behavior in one readable audit view."
          />

          <div className="mt-8 grid gap-4">
            {[
              ["Typing bursts", "Shows periods of continuous natural writing."],
              [
                "Pause markers",
                "Highlights thinking time and structural breaks.",
              ],
              [
                "Revision events",
                "Makes edits, deletions, and paste behavior visible.",
              ],
            ].map(([title, body]) => (
              <PublicCard key={title} className="p-4">
                <div className="flex gap-4">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                    style={{
                      background: colors.brandSoft,
                      color: colors.brand,
                    }}
                  >
                    <PublicIcon name="replay" size={17} />
                  </div>

                  <div>
                    <p
                      className="text-[14px] font-bold"
                      style={{ color: colors.text.primary }}
                    >
                      {title}
                    </p>

                    <p
                      className="mt-1 text-[13px] leading-relaxed"
                      style={{ color: colors.text.secondary }}
                    >
                      {body}
                    </p>
                  </div>
                </div>
              </PublicCard>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function CertificateSection() {
  return (
    <PublicSection className="py-32">
      <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <SectionHeading
            eyebrow="Certificate preview"
            title="A certificate built for academic review."
            description="Each certificate summarizes the writing session with identity-safe metadata, integrity hash, behavioral result, and a public verification route."
          />

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ["Certificate ID", "certificate" as PublicIconName],
              ["SHA-256 hash", "hash" as PublicIconName],
              ["Public verification", "search" as PublicIconName],
              ["Session evidence", "timeline" as PublicIconName],
            ].map(([label, icon]) => (
              <PublicCard key={label} className="p-4">
                <div className="flex items-center gap-3">
                  <span style={{ color: colors.brand }}>
                    <PublicIcon name={icon as PublicIconName} size={16} />
                  </span>

                  <span
                    className="text-[14px] font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {label}
                  </span>
                </div>
              </PublicCard>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <ImagePanel
            src={IMAGE_PATHS.certificate}
            alt="TypeTrace certificate preview"
          />
        </Reveal>
      </div>
    </PublicSection>
  );
}

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
                  border: `1.5px solid ${
                    open ? colors.brand : colors.surface[200]
                  }`,
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
      className="border-t px-6 py-32 md:px-12"
      style={{
        borderColor: colors.surface[200],
        background: colors.surface[50],
      }}
    >
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-start gap-16 lg:grid-cols-2 lg:gap-24">
        <div className="lg:sticky lg:top-32">
          <Reveal>
            <SectionHeading
              eyebrow="Trust architecture"
              title="Serious academic evidence needs serious product design."
              description="TypeTrace should feel calm, defensible, and professional because the product deals with sensitive academic review workflows."
            />
          </Reveal>
        </div>

        <Reveal delay={0.08}>
          <TrustAccordion />
        </Reveal>
      </div>
    </section>
  );
}

function FinalCtaSection() {
  return (
    <section
      className="relative overflow-hidden px-6 py-36 text-center"
      style={{ background: colors.text.primary }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${withAlpha(
            colors.brand,
            "55",
          )} 0%, transparent 48%)`,
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
            className="inline-flex items-center gap-2 rounded-md border px-3.5 py-1.5"
            style={{
              color: colors.text.light,
              borderColor: withAlpha(colors.text.light, "24"),
              background: withAlpha(colors.text.light, "08"),
            }}
          >
            <PublicIcon name="shield" size={14} />
            <span className="text-[12px] font-semibold">
              Start building a writing evidence trail
            </span>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <h2
            className="text-[2.8rem] font-semibold leading-tight tracking-[-0.06em] md:text-[4.4rem]"
            style={{ color: colors.text.light }}
          >
            Stop defending final text.
            <br />
            Start documenting the writing process.
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
              className="flex items-center gap-2 rounded-md px-8 py-3.5 text-[15px] font-bold transition-all hover:opacity-95 active:scale-[0.98]"
              style={{ background: colors.text.light, color: colors.brand }}
            >
              Start free session
              <span aria-hidden="true">→</span>
            </Link>

            <Link
              to={ROUTES.VERIFY_LOOKUP}
              className="flex items-center gap-2 rounded-md border px-8 py-3.5 text-[15px] font-bold transition-all hover:opacity-80"
              style={{
                color: withAlpha(colors.text.light, "CC"),
                borderColor: withAlpha(colors.text.light, "28"),
              }}
            >
              <PublicIcon name="search" size={16} />
              Verify certificate
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <PublicShell>
      <HeroSection />
      <ProofStatsSection />
      <ProcessJourneySection />
      <ComparisonSection />
      <StudentTeacherSection />
      <ReplaySection />
      <CertificateSection />
      <TrustSection />
      <FinalCtaSection />
    </PublicShell>
  );
}
