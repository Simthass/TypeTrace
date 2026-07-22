export type BadgeTone =
  | "neutral"
  | "brand"
  | "human"
  | "suspicious"
  | "danger"
  | "verified";

export function classificationTone(value?: string): BadgeTone {
  const normalized = String(value || "").toUpperCase();

  if (normalized === "HUMAN") return "human";
  if (normalized === "SUSPICIOUS") return "suspicious";
  if (["SYNTHETIC", "AI", "AI-GENERATED", "HIGH_RISK"].includes(normalized)) {
    return "danger";
  }

  return "neutral";
}
