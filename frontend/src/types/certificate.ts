export type CertificateStatus =
  | "VALID"
  | "VALID_LEGACY"
  | "REVIEW_REQUIRED"
  | "HIGH_RISK"
  | "REVOKED"
  | "INVALID_SIGNATURE"
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
  review_outcome?: string;
  course_name: string | null;
  course_code: string | null;
  verify_url: string;
}

export interface CertificateListResponse {
  status: string;
  certificates: CertificateListItem[];
}

export interface CertificateAuditTimelineItem {
  label: string;
  status: "complete" | "warning" | "legacy" | string;
  timestamp?: string;
  description: string;
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
  human_evidence_score?: number;
  risk_level?: string;
  review_status?: string;
  review_outcome?: string;
  document_hash?: string;
  evidence_hash?: string;
  signed_payload_hash?: string;
  signature_algorithm?: string;
  signing_key_id?: string;
  signed_at?: string;
  signature_status?: string;
  signature_valid?: boolean;
  payload_hash_matches?: boolean;
  ledger_verified?: boolean;
  ledger_reason?: string;
  revoked_at?: string | null;
  revocation_reason?: string | null;
  created_at?: string;
  generated_at?: string;
  ledger_status?: string;
  audit_timeline?: CertificateAuditTimelineItem[];
  public_exposure?: {
    essay_text_exposed: boolean;
    raw_keystrokes_exposed: boolean;
    student_private_notes_exposed: boolean;
  };
  privacy_notice?: string;
}
