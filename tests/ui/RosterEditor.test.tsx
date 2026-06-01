import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RosterEditor from "@/ui/RosterEditor";
import { DEFAULT_ROSTER } from "@/core/roster";

describe("RosterEditor", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <RosterEditor open={false} roster={DEFAULT_ROSTER} onSave={() => {}} onCancel={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("lists all players except 'op'", () => {
    render(<RosterEditor open={true} roster={DEFAULT_ROSTER} onSave={() => {}} onCancel={() => {}} />);
    // 16 SF players rendered; 'op' not
    const idInputs = screen.getAllByLabelText(/player id/i);
    expect(idInputs.length).toBe(16);
  });

  it("allows renaming a player and calls onSave with updated roster (incl. op at end)", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<RosterEditor open={true} roster={DEFAULT_ROSTER} onSave={onSave} onCancel={() => {}} />);
    // find the display-name input for jackson
    const jacksonDisplay = screen.getByDisplayValue("Jackson Corbett");
    await user.clear(jacksonDisplay);
    await user.type(jacksonDisplay, "Jackson C.");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledOnce();
    const saved = onSave.mock.calls[0][0];
    expect(saved.find((p: any) => p.id === "jackson").displayName).toBe("Jackson C.");
    expect(saved[saved.length - 1].id).toBe("op");
  });

  it("rejects save when an id is blank", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<RosterEditor open={true} roster={DEFAULT_ROSTER} onSave={onSave} onCancel={() => {}} />);
    const firstIdInput = screen.getAllByLabelText(/player id/i)[0];
    await user.clear(firstIdInput);
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/id/i)).toBeDefined(); // error mentions id
  });

  it("adds a new blank row via Add Player", async () => {
    const user = userEvent.setup();
    render(<RosterEditor open={true} roster={DEFAULT_ROSTER} onSave={() => {}} onCancel={() => {}} />);
    const before = screen.getAllByLabelText(/player id/i).length;
    await user.click(screen.getByRole("button", { name: /add player/i }));
    const after = screen.getAllByLabelText(/player id/i).length;
    expect(after).toBe(before + 1);
  });
});
