export type Stage2EventType =
  | "shot"
  | "free_throw"
  | "turnover"
  | "offensive_rebound"
  | "defensive_rebound"
  | "rebound"
  | "tip"
  | "control_or_unknown";

export type Stage2Team = "home" | "op";
export type Stage2ShotType = "two" | "three" | "layup" | "free_throw";
export type Stage2Result = "make" | "miss";

export interface Stage2Event {
  event_id: string;
  command_index: number;
  raw_command: string;
  clock_text: string | null;
  elapsed_sec: number | null;
  video_timestamp_sec: number | null;
  event_type: Stage2EventType;
  team: Stage2Team | null;
  player: string | null;
  shot_type: Stage2ShotType | null;
  result: Stage2Result | null;
  assist_player: string | null;
  related_player: string | null;
  warnings: string[];
}

export interface Stage2Command {
  command_index: number;
  raw_command: string;
}

export interface Stage2GameContext {
  game_date: string;
  opponent: string | null;
  opponent_alias: "op";
  home_team_label: "sf";
}

export interface Stage2Json {
  game_id: string;
  source: "web_ui_command_history";
  export_type: "stage2_json_game_log";
  exported_at: string;
  game_context: Stage2GameContext;
  commands: Stage2Command[];
  events: Stage2Event[];
}
