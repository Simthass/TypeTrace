import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  GitBranch,
  Keyboard,
  LockKeyhole,
  MessageSquare,
  PlayCircle,
  Plus,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
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

function sa(hex: string, twoDigitHex: string) {
  return `${hex}${twoDigitHex}`;
}

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
          <linearGradient id="hg-fade-y" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.surface[50]} stopOpacity="0" />
            <stop offset="14%" stopColor={colors.surface[50]} stopOpacity="1" />
            <stop offset="74%" stopColor={colors.surface[50]} stopOpacity="1" />
            <stop
              offset="100%"
              stopColor={colors.surface[50]}
              stopOpacity="0"
            />
          </linearGradient>
          <radialGradient id="hg-center" cx="50%" cy="36%" r="54%">
            <stop offset="0%" stopColor={colors.surface[50]} stopOpacity="1" />
            <stop
              offset="100%"
              stopColor={colors.surface[50]}
              stopOpacity="0"
            />
          </radialGradient>
          <mask id="hg-mask">
            <rect width="100%" height="100%" fill="url(#hg-fade-y)" />
          </mask>
        </defs>

        <g mask="url(#hg-mask)" opacity="0.62">
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
        <rect width="100%" height="100%" fill="url(#hg-center)" />
      </svg>

      <div
        className="absolute left-1/2 top-[28%] h-[480px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `radial-gradient(ellipse at center, ${sa(colors.brand, "10")} 0%, transparent 68%)`,
          filter: "blur(72px)",
        }}
      />
    </div>
  );
}

function FloatCard({
  children,
  posClass,
  rotate,
  delay,
  floatAmp = 8,
}: {
  children: ReactNode;
  posClass: string;
  rotate: number;
  delay: number;
  floatAmp?: number;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={`absolute hidden lg:block ${posClass}`}
      initial={{ opacity: 0, y: 14 }}
      animate={
        reduced
          ? { opacity: 1, y: 0, rotate }
          : {
              opacity: 1,
              y: [0, -floatAmp, 0],
              rotate,
            }
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
        boxShadow: `0 8px 28px -8px ${sa(colors.text.primary, "1A")}, 0 2px 8px -4px ${sa(colors.text.primary, "0D")}`,
      }}
    >
      {children}
    </motion.div>
  );
}

function CardStudentMessage() {
  return (
    <div className="flex w-[248px] flex-col gap-2.5 p-3.5">
      <div className="flex items-center gap-2">
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ background: brand.aiBg, color: brand.aiAccent }}
        >
          <AlertCircle size={12} strokeWidth={2.5} />
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: colors.text.secondary }}
        >
          Student message
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
          Academic integrity concern
        </span>
        <span
          className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
          style={{ background: brand.aiBg, color: brand.aiText }}
        >
          Flagged
        </span>
      </div>
    </div>
  );
}

