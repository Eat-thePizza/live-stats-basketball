import { describe, it, expect } from "vitest";
import { DEFAULT_ROSTER, isValidPlayerId } from "@/core/roster";

describe("default roster", () => {
  it("includes all 17 CLI players and the opponent", () => {
    const ids = DEFAULT_ROSTER.map(p => p.id);
    expect(ids).toEqual(expect.arrayContaining([
      "devin","alden","wes","max","ayaan","luke","john","james",
      "jackson","yidi","derek","gianni","kingston","zane","zayden","drew","op"
    ]));
    expect(DEFAULT_ROSTER).toHaveLength(17);
  });

  it("isValidPlayerId returns true for roster members", () => {
    expect(isValidPlayerId(DEFAULT_ROSTER, "jackson")).toBe(true);
    expect(isValidPlayerId(DEFAULT_ROSTER, "nobody")).toBe(false);
  });
});
