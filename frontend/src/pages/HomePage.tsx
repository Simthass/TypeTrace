import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";

// ─── arrow icon used in buttons ───────────────────────────────────────────────
function ArrowRight() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path
        d="M3 7.5h9M8 3.5l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─── Vercel-style grid background with + corner markers ──────────────────────
// this took me ages to get the cell sizes right so it doesnt look weird on diff screen sizes
function HeroGridBackground() {
  // the + crosshair marker at each intersection point
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

  // grid config — 8 columns, rows fill the viewport height
  // using percentages so it stays responsive
  const cols = 8;
  const rows = 5;

  // colPositions as percentages of the SVG width
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
          {/* fade out towards centre so the grid doesnt compete with the text */}
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

          {/* fade mask that makes the top edge solid and fades to nothing at bottom */}
          <linearGradient id="grid-vertical-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>

          <mask id="grid-mask">
            <rect width="100%" height="100%" fill="url(#grid-vertical-fade)" />
          </mask>
        </defs>

        {/* vertical grid lines */}
        <g mask="url(#grid-mask)" opacity="0.6">
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

          {/* horizontal grid lines */}
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

          {/* + crosshair markers at every intersection point */}
          {colPositions.map((x, ci) =>
            rowPositions.map((y, ri) => (
              <CrossMarker key={`cross-${ci}-${ri}`} x={x} y={y} />
            )),
          )}
        </g>

        {/* radial fade overlay — punches a soft hole in the centre so grid
            pulls back from the headline and doesnt distract from it */}
        <rect width="100%" height="100%" fill="url(#grid-fade)" />
      </svg>

      {/* the original soft black gradient blobs still sit on top of the grid,
          they add depth and prevent it from looking flat like a spreadsheet */}
      <div
        className="absolute top-[5%] left-[-12%] w-[55vw] h-[55vw] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(0,0,0,0.05) 0%, transparent 65%)",
          filter: "blur(80px)",
        }}
      />
      <div
        className="absolute top-[10%] right-[-12%] w-[50vw] h-[50vw] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(0,0,0,0.04) 0%, transparent 65%)",
          filter: "blur(90px)",
        }}
      />
      <div
        className="absolute bottom-0 left-[30%] w-[40vw] h-[30vw] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(0,0,0,0.03) 0%, transparent 70%)",
          filter: "blur(80px)",
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
  children: React.ReactNode;
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
        boxShadow: "0 4px 24px -6px rgba(0,0,0,0.1)",
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
        style={{ opacity }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] rounded-full pointer-events-none"
        // @ts-ignore — framer-motion style prop accepts these fine
        style={{
          background: `radial-gradient(circle, ${colors.surface[200]} 0%, transparent 60%)`,
          filter: "blur(80px)",
          opacity,
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
        className="w-full overflow-hidden bg-white border shadow-[0_30px_100px_-20px_rgba(0,0,0,0.15)] relative z-10"
      >
        <div
          className="h-12 w-full flex items-center px-4 gap-4 border-b"
          style={{
            backgroundColor: colors.surface[50],
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
              backgroundColor: "#fff",
              borderColor: colors.surface[200],
            }}
          >
            <span
              className="text-[11px] font-mono font-medium flex items-center gap-2"
              style={{ color: colors.text.secondary }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
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
            (e.currentTarget as HTMLImageElement).style.minHeight = "480px";
            (e.currentTarget as HTMLImageElement).style.background =
              colors.surface[100];
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
      "Your essay content never leaves your browser. Only cryptographically hashed keystroke metadata (Inter-Key Intervals) is transmitted to our ML inference engine, ensuring strict GDPR compliance and total data sovereignty.",
  },
  {
    title: "SHA-256 Tamper-Proof Seals",
    content:
      "Upon completion, your biometric profile is hashed using SHA-256 and bound to your final document PDF. Any alteration to the text instantly invalidates the biometric certificate, ensuring cryptographic proof of origin.",
  },
  {
    title: "Open-Source Classifier",
    content:
      "Academic integrity requires absolute transparency. Our Random Forest classification model, including its feature extraction logic and synthetic datasets (SMOTE), is fully auditable by university IT departments and researchers worldwide.",
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
                  background: isOpen ? colors.text.primary : "transparent",
                  color: isOpen ? "#fff" : colors.text.primary,
                  border: `1.5px solid ${isOpen ? colors.text.primary : colors.surface[200]}`,
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
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
  visual: React.ReactNode;
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
                  style={{ color: colors.text.primary }}
                >
                  <CheckIcon />
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
        style={{ color: colors.text.primary }}
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
}: {
  label: string;
  score: string;
  desc: string;
  accent: string;
  bg: string;
  textColor: string;
}) {
  return (
    <div
      className="flex flex-col gap-4 p-7 rounded-2xl border"
      style={{ background: bg, borderColor: `${accent}28` }}
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
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
        style={{ color: textColor, borderColor: `${accent}22` }}
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
      {/* ══════════════════════════════════════════════════════
          1. HERO — Vercel grid BG + floating cards
      ══════════════════════════════════════════════════════ */}
      <section className="relative min-h-[95vh] flex flex-col items-center justify-start text-center overflow-hidden pt-12 pb-16">
        {/* ── NEW: Vercel-style grid background with + markers ── */}
        <HeroGridBackground />

        {/* ── Floating data cards ── */}
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
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={brand.humanAccent}
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
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
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: colors.text.secondary }}
              >
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
                      i > 3 && i < 7
                        ? colors.text.primary
                        : colors.surface[200],
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
            style={{ background: colors.surface[100] }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.text.primary}
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <rect x="5" y="10" width="14" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
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
              SHA-256 · Verified
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
            <div className="relative h-2.5 w-2.5">
              <span
                className="animate-ping absolute h-full w-full rounded-full opacity-60"
                style={{ background: brand.humanAccent }}
              />
              <span
                className="relative block h-2.5 w-2.5 rounded-full"
                style={{ background: brand.humanAccent }}
              />
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
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: colors.text.secondary }}
            >
              ML Result
            </span>
            <div className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: brand.humanAccent }}
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
          <div className="flex flex-col gap-1 pr-2">
            <span
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: colors.text.secondary }}
            >
              Captured
            </span>
            <span
              className="text-[22px] font-extrabold leading-none"
              style={{ color: colors.text.primary }}
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
        </FloatingCard>

        {/* ── Hero copy ── */}
        <div className="relative z-10 max-w-[900px] px-6 flex flex-col items-center mt-16 lg:mt-24">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.12 }}
            className="text-[4rem] sm:text-[5.5rem] lg:text-[5.5rem] font-bold tracking-tighter leading-[0.96] mb-8"
            style={{ color: colors.text.primary }}
          >
            Prove your humanity.
            <br />
            <span style={{ color: colors.text.secondary }}>Line by line.</span>
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
              className="px-8 py-3.5 rounded-md font-semibold text-[15px] text-white transition-all duration-150 hover:opacity-90 active:scale-[0.98] flex items-center gap-2"
              style={{
                background: colors.text.primary,
                boxShadow: "0 4px 20px -6px rgba(0,0,0,0.4)",
              }}
            >
              Get Started Free <ArrowRight />
            </Link>
            <Link
              to={ROUTES.HOW_IT_WORKS}
              className="px-8 py-3.5 rounded-md font-semibold text-[15px] transition-all duration-150 border hover:bg-surface-100 flex items-center gap-2"
              style={{
                color: colors.text.primary,
                borderColor: colors.surface[200],
                background: "#fff",
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
                <CheckIcon />
                {t}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          2. SCROLL-REVEAL DASHBOARD IMAGE
      ══════════════════════════════════════════════════════ */}
      <DashboardReveal />

      {/* ══════════════════════════════════════════════════════
          3. STATS NUMBERS BAR
      ══════════════════════════════════════════════════════ */}
      <section
        className="border-y mt-24"
        style={{ borderColor: colors.surface[200], background: "#fff" }}
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

      {/* ══════════════════════════════════════════════════════
          4. THE PROBLEM
      ══════════════════════════════════════════════════════ */}
      <section
        className="py-32 px-6 md:px-12 border-b"
        style={{ borderColor: colors.surface[200] }}
      >
        <div className="max-w-[1100px] mx-auto flex flex-col items-center text-center gap-8">
          <span
            className="text-[11px] font-bold uppercase tracking-widest"
            style={{ color: colors.text.secondary }}
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
                style={{ borderColor: colors.surface[200] }}
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

      {/* ══════════════════════════════════════════════════════
          5. DEEP DIVE FEATURES
      ══════════════════════════════════════════════════════ */}
      <section className="py-32 px-6 md:px-12 max-w-[1300px] mx-auto flex flex-col gap-32">
        <FeatureRow
          tag="Phase 01 — Data Ingestion"
          tagColor={brand.action}
          title="Sub-millisecond behavioral capture."
          body="TypeTrace operates at the raw DOM level, intercepting every keydown and keyup event with exact timestamp precision. We calculate Inter-Key Intervals and dwell times to build a time-series dataset of your unique typing rhythm — completely invisible to you while you write."
          bullets={[
            "Zero UI latency — built on React 18 Virtual DOM optimisation",
            "Captures backspaces, pauses, cursor jumps, and editing patterns",
            "Browser-agnostic event normalisation for consistent data",
          ]}
          visual={
            <div
              className="h-[380px] flex flex-col justify-center gap-5 rounded-3xl border p-10 bg-white overflow-hidden"
              style={{ borderColor: colors.surface[200] }}
            >
              <div
                className="text-[11px] font-bold uppercase tracking-widest mb-2"
                style={{ color: colors.text.secondary }}
              >
                Live Keystroke Event Stream
              </div>
              {[
                { key: "T", iki: "—", dwell: "82ms", idx: 0 },
                { key: "h", iki: "142ms", dwell: "71ms", idx: 1 },
                { key: "e", iki: "198ms", dwell: "68ms", idx: 2 },
                { key: "⌫", iki: "312ms", dwell: "94ms", idx: 3 },
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
                    background: colors.surface[50],
                  }}
                >
                  <span
                    className="h-8 w-8 rounded-lg flex items-center justify-center font-bold font-mono text-[14px] shrink-0"
                    style={{
                      background: colors.surface[200],
                      color: colors.text.primary,
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
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ background: brand.humanAccent }}
                  />
                </motion.div>
              ))}
            </div>
          }
        />

        <FeatureRow
          flip
          tag="Phase 02 — Intelligence"
          tagColor={brand.humanAccent}
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
              style={{ borderColor: colors.surface[200] }}
            >
              <div className="w-full flex flex-col gap-3">
                <div
                  className="text-[11px] font-bold uppercase tracking-widest mb-2"
                  style={{ color: colors.text.secondary }}
                >
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
                        style={{ color: colors.text.primary, fontWeight: 500 }}
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
                            i === 0 ? colors.text.primary : colors.surface[200],
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
          tag="Phase 03 — Certification"
          tagColor={brand.suspiciousAccent}
          title="Cryptographic sealing."
          body="Once classification completes, the entire session footprint — keystroke timing array, statistical features, and ML result — is hashed using SHA-256. This hash is embedded in a downloadable PDF certificate that university instructors can independently verify via our public endpoint."
          bullets={[
            "SHA-256 hash bound to raw keystroke JSON payload",
            "Any tampering immediately invalidates the certificate",
            "QR code links to live verification endpoint",
          ]}
          visual={
            <div
              className="h-[380px] flex items-center justify-center rounded-3xl border p-10 bg-white"
              style={{ borderColor: colors.surface[200] }}
            >
              <div
                className="w-full max-w-[320px] rounded-2xl border overflow-hidden"
                style={{ borderColor: colors.surface[200] }}
              >
                <div
                  className="px-5 py-3 border-b flex justify-between items-center"
                  style={{
                    background: colors.surface[50],
                    borderColor: colors.surface[200],
                  }}
                >
                  <span
                    className="text-[11px] font-bold uppercase tracking-widest"
                    style={{ color: colors.text.secondary }}
                  >
                    Certificate of Authorship
                  </span>
                  <span
                    className="flex items-center gap-1.5 text-[10px] font-bold"
                    style={{ color: brand.humanAccent }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: brand.humanAccent }}
                    />
                    VALID
                  </span>
                </div>
                <div className="p-5 flex flex-col gap-3 bg-white">
                  {[
                    { label: "Student", value: "Simthass MYM" },
                    { label: "Document", value: "Climate Essay" },
                    { label: "Classification", value: "HUMAN · 96.3%" },
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
                    className="mt-2 p-2.5 rounded-md font-mono text-[9px] break-all"
                    style={{
                      background: colors.surface[50],
                      color: colors.text.secondary,
                    }}
                  >
                    SHA-256: a3f5b8c2d94e1f07…
                  </div>
                </div>
              </div>
            </div>
          }
        />
      </section>

      {/* ══════════════════════════════════════════════════════
          6. CLASSIFICATION OUTCOMES
      ══════════════════════════════════════════════════════ */}
      <section
        className="py-32 px-6 md:px-12 border-t"
        style={{ borderColor: colors.surface[200] }}
      >
        <div className="max-w-[1200px] mx-auto">
          <div className="flex flex-col items-center text-center gap-4 mb-16">
            <span
              className="text-[11px] font-bold uppercase tracking-widest"
              style={{ color: colors.text.secondary }}
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
              Every session ends with one of three outcomes — immediately
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
            />
            <OutcomeCard
              label="Suspicious"
              score="67.2%"
              desc="Irregular bursts and paste events flagged. Manual review by instructor recommended."
              accent={brand.suspiciousAccent}
              bg={brand.suspiciousBg}
              textColor={brand.suspiciousText}
            />
            <OutcomeCard
              label="AI-Generated"
              score="94.8%"
              desc="Entire content pasted at once with near-zero natural keystroke variation. AI strongly detected."
              accent={brand.aiAccent}
              bg={brand.aiBg}
              textColor={brand.aiText}
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          7. TRUST ACCORDION
      ══════════════════════════════════════════════════════ */}
      <section
        className="py-32 px-6 md:px-12 border-t"
        style={{ borderColor: colors.surface[200] }}
      >
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          <div className="lg:sticky lg:top-32">
            <span
              className="text-[11px] font-bold uppercase tracking-widest block mb-6"
              style={{ color: colors.text.secondary }}
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

      {/* ══════════════════════════════════════════════════════
          8. FINAL CTA
      ══════════════════════════════════════════════════════ */}
      <section
        className="py-32 px-6 text-center"
        style={{ background: colors.text.primary }}
      >
        <div className="max-w-[800px] mx-auto flex flex-col items-center gap-6">
          <h2
            className="text-[2.8rem] md:text-[4.5rem] font-bold tracking-tight leading-tight"
            style={{ color: "#fff" }}
          >
            Stop worrying about false accusations.
          </h2>
          <p
            className="text-lg md:text-xl max-w-xl leading-relaxed"
            style={{ color: "rgba(255,255,255,0.65)" }}
          >
            Create your student account today and generate cryptographic proof
            of your hard work in minutes. Completely free.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Link
              to={ROUTES.REGISTER}
              className="px-8 py-3.5 rounded-md font-semibold text-[15px] transition-all hover:opacity-90 active:scale-[0.98] flex items-center gap-2"
              style={{ background: "#fff", color: colors.text.primary }}
            >
              Start Free Session <ArrowRight />
            </Link>
            <Link
              to={ROUTES.HOW_IT_WORKS}
              className="px-8 py-3.5 rounded-md font-semibold text-[15px] transition-all flex items-center gap-2 border"
              style={{
                color: "rgba(255,255,255,0.75)",
                borderColor: "rgba(255,255,255,0.2)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  "rgba(255,255,255,0.5)";
                (e.currentTarget as HTMLElement).style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor =
                  "rgba(255,255,255,0.2)";
                (e.currentTarget as HTMLElement).style.color =
                  "rgba(255,255,255,0.75)";
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
