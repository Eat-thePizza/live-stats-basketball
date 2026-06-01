import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import StatsTable from "@/ui/StatsTable";
import { createInitialState } from "@/core/state";
import { DEFAULT_ROSTER } from "@/core/roster";
import { applyShot } from "@/core/events";

describe("StatsTable", () => {
  it("renders the expected column headers", () => {
    render(<StatsTable state={createInitialState({ opponentName: "", roster: DEFAULT_ROSTER })} />);
    ["Player","2PM/2PA","2P%","3PM/3PA","3P%","OR","DR","TO","STL","AST","BLK","FTM/FTA","FT%","+/-","Points"]
      .forEach(h => expect(screen.getByRole("columnheader", { name: h })).toBeDefined());
  });

  it("reflects a shot in the shooter's row", () => {
    let s = createInitialState({ opponentName: "", roster: DEFAULT_ROSTER });
    s = applyShot(s, { player: "jackson", shot: "three", made: true });
    render(<StatsTable state={s} />);
    const jacksonRow = screen.getByRole("row", { name: /jackson/i });
    const cells = within(jacksonRow).getAllByRole("cell");
    // find the Points cell = last cell
    expect(cells[cells.length - 1].textContent).toBe("3");
  });

  it("renders Other Stats block", () => {
    render(<StatsTable state={createInitialState({ opponentName: "", roster: DEFAULT_ROSTER })} />);
    expect(screen.getByText(/Points off turnovers/i)).toBeDefined();
    expect(screen.getByText(/Second Chance/i)).toBeDefined();
    expect(screen.getByText(/OffRTG/i)).toBeDefined();
  });
});
