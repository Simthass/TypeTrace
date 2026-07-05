import { Link } from "react-router-dom";

import {
  PublicCard,
  PublicSection,
  PublicShell,
  SectionEyebrow,
  SectionHeading,
} from "../components/public/PublicVisualSystem";
import { ROUTES } from "../constants/routes";
import { colors } from "../styles/colors";

const captureItems = [
  "Keystroke timing such as press rhythm, dwell time, and flight time.",
  "Editing behavior such as deletions, revisions, pauses, paste, copy, and cut events.",
  "Session metrics such as active writing duration, word count, WPM, and risk indicators.",
  "Certificate metadata such as document hash, evidence hash, signature status, and verification ID.",
];

const publicItems = [
  "Certificate ID and verification status.",
  "Document integrity hash and signed payload hash.",
  "Student identity fields allowed by privacy settings.",
  "Course, institution, classification, risk level, review status, and generated date.",
];

const privateItems = [
  "Full essay text is never returned by public verification.",
  "Raw keystroke streams are never returned by public verification.",
  "Teacher-only review pages expose only authorized course submissions.",
  "Replay evidence stays behind authentication and role checks.",
];

function BulletList({ items }: { items: string[] }) {
  return (
    <div className="mt-5 space-y-3">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-3">
          <span
            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-md"
            style={{ background: colors.brand }}
          />
          <p
            className="text-[14px] leading-7"
            style={{ color: colors.text.secondary }}
          >
            {item}
          </p>
        </div>
      ))}
    </div>
  );
}

function PrivacyCard({
  title,
  body,
  items,
}: {
  title: string;
  body: string;
  items: string[];
}) {
  return (
    <PublicCard className="p-6">
      <h3
        className="text-[18px] font-bold tracking-[-0.03em]"
        style={{ color: colors.text.primary }}
      >
        {title}
      </h3>
      <p
        className="mt-3 text-[14px] leading-7"
        style={{ color: colors.text.secondary }}
      >
        {body}
      </p>
      <BulletList items={items} />
    </PublicCard>
  );
}

export default function PrivacyPage() {
  return (
    <PublicShell>
      <PublicSection className="py-20 md:py-28">
        <div className="mx-auto max-w-[1040px]">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>Privacy and evidence handling</SectionEyebrow>
            <SectionHeading
              title="TypeTrace verifies the process without exposing the private draft."
              description="TypeTrace captures writing-process evidence for academic review. Public verification is intentionally limited to certificate integrity metadata and does not reveal essay text or raw keystroke data."
              align="center"
            />
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            <PrivacyCard
              title="What TypeTrace captures"
              body="During an active writing session, TypeTrace records behavioral evidence needed to support authorship review."
              items={captureItems}
            />
            <PrivacyCard
              title="What public verification shows"
              body="Anyone with a certificate ID can verify the public record, but only limited certificate metadata is exposed."
              items={publicItems}
            />
            <PrivacyCard
              title="What remains private"
              body="Private evidence remains authenticated and role-protected. Public certificate lookup is not a replay or essay viewer."
              items={privateItems}
            />
          </div>

          <div
            className="mt-10 rounded-md border p-6"
            style={{
              borderColor: colors.surface[200],
              background: colors.surface[50],
            }}
          >
            <h3
              className="text-[18px] font-bold"
              style={{ color: colors.text.primary }}
            >
              Academic interpretation
            </h3>
            <p
              className="mt-3 text-[14px] leading-7"
              style={{ color: colors.text.secondary }}
            >
              TypeTrace results are supporting evidence, not automatic
              misconduct decisions. Teachers should review the behavioral record
              alongside institutional policy, student context, and academic
              judgement.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to={ROUTES.VERIFY_LOOKUP}
                className="rounded-md px-4 py-2 text-[13px] font-bold"
                style={{ background: colors.brand, color: colors.text.light }}
              >
                Verify a certificate
              </Link>
              <Link
                to={ROUTES.HELP_DOCS}
                className="rounded-md border px-4 py-2 text-[13px] font-bold"
                style={{
                  borderColor: colors.surface[200],
                  color: colors.text.primary,
                }}
              >
                Read help docs
              </Link>
            </div>
          </div>
        </div>
      </PublicSection>
    </PublicShell>
  );
}
