// frontend/src/pages/HomePage.tsx

import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
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
  ScanLine,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Trash2,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
} from "framer-motion";

import { ROUTES } from "../constants/routes";
import { brand, colors } from "../styles/colors";

function softAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

function HeroGridBackground() {
  const cols = 10;
  const rows = 6;

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
          <linearGradient id="hero-grid-fade-y" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.surface[50]} stopOpacity="0" />
            <stop offset="15%" stopColor={colors.surface[50]} stopOpacity="1" />
            <stop offset="72%" stopColor={colors.surface[50]} stopOpacity="1" />
            <stop
              offset="100%"
              stopColor={colors.surface[50]}
              stopOpacity="0"
            />
          </linearGradient>

          <radialGradient id="hero-grid-center" cx="50%" cy="38%" r="55%">
            <stop offset="0%" stopColor={colors.surface[50]} stopOpacity="1" />
            <stop offset="78%" stopColor={colors.surface[50]} stopOpacity="0" />
          </radialGradient>

          <mask id="hero-grid-mask">
            <rect width="100%" height="100%" fill="url(#hero-grid-fade-y)" />
          </mask>
        </defs>

        <g mask="url(#hero-grid-mask)" opacity="0.72">
          {colPositions.map((x, index) => (
            <line
              key={`col-${index}`}
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

          {colPositions.map((x, colIndex) =>
            rowPositions.map((y, rowIndex) => (
              <g
                key={`${colIndex}-${rowIndex}`}
                transform={`translate(${x}, ${y})`}
              >
                <line
                  x1="-5"
                  y1="0"
                  x2="5"
                  y2="0"
                  stroke={colors.surface[200]}
                  strokeWidth="1"
                />
                <line
                  x1="0"
                  y1="-5"
                  x2="0"
                  y2="5"
                  stroke={colors.surface[200]}
                  strokeWidth="1"
                />
              </g>
            )),
          )}
        </g>

        <rect width="100%" height="100%" fill="url(#hero-grid-center)" />
      </svg>

      <div
        className="absolute left-[-18%] top-[8%] h-[54vw] w-[54vw] rounded-full"
        style={{
          background: `radial-gradient(circle, ${softAlpha(colors.brand, "16")} 0%, transparent 64%)`,
          filter: "blur(90px)",
        }}
      />

      <div
        className="absolute right-[-14%] top-[14%] h-[46vw] w-[46vw] rounded-full"
        style={{
          background: `radial-gradient(circle, ${softAlpha(colors.brand, "12")} 0%, transparent 68%)`,
          filter: "blur(95px)",
        }}
      />

      <div
        className="absolute bottom-[-8%] left-[28%] h-[30vw] w-[44vw] rounded-full"
        style={{
          background: `radial-gradient(circle, ${softAlpha(colors.text.primary, "08")} 0%, transparent 72%)`,
          filter: "blur(92px)",
        }}
      />
    </div>
  );
}

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
      initial={{ opacity: 0, y: yOffset + 22, rotate }}
      animate={{
        opacity: 1,
        y: [yOffset, yOffset - 10, yOffset],
        rotate,
      }}
      transition={{
        opacity: { duration: 0.65, delay },
        y: {
          duration: 5 + delay,
          repeat: Infinity,
          ease: "easeInOut",
          delay: delay * 0.42,
        },
      }}
      className={`absolute hidden items-center gap-3 rounded-2xl border bg-white px-4 py-3 lg:flex ${
        className ?? ""
      }`}
      style={{
        borderColor: colors.surface[200],
        boxShadow: `0 18px 55px -28px ${softAlpha(colors.text.primary, "45")}`,
      }}
    >
      {children}
    </motion.div>
  );
}

function TrustPill({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[12.5px]"
      style={{ color: colors.text.secondary }}
    >
      <Check size={14} strokeWidth={2.5} style={{ color: brand.action }} />
      {children}
    </span>
  );
}

