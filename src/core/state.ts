import type { GameState, Roster, RosterStats } from "./types";

export function createInitialState(args: { opponentName: string; roster: Roster }): GameState {
  const trimmedOpName = args.opponentName.trim();
  const opDisplay = trimmedOpName === "" ? "OP" : trimmedOpName;
  const roster: Roster = args.roster.map(p =>
    p.id === "op" ? { ...p, displayName: opDisplay } : p,
  );
  const rosterStats: RosterStats = {};
  for (const p of roster) rosterStats[p.id] = new Array(14).fill(0);
  return {
    opponentName: args.opponentName,
    roster,
    rosterStats,
    sfPoints: 0, opPoints: 0,
    sfPOT: 0, opPOT: 0,
    sfSP: 0, opSP: 0,
    sfML: 0, opML: 0,
    sfPOSS: 0, opPOSS: 0,
    possession: null,
    previousTurnover: false,
    secondChance: false,
    lineup: [],
    tipoff: false,
    startTime: null,
    endedAtMs: null,
    commandHistory: [],
    createdAt: Date.now(),
  };
}
