import { useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../constants/routes";
import { colors, brand } from "../styles/colors";

// ─── Icons ────────────────────────────────────────────────────────────────────
function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function FingerprintIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10" />
      <path d="M5 12c0-3.87 3.13-7 7-7s7 3.13 7 7" />
      <path d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4" />
      <path d="M11 12c0-.55.45-1 1-1s1 .45 1 1" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

// ─── Data Arrays ──────────────────────────────────────────────────────────────
const categories = [
  {
    id: "getting-started",
    title: "Getting Started",
    desc: "Learn how to capture your first session and generate a certificate.",
    icon: <BookIcon />,
  },
  {
    id: "biometrics",
    title: "Keystroke Biometrics",
    desc: "Understand how TypeTrace analyzes your IKI and dwell times.",
    icon: <FingerprintIcon />,
  },
  {
    id: "api",
    title: "API & Webhooks",
    desc: "Integrate TypeTrace validation into Canvas, Blackboard, or Moodle.",
    icon: <TerminalIcon />,
  },
  {
    id: "security",
    title: "Security & Privacy",
    desc: "How we cryptographically seal your data and protect your privacy.",
    icon: <LockIcon />,
  },
];

const faqs = [
  {
    question: "What exactly is an IKI (Inter-Key Interval)?",
    answer:
      "IKI refers to the flight time between pressing one key and the next. Because human hands have physical limitations and established muscle memory, your IKI rhythm is entirely unique to you. AI paste scripts have an IKI of 0ms, making them instantly detectable.",
  },
  {
    question: "Why was my session flagged as 'Suspicious'?",
    answer:
      "A session is flagged if the machine learning model detects unnatural typing behaviors. This usually happens if you paste a large chunk of text, or if your typing speed lacks the normal variance (pauses for thought, backspaces) associated with human cognition.",
  },
  {
    question: "Can my professor see what I typed?",
    answer:
      "No. TypeTrace is built on strict data sovereignty principles. Your actual text content is never sent to our servers. We only capture the mathematical metadata of your keystrokes (the timing). The cryptographic certificate proves you typed it, without revealing the content itself.",
  },
  {
    question: "How do I submit my certificate?",
    answer:
      "Once you end a session, navigate to the 'Certificates' tab and click download. You will receive a digitally signed PDF containing a SHA-256 hash. Submit this PDF alongside your essay in your university portal.",
  },
  {
    question:
      "I use a mechanical keyboard at home and a laptop at university. Will this break my profile?",
    answer:
      "Different keyboards do affect key travel time, which slightly alters dwell time. However, your overall typing cadence and cognitive rhythm remain relatively stable. We recommend doing a few test sessions on both keyboards to ensure your baseline model has enough variance.",
  },
];

// ─── FAQ Accordion Component ──────────────────────────────────────────────────
// Custom built so we dont need an npm package, keeps the bundle size tiny
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="border-b last:border-0"
      style={{ borderColor: colors.surface[200] }}
    >
      <button
        className="w-full py-4 flex items-center justify-between text-left transition-colors hover:bg-surface-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span
          className="text-[14px] font-medium"
          style={{ color: colors.text.primary }}
        >
          {question}
        </span>
        <span
          className="shrink-0 ml-4"
          style={{ color: colors.text.secondary }}
        >
          <ChevronDownIcon open={isOpen} />
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "max-h-40 opacity-100 pb-4" : "max-h-0 opacity-0"}`}
      >
        <p
          className="text-[13.5px] leading-relaxed pr-8"
          style={{ color: colors.text.secondary }}
        >
          {answer}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function HelpDocsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div
      className="min-h-screen pb-20 pt-14 font-sans"
      style={{ background: colors.surface[50] }}
    >
      {/* ── Hero / Search Section ── */}
      <div className="px-6 md:px-10 max-w-[800px] mx-auto w-full flex flex-col items-center text-center gap-6 mb-16">
        <div>
          <h1
            className="text-3xl font-semibold tracking-tight mb-3"
            style={{ color: colors.text.primary }}
          >
            How can we help?
          </h1>
          <p className="text-[15px]" style={{ color: colors.text.secondary }}>
            Search our documentation, API reference, and troubleshooting guides.
          </p>
        </div>

        {/* Big Search Bar */}
        <div className="relative w-full max-w-[600px] shadow-sm hover:shadow-md transition-shadow rounded-md">
          <span
            className="absolute left-4 top-1/2 -translate-y-1/2"
            style={{ color: colors.text.secondary }}
          >
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search for answers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-11 pr-4 rounded-md text-[15px] bg-white border outline-none focus:ring-1 focus:ring-black transition-all"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          />
        </div>
      </div>

      <div className="px-6 md:px-10 max-w-[1000px] mx-auto w-full flex flex-col gap-12">
        {/* ── Category Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="bg-white border rounded-md p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
              style={{ borderColor: colors.surface[200] }}
            >
              <div
                className="h-8 w-8 rounded-md border flex items-center justify-center transition-colors group-hover:bg-black group-hover:text-white"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              >
                {cat.icon}
              </div>
              <div>
                <h3
                  className="text-[14px] font-semibold mb-1"
                  style={{ color: colors.text.primary }}
                >
                  {cat.title}
                </h3>
                <p
                  className="text-[12px] leading-relaxed"
                  style={{ color: colors.text.secondary }}
                >
                  {cat.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div
          className="w-full h-px"
          style={{ backgroundColor: colors.surface[200] }}
        />

        {/* ── FAQ Section ── */}
        <div className="max-w-[800px] mx-auto w-full">
          <h2
            className="text-xl font-semibold tracking-tight mb-6"
            style={{ color: colors.text.primary }}
          >
            Frequently Asked Questions
          </h2>
          <div
            className="bg-white border rounded-md shadow-sm px-6"
            style={{ borderColor: colors.surface[200] }}
          >
            {faqs.map((faq, i) => (
              <FaqItem key={i} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>

        {/* ── Contact Support Callout ── */}
        <div className="max-w-[800px] mx-auto w-full">
          <div
            className="bg-white border rounded-md shadow-sm p-6 flex flex-col sm:flex-row items-center justify-between gap-6"
            style={{ borderColor: colors.surface[200] }}
          >
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
              <h3
                className="text-[15px] font-semibold mb-1"
                style={{ color: colors.text.primary }}
              >
                Still need help?
              </h3>
              <p
                className="text-[13px]"
                style={{ color: colors.text.secondary }}
              >
                Can't find the answer you're looking for? Reach out to our
                engineering team.
              </p>
            </div>
            <button
              className="shrink-0 flex items-center gap-2 h-9 px-4 rounded-md text-[13px] font-semibold text-white transition-opacity hover:opacity-90 shadow-sm"
              style={{ background: colors.text.primary }}
              onClick={() => alert("Support email triggered")}
            >
              <MailIcon />
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
