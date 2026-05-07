import { Link } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { useEffect } from "react";

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

function ArrowRight() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 7.5h9M8 3.5l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// tbh making these custom svgs takes time but looks way better than generic fontawesome icons
function CaptureArt() {
  return (
    <svg viewBox="0 0 200 120" className="w-full h-full text-brand" fill="none">
      <rect
        x="20"
        y="30"
        width="160"
        height="60"
        rx="8"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="4 4"
        opacity="0.4"
      />
      <path
        d="M40 60 H70 L80 40 L100 80 L110 60 H160"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="80" cy="40" r="4" fill="currentColor" />
      <circle cx="100" cy="80" r="4" fill="currentColor" />
    </svg>
  );
}

function AnalysisArt() {
  return (
    <svg viewBox="0 0 200 120" className="w-full h-full text-brand" fill="none">
      <rect
        x="40"
        y="20"
        width="120"
        height="80"
        rx="8"
        stroke="currentColor"
        strokeWidth="2"
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
        strokeWidth="2"
      />
      <line
        x1="100"
        y1="80"
        x2="100"
        y2="100"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="100" cy="60" r="12" fill="currentColor" opacity="0.2" />
      <path d="M95 60 L105 55 V65 Z" fill="currentColor" />
    </svg>
  );
}

