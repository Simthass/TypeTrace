// frontend/src/types/editor.ts

export type KeystrokeEventType = "keydown" | "keyup" | "paste";

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
}

export interface SessionStats {
  wpm: number;
  keystrokes: number;
  deletions: number;
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
