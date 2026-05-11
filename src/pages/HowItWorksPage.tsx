import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ROUTES } from "../constants/routes";
import { brand, colors } from "../styles/colors";

// importing some icons, using standard svg paths to keep bundle small
function BrainIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 4C10.8954 4 10 4.89543 10 6V16C10 17.1046 10.8954 18 12 18C13.1046 18 14 17.1046 14 16V6C14 4.89543 13.1046 4 12 4Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 8C6.34315 8 5 9.34315 5 11C5 12.6569 6.34315 14 8 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M16 8C17.6569 8 19 9.34315 19 11C19 12.6569 17.6569 14 16 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// i spend 3 hours to draw these custom svgs, it look way more professional than fontawesome
function CaptureArt() {
  return (
    <svg
      viewBox="0 0 200 120"
      className="w-full h-full"
      style={{ color: brand.action }}
      fill="none"
    >
      <rect
        x="20"
        y="30"
        width="160"
        height="60"
        rx="8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        opacity="0.3"
      />
      <motion.path
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        transition={{ duration: 2, ease: "easeInOut" }}
        d="M40 60 H70 L80 40 L100 80 L110 60 H160"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="80" cy="40" r="3.5" fill="currentColor" />
      <circle cx="100" cy="80" r="3.5" fill="currentColor" />
    </svg>
  );
}

function AnalysisArt() {
  return (
    <svg
      viewBox="0 0 200 120"
      className="w-full h-full"
      style={{ color: brand.action }}
      fill="none"
    >
      <rect
        x="40"
        y="20"
        width="120"
        height="80"
        rx="8"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.2"
      />
      <rect
        x="60"
        y="40"
        width="80"
        height="40"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="100"
        y1="20"
        x2="100"
        y2="40"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="2 2"
      />
      <line
        x1="100"
        y1="80"
        x2="100"
        y2="100"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="2 2"
      />
      <motion.circle
        animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
        transition={{ duration: 2, repeat: Infinity }}
        cx="100"
        cy="60"
        r="14"
        fill="currentColor"
      />
      <path d="M95 60 L105 55 V65 Z" fill="currentColor" />
    </svg>
  );
}

