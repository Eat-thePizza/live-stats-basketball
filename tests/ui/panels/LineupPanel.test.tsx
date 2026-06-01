import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LineupPanel from "@/ui/panels/LineupPanel";
import { DEFAULT_ROSTER } from "@/core/roster";

const onCourt = ["jackson", "ayaan", "wes", "devin", "james"];

describe("LineupPanel", () => {
  it("builds a -l lineup string with exactly 5 players", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LineupPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
    // pick first grid's buttons (Set Full Lineup) - they are the first 16 player buttons
    const ids = ["jackson", "ayaan", "devin", "wes", "max"];
    for (const id of ids) {
      const btn = screen.getAllByRole("button", { name: new RegExp(`^${id}$`, "i") })[0];
      await user.click(btn);
    }
    await user.click(screen.getByRole("button", { name: /^set lineup$/i }));
    expect(onSubmit).toHaveBeenCalledWith("-l jackson ayaan devin wes max");
  });

  it("caps selection at 5 players (6th click is a no-op)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LineupPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
    const ids = ["jackson", "ayaan", "devin", "wes", "max", "luke"];
    for (const id of ids) {
      const btn = screen.getAllByRole("button", { name: new RegExp(`^${id}$`, "i") })[0];
      await user.click(btn);
    }
    await user.click(screen.getByRole("button", { name: /^set lineup$/i }));
    // Luke was ignored; first 5 used
    expect(onSubmit).toHaveBeenCalledWith("-l jackson ayaan devin wes max");
  });

  it("excludes 'op' from lineup selection", () => {
    render(<LineupPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /^op$/i })).toBeNull();
  });

  it("Sub 'Player In' picker hides on-court players and shows bench", () => {
    render(<LineupPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={() => {}} />);
    const drewButtons = screen.getAllByRole("button", { name: /^drew$/i });
    expect(drewButtons.length).toBe(2); // Set Lineup + Player In
    const jacksonButtons = screen.getAllByRole("button", { name: /^jackson$/i });
    expect(jacksonButtons.length).toBe(2); // Set Lineup + Player Out
  });

  it("Sub with on-court → bench emits '-s <in> <out>'", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LineupPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
    const drewButtons = screen.getAllByRole("button", { name: /^drew$/i });
    await user.click(drewButtons[1]); // Player In
    const jacksonButtons = screen.getAllByRole("button", { name: /^jackson$/i });
    await user.click(jacksonButtons[1]); // Player Out
    await user.click(screen.getByRole("button", { name: /^sub$/i }));
    expect(onSubmit).toHaveBeenCalledWith("-s drew jackson");
  });
});
