import { describe, expect, it } from "vitest";

import {
  classificationDisplayLabel,
  clampPercentage,
  getRoleDashboard,
  isStrongEnoughPassword,
  isValidCertificateId,
  isValidEmail,
  isValidOtp,
  normalizeCertificateId,
  normalizeEmail,
  truncateTitle,
} from "../lib/edgeCases";

describe("edge-case utilities", () => {
  it("normalizes and validates email addresses", () => {
    expect(normalizeEmail(" Student@Example.COM ")).toBe(
      "student@example.com",
    );
    expect(isValidEmail("student@example.com")).toBe(true);
    expect(isValidEmail("invalid-email")).toBe(false);
  });

  it("validates OTP and certificate identifiers", () => {
    expect(isValidOtp("123456")).toBe(true);
    expect(isValidOtp("12345")).toBe(false);
    expect(normalizeCertificateId(" TT-ABCDEFGH ")).toBe("TT-ABCDEFGH");
    expect(isValidCertificateId("TT-ABCDEFGH")).toBe(true);
    expect(isValidCertificateId("bad id")).toBe(false);
  });

  it("applies password, title, and percentage boundaries", () => {
    expect(isStrongEnoughPassword("abc12345")).toBe(true);
    expect(isStrongEnoughPassword("12345678")).toBe(false);
    expect(isStrongEnoughPassword("abcdefgh")).toBe(false);
    expect(isStrongEnoughPassword("abc1234")).toBe(false);
    expect(truncateTitle("   ")).toBe("Untitled Document");
    expect(clampPercentage(-5)).toBe(0);
    expect(clampPercentage(105)).toBe(100);
    expect(clampPercentage(Number.NaN)).toBe(0);
  });

  it("uses review-safe classification labels", () => {
    expect(classificationDisplayLabel("HUMAN")).toBe("Human");
    expect(classificationDisplayLabel("SUSPICIOUS")).toBe(
      "Review Required",
    );
    expect(classificationDisplayLabel("SYNTHETIC")).toBe("High Risk");
    expect(classificationDisplayLabel("AI-GENERATED")).toBe("High Risk");
    expect(classificationDisplayLabel()).toBe("Unknown");
  });

  it("selects the correct role dashboard", () => {
    expect(getRoleDashboard("TEACHER")).toBe("/teacher/dashboard");
    expect(getRoleDashboard("STUDENT")).toBe("/dashboard");
    expect(getRoleDashboard()).toBe("/dashboard");
  });
});
