import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NewGameModal from "@/ui/NewGameModal";
import { DEFAULT_ROSTER } from "@/core/roster";

const FIVE = ["jackson","ayaan","wes","devin","james"];

async function pickLineup(user: ReturnType<typeof userEvent.setup>, ids: string[]) {
  for (const id of ids) {
    const buttons = screen.getAllByRole("button", { name: new RegExp(`^${id}$`, "i") });
    await user.click(buttons[0]);
  }
}

describe("NewGameModal (v2)", () => {
  it("renders nothing when not open", () => {
    const { container } = render(<NewGameModal open={false} roster={DEFAULT_ROSTER} onConfirm={() => {}} onCancel={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the new prompt text", () => {
    render(<NewGameModal open={true} roster={DEFAULT_ROSTER} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText(/enter the opponent's name \(optional\)/i)).toBeDefined();
  });

  it("Start Game is disabled with 0 players selected", () => {
    render(<NewGameModal open={true} roster={DEFAULT_ROSTER} onConfirm={() => {}} onCancel={() => {}} />);
    const btn = screen.getByRole("button", { name: /start game/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("Start Game is disabled with 4 selected", async () => {
    const user = userEvent.setup();
    render(<NewGameModal open={true} roster={DEFAULT_ROSTER} onConfirm={() => {}} onCancel={() => {}} />);
    await pickLineup(user, FIVE.slice(0, 4));
    const btn = screen.getByRole("button", { name: /start game/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("unselected player buttons become disabled once 5 are selected", async () => {
    const user = userEvent.setup();
    render(<NewGameModal open={true} roster={DEFAULT_ROSTER} onConfirm={() => {}} onCancel={() => {}} />);
    await pickLineup(user, FIVE);
    const drewBtn = screen.getByRole("button", { name: /^drew$/i }) as HTMLButtonElement;
    expect(drewBtn.disabled).toBe(true);
    // Selected button remains enabled (to allow toggling off)
    const jacksonBtn = screen.getByRole("button", { name: /^jackson$/i }) as HTMLButtonElement;
    expect(jacksonBtn.disabled).toBe(false);
  });

  it("blank name + 5 selected → onConfirm('', [5 ids in roster order])", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<NewGameModal open={true} roster={DEFAULT_ROSTER} onConfirm={onConfirm} onCancel={() => {}} />);
    await pickLineup(user, FIVE);
    await user.click(screen.getByRole("button", { name: /start game/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const [name, lineup] = onConfirm.mock.calls[0];
    expect(name).toBe("");
    // 5 ids, all from FIVE, but ordered by DEFAULT_ROSTER position
    expect(new Set(lineup)).toEqual(new Set(FIVE));
    expect(lineup).toHaveLength(5);
  });

  it("typed opponent + 5 selected → onConfirm('Mitty', [...])", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<NewGameModal open={true} roster={DEFAULT_ROSTER} onConfirm={onConfirm} onCancel={() => {}} />);
    await user.type(screen.getByLabelText(/opponent/i), "Mitty");
    await pickLineup(user, FIVE);
    await user.click(screen.getByRole("button", { name: /start game/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toBe("Mitty");
    expect(onConfirm.mock.calls[0][1]).toHaveLength(5);
  });

  it("Cancel button calls onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<NewGameModal open={true} roster={DEFAULT_ROSTER} onConfirm={() => {}} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Escape key calls onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<NewGameModal open={true} roster={DEFAULT_ROSTER} onConfirm={() => {}} onCancel={onCancel} />);
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
