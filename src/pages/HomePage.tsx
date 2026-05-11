import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";

// ─── Tiny helper icons ────────────────────────────────────────────────────────
function ArrowRight({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );
}

// ─── Interactive Spatial Typing Visualiser (Hero) ────────────────────────────
const DEMO_SENTENCES = [
  "Machine learning models require robust behavioral validation...",
  "Academic integrity demands cryptographic proof of authorship...",
  "Your unique keystroke rhythm is a biometric fingerprint...",
];

function SpatialTypingVisualizer() {
  const [typed, setTyped] = useState("");
  const [ikis, setIkis] = useState<number[]>([]);

  useEffect(() => {
    let currentSentenceIdx = 0;
    let charIdx = 0;
    let isDeleting = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const runTypingCycle = () => {
      const currentSentence = DEMO_SENTENCES[currentSentenceIdx];

      if (isDeleting) {
        // Backspace logic
        charIdx--;
        setTyped(currentSentence.slice(0, charIdx));

        // Backspacing is typically faster and more uniform (holding down or rapid tapping)
        const deleteLatency = 35 + Math.random() * 40;
        setIkis((prev) => {
          const next = [...prev, deleteLatency];
          return next.length > 35 ? next.slice(next.length - 35) : next;
        });

        if (charIdx === 0) {
          isDeleting = false;
          currentSentenceIdx = (currentSentenceIdx + 1) % DEMO_SENTENCES.length;
          timeoutId = setTimeout(runTypingCycle, 800); // Pause before typing new sentence
        } else {
          timeoutId = setTimeout(runTypingCycle, deleteLatency);
        }
      } else {
        // Forward typing logic
        charIdx++;
        setTyped(currentSentence.slice(0, charIdx));

        // Natural typing variance (slower, more variance)
        const typeLatency = 70 + Math.random() * 160;
        setIkis((prev) => {
          const next = [...prev, typeLatency];
          return next.length > 35 ? next.slice(next.length - 35) : next;
        });

        if (charIdx === currentSentence.length) {
          isDeleting = true;
          timeoutId = setTimeout(runTypingCycle, 3000); // Pause to read the full sentence
        } else {
          timeoutId = setTimeout(runTypingCycle, typeLatency);
        }
      }
    };

    timeoutId = setTimeout(runTypingCycle, 1000);
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div className="flex flex-col gap-8 w-full max-w-lg relative z-10">
      <div
        className="text-2xl md:text-3xl font-medium tracking-tight leading-relaxed min-h-[96px]"
        style={{ color: colors.text.primary, fontFamily: "Georgia, serif" }}
      >
        "{typed}
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
          className="inline-block w-[3px] h-[1em] ml-1 align-middle rounded-full"
          style={{ backgroundColor: brand.action }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div
          className="flex justify-between items-center text-xs font-bold uppercase tracking-widest opacity-60"
          style={{ color: colors.text.secondary }}
        >
          <span>Live IKI Mapping</span>
          <span style={{ color: brand.action }}>
            {ikis[ikis.length - 1] ? Math.round(ikis[ikis.length - 1]) : 0}ms
          </span>
        </div>
        <div className="h-24 flex items-end gap-[4px] w-full overflow-hidden relative">
          <div
            className="absolute bottom-0 left-0 w-full h-[1px] opacity-20"
            style={{ backgroundColor: colors.surface[200] }}
          />
          {ikis.map((latency, i) => {
            // Normalise height, capping extremely fast deletes or slow pauses visually
            const heightPercent = Math.min(
              100,
              Math.max(15, (latency / 250) * 100),
            );

            // Color shift: fast backspaces appear different from normal typing
            const barColor =
              latency < 75
                ? colors.surface[200]
                : latency > 200
                  ? brand.humanAccent
                  : brand.action;

            return (
              <motion.div
                key={`${i}-${latency}`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: `${heightPercent}%`, opacity: 1 }}
                className="flex-1 rounded-t-sm"
                style={{
                  backgroundColor: barColor,
                  opacity: 0.5 + (i / ikis.length) * 0.5,
                }}
              />
            );
          })}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2 }}
        className="inline-flex items-center gap-3 px-5 py-3 rounded-full backdrop-blur-md w-max shadow-2xl"
        style={{ backgroundColor: `${colors.text.light}CC` }}
      >
        <span
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: brand.humanAccent }}
        />
        <span
          className="text-xs font-bold tracking-widest uppercase"
          style={{ color: brand.humanText }}
        >
          Human Pattern Verified
        </span>
      </motion.div>
    </div>
  );
}

// ─── Technical Trust Accordion ───────────────────────────────────────────────
const faqs = [
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
      "Academic integrity requires absolute transparency. Our Random Forest classification model, including its feature extraction logic and synthetic datasets (SMOTE), is fully auditable by university IT departments.",
  },
];

