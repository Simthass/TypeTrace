import { describe, expect, it } from "vitest";

import {
  formatEvidenceScore,
  normalizeEvidenceScore,
} from "../lib/evidenceScore";

describe("normalizeEvidenceScore", () => {
  it("clamps values to the supported 0-100 range", () => {
    expect(normalizeEvidenceScore(-2)).toBe(0);
    expect(normalizeEvidenceScore(45.5)).toBe(45.5);
    expect(normalizeEvidenceScore(140)).toBe(100);
  });

  it("returns zero for non-finite and non-numeric input", () => {
    expect(normalizeEvidenceScore("not-a-number")).toBe(0);
    expect(normalizeEvidenceScore(Number.NaN)).toBe(0);
    expect(normalizeEvidenceScore(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("formatEvidenceScore", () => {
  it("truncates instead of rounding across decision boundaries", () => {
    expect(formatEvidenceScore(79.999, 2)).toBe("79.99");
    expect(formatEvidenceScore(49.999, 2)).toBe("49.99");
  });

  it("removes unnecessary trailing zeroes", () => {
    expect(formatEvidenceScore(80, 2)).toBe("80");
    expect(formatEvidenceScore(80.5, 2)).toBe("80.5");
  });

  it("limits display precision to four decimal places", () => {
    expect(formatEvidenceScore(61.234567, 20)).toBe("61.2345");
  });
});