function CertifyArt() {
  return (
    <svg viewBox="0 0 200 120" className="w-full h-full text-brand" fill="none">
      <path
        d="M70 20 H120 A10 10 0 0 1 130 30 V90 A10 10 0 0 1 120 100 H70 A10 10 0 0 1 60 90 V30 A10 10 0 0 1 70 20 Z"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.5"
      />
      <circle cx="95" cy="50" r="10" stroke="currentColor" strokeWidth="2" />
      <path
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
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="75"
        y1="85"
        x2="100"
        y2="85"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function HowItWorksPage() {
  // scrolling to top on mount cos router sometimes keeps scroll position from prev page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="bg-surface-50 min-h-screen">
      {/* --- HERO SECTION --- */}
      <section className="pt-24 pb-16 px-6 sm:px-12 lg:px-20 max-w-[1280px] mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand/5 border border-brand/10 text-brand text-[12px] font-semibold mb-6">
          <BrainIcon />
          <span>Core Methodology</span>
        </div>
        <h1 className="text-[40px] sm:text-[52px] font-semibold text-text-primary tracking-tight leading-tight max-w-3xl mx-auto mb-6">
          The Science Behind <span className="text-brand">TypeTrace</span>
        </h1>
        <p className="text-[17px] text-text-secondary leading-relaxed max-w-2xl mx-auto">
          We don't detect AI. We verify humanity. By shifting the focus from the
          final text output to the behavioral process of writing, TypeTrace
          provides mathematical proof of authorship that generative models
          cannot fake.
        </p>
      </section>

      {/* --- SECTION 1: THE PROCESS (3 Columns) --- */}
      <section className="py-20 bg-white border-y border-surface-200">
        <div className="max-w-[1280px] mx-auto px-6 sm:px-12 lg:px-20">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Step 1 */}
            <article className="flex flex-col group">
              <div className="h-[180px] rounded-2xl bg-surface-50 border border-surface-200 mb-6 flex items-center justify-center p-6 transition-all duration-300 group-hover:border-brand/30 group-hover:bg-brand/5 overflow-hidden relative">
                <CaptureArt />
              </div>
              <span className="text-brand font-bold text-[13px] tracking-widest uppercase mb-2">
                Phase 1
              </span>
              <h3 className="text-[22px] font-semibold text-text-primary mb-3">
                Biometric Capture
              </h3>
              <p className="text-[15px] text-text-secondary leading-[1.7] mb-6 flex-grow">
                As you type in our distraction-free editor, the system silently
                records millisecond-precision timing for every keydown and keyup
                event. We calculate Inter-Key Intervals (IKI) and key dwell
                times. Because human neural pathways have inherent latencies,
                your typing exhibits natural micro-variations (typically between
                150-400ms) that are physically impossible for an AI inference
                pass to replicate.
              </p>
              <div className="pt-4 border-t border-surface-200">
                <span className="block text-[28px] font-bold text-text-primary leading-none mb-1">
                  &lt;10ms
                </span>
                <span className="text-[13px] text-text-secondary">
                  Capture latency (zero lag for user)
                </span>
              </div>
            </article>

            {/* Step 2 */}
            <article className="flex flex-col group">
              <div className="h-[180px] rounded-2xl bg-surface-50 border border-surface-200 mb-6 flex items-center justify-center p-6 transition-all duration-300 group-hover:border-brand/30 group-hover:bg-brand/5 overflow-hidden relative">
                <AnalysisArt />
              </div>
              <span className="text-brand font-bold text-[13px] tracking-widest uppercase mb-2">
                Phase 2
              </span>
              <h3 className="text-[22px] font-semibold text-text-primary mb-3">
                Behavioral Analysis
              </h3>
              <p className="text-[15px] text-text-secondary leading-[1.7] mb-6 flex-grow">
                The raw time-series data is converted into a structured feature
                vector. We analyze typing bursts, pause frequencies during
                sentence formulation, and deletion rates (backspace usage). Our
                Isolation Forest machine learning algorithm then evaluates this
                vector against established human baselines, looking for the
                mechanical uniformity and instant paste events characteristic of
                AI generation.
              </p>
              <div className="pt-4 border-t border-surface-200">
                <span className="block text-[28px] font-bold text-text-primary leading-none mb-1">
                  5+
                </span>
                <span className="text-[13px] text-text-secondary">
                  Independent behavioral vectors analyzed
                </span>
              </div>
            </article>

            {/* Step 3 */}
            <article className="flex flex-col group">
              <div className="h-[180px] rounded-2xl bg-surface-50 border border-surface-200 mb-6 flex items-center justify-center p-6 transition-all duration-300 group-hover:border-brand/30 group-hover:bg-brand/5 overflow-hidden relative">
                <CertifyArt />
              </div>
              <span className="text-brand font-bold text-[13px] tracking-widest uppercase mb-2">
                Phase 3
              </span>
              <h3 className="text-[22px] font-semibold text-text-primary mb-3">
                Cryptographic Sealing
              </h3>
              <p className="text-[15px] text-text-secondary leading-[1.7] mb-6 flex-grow">
                Once classification is complete, the entire session footprint is
                compiled into a downloadable PDF certificate. To ensure academic
                integrity and prevent tampering, the raw keystroke JSON data is
                hashed using the SHA-256 algorithm. The resulting hash is
                embedded in the certificate, allowing university instructors to
                independently verify that the submitted document exactly matches
                the recorded typing session.
              </p>
              <div className="pt-4 border-t border-surface-200">
                <span className="block text-[28px] font-bold text-text-primary leading-none mb-1">
                  SHA-256
                </span>
                <span className="text-[13px] text-text-secondary">
                  Military-grade cryptographic hashing
                </span>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* --- SECTION 2: THE ML MODEL (2 Columns + Chart) --- */}
      {/* using surface-100 to act as the "Neutral Slate" requested in prompt */}
      <section className="py-24 bg-surface-100">
        <div className="max-w-[1280px] mx-auto px-6 sm:px-12 lg:px-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-[32px] sm:text-[38px] font-semibold text-text-primary leading-tight mb-6">
              Inside the Machine Learning Engine
            </h2>
            <div className="flex flex-col gap-5 text-[16px] text-text-secondary leading-relaxed">
              <p>
                Current AI detectors rely on Natural Language Processing (NLP)
                to guess if text looks "robotic." This approach is fundamentally
                flawed and heavily biases against non-native English speakers
                who naturally write with less linguistic variance.
              </p>
              <p>
                TypeTrace ignores the words completely. Instead, our Random
                Forest classifier looks purely at{" "}
                <strong>Inter-Key Interval (IKI)</strong> distributions and
                editing patterns.
              </p>
              <p>
                A human typing 500 words will pause to think, delete mistakes,
                and vary their speed. An AI generating 500 words produces it in
                a single mechanical burst. By training on a dataset of authentic
                student essays and simulated AI paste attacks, the model
                accurately flags the absence of human struggle.
              </p>
            </div>

            <div className="mt-8 flex gap-4">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-widest text-verify px-3 py-1.5 rounded-full bg-verify-bg border border-verify/20">
                Model Accuracy: 96.3%
              </span>
            </div>
          </div>

          {/* Custom Feature Importance Chart */}
          {/* I built this manually with divs cos its cleaner and loads instantly without heavy chart libraries */}
          <div className="bg-white p-8 rounded-2xl border border-surface-200 shadow-card-md">
            <h3 className="text-[14px] font-bold uppercase tracking-widest text-text-secondary mb-6 border-b border-surface-200 pb-4">
              Algorithm Feature Importance
            </h3>

            <div className="flex flex-col gap-5">
              {[
                {
                  label: "IKI Variance (Timing inconsistency)",
                  value: 38,
                  color: "bg-brand",
                },
                {
                  label: "Paste Event Detection",
                  value: 26,
                  color: "bg-danger",
                },
                {
                  label: "Pause Frequency (>1000ms)",
                  value: 18,
                  color: "bg-[#4A6E96]",
                }, // steel color from colors.ts
                { label: "IKI Mean", value: 12, color: "bg-[#4A6E96]/70" },
                { label: "Deletion Rate", value: 6, color: "bg-[#4A6E96]/50" },
              ].map((item, index) => (
                <div key={index} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[13px] font-medium text-text-primary">
                    <span>{item.label}</span>
                    <span>{item.value}%</span>
                  </div>
                  <div className="w-full bg-surface-100 rounded-full h-2.5 overflow-hidden">
                    {/* slight transition on load makes it feel premium */}
                    <div
                      className={`h-full rounded-full ${item.color} transition-all duration-1000 ease-out`}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[12px] text-text-secondary mt-6 italic">
              * Weights derived from training phase using isolation forest
              anomaly detection.
            </p>
          </div>
        </div>
      </section>

      {/* --- SECTION 3: WHY IT MATTERS (Stats Layout) --- */}
      <section className="py-24 bg-white border-t border-surface-200">
        <div className="max-w-[1280px] mx-auto px-6 sm:px-12 lg:px-20">
          <div className="max-w-3xl mb-16">
            <h2 className="text-[32px] sm:text-[38px] font-semibold text-text-primary leading-tight mb-4">
              Solving the False Positive Crisis
            </h2>
            <p className="text-[17px] text-text-secondary leading-relaxed">
              The academic world is currently experiencing a crisis of false
              accusations. Innocent students are facing academic misconduct
              panels simply because their formal writing triggered a reactive AI
              text detector.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 border-t border-surface-200 pt-12">
            <div className="flex flex-col gap-2">
              <span className="text-[48px] font-bold text-danger leading-none">
                26%
              </span>
              <h4 className="text-[16px] font-semibold text-text-primary mt-2">
                Traditional False Positives
              </h4>
              <p className="text-[14px] text-text-secondary leading-relaxed">
                Studies show standard AI detectors falsely flag up to 26% of
                original human writing, disproportionately affecting ESL
                students.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[48px] font-bold text-verify leading-none">
                &lt;5%
              </span>
              <h4 className="text-[16px] font-semibold text-text-primary mt-2">
                TypeTrace Target FPR
              </h4>
              <p className="text-[14px] text-text-secondary leading-relaxed">
                By using behavioral biometrics rather than text analysis, we
                drastically reduce the chance of a false positive accusation.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[48px] font-bold text-brand leading-none">
                100%
              </span>
              <h4 className="text-[16px] font-semibold text-text-primary mt-2">
                Student Data Control
              </h4>
              <p className="text-[14px] text-text-secondary leading-relaxed">
                GDPR compliant by design. Your keystroke data is stored locally
                in your browser until you explicitly choose to generate a
                certificate.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- SECTION 4: CTA (Copied from homepage as requested) --- */}
      <section
        className="border-t border-surface-200"
        style={{
          paddingLeft: "80px",
          paddingRight: "80px",
          paddingTop: "80px",
          paddingBottom: "80px",
          background:
            "linear-gradient(160deg, #F5F7FA 0%, #EBF4FF 60%, #F5F7FA 100%)",
        }}
      >
        <div className="max-w-[640px] mx-auto text-center flex flex-col items-center gap-6">
          <h2 className="text-[30px] sm:text-[36px] font-semibold text-text-primary tracking-tight leading-tight">
            See your typing pattern
            <br />
            analysed in real time
          </h2>

          <p className="text-[16px] text-text-secondary leading-relaxed max-w-md">
            Open the editor, start writing, and watch your behavioural
            fingerprint build — live. Your first certificate takes minutes.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-2">
            <Link
              to={ROUTES.EDITOR_NEW}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-[14px] font-medium text-white bg-brand rounded-xl transition-all duration-150 hover:bg-brand-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 shadow-[0_4px_16px_rgba(42,127,224,0.25)] hover:shadow-[0_6px_20px_rgba(42,127,224,0.35)]"
            >
              Open Editor — Start Typing
              <ArrowRight />
            </Link>
            <Link
              to={ROUTES.REGISTER}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-[14px] font-medium text-text-secondary bg-white border border-surface-200 rounded-xl transition-all duration-150 hover:border-brand/30 hover:text-brand active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              Create Free Account
            </Link>
          </div>

          <p className="text-[12px] text-text-secondary/60">
            No account required to try · Free for students
          </p>
        </div>
      </section>
    </div>
  );
}