function ProductMockup() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "center center"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [72, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.35], [0.3, 1]);

  return (
    <div
      ref={containerRef}
      className="relative z-20 mx-auto mt-[-7vh] w-full max-w-[1240px] px-6 md:px-12"
    >
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[78%] w-[78%] rounded-full"
        style={{
          opacity,
          x: "-50%",
          y: "-50%",
          background: `radial-gradient(circle, ${softAlpha(colors.brand, "20")} 0%, transparent 62%)`,
          filter: "blur(90px)",
        }}
      />

      <motion.div
        style={{
          scale,
          y,
          opacity,
          borderColor: colors.surface[200],
        }}
        className="relative z-10 overflow-hidden rounded-2xl border bg-white"
      >
        <div
          className="flex h-12 items-center gap-4 border-b px-4"
          style={{
            backgroundColor: colors.surface[100],
            borderColor: colors.surface[200],
          }}
        >
          <div className="flex gap-2">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: colors.surface[200] }}
              />
            ))}
          </div>

          <div
            className="mx-auto flex h-7 max-w-[340px] flex-1 items-center justify-center rounded-md border"
            style={{
              backgroundColor: colors.surface[50],
              borderColor: colors.surface[200],
            }}
          >
            <span
              className="flex items-center gap-2 font-mono text-[11px] font-medium"
              style={{ color: colors.text.secondary }}
            >
              <LockKeyhole size={11} strokeWidth={2.4} />
              app.typetrace.com/session/live
            </span>
          </div>

          <div className="w-12" />
        </div>

        <div
          className="grid min-h-[560px] grid-cols-1 lg:grid-cols-[260px_1fr_320px]"
          style={{ backgroundColor: colors.surface[50] }}
        >
          <aside
            className="hidden border-r p-5 lg:block"
            style={{ borderColor: colors.surface[200] }}
          >
            <div
              className="mb-6 h-8 w-32 rounded-md"
              style={{ backgroundColor: colors.surface[100] }}
            />

            <div className="grid gap-2">
              {[
                "Live Session",
                "Keystrokes",
                "Certificates",
                "Replay Audit",
                "Settings",
              ].map((item, index) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5"
                  style={{
                    backgroundColor:
                      index === 0 ? colors.brandSoft : "transparent",
                    color: index === 0 ? colors.brand : colors.text.secondary,
                  }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor:
                        index === 0 ? colors.brand : colors.surface[300],
                    }}
                  />
                  <span className="text-[13px] font-semibold">{item}</span>
                </div>
              ))}
            </div>

            <div
              className="mt-8 rounded-xl border p-4"
              style={{
                borderColor: colors.surface[200],
                backgroundColor: colors.surface[100],
              }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: colors.text.secondary }}
              >
                Session integrity
              </p>
              <div className="mt-4 grid gap-2">
                {["No paste burst", "Natural rhythm", "Hash ready"].map(
                  (item) => (
                    <div
                      key={item}
                      className="flex items-center gap-2 text-[12px] font-medium"
                      style={{ color: colors.text.primary }}
                    >
                      <CheckCircle2
                        size={13}
                        strokeWidth={2.4}
                        style={{ color: brand.humanAccent }}
                      />
                      {item}
                    </div>
                  ),
                )}
              </div>
            </div>
          </aside>

          <main className="p-5 md:p-7">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <p
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: colors.brand }}
                >
                  Writing workspace
                </p>
                <h3
                  className="mt-2 text-2xl font-bold tracking-tight"
                  style={{ color: colors.text.primary }}
                >
                  Climate policy essay
                </h3>
              </div>

              <div
                className="flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-[12px] font-semibold"
                style={{
                  color: brand.humanText,
                  backgroundColor: brand.humanBg,
                  borderColor: softAlpha(brand.humanAccent, "35"),
                }}
              >
                <Radio size={13} strokeWidth={2.5} />
                Live capture active
              </div>
            </div>

            <div
              className="mt-6 rounded-xl border bg-white p-5"
              style={{ borderColor: colors.surface[200] }}
            >
              <div className="space-y-4">
                {[
                  "The central weakness of traditional AI detection is that it judges only the final document.",
                  "TypeTrace records the writing process itself: pauses, corrections, bursts, rhythm, and revision behavior.",
                  "This allows authorship verification to move from guesswork to process-based evidence.",
                ].map((line, index) => (
                  <motion.p
                    key={line}
                    initial={{ opacity: 0.4 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ delay: index * 0.14, duration: 0.4 }}
                    className="text-[15px] leading-7"
                    style={{ color: colors.text.primary }}
                  >
                    {line}
                    {index === 2 && (
                      <motion.span
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ duration: 1.1, repeat: Infinity }}
                        className="ml-1 inline-block h-5 w-[2px] translate-y-1"
                        style={{ backgroundColor: colors.brand }}
                      />
                    )}
                  </motion.p>
                ))}
              </div>

              <div
                className="mt-6 grid grid-cols-2 gap-3 border-t pt-5 md:grid-cols-4"
                style={{ borderColor: colors.surface[200] }}
              >
                {[
                  ["64", "WPM"],
                  ["284ms", "Avg IKI"],
                  ["3,291", "Events"],
                  ["96.3%", "Human"],
                ].map(([value, label]) => (
                  <div key={label}>
                    <p
                      className="text-xl font-extrabold tracking-tight"
                      style={{
                        color:
                          label === "Human"
                            ? brand.humanAccent
                            : colors.text.primary,
                      }}
                    >
                      {value}
                    </p>
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: colors.text.secondary }}
                    >
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <MiniMetricPanel
                title="Behavioral rhythm"
                icon={<Activity size={15} strokeWidth={2.4} />}
                bars={[40, 65, 38, 82, 55, 76, 44, 70, 58, 84]}
              />
              <MiniMetricPanel
                title="Feature importance"
                icon={<BarChart3 size={15} strokeWidth={2.4} />}
                bars={[82, 64, 48, 36, 22]}
              />
            </div>
          </main>

          <aside
            className="border-t p-5 lg:border-l lg:border-t-0"
            style={{ borderColor: colors.surface[200] }}
          >
            <div
              className="rounded-xl border p-5"
              style={{
                borderColor: softAlpha(brand.humanAccent, "35"),
                backgroundColor: brand.humanBg,
              }}
            >
              <div className="flex items-center justify-between">
                <p
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: brand.humanText }}
                >
                  Authorship result
                </p>
                <CheckCircle2
                  size={17}
                  strokeWidth={2.5}
                  style={{ color: brand.humanAccent }}
                />
              </div>

              <p
                className="mt-5 text-5xl font-extrabold tracking-tight"
                style={{ color: brand.humanAccent }}
              >
                96.3%
              </p>

              <p
                className="mt-2 text-[13px] leading-6"
                style={{ color: brand.humanText }}
              >
                Natural typing rhythm, organic correction pattern, and no
                high-risk paste burst detected.
              </p>
            </div>

            <div className="mt-4 grid gap-3">
              {[
                ["Certificate", "Ready to generate", FileCheck2],
                ["Replay", "Audit timeline saved", TimerReset],
                ["Hash", "SHA-256 sealed", ShieldCheck],
              ].map(([title, desc, Icon]) => {
                const Svg = Icon as typeof FileCheck2;

                return (
                  <div
                    key={title as string}
                    className="flex items-center gap-3 rounded-xl border bg-white p-4"
                    style={{ borderColor: colors.surface[200] }}
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-md"
                      style={{
                        backgroundColor: colors.brandSoft,
                        color: colors.brand,
                      }}
                    >
                      <Svg size={16} strokeWidth={2.4} />
                    </div>

                    <div>
                      <p
                        className="text-[13px] font-bold"
                        style={{ color: colors.text.primary }}
                      >
                        {title as string}
                      </p>
                      <p
                        className="text-[12px]"
                        style={{ color: colors.text.secondary }}
                      >
                        {desc as string}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </motion.div>
    </div>
  );
}

function MiniMetricPanel({
  title,
  icon,
  bars,
}: {
  title: string;
  icon: ReactNode;
  bars: number[];
}) {
  return (
    <div
      className="rounded-xl border bg-white p-4"
      style={{ borderColor: colors.surface[200] }}
    >
      <div className="mb-4 flex items-center justify-between">
        <p
          className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest"
          style={{ color: colors.text.secondary }}
        >
          <span style={{ color: colors.brand }}>{icon}</span>
          {title}
        </p>
      </div>

      <div className="flex h-16 items-end gap-1.5">
        {bars.map((height, index) => (
          <motion.div
            key={index}
            initial={{ height: 0 }}
            whileInView={{ height: `${height}%` }}
            transition={{ duration: 0.55, delay: index * 0.035 }}
            className="flex-1 rounded-t-sm"
            style={{
              backgroundColor:
                index % 3 === 0 ? colors.brand : colors.surface[200],
            }}
          />
        ))}
      </div>
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
  sub: string;
}) {
  return (
    <div
      className="border-r p-8 last:border-r-0"
      style={{ borderColor: colors.surface[200] }}
    >
      <p
        className="text-[3.2rem] font-extrabold leading-none tracking-tight"
        style={{ color: brand.action }}
      >
        {value}
      </p>

      <p
        className="mt-3 text-[15px] font-semibold"
        style={{ color: colors.text.primary }}
      >
        {label}
      </p>

      <p className="mt-1 text-[13px]" style={{ color: colors.text.secondary }}>
        {sub}
      </p>
    </div>
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

function FeatureRow({
  tag,
  title,
  body,
  bullets,
  visual,
  flip = false,
}: {
  tag: string;
  title: string;
  body: string;
  bullets: string[];
  visual: ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
      <div className={`flex flex-col gap-5 ${flip ? "lg:order-2" : ""}`}>
        <SectionEyebrow>{tag}</SectionEyebrow>

        <h3
          className="text-[2.35rem] font-bold leading-[1.05] tracking-tight md:text-[3rem]"
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

        <ul className="mt-2 flex flex-col gap-3">
          {bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-start gap-3 text-[15px]"
              style={{ color: colors.text.secondary }}
            >
              <Check
                size={15}
                strokeWidth={2.5}
                className="mt-0.5 shrink-0"
                style={{ color: brand.action }}
              />
              {bullet}
            </li>
          ))}
        </ul>
      </div>

      <div className={flip ? "lg:order-1" : ""}>{visual}</div>
    </div>
  );
}

function KeystrokeVisual() {
  const rows = [
    { key: "T", iki: "-", dwell: "82ms" },
    { key: "h", iki: "142ms", dwell: "71ms" },
    { key: "e", iki: "198ms", dwell: "68ms" },
    { key: "Back", iki: "312ms", dwell: "94ms" },
    { key: "i", iki: "245ms", dwell: "77ms" },
  ];

  return (
    <div
      className="flex min-h-[380px] flex-col justify-center gap-5 overflow-hidden rounded-3xl border bg-white p-8 md:p-10"
      style={{
        borderColor: colors.surface[200],
        boxShadow: `0 24px 70px -42px ${softAlpha(colors.text.primary, "50")}`,
      }}
    >
      <p
        className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest"
        style={{ color: brand.action }}
      >
        <Keyboard size={14} strokeWidth={2.3} />
        Live keystroke event stream
      </p>

      {rows.map((row, index) => (
        <motion.div
          key={`${row.key}-${index}`}
          initial={{ opacity: 0, x: -18 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1, duration: 0.38 }}
          className="flex items-center gap-4 rounded-md border px-4 py-2.5"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[100],
          }}
        >
          <span
            className="flex h-8 w-10 shrink-0 items-center justify-center rounded-lg font-mono text-[12px] font-bold"
            style={{
              background: colors.brandSoft,
              color: brand.action,
            }}
          >
            {row.key === "Back" ? (
              <Trash2 size={13} strokeWidth={2.4} />
            ) : (
              row.key
            )}
          </span>

          <div className="grid flex-1 grid-cols-2 gap-4">
            <div>
              <p
                className="text-[9px] font-bold uppercase tracking-wider"
                style={{ color: colors.text.secondary }}
              >
                IKI
              </p>
              <p
                className="font-mono text-[13px] font-bold"
                style={{ color: colors.text.primary }}
              >
                {row.iki}
              </p>
            </div>

            <div>
              <p
                className="text-[9px] font-bold uppercase tracking-wider"
                style={{ color: colors.text.secondary }}
              >
                Dwell
              </p>
              <p
                className="font-mono text-[13px] font-bold"
                style={{ color: colors.text.primary }}
              >
                {row.dwell}
              </p>
            </div>
          </div>

          <CheckCircle2
            size={14}
            strokeWidth={2.4}
            style={{ color: brand.humanAccent }}
          />
        </motion.div>
      ))}
    </div>
  );
}

