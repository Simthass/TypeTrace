// frontend/src/hooks/useCertificateDownload.ts

import { useState } from "react";

import { api, getApiErrorMessage } from "../lib/api";
import { useToast } from "../components/ui/ToastProvider";

export function useCertificateDownload() {
  const toast = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const downloadCertificate = async (certificateId: string) => {
    if (!certificateId) {
      toast.error("Download failed", "Certificate ID is missing.");
      return;
    }

    setDownloadingId(certificateId);

    try {
      const response = await api.get(`/certificates/${certificateId}/pdf`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/pdf",
      });

      const fileUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = fileUrl;
      link.download = `TypeTrace_Certificate_${certificateId}.pdf`;
      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(fileUrl);

      toast.success(
        "Certificate downloaded",
        "The PDF certificate has been saved to your device.",
      );
    } catch (error) {
      toast.error("Download failed", getApiErrorMessage(error));
    } finally {
      setDownloadingId(null);
    }
  };

  return {
    downloadingId,
    downloadCertificate,
  };
}