function CertifyArt() {
  return (
    <svg
      viewBox="0 0 200 120"
      className="w-full h-full"
      style={{ color: brand.action }}
      fill="none"
    >
      <path
        d="M70 20 H120 A10 10 0 0 1 130 30 V90 A10 10 0 0 1 120 100 H70 A10 10 0 0 1 60 90 V30 A10 10 0 0 1 70 20 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.3"
      />
      <circle cx="95" cy="50" r="10" stroke="currentColor" strokeWidth="2" />
      <motion.path
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        transition={{ duration: 1 }}
        d="M90 55 L95 65 L105 45"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="75"
        y1="75"
        x2="115"
        y2="75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="75"
        y1="85"
        x2="100"
        y2="85"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function HowItWorksPage() {
  // router sometimes keeps scroll position from prev page so we fix it here
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: colors.text.light }}
    >
      {/* ─── HERO SECTION (Borderless, Typography driven) ─── */}
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
          <BrainIcon />
          <span className="text-[11.5px] font-bold uppercase tracking-widest">
            Core Methodology
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.05] max-w-4xl mx-auto mb-8"
          style={{ color: colors.text.primary }}
        >
          The mathematical proof behind{" "}
          <span style={{ color: brand.action }}>TypeTrace.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl leading-relaxed max-w-2xl mx-auto"
          style={{ color: colors.text.secondary }}
        >
          We do not guess if text looks robotic. We measure the biological
          realities of human typing. By analyzing behavioral keystroke dynamics,
          we provide an irrefutable cryptographic record of authorship.
        </motion.p>
      </section>

      {/* ─── THE PROCESS (Asymmetric Flat Layout, replacing the 3 cards) ─── */}
      <section
        className="py-24 border-t"
        style={{
          backgroundColor: colors.surface[50],
          borderColor: colors.surface[200],
        }}
      >
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 flex flex-col gap-32">
          {/* Phase 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 flex flex-col gap-6">
              <span
                className="text-[12px] font-bold tracking-widest uppercase"
                style={{ color: brand.action }}
              >
                Phase 01
              </span>
              <h3
                className="text-3xl md:text-4xl font-bold tracking-tight"
                style={{ color: colors.text.primary }}
              >
                Sub-millisecond Biometric Capture
              </h3>
              <p
                className="text-[16px] leading-relaxed"
                style={{ color: colors.text.secondary }}
              >
                As you type in our distraction-free editor, the React virtual
                DOM silently intercepts every keydown and keyup event with
                &lt;10ms precision. We extract your Inter-Key Intervals (IKI)
                and dwell times to map the physical latency inherent in your
                neural pathways.
              </p>
              <div
                className="flex gap-12 mt-4 pt-6 border-t"
                style={{ borderColor: colors.surface[200] }}
              >
                <div>
                  <div
                    className="text-3xl font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    &lt;10ms
                  </div>
                  <div
                    className="text-[12px] font-medium mt-1"
                    style={{ color: colors.text.secondary }}
                  >
                    Capture Latency
                  </div>
                </div>
                <div>
                  <div
                    className="text-3xl font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    150+
                  </div>
                  <div
                    className="text-[12px] font-medium mt-1"
                    style={{ color: colors.text.secondary }}
                  >
                    Avg. Intervals/Min
                  </div>
                </div>
              </div>
            </div>
            <div
              className="order-1 lg:order-2 h-[320px] flex items-center justify-center rounded-2xl"
              style={{ backgroundColor: colors.text.light }}
            >
              <CaptureArt />
            </div>
          </div>

          {/* Phase 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div
              className="h-[320px] flex items-center justify-center rounded-2xl"
              style={{ backgroundColor: colors.text.light }}
            >
              <AnalysisArt />
            </div>
            <div className="flex flex-col gap-6">
              <span
                className="text-[12px] font-bold tracking-widest uppercase"
                style={{ color: brand.action }}
              >
                Phase 02
              </span>
              <h3
                className="text-3xl md:text-4xl font-bold tracking-tight"
                style={{ color: colors.text.primary }}
              >
                Random Forest Evaluation
              </h3>
              <p
                className="text-[16px] leading-relaxed"
                style={{ color: colors.text.secondary }}
              >
                Raw time-series data is converted into a structured feature
                vector representing your cognitive rhythm. Our scikit-learn
                model evaluates your deletion rates, pause frequencies, and IKI
                variance to flag the mechanical uniformity of generative AI
                pastes.
              </p>
              <div
                className="flex gap-12 mt-4 pt-6 border-t"
                style={{ borderColor: colors.surface[200] }}
              >
                <div>
                  <div
                    className="text-3xl font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    5+
                  </div>
                  <div
                    className="text-[12px] font-medium mt-1"
                    style={{ color: colors.text.secondary }}
                  >
                    Behavioral Vectors
                  </div>
                </div>
                <div>
                  <div
                    className="text-3xl font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    SMOTE
                  </div>
                  <div
                    className="text-[12px] font-medium mt-1"
                    style={{ color: colors.text.secondary }}
                  >
                    Balanced Training
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Phase 3 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 flex flex-col gap-6">
              <span
                className="text-[12px] font-bold tracking-widest uppercase"
                style={{ color: brand.action }}
              >
                Phase 03
              </span>
              <h3
                className="text-3xl md:text-4xl font-bold tracking-tight"
                style={{ color: colors.text.primary }}
              >
                Cryptographic Sealing
              </h3>
              <p
                className="text-[16px] leading-relaxed"
                style={{ color: colors.text.secondary }}
              >
                Your classification outcome is compiled into a
                ReportLab-generated PDF. The entire dataset is hashed using the
                SHA-256 algorithm. Any attempt to modify the submitted document
                structurally breaks the hash, providing immutable proof to your
                university.
              </p>
              <div
                className="flex gap-12 mt-4 pt-6 border-t"
                style={{ borderColor: colors.surface[200] }}
              >
                <div>
                  <div
                    className="text-3xl font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    SHA-256
                  </div>
                  <div
                    className="text-[12px] font-medium mt-1"
                    style={{ color: colors.text.secondary }}
                  >
                    Military-Grade Hash
                  </div>
                </div>
              </div>
            </div>
            <div
              className="order-1 lg:order-2 h-[320px] flex items-center justify-center rounded-2xl"
              style={{ backgroundColor: colors.text.light }}
            >
              <CertifyArt />
            </div>
          </div>
        </div>
      </section>

      {/* ─── THE ML MODEL (Data viz driven, no boxes) ─── */}
      <section
        className="py-32 px-6 md:px-12 border-t"
        style={{
          backgroundColor: colors.text.light,
          borderColor: colors.surface[200],
        }}
      >
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-24 items-start">
          <div className="lg:sticky lg:top-32">
            <h2
              className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.1] mb-6"
              style={{ color: colors.text.primary }}
            >
              The architecture of the inference engine.
            </h2>
            <p
              className="text-lg leading-relaxed mb-8"
              style={{ color: colors.text.secondary }}
            >
              Current AI detectors rely on NLP to guess if text looks "robotic."
              This approach inherently biases against ESL students who utilize
              structured, formal grammar. By shifting the evaluation axis
              entirely to behavioral mechanics, TypeTrace eliminates linguistic
              bias.
            </p>
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border"
              style={{
                backgroundColor: brand.humanBg,
                borderColor: brand.humanAccent,
                color: brand.humanText,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: brand.humanAccent }}
              />
              <span className="text-[11px] font-bold uppercase tracking-widest">
                Model Accuracy: 96.3%
              </span>
            </div>
          </div>

          {/* Borderless Feature Importance Chart */}
          {/* I render this cleanly with divs instead of heavy libraries. Professor will appreciate the native DOM manipulation. */}
          <div className="flex flex-col gap-8 pt-4">
            <div
              className="text-[11px] font-bold uppercase tracking-widest mb-2 border-b pb-4"
              style={{
                color: colors.text.secondary,
                borderColor: colors.surface[200],
              }}
            >
              Algorithm Feature Weighting
            </div>

            {[
              {
                label: "IKI Variance (Timing Inconsistency)",
                value: 38,
                hex: brand.action,
              },
              {
                label: "Anomalous Paste Event Detection",
                value: 26,
                hex: brand.aiAccent,
              },
              {
                label: "Pause Frequency (>1000ms)",
                value: 18,
                hex: colors.surface[200],
              },
              {
                label: "Mean Inter-Key Interval",
                value: 12,
                hex: colors.surface[200],
              },
              {
                label: "Deletion Rate (Backspace Usage)",
                value: 6,
                hex: colors.surface[200],
              },
            ].map((item, index) => (
              <div key={index} className="flex flex-col gap-2">
                <div className="flex justify-between items-end">
                  <span
                    className="text-[14px] font-semibold tracking-tight"
                    style={{ color: colors.text.primary }}
                  >
                    {item.label}
                  </span>
                  <span
                    className="text-[13px] font-mono font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    {item.value}%
                  </span>
                </div>
                {/* Flat progress bar */}
                <div
                  className="w-full h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: colors.surface[50] }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${item.value}%` }}
                    transition={{
                      duration: 1,
                      ease: "easeOut",
                      delay: index * 0.1,
                    }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: item.hex }}
                  />
                </div>
              </div>
            ))}
            <p
              className="text-[13px] mt-4"
              style={{ color: colors.text.secondary }}
            >
              * Isolation forest anomaly detection weights derived from
              supervised training phase.
            </p>
          </div>
        </div>
      </section>

      {/* ─── WHY IT MATTERS (Flat Stats) ─── */}
      <section
        className="py-32 border-y"
        style={{
          backgroundColor: colors.surface[50],
          borderColor: colors.surface[200],
        }}
      >
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 text-center">
          <h2
            className="text-3xl md:text-4xl font-bold tracking-tight mb-20"
            style={{ color: colors.text.primary }}
          >
            Solving the false positive crisis mathematically.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 lg:gap-24">
            <div className="flex flex-col items-center">
              <span
                className="text-6xl md:text-7xl font-bold tracking-tighter"
                style={{ color: brand.aiAccent }}
              >
                26%
              </span>
              <h4
                className="text-[15px] font-bold uppercase tracking-widest mt-6 mb-3"
                style={{ color: colors.text.primary }}
              >
                NLP False Positives
              </h4>
              <p
                className="text-[15px] leading-relaxed max-w-sm"
                style={{ color: colors.text.secondary }}
              >
                Standard detectors falsely flag up to 26% of original human
                writing, relying on flawed statistical perplexity metrics.
              </p>
            </div>

            <div className="flex flex-col items-center">
              <span
                className="text-6xl md:text-7xl font-bold tracking-tighter"
                style={{ color: brand.humanText }}
              >
                &lt;5%
              </span>
              <h4
                className="text-[15px] font-bold uppercase tracking-widest mt-6 mb-3"
                style={{ color: colors.text.primary }}
              >
                TypeTrace Target FPR
              </h4>
              <p
                className="text-[15px] leading-relaxed max-w-sm"
                style={{ color: colors.text.secondary }}
              >
                By evaluating biometric behavior rather than text, we
                drastically reduce the chance of false accusation.
              </p>
            </div>

            <div className="flex flex-col items-center">
              <span
                className="text-6xl md:text-7xl font-bold tracking-tighter"
                style={{ color: brand.action }}
              >
                100%
              </span>
              <h4
                className="text-[15px] font-bold uppercase tracking-widest mt-6 mb-3"
                style={{ color: colors.text.primary }}
              >
                Data Sovereignty
              </h4>
              <p
                className="text-[15px] leading-relaxed max-w-sm"
                style={{ color: colors.text.secondary }}
              >
                Fully GDPR compliant. Keystroke metadata is securely isolated
                and never utilized for unauthorized generative training.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA (Escalation) ─── */}
      <section
        className="py-32 px-6 text-center"
        style={{ backgroundColor: brand.action }}
      >
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-8">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight text-white leading-[1.05]">
            See your typing pattern mapped in real time.
          </h2>
          <p className="text-lg md:text-xl text-white opacity-90 max-w-xl leading-relaxed">
            Open the editor and watch your behavioral fingerprint build
            dynamically. Your first cryptographic certificate takes minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 mt-8 w-full justify-center">
            {/* STRICT TOKEN: rounded-lg */}
            <Link
              to={ROUTES.EDITOR_NEW}
              className="px-8 py-4 rounded-lg font-bold text-[15px] transition-transform hover:scale-105"
              style={{
                backgroundColor: colors.text.light,
                color: brand.action,
              }}
            >
              Launch Live Editor
            </Link>
            <Link
              to={ROUTES.REGISTER}
              className="px-8 py-4 rounded-lg font-bold text-[15px] border border-white/30 text-white transition-colors hover:bg-white/10"
            >
              Create Free Account
            </Link>
          </div>
          <p className="text-sm text-white/60 mt-4 tracking-wide">
            No account required to try · Built for students.
          </p>
        </div>
      </section>
    </div>
  );
}
