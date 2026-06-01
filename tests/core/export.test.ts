import { describe, it, expect, vi, afterEach } from "vitest";
import { createInitialState } from "@/core/state";
import { DEFAULT_ROSTER } from "@/core/roster";
import { applyShot, applyFreeThrows } from "@/core/events";
import { toCSV, toGameLogTxt, toMarkdownRecap } from "@/core/export";

const init = () => createInitialState({ opponentName: "", roster: DEFAULT_ROSTER });

afterEach(() => { vi.useRealTimers(); });

describe("toCSV", () => {
  it("first row is the Game Clock meta row (--:-- pre-tip)", () => {
    const csv = toCSV(init());
    const firstLine = csv.split(/\r?\n/)[0];
    expect(firstLine).toBe("Game Clock,--:--");
  });

  it("second row is the stats header", () => {
    const csv = toCSV(init());
    const secondLine = csv.split(/\r?\n/)[1];
    expect(secondLine).toBe(
      "Player,2PM/2PA,2P%,3PM/3PA,3P%,OR,DR,TO,STL,AST,BLK,FTM/FTA,FT%,+/-,Points",
    );
  });

  it("contains one row per SF roster player (in current order), a blank row, team row, opponent row", () => {
    const s = init();
    const csv = toCSV(s);
    const lines = csv
      .split(/\r?\n/)
      .filter((l, i, arr) => !(i === arr.length - 1 && l === "")); // drop trailing newline
    // meta + header + 16 SF players + blank + team + op = 21
    expect(lines.length).toBe(21);
    expect(lines[0].startsWith("Game Clock,")).toBe(true);
    expect(lines[1].startsWith("Player")).toBe(true);
    const blankIdx = lines.findIndex(l => l === "");
    expect(blankIdx).toBe(18); // meta=0, header=1, 16 players 2..17, blank=18
    expect(lines[19].startsWith("SF,")).toBe(true);
    expect(lines[20].startsWith("OP,")).toBe(true);
  });

  it("reflects stats in player rows", () => {
    let s = init();
    s = applyShot(s, { player: "jackson", shot: "two", made: true });
    s = applyFreeThrows(s, "jackson", ["make", "miss"]);
    const csv = toCSV(s);
    const jacksonLine = csv.split(/\r?\n/).find(l => l.startsWith("Jackson Corbett,"));
    expect(jacksonLine).toBeDefined();
    expect(jacksonLine!).toContain("1/1"); // 2PM/2PA
    expect(jacksonLine!).toContain("1/2"); // FTM/FTA
  });

  it("post-tip CSV meta row is Game Clock,+MM:SS", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 5, 18, 0, 0));
    const s = {
      ...init(),
      tipoff: true,
      startTime: Date.now(),
    };
    vi.advanceTimersByTime(312_000); // +05:12
    const csv = toCSV(s);
    const firstLine = csv.split(/\r?\n/)[0];
    expect(firstLine).toBe("Game Clock,+05:12");
  });
});

describe("toGameLogTxt", () => {
  it("empty history produces separator only", () => {
    const txt = toGameLogTxt(init());
    expect(txt).toBe("======================\n");
  });

  it("pre-tip entries have no prefix; post-tip entries are prefixed with +MM:SS", () => {
    const s = {
      ...init(),
      commandHistory: [
        { line: "-l a b c d e", tMs: null as number | null },
        { line: "tip", tMs: 0 },
        { line: "jackson two make", tMs: 37_000 },
      ],
    };
    const txt = toGameLogTxt(s);
    expect(txt.startsWith("======================\n")).toBe(true);
    expect(txt).toContain("\n-l a b c d e\n");
    expect(txt).toContain("\n+00:00  tip\n");
    expect(txt).toContain("\n+00:37  jackson two make\n");
  });
});

describe("toMarkdownRecap", () => {
  it("includes the four sections and opponent display name in the title", () => {
    const s = createInitialState({ opponentName: "Mitty", roster: DEFAULT_ROSTER });
    const md = toMarkdownRecap(s);
    expect(md).toMatch(/^# Mitty — \d{4}-\d{2}-\d{2}/);
    expect(md).toContain("**Game Clock at export:**");
    expect(md).toContain("**Final Score:**");
    expect(md).toContain("## Stats");
    expect(md).toContain("## Other Stats");
    expect(md).toContain("## Timeline");
  });

  it("timeline rows reflect commandHistory with per-entry timestamps", () => {
    const s = {
      ...createInitialState({ opponentName: "", roster: DEFAULT_ROSTER }),
      commandHistory: [
        { line: "-l a b c d e", tMs: null as number | null },
        { line: "tip", tMs: 0 },
        { line: "jackson two make", tMs: 37_000 },
      ],
    };
    const md = toMarkdownRecap(s);
    expect(md).toMatch(/\| --:-- \| -l a b c d e \|/);
    expect(md).toMatch(/\| \+00:00 \| tip \|/);
    expect(md).toMatch(/\| \+00:37 \| jackson two make \|/);
  });
});
