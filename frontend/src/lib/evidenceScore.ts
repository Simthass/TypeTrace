const MIN_EVIDENCE_SCORE = 0;
const MAX_EVIDENCE_SCORE = 100;
const MAX_DISPLAY_FRACTION_DIGITS = 4;

export function normalizeEvidenceScore(value: unknown): number {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return MIN_EVIDENCE_SCORE;
  }

  return Math.max(
    MIN_EVIDENCE_SCORE,
    Math.min(MAX_EVIDENCE_SCORE, numericValue),
  );
}

export function formatEvidenceScore(
  value: unknown,
  maximumFractionDigits = 2,
): string {
  const normalizedScore = normalizeEvidenceScore(value);
  const safeFractionDigits = Math.max(
    0,
    Math.min(MAX_DISPLAY_FRACTION_DIGITS, Math.trunc(maximumFractionDigits)),
  );
  const factor = 10 ** safeFractionDigits;

  // Truncate rather than round so a score below a classification boundary can
  // never be displayed as if it reached that boundary (for example 79.999 must
  // not render as 80 while the stored classification is NEEDS REVIEW).
  const truncatedScore =
    Math.trunc((normalizedScore + Number.EPSILON) * factor) / factor;

  return truncatedScore
    .toFixed(safeFractionDigits)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?[1-9])0+$/, "$1");
}
