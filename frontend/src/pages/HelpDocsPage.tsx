import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ROUTES } from "../constants/routes";
import { colors } from "../styles/colors";
import {
  PublicIcon,
  PublicSection,
  PublicShell,
} from "../components/public/PublicVisualSystem";

const docs = [
  {
    category: "Student workflow",
    icon: "keyboard" as const,
    items: [
      {
        title: "Start a writing session",
        body: "Open the editor, write normally, and let TypeTrace capture timing, revision, pause, and paste metadata while you work.",
      },
      {
        title: "Minimum evidence required",
        body: "A writing session needs enough keystroke evidence before analysis can run. This prevents weak or meaningless results.",
      },
      {
        title: "Personal vs course sessions",
        body: "You can analyze personal sessions or attach a session to a course after joining it with an invite code.",
      },
    ],
  },
  {
    category: "Teacher workflow",
    icon: "teacher" as const,
    items: [
      {
        title: "Create a course",
        body: "Teachers create a course and share the invite code with students. Only enrolled student submissions appear in teacher review pages.",
      },
      {
        title: "Review submissions",
        body: "Teachers can inspect classification, confidence, risk level, replay audit, and certificate evidence for enrolled submissions.",
      },
      {
        title: "Set review status",
        body: "Submissions can be kept pending, approved, or flagged with review notes. This supports human review instead of automatic punishment.",
      },
    ],
  },
  {
    category: "Verification",
    icon: "certificate" as const,
    items: [
      {
        title: "Verify a certificate",
        body: "Use the certificate ID on the public verification page to confirm the ledger record, document hash, and review-safe evidence summary.",
      },
      {
        title: "Download certificate PDF",
        body: "Certificate PDFs summarize the recorded writing session and document hash without exposing raw keystrokes publicly.",
      },
      {
        title: "Interpret results carefully",
        body: "TypeTrace evidence supports academic review. It should not be treated as absolute proof of authorship or misconduct.",
      },
    ],
  },
  {
    category: "Security and privacy",
    icon: "privacy" as const,
    items: [
      {
        title: "Role-based access",
        body: "Students access their own sessions. Teachers access only submissions linked to their own courses.",
      },
      {
        title: "Public data exposure",
        body: "Public verification does not expose full essay text or raw keystroke evidence.",
      },
      {
        title: "Session persistence",
        body: "Authenticated sessions are verified against the backend, and expired tokens are cleared automatically.",
      },
    ],
  },
];

function SearchIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export default function HelpDocsPage() {
  const [query, setQuery] = useState("");

  const filteredDocs = useMemo(() => {
    const clean = query.trim().toLowerCase();

    if (!clean) return docs;

    return docs
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          `${group.category} ${item.title} ${item.body}`
            .toLowerCase()
            .includes(clean),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [query]);

  return (
    <PublicShell>
      <PublicSection className="pb-10 pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <p
            className="text-[12px] font-bold uppercase tracking-[0.18em]"
            style={{ color: colors.brand }}
          >
            Help center
          </p>
          <h1
            className="mt-5 text-5xl font-semibold leading-[1] tracking-[-0.06em] sm:text-6xl"
            style={{ color: colors.text.primary }}
          >
            Understand TypeTrace without guessing.
          </h1>
          <p
            className="mx-auto mt-6 max-w-3xl text-lg leading-8"
            style={{ color: colors.text.secondary }}
          >
            Clear guidance for students, teachers, verification, privacy, and
            academic interpretation.
          </p>

          <div
            className="mx-auto mt-8 flex max-w-2xl items-center gap-3 rounded-md border bg-white px-4 py-3"
            style={{
              borderColor: colors.surface[200],
              boxShadow: `0 20px 60px ${colors.shadow}`,
            }}
          >
            <span style={{ color: colors.text.secondary }}>
              <SearchIcon />
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search help topics..."
              className="w-full bg-transparent text-[15px] outline-none"
              style={{ color: colors.text.primary }}
            />
          </div>
        </div>
      </PublicSection>

      <PublicSection className="pt-8">
        {filteredDocs.length === 0 ? (
          <div
            className="rounded-md border p-8 text-center"
            style={{
              borderColor: colors.surface[200],
              background: colors.surface[50],
            }}
          >
            <p className="font-semibold" style={{ color: colors.text.primary }}>
              No matching help topic found.
            </p>
            <p
              className="mt-2 text-[14px]"
              style={{ color: colors.text.secondary }}
            >
              Try searching for certificate, replay, teacher, course, or
              privacy.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {filteredDocs.map((group) => (
              <div
                key={group.category}
                className="rounded-md border bg-white p-6"
                style={{
                  borderColor: colors.surface[200],
                  boxShadow: `0 20px 60px ${colors.shadow}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-md"
                    style={{
                      background: colors.brandSoft,
                      color: colors.brand,
                    }}
                  >
                    <PublicIcon name={group.icon} size={18} />
                  </span>
                  <h2
                    className="text-xl font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {group.category}
                  </h2>
                </div>

                <div className="mt-6 space-y-4">
                  {group.items.map((item) => (
                    <details
                      key={item.title}
                      className="rounded-md border p-4"
                      style={{
                        borderColor: colors.surface[200],
                        background: colors.surface[50],
                      }}
                    >
                      <summary
                        className="cursor-pointer text-[14px] font-bold"
                        style={{ color: colors.text.primary }}
                      >
                        {item.title}
                      </summary>
                      <p
                        className="mt-3 text-[14px] leading-7"
                        style={{ color: colors.text.secondary }}
                      >
                        {item.body}
                      </p>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </PublicSection>

      <PublicSection className="pt-8">
        <div
          className="rounded-md border p-8"
          style={{
            borderColor: colors.surface[200],
            background: colors.text.primary,
          }}
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p
                className="text-[12px] font-bold uppercase tracking-[0.18em]"
                style={{ color: colors.surface[300] }}
              >
                Need to verify evidence?
              </p>
              <h2
                className="mt-3 text-3xl font-semibold tracking-[-0.04em]"
                style={{ color: colors.text.light }}
              >
                Open the public certificate lookup.
              </h2>
              <p
                className="mt-3 max-w-2xl text-[14px] leading-7"
                style={{ color: colors.surface[300] }}
              >
                Enter a TypeTrace certificate ID to confirm the public record,
                document hash, and review-safe evidence summary.
              </p>
            </div>

            <Link
              to={ROUTES.VERIFY_LOOKUP}
              className="inline-flex rounded-md px-5 py-3 text-[14px] font-bold transition hover:opacity-90"
              style={{
                background: colors.brand,
                color: colors.text.light,
              }}
            >
              Verify certificate
            </Link>
          </div>
        </div>
      </PublicSection>
    </PublicShell>
  );
}
