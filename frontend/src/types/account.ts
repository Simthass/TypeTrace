// frontend/src/types/account.ts

export interface AccountProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: "STUDENT" | "TEACHER";
  student_id?: string | null;
  university_name?: string | null;
  department?: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountSummary {
  total_sessions: number;
  certificate_count: number;
  total_seconds: number;
  total_keystrokes: number;
  avg_wpm: number;
  avg_confidence: number;
  last_session_at: string;
  enrolled_courses: number;
  owned_courses: number;
}

export interface AccountProfileResponse {
  status: string;
  profile: AccountProfile;
  summary: AccountSummary;
}

export interface AccountProfileUpdateResponse {
  status: string;
  message: string;
  profile: AccountProfile;
}

export interface PrivacySummary {
  data_categories: string[];
  total_sessions: number;
  sessions_with_keystrokes: number;
  sessions_with_text: number;
  certificates: number;
  total_keystrokes: number;
  course_enrollments: number;
  owned_courses: number;
  export_available: boolean;
  delete_mode: string;
}

export interface PrivacySummaryResponse {
  status: string;
  privacy: PrivacySummary;
}
