import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { DEFAULT_ROSTER } from "@/core/roster";
import { applyShot, applyFreeThrows } from "@/core/events";
import { computePlayerRow, computeTeamRow, computeOffRTG } from "@/core/stats";

const init = () => createInitialState({ opponentName: "", roster: DEFAULT_ROSTER });

describe("computePlayerRow", () => {
  it("zero-stat row has empty ratios and zero pcts", () => {
    const row = computePlayerRow(init(), "jackson");
    expect(row.displayName).toBe("Jackson Corbett");
    expect(row.twoMadeOverAttempted).toBe("0/0");
    expect(row.twoPct).toBe(0);
    expect(row.threeMadeOverAttempted).toBe("0/0");
    expect(row.threePct).toBe(0);
    expect(row.ftMadeOverAttempted).toBe("0/0");
    expect(row.ftPct).toBe(0);
    expect(row.points).toBe(0);
  });

  it("2PM/2PA excludes 3PM/3PA in the split", () => {
    let s = init();
    s = applyShot(s, { player: "jackson", shot: "two", made: true });
    s = applyShot(s, { player: "jackson", shot: "three", made: true });
    const row = computePlayerRow(s, "jackson");
    // After two makes: FGM=2, FGA=2, TPM=1, TPA=1. 2-point split = 1/1.
    expect(row.twoMadeOverAttempted).toBe("1/1");
    expect(row.threeMadeOverAttempted).toBe("1/1");
    // Points: 3*1 + 2*(2-1) + 0 = 5
    expect(row.points).toBe(5);
  });

  it("FT pct reflects makes over attempts", () => {
    const s = applyFreeThrows(init(), "jackson", ["make","miss"]);
    const row = computePlayerRow(s, "jackson");
    expect(row.ftMadeOverAttempted).toBe("1/2");
    expect(row.ftPct).toBe(50); // 100 * round(0.5, 3)
  });

  it("computePlayerRow uses roster.displayName for op", () => {
    const s = createInitialState({ opponentName: "Mitty", roster: DEFAULT_ROSTER });
    const row = computePlayerRow(s, "op");
    expect(row.displayName).toBe("Mitty");
  });

  it("computePlayerRow falls back to capitalized id when roster entry missing", () => {
    const s = createInitialState({ opponentName: "", roster: DEFAULT_ROSTER });
    const trimmed = { ...s, roster: s.roster.filter(p => p.id !== "jackson") };
    const row = computePlayerRow(trimmed, "jackson");
    expect(row.displayName).toBe("Jackson");
  });
});

describe("computeTeamRow", () => {
  it("sums all SF players, excludes op, uses state.sfPoints", () => {
    let s = init();
    s = applyShot(s, { player: "jackson", shot: "two", made: true });
    s = applyShot(s, { player: "op",      shot: "two", made: true });
    const team = computeTeamRow(s);
    expect(team.displayName).toBe("SF");
    expect(team.points).toBe(s.sfPoints); // 2
    expect(team.plusMinus).toBe(0);
  });
});

describe("computeOffRTG", () => {
  it("returns 0 when poss is 0", () => {
    expect(computeOffRTG(10, 0)).toBe(0);
  });
  it("one-decimal rounding", () => {
    expect(computeOffRTG(50, 48)).toBeCloseTo(104.2, 1);
  });
});
