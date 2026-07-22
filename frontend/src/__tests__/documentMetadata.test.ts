import { beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_DOCUMENT_DESCRIPTION,
  DEFAULT_DOCUMENT_TITLE,
  formatDocumentTitle,
  setDocumentMetadata,
  shortId,
} from "../lib/documentMetadata";

describe("document metadata", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.title = "";
  });

  it("formats titles without duplicating the application name", () => {
    expect(formatDocumentTitle({ title: "Dashboard" })).toBe(
      "Dashboard · TypeTrace",
    );
    expect(formatDocumentTitle({ title: "TypeTrace" })).toBe("TypeTrace");
    expect(formatDocumentTitle({ title: " " })).toBe(
      DEFAULT_DOCUMENT_TITLE,
    );
  });

  it("shortens long identifiers without changing short values", () => {
    expect(shortId("ABC123")).toBe("ABC123");
    expect(shortId("ABCDEFGHIJKLMN", 8)).toBe("ABCDEFGH…");
  });

  it("updates standard, Open Graph, and Twitter metadata", () => {
    setDocumentMetadata({
      title: "Verification",
      description: "  Signed evidence record.  ",
    });

    expect(document.title).toBe("Verification · TypeTrace");
    expect(
      document.querySelector('meta[name="description"]')?.getAttribute(
        "content",
      ),
    ).toBe("Signed evidence record.");
    expect(
      document.querySelector('meta[property="og:title"]')?.getAttribute(
        "content",
      ),
    ).toBe("Verification · TypeTrace");
  });

  it("uses the default description when none is provided", () => {
    setDocumentMetadata({ title: "Dashboard" });

    expect(
      document.querySelector('meta[name="description"]')?.getAttribute(
        "content",
      ),
    ).toBe(DEFAULT_DOCUMENT_DESCRIPTION);
  });
});
