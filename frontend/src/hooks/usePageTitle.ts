import { useEffect } from "react";

import {
  setDocumentMetadata,
  type DocumentMetadata,
} from "../lib/documentMetadata";

export function usePageTitle({
  title,
  description,
  noSuffix,
}: DocumentMetadata): void {
  useEffect(() => {
    setDocumentMetadata({ title, description, noSuffix });
  }, [title, description, noSuffix]);
}
