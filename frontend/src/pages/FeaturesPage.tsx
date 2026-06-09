import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ROUTES } from "../constants/routes";
import { brand, colors } from "../styles/colors";

// --- SVG Mockups ---
// spending way too much time making these svgs look good instead of generic images.

function Feature1Art() {
  return (
    <svg
      viewBox="0 0 400 300"
      className="w-full h-auto"
      style={{ color: brand.action }}
      fill="none"
    >
      <rect
        x="50"
        y="50"
        width="300"
        height="200"
        rx="12"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.1"
      />
      <rect
        x="80"
        y="80"
        width="60"
        height="60"
        rx="8"
        fill="currentColor"
        opacity="0.1"
      />
      <rect
        x="150"
        y="80"
        width="60"
        height="60"
        rx="8"
        fill="currentColor"
        opacity="0.1"
      />
      <rect
        x="220"
        y="80"
        width="100"
        height="60"
        rx="8"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="4 4"
      />
      <path
        d="M50 200 L120 200 L140 160 L160 230 L180 200 L350 200"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dynamic accent pip */}
      <circle cx="220" cy="200" r="6" style={{ fill: brand.humanAccent }} />
    </svg>
  );
}

function Feature2Art() {
  return (
    <svg
      viewBox="0 0 400 300"
      className="w-full h-auto"
      style={{ color: brand.action }}
      fill="none"
    >
      <circle cx="100" cy="150" r="8" fill="currentColor" opacity="0.5" />
      <circle cx="200" cy="100" r="12" fill="currentColor" opacity="0.8" />
      <circle cx="200" cy="200" r="10" fill="currentColor" opacity="0.8" />
      <circle cx="300" cy="150" r="16" style={{ fill: brand.humanAccent }} />
      <line
        x1="108"
        y1="145"
        x2="190"
        y2="105"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.3"
      />
      <line
        x1="108"
        y1="155"
        x2="190"
        y2="195"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.3"
      />
      <line
        x1="212"
        y1="105"
        x2="285"
        y2="142"
        stroke="currentColor"
        strokeWidth="3"
      />
      <line
        x1="212"
        y1="195"
        x2="285"
        y2="158"
        stroke="currentColor"
        strokeWidth="3"
      />
      <motion.rect
        x="270"
        y="120"
        width="60"
        height="60"
        rx="30"
        style={{ stroke: brand.humanAccent, transformOrigin: "300px 150px" }}
        strokeWidth="2"
        strokeDasharray="6 6"
        animate={{ rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
      />
    </svg>
  );
}

function Feature3Art() {
  return (
    <svg
      viewBox="0 0 400 300"
      className="w-full h-auto"
      style={{ color: brand.action }}
      fill="none"
    >
      <path
        d="M120 70 L200 40 L280 70 V150 C280 210 200 260 200 260 C200 260 120 210 120 150 V70 Z"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.1"
        fill="currentColor"
      />
      <rect
        x="150"
        y="100"
        width="100"
        height="80"
        rx="4"
        stroke="currentColor"
        strokeWidth="3"
      />
      <line
        x1="170"
        y1="125"
        x2="230"
        y2="125"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="170"
        y1="145"
        x2="210"
        y2="145"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="230" cy="180" r="20" style={{ fill: brand.humanAccent }} />
      <path
        d="M223 180 L228 185 L238 175"
        stroke={colors.text.light}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Feature4Art() {
  return (
    <svg
      viewBox="0 0 400 300"
      className="w-full h-auto"
      style={{ color: brand.action }}
      fill="none"
    >
      <rect
        x="100"
        y="80"
        width="200"
        height="140"
        rx="16"
        stroke="currentColor"
        strokeWidth="3"
      />
      <rect
        x="130"
        y="110"
        width="140"
        height="12"
        rx="6"
        fill="currentColor"
        opacity="0.2"
      />
      <rect
        x="130"
        y="140"
        width="140"
        height="12"
        rx="6"
        fill="currentColor"
        opacity="0.2"
      />
      <rect
        x="170"
        y="180"
        width="60"
        height="45"
        rx="8"
        style={{ fill: brand.humanAccent }}
      />
      <path
        d="M185 180 V165 C185 155 215 155 215 165 V180"
        style={{ stroke: brand.humanAccent }}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="200" cy="202" r="5" style={{ fill: brand.humanText }} />
    </svg>
  );
}

function Feature5Art() {
  return (
    <svg
      viewBox="0 0 400 300"
      className="w-full h-auto"
      style={{ color: brand.action }}
      fill="none"
    >
      <rect
        x="60"
        y="60"
        width="280"
        height="160"
        rx="8"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.2"
      />
      <circle cx="200" cy="140" r="30" fill="currentColor" />
      <path d="M193 128 L213 140 L193 152 Z" fill={colors.text.light} />
      <rect
        x="80"
        y="190"
        width="240"
        height="6"
        rx="3"
        fill="currentColor"
        opacity="0.1"
      />
      <rect
        x="80"
        y="190"
        width="140"
        height="6"
        rx="3"
        style={{ fill: brand.action }}
      />
      <circle cx="220" cy="193" r="6" style={{ fill: brand.action }} />
    </svg>
  );
}

function Feature6Art() {
  return (
    <svg
      viewBox="0 0 400 300"
      className="w-full h-auto"
      style={{ color: brand.action }}
      fill="none"
    >
      <rect
        x="50"
        y="50"
        width="180"
        height="120"
        rx="8"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.2"
      />
      <rect
        x="250"
        y="50"
        width="100"
        height="120"
        rx="8"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.2"
      />
      <rect
        x="50"
        y="190"
        width="300"
        height="80"
        rx="8"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.2"
      />
      <rect
        x="70"
        y="100"
        width="20"
        height="50"
        rx="2"
        fill="currentColor"
        opacity="0.5"
      />
      <rect x="100" y="70" width="20" height="80" rx="2" fill="currentColor" />
      <rect
        x="130"
        y="120"
        width="20"
        height="30"
        rx="2"
        fill="currentColor"
        opacity="0.5"
      />
      <circle
        cx="300"
        cy="110"
        r="30"
        style={{ stroke: brand.action }}
        strokeWidth="8"
        strokeDasharray="140 100"
        strokeLinecap="round"
      />
    </svg>
  );
}

// --- Data Definition ---
const featuresData = [
  {
    title: "Real-Time Keystroke Logging",
    description:
      "Our invisible recorder captures your unique typing rhythm without disrupting your workflow.",
    bullets: [
      "Captures every keyboard event with millisecond precision.",
      "Non-intrusive background processing ensures zero performance lag.",
      "Seamlessly handles special keys and complex multi-key shortcuts.",
    ],
    metricValue: "<10ms",
    metricLabel: "Capture Latency",
    Art: Feature1Art,
  },
  {
    title: "ML-Powered Classification",
    description:
      "Instead of guessing if text looks robotic, we use machine learning to prove human behavioral effort.",
    bullets: [
      "A trained Random Forest model classifies your session automatically.",
      "Analyzes IKI variance, natural pause frequencies, and deletion rates.",
      "Identifies mechanical uniformity indicative of AI-generated paste events.",
    ],
    metricValue: "96.3%",
    metricLabel: "Classification Accuracy",
    Art: Feature2Art,
  },
  {
    title: "Tamper-Proof Certificates",
    description:
      "Export an unbreakable chain of evidence that cryptographically links you to your original work.",
    bullets: [
      "Generates a downloadable PDF certificate immediately post-session.",
      "Includes a SHA-256 cryptographic hash of the raw keystroke data JSON.",
      "Tamper detection ensures any data modification changes the verification hash.",
    ],
    metricValue: "SHA-256",
    metricLabel: "Cryptographic Security",
    Art: Feature3Art,
  },
  {
    title: "Privacy & GDPR Controls",
    description:
      "Built for strict institutional and academic data protection standards from day one.",
    bullets: [
      "Data is stored locally in the browser by default using IndexedDB.",
      "You retain full control over when or if data is synced to the cloud.",
      "One-click data export and account deletion for complete GDPR compliance.",
    ],
    metricValue: "100%",
    metricLabel: "Local Storage Default",
    Art: Feature4Art,
  },
  {
    title: "Session Replay Visualization",
    description:
      "Turn your writing session into a playable video file to definitively prove your process.",
    bullets: [
      "Offers compressed video-like playback of your entire writing history.",
      "Visually tracks cursor movements, backspace deletions, and thinking pauses.",
      "Speed controls (up to 10x) allow quick review of lengthy assignments.",
    ],
    metricValue: "10x",
    metricLabel: "Playback Speed Output",
    Art: Feature5Art,
  },
  {
    title: "Behavioral Analytics Dashboard",
    description:
      "Understand your own writing habits with deep insights into your behavioral patterns.",
    bullets: [
      "Displays live typing speed graphs and character progression over time.",
      "Editing heatmaps reveal which parts of your document received the most revisions.",
      "Granular writing session timeline visualizes your creative bursts and breaks.",
    ],
    metricValue: "150ms+",
    metricLabel: "Human IKI Variance",
    Art: Feature6Art,
  },
];

export default function FeaturesPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: colors.text.light }}
    >
      {/* ─── Hero Header (Borderless & Typography Driven) ─── */}
      <section className="pt-32 pb-24 px-6 md:px-12 max-w-[1440px] mx-auto text-center flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border mb-8"
          style={{
            backgroundColor: `${brand.action}0A`,
            borderColor: `${brand.action}20`,
            color: brand.action,
          }}
        >
          <span className="text-[11.5px] font-bold uppercase tracking-widest">
            System Capabilities
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.05] max-w-4xl mx-auto mb-8"
          style={{ color: colors.text.primary }}
        >
          Everything you need to <br />
          <span style={{ color: brand.action }}>prove authorship.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl leading-relaxed max-w-2xl mx-auto"
          style={{ color: colors.text.secondary }}
        >
          A full verification stack engineered specifically for academic
          integrity. From raw biometric keystroke capture to tamper-proof PDF
          export.
        </motion.p>
      </section>

      {/* ─── Main Features Layout (Alternating & Borderless) ─── */}
      {/* alternating layout is tricky but it look so much better without the rigid boxes */}
      <section className="pb-32 flex flex-col gap-32 max-w-[1440px] mx-auto px-6 md:px-12">
        {featuresData.map((feature, index) => {
          const isImageLeft = index % 2 === 0;

          return (
            <div
              key={feature.title}
              className={`flex flex-col gap-12 lg:gap-24 items-center ${isImageLeft ? "lg:flex-row" : "lg:flex-row-reverse"}`}
            >
              {/* Abstract Visual Panel */}
              <div className="w-full lg:w-1/2">
                <div
                  className="aspect-[4/3] w-full rounded-2xl flex items-center justify-center relative overflow-hidden group"
                  // Clean soft background, absolutely no drop shadows
                  style={{ backgroundColor: colors.surface[50] }}
                >
                  <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                      backgroundImage:
                        "radial-gradient(#1A2332 1px, transparent 1px)",
                      backgroundSize: "16px 16px",
                    }}
                  />
                  <div className="relative w-full h-full transform transition-transform duration-700 group-hover:scale-105 p-12">
                    <feature.Art />
                  </div>
                </div>
              </div>

              {/* Typography & Data Panel */}
              <div className="w-full lg:w-1/2 flex flex-col justify-center">
                <h2
                  className="text-3xl md:text-4xl font-bold tracking-tight mb-4"
                  style={{ color: colors.text.primary }}
                >
                  {feature.title}
                </h2>
                <p
                  className="text-[17px] leading-relaxed mb-8"
                  style={{ color: colors.text.secondary }}
                >
                  {feature.description}
                </p>

                <ul className="flex flex-col gap-4 mb-10">
                  {feature.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0 mt-2.5"
                        style={{ backgroundColor: brand.action }}
                        aria-hidden="true"
                      />
                      <span
                        className="text-[15px] leading-relaxed"
                        style={{ color: colors.text.secondary }}
                      >
                        {bullet}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Big Typographic Metric (No Boxes) */}
                <div
                  className="pt-6 border-t"
                  style={{ borderColor: colors.surface[200] }}
                >
                  <div
                    className="text-[40px] font-bold tracking-tight leading-none mb-2"
                    style={{ color: brand.action }}
                  >
                    {feature.metricValue}
                  </div>
                  <div
                    className="text-[12px] font-bold uppercase tracking-widest"
                    style={{ color: colors.text.secondary }}
                  >
                    {feature.metricLabel}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* ─── Bottom Escalation CTA ─── */}
      <section
        className="py-32 px-6 text-center border-t"
        style={{
          backgroundColor: colors.surface[50],
          borderColor: colors.surface[200],
        }}
      >
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-8">
          <h2
            className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.05]"
            style={{ color: colors.text.primary }}
          >
            Ready to protect your academic work?
          </h2>
          <p
            className="text-lg md:text-xl opacity-90 max-w-xl leading-relaxed"
            style={{ color: colors.text.secondary }}
          >
            Launch the editor and build your verifiable human footprint
            instantly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full justify-center">
            {/* STRICT TOKEN: rounded-lg */}
            <Link
              to={ROUTES.EDITOR_NEW}
              className="px-8 py-4 rounded-lg font-bold text-[15px] transition-transform hover:scale-105"
              style={{
                backgroundColor: brand.action,
                color: colors.text.light,
              }}
            >
              Start a Session Now
            </Link>
            <Link
              to={ROUTES.REGISTER}
              className="px-8 py-4 rounded-lg font-bold text-[15px] border transition-colors"
              style={{
                backgroundColor: colors.text.light,
                borderColor: colors.surface[200],
                color: colors.text.primary,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = brand.action;
                e.currentTarget.style.color = brand.action;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.surface[200];
                e.currentTarget.style.color = colors.text.primary;
              }}
            >
              Create an Account
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
