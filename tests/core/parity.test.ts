/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { DEFAULT_ROSTER } from "@/core/roster";
import { parseCommand } from "@/core/parser";
import { execute } from "@/core/executor";

// Load all transcripts and expected snapshots eagerly at build time.
// Using Vite's import.meta.glob avoids needing @types/node for fs/path.
const txtModules = import.meta.glob("../fixtures/transcripts/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const jsonModules = import.meta.glob("../fixtures/transcripts/*.expected.json", {
  import: "default",
  eager: true,
}) as Record<string, unknown>;

function byName<T>(mods: Record<string, T>, suffix: string): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [key, val] of Object.entries(mods)) {
    const m = key.match(/\/([^/]+)$/);
    if (!m) continue;
    const file = m[1];
    if (!file.endsWith(suffix)) continue;
    const name = file.slice(0, -suffix.length);
    out[name] = val;
  }
  return out;
}

const transcripts = byName(txtModules, ".txt");
const expectations = byName(jsonModules, ".expected.json");

function runTranscript(transcript: string) {
  // These transcripts predate the pre-tipoff guard added in the executor.
  // They omit the explicit `tip` line, so we mark the game as tipped off
  // up-front to preserve the original parity expectations.
  let state = createInitialState({ opponentName: "Test", roster: DEFAULT_ROSTER });
  state = { ...state, tipoff: true, startTime: Date.now() };
  for (const line of transcript.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    state = execute(state, parseCommand(line, state.roster), line);
  }
  return state;
}

function snapshot(state: ReturnType<typeof runTranscript>): Record<string, unknown> {
  const nonZero: Record<string, number[]> = {};
  for (const [pid, arr] of Object.entries(state.rosterStats)) {
    if (arr.some(n => n !== 0)) nonZero[pid] = arr;
  }
  return {
    sfPoints: state.sfPoints,
    opPoints: state.opPoints,
    sfPOT: state.sfPOT,
    opPOT: state.opPOT,
    sfSP: state.sfSP,
    opSP: state.opSP,
    sfML: state.sfML,
    sfPOSS: state.sfPOSS,
    opPOSS: state.opPOSS,
    rosterStats: nonZero,
  };
}

const names = ["simple-shots", "ft-and-rebounds", "lineup-and-subs", "full-possession-flow"];

describe("parity tests against hand-verified transcripts", () => {
  for (const name of names) {
    it(name, () => {
      const txt = transcripts[name];
      const expected = expectations[name];
      expect(txt, `missing transcript ${name}.txt`).toBeDefined();
      expect(expected, `missing ${name}.expected.json`).toBeDefined();
      expect(snapshot(runTranscript(txt))).toEqual(expected);
    });
  }
});
