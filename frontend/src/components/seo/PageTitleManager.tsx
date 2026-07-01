import { useEffect, useMemo } from "react";
import { matchPath, useLocation } from "react-router-dom";

import { PAGE_METADATA_ROUTES } from "../../constants/pageMetadata";
import {
  DEFAULT_DOCUMENT_DESCRIPTION,
  setDocumentMetadata,
  type DocumentMetadata,
} from "../../lib/documentMetadata";

function resolveValue(
  value: string | ((params: Record<string, string | undefined>) => string),
  params: Record<string, string | undefined>,
): string {
  return typeof value === "function" ? value(params) : value;
}

function findMetadata(pathname: string): DocumentMetadata {
  for (const route of PAGE_METADATA_ROUTES) {
    const match = matchPath({ path: route.path, end: true }, pathname);

    if (!match) continue;

    return {
      title: resolveValue(route.title, match.params),
      description: resolveValue(route.description, match.params),
      noSuffix: pathname === "/",
    };
  }

  return {
    title: "Page Not Found",
    description: DEFAULT_DOCUMENT_DESCRIPTION,
  };
}

export default function PageTitleManager() {
  const location = useLocation();

  const metadata = useMemo(
    () => findMetadata(location.pathname),
    [location.pathname],
  );

  useEffect(() => {
    setDocumentMetadata(metadata);
  }, [metadata]);

  return null;
}
