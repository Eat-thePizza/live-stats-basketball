import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ShotPanel from "@/ui/panels/ShotPanel";
import { DEFAULT_ROSTER } from "@/core/roster";

const onCourt = ["jackson", "ayaan", "wes", "devin", "james"];

function pickFirst(name: RegExp) {
  return screen.getAllByRole("button", { name })[0];
}
function pickLast(name: RegExp) {
  const all = screen.getAllByRole("button", { name });
  return all[all.length - 1];
}

describe("ShotPanel (v2)", () => {
  it("SF make with assist emits '<shooter> <shot> make <assist>'", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ShotPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
    await user.click(pickFirst(/^jackson$/i));
    await user.click(screen.getByRole("button", { name: /^two$/i }));
    await user.click(screen.getByRole("button", { name: /^make$/i }));
    await user.click(pickLast(/^ayaan$/i));
    await user.click(screen.getByRole("button", { name: /log shot/i }));
    expect(onSubmit).toHaveBeenCalledWith("jackson two make ayaan");
  });

  it("SF make without assist emits '<shooter> <shot> make'", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ShotPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
    await user.click(pickFirst(/^jackson$/i));
    await user.click(screen.getByRole("button", { name: /^three$/i }));
    await user.click(screen.getByRole("button", { name: /^make$/i }));
    await user.click(screen.getByRole("button", { name: /log shot/i }));
    expect(onSubmit).toHaveBeenCalledWith("jackson three make");
  });

  it("SF miss emits '<shooter> <shot> miss' with no secondary picker shown", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ShotPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
    await user.click(pickFirst(/^jackson$/i));
    await user.click(screen.getByRole("button", { name: /^two$/i }));
    await user.click(screen.getByRole("button", { name: /^miss$/i }));
    expect(screen.queryByText(/assist/i)).toBeNull();
    expect(screen.queryByText(/blocked by/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: /log shot/i }));
    expect(onSubmit).toHaveBeenCalledWith("jackson two miss");
  });

  it("Opponent make emits 'op <shot> make' with no secondary picker", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ShotPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
    await user.click(pickFirst(/^op$/i));
    await user.click(screen.getByRole("button", { name: /^two$/i }));
    await user.click(screen.getByRole("button", { name: /^make$/i }));
    expect(screen.queryByText(/assist/i)).toBeNull();
    expect(screen.queryByText(/blocked by/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: /log shot/i }));
    expect(onSubmit).toHaveBeenCalledWith("op two make");
  });

  it("Opponent miss with blocker emits 'op <shot> miss <blocker>'", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ShotPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
    await user.click(pickFirst(/^op$/i));
    await user.click(screen.getByRole("button", { name: /^three$/i }));
    await user.click(screen.getByRole("button", { name: /^miss$/i }));
    await user.click(pickLast(/^jackson$/i));
    await user.click(screen.getByRole("button", { name: /log shot/i }));
    expect(onSubmit).toHaveBeenCalledWith("op three miss jackson");
  });

  it("Opponent miss without blocker emits 'op <shot> miss'", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ShotPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={onSubmit} />);
    await user.click(pickFirst(/^op$/i));
    await user.click(screen.getByRole("button", { name: /^two$/i }));
    await user.click(screen.getByRole("button", { name: /^miss$/i }));
    await user.click(screen.getByRole("button", { name: /log shot/i }));
    expect(onSubmit).toHaveBeenCalledWith("op two miss");
  });

  it("assist picker excludes the selected shooter (no self-assist)", async () => {
    const user = userEvent.setup();
    render(<ShotPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={() => {}} />);
    await user.click(pickFirst(/^jackson$/i));
    await user.click(screen.getByRole("button", { name: /^two$/i }));
    await user.click(screen.getByRole("button", { name: /^make$/i }));
    // Two grids exist: shooter row (1x jackson) and assist row (no jackson).
    const jacksonButtons = screen.getAllByRole("button", { name: /^jackson$/i });
    expect(jacksonButtons.length).toBe(1);
  });

  it("primary picker shows only on-court SF players plus op", () => {
    render(<ShotPanel roster={DEFAULT_ROSTER} onCourt={onCourt} onSubmit={() => {}} />);
    expect(screen.queryByRole("button", { name: /^drew$/i })).toBeNull();
    for (const id of [...onCourt, "op"]) {
      expect(screen.getAllByRole("button", { name: new RegExp(`^${id}$`, "i") }).length).toBeGreaterThan(0);
    }
  });
});
