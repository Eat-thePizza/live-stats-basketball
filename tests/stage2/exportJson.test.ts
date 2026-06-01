import { describe, it, expect } from "vitest";
import {
  parseLineToEvents,
  buildStage2JsonFromLines,
  sanitizeSlug,
} from "@/stage2/exportJson";

describe("parseLineToEvents", () => {
  it("parses home shot with assist", () => {
    const events = parseLineToEvents("+02:10 james layup make alden", 0);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event_type: "shot",
      team: "home",
      player: "james",
      shot_type: "layup",
      result: "make",
      assist_player: "alden",
      clock_text: "+02:10",
      elapsed_sec: 130,
      video_timestamp_sec: 130,
      warnings: [],
    });
  });

  it("parses wes three make max as wes/three/make/max", () => {
    const events = parseLineToEvents("+00:07 wes three make max", 5);
    expect(events[0]).toMatchObject({
      player: "wes",
      shot_type: "three",
      result: "make",
      assist_player: "max",
    });
  });

  it("parses alden layup make wes as alden/layup/make/wes", () => {
    const events = parseLineToEvents("+00:41 alden layup make wes", 9);
    expect(events[0]).toMatchObject({
      player: "alden",
      shot_type: "layup",
      result: "make",
      assist_player: "wes",
    });
  });

  it("parses missed home shot without assist", () => {
    const events = parseLineToEvents("+01:52 ayaan layup miss", 2);
    expect(events[0]).toMatchObject({
      event_type: "shot",
      team: "home",
      player: "ayaan",
      shot_type: "layup",
      result: "miss",
      assist_player: null,
    });
  });

  it("parses opponent three miss", () => {
    const events = parseLineToEvents("+00:12 op three miss", 3);
    expect(events[0]).toMatchObject({
      event_type: "shot",
      team: "op",
      player: null,
      shot_type: "three",
      result: "miss",
    });
  });

  it("parses opponent layup make", () => {
    const events = parseLineToEvents("+02:41 op layup make", 1);
    expect(events[0]).toMatchObject({
      event_type: "shot",
      team: "op",
      shot_type: "layup",
      result: "make",
    });
  });

  it("normalizes 3 -> three", () => {
    const events = parseLineToEvents("+00:30 james 3 make", 0);
    expect(events[0].shot_type).toBe("three");
  });

  it("emits one free_throw event for op ft make", () => {
    const events = parseLineToEvents("+00:24 op ft make", 0);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event_type: "free_throw",
      team: "op",
      shot_type: "free_throw",
      result: "make",
    });
  });

  it("emits multiple events for multi-shot ft line, sharing command_index", () => {
    const events = parseLineToEvents("+00:24 alex ft make miss make", 7);
    expect(events).toHaveLength(3);
    expect(events.map(e => e.result)).toEqual(["make", "miss", "make"]);
    expect(events.every(e => e.command_index === 7)).toBe(true);
    expect(events.every(e => e.raw_command === "+00:24 alex ft make miss make")).toBe(true);
  });

  it("parses home turnover", () => {
    const events = parseLineToEvents("+02:46 alden to", 0);
    expect(events[0]).toMatchObject({
      event_type: "turnover",
      team: "home",
      player: "alden",
      related_player: null,
    });
  });

  it("parses opponent turnover with stealer as related_player", () => {
    const events = parseLineToEvents("+00:51 op to alden", 0);
    expect(events[0]).toMatchObject({
      event_type: "turnover",
      team: "op",
      player: null,
      related_player: "alden",
    });
  });

  it("parses op or as offensive_rebound for op", () => {
    const events = parseLineToEvents("+00:17 op or", 0);
    expect(events[0]).toMatchObject({
      event_type: "offensive_rebound",
      team: "op",
    });
  });

  it("parses tip as event_type tip with no team/player", () => {
    const events = parseLineToEvents("+00:00 tip", 0);
    expect(events[0]).toMatchObject({
      event_type: "tip",
      team: null,
      player: null,
      warnings: [],
    });
  });

  it("preserves UI control --- with warning", () => {
    const events = parseLineToEvents("+02:21 ---", 0);
    expect(events[0]).toMatchObject({
      event_type: "control_or_unknown",
      raw_command: "+02:21 ---",
    });
    expect(events[0].warnings).toContain(
      "Preserved current UI control command without Stage 2 semantic interpretation",
    );
  });

  it("preserves -p op with warning", () => {
    const events = parseLineToEvents("+01:37 -p op", 0);
    expect(events[0].event_type).toBe("control_or_unknown");
    expect(events[0].warnings.length).toBe(1);
  });

  it("strips numbered list prefix like '21. '", () => {
    const events = parseLineToEvents("21. +00:07 wes three make max", 20);
    expect(events[0]).toMatchObject({
      raw_command: "+00:07 wes three make max",
      player: "wes",
      shot_type: "three",
      assist_player: "max",
    });
  });

  it("never emits parse_confidence", () => {
    const events = parseLineToEvents("+00:00 tip", 0);
    expect("parse_confidence" in events[0]).toBe(false);
  });
});

describe("sanitizeSlug", () => {
  it("lowercases and replaces spaces with underscores", () => {
    expect(sanitizeSlug("Mountain View")).toBe("mountain_view");
  });
  it("strips unsafe chars", () => {
    expect(sanitizeSlug("Palo Alto / North!")).toBe("palo_alto_north");
  });
  it("returns empty string for blank input", () => {
    expect(sanitizeSlug("")).toBe("");
    expect(sanitizeSlug("   ")).toBe("");
  });
});

describe("buildStage2JsonFromLines", () => {
  it("preserves every line in commands[] in order", () => {
    const json = buildStage2JsonFromLines(
      ["+02:46 alden to", "+02:41 op layup make", "+00:00 tip"],
      { game_id: "game_20260118", game_date: "2026-01-18", opponent: null },
      { exportedAt: "2026-01-18T20:15:30.000Z" },
    );
    expect(json.commands).toHaveLength(3);
    expect(json.commands.map(c => c.command_index)).toEqual([0, 1, 2]);
    expect(json.commands[0].raw_command).toBe("+02:46 alden to");
  });

  it("preserves command order when ft expansion creates extra events", () => {
    const json = buildStage2JsonFromLines(
      ["+00:24 alex ft make miss"],
      { game_id: "g", game_date: "2026-01-18", opponent: null },
      { exportedAt: "2026-01-18T20:15:30.000Z" },
    );
    expect(json.commands).toHaveLength(1);
    expect(json.events).toHaveLength(2);
    expect(json.events.every(e => e.command_index === 0)).toBe(true);
  });

  it("renumbers event_id sequentially across the whole game", () => {
    const json = buildStage2JsonFromLines(
      ["+00:00 tip", "+00:24 alex ft make miss"],
      { game_id: "g", game_date: "2026-01-18", opponent: null },
      { exportedAt: "2026-01-18T20:15:30.000Z" },
    );
    expect(json.events.map(e => e.event_id)).toEqual([
      "evt_000001",
      "evt_000002",
      "evt_000003",
    ]);
  });

  it("sets fixed source/export_type fields", () => {
    const json = buildStage2JsonFromLines(
      [],
      { game_id: "g", game_date: "2026-01-18", opponent: null },
      { exportedAt: "2026-01-18T20:15:30.000Z" },
    );
    expect(json.source).toBe("web_ui_command_history");
    expect(json.export_type).toBe("stage2_json_game_log");
    expect(json.game_context.opponent_alias).toBe("op");
    expect(json.game_context.home_team_label).toBe("sf");
  });
});
