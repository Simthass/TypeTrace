// frontend/src/pages/CertificatesPage.tsx

import { useEffect, useMemo, useState } from "react";

import { Badge, classificationTone } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { EmptyState, PageHeader } from "../components/ui/PageState";
import { CardGridSkeleton } from "../components/ui/Skeleton";
import { Tabs } from "../components/ui/Tabs";
import { ROUTES } from "../constants/routes";
import { useCertificateDownload } from "../hooks/useCertificateDownload";
import { api, getApiErrorMessage } from "../lib/api";
import { useToast } from "../components/ui/ToastProvider";
import { colors } from "../styles/colors";
import { API_ROUTES } from "../constants/apiRoutes";

interface CertificateItem {
  session_id: number;
  title: string;
  classification: string;
  confidence: number;
  created_at: string;
  certificate_id: string;
  document_hash: string;
  risk_level: string;
  review_status: string;
  course_name?: string | null;
  course_code?: string | null;
  verify_url: string;
}

interface CertificatesResponse {
  status: string;
  certificates: CertificateItem[];
}

const filters = [
  { value: "ALL", label: "All" },
  { value: "HUMAN", label: "Human" },
  { value: "SUSPICIOUS", label: "Review" },
  { value: "SYNTHETIC", label: "High Risk" },
];

function countByFilter(certificates: CertificateItem[], filter: string) {
  if (filter === "ALL") return certificates.length;

  return certificates.filter((item) => {
    const value = String(item.classification || "").toUpperCase();

    if (filter === "SYNTHETIC") {
      return ["SYNTHETIC", "AI", "AI-GENERATED", "HIGH_RISK"].includes(value);
    }

    return value === filter;
  }).length;
}

function CertificateCard({
  certificate,
  downloading,
  onDownload,
}: {
  certificate: CertificateItem;
  downloading: boolean;
  onDownload: (certificateId: string) => void;
}) {
  const tone = classificationTone(certificate.classification);

  return (
    <Card elevated className="transition hover:-translate-y-0.5">
      <CardBody>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className="text-[15px] font-bold"
              style={{ color: colors.text.primary }}
            >
              {certificate.title || "Untitled Document"}
            </p>

            <p
              className="mt-1 text-[12px]"
              style={{ color: colors.text.secondary }}
            >
              {certificate.course_code || "Personal"} · {certificate.created_at}
            </p>
          </div>

          <Badge tone={tone}>{certificate.classification}</Badge>
        </div>

        <div
          className="mt-5 rounded-md border p-3"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[100],
          }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: colors.text.secondary }}
          >
            Certificate ID
          </p>

          <p
            className="mt-2 break-all font-mono text-[12px] font-bold"
            style={{ color: colors.text.primary }}
          >
            {certificate.certificate_id}
          </p>
        </div>

        <div
          className="mt-3 rounded-md border p-3"
          style={{
            borderColor: colors.surface[200],
            background: colors.surface[50],
          }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: colors.text.secondary }}
          >
            Document hash
          </p>

          <p
            className="mt-2 line-clamp-2 break-all font-mono text-[11px]"
            style={{ color: colors.text.primary }}
          >
            {certificate.document_hash}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ color: colors.text.secondary }}
            >
              Confidence
            </p>
            <p
              className="mt-1 text-[14px] font-bold"
              style={{ color: colors.text.primary }}
            >
              {certificate.confidence}%
            </p>
          </div>

          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ color: colors.text.secondary }}
            >
              Risk
            </p>
            <p
              className="mt-1 text-[14px] font-bold"
              style={{ color: colors.text.primary }}
            >
              {certificate.risk_level}
            </p>
          </div>

          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ color: colors.text.secondary }}
            >
              Review
            </p>
            <p
              className="mt-1 text-[14px] font-bold"
              style={{ color: colors.text.primary }}
            >
              {certificate.review_status}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <ButtonLink to={`/verify/${certificate.certificate_id}`} size="sm">
            Verify
          </ButtonLink>

          <ButtonLink
            to={ROUTES.REPLAY.replace(
              ":sessionId",
              String(certificate.session_id),
            )}
            variant="secondary"
            size="sm"
          >
            Replay
          </ButtonLink>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={downloading}
            onClick={() => onDownload(certificate.certificate_id)}
          >
            {downloading ? "Downloading..." : "Download PDF"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export default function CertificatesPage() {
  const toast = useToast();
  const { downloadingId, downloadCertificate } = useCertificateDownload();

  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [selectedFilter, setSelectedFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);

  const filteredCertificates = useMemo(() => {
    return certificates.filter((item) => {
      if (selectedFilter === "ALL") return true;

      const value = String(item.classification || "").toUpperCase();

      if (selectedFilter === "SYNTHETIC") {
        return ["SYNTHETIC", "AI", "AI-GENERATED", "HIGH_RISK"].includes(value);
      }

      return value === selectedFilter;
    });
  }, [certificates, selectedFilter]);

  useEffect(() => {
    let mounted = true;

    async function loadCertificates() {
      setIsLoading(true);

      try {
        const response = await api.get<CertificatesResponse>(
          API_ROUTES.certificates.list,
        );

        if (!mounted) return;
        setCertificates(response.data.certificates || []);
      } catch (error) {
        if (!mounted) return;
        toast.error("Certificates failed to load", getApiErrorMessage(error));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadCertificates();

    return () => {
      mounted = false;
    };
  }, [toast]);

  const tabItems = filters.map((filter) => ({
    ...filter,
    count: countByFilter(certificates, filter.value),
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Certificate vault"
        title="Authorship certificates"
        description="Download, verify, and audit certificate-backed writing sessions with document hashes and replay links."
        action={
          <ButtonLink to={ROUTES.EDITOR_NEW}>Create new certificate</ButtonLink>
        }
      />

      <Card>
        <CardBody>
          <Tabs
            items={tabItems}
            value={selectedFilter}
            onChange={setSelectedFilter}
          />
        </CardBody>
      </Card>

      {isLoading ? (
        <CardGridSkeleton cards={6} />
      ) : !certificates.length ? (
        <EmptyState
          icon="certificate"
          title="No certificates yet"
          description="Analyze a writing session to generate a certificate with a public verification record."
          action={
            <ButtonLink to={ROUTES.EDITOR_NEW}>
              Start writing session
            </ButtonLink>
          }
        />
      ) : !filteredCertificates.length ? (
        <EmptyState
          icon="search"
          title="No certificates match this filter"
          description="Try another classification filter to find the certificate you need."
          action={
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSelectedFilter("ALL")}
            >
              Show all certificates
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredCertificates.map((certificate) => (
            <CertificateCard
              key={certificate.certificate_id}
              certificate={certificate}
              downloading={downloadingId === certificate.certificate_id}
              onDownload={downloadCertificate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