function CardTeacherReview() {
  return (
    <div className="flex w-[236px] flex-col gap-2.5 p-3.5">
      <div className="flex items-center gap-2">
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ background: colors.brandSoft, color: brand.action }}
        >
          <MessageSquare size={12} strokeWidth={2.5} />
        </div>
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: colors.text.secondary }}
        >
          Review notice
        </span>
      </div>
      <p
        className="text-[12.5px] font-semibold leading-snug"
        style={{ color: colors.text.primary }}
      >
        "Can you prove how this draft was written?"
      </p>
      <div
        className="flex items-center justify-between border-t pt-2"
        style={{ borderColor: colors.surface[200] }}
      >
        <span className="text-[10px]" style={{ color: colors.text.secondary }}>
          Teacher review
        </span>
        <span
          className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
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
          background: sa(colors.brand, "14"),
          filter: "blur(80px)",
          opacity: 0.7,
        }}
      />
      <div
        className="pointer-events-none absolute bottom-[-12px] left-1/2 h-[60px] w-[72%] -translate-x-1/2 rounded-full"
        style={{
          background: sa(colors.text.primary, "18"),
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
        className="relative w-full overflow-hidden rounded-xl border will-change-transform"
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
            {[colors.red, colors.amber, colors.green].map((c, i) => (
              <div
                key={i}
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
            <LockKeyhole size={10} strokeWidth={2.4} />
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
            background: `linear-gradient(180deg, ${sa(colors.surface[50], "30")} 0%, transparent 100%)`,
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            boxShadow: `inset 0 1px 0 ${sa(colors.text.light, "CC")}, inset 0 -1px 0 ${sa(colors.surface[200], "A0")}`,
          }}
        />
      </motion.div>
    </div>
  );
}

function HeroSection() {
  const reduced = useReducedMotion();
  const t = (n: number) => (reduced ? 0 : n);

  return (
    <section className="relative flex min-h-screen flex-col items-center overflow-hidden px-6 pb-28 pt-[min(10vh,96px)] text-center">
      <HeroGridBackground />

      <FloatCard
        posClass="left-[1%] top-[15%] xl:left-[5%] xl:top-[19%]"
        rotate={-4}
        delay={t(0.7)}
        floatAmp={9}
      >
        <CardStudentMessage />
      </FloatCard>
      <FloatCard
        posClass="right-[1%] top-[13%] xl:right-[5%] xl:top-[17%]"
        rotate={3.5}
        delay={t(0.85)}
        floatAmp={11}
      >
        <CardTeacherReview />
      </FloatCard>

      <div className="relative z-10 flex w-full max-w-[920px] flex-col items-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.68,
            delay: t(0.14),
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mb-7 max-w-[920px] text-[3.6rem] font-bold leading-[0.95] tracking-[-0.06em] sm:text-[5rem] lg:text-[5.8rem]"
        >
          <span style={{ color: colors.text.primary }}>
            Authorship evidence,
          </span>
          <br />
          <span style={{ color: brand.action }}>built as you write.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.62, delay: t(0.24) }}
          className="mb-11 max-w-[560px] text-[17px] leading-[1.7]"
          style={{ color: colors.text.secondary }}
        >
          TypeTrace captures writing sessions and generates verifiable
          authorship certificates before academic work is questioned.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.58, delay: t(0.32) }}
          className="mb-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Link
            to={ROUTES.REGISTER}
            className="group flex items-center gap-2 rounded-md px-8 py-3.5 text-[14.5px] font-semibold transition-all duration-150 hover:opacity-95 active:scale-[0.98]"
            style={{
              color: colors.text.light,
              background: brand.action,
              boxShadow: `0 16px 42px -18px ${sa(colors.brand, "B0")}`,
            }}
          >
            Start a writing session
            <ArrowRight
              size={16}
              strokeWidth={2.3}
              className="transition-transform duration-150 group-hover:translate-x-0.5"
            />
          </Link>

          <Link
            to={ROUTES.VERIFY_LOOKUP}
            className="flex items-center gap-2 rounded-md border px-8 py-3.5 text-[14.5px] font-semibold transition-all duration-150"
            style={{
              color: colors.text.primary,
              borderColor: colors.surface[200],
              background: "transparent",
            }}
          >
            <ScanLine size={15} strokeWidth={2.3} />
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

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <span
      className="text-[11px] font-bold uppercase tracking-widest"
      style={{ color: brand.action }}
    >
      {children}
    </span>
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

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.62, delay, ease: [0.22, 1, 0.36, 1] }}
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
    <div
      className={`overflow-hidden rounded-md border ${className ?? ""}`}
      style={{
        background: colors.surface[50],
        borderColor: colors.surface[200],
        boxShadow: `0 24px 70px -46px ${sa(colors.text.primary, "66")}`,
      }}
    >
      <img
        src={src}
        alt={alt}
        className="block h-full w-full object-cover object-center"
        loading="lazy"
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      className="rounded-md border p-5"
      style={{
        background: colors.surface[50],
        borderColor: colors.surface[200],
      }}
    >
      <div
        className="mb-4 flex h-9 w-9 items-center justify-center rounded-md"
        style={{ background: colors.brandSoft, color: brand.action }}
      >
        {icon}
      </div>
      <p
        className="text-[13px] font-semibold"
        style={{ color: colors.text.secondary }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-xl font-bold tracking-tight"
        style={{ color: colors.text.primary }}
      >
        {value}
      </p>
    </div>
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
          icon={<Keyboard size={17} strokeWidth={2.4} />}
          label="Evidence captured"
          value="Keystrokes, pauses, edits"
        />
        <StatCard
          icon={<GitBranch size={17} strokeWidth={2.4} />}
          label="Workflow"
          value="Write → Verify → Review"
        />
        <StatCard
          icon={<ShieldCheck size={17} strokeWidth={2.4} />}
          label="Integrity layer"
          value="Certificate + hash"
        />
        <StatCard
          icon={<Users size={17} strokeWidth={2.4} />}
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
  },
  {
    number: "02",
    title: "Capture the process",
    text: "Keystrokes, pauses, corrections, paste events, and rhythm changes become structured behavioral evidence.",
    image: IMAGE_PATHS.journeyCapture,
    alt: "Behavioral keystroke capture visualization",
  },
  {
    number: "03",
    title: "Analyze writing behavior",
    text: "TypeTrace turns raw session behavior into review-safe authorship signals teachers can understand.",
    image: IMAGE_PATHS.journeyAnalyze,
    alt: "Behavioral authorship analytics dashboard",
  },
  {
    number: "04",
    title: "Generate certificate",
    text: "The final session can be sealed with a certificate, document hash, and public verification record.",
    image: IMAGE_PATHS.journeyCertificate,
    alt: "TypeTrace certificate illustration",
  },
];

