import { ROUTES } from "../constants/routes";
import { colors } from "../styles/colors";
import {
  IconTile,
  PrimaryLink,
  PublicCtaBand,
  PublicIcon,
  PublicSection,
  PublicShell,
  SecondaryLink,
  SectionHeading,
} from "../components/public/PublicVisualSystem";

const principles = [
  {
    icon: "shield" as const,
    title: "Fair academic review",
    description:
      "TypeTrace is designed to support review, not replace teachers, committees, or institutional procedure.",
  },
  {
    icon: "privacy" as const,
    title: "Privacy-aware evidence",
    description:
      "Public verification avoids exposing full essays or raw keystroke streams. Sensitive evidence stays behind authenticated review.",
  },
  {
    icon: "model" as const,
    title: "Probabilistic, not absolute",
    description:
      "Behavioral analysis is presented as supporting evidence, not as guaranteed proof of authorship or misconduct.",
  },
];

const stack = [
  ["Frontend", "React, TypeScript, Vite, Tailwind CSS"],
  ["Backend", "FastAPI, PostgreSQL, Redis, SQLAlchemy"],
  ["ML", "Keystroke dynamics, behavioral features, scikit-learn"],
  ["Evidence", "Replay audit, certificate ledger, document hashing"],
];

export default function AboutPage() {
  return (
    <PublicShell>
      <PublicSection className="pb-10 pt-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <p
              className="text-[12px] font-bold uppercase tracking-[0.18em]"
              style={{ color: colors.brand }}
            >
              About TypeTrace
            </p>
            <h1
              className="mt-5 text-5xl font-semibold leading-[1] tracking-[-0.06em] sm:text-6xl"
              style={{ color: colors.text.primary }}
            >
              Built to make authorship review more transparent.
            </h1>
            <p
              className="mt-6 max-w-2xl text-lg leading-8"
              style={{ color: colors.text.secondary }}
            >
              TypeTrace is an academic SaaS-style system for behavioral
              authorship evidence. It helps students document the writing
              process and helps educators review evidence beyond final-text AI
              detector outputs.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryLink to={ROUTES.REGISTER}>
                Start using TypeTrace
              </PrimaryLink>
              <SecondaryLink to={ROUTES.HELP_DOCS}>
                Read help center
              </SecondaryLink>
            </div>
          </div>

          <div
            className="rounded-md border p-6"
            style={{
              borderColor: colors.surface[200],
              background: colors.surface[50],
              boxShadow: `0 24px 70px ${colors.shadow}`,
            }}
          >
            <div
              className="rounded-md p-5"
              style={{ background: colors.brandSoft }}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-md"
                style={{ background: colors.brand, color: colors.text.light }}
              >
                <PublicIcon name="timeline" />
              </div>
              <h2
                className="mt-8 text-2xl font-semibold tracking-[-0.04em]"
                style={{ color: colors.text.primary }}
              >
                Process-first integrity
              </h2>
              <p
                className="mt-4 text-[14px] leading-7"
                style={{ color: colors.text.secondary }}
              >
                The central idea is simple: when final text creates doubt, the
                writing process can provide better review context.
              </p>
            </div>
          </div>
        </div>
      </PublicSection>

      <PublicSection className="pt-8">
        <SectionHeading
          align="center"
          eyebrow="Principles"
          title="The product is intentionally careful with claims."
          description="A system used in academic integrity must be technically useful, ethically restrained, and clear about limitations."
        />

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {principles.map((principle) => (
            <IconTile key={principle.title} {...principle} />
          ))}
        </div>
      </PublicSection>

      <PublicSection className="pt-8">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <SectionHeading
            eyebrow="System architecture"
            title="A full-stack final-year project with real SaaS structure."
            description="The project combines frontend UX, backend security, role-based access, behavioral biometrics, ML analysis, and verifiable certificate records."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            {stack.map(([label, value]) => (
              <div
                key={label}
                className="rounded-md border p-5"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[50],
                }}
              >
                <p
                  className="text-[12px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: colors.brand }}
                >
                  {label}
                </p>
                <p
                  className="mt-3 text-[15px] font-semibold leading-7"
                  style={{ color: colors.text.primary }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </PublicSection>

      <PublicSection className="pt-8">
        <div
          className="rounded-md border p-6 sm:p-8"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[100],
          }}
        >
          <p
            className="text-[12px] font-bold uppercase tracking-[0.18em]"
            style={{ color: colors.text.secondary }}
          >
            Academic positioning
          </p>
          <h2
            className="mt-4 text-3xl font-semibold tracking-[-0.04em]"
            style={{ color: colors.text.primary }}
          >
            TypeTrace provides behavioral authorship evidence that can support
            academic review.
          </h2>
          <p
            className="mt-4 max-w-4xl text-[15px] leading-8"
            style={{ color: colors.text.secondary }}
          >
            It should not be described as a tool that proves authorship with
            absolute certainty. That distinction is important for ethical,
            academic, and legal defensibility.
          </p>
        </div>
      </PublicSection>

      <PublicCtaBand />
    </PublicShell>
  );
}
