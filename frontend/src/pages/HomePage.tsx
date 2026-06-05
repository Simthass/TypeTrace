import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  FileCheck2,
  Fingerprint,
  Keyboard,
  LockKeyhole,
  Plus,
  Radio,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";

// ─── Vercel-style grid background with corner markers ──────────────────────
function HeroGridBackground() {
  const CrossMarker = ({ x, y }: { x: string; y: string }) => (
    <g transform={`translate(${x}, ${y})`}>
      <line
        x1="-6"
        y1="0"
        x2="6"
        y2="0"
        stroke={colors.surface[200]}
        strokeWidth="1"
      />
      <line
        x1="0"
        y1="-6"
        x2="0"
        y2="6"
        stroke={colors.surface[200]}
        strokeWidth="1"
      />
    </g>
  );

  const cols = 8;
  const rows = 5;

  const colPositions = Array.from(
    { length: cols + 1 },
    (_, i) => `${(i / cols) * 100}%`,
  );

  const rowPositions = Array.from(
    { length: rows + 1 },
    (_, i) => `${(i / rows) * 100}%`,
  );

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient
            id="grid-fade"
            cx="50%"
            cy="50%"
            r="55%"
            fx="50%"
            fy="50%"
          >
            <stop offset="0%" stopColor={colors.surface[50]} stopOpacity="1" />
            <stop offset="70%" stopColor={colors.surface[50]} stopOpacity="0" />
          </radialGradient>

          <linearGradient id="grid-vertical-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>

          <mask id="grid-mask">
            <rect width="100%" height="100%" fill="url(#grid-vertical-fade)" />
          </mask>
        </defs>

        <g mask="url(#grid-mask)" opacity="0.68">
          {colPositions.map((x, i) => (
            <line
              key={`v${i}`}
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
              key={`h${i}`}
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
              <CrossMarker key={`cross-${ci}-${ri}`} x={x} y={y} />
            )),
          )}
        </g>

        <rect width="100%" height="100%" fill="url(#grid-fade)" />
      </svg>

      <div
        className="absolute top-[5%] left-[-12%] w-[55vw] h-[55vw] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 65%)",
          filter: "blur(90px)",
        }}
      />

      <div
        className="absolute top-[10%] right-[-12%] w-[50vw] h-[50vw] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(37,99,235,0.06) 0%, transparent 65%)",
          filter: "blur(95px)",
        }}
      />

      <div
        className="absolute bottom-0 left-[30%] w-[40vw] h-[30vw] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(15,23,42,0.04) 0%, transparent 70%)",
          filter: "blur(90px)",
        }}
      />
    </div>
  );
}

// ─── floating hero cards ──────────────────────────────────────────────────────
function FloatingCard({
  children,
  className,
  delay,
  yOffset = 0,
  rotate = 0,
}: {
  children: ReactNode;
  className?: string;
  delay: number;
  yOffset?: number;
  rotate?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset + 24, rotate }}
      animate={{
        opacity: 1,
        y: [yOffset, yOffset - 12, yOffset],
        rotate,
      }}
      transition={{
        opacity: { duration: 0.7, delay },
        y: {
          duration: 5 + delay,
          repeat: Infinity,
          ease: "easeInOut",
          delay: delay * 0.5,
        },
      }}
      className={`absolute hidden lg:flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border ${className ?? ""}`}
      style={{
        borderColor: colors.surface[200],
        boxShadow: "0 18px 50px -24px rgba(15,23,42,0.28)",
      }}
    >
      {children}
    </motion.div>
  );
}

