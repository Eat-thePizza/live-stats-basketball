export interface ClipSettings {
  tipoff_time_sec: number;
  clip_before_sec: number;
  clip_after_sec: number;
  include_free_throws?: boolean;
}

export type ClipStatus = "planned" | "extracted" | "failed" | "skipped";

export interface Clip {
  clip_id: string;
  event_id: string;
  raw_command: string;
  elapsed_time_sec: number;
  video_timestamp: number;
  video_start_sec: number;
  video_end_sec: number;
  duration_sec: number;
  clip_path: string;
  status: ClipStatus;
  status_detail?: string;
}

export interface ClipManifest {
  game_id: string;
  source: "web_ui_command_history";
  source_video: string | null;
  settings: ClipSettings;
  clips: Clip[];
}
