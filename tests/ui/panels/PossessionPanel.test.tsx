import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PossessionPanel from "@/ui/panels/PossessionPanel";
import { DEFAULT_ROSTER } from "@/core/roster";

describe("PossessionPanel", () => {
  it("emits '-p sf' when SF button clicked", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PossessionPanel roster={DEFAULT_ROSTER} onCourt={[]} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /sf gets ball/i }));
    expect(onSubmit).toHaveBeenCalledWith("-p sf");
  });

  it("emits '-p op' when Opponent button clicked", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PossessionPanel roster={DEFAULT_ROSTER} onCourt={[]} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: /opponent gets ball/i }));
    expect(onSubmit).toHaveBeenCalledWith("-p op");
  });
});
