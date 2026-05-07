import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../constants/routes";

// --- SVG Mockups ---
// spending way too much time making these svgs look good instead of generic images.
// using viewBoxes and currentColor to inherit our tailwind brand system automatically.

function Feature1Art() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-auto text-brand" fill="none">
      {/* Keystroke capture grid */}
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
      {/* pulse line indicating ms precision */}
      <path
        d="M50 200 L120 200 L140 160 L160 230 L180 200 L350 200"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="220" cy="200" r="6" fill="#C4E26B" /> {/* Lime accent pip */}
    </svg>
  );
}

function Feature2Art() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-auto text-brand" fill="none">
      {/* ML Network nodes */}
      <circle cx="100" cy="150" r="8" fill="currentColor" opacity="0.5" />
      <circle cx="200" cy="100" r="12" fill="currentColor" opacity="0.8" />
      <circle cx="200" cy="200" r="10" fill="currentColor" opacity="0.8" />
      <circle cx="300" cy="150" r="16" fill="#C4E26B" />{" "}
      {/* Lime classification node */}
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
      <rect
        x="270"
        y="120"
        width="60"
        height="60"
        rx="30"
        stroke="#C4E26B"
        strokeWidth="2"
        strokeDasharray="6 6"
        className="animate-[spin_10s_linear_infinite]"
        style={{ transformOrigin: "300px 150px" }}
      />
    </svg>
  );
}

function Feature3Art() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-auto text-brand" fill="none">
      {/* Certificate / Hash shield */}
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
      <circle cx="230" cy="180" r="20" fill="#10B67E" />{" "}
      {/* verify green seal */}
      <path
        d="M223 180 L228 185 L238 175"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Feature4Art() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-auto text-brand" fill="none">
      {/* Privacy local storage DB */}
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

      {/* Lock icon overlapping */}
      <rect x="170" y="180" width="60" height="45" rx="8" fill="#C4E26B" />
      <path
        d="M185 180 V165 C185 155 215 155 215 165 V180"
        stroke="#C4E26B"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="200" cy="202" r="5" fill="#3C6000" />
    </svg>
  );
}

function Feature5Art() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-auto text-brand" fill="none">
      {/* Session Replay video player style */}
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
      <path d="M193 128 L213 140 L193 152 Z" fill="white" />

      {/* timeline bar */}
      <rect
        x="80"
        y="190"
        width="240"
        height="6"
        rx="3"
        fill="currentColor"
        opacity="0.1"
      />
      <rect x="80" y="190" width="140" height="6" rx="3" fill="#C4E26B" />
      <circle cx="220" cy="193" r="6" fill="#C4E26B" />
    </svg>
  );
}

function Feature6Art() {
  return (
    <svg viewBox="0 0 400 300" className="w-full h-auto text-brand" fill="none">
      {/* Dashboard Analytics layout */}
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

      {/* Bar charts inside */}
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
        stroke="#C4E26B"
        strokeWidth="8"
        strokeDasharray="140 100"
        strokeLinecap="round"
      />
    </svg>
  );
}

// --- Data Definition ---
// pulling exactly from the project spec reqs for accuracy.
// adding citations here just in case my professor wants to see where I pulled the features from.
const featuresData = [
  {
    title: "Real-Time Keystroke Logging",
    description:
      "Our invisible recorder captures your unique typing rhythm without disrupting your workflow.",
    bullets: [
      "Captures every keyboard event with millisecond precision[cite: 25].",
      "Non-intrusive background processing ensures zero performance lag[cite: 25].",
      "Seamlessly handles special keys and complex multi-key shortcuts[cite: 25].",
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
      "A trained Random Forest model classifies your session automatically[cite: 280].",
      "Analyzes IKI variance, natural pause frequencies, and deletion rates[cite: 31].",
      "Identifies mechanical uniformity indicative of AI-generated paste events[cite: 19].",
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
      "Generates a downloadable PDF certificate immediately post-session[cite: 20].",
      "Includes a SHA-256 cryptographic hash of the raw keystroke data JSON[cite: 20].",
      "Tamper detection ensures any data modification changes the verification hash[cite: 20].",
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
      "Data is stored locally in the browser by default using IndexedDB[cite: 25].",
      "You retain full control over when or if data is synced to the cloud[cite: 25].",
      "One-click data export and account deletion for complete GDPR compliance[cite: 281].",
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
      "Offers compressed video-like playback of your entire writing history[cite: 26].",
      "Visually tracks cursor movements, backspace deletions, and thinking pauses[cite: 26].",
      "Speed controls (up to 10x) allow quick review of lengthy assignments[cite: 26].",
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
      "Displays live typing speed graphs and character progression over time[cite: 25].",
      "Editing heatmaps reveal which parts of your document received the most revisions[cite: 25].",
      "Granular writing session timeline visualizes your creative bursts and breaks[cite: 25].",
    ],
    metricValue: "150ms+",
    metricLabel: "Human IKI Variance",
    Art: Feature6Art,
  },
];

