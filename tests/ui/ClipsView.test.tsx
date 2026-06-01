import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ClipsView from "@/ui/ClipsView";
import type { Stage2Json } from "@/stage2/types";

const sampleStage2: Stage2Json = {
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
  ],
};

describe("ClipsView", () => {
  it("renders empty state when no timeline loaded", () => {
    render(<ClipsView gameId="game_x" />);
    expect(screen.getByText(/load.*timeline/i)).toBeDefined();
  });

  it("loads a timeline JSON via the file input and shows clip count", async () => {
    const user = userEvent.setup();
    render(<ClipsView gameId="game_20260118_mountain_view" />);
    const file = new File(
      [JSON.stringify(sampleStage2)],
      "timeline.json",
      { type: "application/json" },
    );
    const input = screen.getByLabelText(/timeline json/i) as HTMLInputElement;
    await user.upload(input, file);
    expect(await screen.findByText(/1 clip/i)).toBeDefined();
  });

  it("toggling include free throws updates clip count", async () => {
    const user = userEvent.setup();
    render(<ClipsView gameId="game_20260118_mountain_view" />);
    const file = new File(
      [JSON.stringify(sampleStage2)],
      "timeline.json",
      { type: "application/json" },
    );
    await user.upload(screen.getByLabelText(/timeline json/i), file);
    expect(await screen.findByText(/1 clip/i)).toBeDefined();
    await user.click(screen.getByLabelText(/include free throws/i));
    expect(await screen.findByText(/2 clips/i)).toBeDefined();
  });

  it("download manifest button is disabled until timeline loaded", () => {
    render(<ClipsView gameId="game_x" />);
    const btn = screen.getByRole("button", { name: /download manifest/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});