// ─── scroll-reveal dashboard image ───────────────────────────────────────────
function DashboardReveal() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "center center"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [0.88, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [80, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.4], [0.3, 1]);
  const borderRadius = useTransform(scrollYProgress, [0, 1], [28, 16]);

  return (
    <div
      ref={containerRef}
      className="w-full max-w-[1240px] mx-auto px-6 md:px-12 relative z-20"
      style={{ marginTop: "-8vh" }}
    >
      <motion.div
        className="absolute top-1/2 left-1/2 w-[80%] h-[80%] rounded-full pointer-events-none"
        style={{
          opacity,
          x: "-50%",
          y: "-50%",
          background:
            "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 60%)",
          filter: "blur(90px)",
        }}
      />

      <motion.div
        style={{
          scale,
          y,
          opacity,
          borderRadius,
          borderColor: colors.surface[200],
        }}
        className="w-full overflow-hidden bg-white border shadow-[0_30px_100px_-20px_rgba(15,23,42,0.20)] relative z-10"
      >
        <div
          className="h-12 w-full flex items-center px-4 gap-4 border-b"
          style={{
            backgroundColor: colors.surface[100],
            borderColor: colors.surface[200],
          }}
        >
          <div className="flex gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: colors.surface[200] }}
            />
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: colors.surface[200] }}
            />
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: colors.surface[200] }}
            />
          </div>

          <div
            className="h-7 flex-1 max-w-[320px] mx-auto rounded-md flex items-center justify-center border"
            style={{
              backgroundColor: colors.surface[50],
              borderColor: colors.surface[200],
            }}
          >
            <span
              className="text-[11px] font-mono font-medium flex items-center gap-2"
              style={{ color: colors.text.secondary }}
            >
              <LockKeyhole size={11} strokeWidth={2.4} />
              typetrace.com
            </span>
          </div>

          <div className="w-12" />
        </div>

        <img
          src="/dashboard-mockup.png"
          alt="TypeTrace dashboard preview"
          className="w-full h-auto block"
          style={{
            minHeight: 420,
            objectFit: "cover",
            background: colors.surface[100],
          }}
          onError={(e) => {
            e.currentTarget.style.minHeight = "480px";
            e.currentTarget.style.background = colors.surface[100];
          }}
        />
      </motion.div>
    </div>
  );
}

// ─── trust accordion ─────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    title: "Zero Server-Side Storage",
    content:
      "Your essay content never leaves your browser. Only cryptographically hashed keystroke metadata is transmitted to our ML inference engine, ensuring strict GDPR compliance and total data sovereignty.",
  },
  {
    title: "SHA-256 Tamper-Proof Seals",
    content:
      "Upon completion, your biometric profile is hashed using SHA-256 and bound to your final document PDF. Any alteration to the text instantly invalidates the biometric certificate, ensuring cryptographic proof of origin.",
  },
  {
    title: "Open-Source Classifier",
    content:
      "Academic integrity requires absolute transparency. Our Random Forest classification model, including its feature extraction logic and synthetic datasets, is fully auditable by university IT departments and researchers worldwide.",
  },
];

