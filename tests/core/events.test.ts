import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { DEFAULT_ROSTER } from "@/core/roster";
import {
  applyShot, applyFreeThrows, applyRebound, applyTurnover,
  applyLineupChange, applySubChange, applyPossession
} from "@/core/events";

const init = () => createInitialState({ opponentName: "", roster: DEFAULT_ROSTER });

describe("applyShot", () => {
  it("made 3 for SF adds 3 pts and increments 2PM,2PA,3PM,3PA", () => {
    const s = applyShot(init(), { player: "jackson", shot: "three", made: true });
    expect(s.sfPoints).toBe(3);
    expect(s.rosterStats.jackson.slice(0,4)).toEqual([1,1,1,1]);
  });

  it("missed 3 for SF increments 2PA,3PA only", () => {
    const s = applyShot(init(), { player: "jackson", shot: "three", made: false });
    expect(s.sfPoints).toBe(0);
    expect(s.rosterStats.jackson.slice(0,4)).toEqual([0,1,0,1]);
  });

  it("made 2 for OP adds 2 pts", () => {
    const s = applyShot(init(), { player: "op", shot: "two", made: true });
    expect(s.opPoints).toBe(2);
  });

  it("missed layup by SF increments sfML", () => {
    const s = applyShot(init(), { player: "jackson", shot: "layup", made: false });
    expect(s.sfML).toBe(1);
    expect(s.rosterStats.jackson[1]).toBe(1);
  });

  it("missed layup by OP does NOT touch sfML", () => {
    const s = applyShot(init(), { player: "op", shot: "layup", made: false });
    expect(s.sfML).toBe(0);
  });

  it("made 2 with assist increments assist[8]", () => {
    const s = applyShot(init(), { player: "jackson", shot: "two", made: true, assistOrBlock: "ayaan" });
    expect(s.rosterStats.ayaan[8]).toBe(1);
  });

  it("missed 3 with block increments block[9]", () => {
    const s = applyShot(init(), { player: "op", shot: "three", made: false, assistOrBlock: "jackson" });
    expect(s.rosterStats.jackson[9]).toBe(1);
  });

  it("made shot while previousTurnover=true adds POT", () => {
    let s = init();
    s = { ...s, previousTurnover: true, possession: true };
    s = applyShot(s, { player: "jackson", shot: "two", made: true });
    expect(s.sfPoints).toBe(2);
    expect(s.sfPOT).toBe(2);
  });

  it("made shot while secondChance=true adds SP", () => {
    let s = init();
    s = { ...s, secondChance: true, possession: true };
    s = applyShot(s, { player: "jackson", shot: "two", made: true });
    expect(s.sfSP).toBe(2);
  });
});

describe("applyFreeThrows", () => {
  it("three makes by SF add 3 pts and FTM", () => {
    const s = applyFreeThrows(init(), "jackson", ["make","make","make"]);
    expect(s.sfPoints).toBe(3);
    expect(s.rosterStats.jackson[10]).toBe(3);
    expect(s.rosterStats.jackson[11]).toBe(3);
  });
  it("make then miss — SF gets 1 pt, FTA=2, FTM=1", () => {
    const s = applyFreeThrows(init(), "jackson", ["make","miss"]);
    expect(s.sfPoints).toBe(1);
    expect(s.rosterStats.jackson[10]).toBe(1);
    expect(s.rosterStats.jackson[11]).toBe(2);
  });
  it("OP free throws credit opPoints", () => {
    const s = applyFreeThrows(init(), "op", ["make","miss"]);
    expect(s.opPoints).toBe(1);
  });
});

describe("applyRebound", () => {
  it("OR increments [4] and sets secondChance=true", () => {
    const s = applyRebound(init(), "jackson", "or");
    expect(s.rosterStats.jackson[4]).toBe(1);
    expect(s.secondChance).toBe(true);
  });
  it("DR by SF sets possession=true and increments sfPOSS", () => {
    const s = applyRebound(init(), "jackson", "dr");
    expect(s.rosterStats.jackson[5]).toBe(1);
    expect(s.possession).toBe(true);
    expect(s.sfPOSS).toBe(1);
    expect(s.previousTurnover).toBe(false);
    expect(s.secondChance).toBe(false);
  });
  it("DR by OP sets possession=false and increments opPOSS", () => {
    const s = applyRebound(init(), "op", "dr");
    expect(s.possession).toBe(false);
    expect(s.opPOSS).toBe(1);
  });
});

describe("applyTurnover", () => {
  it("OP to Jackson: [6] on op, [7] on jackson, flags flip", () => {
    let s = { ...init(), possession: true as boolean | null };
    s = applyTurnover(s, "op", "jackson");
    expect(s.rosterStats.op[6]).toBe(1);
    expect(s.rosterStats.jackson[7]).toBe(1);
    expect(s.previousTurnover).toBe(true);
    expect(s.secondChance).toBe(false);
  });
  it("OP turnover (no steal) just increments op TO", () => {
    const s = applyTurnover(init(), "op");
    expect(s.rosterStats.op[6]).toBe(1);
    expect(s.rosterStats.jackson[7]).toBe(0);
  });
});

