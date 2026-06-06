// frontend/src/types/student.ts

export type ClassificationBucket =
  | "HUMAN"
  | "SUSPICIOUS"
  | "SYNTHETIC"
  | "UNKNOWN";

export interface StudentProfileSummary {
  id: string;
  first_name: string;
  last_name?: string;
  email: string;
  student_id?: string | null;
  university_name?: string | null;
}

export interface StudentDashboardSummary {
  total_sessions: number;
  avg_wpm: number;
  avg_confidence: number;
  total_seconds: number;
  total_keystrokes: number;
  total_deletions: number;
  total_pauses: number;
  human_sessions: number;
  suspicious_sessions: number;
  synthetic_sessions: number;
  certificate_count: number;
  approved_count: number;
  flagged_count: number;
  pending_count: number;
}

export interface StudentSessionItem {
  id: number;
  title: string;
  classification: string;
  classification_bucket: ClassificationBucket;
  confidence: number;
  risk_level: string;
  review_status: string;
  review_notes: string;
  wpm: number;
  duration_seconds: number;
  total_keystrokes: number;
  deletions: number;
  pauses: number;
  avg_iki: number;
  word_count: number;
  certificate_id: string | null;
  document_hash: string | null;
  course_name: string | null;
  course_code: string | null;
  created_at: string;
}

export interface StudentTrendPoint {
  day: string;
  session_count: number;
  avg_wpm: number;
  avg_confidence: number;
  human_count: number;
  suspicious_count: number;
  synthetic_count: number;
}

export interface StudentCourseSummary {
  course_name: string;
  course_code: string;
  session_count: number;
  avg_wpm: number;
  avg_confidence: number;
  human_count: number;
  suspicious_count?: number;
  synthetic_count?: number;
}

export interface StudentDashboardResponse {
  status: string;
  student: StudentProfileSummary;
  summary: StudentDashboardSummary;
  recent_sessions: StudentSessionItem[];
  trend: StudentTrendPoint[];
  courses: StudentCourseSummary[];
}

export interface StudentSessionsResponse {
  status: string;
  total: number;
  limit: number;
  offset: number;
  sessions: StudentSessionItem[];
}

export interface StudentDailyAnalytics {
  day: string;
  session_count: number;
  avg_wpm: number;
  avg_confidence: number;
  total_keys: number;
  deletions: number;
  pauses: number;
}

export interface StudentBestStats {
  best_wpm: number;
  best_confidence: number;
  longest_session: number;
  best_iki: number;
  total_sessions: number;
  total_seconds: number;
}

export interface StudentAnalyticsResponse {
  status: string;
  daily: StudentDailyAnalytics[];
  courses: StudentCourseSummary[];
  bests: StudentBestStats;
}