function TrustAccordion() {
  const [active, setActive] = useState<number>(0);

  return (
    <div
      className="flex flex-col w-full border-t"
      style={{ borderColor: colors.surface[200] }}
    >
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = active === i;

        return (
          <div
            key={i}
            className="border-b cursor-pointer"
            style={{ borderColor: colors.surface[200] }}
            onClick={() => setActive(isOpen ? -1 : i)}
          >
            <div className="py-7 flex justify-between items-center gap-6">
              <h3
                className="text-xl md:text-2xl tracking-tight transition-all duration-200"
                style={{
                  color: isOpen ? colors.text.primary : colors.text.secondary,
                  fontWeight: isOpen ? 600 : 400,
                }}
              >
                {item.title}
              </h3>

              <motion.div
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ duration: 0.22 }}
                className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-colors"
                style={{
                  background: isOpen ? brand.action : "transparent",
                  color: isOpen ? colors.text.light : colors.text.primary,
                  border: `1.5px solid ${
                    isOpen ? brand.action : colors.surface[200]
                  }`,
                }}
              >
                <Plus size={13} strokeWidth={2.4} />
              </motion.div>
            </div>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <p
                    className="pb-7 text-base md:text-lg leading-relaxed max-w-2xl"
                    style={{ color: colors.text.secondary }}
                  >
                    {item.content}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ─── feature section row ──────────────────────────────────────────────────────
function FeatureRow({
  tag,
  tagColor,
  title,
  body,
  bullets,
  visual,
  flip = false,
}: {
  tag: string;
  tagColor: string;
  title: string;
  body: string;
  bullets?: string[];
  visual: ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
      <div className={`flex flex-col gap-5 ${flip ? "lg:order-2" : ""}`}>
        <span
          className="text-[11px] font-bold uppercase tracking-widest"
          style={{ color: tagColor }}
        >
          {tag}
        </span>

        <h3
          className="text-[2.4rem] md:text-[3rem] font-bold tracking-tight leading-[1.05]"
          style={{ color: colors.text.primary }}
        >
          {title}
        </h3>

        <p
          className="text-lg leading-relaxed"
          style={{ color: colors.text.secondary }}
        >
          {body}
        </p>

        {bullets && (
          <ul className="flex flex-col gap-3 mt-2">
            {bullets.map((b, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-[15px]"
                style={{ color: colors.text.secondary }}
              >
                <span
                  className="mt-0.5 shrink-0"
                  style={{ color: brand.action }}
                >
                  <Check size={15} strokeWidth={2.5} />
                </span>
                {b}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={flip ? "lg:order-1" : ""}>{visual}</div>
    </div>
  );
}

function StatCard({
  value,
  label,
  sub,
}: {
  value: string;
  label: string;
  sub?: string;
}) {
  return (
    <div
      className="flex flex-col gap-1 p-8 border-r last:border-r-0"
      style={{ borderColor: colors.surface[200] }}
    >
      <span
        className="text-[3.5rem] font-extrabold tracking-tight leading-none"
        style={{ color: brand.action }}
      >
        {value}
      </span>

      <span
        className="text-[15px] font-semibold"
        style={{ color: colors.text.primary }}
      >
        {label}
      </span>

      {sub && (
        <span className="text-[13px]" style={{ color: colors.text.secondary }}>
          {sub}
        </span>
      )}
    </div>
  );
}

function OutcomeCard({
  label,
  score,
  desc,
  accent,
  bg,
  textColor,
  icon,
}: {
  label: string;
  score: string;
  desc: string;
  accent: string;
  bg: string;
  textColor: string;
  icon: ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-4 p-7 rounded-2xl border"
      style={{
        background: bg,
        borderColor: `${accent}28`,
      }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: accent }}>{icon}</span>

        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: textColor }}
        >
          {label}
        </span>
      </div>

      <span
        className="text-[3.2rem] font-extrabold leading-none"
        style={{ color: accent }}
      >
        {score}
      </span>

      <p
        className="text-[13px] leading-relaxed border-t pt-4"
        style={{
          color: textColor,
          borderColor: `${accent}22`,
        }}
      >
        {desc}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <main
      className="w-full min-h-screen overflow-x-hidden font-sans"
      style={{ background: colors.surface[50] }}
    >
      {/* Hero */}
      <section className="relative min-h-[95vh] flex flex-col items-center justify-start text-center overflow-hidden pt-12 pb-16">
        <HeroGridBackground />

        <FloatingCard
          className="top-[15%] left-[2%] xl:left-[6%] 2xl:left-[7%]"
          delay={0.3}
          yOffset={0}
          rotate={-3}
        >
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: brand.humanBg,
              border: `1px solid ${brand.humanAccent}30`,
              color: brand.humanAccent,
            }}
          >
            <CheckCircle2 size={17} strokeWidth={2.5} />
          </div>

          <div className="flex flex-col items-start gap-0.5">
            <span
              className="text-[10px] font-bold uppercase tracking-widest leading-none"
              style={{ color: colors.text.secondary }}
            >
              Authorship Status
            </span>

            <span
              className="text-[15px] font-bold leading-none"
              style={{ color: colors.text.primary }}
            >
              99.8% Human
            </span>
          </div>
        </FloatingCard>

        <FloatingCard
          className="top-[12%] right-[2%] xl:right-[6%] 2xl:right-[10%]"
          delay={0.5}
          yOffset={10}
          rotate={3}
        >
          <div className="flex flex-col gap-2 w-[140px]">
            <div className="flex justify-between items-center">
              <span
                className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5"
                style={{ color: colors.text.secondary }}
              >
                <BarChart3 size={12} strokeWidth={2.3} />
                Avg. IKI
              </span>

              <span
                className="text-[12px] font-bold font-mono"
                style={{ color: colors.text.primary }}
              >
                284ms
              </span>
            </div>

            <div className="flex items-end gap-[3px] h-7">
              {[35, 55, 28, 72, 48, 85, 42, 68, 50, 78].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: `${h}%`,
                    background:
                      i > 3 && i < 7 ? brand.action : colors.surface[200],
                  }}
                />
              ))}
            </div>
          </div>
        </FloatingCard>

        <FloatingCard
          className="top-[60%] left-[2%] xl:left-[4%] 2xl:left-[8%]"
          delay={0.8}
          yOffset={5}
          rotate={2}
        >
          <div
            className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
            style={{
              background: "#EFF6FF",
              color: brand.action,
            }}
          >
            <LockKeyhole size={17} strokeWidth={2.2} />
          </div>

          <div className="flex flex-col items-start gap-0.5">
            <span
              className="text-[13px] font-semibold leading-none"
              style={{ color: colors.text.primary }}
            >
              Certificate Sealed
            </span>

            <span
              className="text-[10px] font-mono leading-none"
              style={{ color: colors.text.secondary }}
            >
              SHA-256 / Verified
            </span>
          </div>
        </FloatingCard>

        <FloatingCard
          className="top-[55%] right-[2%] xl:right-[5%] 2xl:right-[8%]"
          delay={1.0}
          yOffset={-8}
          rotate={-2}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="h-9 w-9 rounded-md flex items-center justify-center"
              style={{
                background: brand.humanBg,
                color: brand.humanAccent,
                border: `1px solid ${brand.humanAccent}30`,
              }}
            >
              <Radio size={16} strokeWidth={2.2} />
            </div>

            <div className="flex flex-col items-start gap-0.5">
              <span
                className="text-[10px] font-bold uppercase tracking-widest leading-none"
                style={{ color: colors.text.secondary }}
              >
                Live Session
              </span>

              <span
                className="text-[15px] font-bold font-mono leading-none"
                style={{ color: colors.text.primary }}
              >
                WPM: 64
              </span>
            </div>
          </div>
        </FloatingCard>

        <FloatingCard
          className="top-[80%] left-[8%] xl:left-[12%]"
          delay={1.2}
          yOffset={0}
          rotate={2}
        >
          <div className="flex flex-col gap-1 pr-2">
            <span
              className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5"
              style={{ color: colors.text.secondary }}
            >
              <Activity size={12} strokeWidth={2.3} />
              ML Result
            </span>

            <div className="flex items-center gap-2">
              <CheckCircle2
                size={13}
                strokeWidth={2.5}
                color={brand.humanAccent}
              />

              <span
                className="text-[13px] font-bold"
                style={{ color: brand.humanAccent }}
              >
                HUMAN CONFIRMED
              </span>
            </div>

            <span
              className="text-[11px]"
              style={{ color: colors.text.secondary }}
            >
              96.3% confidence
            </span>
          </div>
        </FloatingCard>

        <FloatingCard
          className="top-[78%] right-[6%] xl:right-[10%]"
          delay={1.4}
          yOffset={6}
          rotate={-1}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-md flex items-center justify-center"
              style={{
                background: "#EFF6FF",
                color: brand.action,
                border: "1px solid #BFDBFE",
              }}
            >
              <Keyboard size={16} strokeWidth={2.2} />
            </div>

            <div className="flex flex-col gap-1 pr-2">
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: colors.text.secondary }}
              >
                Captured
              </span>

              <span
                className="text-[22px] font-extrabold leading-none"
                style={{ color: brand.action }}
              >
                3,291
              </span>

              <span
                className="text-[11px]"
                style={{ color: colors.text.secondary }}
              >
                keystroke events
              </span>
            </div>
          </div>
        </FloatingCard>

        <div className="relative z-10 max-w-[900px] px-6 flex flex-col items-center mt-16 lg:mt-24">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.06 }}
            className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border"
            style={{
              background: "#EFF6FF",
              borderColor: "#BFDBFE",
              color: brand.action,
            }}
          >
            <Fingerprint size={14} strokeWidth={2.3} />
            <span className="text-[12px] font-semibold">
              Human authorship verification for academic writing
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.12 }}
            className="text-[4rem] sm:text-[5.5rem] lg:text-[5.5rem] font-bold tracking-tighter leading-[0.96] mb-8"
            style={{ color: colors.text.primary }}
          >
            Prove your humanity.
            <br />
            <span style={{ color: brand.action }}>Line by line.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.22 }}
            className="text-lg md:text-xl max-w-2xl leading-relaxed mb-12 text-center"
            style={{ color: colors.text.secondary }}
          >
            The biometric workspace that cryptographically seals your unique
            typing rhythm into every essay. Protect yourself from false AI
            accusations with mathematical proof.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-3 mb-8"
          >
            <Link
              to={ROUTES.REGISTER}
              className="px-8 py-3.5 rounded-md font-semibold text-[15px] text-white transition-all duration-150 hover:opacity-95 active:scale-[0.98] flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                background: brand.action,
                boxShadow: "0 16px 40px -18px rgba(37,99,235,0.65)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = brand.actionHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = brand.action;
              }}
            >
              Get Started Free <ArrowRight size={16} strokeWidth={2.3} />
            </Link>

            <Link
              to={ROUTES.HOW_IT_WORKS}
              className="px-8 py-3.5 rounded-md font-semibold text-[15px] transition-all duration-150 border flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                color: colors.text.primary,
                borderColor: colors.surface[200],
                background: colors.surface[50],
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.surface[100];
                e.currentTarget.style.borderColor = "#BFDBFE";
                e.currentTarget.style.color = brand.action;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.surface[50];
                e.currentTarget.style.borderColor = colors.surface[200];
                e.currentTarget.style.color = colors.text.primary;
              }}
            >
              Read Documentation
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex flex-wrap justify-center gap-x-6 gap-y-2"
          >
            {[
              "No content ever stored server-side",
              "GDPR compliant by design",
              "Free for students",
            ].map((t) => (
              <span
                key={t}
                className="flex items-center gap-1.5 text-[12.5px]"
                style={{ color: colors.text.secondary }}
              >
                <span style={{ color: brand.action }}>
                  <Check size={14} strokeWidth={2.5} />
                </span>
                {t}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      <DashboardReveal />

      {/* Stats */}
      <section
        className="border-y mt-24"
        style={{
          borderColor: colors.surface[200],
          background: colors.surface[50],
        }}
      >
        <div className="max-w-[1200px] mx-auto grid grid-cols-2 lg:grid-cols-4">
          <StatCard
            value="10k+"
            label="Sessions Analysed"
            sub="Across pilot cohorts"
          />
          <StatCard
            value="96.3%"
            label="Classification Accuracy"
            sub="Random Forest model"
          />
          <StatCard
            value="<5%"
            label="False Positive Target"
            sub="vs 26% industry avg"
          />
          <StatCard
            value="4"
            label="Universities Piloting"
            sub="UK higher education"
          />
        </div>
      </section>

      {/* Problem */}
      <section
        className="py-32 px-6 md:px-12 border-b"
        style={{
          borderColor: colors.surface[200],
          background: colors.surface[100],
        }}
      >
        <div className="max-w-[1100px] mx-auto flex flex-col items-center text-center gap-8">
          <span
            className="text-[11px] font-bold uppercase tracking-widest"
            style={{ color: brand.action }}
          >
            The Problem
          </span>

          <h2
            className="text-[2.5rem] md:text-[4rem] font-bold tracking-tight leading-[1.05]"
            style={{ color: colors.text.primary }}
          >
            Current AI detectors analyze the{" "}
            <em className="not-italic" style={{ color: colors.text.secondary }}>
              final text.
            </em>
            <br />
            That is a fundamental architectural flaw.
          </h2>

          <p
            className="text-lg md:text-xl max-w-3xl leading-relaxed"
            style={{ color: colors.text.secondary }}
          >
            Standard AI detectors produce up to a{" "}
            <strong style={{ color: brand.aiAccent }}>
              35% false-positive rate
            </strong>{" "}
            for ESL students and formal writers. Institutions are penalizing
            authentic human effort by evaluating <em>what</em> was written
            rather than <em>how</em> it was written. TypeTrace solves this at
            the source.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-[800px] mt-8">
            {[
              { name: "GPTZero (ESL)", rate: 35, color: brand.aiAccent },
              { name: "Turnitin AI Detector", rate: 26, color: brand.aiAccent },
              { name: "Copyleaks", rate: 19, color: brand.suspiciousAccent },
              { name: "TypeTrace Target", rate: 4.2, color: brand.humanAccent },
            ].map(({ name, rate, color }) => (
              <div
                key={name}
                className="flex flex-col gap-2.5 p-5 rounded-2xl text-left border bg-white"
                style={{
                  borderColor: colors.surface[200],
                  boxShadow: "0 18px 44px -34px rgba(15,23,42,0.35)",
                }}
              >
                <div className="flex justify-between items-center">
                  <span
                    className="text-[13px] font-medium"
                    style={{ color: colors.text.primary }}
                  >
                    {name}
                  </span>

                  <span className="text-[15px] font-bold" style={{ color }}>
                    {rate}%
                  </span>
                </div>

                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: colors.surface[200] }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${(rate / 35) * 100}%` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: color }}
                  />
                </div>

                <span
                  className="text-[11px]"
                  style={{ color: colors.text.secondary }}
                >
                  False positive rate
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deep dive features */}
      <section className="py-32 px-6 md:px-12 max-w-[1300px] mx-auto flex flex-col gap-32">
        <FeatureRow
          tag="Phase 01 - Data Ingestion"
          tagColor={brand.action}
          title="Sub-millisecond behavioral capture."
          body="TypeTrace operates at the raw DOM level, intercepting every keydown and keyup event with exact timestamp precision. We calculate Inter-Key Intervals and dwell times to build a time-series dataset of your unique typing rhythm - completely invisible to you while you write."
          bullets={[
            "Zero UI latency - built on React 18 Virtual DOM optimisation",
            "Captures backspaces, pauses, cursor jumps, and editing patterns",
            "Browser-agnostic event normalisation for consistent data",
          ]}
          visual={
            <div
              className="h-[380px] flex flex-col justify-center gap-5 rounded-3xl border p-10 bg-white overflow-hidden"
              style={{
                borderColor: colors.surface[200],
                boxShadow: "0 24px 70px -42px rgba(15,23,42,0.32)",
              }}
            >
              <div
                className="text-[11px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2"
                style={{ color: brand.action }}
              >
                <Keyboard size={14} strokeWidth={2.3} />
                Live Keystroke Event Stream
              </div>

              {[
                { key: "T", iki: "-", dwell: "82ms", idx: 0 },
                { key: "h", iki: "142ms", dwell: "71ms", idx: 1 },
                { key: "e", iki: "198ms", dwell: "68ms", idx: 2 },
                {
                  key: <Trash2 size={14} strokeWidth={2.3} />,
                  iki: "312ms",
                  dwell: "94ms",
                  idx: 3,
                },
                { key: "i", iki: "245ms", dwell: "77ms", idx: 4 },
              ].map((row) => (
                <motion.div
                  key={row.idx}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: row.idx * 0.1, duration: 0.4 }}
                  className="flex items-center gap-4 py-2.5 px-4 rounded-md border"
                  style={{
                    borderColor: colors.surface[200],
                    background: colors.surface[100],
                  }}
                >
                  <span
                    className="h-8 w-8 rounded-lg flex items-center justify-center font-bold font-mono text-[14px] shrink-0"
                    style={{
                      background: "#EFF6FF",
                      color: brand.action,
                    }}
                  >
                    {row.key}
                  </span>

                  <div className="flex-1 flex gap-4">
                    <div>
                      <div
                        className="text-[9px] font-bold uppercase tracking-wider"
                        style={{ color: colors.text.secondary }}
                      >
                        IKI
                      </div>

                      <div
                        className="text-[13px] font-bold font-mono"
                        style={{ color: colors.text.primary }}
                      >
                        {row.iki}
                      </div>
                    </div>

                    <div>
                      <div
                        className="text-[9px] font-bold uppercase tracking-wider"
                        style={{ color: colors.text.secondary }}
                      >
                        Dwell
                      </div>

                      <div
                        className="text-[13px] font-bold font-mono"
                        style={{ color: colors.text.primary }}
                      >
                        {row.dwell}
                      </div>
                    </div>
                  </div>

                  <span style={{ color: brand.humanAccent }}>
                    <CheckCircle2 size={14} strokeWidth={2.3} />
                  </span>
                </motion.div>
              ))}
            </div>
          }
        />

        <FeatureRow
          flip
          tag="Phase 02 - Intelligence"
          tagColor={brand.action}
          title="Random Forest Classification."
          body="Raw keystrokes become a statistical feature vector: mean IKI, standard deviation, deletion frequency, paste event flags, and burst typing ratios. These features are fed into our serialised scikit-learn Random Forest model, trained on authentic student essays and simulated AI paste attacks."
          bullets={[
            "96.3% classification accuracy on held-out test set",
            "SMOTE oversampling ensures balanced class training",
            "Inference completes in under 2 seconds on session end",
          ]}
          visual={
            <div
              className="h-[380px] flex flex-col items-center justify-center gap-6 rounded-3xl border p-10 bg-white"
              style={{
                borderColor: colors.surface[200],
                boxShadow: "0 24px 70px -42px rgba(15,23,42,0.32)",
              }}
            >
              <div className="w-full flex flex-col gap-3">
                <div
                  className="text-[11px] font-bold uppercase tracking-widest mb-2 flex items-center gap-2"
                  style={{ color: brand.action }}
                >
                  <BarChart3 size={14} strokeWidth={2.3} />
                  Feature Importance
                </div>

                {[
                  { label: "IKI Variance", value: 38 },
                  { label: "Paste Detection", value: 26 },
                  { label: "Pause Frequency", value: 18 },
                  { label: "IKI Mean", value: 12 },
                  { label: "Deletion Rate", value: 6 },
                ].map(({ label, value }, i) => (
                  <div key={label} className="flex flex-col gap-1">
                    <div className="flex justify-between text-[12px]">
                      <span
                        style={{
                          color: colors.text.primary,
                          fontWeight: 500,
                        }}
                      >
                        {label}
                      </span>

                      <span
                        style={{
                          color: colors.text.secondary,
                          fontWeight: 600,
                        }}
                      >
                        {value}%
                      </span>
                    </div>

                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ background: colors.surface[100] }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${value}%` }}
                        transition={{
                          duration: 1,
                          delay: i * 0.1,
                          ease: "easeOut",
                        }}
                        className="h-full rounded-full"
                        style={{
                          background:
                            i === 0 ? brand.action : colors.surface[200],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          }
        />

        <FeatureRow
          tag="Phase 03 - Certification"
          tagColor={brand.action}
          title="Cryptographic sealing."
          body="Once classification completes, the entire session footprint - keystroke timing array, statistical features, and ML result - is hashed using SHA-256. This hash is embedded in a downloadable PDF certificate that university instructors can independently verify via our public endpoint."
          bullets={[
            "SHA-256 hash bound to raw keystroke JSON payload",
            "Any tampering immediately invalidates the certificate",
            "QR code links to live verification endpoint",
          ]}
          visual={
            <div
              className="h-[380px] flex items-center justify-center rounded-3xl border p-10 bg-white"
              style={{
                borderColor: colors.surface[200],
                boxShadow: "0 24px 70px -42px rgba(15,23,42,0.32)",
              }}
            >
              <div
                className="w-full max-w-[320px] rounded-2xl border overflow-hidden"
                style={{ borderColor: colors.surface[200] }}
              >
                <div
                  className="px-5 py-3 border-b flex justify-between items-center"
                  style={{
                    background: colors.surface[100],
                    borderColor: colors.surface[200],
                  }}
                >
                  <span
                    className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-2"
                    style={{ color: colors.text.secondary }}
                  >
                    <FileCheck2 size={13} strokeWidth={2.2} />
                    Certificate of Authorship
                  </span>

                  <span
                    className="flex items-center gap-1.5 text-[10px] font-bold"
                    style={{ color: brand.humanAccent }}
                  >
                    <CheckCircle2 size={12} strokeWidth={2.4} />
                    VALID
                  </span>
                </div>

                <div className="p-5 flex flex-col gap-3 bg-white">
                  {[
                    { label: "Student", value: "Simthass MYM" },
                    { label: "Document", value: "Climate Essay" },
                    { label: "Classification", value: "HUMAN / 96.3%" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between">
                      <span
                        className="text-[11px]"
                        style={{ color: colors.text.secondary }}
                      >
                        {label}
                      </span>

                      <span
                        className="text-[11px] font-semibold"
                        style={{ color: colors.text.primary }}
                      >
                        {value}
                      </span>
                    </div>
                  ))}

                  <div
                    className="mt-2 p-2.5 rounded-md font-mono text-[9px] break-all flex items-start gap-2"
                    style={{
                      background: "#EFF6FF",
                      color: brand.action,
                    }}
                  >
                    <LockKeyhole size={12} strokeWidth={2.3} />
                    <span>SHA-256: a3f5b8c2d94e1f07...</span>
                  </div>
                </div>
              </div>
            </div>
          }
        />
      </section>

      {/* Classification outcomes */}
      <section
        className="py-32 px-6 md:px-12 border-t"
        style={{
          borderColor: colors.surface[200],
          background: colors.surface[100],
        }}
      >
        <div className="max-w-[1200px] mx-auto">
          <div className="flex flex-col items-center text-center gap-4 mb-16">
            <span
              className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: brand.action }}
            >
              Results
            </span>

            <h2
              className="text-[2.5rem] md:text-[3.5rem] font-bold tracking-tight"
              style={{ color: colors.text.primary }}
            >
              Three clear verdicts
            </h2>

            <p
              className="text-lg max-w-xl"
              style={{ color: colors.text.secondary }}
            >
              Every session ends with one of three outcomes - immediately
              understood by students and educators.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <OutcomeCard
              label="Human"
              score="96.3%"
              desc="Consistent rhythm, natural IKI variance, organic editing patterns. No paste events detected."
              accent={brand.humanAccent}
              bg={brand.humanBg}
              textColor={brand.humanText}
              icon={<CheckCircle2 size={13} strokeWidth={2.5} />}
            />

            <OutcomeCard
              label="Suspicious"
              score="67.2%"
              desc="Irregular bursts and paste events flagged. Manual review by instructor recommended."
              accent={brand.suspiciousAccent}
              bg={brand.suspiciousBg}
              textColor={brand.suspiciousText}
              icon={<Activity size={13} strokeWidth={2.5} />}
            />

            <OutcomeCard
              label="AI-Generated"
              score="94.8%"
              desc="Entire content pasted at once with near-zero natural keystroke variation. AI strongly detected."
              accent={brand.aiAccent}
              bg={brand.aiBg}
              textColor={brand.aiText}
              icon={<ShieldCheck size={13} strokeWidth={2.5} />}
            />
          </div>
        </div>
      </section>

      {/* Trust accordion */}
      <section
        className="py-32 px-6 md:px-12 border-t"
        style={{
          borderColor: colors.surface[200],
          background: colors.surface[50],
        }}
      >
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          <div className="lg:sticky lg:top-32">
            <span
              className="text-[11px] font-bold uppercase tracking-widest block mb-6"
              style={{ color: brand.action }}
            >
              Trust & Privacy
            </span>

            <h2
              className="text-[2.8rem] md:text-[3.5rem] font-bold tracking-tight leading-[1.05] mb-6"
              style={{ color: colors.text.primary }}
            >
              Engineered for absolute data sovereignty.
            </h2>

            <p
              className="text-lg leading-relaxed"
              style={{ color: colors.text.secondary }}
            >
              Institutional trust requires architectural transparency. TypeTrace
              was built with privacy-first paradigms, ensuring biometric data is
              never monetized, stored unnecessarily, or mishandled.
            </p>
          </div>

          <TrustAccordion />
        </div>
      </section>

      {/* Final CTA */}
      <section
        className="py-32 px-6 text-center relative overflow-hidden"
        style={{ background: colors.text.primary }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 50% 0%, rgba(37,99,235,0.34) 0%, transparent 48%)",
          }}
        />

        <div className="max-w-[800px] mx-auto flex flex-col items-center gap-6 relative z-10">
          <h2
            className="text-[2.8rem] md:text-[4.5rem] font-bold tracking-tight leading-tight"
            style={{ color: colors.text.light }}
          >
            Stop worrying about false accusations.
          </h2>

          <p
            className="text-lg md:text-xl max-w-xl leading-relaxed"
            style={{ color: "rgba(255,255,255,0.68)" }}
          >
            Create your student account today and generate cryptographic proof
            of your hard work in minutes. Completely free.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Link
              to={ROUTES.REGISTER}
              className="px-8 py-3.5 rounded-md font-semibold text-[15px] transition-all hover:opacity-95 active:scale-[0.98] flex items-center gap-2"
              style={{
                background: colors.text.light,
                color: brand.action,
              }}
            >
              Start Free Session <ArrowRight size={16} strokeWidth={2.3} />
            </Link>

            <Link
              to={ROUTES.HOW_IT_WORKS}
              className="px-8 py-3.5 rounded-md font-semibold text-[15px] transition-all flex items-center gap-2 border"
              style={{
                color: "rgba(255,255,255,0.75)",
                borderColor: "rgba(255,255,255,0.2)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.5)";
                e.currentTarget.style.color = colors.text.light;
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                e.currentTarget.style.color = "rgba(255,255,255,0.75)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              Read the Docs
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
