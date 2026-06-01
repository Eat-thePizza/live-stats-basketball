import { describe, it, expect } from "vitest";
import { formatElapsed } from "@/core/clock";

describe("formatElapsed", () => {
  it("null → --:--", () => {
    expect(formatElapsed(null)).toBe("--:--");
  });

  it.each([
    [0, "+00:00"],
    [37_000, "+00:37"],
    [312_000, "+05:12"],
    [1_123_000, "+18:43"],
    [-50, "+00:00"],
  ])("formatElapsed(%i) === %s", (input, expected) => {
    expect(formatElapsed(input)).toBe(expected);
  });
});
