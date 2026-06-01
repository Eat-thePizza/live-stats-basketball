import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TurnoverPanel from "@/ui/panels/TurnoverPanel";
import { DEFAULT_ROSTER } from "@/core/roster";

const onCourt = ["jackson", "ayaan", "wes", "devin", "james"];

describe("TurnoverPanel", () => {
  it("builds a turnover string without steal", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TurnoverPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
    // first grid = committer
    const firstJackson = screen.getAllByRole("button", { name: /^jackson$/i })[0];
    await user.click(firstJackson);
    await user.click(screen.getByRole("button", { name: /log turnover/i }));
    expect(onSubmit).toHaveBeenCalledWith("jackson to");
  });

  it("builds a turnover string with a stealer", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TurnoverPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
    const firstJackson = screen.getAllByRole("button", { name: /^jackson$/i })[0];
    await user.click(firstJackson);
    const ayaanBtns = screen.getAllByRole("button", { name: /^ayaan$/i });
    // second grid = stealer
    await user.click(ayaanBtns[ayaanBtns.length - 1]);
    await user.click(screen.getByRole("button", { name: /log turnover/i }));
    expect(onSubmit).toHaveBeenCalledWith("jackson to ayaan");
  });

  it("does not render bench players", () => {
    render(<TurnoverPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={() => {}} />);
    expect(screen.queryByRole("button", { name: /^drew$/i })).toBeNull();
  });

  it("stealer picker excludes the currently selected primary player", async () => {
    const user = userEvent.setup();
    render(<TurnoverPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={() => {}} />);
    // Pick jackson as the primary turnover committer
    const jacksonButtons = screen.getAllByRole("button", { name: /^jackson$/i });
    await user.click(jacksonButtons[0]);
    // The stealer picker (second grid) should not contain jackson anymore
    const jacksonAfter = screen.queryAllByRole("button", { name: /^jackson$/i });
    expect(jacksonAfter.length).toBe(1); // only the primary selection remains
  });
});
