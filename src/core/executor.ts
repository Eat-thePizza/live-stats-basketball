import type { Command, GameState, HistoryEntry } from "./types";
import {
  applyShot, applyFreeThrows, applyRebound, applyTurnover,
  applyLineupChange, applySubChange, applyPossession
} from "./events";

function currentTMs(state: GameState): number | null {
  if (!state.tipoff || state.startTime === null) return null;
  return Math.max(0, Date.now() - state.startTime);
}

// Commands allowed before tipoff. Setting the starting lineup is permitted so
// the user can configure the on-court 5 before pressing Tipoff. Everything
// else is blocked until the clock starts.
const PRE_TIPOFF_ALLOWED = new Set<Command["kind"]>([
  "tip",
  "lineup",
  "sub",
  "noop",
]);

export function isCommandAllowedBeforeTipoff(kind: Command["kind"]): boolean {
  return PRE_TIPOFF_ALLOWED.has(kind);
}

export function execute(state: GameState, cmd: Command, rawLine: string): GameState {
  const withHistory: GameState = rawLine.trim() === ""
    ? state
    : {
        ...state,
        commandHistory: [
          ...state.commandHistory,
          { line: rawLine, tMs: currentTMs(state) } as HistoryEntry,
        ],
      };

  // Pre-tipoff guard: keep the raw line in history (so the user can see what
  // they typed and why nothing changed) but skip applying the event.
  if (!state.tipoff && !PRE_TIPOFF_ALLOWED.has(cmd.kind)) {
    return withHistory;
  }

  switch (cmd.kind) {
    case "noop":    return withHistory;
    case "tip": {
      if (withHistory.tipoff) return withHistory;
      const t0 = Date.now();
      const tipped: GameState = { ...withHistory, tipoff: true, startTime: t0 };
      const h = [...tipped.commandHistory];
      if (h.length > 0 && h[h.length - 1].line === rawLine) {
        h[h.length - 1] = { ...h[h.length - 1], tMs: 0 };
      }
      return { ...tipped, commandHistory: h };
    }
    case "quarter": return { ...withHistory, previousTurnover: false, possession: null };
    case "timeout": return withHistory;
    case "lineup":     return applyLineupChange(withHistory, cmd.players);
    case "sub":        return applySubChange(withHistory, cmd.in, cmd.out);
    case "possession": return applyPossession(withHistory, cmd.team);
    case "rebound":    return applyRebound(withHistory, cmd.player, cmd.type);
    case "turnover":   return applyTurnover(withHistory, cmd.player, cmd.stealer);
    case "ft":         return applyFreeThrows(withHistory, cmd.player, cmd.results);
    case "shot":       return applyShot(withHistory, { player: cmd.player, shot: cmd.shot, made: cmd.made, assistOrBlock: cmd.assistOrBlock });
  }
}
