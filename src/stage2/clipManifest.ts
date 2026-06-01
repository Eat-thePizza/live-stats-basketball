import type { Stage2Event, Stage2Json } from "./types";
import type { Clip, ClipManifest, ClipSettings } from "./clipManifestTypes";

const DEFAULT_INCLUDED: ReadonlyArray<Stage2Event["event_type"]> = ["shot"];
const FT_INCLUDED: ReadonlyArray<Stage2Event["event_type"]> = [
  "shot",
  "free_throw",
];

function pad6(n: number): string {
  return n.toString().padStart(6, "0");
}

export function buildClipManifest(
  json: Stage2Json,
  settings: ClipSettings,
  opts: { source_video?: string | null } = {},
): ClipManifest {
  const include = settings.include_free_throws ? FT_INCLUDED : DEFAULT_INCLUDED;
  const tipoff = Math.max(0, settings.tipoff_time_sec);
  const before = Math.max(0, settings.clip_before_sec);
  const after = Math.max(0, settings.clip_after_sec);

  const clips: Clip[] = [];
  let n = 1;
  for (const e of json.events) {
    if (!include.includes(e.event_type)) continue;
    if (e.elapsed_sec === null || e.elapsed_sec === undefined) continue;
    const elapsed_time_sec = e.elapsed_sec;
    const video_timestamp = tipoff + elapsed_time_sec;
    const video_start_sec = Math.max(0, video_timestamp - before);
    const video_end_sec = video_timestamp + after;
    const duration_sec = video_end_sec - video_start_sec;
    const clip_id = `shot_${pad6(n++)}`;
    clips.push({
      clip_id,
      event_id: e.event_id,
      raw_command: e.raw_command,
      elapsed_time_sec,
      video_timestamp,
      video_start_sec,
      video_end_sec,
      duration_sec,
      clip_path: `clips/${clip_id}.mp4`,
      status: "planned",
    });
  }

  return {
    game_id: json.game_id,
    source: "web_ui_command_history",
    source_video: opts.source_video ?? null,
    settings: {
      tipoff_time_sec: tipoff,
      clip_before_sec: before,
      clip_after_sec: after,
      include_free_throws: !!settings.include_free_throws,
    },
    clips,
  };
}

export type {
  Clip,
  ClipManifest,
  ClipSettings,
  ClipStatus,
} from "./clipManifestTypes";
