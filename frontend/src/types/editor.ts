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
  ft_mean?: number;
  ft_std?: number;
  ft_entropy?: number;
  ft_autocorr?: number;
  burst_ratio?: number;
  pause_ratio?: number;
  net_wpm?: number;
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
