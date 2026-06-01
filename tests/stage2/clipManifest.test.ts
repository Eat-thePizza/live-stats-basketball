import { describe, it, expect } from "vitest";
import { buildClipManifest } from "@/stage2/clipManifest";
import type { Stage2Json } from "@/stage2/types";

const baseStage2: Stage2Json = {
  game_id: "game_20260118_mountain_view",
  source: "web_ui_command_history",
  export_type: "stage2_json_game_log",
  exported_at: "2026-01-18T20:15:30.000Z",
  game_context: {
    game_date: "2026-01-18",
    opponent: "Mountain View",
    opponent_alias: "op",
    home_team_label: "sf",
  },
  commands: [],
  events: [
    {
      event_id: "evt_000001",
      command_index: 0,
      raw_command: "+00:41 alden layup make wes",
      clock_text: "+00:41",
      elapsed_sec: 41,
      video_timestamp_sec: 41,
      event_type: "shot",
      team: "home",
      player: "alden",
      shot_type: "layup",
      result: "make",
      assist_player: "wes",
      related_player: null,
      warnings: [],
    },
    {
      event_id: "evt_000002",
      command_index: 1,
      raw_command: "+00:24 op ft make",
      clock_text: "+00:24",
      elapsed_sec: 24,
      video_timestamp_sec: 24,
      event_type: "free_throw",
      team: "op",
      player: null,
      shot_type: "free_throw",
      result: "make",
      assist_player: null,
      related_player: null,
      warnings: [],
    },
    {
      event_id: "evt_000003",
      command_index: 2,
      raw_command: "+00:17 op or",
      clock_text: "+00:17",
      elapsed_sec: 17,
      video_timestamp_sec: 17,
      event_type: "offensive_rebound",
      team: "op",
      player: null,
      shot_type: null,
      result: null,
      assist_player: null,
      related_player: null,
      warnings: [],
    },
  ],
};

describe("buildClipManifest", () => {
  it("includes only shot events by default", () => {
    const manifest = buildClipManifest(baseStage2, {
      tipoff_time_sec: 10,
      clip_before_sec: 4,
      clip_after_sec: 3,
    });
    expect(manifest.clips).toHaveLength(1);
    expect(manifest.clips[0].event_id).toBe("evt_000001");
  });

  it("includes free throws when include_free_throws=true", () => {
    const manifest = buildClipManifest(baseStage2, {
      tipoff_time_sec: 10,
      clip_before_sec: 4,
      clip_after_sec: 3,
      include_free_throws: true,
    });
    expect(manifest.clips).toHaveLength(2);
    expect(manifest.clips.map(c => c.event_id)).toEqual([
      "evt_000001",
      "evt_000002",
    ]);
  });

  it("computes video_timestamp = tipoff + elapsed and window math", () => {
    const manifest = buildClipManifest(baseStage2, {
      tipoff_time_sec: 10,
      clip_before_sec: 4,
      clip_after_sec: 3,
    });
    const c = manifest.clips[0];
    expect(c.elapsed_time_sec).toBe(41);
    expect(c.video_timestamp).toBe(51);
    expect(c.video_start_sec).toBe(47);
    expect(c.video_end_sec).toBe(54);
    expect(c.duration_sec).toBe(7);
  });

  it("clamps video_start_sec at 0", () => {
    const stage2: Stage2Json = {
      ...baseStage2,
      events: [
        { ...baseStage2.events[0], elapsed_sec: 1, video_timestamp_sec: 1 },
      ],
    };
    const manifest = buildClipManifest(stage2, {
      tipoff_time_sec: 0,
      clip_before_sec: 4,
      clip_after_sec: 3,
    });
    const c = manifest.clips[0];
    expect(c.video_start_sec).toBe(0);
    expect(c.video_end_sec).toBe(4);
    expect(c.duration_sec).toBe(4);
  });

  it("renumbers clip_id densely as shot_NNNNNN", () => {
    const stage2: Stage2Json = {
      ...baseStage2,
      events: [
        baseStage2.events[2],
        baseStage2.events[1],
        baseStage2.events[0],
      ],
    };
    const manifest = buildClipManifest(stage2, {
      tipoff_time_sec: 0,
      clip_before_sec: 1,
      clip_after_sec: 1,
    });
    expect(manifest.clips).toHaveLength(1);
    expect(manifest.clips[0].clip_id).toBe("shot_000001");
  });

  it("skips events with null elapsed_sec", () => {
    const stage2: Stage2Json = {
      ...baseStage2,
      events: [
        {
          ...baseStage2.events[0],
          elapsed_sec: null,
          video_timestamp_sec: null,
        },
      ],
    };
    const manifest = buildClipManifest(stage2, {
      tipoff_time_sec: 0,
      clip_before_sec: 1,
      clip_after_sec: 1,
    });
    expect(manifest.clips).toHaveLength(0);
  });

  it("preserves game_id and copies settings", () => {
    const settings = {
      tipoff_time_sec: 10,
      clip_before_sec: 4,
      clip_after_sec: 3,
    };
    const manifest = buildClipManifest(baseStage2, settings);
    expect(manifest.game_id).toBe("game_20260118_mountain_view");
    expect(manifest.source).toBe("web_ui_command_history");
    expect(manifest.source_video).toBeNull();
    expect(manifest.settings).toMatchObject(settings);
  });

  it("sets all clips to status=planned", () => {
    const manifest = buildClipManifest(baseStage2, {
      tipoff_time_sec: 10,
      clip_before_sec: 4,
      clip_after_sec: 3,
      include_free_throws: true,
    });
    for (const c of manifest.clips) expect(c.status).toBe("planned");
  });

  it("clip_path is clips/<clip_id>.mp4", () => {
    const manifest = buildClipManifest(baseStage2, {
      tipoff_time_sec: 0,
      clip_before_sec: 1,
      clip_after_sec: 1,
    });
    expect(manifest.clips[0].clip_path).toBe("clips/shot_000001.mp4");
  });
});
