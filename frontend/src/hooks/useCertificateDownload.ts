// frontend/src/hooks/useCertificateDownload.ts

import { useCallback, useState } from "react";
import { api, getApiErrorMessage } from "../lib/api";

export function useCertificateDownload() {
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadCertificate = useCallback(async (certificateId: string) => {
    if (!certificateId) {
      throw new Error("Certificate ID is required.");
    }

    setIsDownloading(true);

    try {
      const response = await api.get(`/certificates/${certificateId}/pdf`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const downloadUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `TypeTrace_Certificate_${certificateId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      throw new Error(getApiErrorMessage(error));
    } finally {
      setIsDownloading(false);
    }
  }, []);

  return {
    downloadCertificate,
    isDownloading,
  };
}