function ProcessJourneySection() {
  return (
    <section
      className="relative overflow-hidden px-6 py-32 md:px-12"
      style={{ background: colors.surface[50] }}
    >
      <div className="mx-auto max-w-[1180px]">
        <Reveal className="mx-auto mb-20 max-w-3xl text-center">
          <SectionEyebrow>How TypeTrace works</SectionEyebrow>
          <h2
            className="mt-5 text-[2.5rem] font-bold leading-[1.04] tracking-tight md:text-[4rem]"
            style={{ color: colors.text.primary }}
          >
            A visual evidence trail from writing to verification.
          </h2>
          <p
            className="mt-5 text-lg leading-relaxed"
            style={{ color: colors.text.secondary }}
          >
            Instead of judging only the final text, TypeTrace records how the
            work was created and turns that process into reviewable evidence.
          </p>
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
                      className={`absolute left-1/2 top-1/2 hidden h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 md:block`}
                      style={{
                        background: brand.action,
                        borderColor: colors.surface[50],
                        boxShadow: `0 0 0 1px ${colors.surface[200]}`,
                      }}
                    />

                    <div className={flip ? "md:order-2" : ""}>
                      <div className="max-w-[430px]">
                        <span
                          className="font-mono text-sm font-bold"
                          style={{ color: brand.action }}
                        >
                          {step.number}
                        </span>
                        <h3
                          className="mt-3 text-[2rem] font-bold tracking-tight md:text-[2.65rem]"
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
      </div>
    </section>
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
          <SectionEyebrow>Why it is different</SectionEyebrow>
          <h2
            className="mt-5 text-[2.55rem] font-bold leading-[1.05] tracking-tight md:text-[3.8rem]"
            style={{ color: colors.text.primary }}
          >
            AI detectors guess from the final text.
            <br />
            <span style={{ color: brand.action }}>
              TypeTrace shows the process.
            </span>
          </h2>
          <p
            className="mt-6 text-lg leading-relaxed"
            style={{ color: colors.text.secondary }}
          >
            A polished essay can look suspicious even when it is authentic.
            TypeTrace gives reviewers behavioral context: typing rhythm, pauses,
            corrections, replay, and certificate integrity.
          </p>

          <div className="mt-8 grid gap-3">
            {[
              "Final-text checks are reactive",
              "Writing behavior is captured while it happens",
              "Certificates support review without exposing private drafts",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 text-[15px]"
                style={{ color: colors.text.secondary }}
              >
                <CheckCircle2
                  size={16}
                  strokeWidth={2.4}
                  className="mt-0.5 shrink-0"
                  style={{ color: brand.action }}
                />
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
  icon: ReactNode;
  title: string;
  body: string;
  points: string[];
}) {
  return (
    <div
      className="rounded-md border p-7"
      style={{
        background: colors.surface[50],
        borderColor: colors.surface[200],
        boxShadow: `0 20px 60px -46px ${sa(colors.text.primary, "66")}`,
      }}
    >
      <div
        className="mb-5 flex h-11 w-11 items-center justify-center rounded-md"
        style={{ background: colors.brandSoft, color: brand.action }}
      >
        {icon}
      </div>
      <h3
        className="text-2xl font-bold tracking-tight"
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
            <Check
              size={15}
              strokeWidth={2.5}
              className="mt-0.5 shrink-0"
              style={{ color: brand.action }}
            />
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
      className="px-6 py-32 md:px-12"
      style={{ background: colors.surface[50] }}
    >
      <div className="mx-auto max-w-[1200px]">
        <Reveal className="mx-auto mb-16 max-w-3xl text-center">
          <SectionEyebrow>Two-sided workflow</SectionEyebrow>
          <h2
            className="mt-5 text-[2.5rem] font-bold leading-[1.05] tracking-tight md:text-[3.8rem]"
            style={{ color: colors.text.primary }}
          >
            Built for students who need proof and teachers who need context.
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Reveal>
            <RoleCard
              icon={<UserCheck size={20} strokeWidth={2.4} />}
              title="For students"
              body="Create authorship evidence while writing, before your work is questioned."
              points={[
                "Write inside a focused editor",
                "Capture rhythm, edits, pauses, and paste events",
                "Generate a certificate for academic review",
              ]}
            />
          </Reveal>

          <Reveal delay={0.08}>
            <RoleCard
              icon={<FileSearchIcon />}
              title="For teachers"
              body="Review the writing process instead of relying only on AI detector output."
              points={[
                "Verify certificate records",
                "Review session-level evidence",
                "Use replay and metrics to support fair decisions",
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
      </div>
    </section>
  );
}

function FileSearchIcon() {
  return (
    <div className="relative h-5 w-5">
      <FileText size={20} strokeWidth={2.3} />
      <ScanLine
        size={10}
        strokeWidth={2.5}
        className="absolute -bottom-1 -right-1"
      />
    </div>
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
          <SectionEyebrow>Replay audit</SectionEyebrow>
          <h2
            className="mt-5 text-[2.55rem] font-bold leading-[1.05] tracking-tight md:text-[3.8rem]"
            style={{ color: colors.text.primary }}
          >
            Replay how the document was created.
          </h2>
          <p
            className="mt-6 text-lg leading-relaxed"
            style={{ color: colors.text.secondary }}
          >
            The replay timeline helps reviewers see writing bursts, thinking
            pauses, deletions, paste events, and revision behavior in one
            readable audit view.
          </p>

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
              <div
                key={title}
                className="flex gap-4 rounded-md border p-4"
                style={{
                  background: colors.surface[50],
                  borderColor: colors.surface[200],
                }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                  style={{ background: colors.brandSoft, color: brand.action }}
                >
                  <PlayCircle size={17} strokeWidth={2.4} />
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
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function CertificateSection() {
  return (
    <section
      className="px-6 py-32 md:px-12"
      style={{ background: colors.surface[50] }}
    >
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <SectionEyebrow>Certificate preview</SectionEyebrow>
          <h2
            className="mt-5 text-[2.55rem] font-bold leading-[1.05] tracking-tight md:text-[3.8rem]"
            style={{ color: colors.text.primary }}
          >
            A certificate built for academic review.
          </h2>
          <p
            className="mt-6 text-lg leading-relaxed"
            style={{ color: colors.text.secondary }}
          >
            Each certificate summarizes the writing session with identity-safe
            metadata, integrity hash, behavioral result, and a public
            verification route.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ["Certificate ID", <FileCheck2 size={16} strokeWidth={2.4} />],
              ["SHA-256 hash", <LockKeyhole size={16} strokeWidth={2.4} />],
              ["QR verification", <QrCode size={16} strokeWidth={2.4} />],
              ["Session duration", <Clock3 size={16} strokeWidth={2.4} />],
            ].map(([label, icon]) => (
              <div
                key={label as string}
                className="flex items-center gap-3 rounded-md border p-4"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[50],
                }}
              >
                <span style={{ color: brand.action }}>{icon}</span>
                <span
                  className="text-[14px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  {label as string}
                </span>
              </div>
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
    </section>
  );
}

const TRUST_ITEMS = [
  {
    title: "Process evidence instead of final-text guessing",
    content:
      "TypeTrace verifies how the document was produced: rhythm, hesitation, revision behavior, paste bursts, deletions, and typing consistency. This makes the evidence stronger than text-only AI detector output.",
  },
  {
    title: "Certificate records without exposing private drafts",
    content:
      "Public verification can confirm certificate status and integrity metadata without revealing the full writing content or private session data.",
  },
  {
    title: "Designed for academic review, not automatic punishment",
    content:
      "TypeTrace should support fair human review. It provides structured evidence that teachers can interpret alongside institutional academic integrity procedures.",
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
                className="text-xl tracking-tight transition-all duration-200 md:text-2xl"
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
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: open ? brand.action : "transparent",
                  color: open ? colors.text.light : colors.text.primary,
                  border: `1.5px solid ${open ? brand.action : colors.surface[200]}`,
                }}
              >
                <Plus size={13} strokeWidth={2.4} />
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
            <SectionEyebrow>Trust architecture</SectionEyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h2
              className="mt-6 text-[2.65rem] font-bold leading-[1.05] tracking-tight md:text-[3.5rem]"
              style={{ color: colors.text.primary }}
            >
              Serious academic evidence needs serious product design.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p
              className="mt-6 text-[17px] leading-relaxed"
              style={{ color: colors.text.secondary }}
            >
              TypeTrace should feel calm, defensible, and professional because
              the product deals with sensitive academic review workflows.
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

function FinalCtaSection() {
  return (
    <section
      className="relative overflow-hidden px-6 py-36 text-center"
      style={{ background: colors.text.primary }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${sa(colors.brand, "55")} 0%, transparent 48%)`,
        }}
      />

      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.035]"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="cta-dots"
            x="0"
            y="0"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cta-dots)" />
      </svg>

      <div className="relative z-10 mx-auto flex max-w-[820px] flex-col items-center gap-6">
        <Reveal>
          <div
            className="inline-flex items-center gap-2 rounded-md border px-3.5 py-1.5"
            style={{
              color: colors.text.light,
              borderColor: sa(colors.text.light, "24"),
              background: sa(colors.text.light, "08"),
            }}
          >
            <Sparkles size={14} strokeWidth={2.3} />
            <span className="text-[12px] font-semibold">
              Start building an authorship trail today
            </span>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <h2
            className="text-[2.8rem] font-bold leading-tight tracking-tight md:text-[4.4rem]"
            style={{ color: colors.text.light }}
          >
            Stop defending final text.
            <br />
            Start proving the writing process.
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <p
            className="max-w-xl text-[17px] leading-relaxed"
            style={{ color: sa(colors.text.light, "B8") }}
          >
            Create a session, write naturally, generate evidence, and share a
            certificate when your work needs to be verified.
          </p>
        </Reveal>

        <Reveal delay={0.14}>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Link
              to={ROUTES.REGISTER}
              className="flex items-center gap-2 rounded-md px-8 py-3.5 text-[15px] font-semibold transition-all hover:opacity-95 active:scale-[0.98]"
              style={{ background: colors.text.light, color: brand.action }}
            >
              Start free session
              <ArrowRight size={16} strokeWidth={2.3} />
            </Link>

            <Link
              to={ROUTES.VERIFY_LOOKUP}
              className="flex items-center gap-2 rounded-md border px-8 py-3.5 text-[15px] font-semibold transition-all"
              style={{
                color: sa(colors.text.light, "CC"),
                borderColor: sa(colors.text.light, "28"),
              }}
            >
              <ScanLine size={16} strokeWidth={2.3} />
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
    <main
      className="min-h-screen w-full overflow-x-hidden font-sans"
      style={{ background: colors.surface[50] }}
    >
      <HeroSection />
      <ProofStatsSection />
      <ProcessJourneySection />
      <ComparisonSection />
      <StudentTeacherSection />
      <ReplaySection />
      <CertificateSection />
      <TrustSection />
      <FinalCtaSection />
    </main>
  );
}
