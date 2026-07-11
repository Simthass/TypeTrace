export type ReplayClassificationBucket =
  | "HUMAN"
  | "SUSPICIOUS"
  | "SYNTHETIC"
  | "UNKNOWN";

export type ReplayEventType = "keydown" | "keyup" | "paste" | string;

export type ReplayTimelineMarkerType =
  | "paste"
  | "deletion"
  | "pause"
  | "cognitive_pause";

export interface ReplaySession {
  id: number;
  title: string;
  classification: string;
  classification_bucket: ReplayClassificationBucket;
  confidence: number;
  risk_level: string;
  duration_ms: number;
  duration_seconds: number;
  word_count: number;
  student_name: string;
  student_id: string;
  student_email: string;
  course_id: number | null;
  course_name: string | null;
  course_code: string | null;
  certificate_id: string | null;
  document_hash: string | null;
  review_status: string;
  review_notes: string;
  created_at: string;
}

export interface ReplayMetrics {
  avg_iki: number;
  dwell_time: number;
  deletion_ratio: number;
  deleted_characters: number;
  deleted_character_ratio: number;
  bulk_deletion_events: number;
  largest_deletion_chars: number;
  paste_count: number;
  paste_ratio: number;
  longest_pause_ms: number;
  burst_count: number;
  wpm: number;
  active_time_pct: number;
  pause_count: number;
  cognitive_pause_count: number;
  pause_density: number;
  total_events: number;
  keydown_events: number;
  deletion_count: number;
  mean_flight_ms: number;
  mean_dwell_ms: number;
}

export interface ReplayEvent {
  event_index: number;
  key: string;
  display_key: string;
  keyCode: number;
  code: string | null;
  type: ReplayEventType;
  timestamp: number;
  relative_time_ms: number;
  down_time: number | null;
  up_time: number | null;
  dwell_time: number | null;
  flight_time: number | null;
  documentLength: number;
  cursorPosition: number;
  pastedLength: number;
  inputType?: string | null;
  revision_id?: string | null;
  deletedCharacters: number;
  chars_deleted: number;
  selection_length_before: number;
  deletion_method?: string | null;
  is_bulk_deletion: boolean;
  documentLengthBefore: number;
  documentLengthAfter: number;
  deltaLength: number;
  insertedCharacters: number;
  /**
   * Literal text for this event: typed/corrected content, or the actual
   * pasted text for a paste event. Null/absent for legacy events recorded
   * before this field existed.
   */
  inserted_text?: string | null;
  is_paste: boolean;
  is_deletion: boolean;
  is_enter: boolean;
  is_space: boolean;
  is_pause: boolean;
  is_cognitive_pause: boolean;
}

export interface ReplayTimelineMarker {
  type: ReplayTimelineMarkerType;
  label: string;
  event_index: number;
  relative_time_ms: number;
  key: string;
}

export interface ReplayAudit {
  total_raw_events: number;
  total_normalized_events: number;
  has_paste_events: boolean;
  has_cognitive_pauses: boolean;
  has_deletions: boolean;
  integrity_hash: string | null;

  /**
   * Backend sets this when the event stream is larger than the safe replay limit.
   */
  is_truncated: boolean;

  /**
   * Maximum number of events returned to the frontend when truncation is active.
   */
  max_events_returned: number;
}

export interface ReplayResponse {
  status: "success" | string;
  session: ReplaySession;
  metrics: ReplayMetrics;
  events: ReplayEvent[];
  timeline_markers: ReplayTimelineMarker[];
  audit: ReplayAudit;
}

export interface ReplaySegment {
  text: string;
  type: "typed" | "paste";
}