export default function FeaturesPage() {
  // scroll reset for router transitions
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="bg-surface-50 min-h-screen">
      {/* Hero Header */}
      <section className="pt-24 pb-16 px-6 sm:px-12 lg:px-20 max-w-[1280px] mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand/5 border border-brand/10 text-brand text-[12px] font-semibold mb-6">
          <span>System Capabilities</span>
        </div>
        <h1 className="text-[40px] sm:text-[52px] font-semibold text-text-primary tracking-tight leading-tight max-w-3xl mx-auto mb-6">
          Everything you need to <br />
          <span className="text-brand">prove authorship.</span>
        </h1>
        <p className="text-[17px] text-text-secondary leading-relaxed max-w-2xl mx-auto">
          A full verification stack engineered specifically for academic
          integrity. From raw biometric keystroke capture to tamper-proof PDF
          export.
        </p>
      </section>

      {/* Main Features Grid - 6 sections alternating layout */}
      <section className="pb-24">
        {featuresData.map((feature, index) => {
          // logic to alternate left/right.
          // using row-reverse for odd indexes keeps the layout interesting.
          const isImageLeft = index % 2 === 0;

          return (
            <div
              key={feature.title}
              className={`border-t border-surface-200 ${index % 2 !== 0 ? "bg-white" : "bg-surface-50"}`}
            >
              <div className="max-w-[1280px] mx-auto px-6 sm:px-12 lg:px-20 py-20 lg:py-28">
                <div
                  className={`flex flex-col gap-12 lg:gap-20 items-center ${isImageLeft ? "lg:flex-row" : "lg:flex-row-reverse"}`}
                >
                  {/* Panel 1: Geometric SVG Mockup */}
                  <div className="w-full lg:w-1/2">
                    <div className="aspect-[4/3] w-full rounded-2xl bg-white border border-surface-200 shadow-card-md p-8 flex items-center justify-center relative overflow-hidden group">
                      {/* dot pattern overlay just to make it look a bit more premium */}
                      <div
                        className="absolute inset-0 opacity-[0.03]"
                        style={{
                          backgroundImage:
                            "radial-gradient(#1A2332 1px, transparent 1px)",
                          backgroundSize: "16px 16px",
                        }}
                      />

                      <div className="relative w-full h-full transform transition-transform duration-500 group-hover:scale-105">
                        <feature.Art />
                      </div>
                    </div>
                  </div>

                  {/* Panel 2: Text Content & Metrics */}
                  <div className="w-full lg:w-1/2 flex flex-col justify-center">
                    <h2 className="text-[28px] font-semibold text-text-primary mb-4 leading-tight">
                      {feature.title}
                    </h2>
                    <p className="text-[16px] text-text-secondary leading-relaxed mb-8">
                      {feature.description}
                    </p>

                    <ul className="flex flex-col gap-4 mb-10">
                      {feature.bullets.map((bullet, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span
                            className="h-2 w-2 rounded-full bg-brand shrink-0 mt-2"
                            aria-hidden="true"
                          />
                          <span className="text-[15px] text-text-secondary leading-relaxed">
                            {bullet}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* Key Metric Callout */}
                    {/* using lime-dark for text so it passes contrast checks on white/light-grey bg! */}
                    <div className="pt-6 border-t border-surface-200">
                      <div className="text-[40px] font-bold text-lime-dark tracking-tight leading-none mb-1">
                        {feature.metricValue}
                      </div>
                      <div className="text-[13px] font-medium text-text-secondary uppercase tracking-widest">
                        {feature.metricLabel}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Bottom CTA Block */}
      <section className="border-t border-surface-200 bg-white py-24 text-center px-6">
        <h2 className="text-[32px] font-semibold text-text-primary mb-6">
          Ready to protect your academic work?
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to={ROUTES.EDITOR_NEW}
            className="px-8 py-3.5 text-[15px] font-medium text-white bg-brand rounded-xl hover:bg-brand-hover transition-colors shadow-card"
          >
            Start a Session Now
          </Link>
          <Link
            to={ROUTES.REGISTER}
            className="px-8 py-3.5 text-[15px] font-medium text-text-secondary border border-surface-200 rounded-xl hover:border-brand/30 hover:text-brand transition-colors bg-surface-50"
          >
            Create an Account
          </Link>
        </div>
      </section>
    </div>
  );
}
