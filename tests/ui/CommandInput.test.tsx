import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CommandInput from "@/ui/CommandInput";

describe("CommandInput", () => {
  it("submits on Enter and clears input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CommandInput onSubmit={onSubmit} />);
    const input = screen.getByRole("textbox");
    await user.type(input, "jackson two make");
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("jackson two make");
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("does not submit on empty input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CommandInput onSubmit={onSubmit} />);
    await user.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