describe("applyLineupChange", () => {
  it("first call seeds lineup without updating +/-", () => {
    const s = applyLineupChange(init(), ["jackson","ayaan","wes","devin","james"]);
    expect(s.lineup).toEqual(["jackson","ayaan","wes","devin","james"]);
    expect(s.rosterStats.jackson[13]).toBe(0);
  });
  it("subsequent change computes +/- for guy going out", () => {
    let s = applyLineupChange(init(), ["jackson","ayaan","wes","devin","james"]);
    s = { ...s, sfPoints: 10, opPoints: 4 };
    s = applyLineupChange(s, ["jackson","ayaan","wes","devin","john"]);
    expect(s.rosterStats.james[12]).toBe(6);
    expect(s.rosterStats.john[13]).toBe(6);
  });
});

describe("applySubChange", () => {
  it("updates +/- for outgoing and seeds DIFF for incoming", () => {
    let s = applyLineupChange(init(), ["jackson","ayaan","wes","devin","james"]);
    s = { ...s, sfPoints: 8, opPoints: 2 };
    s = applySubChange(s, "john", "james");
    expect(s.rosterStats.james[12]).toBe(6);
    expect(s.rosterStats.john[13]).toBe(6);
    expect(s.lineup).toEqual(expect.arrayContaining(["jackson","ayaan","wes","devin","john"]));
    expect(s.lineup).not.toContain("james");
  });
});

describe("applyPossession", () => {
  it("-p op while possession=true: flips to false and opPOSS++", () => {
    let s = { ...init(), possession: true as boolean | null };
    s = applyPossession(s, "op");
    expect(s.possession).toBe(false);
    expect(s.opPOSS).toBe(1);
    expect(s.secondChance).toBe(false);
  });
  it("-p op while possession=false: secondChance=true", () => {
    let s = { ...init(), possession: false as boolean | null };
    s = applyPossession(s, "op");
    expect(s.secondChance).toBe(true);
    expect(s.possession).toBe(false);
  });
  it("-p sf while possession=false: flips to true, sfPOSS++", () => {
    let s = { ...init(), possession: false as boolean | null };
    s = applyPossession(s, "sf");
    expect(s.possession).toBe(true);
    expect(s.sfPOSS).toBe(1);
  });
  it("-p with possession=null does not change possession or POSS counters", () => {
    const before = init();
    const afterOp = applyPossession(before, "op");
    expect(afterOp.possession).toBe(null);
    expect(afterOp.opPOSS).toBe(0);
    expect(afterOp.sfPOSS).toBe(0);
    const afterSf = applyPossession(before, "sf");
    expect(afterSf.possession).toBe(null);
    expect(afterSf.opPOSS).toBe(0);
    expect(afterSf.sfPOSS).toBe(0);
  });
});

describe("immutability", () => {
  it("applyShot does not mutate the input state or its rosterStats arrays", () => {
    const s0 = init();
    const jacksonBefore = s0.rosterStats.jackson;
    const snapshot = [...jacksonBefore];
    const s1 = applyShot(s0, { player: "jackson", shot: "three", made: true });
    expect(s0.rosterStats.jackson).toBe(jacksonBefore);
    expect(s0.rosterStats.jackson).toEqual(snapshot);
    expect(s0.sfPoints).toBe(0);
    expect(s1).not.toBe(s0);
    expect(s1.rosterStats.jackson).not.toBe(jacksonBefore);
  });
});

describe("applyTurnover possession math (Python parity incl. double-increment)", () => {
  it("SF turnover with possession=true: possession flips to false; opPOSS += 2", () => {
    let s = { ...init(), possession: true as boolean | null };
    s = applyTurnover(s, "jackson");
    // first conditional: player != op and possession == false => no; (possession was true, so neither elif fires)
    // possession = (player == op) => false
    // then if possession: else opPOSS += 1 (the "bug" branch)
    // So opPOSS only += 1 in this scenario
    expect(s.possession).toBe(false);
    expect(s.opPOSS).toBe(1);
    expect(s.sfPOSS).toBe(0);
  });
  it("OP turnover with possession=true: opPOSS += 1 from first branch, then possession=true, sfPOSS += 1", () => {
    let s = { ...init(), possession: true as boolean | null };
    s = applyTurnover(s, "op");
    // chunks[0]==op and possession==true => opPOSS += 1
    // possession = (op == op) => true
    // if possession: sfPOSS += 1
    expect(s.possession).toBe(true);
    expect(s.opPOSS).toBe(1);
    expect(s.sfPOSS).toBe(1);
  });
  it("SF turnover with possession=false: sfPOSS += 1 from first branch, then possession=false, opPOSS += 1", () => {
    let s = { ...init(), possession: false as boolean | null };
    s = applyTurnover(s, "jackson");
    // chunks[0]!=op and possession==false => sfPOSS += 1
    // possession = false
    // if possession else opPOSS += 1
    expect(s.possession).toBe(false);
    expect(s.sfPOSS).toBe(1);
    expect(s.opPOSS).toBe(1);
  });
});

describe("applyShot possession update", () => {
  it("OP shot while possession=true flips to false and opPOSS++", () => {
    let s = { ...init(), possession: true as boolean | null };
    s = applyShot(s, { player: "op", shot: "two", made: true });
    expect(s.possession).toBe(false);
    expect(s.opPOSS).toBe(1);
    expect(s.previousTurnover).toBe(false);
    expect(s.secondChance).toBe(false);
  });
  it("SF shot while possession=false flips to true and sfPOSS++", () => {
    let s = { ...init(), possession: false as boolean | null };
    s = applyShot(s, { player: "jackson", shot: "two", made: false });
    expect(s.possession).toBe(true);
    expect(s.sfPOSS).toBe(1);
  });
});