function TrustAccordion() {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  return (
    <div
      className="flex flex-col w-full border-t"
      style={{ borderColor: colors.surface[200] }}
    >
      {faqs.map((faq, index) => {
        const isActive = activeIndex === index;
        return (
          <div
            key={index}
            className="border-b overflow-hidden cursor-pointer group"
            style={{ borderColor: colors.surface[200] }}
            onClick={() => setActiveIndex(isActive ? -1 : index)}
          >
            <div className="py-8 flex justify-between items-center transition-colors duration-300">
              <h3
                className="text-xl md:text-2xl tracking-tight transition-all duration-300"
                style={{
                  color: isActive ? colors.text.primary : colors.text.secondary,
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {faq.title}
              </h3>
              <motion.div
                animate={{ rotate: isActive ? 45 : 0 }}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                style={{
                  backgroundColor: isActive ? brand.action : "transparent",
                  color: isActive ? colors.text.light : colors.text.primary,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </motion.div>
            </div>
            <AnimatePresence>
              {isActive && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <p
                    className="pb-8 text-base md:text-lg leading-relaxed max-w-2xl"
                    style={{ color: colors.text.secondary }}
                  >
                    {faq.content}
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

// ─── Main Page Assembly ──────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <main
      className="w-full min-h-screen overflow-x-hidden"
      style={{ backgroundColor: colors.text.light }}
    >
      {/* ═══════════════════════════════════════════════════════
          1. HERO SECTION
      ═══════════════════════════════════════════════════════ */}
      <section className="relative pt-32 md:pt-20 pb-12 px-6 md:px-12 max-w-[1440px] mx-auto min-h-[90vh] flex items-center">
        {/* Spatial Backgrounds */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage: `radial-gradient(${colors.surface[200]} 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }}
        />
        <div
          className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full blur-3xl opacity-20 pointer-events-none translate-x-1/3 -translate-y-1/4"
          style={{ backgroundColor: brand.action }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-8 items-center w-full relative z-10">
          <div className="lg:col-span-7 flex flex-col items-start gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-widest"
              style={{
                backgroundColor: `${brand.action}11`,
                borderColor: `${brand.action}33`,
                color: brand.action,
              }}
            >
              Academic Integrity Infrastructure
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tighter leading-[1.05]"
              style={{ color: colors.text.primary }}
            >
              Your typing is your <br />
              <span className="relative z-10" style={{ color: brand.action }}>
                proof of humanity.
                <span
                  className="absolute -bottom-2 left-0 w-full h-[6px] opacity-20 rounded-full"
                  style={{ backgroundColor: brand.action }}
                />
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl max-w-2xl leading-relaxed"
              style={{ color: colors.text.secondary }}
            >
              TypeTrace captures your behavioral keystroke dynamics to
              cryptographically prove you authored your own work—protecting
              innocent students from false AI accusations.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap items-center gap-6 mt-4"
            >
              <Link
                to={ROUTES.REGISTER}
                className="px-10 py-4 rounded-lg font-semibold text-[15px] transition-transform hover:-translate-y-1 inline-flex items-center gap-2"
                style={{
                  backgroundColor: brand.action,
                  color: colors.text.light,
                  boxShadow: `0 20px 40px -10px ${brand.action}66`,
                }}
              >
                Start Live Session <ArrowRight />
              </Link>
              <Link
                to={ROUTES.HOW_IT_WORKS}
                className="px-10 py-4 rounded-lg font-semibold text-[15px] transition-colors duration-300"
                style={{ color: colors.text.primary }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = `${colors.surface[200]}55`)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                Explore the Tech Stack
              </Link>
            </motion.div>
          </div>

          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <SpatialTypingVisualizer />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          2. THE CRISIS (Data-Driven Hook)
      ═══════════════════════════════════════════════════════ */}
      <section
        className="py-24 px-6 md:px-12"
        style={{
          backgroundColor: colors.surface[50],
          borderTop: `1px solid ${colors.surface[200]}`,
        }}
      >
        <div className="max-w-[1000px] mx-auto text-center flex flex-col items-center gap-8">
          <h2
            className="text-3xl md:text-5xl font-bold tracking-tight leading-tight"
            style={{ color: colors.text.primary }}
          >
            Current AI detectors analyze the{" "}
            <span className="italic">final text</span>.<br /> That is a
            fundamental architectural flaw.
          </h2>
          <p
            className="text-lg md:text-xl leading-relaxed max-w-3xl"
            style={{ color: colors.text.secondary }}
          >
            Standard AI detectors produce up to a{" "}
            <strong style={{ color: brand.aiAccent }}>
              35% false-positive rate
            </strong>{" "}
            for ESL students and formal writers. By evaluating <em>what</em> was
            written rather than <em>how</em> it was written, universities are
            penalizing authentic human effort.
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          3. DEEP DIVE FEATURES (Alternating Asymmetric Layout)
      ═══════════════════════════════════════════════════════ */}
      <section className="py-32 px-6 md:px-12 max-w-[1440px] mx-auto flex flex-col gap-32">
        {/* Feature 1: Sub-millisecond Capture */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="flex flex-col gap-6 order-2 lg:order-1">
            <div
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: brand.action }}
            >
              Phase 01 — Data Ingestion
            </div>
            <h3
              className="text-4xl md:text-5xl font-bold tracking-tight"
              style={{ color: colors.text.primary }}
            >
              Sub-millisecond behavioral capture.
            </h3>
            <p
              className="text-lg leading-relaxed"
              style={{ color: colors.text.secondary }}
            >
              TypeTrace does not wait for you to finish writing. Operating at
              the DOM level, our React 18 frontend intercepts every `keydown`
              and `keyup` event. We calculate the Inter-Key Interval (IKI) and
              dwell time with exact precision, creating a time-series dataset of
              your unique rhythm.
            </p>
            <ul className="flex flex-col gap-3 mt-4">
              {[
                "Zero UI latency via Virtual DOM optimization",
                "Captures backspaces, pauses, and cursor jumps",
                "Browser-agnostic event normalization",
              ].map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 text-[15px]"
                  style={{ color: colors.text.secondary }}
                >
                  <span style={{ color: brand.action }}>
                    <CheckIcon />
                  </span>{" "}
                  {item}
                </li>
              ))}
            </ul>
          </div>
          {/* Abstract Borderless Visual: Data Stream */}
          <div className="h-[400px] flex flex-col justify-center gap-4 relative order-1 lg:order-2">
            <div
              className="absolute inset-0 opacity-10 rounded-full blur-3xl"
              style={{ backgroundColor: brand.action }}
            />
            {[1, 2, 3, 4, 5].map((_, i) => (
              <motion.div
                key={i}
                animate={{ x: [0, -20, 0] }}
                transition={{
                  duration: 3 + i,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="w-full flex items-center gap-2 opacity-60"
              >
                <div
                  className="h-[1px] flex-1"
                  style={{ backgroundColor: colors.surface[200] }}
                />
                <span
                  className="font-mono text-xs font-bold"
                  style={{ color: brand.action }}
                >
                  &#123; keyCode: {65 + i * 2}, iki: {120 + i * 45}ms &#125;
                </span>
                <div
                  className="h-[1px] w-24"
                  style={{ backgroundColor: colors.surface[200] }}
                />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Feature 2: ML Inference */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="h-[400px] flex items-center justify-center relative">
            <div
              className="absolute inset-0 opacity-10 rounded-full blur-3xl"
              style={{ backgroundColor: brand.humanAccent }}
            />
            {/* Abstract ML Tree representation */}
            <div className="flex flex-col items-center gap-8 z-10">
              <div
                className="px-6 py-3 rounded-full text-sm font-bold border"
                style={{
                  backgroundColor: colors.surface[50],
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              >
                Vector Array Extraction
              </div>
              <div className="flex gap-16 relative">
                <div
                  className="absolute top-[-32px] left-[50%] w-[1px] h-8"
                  style={{ backgroundColor: colors.surface[200] }}
                />
                <div
                  className="px-6 py-3 rounded-full text-sm font-bold border"
                  style={{
                    backgroundColor: brand.humanBg,
                    borderColor: `${brand.humanAccent}40`,
                    color: brand.humanAccent,
                  }}
                >
                  Human Pattern
                </div>
                <div
                  className="px-6 py-3 rounded-full text-sm font-bold border opacity-40"
                  style={{
                    backgroundColor: colors.surface[50],
                    borderColor: colors.surface[200],
                    color: colors.text.secondary,
                  }}
                >
                  Anomalous Paste
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <div
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: brand.humanAccent }}
            >
              Phase 02 — Intelligence
            </div>
            <h3
              className="text-4xl md:text-5xl font-bold tracking-tight"
              style={{ color: colors.text.primary }}
            >
              Random Forest Classification.
            </h3>
            <p
              className="text-lg leading-relaxed"
              style={{ color: colors.text.secondary }}
            >
              Raw keystrokes are meaningless without context. Our FastAPI
              backend processes the raw array into engineered statistical
              features (mean IKI, standard deviation, deletion frequency). These
              features are fed into a serialized `scikit-learn` Random Forest
              model, trained on rigorously balanced datasets using SMOTE, to
              verify your authorship with 96%+ accuracy.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          4. THE VERIFICATION PROTOCOL (Horizontal Grid Layout)
          Refactored for perfect alignment and zero "messiness"
      ═══════════════════════════════════════════════════════ */}
      <section
        className="py-32 px-6 md:px-12"
        style={{
          backgroundColor: colors.surface[50],
          borderTop: `1px solid ${colors.surface[200]}`,
          borderBottom: `1px solid ${colors.surface[200]}`,
        }}
      >
        <div className="max-w-[1440px] mx-auto">
          <div className="mb-24 md:mb-32">
            <h2
              className="text-4xl md:text-5xl font-bold tracking-tight mb-4"
              style={{ color: colors.text.primary }}
            >
              The Verification Protocol
            </h2>
            <p
              className="text-lg max-w-2xl"
              style={{ color: colors.text.secondary }}
            >
              A mathematically precise, four-step integration into your existing
              academic workflow. Perfectly aligned from capture to cryptographic
              seal.
            </p>
          </div>

          {/* Clean Horizontal Grid Structure */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-16 relative">
            {/* Optional: Subtle connecting line for desktop only */}
            <div
              className="hidden lg:block absolute top-[11px] left-0 right-0 h-[1px] z-0"
              style={{ backgroundColor: colors.surface[200] }}
            />

            {[
              {
                title: "Initialize Session",
                desc: "Authenticate via your secure University Google Account. Open the zero-latency, distraction-free TypeTrace editor.",
              },
              {
                title: "Author Document",
                desc: "Write naturally. The React UI handles Virtual DOM updates locally, ensuring absolute privacy while biometrics are captured.",
              },
              {
                title: "Generate Proof",
                desc: "Upon completion, a background Celery worker extracts statistical features and runs inference through our ML pipeline.",
              },
              {
                title: "Download Cert",
                desc: "Receive a ReportLab PDF containing your biometric outcome and a secure SHA-256 hash to submit with your assignment.",
              },
            ].map((step, i) => (
              <div key={i} className="relative z-10 flex flex-col gap-6">
                {/* Node indicator */}
                <div className="flex items-center gap-4">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center border-[4px]"
                    style={{
                      backgroundColor: brand.action,
                      borderColor: colors.surface[50],
                    }}
                  >
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                  <span
                    className="text-3xl font-bold opacity-20 font-mono tracking-tighter"
                    style={{ color: colors.text.primary }}
                  >
                    0{i + 1}
                  </span>
                </div>

                {/* Content */}
                <div>
                  <h3
                    className="text-xl font-bold tracking-tight mb-3"
                    style={{ color: colors.text.primary }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="text-[15px] leading-relaxed"
                    style={{ color: colors.text.secondary }}
                  >
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          5. TECHNICAL TRUST (Accordion)
      ═══════════════════════════════════════════════════════ */}
      <section className="py-32 px-6 md:px-12 max-w-[1440px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          <div className="lg:sticky lg:top-32">
            <h2
              className="text-4xl md:text-[3.25rem] leading-[1.05] font-bold tracking-tighter mb-8"
              style={{ color: colors.text.primary }}
            >
              Engineered for absolute data sovereignty.
            </h2>
            <p
              className="text-lg leading-relaxed max-w-md"
              style={{ color: colors.text.secondary }}
            >
              Institutional trust requires architectural transparency. TypeTrace
              was built with privacy-first paradigms, ensuring biometric data is
              never monetized, stored unnecessarily, or mishandled.
            </p>
          </div>
          <div>
            <TrustAccordion />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          6. THE ESCALATION (Final CTA Anchor)
      ═══════════════════════════════════════════════════════ */}
      <section
        className="py-32 px-6 text-center"
        style={{ backgroundColor: brand.action }}
      >
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-8">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-white leading-tight">
            Stop worrying about false accusations.
          </h2>
          <p className="text-lg md:text-xl text-white opacity-90 max-w-xl leading-relaxed">
            Create your student account today and generate cryptographic proof
            of your hard work in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-8 w-full justify-center">
            <Link
              to={ROUTES.REGISTER}
              className="px-10 py-4 rounded-lg font-semibold text-[15px] transition-transform hover:-translate-y-1 inline-flex items-center gap-2"
              style={{
                backgroundColor: colors.text.light,
                color: brand.action,
                boxShadow: `0 20px 40px -10px ${brand.action}66`,
              }}
            >
              Start Writing Now <ArrowRight />
            </Link>
            <Link
              to={ROUTES.LOGIN}
              className="px-10 py-4 rounded-lg font-semibold text-[15px] transition-colors duration-300"
              style={{ color: "white" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor =
                  "rgba(255,255,255,0.1)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              Sign In
            </Link>
          </div>
          <p className="text-sm text-white/60 mt-4">
            Free for undergraduate students. GDPR Compliant.
          </p>
        </div>
      </section>
    </main>
  );
}
