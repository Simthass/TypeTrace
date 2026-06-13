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
  WorkflowGraphic,
} from "../components/public/PublicVisualSystem";

const steps = [
  {
    icon: "document" as const,
    title: "Write inside the monitored editor",
    description:
      "Students write normally while TypeTrace records timing, keystroke, revision, and paste metadata.",
  },
  {
    icon: "timeline" as const,
    title: "Capture behavioral signals",
    description:
      "The system turns raw writing events into measurable signals such as pause density, rhythm consistency, deletion ratio, and paste activity.",
  },
  {
    icon: "model" as const,
    title: "Analyze the evidence",
    description:
      "Behavioral features are evaluated using ML-assisted analysis and fallback rules, producing bounded confidence and risk values.",
  },
  {
    icon: "certificate" as const,
    title: "Generate a verification record",
    description:
      "A certificate and document hash are generated so the session can be verified and reviewed later.",
  },
];

const reviewRules = [
  "TypeTrace records behavior during writing, not just the final submitted text.",
  "Results are supporting evidence, not automatic misconduct decisions.",
  "Teachers can review enrolled student submissions with replay and certificate evidence.",
  "Public verification never exposes full essay text or raw keystroke data.",
];

export default function HowItWorksPage() {
  return (
    <PublicShell>
      <PublicSection className="pb-10 pt-20">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p
              className="text-[12px] font-bold uppercase tracking-[0.18em]"
              style={{ color: colors.brand }}
            >
              How it works
            </p>
            <h1
              className="mt-5 text-5xl font-semibold leading-[1] tracking-[-0.06em] sm:text-6xl"
              style={{ color: colors.text.primary }}
            >
              From writing session to evidence trail in four steps.
            </h1>
            <p
              className="mt-6 max-w-2xl text-lg leading-8"
              style={{ color: colors.text.secondary }}
            >
              TypeTrace helps students document how work was created and gives
              teachers a structured review path that avoids relying only on
              final-text AI detection.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryLink to={ROUTES.REGISTER}>Create account</PrimaryLink>
              <SecondaryLink to={ROUTES.VERIFY_LOOKUP}>
                Verify certificate
              </SecondaryLink>
            </div>
          </div>

          <WorkflowGraphic />
        </div>
      </PublicSection>

      <PublicSection className="pt-8">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <IconTile key={step.title} {...step} />
          ))}
        </div>
      </PublicSection>

      <PublicSection className="pt-8">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <SectionHeading
            eyebrow="Review model"
            title="Designed for academic judgment, not automated punishment."
            description="The system’s language and workflow are intentionally review-safe. It shows evidence, explains signals, and leaves final decisions to institutional procedure."
          />

          <div className="grid gap-4">
            {reviewRules.map((rule, index) => (
              <div
                key={rule}
                className="rounded-md border p-5"
                style={{
                  borderColor: colors.surface[200],
                  background: colors.surface[50],
                }}
              >
                <div className="flex gap-4">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[13px] font-bold"
                    style={{
                      background: colors.brandSoft,
                      color: colors.brand,
                    }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <p
                    className="text-[15px] font-semibold leading-7"
                    style={{ color: colors.text.primary }}
                  >
                    {rule}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PublicSection>

      <PublicSection className="pt-8">
        <div
          className="rounded-md border p-6"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[100],
          }}
        >
          <div className="grid gap-6 md:grid-cols-3">
            {[
              ["Student", "Creates evidence while writing.", "keyboard"],
              ["Teacher", "Reviews enrolled course submissions.", "teacher"],
              ["Verifier", "Checks certificate validity publicly.", "shield"],
            ].map(([role, description, icon]) => (
              <div key={role} className="rounded-md bg-white p-5">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-md"
                  style={{ background: colors.brandSoft, color: colors.brand }}
                >
                  <PublicIcon name={icon as never} size={18} />
                </div>
                <h3
                  className="mt-4 font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  {role}
                </h3>
                <p
                  className="mt-2 text-[14px] leading-6"
                  style={{ color: colors.text.secondary }}
                >
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </PublicSection>

      <PublicCtaBand />
    </PublicShell>
  );
}
