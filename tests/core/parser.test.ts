import { describe, it, expect } from "vitest";
import { parseCommand } from "@/core/parser";
import { DEFAULT_ROSTER } from "@/core/roster";

const roster = DEFAULT_ROSTER;

describe("parseCommand", () => {
  it("parses a 2-point make with assist", () => {
    expect(parseCommand("jackson two make ayaan", roster))
      .toEqual({ kind: "shot", player: "jackson", shot: "two", made: true, assistOrBlock: "ayaan" });
  });
  it("parses a 3-point miss with blocker", () => {
    expect(parseCommand("op three miss jackson", roster))
      .toEqual({ kind: "shot", player: "op", shot: "three", made: false, assistOrBlock: "jackson" });
  });
  it("parses a layup miss (flexible miss detection: 'omiss')", () => {
    expect(parseCommand("jackson layup omiss", roster))
      .toEqual({ kind: "shot", player: "jackson", shot: "layup", made: false });
  });
  it("parses free throws", () => {
    expect(parseCommand("jackson ft make make miss", roster))
      .toEqual({ kind: "ft", player: "jackson", results: ["make","make","miss"] });
  });
  it("parses rebound", () => {
    expect(parseCommand("devin or", roster)).toEqual({ kind: "rebound", player: "devin", type: "or" });
    expect(parseCommand("devin dr", roster)).toEqual({ kind: "rebound", player: "devin", type: "dr" });
  });
  it("parses turnovers with and without steal", () => {
    expect(parseCommand("op to jackson", roster)).toEqual({ kind: "turnover", player: "op", stealer: "jackson" });
    expect(parseCommand("op to", roster)).toEqual({ kind: "turnover", player: "op" });
  });
  it("parses lineup, sub, possession, timeout, quarter, tip", () => {
    expect(parseCommand("-l wes devin james jackson ayaan", roster).kind).toBe("lineup");
    expect(parseCommand("-s john james", roster)).toEqual({ kind: "sub", in: "john", out: "james" });
    expect(parseCommand("-p sf", roster)).toEqual({ kind: "possession", team: "sf" });
    expect(parseCommand("-p op", roster)).toEqual({ kind: "possession", team: "op" });
    expect(parseCommand("-t", roster)).toEqual({ kind: "timeout" });
    expect(parseCommand("---", roster)).toEqual({ kind: "quarter" });
    expect(parseCommand("tip", roster)).toEqual({ kind: "tip" });
  });
  it("returns noop for blank, unknown player, or malformed lines", () => {
    expect(parseCommand("", roster)).toEqual({ kind: "noop" });
    expect(parseCommand("nobody two make", roster)).toEqual({ kind: "noop" });
    expect(parseCommand("-l nobody", roster)).toEqual({ kind: "noop" });
  });
});
