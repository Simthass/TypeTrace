// frontend/src/pages/FeaturesPage.tsx

import { ROUTES } from "../constants/routes";
import { brand, colors } from "../styles/colors";
import {
  CertificateGraphic,
  EvidenceBoard,
  IconTile,
  PrimaryLink,
  PublicCtaBand,
  PublicIcon,
  PublicSection,
  PublicShell,
  SecondaryLink,
  SectionHeading,
} from "../components/public/PublicVisualSystem";

const features = [
  {
    icon: "keyboard" as const,
    title: "Keystroke evidence capture",
    description:
      "Captures keydown timing, pauses, deletion behavior, paste indicators, and writing rhythm while the document is produced.",
  },
  {
    icon: "timeline" as const,
    title: "Behavioral feature extraction",
    description:
      "Transforms raw event streams into reviewable signals such as inter-key timing, pause density, burst ratio, and paste ratio.",
  },
  {
    icon: "model" as const,
    title: "ML-assisted analysis",
    description:
      "Runs bounded analysis with model readiness checks, fallback rules, and confidence/risk values kept inside safe ranges.",
  },
  {
    icon: "replay" as const,
    title: "Replay audit",
    description:
      "Allows authorized students and teachers to review the writing-event timeline without exposing public raw evidence.",
  },
  {
    icon: "certificate" as const,
    title: "Certificate ledger",
    description:
      "Generates a certificate ID, document hash, review status, and verification record linked to the session.",
  },
  {
    icon: "privacy" as const,
    title: "Privacy-aware public verification",
    description:
      "Public verification confirms certificate metadata without exposing full essay text or raw keystroke data.",
  },
];

const comparison = [
  {
    title: "Final-text AI detector",
    items: [
      "Judges only the final text",
      "Can create false accusations",
      "Limited process evidence",
    ],
  },
  {
    title: "TypeTrace evidence workflow",
    items: [
      "Records how writing happened",
      "Provides replay and certificate context",
      "Supports human academic review",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <PublicShell>
      <PublicSection className="pb-10 pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <p
            className="text-[12px] font-bold uppercase tracking-[0.18em]"
            style={{ color: colors.brand }}
          >
            Features
          </p>
          <h1
            className="mt-5 text-5xl font-semibold leading-[1] tracking-[-0.06em] sm:text-6xl"
            style={{ color: colors.text.primary }}
          >
            Everything needed to review authorship evidence fairly.
          </h1>
          <p
            className="mx-auto mt-6 max-w-3xl text-lg leading-8"
            style={{ color: colors.text.secondary }}
          >
            TypeTrace combines writing-process capture, behavioral analysis,
            replay evidence, certificate verification, and role-based review
            into a clean academic SaaS workflow.
          </p>

          <div className="mt-8 flex justify-center gap-3">
            <PrimaryLink to={ROUTES.REGISTER}>Try TypeTrace</PrimaryLink>
            <SecondaryLink to={ROUTES.HOW_IT_WORKS}>
              View workflow
            </SecondaryLink>
          </div>
        </div>
      </PublicSection>

      <PublicSection className="pt-8">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <IconTile key={feature.title} {...feature} />
          ))}
        </div>
      </PublicSection>

      <PublicSection className="pt-8">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <EvidenceBoard />
          <div>
            <SectionHeading
              eyebrow="Evidence quality"
              title="The important evidence is in the process."
              description="A polished essay can look suspicious for many reasons. TypeTrace records behavioral signals that help reviewers understand how the text was created."
            />

            <div className="mt-8 grid gap-4">
              {[
                "Typing rhythm",
                "Pause behavior",
                "Revision pattern",
                "Paste activity",
                "Integrity hash",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-md border p-3"
                  style={{
                    borderColor: colors.surface[200],
                    background: colors.surface[50],
                  }}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-md"
                    style={{
                      background: brand.humanBg,
                      color: brand.humanText,
                    }}
                  >
                    <PublicIcon name="shield" size={15} />
                  </span>
                  <span
                    className="text-[14px] font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PublicSection>

      <PublicSection className="pt-8">
        <SectionHeading
          align="center"
          eyebrow="Better review context"
          title="Not another black-box accusation tool."
          description="The product is intentionally framed around supporting evidence, review workflow, and institutional judgment."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {comparison.map((group, index) => (
            <div
              key={group.title}
              className="rounded-md border p-6"
              style={{
                borderColor: index === 0 ? brand.aiAccent : brand.humanAccent,
                background: index === 0 ? brand.aiBg : brand.humanBg,
              }}
            >
              <h3
                className="text-xl font-semibold tracking-[-0.03em]"
                style={{ color: index === 0 ? brand.aiText : brand.humanText }}
              >
                {group.title}
              </h3>
              <div className="mt-5 space-y-3">
                {group.items.map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        background:
                          index === 0 ? brand.aiAccent : brand.humanAccent,
                      }}
                    />
                    <p
                      className="text-[14px] font-semibold"
                      style={{
                        color: index === 0 ? brand.aiText : brand.humanText,
                      }}
                    >
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PublicSection>

      <PublicSection className="pt-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <SectionHeading
            eyebrow="Certificate layer"
            title="Verification records designed for academic defensibility."
            description="Certificates summarize the recorded writing session, classification, confidence, document hash, and review status without claiming absolute proof."
          />
          <CertificateGraphic />
        </div>
      </PublicSection>

      <PublicCtaBand />
    </PublicShell>
  );
}
