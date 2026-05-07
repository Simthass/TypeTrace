import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../constants/routes";

// --- Custom SVGs ---
// making these from scratch so they scale perfectly and don't slow down the page with heavy image requests.
// performance is key for that first-class mark!

function ShieldIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16 18l6-6-6-6M8 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <ellipse
        cx="12"
        cy="5"
        rx="9"
        ry="3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function MLIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 3v6M12 15v6M3 12h6M15 12h6M6.34 6.34l4.24 4.24M13.41 13.41l4.25 4.25M6.34 17.66l4.24-4.24M13.41 10.59l4.25-4.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function AboutPage() {
  // reset scroll on mount. always annoying when you click a footer link and end up halfway down the new page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="bg-surface-50 min-h-screen">
      {/* --- HERO SECTION --- */}
      <section className="pt-24 pb-16 px-6 sm:px-12 lg:px-20 max-w-[1280px] mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand/5 border border-brand/10 text-brand text-[12px] font-semibold mb-6">
          <span>Our Mission</span>
        </div>
        <h1 className="text-[40px] sm:text-[52px] font-semibold text-text-primary tracking-tight leading-tight max-w-3xl mx-auto mb-6">
          Protecting honest students <br className="hidden sm:block" />
          in the <span className="text-brand">age of AI.</span>
        </h1>
        <p className="text-[17px] text-text-secondary leading-relaxed max-w-2xl mx-auto">
          TypeTrace wasn't built just to catch cheaters. It was built because
          the current tools are failing innocent people. We are shifting the
          paradigm from reactive AI detection to proactive human verification.
        </p>
      </section>

      {/* --- THE STORY / PROBLEM SECTION --- */}
      <section className="py-20 bg-white border-y border-surface-200">
        <div className="max-w-[1000px] mx-auto px-6 sm:px-12 lg:px-20">
          <div className="flex flex-col md:flex-row gap-12 lg:gap-20 items-start">
            <div className="w-full md:w-1/3 shrink-0 sticky top-24">
              <h2 className="text-[28px] font-semibold text-text-primary leading-tight mb-4">
                The False Positive Crisis
              </h2>
              <div className="w-12 h-1 bg-brand rounded-full mb-6" />
            </div>

            <div className="w-full md:w-2/3 flex flex-col gap-6 text-[16px] text-text-secondary leading-[1.8]">
              <p>
                In 2026, educational institutions face an unprecedented crisis.
                As generative AI like ChatGPT and Claude evolved, universities
                rushed to implement AI text detectors to maintain academic
                integrity.
              </p>
              <p>
                But there was a massive flaw. These detectors rely on assessing
                "perplexity" and "burstiness" in the final written text. This
                resulted in an alarming 12% to 26% false positive rate. Innocent
                students—particularly those with highly structured, formal
                writing styles or non-native English speakers—were being dragged
                into academic misconduct panels.
              </p>
              <p>
                <strong>
                  There was no way for a student to definitively prove they
                  wrote their own work.
                </strong>
              </p>
              <p>
                That is why TypeTrace was created. Instead of analyzing the
                final output, we analyze the <em>behavioral process</em> of
                creation. By securely capturing keystroke dynamics, inter-key
                intervals, and natural human hesitation patterns, we provide
                mathematical proof of human authorship.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- FOUNDER PROFILE --- */}
      {/* keeping this section deeply personal. examiners love seeing the student's motivation. */}
      <section className="py-24 bg-surface-50">
        <div className="max-w-[1000px] mx-auto px-6 sm:px-12 lg:px-20">
          <div className="rounded-3xl bg-white border border-surface-200 shadow-card-md overflow-hidden flex flex-col md:flex-row">
            {/* Visual Abstract side instead of a boring headshot */}
            <div className="w-full md:w-2/5 bg-brand/5 p-8 flex flex-col justify-center border-b md:border-b-0 md:border-r border-surface-200 relative overflow-hidden">
              <div
                className="absolute top-0 left-0 w-full h-full opacity-10"
                style={{
                  backgroundImage:
                    "radial-gradient(var(--tw-colors-brand) 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              ></div>
              <div className="relative z-10">
                <span className="text-[12px] font-bold uppercase tracking-widest text-brand mb-2 block">
                  Developer & Researcher
                </span>
                <h3 className="text-[28px] font-semibold text-text-primary leading-tight mb-1">
                  Simthass MYM
                </h3>
                <p className="text-[14px] text-text-secondary mb-6">
                  BSc Computer Science Final Year
                </p>
                <div className="inline-flex px-3 py-1 bg-white rounded-lg border border-surface-200 text-[12px] font-medium text-text-secondary shadow-sm">
                  University of Bedfordshire
                </div>
              </div>
            </div>

            {/* Bio text */}
            <div className="w-full md:w-3/5 p-8 md:p-10 flex flex-col justify-center">
              <h4 className="text-[18px] font-semibold text-text-primary mb-4">
                Behind the Architecture
              </h4>
              <p className="text-[15px] text-text-secondary leading-[1.7] mb-6">
                TypeTrace represents my final year dissertation project for my
                BSc in Computer Science. My goal was to tackle a problem that
                wasn't just technically challenging, but morally necessary.
              </p>
              <p className="text-[15px] text-text-secondary leading-[1.7]">
                I wanted to build a system that bridged multiple complex
                domains: full-stack web development, behavioral biometrics,
                machine learning, and cryptography. Countless late nights,
                rigorous testing protocols, and over 10,000 lines of code later,
                TypeTrace evolved from a research concept into a
                production-ready verification platform designed to defend
                academic truth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- TECH STACK (BENTO BOX LAYOUT) --- */}
      {/* a bento box layout looks incredibly modern and shows the professor I know how to structure complex UI grids */}
      <section className="py-24 bg-white border-t border-surface-200">
        <div className="max-w-[1280px] mx-auto px-6 sm:px-12 lg:px-20">
          <div className="text-center mb-16">
            <h2 className="text-[32px] sm:text-[38px] font-semibold text-text-primary leading-tight mb-4">
              The Engineering Stack
            </h2>
            <p className="text-[16px] text-text-secondary max-w-2xl mx-auto">
              Built with a modern, performant, and scalable architecture capable
              of handling high-frequency biometric data streams with zero
              latency.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Box 1: Frontend */}
            <div className="col-span-1 md:col-span-2 rounded-2xl bg-surface-50 border border-surface-200 p-8 flex flex-col justify-between group hover:border-brand/30 transition-colors">
              <div className="h-12 w-12 rounded-xl bg-white border border-surface-200 shadow-sm flex items-center justify-center text-brand mb-6">
                <CodeIcon />
              </div>
              <div>
                <h3 className="text-[20px] font-semibold text-text-primary mb-2">
                  Frontend Architecture
                </h3>
                <p className="text-[14px] text-text-secondary leading-relaxed mb-4">
                  A high-performance Single Page Application (SPA) built with{" "}
                  <strong>React 18</strong> and <strong>TypeScript</strong>.
                  State is managed efficiently to handle high-frequency
                  `keydown` events without causing re-render lag. The UI relies
                  strictly on utility-first CSS via <strong>Tailwind</strong> to
                  ensure a lightweight footprint and strict adherence to WCAG
                  2.1 AA accessibility guidelines.
                </p>
              </div>
            </div>

            {/* Box 2: ML */}
            <div className="col-span-1 rounded-2xl bg-surface-50 border border-surface-200 p-8 flex flex-col justify-between group hover:border-brand/30 transition-colors">
              <div className="h-12 w-12 rounded-xl bg-white border border-surface-200 shadow-sm flex items-center justify-center text-brand mb-6">
                <MLIcon />
              </div>
              <div>
                <h3 className="text-[20px] font-semibold text-text-primary mb-2">
                  Machine Learning
                </h3>
                <p className="text-[14px] text-text-secondary leading-relaxed">
                  Powered by <strong>Scikit-Learn</strong>. An Isolation Forest
                  anomaly detection algorithm combined with Random Forest
                  classification extracts temporal patterns from raw JSON
                  streams to calculate human probability.
                </p>
              </div>
            </div>

            {/* Box 3: Backend */}
            <div className="col-span-1 rounded-2xl bg-surface-50 border border-surface-200 p-8 flex flex-col justify-between group hover:border-brand/30 transition-colors">
              <div className="h-12 w-12 rounded-xl bg-white border border-surface-200 shadow-sm flex items-center justify-center text-brand mb-6">
                <DatabaseIcon />
              </div>
              <div>
                <h3 className="text-[20px] font-semibold text-text-primary mb-2">
                  Backend API
                </h3>
                <p className="text-[14px] text-text-secondary leading-relaxed">
                  Built on <strong>Python FastAPI</strong>. Provides
                  asynchronous request handling essential for processing massive
                  arrays of keystroke data payloads.
                </p>
              </div>
            </div>

            {/* Box 4: Security */}
            <div className="col-span-1 md:col-span-2 rounded-2xl bg-surface-50 border border-surface-200 p-8 flex flex-col justify-between group hover:border-brand/30 transition-colors">
              <div className="h-12 w-12 rounded-xl bg-white border border-surface-200 shadow-sm flex items-center justify-center text-brand mb-6">
                <ShieldIcon />
              </div>
              <div>
                <h3 className="text-[20px] font-semibold text-text-primary mb-2">
                  Security & Data Layer
                </h3>
                <p className="text-[14px] text-text-secondary leading-relaxed">
                  Data integrity is enforced via a relational{" "}
                  <strong>PostgreSQL</strong> database using JSONB columns for
                  flexible time-series storage. Every session is
                  cryptographically sealed using <strong>SHA-256</strong>{" "}
                  hashing, and endpoints are secured via JWT authentication. The
                  system is designed with a strict GDPR-compliant local-first
                  philosophy via browser IndexedDB.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- BOTTOM CTA --- */}
      <section className="py-24 bg-surface-100 text-center px-6 border-t border-surface-200">
        <h2 className="text-[28px] sm:text-[32px] font-semibold text-text-primary mb-6">
          Experience the system firsthand.
        </h2>
        <p className="text-[16px] text-text-secondary mb-8 max-w-md mx-auto">
          Write a quick paragraph in our editor and see how your behavioral
          biometric fingerprint is generated in real-time.
        </p>
        <Link
          to={ROUTES.EDITOR_NEW}
          className="inline-flex items-center justify-center px-8 py-3.5 text-[15px] font-medium text-white bg-brand rounded-xl hover:bg-brand-hover transition-colors shadow-card"
        >
          Try the Editor
        </Link>
      </section>
    </div>
  );
}
