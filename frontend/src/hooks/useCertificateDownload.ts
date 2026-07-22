import { useState } from "react";

import { API_ROUTES } from "../constants/apiRoutes";
import { api, getApiErrorMessage } from "../lib/api";
import { useToast } from "../components/ui/ToastContext";

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
      const response = await api.get(
        API_ROUTES.certificates.pdf(certificateId),
        {
          responseType: "blob",
        },
      );

      const safeCertificateId = certificateId.replace(/[^a-zA-Z0-9-_]/g, "");
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");

      link.href = url;
      link.download = `TypeTrace_Certificate_${safeCertificateId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);

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
