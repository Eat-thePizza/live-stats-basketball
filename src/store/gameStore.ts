import { useEffect, useReducer } from "react";
import type { GameState, HistoryEntry, PlayerId, Roster, RosterStats } from "@/core/types";

function normalizeHistoryEntry(e: unknown): HistoryEntry {
  if (typeof e === "string") return { line: e, tMs: null };
  if (e && typeof e === "object" && "line" in (e as any) && "tMs" in (e as any)) {
    const ent = e as { line: unknown; tMs: unknown };
    const line = typeof ent.line === "string" ? ent.line : String(ent.line ?? "");
    const tMs = typeof ent.tMs === "number" ? ent.tMs : null;
    return { line, tMs };
  }
  return { line: String((e as any) ?? ""), tMs: null };
}
import { createInitialState } from "@/core/state";
import { execute } from "@/core/executor";
import { applyLineupChange } from "@/core/events";
import { parseCommand } from "@/core/parser";
import { DEFAULT_ROSTER } from "@/core/roster";

export const STORAGE_KEYS = {
  game: "sfhs.game.current",
  roster: "sfhs.roster",
} as const;

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.game);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      !("rosterStats" in parsed)
    ) {
      return null;
    }
    const hydrated = parsed as GameState;
    if (Array.isArray((hydrated as any).commandHistory)) {
      (hydrated as any).commandHistory = (hydrated as any).commandHistory.map(normalizeHistoryEntry);
    } else {
      (hydrated as any).commandHistory = [];
    }
    // Backfill numeric fields that may be missing from older saved games.
    if (typeof (hydrated as any).opML !== "number") (hydrated as any).opML = 0;
    if (
      typeof (hydrated as any).endedAtMs !== "number" &&
      (hydrated as any).endedAtMs !== null
    ) {
      (hydrated as any).endedAtMs = null;
    }
    return hydrated;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.game, JSON.stringify(state));
  } catch (err) {
    console.warn("saveGame: failed to persist game state", err);
  }
}

export function loadRoster(): Roster | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.roster);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as Roster;
  } catch {
    return null;
  }
}

export function saveRoster(roster: Roster): void {
  try {
    localStorage.setItem(STORAGE_KEYS.roster, JSON.stringify(roster));
  } catch (err) {
    console.warn("saveRoster: failed to persist roster", err);
  }
}

export type Action =
  | { type: "SUBMIT_COMMAND"; line: string }
  | { type: "NEW_GAME"; opponentName: string }
  | { type: "NEW_GAME_WITH_LINEUP"; opponentName: string; startingLineup: PlayerId[] }
  | { type: "SET_ROSTER"; roster: Roster }
  | { type: "END_GAME"; endedAtMs: number }
  | { type: "HYDRATE"; state: GameState };

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "SUBMIT_COMMAND": {
      const cmd = parseCommand(action.line, state.roster);
      return execute(state, cmd, action.line);
    }
    case "NEW_GAME": {
      return createInitialState({
        opponentName: action.opponentName,
        roster: state.roster,
      });
    }
    case "NEW_GAME_WITH_LINEUP": {
      const fresh = createInitialState({ opponentName: action.opponentName, roster: state.roster });
      return applyLineupChange(fresh, action.startingLineup);
    }
    case "SET_ROSTER": {
      const nextStats: RosterStats = {};
      for (const p of action.roster) {
        nextStats[p.id] = state.rosterStats[p.id] ?? new Array(14).fill(0);
      }
      return { ...state, roster: action.roster, rosterStats: nextStats };
    }
    case "END_GAME": {
      return { ...state, endedAtMs: action.endedAtMs };
    }
    case "HYDRATE": {
      return action.state;
    }
    default:
      return state;
  }
}

function initialize(): GameState {
  const loaded = loadGame();
  if (loaded) return loaded;
  const roster = loadRoster() ?? DEFAULT_ROSTER;
  return createInitialState({ opponentName: "", roster });
}

export function useGameStore(): {
  state: GameState;
  submit: (line: string) => void;
  newGame: (opponentName: string) => void;
  newGameWithLineup: (opponentName: string, startingLineup: PlayerId[]) => void;
  setRoster: (roster: Roster) => void;
  endGame: (endedAtMs: number) => void;
} {
  const [state, dispatch] = useReducer(reducer, undefined, initialize);

  useEffect(() => {
    saveGame(state);
  }, [state]);

  useEffect(() => {
    saveRoster(state.roster);
  }, [state.roster]);

  return {
    state,
    submit: (line: string) => dispatch({ type: "SUBMIT_COMMAND", line }),
    newGame: (opponentName: string) =>
      dispatch({ type: "NEW_GAME", opponentName }),
    newGameWithLineup: (opponentName: string, startingLineup: PlayerId[]) =>
      dispatch({ type: "NEW_GAME_WITH_LINEUP", opponentName, startingLineup }),
    setRoster: (roster: Roster) => dispatch({ type: "SET_ROSTER", roster }),
    endGame: (endedAtMs: number) => dispatch({ type: "END_GAME", endedAtMs }),
  };
}
