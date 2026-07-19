import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { API_ROUTES } from "../../constants/apiRoutes";
import { ROUTES } from "../../constants/routes";
import { api, getApiErrorMessage } from "../../lib/api";
import { colors } from "../../styles/colors";
import { useCertificateDownload } from "../../hooks/useCertificateDownload";

import { LoadingState, PageHeader } from "../../components/ui/PageState";
import { ErrorState } from "../../components/ui/AsyncState";
import {
  AppSurface,
  InternalIcon,
} from "../../components/internal/InternalShell";
import { Badge, classificationTone } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { formatEvidenceScore } from "../../lib/evidenceScore";

interface SessionDetailData {
  id: number;
  title: string;
  text_content: string;
  classification: string;
  classification_bucket: string;
  confidence: number;
  risk_level: string;
  review_status: string;
  review_outcome: string;
  wpm: number;
  duration_seconds: number;
  total_keystrokes: number;
  deletions: number;
  pauses: number;
  avg_iki: number;
  word_count: number;
  certificate_id: string;
  document_hash: string;
  course_name: string | null;
  course_code: string | null;
  created_at: string;
}

export default function StudentSessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<SessionDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { downloadCertificate, downloadingId } = useCertificateDownload();

  useEffect(() => {
    let mounted = true;

    async function fetchSession() {
      if (!sessionId) return;
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.get<{
          status: string;
          session: SessionDetailData;
        }>(API_ROUTES.student.sessionDetail(sessionId));
        if (!mounted) return;
        setSession(response.data.session);
      } catch (err) {
        if (!mounted) return;
        setError(getApiErrorMessage(err));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    fetchSession();
    return () => {
      mounted = false;
    };
  }, [sessionId]);

  if (isLoading) {
    return <LoadingState label="Loading document details..." />;
  }

  if (error || !session) {
    return (
      <ErrorState
        title="Could not load session"
        message={error || "Session not found."}
        action={
          <Link
            to={ROUTES.SESSIONS}
            className="inline-flex h-9 items-center justify-center rounded-md border bg-white px-4 text-[13px] font-semibold transition hover:bg-surface-50"
            style={{
              borderColor: colors.surface[200],
              color: colors.text.primary,
            }}
          >
            Back to Sessions
          </Link>
        }
      />
    );
  }

  const durationMins = Math.max(1, Math.round(session.duration_seconds / 60));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Session Document"
        title={session.title}
        action={
          <div className="flex items-center gap-3">
            <Link
              to={ROUTES.REPLAY.replace(":sessionId", session.id.toString())}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-[13px] font-semibold transition hover:bg-surface-50"
              style={{
                borderColor: colors.surface[200],
                backgroundColor: colors.surface[50],
                color: colors.text.primary,
              }}
            >
              <InternalIcon name="replay" size={16} />
              Replay Audit
            </Link>
            {session.certificate_id && (
              <Button
                variant="primary"
                onClick={() => downloadCertificate(session.certificate_id)}
                disabled={downloadingId === session.certificate_id}
                leftIcon={<InternalIcon name="download" size={16} />}
              >
                {downloadingId === session.certificate_id
                  ? "Downloading..."
                  : "Certificate"}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Document Viewer (Decrypted Content) */}
        <div className="lg:col-span-2">
          <AppSurface className="h-full min-h-[600px] p-8">
            <div
              className="mb-6 border-b pb-4"
              style={{ borderColor: colors.surface[200] }}
            >
              <h2
                className="text-[15px] font-semibold"
                style={{ color: colors.text.primary }}
              >
                Document Text
              </h2>
            </div>

            {session.text_content ? (
              <div
                className="whitespace-pre-wrap font-serif text-[15px] leading-[1.8]"
                style={{ color: colors.text.primary }}
              >
                {session.text_content}
              </div>
            ) : (
              <div
                className="flex h-40 items-center justify-center rounded-md border border-dashed"
                style={{
                  borderColor: colors.surface[200],
                  backgroundColor: colors.surface[50],
                }}
              >
                <p
                  className="text-[13px] italic"
                  style={{ color: colors.text.secondary }}
                >
                  No text content was captured for this session.
                </p>
              </div>
            )}
          </AppSurface>
        </div>

        {/* Sidebar Metrics & Data */}
        <div className="space-y-6">
          <AppSurface className="p-5">
            <h3
              className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em]"
              style={{ color: colors.text.muted }}
            >
              Integrity Status
            </h3>

            <div className="space-y-4">
              <div>
                <p
                  className="mb-1.5 text-[12px] font-medium"
                  style={{ color: colors.text.secondary }}
                >
                  ML Classification
                </p>
                <Badge tone={classificationTone(session.classification)}>
                  {session.classification} (
                  {formatEvidenceScore(session.confidence)}%)
                </Badge>
              </div>

              <div>
                <p
                  className="mb-1.5 text-[12px] font-medium"
                  style={{ color: colors.text.secondary }}
                >
                  Teacher Review
                </p>
                <p
                  className="text-[13px] font-semibold"
                  style={{ color: colors.text.primary }}
                >
                  {session.review_outcome}
                </p>
              </div>

              {session.course_name && (
                <div
                  className="mt-4 rounded-md border p-3"
                  style={{
                    backgroundColor: colors.surface[50],
                    borderColor: colors.surface[200],
                  }}
                >
                  <p
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: colors.text.muted }}
                  >
                    Submitted To
                  </p>
                  <p
                    className="mt-1 text-[13px] font-semibold"
                    style={{ color: colors.text.primary }}
                  >
                    {session.course_name}
                  </p>
                </div>
              )}
            </div>
          </AppSurface>

          <AppSurface className="p-5">
            <h3
              className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em]"
              style={{ color: colors.text.muted }}
            >
              Behavioral Metrics
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p
                  className="text-[20px] font-bold tracking-tight"
                  style={{ color: colors.text.primary }}
                >
                  {session.wpm}
                </p>
                <p
                  className="text-[11px] font-medium"
                  style={{ color: colors.text.secondary }}
                >
                  WPM
                </p>
              </div>
              <div>
                <p
                  className="text-[20px] font-bold tracking-tight"
                  style={{ color: colors.text.primary }}
                >
                  {durationMins}m
                </p>
                <p
                  className="text-[11px] font-medium"
                  style={{ color: colors.text.secondary }}
                >
                  Active time
                </p>
              </div>
              <div>
                <p
                  className="text-[20px] font-bold tracking-tight"
                  style={{ color: colors.text.primary }}
                >
                  {session.word_count}
                </p>
                <p
                  className="text-[11px] font-medium"
                  style={{ color: colors.text.secondary }}
                >
                  Words
                </p>
              </div>
              <div>
                <p
                  className="text-[20px] font-bold tracking-tight"
                  style={{ color: colors.text.primary }}
                >
                  {session.total_keystrokes}
                </p>
                <p
                  className="text-[11px] font-medium"
                  style={{ color: colors.text.secondary }}
                >
                  Keystrokes
                </p>
              </div>
              <div>
                <p
                  className="text-[20px] font-bold tracking-tight"
                  style={{ color: colors.text.primary }}
                >
                  {session.pauses}
                </p>
                <p
                  className="text-[11px] font-medium"
                  style={{ color: colors.text.secondary }}
                >
                  Pauses
                </p>
              </div>
              <div>
                <p
                  className="text-[20px] font-bold tracking-tight"
                  style={{ color: colors.text.primary }}
                >
                  {session.deletions}
                </p>
                <p
                  className="text-[11px] font-medium"
                  style={{ color: colors.text.secondary }}
                >
                  Deletions
                </p>
              </div>
            </div>
          </AppSurface>

          {session.certificate_id && (
            <AppSurface className="p-5">
              <h3
                className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em]"
                style={{ color: colors.text.muted }}
              >
                Cryptographic Ledger
              </h3>

              <div className="space-y-3">
                <div>
                  <p
                    className="text-[11px] font-medium"
                    style={{ color: colors.text.secondary }}
                  >
                    Certificate ID
                  </p>
                  <p
                    className="font-mono text-[11px] font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    {session.certificate_id}
                  </p>
                </div>
                <div>
                  <p
                    className="text-[11px] font-medium"
                    style={{ color: colors.text.secondary }}
                  >
                    Document Hash
                  </p>
                  <p
                    className="truncate font-mono text-[11px] font-bold"
                    style={{ color: colors.text.primary }}
                  >
                    {session.document_hash}
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    to={ROUTES.VERIFY.replace(
                      ":certId",
                      session.certificate_id,
                    )}
                    target="_blank"
                    className="text-[12px] font-semibold transition hover:underline"
                    style={{ color: colors.brand }}
                  >
                    View Public Verification ↗
                  </Link>
                </div>
              </div>
            </AppSurface>
          )}
        </div>
      </div>
    </div>
  );
}
