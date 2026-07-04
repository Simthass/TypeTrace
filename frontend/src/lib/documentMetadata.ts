export const APP_NAME = "TypeTrace";
export const TITLE_SEPARATOR = "·";

export const DEFAULT_DOCUMENT_TITLE =
  "TypeTrace · Academic Authorship Verification";

export const DEFAULT_DOCUMENT_DESCRIPTION =
  "TypeTrace verifies academic authorship with keystroke biometrics, writing-process evidence, and cryptographic certificates.";

export interface DocumentMetadata {
  title: string;
  description?: string;
  noSuffix?: boolean;
}

function cleanMetadataValue(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function shortId(value: string | undefined, visible = 8): string {
  const cleaned = cleanMetadataValue(String(value || ""));
  if (!cleaned) return "";
  if (cleaned.length <= visible + 3) return cleaned;
  return `${cleaned.slice(0, visible)}…`;
}

export function formatDocumentTitle({
  title,
  noSuffix = false,
}: Pick<DocumentMetadata, "title" | "noSuffix">): string {
  const cleaned = cleanMetadataValue(title || "");

  if (!cleaned) return DEFAULT_DOCUMENT_TITLE;
  if (noSuffix || cleaned === APP_NAME || cleaned.includes(APP_NAME)) {
    return cleaned;
  }

  return `${cleaned} ${TITLE_SEPARATOR} ${APP_NAME}`;
}

function upsertMetaByName(name: string, content: string): void {
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);

  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }

  tag.setAttribute("content", content);
}

function upsertMetaByProperty(property: string, content: string): void {
  let tag = document.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`,
  );

  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
    document.head.appendChild(tag);
  }

  tag.setAttribute("content", content);
}

export function setDocumentMetadata(metadata: DocumentMetadata): void {
  if (typeof document === "undefined") return;

  const title = formatDocumentTitle(metadata);
  const description = cleanMetadataValue(
    metadata.description || DEFAULT_DOCUMENT_DESCRIPTION,
  );

  document.title = title;

  upsertMetaByName("description", description);
  upsertMetaByName("twitter:card", "summary_large_image");
  upsertMetaByName("twitter:title", title);
  upsertMetaByName("twitter:description", description);

  upsertMetaByProperty("og:title", title);
  upsertMetaByProperty("og:description", description);
  upsertMetaByProperty("og:type", "website");
}
