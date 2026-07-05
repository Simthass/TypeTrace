export type TeacherClassificationBucket =
  | "HUMAN"
  | "SUSPICIOUS"
  | "SYNTHETIC"
  | "UNKNOWN";
export type TeacherReviewStatus =
  | "PENDING"
  | "APPROVED"
  | "FLAGGED"
  | "NEEDS_DISCUSSION";

export interface TeacherProfile {
  id: string;
  first_name: string;
  last_name?: string;
  email: string;
  university_name?: string | null;
  department?: string | null;
}

export interface TeacherSummary {
  total_courses: number;
  total_students: number;
  total_submissions: number;
  pending_reviews: number;
  approved_reviews: number;
  flagged_reviews: number;
  human_submissions: number;
  suspicious_submissions: number;
  synthetic_submissions: number;
  avg_confidence: number;
  avg_wpm: number;
}

export interface TeacherCourse {
  id: number;
  course_name: string;
  course_code: string;
  invite_code: string;
  created_at: string;
  student_count: number;
  submission_count: number;
  pending_count: number;
  approved_count: number;
  flagged_count: number;
  avg_confidence: number;
  avg_wpm: number;
}

export interface TeacherStudent {
  id: string;
  student_name: string;
  email: string;
  student_id: string;
  university_name?: string | null;
  course_id: number;
  course_name: string;
  course_code: string;
  joined_at: string;
  submission_count: number;
  avg_confidence: number;
  avg_wpm: number;
  pending_count: number;
  flagged_count: number;
  last_submission_at: string;
}

export interface TeacherSubmission {
  id: number;
  title: string;
  student_name: string;
  student_email: string;
  student_id: string;
  course_id: number;
  course_name: string;
  course_code: string;
  classification: string;
  classification_bucket: TeacherClassificationBucket;
  confidence: number;
  risk_level: string;
  review_status: TeacherReviewStatus | string;
  review_notes: string;
  review_saved_at?: string;
  wpm: number;
  duration_seconds: number;
  total_keystrokes: number;
  deletions: number;
  pauses: number;
  avg_iki: number;
  word_count: number;
  certificate_id: string | null;
  document_hash: string | null;
  created_at: string;
  text_content?: string;
  raw_keystroke_data?: unknown[];
}

export interface TeacherDashboardResponse {
  status: string;
  teacher: TeacherProfile;
  summary: TeacherSummary;
  recent_submissions: TeacherSubmission[];
  courses: TeacherCourse[];
}

export interface TeacherCoursesResponse {
  status: string;
  courses: TeacherCourse[];
}

export interface TeacherCourseDetailResponse {
  status: string;
  course: TeacherCourse;
  students: Omit<
    TeacherStudent,
    | "course_id"
    | "course_name"
    | "course_code"
    | "university_name"
    | "pending_count"
    | "flagged_count"
  >[];
  submissions: TeacherSubmission[];
}

export interface TeacherStudentsResponse {
  status: string;
  students: TeacherStudent[];
}

export interface TeacherSubmissionsResponse {
  status: string;
  total: number;
  limit: number;
  offset: number;
  sessions: TeacherSubmission[];
}

export interface TeacherSubmissionDetailResponse {
  status: string;
  session: TeacherSubmission;
}
