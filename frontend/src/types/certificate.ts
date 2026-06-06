export type CertificateStatus =
  | "VALID"
  | "REVIEW_REQUIRED"
  | "HIGH_RISK"
  | "INVALID";

export interface CertificateListItem {
  session_id: number;
  title: string;
  wpm: number;
  duration_seconds: number;
  classification: string;
  confidence: number;
  created_at: string;
  certificate_id: string;
  document_hash: string;
  risk_level: string;
  review_status: string;
  course_name: string | null;
  course_code: string | null;
  verify_url: string;
}

export interface CertificateListResponse {
  status: string;
  certificates: CertificateListItem[];
}

export interface PublicCertificateVerification {
  valid: boolean;
  status: CertificateStatus | string;
  certificate_id: string;
  reason?: string;

  verify_url?: string;
  title?: string;
  student_name?: string;
  student_id?: string;
  university_name?: string;
  course_name?: string | null;
  course_code?: string | null;
  word_count?: number;
  wpm?: number;
  duration_seconds?: number;
  classification?: string;
  classification_label?: string;
  confidence?: number;
  risk_level?: string;
  review_status?: string;
  document_hash?: string;
  created_at?: string;
  generated_at?: string;
  ledger_status?: string;
}
