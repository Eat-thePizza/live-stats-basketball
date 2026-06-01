import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TimeoutQuarterPanel from "@/ui/panels/TimeoutQuarterPanel";
import { DEFAULT_ROSTER } from "@/core/roster";

describe("TimeoutQuarterPanel", () => {
  it("emits '-t' for Timeout", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TimeoutQuarterPanel roster={DEFAULT_ROSTER} onCourt={[]} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /^timeout$/i }));
    expect(onSubmit).toHaveBeenCalledWith("-t");
  });

  it("emits '---' for End Quarter", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TimeoutQuarterPanel roster={DEFAULT_ROSTER} onCourt={[]} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /end quarter/i }));
    expect(onSubmit).toHaveBeenCalledWith("---");
  });

  it("emits 'tip' when Tipoff is clicked and tipoffDone is false", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <TimeoutQuarterPanel
        roster={DEFAULT_ROSTER}
        onCourt={[]}
        onSubmit={onSubmit}
        tipoffDone={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^tipoff$/i }));
    expect(onSubmit).toHaveBeenCalledWith("tip");
  });

  it("disables the Tipoff button and relabels it 'Clock Running' when tipoffDone is true", () => {
    render(
      <TimeoutQuarterPanel
        roster={DEFAULT_ROSTER}
        onCourt={[]}
        onSubmit={() => {}}
        tipoffDone={true}
      />,
    );
    const btn = screen.getByRole("button", { name: /clock running/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /^tipoff$/i })).toBeNull();
  });
});
