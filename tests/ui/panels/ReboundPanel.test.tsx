import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReboundPanel from "@/ui/panels/ReboundPanel";
import { DEFAULT_ROSTER } from "@/core/roster";

const onCourt = ["jackson", "ayaan", "wes", "devin", "james"];

describe("ReboundPanel", () => {
  it("builds an offensive rebound string", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ReboundPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^jackson$/i }));
    await user.click(screen.getByRole("button", { name: /offensive rebound/i }));
    expect(onSubmit).toHaveBeenCalledWith("jackson or");
  });

  it("builds a defensive rebound string", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ReboundPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^ayaan$/i }));
    await user.click(screen.getByRole("button", { name: /defensive rebound/i }));
    expect(onSubmit).toHaveBeenCalledWith("ayaan dr");
  });

  it("is disabled until a player is selected", async () => {
    const onSubmit = vi.fn();
    render(<ReboundPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
    const or = screen.getByRole("button", { name: /offensive rebound/i }) as HTMLButtonElement;
    const dr = screen.getByRole("button", { name: /defensive rebound/i }) as HTMLButtonElement;
    expect(or.disabled).toBe(true);
    expect(dr.disabled).toBe(true);
  });

  it("does not render bench players", () => {
    render(<ReboundPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={() => {}} />);
    expect(screen.queryByRole("button", { name: /^drew$/i })).toBeNull();
  });
});
