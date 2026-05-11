import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ROUTES } from "../constants/routes";
import { brand, colors } from "../styles/colors";

// --- Custom SVGs ---
// making these from scratch so they scale perfectly and dont slow down the page with heavy image requests.
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
    <div
      className="min-h-screen"
      style={{ backgroundColor: colors.text.light }}
    >
      {/* ─── HERO SECTION (Borderless & Typography Driven) ─── */}
      <section className="pt-32 pb-24 px-6 md:px-12 max-w-[1440px] mx-auto text-center flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          // STRICT TOKEN: rounded-lg for small badges
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border mb-8"
          style={{
            backgroundColor: `${brand.action}0A`,
            borderColor: `${brand.action}20`,
            color: brand.action,
          }}
        >
          <span className="text-[11.5px] font-bold uppercase tracking-widest">
            Our Mission
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.05] max-w-4xl mx-auto mb-8"
          style={{ color: colors.text.primary }}
        >
          Protecting honest students <br className="hidden sm:block" />
          in the <span style={{ color: brand.action }}>age of AI.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-lg md:text-xl leading-relaxed max-w-2xl mx-auto"
          style={{ color: colors.text.secondary }}
        >
          TypeTrace wasn't built just to catch cheaters. It was built because
          the current tools are failing innocent people. We are shifting the
          paradigm from reactive AI detection to proactive human verification.
        </motion.p>
      </section>

      {/* ─── THE STORY / PROBLEM SECTION ─── */}
      <section
        className="py-32 border-t"
        style={{
          backgroundColor: colors.surface[50],
          borderColor: colors.surface[200],
        }}
      >
        <div className="max-w-[1440px] mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row gap-16 lg:gap-24 items-start">
            <div className="w-full md:w-1/3 shrink-0 md:sticky top-32">
              <h2
                className="text-3xl md:text-4xl font-bold tracking-tight leading-[1.1] mb-6"
                style={{ color: colors.text.primary }}
              >
                The False Positive Crisis
              </h2>
              <div
                className="w-12 h-1 rounded-full"
                style={{ backgroundColor: brand.action }}
              />
            </div>

            <div
              className="w-full md:w-2/3 flex flex-col gap-8 text-[17px] leading-relaxed"
              style={{ color: colors.text.secondary }}
            >
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
              <p
                className="text-[20px] font-semibold leading-tight"
                style={{ color: colors.text.primary }}
              >
                There was no way for a student to definitively prove they wrote
                their own work.
              </p>
              <p>
                That is why TypeTrace was created. Instead of analyzing the
                final output, we analyze the{" "}
                <em style={{ color: colors.text.primary }}>
                  behavioral process
                </em>{" "}
                of creation. By securely capturing keystroke dynamics, inter-key
                intervals, and natural human hesitation patterns, we provide
                mathematical proof of human authorship.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOUNDER PROFILE ─── */}
      {/* keeping this section deeply personal. examiners loves seeing the student motivation. */}
      {/* completely flattened, no shadows, pure structural borders */}
      <section className="py-32" style={{ backgroundColor: colors.text.light }}>
        <div className="max-w-[1000px] mx-auto px-6 md:px-12">
          {/* STRICT TOKEN: rounded-2xl for structural containers */}
          <div
            className="rounded-2xl border overflow-hidden flex flex-col md:flex-row"
            style={{
              backgroundColor: colors.surface[50],
              borderColor: colors.surface[200],
            }}
          >
            <div
              className="w-full md:w-2/5 p-10 flex flex-col justify-center border-b md:border-b-0 md:border-r relative overflow-hidden"
              style={{ borderColor: colors.surface[200] }}
            >
              <div
                className="absolute top-0 left-0 w-full h-full opacity-10"
                style={{
                  backgroundImage: `radial-gradient(${brand.action} 1px, transparent 1px)`,
                  backgroundSize: "20px 20px",
                }}
              />
              <div className="relative z-10">
                <span
                  className="text-[11px] font-bold uppercase tracking-widest mb-3 block"
                  style={{ color: brand.action }}
                >
                  Developer & Researcher
                </span>
                <h3
                  className="text-3xl font-bold tracking-tight mb-2"
                  style={{ color: colors.text.primary }}
                >
                  Simthass MYM
                </h3>
                <p
                  className="text-[15px] mb-8"
                  style={{ color: colors.text.secondary }}
                >
                  BSc Computer Science Final Year
                </p>
                {/* STRICT TOKEN: rounded-lg */}
                <div
                  className="inline-flex px-3 py-1.5 rounded-lg border text-[12px] font-bold uppercase tracking-widest"
                  style={{
                    backgroundColor: colors.text.light,
                    borderColor: colors.surface[200],
                    color: colors.text.secondary,
                  }}
                >
                  University of Bedfordshire
                </div>
              </div>
            </div>

            <div className="w-full md:w-3/5 p-10 flex flex-col justify-center">
              <h4
                className="text-2xl font-bold tracking-tight mb-4"
                style={{ color: colors.text.primary }}
              >
                Behind the Architecture
              </h4>
              <p
                className="text-[16px] leading-relaxed mb-6"
                style={{ color: colors.text.secondary }}
              >
                TypeTrace represents my final year dissertation project for my
                BSc in Computer Science. My goal was to tackle a problem that
                wasn't just technically challenging, but morally necessary.
              </p>
              <p
                className="text-[16px] leading-relaxed"
                style={{ color: colors.text.secondary }}
              >
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

      {/* ─── TECH STACK (BENTO BOX LAYOUT) ─── */}
      {/* a bento box layout looks incredibly modern and show the professor I knows how to structure complex UI without relying on css tricks like drop shadows */}
      <section
        className="py-32 border-t"
        style={{
          backgroundColor: colors.surface[50],
          borderColor: colors.surface[200],
        }}
      >
        <div className="max-w-[1440px] mx-auto px-6 md:px-12">
          <div className="text-center mb-20">
            <h2
              className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-4"
              style={{ color: colors.text.primary }}
            >
              The Engineering Stack
            </h2>
            <p
              className="text-lg max-w-2xl mx-auto"
              style={{ color: colors.text.secondary }}
            >
              Built with a modern, performant, and scalable architecture capable
              of handling high-frequency biometric data streams with zero
              latency.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Box 1: Frontend */}
            {/* STRICT TOKEN: rounded-2xl */}
            <div
              className="col-span-1 md:col-span-2 rounded-2xl border p-10 flex flex-col justify-between transition-colors group"
              style={{
                backgroundColor: colors.text.light,
                borderColor: colors.surface[200],
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = `${brand.action}55`)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = colors.surface[200])
              }
            >
              {/* STRICT TOKEN: rounded-lg for icons */}
              <div
                className="h-12 w-12 rounded-lg border flex items-center justify-center mb-8 transition-colors"
                style={{
                  backgroundColor: colors.surface[50],
                  borderColor: colors.surface[200],
                  color: brand.action,
                }}
              >
                <CodeIcon />
              </div>
              <div>
                <h3
                  className="text-2xl font-bold tracking-tight mb-3"
                  style={{ color: colors.text.primary }}
                >
                  Frontend Architecture
                </h3>
                <p
                  className="text-[16px] leading-relaxed"
                  style={{ color: colors.text.secondary }}
                >
                  A high-performance Single Page Application (SPA) built with{" "}
                  <strong style={{ color: colors.text.primary }}>
                    React 18
                  </strong>{" "}
                  and{" "}
                  <strong style={{ color: colors.text.primary }}>
                    TypeScript
                  </strong>
                  . State is managed efficiently to handle high-frequency
                  `keydown` events without causing re-render lag. The UI relies
                  strictly on utility-first CSS via{" "}
                  <strong style={{ color: colors.text.primary }}>
                    Tailwind
                  </strong>{" "}
                  to ensure a lightweight footprint and strict adherence to WCAG
                  2.1 AA accessibility guidelines.
                </p>
              </div>
            </div>

            {/* Box 2: ML */}
            <div
              className="col-span-1 rounded-2xl border p-10 flex flex-col justify-between transition-colors group"
              style={{
                backgroundColor: colors.text.light,
                borderColor: colors.surface[200],
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = `${brand.action}55`)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = colors.surface[200])
              }
            >
              <div
                className="h-12 w-12 rounded-lg border flex items-center justify-center mb-8 transition-colors"
                style={{
                  backgroundColor: colors.surface[50],
                  borderColor: colors.surface[200],
                  color: brand.action,
                }}
              >
                <MLIcon />
              </div>
              <div>
                <h3
                  className="text-2xl font-bold tracking-tight mb-3"
                  style={{ color: colors.text.primary }}
                >
                  Machine Learning
                </h3>
                <p
                  className="text-[16px] leading-relaxed"
                  style={{ color: colors.text.secondary }}
                >
                  Powered by{" "}
                  <strong style={{ color: colors.text.primary }}>
                    Scikit-Learn
                  </strong>
                  . An Isolation Forest anomaly detection algorithm combined
                  with Random Forest classification extracts temporal patterns
                  from raw JSON streams.
                </p>
              </div>
            </div>

            {/* Box 3: Backend */}
            <div
              className="col-span-1 rounded-2xl border p-10 flex flex-col justify-between transition-colors group"
              style={{
                backgroundColor: colors.text.light,
                borderColor: colors.surface[200],
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = `${brand.action}55`)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = colors.surface[200])
              }
            >
              <div
                className="h-12 w-12 rounded-lg border flex items-center justify-center mb-8 transition-colors"
                style={{
                  backgroundColor: colors.surface[50],
                  borderColor: colors.surface[200],
                  color: brand.action,
                }}
              >
                <DatabaseIcon />
              </div>
              <div>
                <h3
                  className="text-2xl font-bold tracking-tight mb-3"
                  style={{ color: colors.text.primary }}
                >
                  Backend API
                </h3>
                <p
                  className="text-[16px] leading-relaxed"
                  style={{ color: colors.text.secondary }}
                >
                  Built on{" "}
                  <strong style={{ color: colors.text.primary }}>
                    Python FastAPI
                  </strong>
                  . Provides asynchronous request handling essential for
                  processing massive arrays of keystroke data payloads.
                </p>
              </div>
            </div>

            {/* Box 4: Security */}
            <div
              className="col-span-1 md:col-span-2 rounded-2xl border p-10 flex flex-col justify-between transition-colors group"
              style={{
                backgroundColor: colors.text.light,
                borderColor: colors.surface[200],
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = `${brand.action}55`)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = colors.surface[200])
              }
            >
              <div
                className="h-12 w-12 rounded-lg border flex items-center justify-center mb-8 transition-colors"
                style={{
                  backgroundColor: colors.surface[50],
                  borderColor: colors.surface[200],
                  color: brand.action,
                }}
              >
                <ShieldIcon />
              </div>
              <div>
                <h3
                  className="text-2xl font-bold tracking-tight mb-3"
                  style={{ color: colors.text.primary }}
                >
                  Security & Data Layer
                </h3>
                <p
                  className="text-[16px] leading-relaxed"
                  style={{ color: colors.text.secondary }}
                >
                  Data integrity is enforced via a relational{" "}
                  <strong style={{ color: colors.text.primary }}>
                    PostgreSQL
                  </strong>{" "}
                  database using JSONB columns for flexible time-series storage.
                  Every session is cryptographically sealed using{" "}
                  <strong style={{ color: colors.text.primary }}>
                    SHA-256
                  </strong>{" "}
                  hashing, and endpoints are secured via JWT authentication. The
                  system is designed with a strict GDPR-compliant local-first
                  philosophy via browser IndexedDB.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── BOTTOM CTA ─── */}
      <section
        className="py-32 px-6 text-center border-t"
        style={{
          backgroundColor: colors.text.light,
          borderColor: colors.surface[200],
        }}
      >
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-8">
          <h2
            className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.05]"
            style={{ color: colors.text.primary }}
          >
            Experience the system firsthand.
          </h2>
          <p
            className="text-lg md:text-xl opacity-90 max-w-xl leading-relaxed"
            style={{ color: colors.text.secondary }}
          >
            Write a quick paragraph in our editor and see how your behavioral
            biometric fingerprint is generated in real-time.
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
              Try the Editor
            </Link>
            <Link
              to={ROUTES.REGISTER}
              className="px-8 py-4 rounded-lg font-bold text-[15px] border transition-colors"
              style={{
                backgroundColor: colors.surface[50],
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
