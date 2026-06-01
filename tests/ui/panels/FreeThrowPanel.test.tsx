import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FreeThrowPanel from "@/ui/panels/FreeThrowPanel";
import { DEFAULT_ROSTER } from "@/core/roster";

const onCourt = ["jackson", "ayaan", "wes", "devin", "james"];

describe("FreeThrowPanel", () => {
  it("builds a CLI string with multiple results", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<FreeThrowPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^jackson$/i }));
    await user.click(screen.getByRole("button", { name: /\+ make/i }));
    await user.click(screen.getByRole("button", { name: /\+ miss/i }));
    await user.click(screen.getByRole("button", { name: /\+ make/i }));
    await user.click(screen.getByRole("button", { name: /log fts/i }));
    expect(onSubmit).toHaveBeenCalledWith("jackson ft make miss make");
  });

  it("is disabled until a player and at least one result are selected", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<FreeThrowPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
    const submitBtn = screen.getByRole("button", { name: /log fts/i }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: /^jackson$/i }));
    expect(submitBtn.disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: /\+ make/i }));
    expect(submitBtn.disabled).toBe(false);
    await user.click(submitBtn);
    expect(onSubmit).toHaveBeenCalledWith("jackson ft make");
  });

  it("does not render bench players", () => {
    render(<FreeThrowPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={() => {}} />);
    expect(screen.queryByRole("button", { name: /^drew$/i })).toBeNull();
  });
});
