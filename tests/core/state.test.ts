import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { DEFAULT_ROSTER } from "@/core/roster";

describe("createInitialState", () => {
  it("zeroes all counters and creates a stat array per roster player", () => {
    const s = createInitialState({ opponentName: "Mitty", roster: DEFAULT_ROSTER });
    expect(s.opponentName).toBe("Mitty");
    expect(s.sfPoints).toBe(0);
    expect(s.opPoints).toBe(0);
    expect(s.possession).toBeNull();
    expect(s.previousTurnover).toBe(false);
    expect(s.secondChance).toBe(false);
    expect(s.lineup).toEqual([]);
    expect(Object.keys(s.rosterStats)).toHaveLength(DEFAULT_ROSTER.length);
    expect(s.rosterStats["jackson"]).toEqual(new Array(14).fill(0));
  });

  it("stores opponent displayName on roster[op] from opponentName input", () => {
    const withName = createInitialState({ opponentName: "Mitty", roster: DEFAULT_ROSTER });
    expect(withName.roster.find(p => p.id === "op")?.displayName).toBe("Mitty");

    const blank = createInitialState({ opponentName: "", roster: DEFAULT_ROSTER });
    expect(blank.roster.find(p => p.id === "op")?.displayName).toBe("OP");

    const padded = createInitialState({ opponentName: "  Bellarmine  ", roster: DEFAULT_ROSTER });
    expect(padded.roster.find(p => p.id === "op")?.displayName).toBe("Bellarmine");
  });
});
