import { describe, it, expect } from "vitest";
import { buildStage2Json } from "@/stage2/exportJson";
import { createInitialState } from "@/core/state";
import { DEFAULT_ROSTER } from "@/core/roster";
import { execute } from "@/core/executor";
import { parseCommand } from "@/core/parser";

describe("buildStage2Json (browser path)", () => {
  it("derives game_id from sanitized opponent display name", () => {
    const state = createInitialState({
      opponentName: "Mountain View",
      roster: DEFAULT_ROSTER,
    });
    const json = buildStage2Json(state, { exportedAt: "2026-01-18T20:15:30.000Z" });
    expect(json.game_id).toMatch(/^game_\d{8}_mountain_view$/);
    expect(json.game_context.opponent).toBe("Mountain View");
  });

  it("falls back to date-only id when opponent is blank", () => {
    const state = createInitialState({ opponentName: "", roster: DEFAULT_ROSTER });
    const json = buildStage2Json(state, { exportedAt: "2026-01-18T20:15:30.000Z" });
    expect(json.game_id).toMatch(/^game_\d{8}$/);
    expect(json.game_context.opponent).toBeNull();
  });

  it("converts a small command-history sequence end-to-end", () => {
    let state = createInitialState({ opponentName: "Mitty", roster: DEFAULT_ROSTER });
    state = { ...state, lineup: ["jackson", "ayaan", "alden", "wes", "max"] };
    const inputs = ["tip", "jackson two make ayaan", "op three miss", "wes or"];
    for (const line of inputs) {
      state = execute(state, parseCommand(line, state.roster), line);
    }
    const json = buildStage2Json(state, { exportedAt: "2026-01-18T20:15:30.000Z" });
    expect(json.commands.length).toBe(state.commandHistory.length);
    expect(json.events.length).toBeGreaterThanOrEqual(state.commandHistory.length);
    expect(json.events[0].event_type).toBe("tip");
    const jacksonShot = json.events.find(
      e => e.event_type === "shot" && e.player === "jackson",
    );
    expect(jacksonShot).toBeTruthy();
    expect(jacksonShot?.assist_player).toBe("ayaan");
  });

  it("emits no parse_confidence anywhere", () => {
    const state = createInitialState({ opponentName: "X", roster: DEFAULT_ROSTER });
    const json = buildStage2Json(state, { exportedAt: "2026-01-18T20:15:30.000Z" });
    for (const e of json.events) {
      expect("parse_confidence" in e).toBe(false);
    }
  });
});
