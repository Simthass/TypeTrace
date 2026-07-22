import { useCallback, useRef, useState } from "react";

import { getApiErrorMessage } from "../lib/api";
import { useToast } from "../components/ui/ToastContext";

interface SafeRequestOptions {
  errorTitle?: string;
  successTitle?: string;
  successMessage?: string;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
}

export function useSafeRequest() {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const lockRef = useRef(false);

  const run = useCallback(
    async <T>(
      request: () => Promise<T>,
      options: SafeRequestOptions = {},
    ): Promise<T | null> => {
      if (lockRef.current) return null;

      lockRef.current = true;
      setIsLoading(true);

      try {
        const result = await request();

        if (options.showSuccessToast) {
          showToast({
            type: "success",
            title: options.successTitle || "Success",
            message: options.successMessage,
          });
        }

        return result;
      } catch (error) {
        if (options.showErrorToast !== false) {
          showToast({
            type: "error",
            title: options.errorTitle || "Request failed",
            message: getApiErrorMessage(error),
          });
        }

        return null;
      } finally {
        lockRef.current = false;
        setIsLoading(false);
      }
    },
    [showToast],
  );

  return {
    run,
    isLoading,
  };
}
