// frontend/src/lib/edgeCases.ts

export const CERTIFICATE_ID_PATTERN = /^[A-Za-z0-9\-_]{8,80}$/;
export const OTP_PATTERN = /^\d{6}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSWORD_LENGTH = 8;
export const MINIMUM_KEYSTROKES = 30;
export const MAX_TITLE_LENGTH = 255;
export const MAX_EDITOR_TEXT_LENGTH = 30000;
export const MAX_PASTE_LENGTH = 12000;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeCertificateId(value: string): string {
  return value.trim();
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

export function isValidOtp(value: string): boolean {
  return OTP_PATTERN.test(value.trim());
}

export function isValidCertificateId(value: string): boolean {
  return CERTIFICATE_ID_PATTERN.test(normalizeCertificateId(value));
}

export function isStrongEnoughPassword(value: string): boolean {
  return value.length >= MIN_PASSWORD_LENGTH;
}

export function truncateTitle(value: string): string {
  const clean = value.trim();

  if (!clean) return "Untitled Document";

  return clean.length > MAX_TITLE_LENGTH
    ? clean.slice(0, MAX_TITLE_LENGTH)
    : clean;
}

export function clampPercentage(value: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function getRoleDashboard(role?: string): string {
  return role === "TEACHER" ? "/teacher/dashboard" : "/dashboard";
}