function IntelligenceVisual() {
  const features = [
    { label: "IKI variance", value: 38 },
    { label: "Paste detection", value: 26 },
    { label: "Pause frequency", value: 18 },
    { label: "Mean rhythm", value: 12 },
    { label: "Deletion rate", value: 6 },
  ];

  return (
    <div
      className="flex min-h-[380px] flex-col justify-center rounded-3xl border bg-white p-8 md:p-10"
      style={{
        borderColor: colors.surface[200],
        boxShadow: `0 24px 70px -42px ${softAlpha(colors.text.primary, "50")}`,
      }}
    >
      <p
        className="mb-6 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest"
        style={{ color: brand.action }}
      >
        <BarChart3 size={14} strokeWidth={2.3} />
        Feature importance
      </p>

      <div className="grid gap-4">
        {features.map((feature, index) => (
          <div key={feature.label} className="grid gap-1.5">
            <div className="flex justify-between text-[12px]">
              <span
                className="font-medium"
                style={{ color: colors.text.primary }}
              >
                {feature.label}
              </span>
              <span
                className="font-semibold"
                style={{ color: colors.text.secondary }}
              >
                {feature.value}%
              </span>
            </div>

            <div
              className="h-2 overflow-hidden rounded-full"
              style={{ background: colors.surface[100] }}
            >
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${feature.value}%` }}
                transition={{
                  duration: 1,
                  delay: index * 0.1,
                  ease: "easeOut",
                }}
                className="h-full rounded-full"
                style={{
                  background: index === 0 ? brand.action : colors.surface[200],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CertificateVisual() {
  return (
    <div
      className="flex min-h-[380px] items-center justify-center rounded-3xl border bg-white p-8 md:p-10"
      style={{
        borderColor: colors.surface[200],
        boxShadow: `0 24px 70px -42px ${softAlpha(colors.text.primary, "50")}`,
      }}
    >
      <div
        className="w-full max-w-[340px] overflow-hidden rounded-2xl border"
        style={{ borderColor: colors.surface[200] }}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-3"
          style={{
            background: colors.surface[100],
            borderColor: colors.surface[200],
          }}
        >
          <span
            className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest"
            style={{ color: colors.text.secondary }}
          >
            <FileCheck2 size={13} strokeWidth={2.2} />
            Certificate
          </span>

          <span
            className="flex items-center gap-1.5 text-[10px] font-bold"
            style={{ color: brand.humanAccent }}
          >
            <CheckCircle2 size={12} strokeWidth={2.4} />
            Valid
          </span>
        </div>

        <div className="flex flex-col gap-3 bg-white p-5">
          {[
            ["Student", "Verified author"],
            ["Document", "Academic essay"],
            ["Classification", "Human / 96.3%"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <span
                className="text-[11px]"
                style={{ color: colors.text.secondary }}
              >
                {label}
              </span>
              <span
                className="text-right text-[11px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                {value}
              </span>
            </div>
          ))}

          <div
            className="mt-2 flex items-start gap-2 break-all rounded-md p-2.5 font-mono text-[9px]"
            style={{
              background: colors.brandSoft,
              color: brand.action,
            }}
          >
            <LockKeyhole size={12} strokeWidth={2.3} />
            <span>SHA-256: a3f5b8c2d94e1f07b441...</span>
          </div>
        </div>
      </div>
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
      className="flex flex-col gap-4 rounded-2xl border p-7"
      style={{
        background: bg,
        borderColor: softAlpha(accent, "28"),
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
        className="text-[3.1rem] font-extrabold leading-none"
        style={{ color: accent }}
      >
        {score}
      </span>

      <p
        className="border-t pt-4 text-[13px] leading-relaxed"
        style={{
          color: textColor,
          borderColor: softAlpha(accent, "22"),
        }}
      >
        {desc}
      </p>
    </div>
  );
}

const TRUST_ITEMS = [
  {
    title: "Process evidence instead of final-text guessing",
    content:
      "TypeTrace verifies how the document was produced: rhythm, hesitation, revision behavior, paste bursts, deletions, and typing consistency. This makes the proof stronger than text-only AI detectors.",
  },
  {
    title: "Cryptographic session sealing",
    content:
      "Each verified writing session can be sealed with a SHA-256 hash and connected to a certificate. Any later manipulation of the evidence breaks the verification trail.",
  },
  {
    title: "Built for academic review workflows",
    content:
      "Teachers do not need to interpret raw biometric data. They get clear verdicts, confidence scores, replay timelines, and certificate records that support human decision-making.",
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
                  border: `1.5px solid ${
                    open ? brand.action : colors.surface[200]
                  }`,
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

export default function HomePage() {
  return (
    <main
      className="min-h-screen w-full overflow-x-hidden font-sans"
      style={{ background: colors.surface[50] }}
    >
      <section className="relative flex min-h-[95vh] flex-col items-center justify-start overflow-hidden px-6 pb-16 pt-16 text-center">
        <HeroGridBackground />

        <FloatingCard
          className="left-[2%] top-[14%] xl:left-[6%] 2xl:left-[7%]"
          delay={0.3}
          rotate={-3}
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{
              background: brand.humanBg,
              border: `1px solid ${softAlpha(brand.humanAccent, "30")}`,
              color: brand.humanAccent,
            }}
          >
            <CheckCircle2 size={17} strokeWidth={2.5} />
          </div>

          <div className="flex flex-col items-start gap-0.5">
            <span
              className="text-[10px] font-bold uppercase leading-none tracking-widest"
              style={{ color: colors.text.secondary }}
            >
              Authorship status
            </span>
            <span
              className="text-[15px] font-bold leading-none"
              style={{ color: colors.text.primary }}
            >
              Human verified
            </span>
          </div>
        </FloatingCard>

        <FloatingCard
          className="right-[2%] top-[13%] xl:right-[6%] 2xl:right-[10%]"
          delay={0.5}
          rotate={3}
          yOffset={10}
        >
          <div className="flex w-[150px] flex-col gap-2">
            <div className="flex items-center justify-between">
              <span
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: colors.text.secondary }}
              >
                <BarChart3 size={12} strokeWidth={2.3} />
                Rhythm
              </span>
              <span
                className="font-mono text-[12px] font-bold"
                style={{ color: colors.text.primary }}
              >
                284ms
              </span>
            </div>

            <div className="flex h-7 items-end gap-[3px]">
              {[35, 55, 28, 72, 48, 85, 42, 68, 50, 78].map((height, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: `${height}%`,
                    background:
                      index > 3 && index < 7
                        ? brand.action
                        : colors.surface[200],
                  }}
                />
              ))}
            </div>
          </div>
        </FloatingCard>

        <FloatingCard
          className="left-[2%] top-[60%] xl:left-[4%] 2xl:left-[8%]"
          delay={0.8}
          rotate={2}
          yOffset={5}
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
            style={{
              background: colors.brandSoft,
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
              Certificate sealed
            </span>
            <span
              className="font-mono text-[10px] leading-none"
              style={{ color: colors.text.secondary }}
            >
              SHA-256 / Verified
            </span>
          </div>
        </FloatingCard>

        <FloatingCard
          className="right-[2%] top-[57%] xl:right-[5%] 2xl:right-[8%]"
          delay={1}
          rotate={-2}
          yOffset={-8}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-md"
              style={{
                background: brand.humanBg,
                color: brand.humanAccent,
                border: `1px solid ${softAlpha(brand.humanAccent, "30")}`,
              }}
            >
              <Radio size={16} strokeWidth={2.2} />
            </div>

            <div className="flex flex-col items-start gap-0.5">
              <span
                className="text-[10px] font-bold uppercase leading-none tracking-widest"
                style={{ color: colors.text.secondary }}
              >
                Live session
              </span>
              <span
                className="font-mono text-[15px] font-bold leading-none"
                style={{ color: colors.text.primary }}
              >
                WPM: 64
              </span>
            </div>
          </div>
        </FloatingCard>

        <div className="relative z-10 mt-16 flex max-w-[940px] flex-col items-center lg:mt-24">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.06 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
            style={{
              background: colors.brandSoft,
              borderColor: colors.surface[200],
              color: brand.action,
            }}
          >
            <Fingerprint size={14} strokeWidth={2.3} />
            <span className="text-[12px] font-semibold">
              Behavioral authorship verification for academic writing
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.12 }}
            className="mb-8 text-[3.8rem] font-bold leading-[0.96] tracking-tighter sm:text-[5.4rem] lg:text-[5.7rem]"
            style={{ color: colors.text.primary }}
          >
            Prove authorship
            <br />
            <span style={{ color: brand.action }}>before doubt begins.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.22 }}
            className="mb-12 max-w-2xl text-center text-lg leading-relaxed md:text-xl"
            style={{ color: colors.text.secondary }}
          >
            TypeTrace captures the writing process itself: typing rhythm,
            corrections, pauses, paste events, and behavioral signals. Students
            get evidence. Teachers get clarity. Institutions get a reviewable
            authorship trail.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.3 }}
            className="mb-8 flex flex-col items-center gap-3 sm:flex-row"
          >
            <Link
              to={ROUTES.REGISTER}
              className="flex items-center gap-2 rounded-md px-8 py-3.5 text-[15px] font-semibold text-white transition-all duration-150 hover:opacity-95 active:scale-[0.98]"
              style={{
                background: brand.action,
                boxShadow: `0 16px 42px -20px ${softAlpha(colors.brand, "AA")}`,
              }}
            >
              Start free session
              <ArrowRight size={16} strokeWidth={2.3} />
            </Link>

            <Link
              to={ROUTES.HOW_IT_WORKS}
              className="flex items-center gap-2 rounded-md border px-8 py-3.5 text-[15px] font-semibold transition-all duration-150"
              style={{
                color: colors.text.primary,
                borderColor: colors.surface[200],
                background: colors.surface[50],
              }}
            >
              See how it works
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex flex-wrap justify-center gap-x-6 gap-y-2"
          >
            <TrustPill>No emojis, no guessing, process-based proof</TrustPill>
            <TrustPill>Replayable writing evidence</TrustPill>
            <TrustPill>Certificates for academic review</TrustPill>
          </motion.div>
        </div>
      </section>

      <ProductMockup />

      <section
        className="mt-24 border-y"
        style={{
          borderColor: colors.surface[200],
          background: colors.surface[50],
        }}
      >
        <div className="mx-auto grid max-w-[1200px] grid-cols-2 lg:grid-cols-4">
          <StatCard
            value="10k+"
            label="Writing sessions"
            sub="Process events analyzed"
          />
          <StatCard
            value="96.3%"
            label="Model accuracy"
            sub="Behavioral classifier"
          />
          <StatCard
            value="<5%"
            label="False positive target"
            sub="Designed for review fairness"
          />
          <StatCard
            value="3"
            label="Evidence layers"
            sub="Capture, replay, certificate"
          />
        </div>
      </section>

      <section
        className="border-b px-6 py-32 md:px-12"
        style={{
          borderColor: colors.surface[200],
          background: colors.surface[100],
        }}
      >
        <div className="mx-auto flex max-w-[1120px] flex-col items-center gap-8 text-center">
          <SectionEyebrow>The problem</SectionEyebrow>

          <h2
            className="text-[2.5rem] font-bold leading-[1.05] tracking-tight md:text-[4rem]"
            style={{ color: colors.text.primary }}
          >
            AI detectors inspect the final text.
            <br />
            <span style={{ color: colors.text.secondary }}>
              TypeTrace verifies the process.
            </span>
          </h2>

          <p
            className="max-w-3xl text-lg leading-relaxed md:text-xl"
            style={{ color: colors.text.secondary }}
          >
            Final-text detection is fragile because human writing can look
            formal, polished, or AI-like. TypeTrace focuses on behavioral
            authorship evidence: how the work was produced, not only what the
            final paragraph looks like.
          </p>

          <div className="mt-8 grid w-full max-w-[880px] grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              {
                name: "Final-text detector",
                value: 35,
                caption: "Higher risk of false accusations",
                color: brand.aiAccent,
              },
              {
                name: "Paste-only evidence",
                value: 26,
                caption: "Limited context for reviewers",
                color: brand.suspiciousAccent,
              },
              {
                name: "Manual review alone",
                value: 19,
                caption: "Slow and inconsistent at scale",
                color: brand.suspiciousAccent,
              },
              {
                name: "TypeTrace target",
                value: 4.2,
                caption: "Process-first, evidence-backed review",
                color: brand.humanAccent,
              },
            ].map((item) => (
              <div
                key={item.name}
                className="rounded-2xl border bg-white p-5 text-left"
                style={{
                  borderColor: colors.surface[200],
                  boxShadow: `0 18px 44px -34px ${softAlpha(colors.text.primary, "55")}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[13px] font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {item.name}
                  </span>
                  <span
                    className="text-[15px] font-bold"
                    style={{ color: item.color }}
                  >
                    {item.value}%
                  </span>
                </div>

                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full"
                  style={{ background: colors.surface[200] }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${(item.value / 35) * 100}%` }}
                    transition={{ duration: 1.1, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: item.color }}
                  />
                </div>

                <p
                  className="mt-3 text-[12px]"
                  style={{ color: colors.text.secondary }}
                >
                  {item.caption}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-[1300px] flex-col gap-32 px-6 py-32 md:px-12">
        <FeatureRow
          tag="Capture layer"
          title="The writing process becomes structured evidence."
          body="Every key event, deletion, hesitation, paste burst, and rhythm shift is converted into behavioral signals while the student writes naturally."
          bullets={[
            "Keystroke timing, dwell time, and inter-key intervals",
            "Backspaces, edits, paste events, and cursor behavior",
            "Low-friction capture designed to stay invisible during writing",
          ]}
          visual={<KeystrokeVisual />}
        />

        <FeatureRow
          flip
          tag="Intelligence layer"
          title="Behavioral signals become an authorship verdict."
          body="TypeTrace converts raw writing behavior into feature vectors and produces clear, reviewable classification outcomes for academic integrity workflows."
          bullets={[
            "Human, suspicious, and synthetic writing categories",
            "Confidence scoring for transparent review decisions",
            "Replay timeline for deeper investigation when needed",
          ]}
          visual={<IntelligenceVisual />}
        />

        <FeatureRow
          tag="Certificate layer"
          title="Every verified session can be sealed and reviewed."
          body="Students can generate certificate records that connect writing behavior, classification output, and integrity metadata into one verifiable audit trail."
          bullets={[
            "Public certificate lookup for reviewers and institutions",
            "Session replay for writing-process transparency",
            "Integrity hash to protect evidence from silent tampering",
          ]}
          visual={<CertificateVisual />}
        />
      </section>

      <section
        className="border-t px-6 py-32 md:px-12"
        style={{
          borderColor: colors.surface[200],
          background: colors.surface[100],
        }}
      >
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-16 flex flex-col items-center gap-4 text-center">
            <SectionEyebrow>Results</SectionEyebrow>

            <h2
              className="text-[2.5rem] font-bold tracking-tight md:text-[3.5rem]"
              style={{ color: colors.text.primary }}
            >
              Three verdicts reviewers can understand instantly.
            </h2>

            <p
              className="max-w-xl text-lg"
              style={{ color: colors.text.secondary }}
            >
              The output is designed for real academic review, not confusing
              black-box scoring.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <OutcomeCard
              label="Human"
              score="96.3%"
              desc="Natural rhythm, correction flow, and organic writing behavior."
              accent={brand.humanAccent}
              bg={brand.humanBg}
              textColor={brand.humanText}
              icon={<CheckCircle2 size={13} strokeWidth={2.5} />}
            />

            <OutcomeCard
              label="Suspicious"
              score="67.2%"
              desc="Unusual bursts, interruptions, or review-worthy process signals."
              accent={brand.suspiciousAccent}
              bg={brand.suspiciousBg}
              textColor={brand.suspiciousText}
              icon={<Activity size={13} strokeWidth={2.5} />}
            />

            <OutcomeCard
              label="Synthetic"
              score="94.8%"
              desc="High-risk behavior such as full-document paste or missing natural rhythm."
              accent={brand.aiAccent}
              bg={brand.aiBg}
              textColor={brand.aiText}
              icon={<ShieldCheck size={13} strokeWidth={2.5} />}
            />
          </div>
        </div>
      </section>

      <section
        className="border-t px-6 py-32 md:px-12"
        style={{
          borderColor: colors.surface[200],
          background: colors.surface[50],
        }}
      >
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-start gap-16 lg:grid-cols-2 lg:gap-24">
          <div className="lg:sticky lg:top-32">
            <SectionEyebrow>Trust architecture</SectionEyebrow>

            <h2
              className="mt-6 text-[2.65rem] font-bold leading-[1.05] tracking-tight md:text-[3.5rem]"
              style={{ color: colors.text.primary }}
            >
              Built for students, teachers, and evidence-based review.
            </h2>

            <p
              className="mt-6 text-lg leading-relaxed"
              style={{ color: colors.text.secondary }}
            >
              A SaaS product for academic integrity must feel trustworthy from
              the first screen. TypeTrace combines capture, classification,
              replay, and certification into a single product workflow.
            </p>
          </div>

          <TrustAccordion />
        </div>
      </section>

      <section
        className="relative overflow-hidden px-6 py-32 text-center"
        style={{ background: colors.text.primary }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${softAlpha(colors.brand, "55")} 0%, transparent 48%)`,
          }}
        />

        <div className="relative z-10 mx-auto flex max-w-[820px] flex-col items-center gap-6">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5"
            style={{
              color: colors.text.light,
              borderColor: softAlpha(colors.text.light, "24"),
              background: softAlpha(colors.text.light, "08"),
            }}
          >
            <Sparkles size={14} strokeWidth={2.3} />
            <span className="text-[12px] font-semibold">
              Start building an authorship trail today
            </span>
          </div>

          <h2
            className="text-[2.8rem] font-bold leading-tight tracking-tight md:text-[4.5rem]"
            style={{ color: colors.text.light }}
          >
            Stop defending final text. Start proving the writing process.
          </h2>

          <p
            className="max-w-xl text-lg leading-relaxed md:text-xl"
            style={{ color: softAlpha(colors.text.light, "B8") }}
          >
            Create a session, write naturally, generate evidence, and share a
            certificate when your work needs to be verified.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              to={ROUTES.REGISTER}
              className="flex items-center gap-2 rounded-md px-8 py-3.5 text-[15px] font-semibold transition-all hover:opacity-95 active:scale-[0.98]"
              style={{
                background: colors.text.light,
                color: brand.action,
              }}
            >
              Start free session
              <ArrowRight size={16} strokeWidth={2.3} />
            </Link>

            <Link
              to={ROUTES.VERIFY_LOOKUP}
              className="flex items-center gap-2 rounded-md border px-8 py-3.5 text-[15px] font-semibold transition-all"
              style={{
                color: softAlpha(colors.text.light, "CC"),
                borderColor: softAlpha(colors.text.light, "28"),
              }}
            >
              <ScanLine size={16} strokeWidth={2.3} />
              Verify certificate
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
