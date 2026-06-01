import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CommandHistory from "@/ui/CommandHistory";

describe("CommandHistory", () => {
  it("shows placeholder when empty", () => {
    render(<CommandHistory history={[]} />);
    expect(screen.getByText(/no commands yet/i)).toBeDefined();
  });

  it("renders entries newest first with timestamp prefix", () => {
    render(
      <CommandHistory
        history={[
          { line: "first", tMs: null },
          { line: "tip", tMs: 0 },
          { line: "jackson two make", tMs: 37_000 },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain("+00:37");
    expect(items[0].textContent).toContain("jackson two make");
    expect(items[1].textContent).toContain("+00:00");
    expect(items[1].textContent).toContain("tip");
    expect(items[2].textContent).toContain("--:--");
    expect(items[2].textContent).toContain("first");
  });
});
