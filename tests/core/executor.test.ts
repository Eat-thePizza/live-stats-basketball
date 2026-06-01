import { describe, it, expect, vi, afterEach } from "vitest";
import { execute } from "@/core/executor";
import { parseCommand } from "@/core/parser";
import { createInitialState } from "@/core/state";
import { DEFAULT_ROSTER } from "@/core/roster";
import type { GameState } from "@/core/types";

const init = () => createInitialState({ opponentName: "", roster: DEFAULT_ROSTER });
// Pre-tipoff guard means most events are no-ops until the clock starts.
// `tipped()` gives a state already past tipoff for tests that don't care
// about the tip moment itself.
const tipped = (): GameState => ({ ...init(), tipoff: true, startTime: Date.now() });
const run = (s: GameState, line: string) => execute(s, parseCommand(line, s.roster), line);
const lines = (s: GameState) => s.commandHistory.map(e => e.line);

afterEach(() => { vi.useRealTimers(); });

describe("execute", () => {
  it("noop with blank line does not append to history", () => {
    const s = execute(init(), { kind: "noop" }, "");
    expect(s.commandHistory).toEqual([]);
  });

  it("noop with unknown player still appends raw line to history", () => {
    const s = run(init(), "nobody two make");
    expect(s.commandHistory).toEqual([{ line: "nobody two make", tMs: null }]);
  });

  it("tip sets tipoff and startTime on first call only", () => {
    const s1 = run(init(), "tip");
    expect(s1.tipoff).toBe(true);
    expect(s1.startTime).not.toBeNull();
    const s2 = run(s1, "tip");
    expect(s2.startTime).toBe(s1.startTime); // unchanged
  });

  it("quarter clears previousTurnover and possession", () => {
    let s: GameState = { ...tipped(), previousTurnover: true, possession: true };
    s = run(s, "---");
    expect(s.previousTurnover).toBe(false);
    expect(s.possession).toBeNull();
  });

  it("timeout only appends to history", () => {
    const s = run(init(), "-t");
    expect(lines(s)).toEqual(["-t"]);
  });

  it("shot command flows through parser → executor → events", () => {
    const s = run(tipped(), "jackson three make");
    expect(s.sfPoints).toBe(3);
    expect(s.rosterStats.jackson.slice(0,4)).toEqual([1,1,1,1]);
    expect(lines(s)).toEqual(["jackson three make"]);
  });

  it("turnover flips flags and updates POSS", () => {
    let s: GameState = { ...tipped(), possession: true };
    s = run(s, "op to jackson");
    expect(s.rosterStats.op[6]).toBe(1);
    expect(s.rosterStats.jackson[7]).toBe(1);
    expect(s.previousTurnover).toBe(true);
    expect(s.secondChance).toBe(false);
  });

  it("-p op after sf possession flips possession and increments opPOSS", () => {
    let s: GameState = { ...tipped(), possession: true };
    s = run(s, "-p op");
    expect(s.possession).toBe(false);
    expect(s.opPOSS).toBe(1);
  });

  it("lineup → sub flow updates +/- correctly", () => {
    let s = run(init(), "-l wes devin james jackson ayaan");
    s = { ...s, sfPoints: 10, opPoints: 4 };
    s = run(s, "-s john james");
    expect(s.rosterStats.james[12]).toBe(6);
    expect(s.rosterStats.john[13]).toBe(6);
  });

  it("preserves history order across multiple commands", () => {
    let s = init();
    s = run(s, "-l wes devin james jackson ayaan");
    s = run(s, "jackson two make ayaan");
    s = run(s, "op three miss jackson");
    expect(lines(s)).toEqual([
      "-l wes devin james jackson ayaan",
      "jackson two make ayaan",
      "op three miss jackson",
    ]);
  });

  it("pre-tip command gets tMs: null", () => {
    const s = run(init(), "jackson two make ayaan");
    expect(s.commandHistory[s.commandHistory.length - 1]).toEqual({ line: "jackson two make ayaan", tMs: null });
  });

  it("tip command entry has tMs:0 and sets startTime to Date.now()", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 5, 18, 0, 0));
    const s = run(init(), "tip");
    expect(s.tipoff).toBe(true);
    expect(s.startTime).toBe(Date.now());
    expect(s.commandHistory[s.commandHistory.length - 1]).toEqual({ line: "tip", tMs: 0 });
  });

  it("post-tip command carries the exact elapsed tMs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 5, 18, 0, 0));
    let s = run(init(), "tip");
    vi.advanceTimersByTime(5_120);
    s = run(s, "jackson two make ayaan");
    expect(s.commandHistory[s.commandHistory.length - 1]?.tMs).toBe(5_120);
  });

  it("second tip press is a no-op for state but still logged", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 5, 18, 0, 0));
    let s = run(init(), "tip");
    const t0 = s.startTime;
    vi.advanceTimersByTime(2_000);
    s = run(s, "tip");
    expect(s.startTime).toBe(t0);
    expect(s.commandHistory.length).toBe(2);
    expect(s.commandHistory[s.commandHistory.length - 1]?.line).toBe("tip");
    expect(s.commandHistory[s.commandHistory.length - 1]?.tMs).toBe(2_000);
  });
});

describe("pre-tipoff guard", () => {
  it("ignores shot attempts before tipoff but keeps the line in history", () => {
    let s = init();
    s = run(s, "jackson two make");
    expect(s.tipoff).toBe(false);
    expect(s.sfPoints).toBe(0);
    expect(s.rosterStats.jackson?.[0] ?? 0).toBe(0); // no FGM bump
    expect(s.commandHistory[s.commandHistory.length - 1]?.line).toBe("jackson two make");
  });

  it("ignores free throws / rebounds / turnovers / possession pre-tipoff", () => {
    let s = init();
    s = run(s, "op ft make");
    s = run(s, "wes or");
    s = run(s, "max to");
    s = run(s, "-p op");
    expect(s.opPoints).toBe(0);
    expect(s.sfPOSS).toBe(0);
    expect(s.opPOSS).toBe(0);
    expect(s.commandHistory).toHaveLength(4);
  });

  it("allows tip and lineup before tipoff", () => {
    let s = init();
    s = run(s, "-l jackson ayaan wes max devin");
    expect(s.lineup).toEqual(["jackson", "ayaan", "wes", "max", "devin"]);
    s = run(s, "tip");
    expect(s.tipoff).toBe(true);
  });

  it("after tipoff, all commands resume normal behavior", () => {
    let s = run(init(), "tip");
    s = run(s, "jackson two make");
    expect(s.sfPoints).toBe(2);
  });
});
