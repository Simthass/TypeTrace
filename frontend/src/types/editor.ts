export type KeystrokeEventType =
  | "keydown"
  | "keyup"
  | "paste"
  | "cut"
  | "input"
  | "cursor";

export type DeletionMethod =
  | "single"
  | "word"
  | "line"
  | "selection"
  | "replacement"
  | "cut"
  | "all"
  | "unknown";

export interface KeystrokeEvent {
  key: string;
  keyCode: number;
  code?: string;
  type: KeystrokeEventType;
  timestamp: number;
  down_time: number | null;
  up_time: number | null;
  dwell_time: number | null;
  flight_time: number | null;
  documentLength: number;
  cursorPosition: number;
  pastedLength?: number;

  /**
   * Privacy-safe revision telemetry. These fields store counts and context only;
   * they never store deleted text content.
   */
  inputType?: string;
  revision_id?: string;
  documentLengthBefore?: number;
  documentLengthAfter?: number;
  selectionStartBefore?: number;
  selectionEndBefore?: number;
  selection_length_before?: number;
  deltaLength?: number;
  insertedCharacters?: number;
  /**
   * Literal text for a confirmed edit: a spellcheck correction, autocorrect,
   * IME candidate commit, keyboard replace-over-selection, or a clipboard
   * paste. Replay needs this to show the student's actual writing (and, for
   * paste, the actual pasted content so a reviewer can judge it) rather than
   * a placeholder. Deleted text is still never captured — only what was
   * added.
   */
  insertedText?: string;
  deletedCharacters?: number;
  chars_deleted?: number;
  deletion_method?: DeletionMethod;
  isBulkDeletion?: boolean;
  bulk_deletion?: boolean;

  /** Long inactive gap excluded from active writing duration. */
  idleBreakMs?: number;
  idle_break_ms?: number;
}

export interface SessionStats {
  wpm: number;
  keystrokes: number;

  /** Number of delete/revision actions, preserved for backward compatibility. */
  deletions: number;

  /** Actual volume of removed text. This is the industry-grade revision metric. */
  deletedCharacters: number;

  /** Count of revision actions that removed more than one character. */
  bulkDeletionEvents: number;

  /** Largest single removal in characters. */
  largestDeletionChars: number;

  /** Selected-text deletion/replacement actions. */
  selectionDeletionEvents: number;

  /** Ctrl/Option/word-level delete actions. */
  wordDeletionEvents: number;

  /** Cut actions that removed selected text. */
  cutEvents: number;

  pauses: number;
  avgIki: number;
  sessionSeconds: number;
}

export interface AdvancedStats {
  ht_mean?: number;
  ht_std?: number;
  ht_cv?: number;

  ft_mean?: number;
  ft_std?: number;
  ft_cv?: number;
  ft_entropy?: number;
  ft_autocorr?: number;

  burst_ratio?: number;
  pause_ratio?: number;
  net_wpm?: number;
  key_diversity?: number;
  total_keys?: number;

  paste_count?: number;
  paste_ratio?: number;
  deletion_ratio?: number;
  deletion_action_ratio?: number;
  deleted_characters?: number;
  deleted_character_ratio?: number;
  revision_intensity?: number;
  bulk_deletion_events?: number;
  largest_deletion_chars?: number;
  selection_deletion_events?: number;
  word_deletion_events?: number;
  cut_events?: number;
  longest_pause_ms?: number;

  risk_score?: number;
  risk_level?: "LOW" | "MEDIUM" | "HIGH" | string;

  risk_signals?: string[];
  human_signals?: string[];

  class_probabilities?: Record<string, number>;
  decision_source?: string;

  feature_explanations?: Record<string, string>;

  model_version?: string;
  model_accuracy?: number | string | null;
  model_cv_accuracy?: number | string | null;
  minimum_keys_required?: number;

  [key: string]: unknown;
}

export interface AnalysisResult {
  classification: string;
  confidence: number;
  stats: SessionStats;
  advanced_stats?: AdvancedStats;
  kill_switch_triggered?: boolean;
  kill_switch_reason?: string | null;
  certificate_id?: string | null;
  document_hash?: string | null;
  session_id?: number | null;
}

export interface EnrolledCourse {
  id: number;
  course_name: string;
  course_code: string;
}
